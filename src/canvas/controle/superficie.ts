import type { ConfiguracaoPincel, MarcaPincel } from '../../brushes/catalogo';
import {
  criarPintorPincel,
  margemDoPincel,
  mesclagemDoPincel,
  opacidadeDoPincel,
} from '../../brushes/motor';
import { areaDoSegmento, desenharSegmento, limitarArea, unirAreas } from '../../commands/desenho';
import { comporDocumento } from '../../document/compositor';
import type { RabiscoDocument } from '../../document/model';
import { pintarRecorte, type RecorteFlutuante } from '../../document/selecao';
import type { Point, Rect } from '../../layers/types';
import type { Transformacao } from '../../brushes/simetria';
import type { EstiloTraco, Tool, ToolCtx } from '../../tools/tool';
import { aplicarBorrachaDeCor } from '../../tools/pixels';

/**
 * A tela que a pessoa vê: composição das camadas, prévias de gesto (desenhadas direto na tela,
 * sem tocar no documento) e o overlay de alças, marquise e cursores das ferramentas.
 */
export class SuperficieTela {
  private readonly grafico: CanvasRenderingContext2D;
  private readonly overlay: CanvasRenderingContext2D;
  private areaPrevia: Rect | null = null;
  private areaOverlay: Rect | null = null;
  private previaPincel: {
    /** Um pintor por cópia simétrica (a original primeiro). */
    pintores: { pintor: ReturnType<typeof criarPintorPincel>; transformar: Transformacao }[];
    margem: number;
    area: Rect | null;
  } | null = null;

  constructor(
    private readonly doc: RabiscoDocument,
    readonly tela: HTMLCanvasElement,
    previa: HTMLCanvasElement,
    private readonly workspace: HTMLDivElement,
  ) {
    this.grafico = tela.getContext('2d', { willReadFrequently: true })!;
    this.overlay = previa.getContext('2d')!;
  }

  /** As camadas visíveis acima da ativa, por cima da prévia do traço (só durante o traço). */
  private acima: HTMLCanvasElement | null = null;

  /**
   * Começo de um traço: se há camadas visíveis acima da ativa, compõe só elas numa tela por
   * cima da prévia, para o traço aparecer na posição certa da pilha (atrás delas).
   */
  mostrarCamadasDeCima() {
    const { doc } = this;
    const indice = doc.layers.findIndex((camada) => camada.id === doc.activeLayerId);
    const deCima = doc.layers.slice(indice + 1);
    if (!deCima.some((camada) => camada.visible && camada.opacity > 0 && !camada.foraDaTela))
      return;
    const abaixo = doc.layers.slice(0, indice + 1).filter((camada) => !camada.foraDaTela);
    for (const camada of abaixo) camada.foraDaTela = true;
    try {
      if (!this.acima) {
        this.acima = document.createElement('canvas');
        this.acima.className = 'acima-canvas';
        this.acima.setAttribute('aria-hidden', 'true');
        this.overlay.canvas.after(this.acima);
      }
      comporDocumento(doc, this.acima);
      // Mesma nitidez da tela (pixels quadrados no zoom alto).
      this.acima.style.imageRendering = getComputedStyle(this.tela).imageRendering;
      this.acima.hidden = false;
    } finally {
      for (const camada of abaixo) delete camada.foraDaTela;
    }
  }

  private esconderCamadasDeCima() {
    if (this.acima && !this.acima.hidden) this.acima.hidden = true;
  }

  /** Há uma prévia de gesto pintada na tela que ainda não está no documento. */
  get temPrevia(): boolean {
    return this.areaPrevia !== null;
  }

  compor(area?: Rect) {
    comporDocumento(this.doc, this.tela, area);
    const { canvas } = this.overlay;
    if (canvas.width !== this.doc.width || canvas.height !== this.doc.height) {
      canvas.width = this.doc.width;
      canvas.height = this.doc.height;
    }
  }

  /** Uma imagem do documento sem prévias, para salvar ou imprimir. */
  telaParaSaida(): HTMLCanvasElement {
    if (!this.areaPrevia) return this.tela;
    const tela = document.createElement('canvas');
    comporDocumento(this.doc, tela);
    return tela;
  }

  traco(de: Point, ate: Point, estilo: EstiloTraco) {
    const area = limitarArea(areaDoSegmento(de, ate, estilo), this.doc);
    if (!area) return;
    if (estilo.substituirCor) {
      const imagem = this.grafico.getImageData(area.x, area.y, area.width, area.height);
      aplicarBorrachaDeCor(imagem, area, [de, ate], estilo);
      this.grafico.putImageData(imagem, area.x, area.y);
    } else desenharSegmento(this.grafico, de, ate, estilo);
    this.areaPrevia = this.areaPrevia ? unirAreas(this.areaPrevia, area) : area;
  }

  iniciarPincel(configuracao: ConfiguracaoPincel, copias: readonly Transformacao[] = [(p) => p]) {
    this.previaPincel = {
      pintores: copias.map((transformar) => ({
        pintor: criarPintorPincel(this.overlay, configuracao),
        transformar,
      })),
      margem: margemDoPincel(configuracao),
      area: null,
    };
    // O marcador mistura a tinta uma vez por gesto, mesmo onde os carimbos se cruzam.
    const style = this.overlay.canvas.style;
    style.opacity = String(opacidadeDoPincel(configuracao.tipo));
    if (mesclagemDoPincel(configuracao.tipo) === 'multiply') style.mixBlendMode = 'multiply';
  }

  marcasPincel(marcas: readonly MarcaPincel[]) {
    const previa = this.previaPincel;
    if (!previa || marcas.length === 0) return;
    previa.pintores.forEach(({ pintor, transformar }, i) =>
      this.pintarMarcas(
        pintor,
        i === 0 ? marcas : marcas.map((marca) => transformar(marca) as MarcaPincel),
      ),
    );
  }

  private pintarMarcas(
    pintor: ReturnType<typeof criarPintorPincel>,
    marcas: readonly MarcaPincel[],
  ) {
    const previa = this.previaPincel!;
    let esquerda = marcas[0].x;
    let topo = marcas[0].y;
    let direita = esquerda;
    let base = topo;
    for (const { x, y } of marcas) {
      esquerda = Math.min(esquerda, x);
      topo = Math.min(topo, y);
      direita = Math.max(direita, x);
      base = Math.max(base, y);
    }
    previa.area = unirAreas(previa.area, {
      x: esquerda - previa.margem,
      y: topo - previa.margem,
      width: direita - esquerda + 2 * previa.margem,
      height: base - topo + 2 * previa.margem,
    });
    pintor.pintar(marcas);
  }

  selecao(origem: Rect | null, destino: Rect, recorte: RecorteFlutuante) {
    this.limpar();
    pintarRecorte(this.grafico, recorte, origem, destino);
    this.areaPrevia = origem ? unirAreas(origem, destino) : destino;
  }

  /** Um leve "pulo" da prévia em torno do ponto (formas inteligentes). */
  pular(centro: Point, zoom: number) {
    const tela = this.overlay.canvas;
    tela.style.transformOrigin = `${centro.x * zoom}px ${centro.y * zoom}px`;
    tela.classList.remove('forma-pulou');
    void tela.offsetWidth;
    tela.classList.add('forma-pulou');
    tela.addEventListener('animationend', () => tela.classList.remove('forma-pulou'), {
      once: true,
    });
  }

  /** Apaga as prévias e recompõe só a área que elas ocupavam. */
  limpar() {
    this.esconderCamadasDeCima();
    if (this.previaPincel) {
      const area = this.previaPincel.area && limitarArea(this.previaPincel.area, this.doc);
      if (area) this.overlay.clearRect(area.x, area.y, area.width, area.height);
      this.overlay.canvas.style.removeProperty('opacity');
      this.overlay.canvas.style.removeProperty('mix-blend-mode');
      this.previaPincel = null;
    }
    if (!this.areaPrevia) return;
    this.compor(this.areaPrevia);
    this.areaPrevia = null;
  }

  redesenharOverlay(ferramenta: Tool, contexto: () => ToolCtx) {
    if (this.areaOverlay) {
      const { x, y, width, height } = this.areaOverlay;
      this.overlay.clearRect(x, y, width, height);
      this.areaOverlay = null;
    }
    this.workspace.toggleAttribute('data-forma-pendente', ferramenta.temPendente?.() ?? false);
    if (!ferramenta.overlay) return;

    const ctx = contexto();
    const limites = ferramenta.limitesOverlay
      ? ferramenta.limitesOverlay(ctx)
      : { x: 0, y: 0, width: this.doc.width, height: this.doc.height };
    this.areaOverlay = limites && limitarArea(limites, this.doc);
    if (this.areaOverlay) ferramenta.overlay(ctx, this.overlay);
  }
}
