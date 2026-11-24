import { useEditor } from '../../app/store';
import { prepararRecorteDaArea } from '../../document/selecao';
import type { Point, ToolId } from '../../layers/types';
import type { EventoFerramenta, Tool, ToolCtx } from '../../tools/tool';
import { criarFerramentas } from '../../tools/toolRegistry';
import type { ControleColagem } from './colagem';
import type { NucleoEditor } from './nucleo';
import { opcoesDaFerramenta } from './opcoes';
import type { ControleSelecao } from './selecao';
import type { SuperficieTela } from './superficie';

type EstadoEditor = ReturnType<typeof useEditor.getState>;

/**
 * As ferramentas e o gesto em andamento: repassa ponteiro e teclado para a ferramenta ativa,
 * monta o contexto que ela recebe e cuida das formas e textos que ainda esperam confirmação.
 */
export class ControleFerramentas {
  private readonly ferramentas = criarFerramentas();
  private gesto: { ponteiro: number; ferramenta: Tool } | null = null;

  constructor(
    private readonly nucleo: NucleoEditor,
    private readonly superficie: SuperficieTela,
    private readonly selecao: ControleSelecao,
    private readonly colagem: ControleColagem,
  ) {}

  get emGesto(): boolean {
    return this.gesto !== null;
  }

  get ativa(): Tool {
    return this.ferramentas[useEditor.getState().tool];
  }

  cursor(id: ToolId) {
    return this.ferramentas[id].cursor(this.contexto());
  }

  iniciarGesto(ponteiro: number, evento: EventoFerramenta, atalhoContaGotas: boolean) {
    if (this.gesto || (evento.botao !== 0 && evento.botao !== 2)) return false;
    const id = atalhoContaGotas ? 'eyedropper' : useEditor.getState().tool;
    const ferramenta = this.ferramentas[id];
    this.gesto = { ponteiro, ferramenta };
    ferramenta.onPointerDown(this.contexto(), evento);
    if (ferramenta.overlay) this.redesenharOverlay(ferramenta);
    return true;
  }

  moverGesto(ponteiro: number, evento: EventoFerramenta) {
    if (!this.gesto) {
      const ferramenta = this.ativa;
      if (ferramenta.onHover?.(this.contexto(), evento)) this.redesenharOverlay(ferramenta);
      return;
    }
    if (this.gesto.ponteiro !== ponteiro) return;
    const { ferramenta } = this.gesto;
    ferramenta.onPointerMove(this.contexto(), evento);
    if (ferramenta.overlay) this.redesenharOverlay(ferramenta);
  }

  sairDoPonteiro() {
    const ferramenta = this.gesto?.ferramenta ?? this.ativa;
    if (ferramenta.onPointerLeave?.(this.contexto())) this.redesenharOverlay(ferramenta);
  }

  terminarGesto(ponteiro: number, evento?: EventoFerramenta) {
    if (this.gesto?.ponteiro !== ponteiro) return;
    const { ferramenta } = this.gesto;
    this.gesto = null;
    try {
      if (evento) ferramenta.onPointerUp(this.contexto(), evento);
      else ferramenta.onCancel?.(this.contexto());
    } finally {
      this.superficie.limpar();
      if (ferramenta.overlay) this.redesenharOverlay(ferramenta);
    }
  }

  cancelarGesto() {
    if (!this.gesto) return;
    const { ponteiro } = this.gesto;
    this.terminarGesto(ponteiro);
    const { tela } = this.superficie;
    if (tela.hasPointerCapture(ponteiro)) tela.releasePointerCapture(ponteiro);
  }

  tecla(evento: KeyboardEvent) {
    if (
      evento.key === 'Escape' &&
      (this.gesto?.ferramenta.id === 'brush' || this.gesto?.ferramenta.overlay)
    ) {
      this.cancelarGesto();
      this.descartarPendente();
      return true;
    }
    if (this.colagem.ativa && (evento.key === 'Escape' || evento.key === 'Enter')) {
      if (evento.key === 'Escape') this.colagem.descartar();
      else this.colagem.confirmar();
      return true;
    }
    const ferramenta = this.gesto?.ferramenta ?? this.ativa;
    if (!ferramenta.onKeyDown?.(this.contexto(), evento)) return false;
    this.redesenharOverlay(ferramenta);
    return true;
  }

  /** Forma ou texto ainda editável da ferramenta ativa, para virar forma própria. */
  formaPendente() {
    const estado = useEditor.getState();
    return this.ferramentas[estado.tool].obterFormaPendente?.(this.contexto(estado)) ?? null;
  }

  /** Confirma a colagem flutuante e a forma ou texto ainda editável. */
  confirmarPendente() {
    if (this.gesto) return;
    this.colagem.confirmar();
    const ferramenta = this.ativa;
    if (!ferramenta.temPendente?.()) return;
    ferramenta.commitPendente?.(this.contexto());
    this.redesenharOverlay(ferramenta);
  }

  /** Descarta a forma ou texto ainda editável. Devolve true se havia um. */
  descartarPendente() {
    const ferramenta = this.ativa;
    if (!ferramenta.temPendente?.()) return false;
    ferramenta.descartarPendente?.();
    this.redesenharOverlay(ferramenta);
    return true;
  }

  redesenharAtiva() {
    this.redesenharOverlay(this.ativa);
  }

  encerrar() {
    this.cancelarGesto();
  }

  /** As opções da interface mudaram: troca de ferramenta ou atualiza a prévia da atual. */
  opcoesMudaram(atual: EstadoEditor, anterior: EstadoEditor) {
    const ferramentaAnterior = this.ferramentas[anterior.tool];
    const ferramenta = this.ferramentas[atual.tool];
    const trocouFerramenta = atual.tool !== anterior.tool;
    const trocouForma =
      atual.tool === 'shape' &&
      (atual.forma !== anterior.forma ||
        atual.formaPropria?.id !== anterior.formaPropria?.id ||
        atual.formaPropria?.path !== anterior.formaPropria?.path ||
        atual.formaPropria?.fechada !== anterior.formaPropria?.fechada);
    if (trocouFerramenta || trocouForma) {
      if (this.gesto) this.cancelarGesto();
      if (atual.tool !== 'select' && atual.tool !== 'lasso') this.colagem.confirmar();
      ferramentaAnterior.onPointerLeave?.(this.contexto(anterior));
      ferramentaAnterior.commitPendente?.(this.contexto(anterior));
      this.redesenharOverlay(ferramenta);
    } else if (
      ferramenta.overlay &&
      (atual.color1 !== anterior.color1 ||
        atual.color2 !== anterior.color2 ||
        atual.size !== anterior.size ||
        atual.espessuraBorracha !== anterior.espessuraBorracha ||
        atual.zoom !== anterior.zoom ||
        atual.contornoForma !== anterior.contornoForma ||
        atual.preenchimentoForma !== anterior.preenchimentoForma ||
        atual.parametrosForma !== anterior.parametrosForma)
    ) {
      this.redesenharOverlay(ferramenta);
    }
  }

  private redesenharOverlay(ferramenta: Tool) {
    this.superficie.redesenharOverlay(ferramenta, () => this.contexto());
  }

  private contexto(estado = useEditor.getState()): ToolCtx {
    const { nucleo, superficie, selecao, colagem } = this;
    const { doc } = nucleo;
    return {
      largura: doc.width,
      altura: doc.height,
      camadaAtiva: doc.activeLayerId,
      camadaParaTransformar: () => this.camadaParaTransformar(),
      ocultarCamadaAtiva: (ocultar) => {
        const camada = doc.activeLayer;
        if (Boolean(camada.foraDaTela) === ocultar) return;
        camada.foraDaTela = ocultar || undefined;
        if (!ocultar) delete camada.foraDaTela;
        superficie.compor();
      },
      opcoes: opcoesDaFerramenta(estado),
      selecao: selecao.area,
      mascaraSelecao: selecao.mascara,
      colagemFlutuante: colagem.ativa,
      executar: (comando) => nucleo.executar(comando),
      selecionar: (area, mascara) => selecao.selecionar(area, mascara),
      capturarCor: (ponto, alvo) => this.capturarCor(ponto, alvo),
      lerPixels: (area) => doc.lerPixels(area),
      previsualizarTraco: (de, ate, estilo) => superficie.traco(de, ate, estilo),
      iniciarPreviaPincel: (configuracao) => superficie.iniciarPincel(configuracao),
      previsualizarMarcasPincel: (marcas) => superficie.marcasPincel(marcas),
      prepararRecorte: (area, mascara, transparente) =>
        prepararRecorteDaArea(doc.lerPixels(area), area, mascara, transparente),
      reposicionarColagem: (destino) => colagem.reposicionar(destino),
      confirmarColagem: () => colagem.confirmar(),
      previsualizarSelecao: (origem, destino, recorte) =>
        superficie.selecao(origem, destino, recorte),
      limparPrevia: () => superficie.limpar(),
    };
  }

  /** Recorta os pixels não transparentes da camada ativa (com a máscara aplicada à prévia). */
  private camadaParaTransformar() {
    const { doc } = this.nucleo;
    const camada = doc.activeLayer;
    if (camada.locked || camada.bloqueioPosicao) {
      this.nucleo.avisar('Esta camada está bloqueada. Desbloqueie para transformar.');
      return null;
    }
    const { data, width, height } = doc.lerPixels(undefined, { camada: camada.id });
    let esquerda = width;
    let topo = height;
    let direita = -1;
    let base = -1;
    for (let y = 0; y < height; y++) {
      const linha = y * width * 4;
      for (let x = 0; x < width; x++) {
        if (!data[linha + x * 4 + 3]) continue;
        if (x < esquerda) esquerda = x;
        if (x > direita) direita = x;
        if (y < topo) topo = y;
        base = y;
      }
    }
    if (direita < 0) {
      this.nucleo.avisar('A camada está vazia: não há o que transformar.');
      return null;
    }
    const limites = {
      x: esquerda,
      y: topo,
      width: direita - esquerda + 1,
      height: base - topo + 1,
    };
    const conteudo = document.createElement('canvas');
    conteudo.width = limites.width;
    conteudo.height = limites.height;
    conteudo
      .getContext('2d')!
      .drawImage(
        camada.canvas,
        limites.x,
        limites.y,
        limites.width,
        limites.height,
        0,
        0,
        limites.width,
        limites.height,
      );
    return { conteudo, limites };
  }

  /** Conta-gotas: lê o pixel e, depois de usado, volta para a ferramenta anterior. */
  private capturarCor(ponto: Point, alvo?: 1 | 2) {
    const area = { x: Math.floor(ponto.x), y: Math.floor(ponto.y), width: 1, height: 1 };
    // "Amostrar todas as camadas": a cor que se vê na tela, já composta.
    const pixel = useEditor.getState().amostrarTudo
      ? this.superficie.tela
          .getContext('2d', { willReadFrequently: true })!
          .getImageData(area.x, area.y, 1, 1)
      : this.nucleo.doc.lerPixels(area);
    const hex = Array.from(pixel.data.subarray(0, 3), (valor) =>
      valor.toString(16).padStart(2, '0'),
    );
    const estado = useEditor.getState();
    estado.capturarCor(`#${hex.join('')}`, alvo ?? estado.colorTarget);
    if (estado.tool === 'eyedropper') {
      queueMicrotask(() => {
        const atual = useEditor.getState();
        if (atual.tool === 'eyedropper') atual.setTool(atual.ultimaFerramenta);
      });
    }
  }
}
