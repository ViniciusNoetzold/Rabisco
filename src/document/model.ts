import type { PixelBuffer, Rect } from '../layers/types';
import {
  propriedadesPadrao,
  type Alvo,
  type EstruturaDocumento,
  type Grupo,
  type PropriedadesCamada,
} from './camadas';
import { DPI_PADRAO, validarDimensoes } from './dimensoes';

type CanvasDaCamada = OffscreenCanvas | HTMLCanvasElement;

export interface Layer<Superficie extends CanvasDaCamada = CanvasDaCamada>
  extends PropriedadesCamada {
  canvas: Superficie;
  /** Máscara em tons de cinza do tamanho do papel: branco revela, preto esconde. */
  mascara?: Superficie;
}

export type { Alvo, EstruturaDocumento, Grupo, PropriedadesCamada } from './camadas';

function validarPixels(imagem: PixelBuffer): void {
  validarDimensoes(imagem.width, imagem.height);
  if (imagem.data.length !== imagem.width * imagem.height * 4) {
    throw new Error('Os pixels da imagem não correspondem às dimensões.');
  }
}

export function comoImageData(imagem: PixelBuffer): ImageData {
  const { data, width, height } = imagem;
  const dados =
    data.buffer instanceof ArrayBuffer
      ? new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)
      : new Uint8ClampedArray(data);
  return new ImageData(dados, width, height);
}

function novoCanvas(largura: number, altura: number) {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  return canvas;
}

function contexto2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new Error('Não foi possível iniciar a área de desenho.');
  return contexto;
}

function semCanvas({ canvas: _canvas, mascara: _mascara, ...propriedades }: Layer) {
  return structuredClone(propriedades) as PropriedadesCamada;
}

/**
 * O documento: camadas do mesmo tamanho, de baixo para cima, cada uma com os pixels no próprio
 * canvas (e uma máscara opcional), mais grupos. Leituras pegam só a área pedida; `copiarPixels()`
 * sem área copia a camada inteira e deve ser usado só quando a operação precisa de tudo.
 */
export class RabiscoDocument {
  readonly id = Array.from(crypto.getRandomValues(new Uint32Array(4)), (parte) =>
    parte.toString(16).padStart(8, '0'),
  ).join('');
  name: string;
  dpi = DPI_PADRAO;
  readonly layers: Layer<HTMLCanvasElement>[] = [];
  readonly grupos: Grupo[] = [];
  activeLayerId: string;
  /** Pincéis e borrachas pintam na máscara da camada ativa em vez dos pixels. */
  editandoMascara = false;
  private largura: number;
  private altura: number;

  constructor(nome = 'Sem título', largura = 1024, altura = 640) {
    validarDimensoes(largura, altura);
    this.name = nome;
    this.largura = largura;
    this.altura = altura;
    this.activeLayerId = 'camada-1';
    this.preencherPapel(largura, altura, '#ffffff');
  }

  get width(): number {
    return this.largura;
  }

  get height(): number {
    return this.altura;
  }

  get activeLayer(): Layer<HTMLCanvasElement> {
    const camada = this.camada(this.activeLayerId);
    if (!camada) throw new Error('A camada ativa não está no documento.');
    return camada;
  }

  camada(id: string): Layer<HTMLCanvasElement> | undefined {
    return this.layers.find((camada) => camada.id === id);
  }

  /** Onde as ferramentas pintam agora: a camada ativa ou a máscara dela. */
  alvoAtivo(): Alvo {
    const camada = this.activeLayer;
    return { camada: camada.id, mascara: this.editandoMascara && Boolean(camada.mascara) };
  }

  existe(alvo: Alvo): boolean {
    const camada = this.camada(alvo.camada);
    return Boolean(camada && (!alvo.mascara || camada.mascara));
  }

  canvasDo(alvo: Alvo = this.alvoAtivo()): HTMLCanvasElement {
    const camada = this.camada(alvo.camada);
    const canvas = alvo.mascara ? camada?.mascara : camada?.canvas;
    if (!canvas) throw new Error('Essa camada não está mais no documento.');
    return canvas;
  }

  contexto(alvo: Alvo = this.alvoAtivo()): CanvasRenderingContext2D {
    return contexto2d(this.canvasDo(alvo));
  }

  contextoAtivo(): CanvasRenderingContext2D {
    return this.contexto();
  }

  /** Cópia dos pixels de uma área (da camada ativa, se nenhum alvo for dado). */
  lerPixels(
    area: Rect = { x: 0, y: 0, width: this.width, height: this.height },
    alvo: Alvo = this.alvoAtivo(),
  ): ImageData {
    return this.contexto(alvo).getImageData(area.x, area.y, area.width, area.height);
  }

  /** Cópia da camada inteira. Custa largura × altura × 4 bytes: prefira `lerPixels(area)`. */
  copiarPixels(alvo: Alvo = this.alvoAtivo()): ImageData {
    return this.lerPixels(undefined, alvo);
  }

  aplicarPixels(imagem: PixelBuffer, x = 0, y = 0, alvo: Alvo = this.alvoAtivo()): void {
    if (imagem.data.length !== imagem.width * imagem.height * 4) {
      throw new Error('Os pixels da imagem não correspondem às dimensões.');
    }
    this.contexto(alvo).putImageData(comoImageData(imagem), Math.trunc(x), Math.trunc(y));
  }

  /** Troca o documento por uma única camada de fundo com esta imagem (abrir arquivo). */
  substituir(nome: string, imagem: PixelBuffer): void {
    validarPixels(imagem);
    this.name = nome;
    this.reiniciar(imagem.width, imagem.height);
    this.contextoAtivo().putImageData(comoImageData(imagem), 0, 0);
  }

  /** Documento novo: uma camada de fundo de uma cor só. */
  preencherPapel(largura: number, altura: number, cor: string): void {
    validarDimensoes(largura, altura);
    this.reiniciar(largura, altura);
    const contexto = this.contextoAtivo();
    contexto.fillStyle = cor;
    contexto.fillRect(0, 0, largura, altura);
  }

  /** Muda o tamanho de todas as camadas e máscaras. Os pixels são apagados: quem chama repõe. */
  redimensionarDocumento(largura: number, altura: number): void {
    validarDimensoes(largura, altura);
    this.largura = largura;
    this.altura = altura;
    for (const camada of this.layers) {
      camada.canvas.width = largura;
      camada.canvas.height = altura;
      if (camada.mascara) {
        camada.mascara.width = largura;
        camada.mascara.height = altura;
      }
    }
  }

  estrutura(): EstruturaDocumento {
    return {
      camadas: this.layers.map(semCanvas),
      grupos: structuredClone(this.grupos),
      ativa: this.activeLayerId,
      editandoMascara: this.editandoMascara,
    };
  }

  /**
   * Põe o documento na estrutura pedida: cria as camadas que faltam (transparentes), remove as
   * que sobram, reordena e copia as propriedades. Os pixels das camadas mantidas não mudam.
   */
  aplicarEstrutura(estrutura: EstruturaDocumento): void {
    const atuais = new Map(this.layers.map((camada) => [camada.id, camada]));
    const novas = estrutura.camadas.map((propriedades) => {
      const existente = atuais.get(propriedades.id);
      const camada: Layer<HTMLCanvasElement> = existente ?? {
        ...propriedades,
        canvas: novoCanvas(this.width, this.height),
      };
      Object.assign(camada, structuredClone(propriedades));
      for (const chave of Object.keys(camada) as (keyof Layer)[]) {
        if (chave !== 'canvas' && chave !== 'mascara' && !(chave in propriedades))
          delete camada[chave];
      }
      if (camada.temMascara && !camada.mascara) {
        camada.mascara = novoCanvas(this.width, this.height);
        const contexto = contexto2d(camada.mascara);
        contexto.fillStyle = '#ffffff';
        contexto.fillRect(0, 0, this.width, this.height);
      } else if (!camada.temMascara) delete camada.mascara;
      return camada;
    });
    this.layers.splice(0, this.layers.length, ...novas);
    this.grupos.splice(0, this.grupos.length, ...structuredClone(estrutura.grupos));
    this.activeLayerId = this.camada(estrutura.ativa) ? estrutura.ativa : (novas.at(-1)?.id ?? '');
    this.editandoMascara = estrutura.editandoMascara && Boolean(this.activeLayer.mascara);
  }

  /** Pixels compostos (o que se vê) de uma área: amostragem "imagem toda", copiar mesclado. */
  composto(
    area: Rect = { x: 0, y: 0, width: this.width, height: this.height },
    compor: (doc: RabiscoDocument, destino: HTMLCanvasElement, area: Rect) => void,
  ): ImageData {
    const tela = novoCanvas(this.width, this.height);
    compor(this, tela, area);
    return contexto2d(tela).getImageData(area.x, area.y, area.width, area.height);
  }

  private reiniciar(largura: number, altura: number) {
    this.largura = largura;
    this.altura = altura;
    const fundo: Layer<HTMLCanvasElement> = {
      ...propriedadesPadrao(this.layers[0]?.id ?? 'camada-1', 'Papel'),
      fundo: true,
      canvas: this.layers[0]?.canvas ?? novoCanvas(largura, altura),
    };
    // Atribuir o tamanho também limpa o canvas, como queremos ao recomeçar.
    fundo.canvas.width = largura;
    fundo.canvas.height = altura;
    this.layers.splice(0, this.layers.length, fundo);
    this.grupos.splice(0);
    this.activeLayerId = fundo.id;
    this.editandoMascara = false;
  }
}
