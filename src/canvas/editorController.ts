import { useEditor } from '../app/store';
import type { ConfiguracaoPincel, MarcaPincel } from '../brushes/catalogo';
import {
  criarPintorPincel,
  margemDoPincel,
  mesclagemDoPincel,
  opacidadeDoPincel,
} from '../brushes/motor';
import {
  serializarImagem,
  type Comando,
  type OpcoesTransformacao,
  type OrientacaoImagem,
} from '../commands/comandos';
import { areaDoSegmento, desenharSegmento, limitarArea, unirAreas } from '../commands/desenho';
import { Executador } from '../commands/executador';
import { comporDocumento } from '../document/compositor';
import { DPI_PADRAO } from '../document/dimensoes';
import { RabiscoDocument } from '../document/model';
import {
  contornoRetangular,
  pintarRecorte,
  prepararRecorte,
  type MascaraSelecao,
  type RecorteFlutuante,
} from '../document/selecao';
import { exportPng, openPng } from '../io/png';
import type { Point, Rect, ToolId } from '../layers/types';
import { referenciaDaForma, referenciaDaSelecao } from '../shapes/referencia';
import type { ConfiguracaoForma } from '../shapes/tipos';
import { loadDocument, saveDocument } from '../storage/documents';
import type { EstiloTraco, EventoFerramenta, Tool, ToolCtx } from '../tools/tool';
import { aplicarBorrachaDeCor } from '../tools/pixels';
import type { ConfiguracaoTexto } from '../tools/texto';
import { criarFerramentas } from '../tools/toolRegistry';
import type { DocumentInfo, EditorApi } from './editorTypes';
import { ZOOM_MIN } from './zoom';

interface EventosEditor {
  mudar(info: DocumentInfo): void;
  avisar(mensagem: string): void;
}

/** Documento, comandos e estado dos gestos pertencem a uma instância do editor. */
export class EditorController implements EditorApi {
  private readonly doc = new RabiscoDocument();
  private readonly comandos = new Executador(this.doc);
  private readonly ferramentas = criarFerramentas();
  private readonly grafico: CanvasRenderingContext2D;
  private readonly overlay: CanvasRenderingContext2D;
  private readonly desconectarOpcoes: () => void;
  private gesto: { ponteiro: number; ferramenta: Tool } | null = null;
  private areaPrevia: Rect | null = null;
  private areaOverlay: Rect | null = null;
  private previaPincel: {
    pintor: ReturnType<typeof criarPintorPincel>;
    margem: number;
    area: Rect | null;
  } | null = null;
  private selecao: Rect | null = null;
  private mascaraSelecao?: MascaraSelecao;
  private timerMarquise = 0;
  private ultimaForma: ConfiguracaoForma | null = null;
  private copiado: ImageData | null = null;
  private pronto = false;
  private acompanharAjuste = true;
  private ajustandoZoom = false;
  private ativo = true;
  private revisao = 0;
  private gravando = false;
  private salvamento: DocumentInfo['saving'] = 'loading';

  constructor(
    private readonly tela: HTMLCanvasElement,
    previa: HTMLCanvasElement,
    private readonly workspace: HTMLDivElement,
    private readonly eventos: EventosEditor,
  ) {
    this.grafico = tela.getContext('2d', { willReadFrequently: true })!;
    this.overlay = previa.getContext('2d')!;
    this.desconectarOpcoes = useEditor.subscribe((atual, anterior) => {
      if (atual.zoom !== anterior.zoom && !this.ajustandoZoom) this.acompanharAjuste = false;
      if (!this.pronto) return;
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
    });
  }

  async iniciar() {
    this.compor();
    this.fit();
    try {
      const salvo = await loadDocument();
      if (!this.ativo) return;
      if (salvo) {
        this.doc.substituir(salvo.name, {
          width: salvo.width,
          height: salvo.height,
          data: salvo.pixels,
        });
        this.doc.dpi = salvo.dpi ?? DPI_PADRAO;
        this.compor();
        this.fit();
        this.eventos.avisar('Seu último rabisco foi recuperado. Continue de onde parou.');
      }
      this.salvamento = 'saved';
    } catch {
      if (!this.ativo) return;
      this.salvamento = 'error';
      this.eventos.avisar('O autosave não está disponível. Salve seu trabalho em PNG.');
    }
    this.pronto = true;
    this.notificar();
  }

  encerrar() {
    this.ativo = false;
    this.desconectarOpcoes();
    this.cancelarGesto();
    window.clearTimeout(this.timerMarquise);
    this.workspace.removeAttribute('data-forma-pendente');
  }

  ajustarAoRedimensionar() {
    if (this.pronto && !this.gesto && this.acompanharAjuste) this.fit();
  }

  fit() {
    const { width, height } = this.workspace.getBoundingClientRect();
    const zoom = Math.max(
      ZOOM_MIN,
      Math.min(1, (width - 100) / this.doc.width, (height - 90) / this.doc.height),
    );
    this.acompanharAjuste = true;
    this.ajustandoZoom = true;
    try {
      useEditor.getState().set({ zoom });
    } finally {
      this.ajustandoZoom = false;
    }
  }

  cursor(id: ToolId) {
    return this.ferramentas[id].cursor(this.contexto());
  }

  iniciarGesto(ponteiro: number, evento: EventoFerramenta, atalhoContaGotas: boolean) {
    if (!this.pronto || this.gesto || (evento.botao !== 0 && evento.botao !== 2)) return false;
    const id = atalhoContaGotas ? 'eyedropper' : useEditor.getState().tool;
    const ferramenta = this.ferramentas[id];
    this.gesto = { ponteiro, ferramenta };
    ferramenta.onPointerDown(this.contexto(), evento);
    if (ferramenta.overlay) this.redesenharOverlay(ferramenta);
    return true;
  }

  moverGesto(ponteiro: number, evento: EventoFerramenta) {
    if (!this.gesto) {
      const ferramenta = this.ferramentas[useEditor.getState().tool];
      if (ferramenta.onHover?.(this.contexto(), evento)) this.redesenharOverlay(ferramenta);
      return;
    }
    if (this.gesto?.ponteiro !== ponteiro) return;
    const { ferramenta } = this.gesto;
    const contexto = this.contexto();
    ferramenta.onPointerMove(contexto, evento);
    if (ferramenta.overlay) this.redesenharOverlay(ferramenta);
  }

  sairDoPonteiro() {
    const ferramenta = this.gesto?.ferramenta ?? this.ferramentas[useEditor.getState().tool];
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
      this.limparPrevia();
      if (ferramenta.overlay) this.redesenharOverlay(ferramenta);
    }
  }

  cancelarGesto() {
    if (!this.gesto) return;
    const { ponteiro } = this.gesto;
    this.terminarGesto(ponteiro);
    if (this.tela.hasPointerCapture(ponteiro)) this.tela.releasePointerCapture(ponteiro);
  }

  tecla(evento: KeyboardEvent) {
    if (
      evento.key === 'Escape' &&
      (this.gesto?.ferramenta.id === 'brush' || this.gesto?.ferramenta.overlay)
    ) {
      this.cancelarGesto();
      this.descartarFormaPendente();
      return true;
    }
    const ferramenta = this.gesto?.ferramenta ?? this.ferramentas[useEditor.getState().tool];
    if (!ferramenta.onKeyDown?.(this.contexto(), evento)) return false;
    this.redesenharOverlay(ferramenta);
    return true;
  }

  undo() {
    if (!this.disponivel() || this.descartarFormaPendente()) return;
    if (this.comandos.desfazer()) this.restaurarSelecao();
  }

  redo() {
    if (!this.disponivel() || this.descartarFormaPendente()) return;
    if (this.comandos.refazer()) this.restaurarSelecao();
  }

  async save() {
    if (!this.pronto) return;
    this.confirmarFormaPendente();
    // Uma prévia de gesto pertence à tela, não ao documento salvo.
    const tela = this.areaPrevia ? document.createElement('canvas') : this.tela;
    if (tela !== this.tela) comporDocumento(this.doc, tela);
    await exportPng(tela, this.doc.name, this.doc.dpi);
    this.eventos.avisar('PNG exportado. Seu rabisco está pronto para levar.');
  }

  async open(arquivo: File) {
    const imagem = await openPng(arquivo);
    if (!this.disponivel()) return;
    this.confirmarFormaPendente();
    const { name, width, height, pixels, dpi } = imagem;
    this.selecao = null;
    this.mascaraSelecao = undefined;
    this.executar({
      tipo: 'AbrirImagem',
      nome: name,
      dpi,
      imagem: serializarImagem({ width, height, data: pixels }),
    });
    this.fit();
    this.notificar();
  }

  newDocument(nome: string, largura: number, altura: number) {
    if (!this.disponivel()) return;
    this.descartarFormaPendente();
    this.selecao = null;
    this.mascaraSelecao = undefined;
    this.executar({ tipo: 'NovoDocumento', nome: nome.trim() || 'Sem título', largura, altura });
    this.fit();
  }

  redimensionarPapel(
    largura: number,
    altura: number,
    fundo = useEditor.getState().color2,
    dpi?: number,
  ) {
    if (!this.disponivel()) return;
    this.confirmarFormaPendente();
    this.executar({ tipo: 'RedimensionarPapel', largura, altura, fundo, dpi }, () => {
      if (this.selecao) this.selecao = limitarArea(this.selecao, this.doc);
    });
  }

  transformarImagem(opcoes: OpcoesTransformacao) {
    if (!this.disponivel()) return;
    this.confirmarFormaPendente();
    this.executarTransformacao({
      tipo: 'RedimensionarInclinar',
      ...opcoes,
      area: this.selecao ?? undefined,
    });
  }

  girarImagem(orientacao: OrientacaoImagem) {
    if (!this.disponivel()) return;
    this.confirmarFormaPendente();
    const area = this.selecao ?? undefined;
    if (orientacao === 'horizontal' || orientacao === 'vertical') {
      this.executarTransformacao({ tipo: 'Inverter', eixo: orientacao, area });
    } else {
      const graus = { direita: 90, esquerda: -90, '180': 180 } as const;
      this.executarTransformacao({ tipo: 'Girar', graus: graus[orientacao], area });
    }
  }

  private executarTransformacao(
    comando: Extract<Comando, { tipo: 'RedimensionarInclinar' | 'Girar' | 'Inverter' }>,
  ) {
    const mudou = this.executar(comando, () => {
      this.selecao = this.comandos.ultimaSelecaoTransformada;
      this.mascaraSelecao = undefined;
    });
    if (!mudou && this.comandos.ultimaSelecaoTransformada) {
      this.selecionar(this.comandos.ultimaSelecaoTransformada);
    }
  }

  selectAll() {
    if (!this.disponivel()) return;
    useEditor.getState().setTool('select');
    this.selecionar({ x: 0, y: 0, width: this.doc.width, height: this.doc.height });
  }

  inverterSelecao() {
    if (!this.disponivel()) return;
    if (!this.selecao) {
      this.selectAll();
      return;
    }
    const papel = { x: 0, y: 0, width: this.doc.width, height: this.doc.height };
    if (
      !this.mascaraSelecao &&
      this.selecao.width === papel.width &&
      this.selecao.height === papel.height
    ) {
      this.selecionar(null);
      return;
    }
    const contorno = this.mascaraSelecao?.contorno ?? contornoRetangular(this.selecao);
    const inversa = !this.mascaraSelecao?.inversa;
    const area = inversa
      ? papel
      : limitarArea(
          {
            x: Math.min(...contorno.map(({ x }) => x)),
            y: Math.min(...contorno.map(({ y }) => y)),
            width:
              Math.max(...contorno.map(({ x }) => x)) - Math.min(...contorno.map(({ x }) => x)),
            height:
              Math.max(...contorno.map(({ y }) => y)) - Math.min(...contorno.map(({ y }) => y)),
          },
          papel,
        );
    useEditor.getState().setTool('select');
    this.selecionar(area, { contorno, inversa });
  }

  aplicarTexto(configuracao: ConfiguracaoTexto) {
    if (!this.disponivel()) return;
    this.selecionar(null);
    this.executar({ tipo: 'AplicarTexto', configuracao });
  }

  deleteSelection() {
    if (!this.disponivel() || !this.selecao) return;
    const area = this.selecao;
    const mascara = this.mascaraSelecao;
    this.selecionar(null);
    this.executar({ tipo: 'ApagarSelecao', area, mascara });
    this.notificar();
  }

  crop() {
    if (!this.disponivel() || !this.selecao) return;
    const area = this.selecao;
    const mascara = this.mascaraSelecao;
    this.selecionar(null);
    this.executar({ tipo: 'CortarPapel', area, mascara });
    this.fit();
    this.notificar();
  }

  async copy(recortar = false) {
    if (!this.disponivel()) return;
    if (!this.selecao) {
      this.eventos.avisar('Selecione uma parte do desenho primeiro.');
      return;
    }
    const { selecaoTransparente, color2 } = useEditor.getState();
    const area = this.selecao;
    this.copiado = prepararRecorte(
      this.doc.obterDados(),
      area,
      this.mascaraSelecao,
      selecaoTransparente ? color2 : undefined,
    )
      .imagem.getContext('2d')!
      .getImageData(0, 0, area.width, area.height);
    if (recortar) this.deleteSelection();
    this.eventos.avisar(
      recortar
        ? 'Seleção recortada. Use Colar para reposicionar.'
        : 'Seleção copiada. Use Colar neste desenho.',
    );
  }

  async paste() {
    if (!this.disponivel()) return;
    if (!this.copiado) {
      this.eventos.avisar('Copie uma seleção primeiro, ou abra um arquivo PNG.');
      return;
    }
    const x = Math.min(24, this.doc.width - 1);
    const y = Math.min(24, this.doc.height - 1);
    const selecao = {
      x,
      y,
      width: Math.min(this.copiado.width, this.doc.width - x),
      height: Math.min(this.copiado.height, this.doc.height - y),
    };
    useEditor.getState().setTool('select');
    this.selecionar(selecao);
    const { selecaoTransparente, color2 } = useEditor.getState();
    this.executar({
      tipo: 'ColarImagem',
      x,
      y,
      imagem: serializarImagem(this.copiado),
      corTransparente: selecaoTransparente ? color2 : undefined,
    });
    this.notificar();
  }

  private disponivel() {
    return this.ativo && this.pronto && !this.gesto;
  }

  obterReferenciaForma(): ReturnType<EditorApi['obterReferenciaForma']> {
    const estado = useEditor.getState();
    const ativa = this.ferramentas[estado.tool].obterFormaPendente?.(this.contexto(estado));
    if (ativa) return referenciaDaForma(ativa);
    if (this.selecao) {
      const referencia = referenciaDaSelecao(this.doc.obterDados(), this.selecao);
      if (referencia) return referencia;
    }
    return this.ultimaForma ? referenciaDaForma(this.ultimaForma) : null;
  }

  private contexto(estado = useEditor.getState()): ToolCtx {
    const {
      color1,
      color2,
      size,
      espessuraBorracha,
      toleranciaBorracha,
      toleranciaBalde,
      preenchimentoGlobal,
      pincel,
      densidadeSpray,
      forma,
      formaPropria,
      contornoForma,
      preenchimentoForma,
      parametrosForma,
      selecaoTransparente,
      zoom,
    } = estado;
    return {
      largura: this.doc.width,
      altura: this.doc.height,
      opcoes: {
        cor1: color1,
        cor2: color2,
        espessura: size,
        espessuraBorracha,
        toleranciaBorracha,
        toleranciaBalde,
        preenchimentoGlobal,
        pincel,
        densidadeSpray,
        forma: formaPropria ? `propria:${formaPropria.id}` : forma,
        definicaoForma: formaPropria
          ? { nome: formaPropria.nome, path: formaPropria.path, fechada: formaPropria.fechada }
          : undefined,
        contornoForma,
        preenchimentoForma,
        parametrosForma,
        selecaoTransparente,
        zoom,
      },
      selecao: this.selecao,
      mascaraSelecao: this.mascaraSelecao,
      executar: (comando) => this.executar(comando),
      selecionar: (area, mascara) => this.selecionar(area, mascara),
      capturarCor: (ponto, alvo) => this.capturarCor(ponto, alvo),
      lerPixels: (area) => this.doc.lerPixels(area),
      previsualizarTraco: (de, ate, estilo) => this.previsualizarTraco(de, ate, estilo),
      iniciarPreviaPincel: (configuracao) => this.iniciarPreviaPincel(configuracao),
      previsualizarMarcasPincel: (marcas) => this.previsualizarMarcasPincel(marcas),
      prepararRecorte: (area, mascara, transparente) =>
        prepararRecorte(this.doc.obterDados(), area, mascara, transparente),
      previsualizarSelecao: (origem, destino, recorte) =>
        this.previsualizarSelecao(origem, destino, recorte),
      limparPrevia: () => this.limparPrevia(),
    };
  }

  private capturarCor(ponto: Point, alvo?: 1 | 2) {
    const pixel = this.doc.lerPixels({
      x: Math.floor(ponto.x),
      y: Math.floor(ponto.y),
      width: 1,
      height: 1,
    });
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

  private selecionar(area: Rect | null, mascara?: MascaraSelecao) {
    const proxima = area && area.width > 0 && area.height > 0 ? area : null;
    if (this.selecao === proxima && this.mascaraSelecao === mascara) return;
    this.selecao = proxima;
    this.mascaraSelecao = proxima ? mascara : undefined;
    this.atualizarMarquise();
    this.notificar();
  }

  private atualizarMarquise() {
    const { tool } = useEditor.getState();
    if (tool === 'select' || tool === 'lasso') this.redesenharOverlay(this.ferramentas[tool]);
    if (!this.ativo || !this.selecao || this.timerMarquise) return;
    this.timerMarquise = window.setTimeout(() => {
      this.timerMarquise = 0;
      if (this.selecao) this.atualizarMarquise();
    }, 90);
  }

  private previsualizarTraco(de: Point, ate: Point, estilo: EstiloTraco) {
    const area = limitarArea(areaDoSegmento(de, ate, estilo), this.doc);
    if (!area) return;
    if (estilo.substituirCor) {
      const imagem = this.grafico.getImageData(area.x, area.y, area.width, area.height);
      aplicarBorrachaDeCor(imagem, area, [de, ate], estilo);
      this.grafico.putImageData(imagem, area.x, area.y);
    } else desenharSegmento(this.grafico, de, ate, estilo);
    this.areaPrevia = this.areaPrevia ? unirAreas(this.areaPrevia, area) : area;
  }

  private iniciarPreviaPincel(configuracao: ConfiguracaoPincel) {
    this.previaPincel = {
      pintor: criarPintorPincel(this.overlay, configuracao),
      margem: margemDoPincel(configuracao),
      area: null,
    };
    // O marcador mistura a tinta uma vez por gesto, mesmo onde os carimbos se cruzam.
    const style = this.overlay.canvas.style;
    style.opacity = String(opacidadeDoPincel(configuracao.tipo));
    if (mesclagemDoPincel(configuracao.tipo) === 'multiply') style.mixBlendMode = 'multiply';
  }

  private previsualizarMarcasPincel(marcas: readonly MarcaPincel[]) {
    const previa = this.previaPincel;
    if (!previa || marcas.length === 0) return;
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
    previa.pintor.pintar(marcas);
  }

  private previsualizarSelecao(origem: Rect | null, destino: Rect, recorte: RecorteFlutuante) {
    this.limparPrevia();
    pintarRecorte(this.grafico, recorte, origem, destino);
    this.areaPrevia = origem ? unirAreas(origem, destino) : destino;
  }

  private limparPrevia() {
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

  private redesenharOverlay(ferramenta: Tool) {
    if (this.areaOverlay) {
      const { x, y, width, height } = this.areaOverlay;
      this.overlay.clearRect(x, y, width, height);
      this.areaOverlay = null;
    }
    this.workspace.toggleAttribute('data-forma-pendente', ferramenta.temPendente?.() ?? false);
    if (!ferramenta.overlay) return;

    const contexto = this.contexto();
    const limites = ferramenta.limitesOverlay
      ? ferramenta.limitesOverlay(contexto)
      : { x: 0, y: 0, width: this.doc.width, height: this.doc.height };
    this.areaOverlay = limites && limitarArea(limites, this.doc);
    if (this.areaOverlay) ferramenta.overlay(contexto, this.overlay);
  }

  private confirmarFormaPendente() {
    if (this.gesto) return;
    const ferramenta = this.ferramentas[useEditor.getState().tool];
    if (!ferramenta.temPendente?.()) return;
    ferramenta.commitPendente?.(this.contexto());
    this.redesenharOverlay(ferramenta);
  }

  private descartarFormaPendente() {
    const ferramenta = this.ferramentas[useEditor.getState().tool];
    if (!ferramenta.temPendente?.()) return false;
    ferramenta.descartarPendente?.();
    this.redesenharOverlay(ferramenta);
    return true;
  }

  private compor(area?: Rect) {
    comporDocumento(this.doc, this.tela, area);
    if (
      this.overlay.canvas.width !== this.doc.width ||
      this.overlay.canvas.height !== this.doc.height
    ) {
      this.overlay.canvas.width = this.doc.width;
      this.overlay.canvas.height = this.doc.height;
    }
  }

  private executar(comando: Comando, aposExecutar?: () => void) {
    // As prévias não entram no histórico. O comando rasteriza uma única vez na camada.
    this.limparPrevia();
    if (!this.comandos.executar(comando)) return false;
    if (comando.tipo === 'AplicarForma') this.ultimaForma = comando.configuracao;
    if (comando.tipo === 'NovoDocumento' || comando.tipo === 'AbrirImagem') this.ultimaForma = null;
    aposExecutar?.();
    this.edicaoAplicada();
    return true;
  }

  private restaurarSelecao() {
    this.selecionar(null);
    this.edicaoAplicada();
  }

  private edicaoAplicada() {
    this.compor(this.comandos.ultimaAlteracao ?? undefined);
    this.revisao++;
    this.salvamento = 'saving';
    this.notificar();
    if (!this.gravando) void this.persistir();
  }

  private async persistir() {
    this.gravando = true;
    // O IndexedDB copia o buffer antes de aguardar. Edições concorrentes ficam na próxima revisão.
    let revisao: number;
    do {
      revisao = this.revisao;
      const { width, height, data } = this.doc.obterDados();
      try {
        await saveDocument({
          id: 'current',
          name: this.doc.name,
          width,
          height,
          dpi: this.doc.dpi,
          pixels: data,
          updatedAt: Date.now(),
        });
        if (revisao === this.revisao) this.salvamento = 'saved';
      } catch (erro) {
        if (revisao === this.revisao) {
          this.salvamento = 'error';
          if (this.ativo)
            this.eventos.avisar(erro instanceof Error ? erro.message : 'Salve uma cópia em PNG.');
        }
      }
    } while (revisao !== this.revisao);
    this.gravando = false;
    this.notificar();
  }

  private notificar() {
    if (!this.ativo) return;
    const { name, width, height, dpi } = this.doc;
    const { canUndo, canRedo, entries } = this.comandos.historico;
    this.eventos.mudar({
      name,
      width,
      height,
      dpi,
      canUndo,
      canRedo,
      history: entries,
      selection: this.selecao,
      saving: this.salvamento,
    });
  }
}
