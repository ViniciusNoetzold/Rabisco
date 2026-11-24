import type { PixelBuffer, Rect } from '../layers/types';
import { DPI_PADRAO, validarDimensoes } from './dimensoes';

type CanvasDaCamada = OffscreenCanvas | HTMLCanvasElement;

export interface Layer<Superficie extends CanvasDaCamada = CanvasDaCamada> {
  id: string;
  name: string;
  canvas: Superficie;
  visible: boolean;
  opacity: number;
  locked: boolean;
}

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

/**
 * O papel guarda os pixels só no canvas de cada camada. Leituras pegam apenas a área pedida;
 * `copiarPixels()` sem área copia o papel inteiro e deve ser usado só quando a operação
 * realmente precisa de tudo (balde, transformações, arquivo).
 */
export class RabiscoDocument {
  readonly id = Array.from(crypto.getRandomValues(new Uint32Array(4)), (parte) =>
    parte.toString(16).padStart(8, '0'),
  ).join('');
  name: string;
  dpi = DPI_PADRAO;
  readonly layers: Layer<HTMLCanvasElement>[];
  activeLayerId: string;

  constructor(nome = 'Sem título', largura = 1024, altura = 640) {
    validarDimensoes(largura, altura);
    this.name = nome;
    this.activeLayerId = 'camada-1';
    this.layers = [
      {
        id: this.activeLayerId,
        name: 'Papel',
        canvas: document.createElement('canvas'),
        visible: true,
        opacity: 1,
        locked: false,
      },
    ];
    this.preencherPapel(largura, altura, '#ffffff');
  }

  get width(): number {
    return this.activeLayer.canvas.width;
  }

  get height(): number {
    return this.activeLayer.canvas.height;
  }

  get activeLayer(): Layer<HTMLCanvasElement> {
    const camada = this.layers.find(({ id }) => id === this.activeLayerId);
    if (!camada) throw new Error('A camada ativa não está no documento.');
    return camada;
  }

  contextoAtivo(): CanvasRenderingContext2D {
    const contexto = this.activeLayer.canvas.getContext('2d', { willReadFrequently: true });
    if (!contexto) throw new Error('Não foi possível iniciar a área de desenho.');
    return contexto;
  }

  /** Cópia dos pixels de uma área da camada ativa. */
  lerPixels(area: Rect = { x: 0, y: 0, width: this.width, height: this.height }): ImageData {
    return this.contextoAtivo().getImageData(area.x, area.y, area.width, area.height);
  }

  /** Cópia do papel inteiro. Custa largura × altura × 4 bytes: prefira `lerPixels(area)`. */
  copiarPixels(): ImageData {
    return this.lerPixels();
  }

  aplicarPixels(imagem: PixelBuffer, x = 0, y = 0): void {
    if (imagem.data.length !== imagem.width * imagem.height * 4) {
      throw new Error('Os pixels da imagem não correspondem às dimensões.');
    }
    this.contextoAtivo().putImageData(comoImageData(imagem), Math.trunc(x), Math.trunc(y));
  }

  substituir(nome: string, imagem: PixelBuffer): void {
    validarPixels(imagem);
    this.name = nome;
    this.redimensionarCamada(imagem.width, imagem.height);
    this.contextoAtivo().putImageData(comoImageData(imagem), 0, 0);
  }

  /** Papel novo de uma cor só, sem montar um buffer do tamanho do papel. */
  preencherPapel(largura: number, altura: number, cor: string): void {
    validarDimensoes(largura, altura);
    this.redimensionarCamada(largura, altura);
    const contexto = this.contextoAtivo();
    contexto.fillStyle = cor;
    contexto.fillRect(0, 0, largura, altura);
  }

  private redimensionarCamada(largura: number, altura: number): void {
    const { canvas } = this.activeLayer;
    // Atribuir o mesmo tamanho também limpa o canvas, como queremos ao substituir.
    canvas.width = largura;
    canvas.height = altura;
  }
}
