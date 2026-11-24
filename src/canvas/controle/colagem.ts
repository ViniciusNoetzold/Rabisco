import { useEditor } from '../../app/store';
import { serializarImagem } from '../../commands/comandos';
import { limitarArea } from '../../commands/desenho';
import { novoId } from '../../document/camadas';
import { validarDimensoes } from '../../document/dimensoes';
import { redimensionarEInclinar } from '../../document/transformacoes';
import {
  prepararRecorte,
  prepararRecorteDaArea,
  type RecorteFlutuante,
} from '../../document/selecao';
import { copiarImagemClipboard } from '../../io/clipboard';
import type { PixelBuffer, Rect } from '../../layers/types';
import { referenciaDaSelecao } from '../../shapes/referencia';
import type { NucleoEditor } from './nucleo';
import type { ControleSelecao } from './selecao';

interface ColagemFlutuante {
  pixels: PixelBuffer;
  destino: Rect;
  recorte: RecorteFlutuante;
  corTransparente?: string;
  papel?: { largura: number; altura: number; fundo: string };
  /** Ao confirmar, a imagem vira uma camada nova com este nome (colagem de fora). */
  nomeCamada?: string;
}

/**
 * Copiar, recortar e colar. Uma imagem vinda de fora fica "flutuando" sobre o papel (num
 * elemento próprio) até ser confirmada com Enter, um clique fora ou a troca de ferramenta.
 */
export class ControleColagem {
  private copiado: ImageData | null = null;
  private flutuante: ColagemFlutuante | null = null;

  constructor(
    private readonly nucleo: NucleoEditor,
    private readonly selecao: ControleSelecao,
    private readonly camada: HTMLDivElement,
    private readonly workspace: HTMLDivElement,
  ) {}

  get ativa(): boolean {
    return this.flutuante !== null;
  }

  /** Cópia para o editor e para a área de transferência do sistema (como PNG). */
  async copiar(
    recortar: boolean,
    apagarSelecao: () => void,
    /** Copiar mesclado: lê o que se vê (todas as camadas) em vez da camada ativa. */
    lerMesclado?: (area: Rect) => ImageData,
  ) {
    const area = this.selecao.area;
    if (!area) return;
    const { selecaoTransparente, color2 } = useEditor.getState();
    const recorte = prepararRecorteDaArea(
      lerMesclado ? lerMesclado(area) : this.nucleo.doc.lerPixels(area),
      area,
      this.selecao.mascara,
      selecaoTransparente ? color2 : undefined,
    ).imagem;
    this.copiado = recorte.getContext('2d')!.getImageData(0, 0, area.width, area.height);
    const paraSistema = copiarImagemClipboard(recorte).then(
      () => true,
      () => false,
    );
    if (recortar) apagarSelecao();
    const copiadoNoSistema = await paraSistema;
    this.nucleo.avisar(
      recortar
        ? 'Seleção recortada. Use Colar para reposicionar.'
        : lerMesclado
          ? 'Cópia mesclada de todas as camadas visíveis.'
          : copiadoNoSistema
            ? 'Seleção copiada como PNG.'
            : 'Seleção copiada neste editor.',
    );
  }

  /** Cola a última cópia feita neste editor, perto do canto do papel. */
  colar() {
    const { doc } = this.nucleo;
    if (!this.copiado) {
      this.nucleo.avisar('Use Ctrl+V para colar uma imagem ou Colar de… para escolher um arquivo.');
      return;
    }
    const x = Math.min(24, doc.width - 1);
    const y = Math.min(24, doc.height - 1);
    const selecao = {
      x,
      y,
      width: Math.min(this.copiado.width, doc.width - x),
      height: Math.min(this.copiado.height, doc.height - y),
    };
    this.confirmar();
    useEditor.getState().setTool('select');
    this.selecao.selecionar(selecao);
    const { selecaoTransparente, color2 } = useEditor.getState();
    this.nucleo.executar({
      tipo: 'ColarImagem',
      x,
      y,
      imagem: serializarImagem(this.copiado),
      corTransparente: selecaoTransparente ? color2 : undefined,
    });
    this.nucleo.notificar();
  }

  /** A imagem da área de transferência é a mesma copiada aqui? Então cola a cópia interna. */
  igualACopia(pixels: PixelBuffer): boolean {
    const capa = this.copiado;
    return Boolean(
      capa &&
        pixels.width === capa.width &&
        pixels.height === capa.height &&
        pixels.data.every((valor, i) => valor === capa.data[i]),
    );
  }

  /** Imagem de fora (Ctrl+V, arquivo, arrastar): fica flutuando até ser confirmada. */
  colarImagem(pixels: PixelBuffer, aumentar: boolean, nomeCamada?: string) {
    const { doc } = this.nucleo;
    const { color2, selecaoTransparente, setTool } = useEditor.getState();
    const largura = Math.max(pixels.width, doc.width);
    const altura = Math.max(pixels.height, doc.height);
    const papel =
      aumentar && (largura !== doc.width || altura !== doc.height)
        ? { largura, altura, fundo: color2 }
        : undefined;
    if (papel) validarDimensoes(papel.largura, papel.altura);
    const destino = {
      x: Math.max(0, Math.min(24, doc.width - pixels.width)),
      y: Math.max(0, Math.min(24, doc.height - pixels.height)),
      width: pixels.width,
      height: pixels.height,
    };
    const corTransparente = selecaoTransparente ? color2 : undefined;
    const recorte = prepararRecorte(pixels, { ...destino, x: 0, y: 0 }, undefined, corTransparente);
    setTool('select');
    this.flutuante = { pixels, destino, papel, recorte, corTransparente, nomeCamada };
    this.mostrar();
    this.selecao.selecionar(destino);
    this.nucleo.avisar('Arraste a imagem para posicionar. Enter confirma, Esc descarta.');
  }

  /** A Cor 2 ou a opção de seleção transparente mudou: refaz o recorte da imagem flutuante. */
  atualizarRecorte() {
    const colagem = this.flutuante;
    if (!colagem) return;
    const { selecaoTransparente, color2 } = useEditor.getState();
    const cor = selecaoTransparente ? color2 : undefined;
    if (colagem.corTransparente === cor) return;
    colagem.corTransparente = cor;
    const { pixels } = colagem;
    colagem.recorte = prepararRecorte(
      pixels,
      { x: 0, y: 0, width: pixels.width, height: pixels.height },
      undefined,
      cor,
    );
    this.mostrar();
  }

  mostrar() {
    if (!this.flutuante) return;
    const { destino, recorte } = this.flutuante;
    const { zoom } = useEditor.getState();
    if (recorte.imagem.parentElement !== this.camada) this.camada.replaceChildren(recorte.imagem);
    Object.assign(recorte.imagem.style, {
      left: `${destino.x * zoom}px`,
      top: `${destino.y * zoom}px`,
      width: `${destino.width * zoom}px`,
      height: `${destino.height * zoom}px`,
    });
    this.workspace.setAttribute('data-colagem-pendente', '');
  }

  reposicionar(destino: Rect) {
    if (!this.flutuante) return;
    this.flutuante.destino = destino;
    this.mostrar();
    this.selecao.selecionar(destino);
  }

  confirmar() {
    const colagem = this.flutuante;
    if (!colagem) return;
    const { pixels, destino, papel, corTransparente, nomeCamada, recorte } = colagem;
    this.limpar();
    if (nomeCamada && !papel) {
      // Já com a Cor 2 transparente (se pedido) e no tamanho em que foi posicionada.
      const { width, height } = recorte.imagem;
      const base = recorte.imagem.getContext('2d')!.getImageData(0, 0, width, height);
      const ajustada =
        destino.width === width && destino.height === height
          ? base
          : redimensionarEInclinar(base, destino.width, destino.height, 0, 0);
      this.nucleo.executar({
        tipo: 'NovaCamada',
        id: novoId('camada'),
        nome: nomeCamada,
        imagem: serializarImagem(ajustada),
        x: destino.x,
        y: destino.y,
      });
      this.selecao.selecionar(limitarArea(destino, this.nucleo.doc));
      return;
    }
    const mudou = this.nucleo.executar({
      tipo: 'ColarImagem',
      x: destino.x,
      y: destino.y,
      imagem: serializarImagem(pixels),
      tamanho: { largura: destino.width, altura: destino.height },
      papel,
      corTransparente,
    });
    if (mudou && papel) this.nucleo.fit();
    this.selecao.selecionar(limitarArea(destino, this.nucleo.doc));
  }

  /** Descarta a imagem flutuante. Devolve true se havia uma. */
  descartar(): boolean {
    if (!this.flutuante) return false;
    this.limpar();
    this.selecao.selecionar(null);
    return true;
  }

  limpar() {
    this.flutuante = null;
    this.camada.replaceChildren();
    this.workspace.removeAttribute('data-colagem-pendente');
  }

  /** Silhueta da imagem flutuante, para virar forma própria. */
  referencia() {
    if (!this.flutuante) return null;
    const { pixels } = this.flutuante;
    return referenciaDaSelecao(pixels, { x: 0, y: 0, width: pixels.width, height: pixels.height });
  }
}
