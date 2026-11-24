import { useEditor } from '../app/store';
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
import { exportPng, openPng } from '../io/png';
import type { Point, Rect, ToolId } from '../layers/types';
import { loadDocument, saveDocument } from '../storage/documents';
import type { EstiloTraco, EventoFerramenta, Tool, ToolCtx } from '../tools/tool';
import { criarFerramentas } from '../tools/toolRegistry';
import type { DocumentInfo, EditorApi } from './editorTypes';

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
  private gesto: { ponteiro: number; ferramenta: Tool } | null = null;
  private areaPrevia: Rect | null = null;
  private selecao: Rect | null = null;
  private copiado: ImageData | null = null;
  private pronto = false;
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
  }

  ajustarAoRedimensionar() {
    if (this.pronto && !this.gesto) this.fit();
  }

  fit() {
    const { width, height } = this.workspace.getBoundingClientRect();
    const zoom = Math.max(
      0.1,
      Math.min(1, (width - 100) / this.doc.width, (height - 90) / this.doc.height),
    );
    useEditor.getState().set({ zoom });
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
    return true;
  }

  moverGesto(ponteiro: number, evento: EventoFerramenta) {
    if (this.gesto?.ponteiro !== ponteiro) return;
    const { ferramenta } = this.gesto;
    const contexto = this.contexto();
    ferramenta.onPointerMove(contexto, evento);
    if (ferramenta.overlay) {
      this.limparOverlay();
      ferramenta.overlay(contexto, this.overlay);
    }
  }

  terminarGesto(ponteiro: number, evento: EventoFerramenta, cancelar: boolean) {
    if (this.gesto?.ponteiro !== ponteiro) return;
    const { ferramenta } = this.gesto;
    this.gesto = null;
    this.limparOverlay();
    if (cancelar) ferramenta.onCancel?.(this.contexto());
    else ferramenta.onPointerUp(this.contexto(), evento);
    this.limparPrevia();
  }

  tecla(evento: KeyboardEvent) {
    const ferramenta = this.gesto?.ferramenta ?? this.ferramentas[useEditor.getState().tool];
    return ferramenta.onKeyDown?.(this.contexto(), evento) ?? false;
  }

  undo() {
    if (this.disponivel() && this.comandos.desfazer()) this.restaurarSelecao();
  }

  redo() {
    if (this.disponivel() && this.comandos.refazer()) this.restaurarSelecao();
  }

  async save() {
    if (!this.pronto) return;
    // Uma prévia de gesto pertence à tela, não ao documento salvo.
    const tela = this.areaPrevia ? document.createElement('canvas') : this.tela;
    if (tela !== this.tela) comporDocumento(this.doc, tela);
    await exportPng(tela, this.doc.name, this.doc.dpi);
    this.eventos.avisar('PNG exportado. Seu rabisco está pronto para levar.');
  }

  async open(arquivo: File) {
    const imagem = await openPng(arquivo);
    if (!this.disponivel()) return;
    const { name, width, height, pixels, dpi } = imagem;
    this.selecao = null;
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
    this.selecao = null;
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
    this.executar({ tipo: 'RedimensionarPapel', largura, altura, fundo, dpi }, () => {
      if (this.selecao) this.selecao = limitarArea(this.selecao, this.doc);
    });
  }

  transformarImagem(opcoes: OpcoesTransformacao) {
    if (!this.disponivel()) return;
    this.executarTransformacao({
      tipo: 'RedimensionarInclinar',
      ...opcoes,
      area: this.selecao ?? undefined,
    });
  }

  girarImagem(orientacao: OrientacaoImagem) {
    if (!this.disponivel()) return;
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

  deleteSelection() {
    if (!this.disponivel() || !this.selecao) return;
    const area = this.selecao;
    this.selecao = null;
    this.executar({ tipo: 'ApagarSelecao', area });
    this.notificar();
  }

  crop() {
    if (!this.disponivel() || !this.selecao) return;
    const area = this.selecao;
    this.selecao = null;
    this.executar({ tipo: 'CortarPapel', area });
    this.fit();
    this.notificar();
  }

  async copy(recortar = false) {
    if (!this.disponivel()) return;
    if (!this.selecao) {
      this.eventos.avisar('Selecione uma parte do desenho primeiro.');
      return;
    }
    this.copiado = this.doc.lerPixels(this.selecao);
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
    this.selecao = {
      x,
      y,
      width: Math.min(this.copiado.width, this.doc.width - x),
      height: Math.min(this.copiado.height, this.doc.height - y),
    };
    useEditor.getState().setTool('select');
    this.executar({ tipo: 'ColarImagem', x, y, imagem: serializarImagem(this.copiado) });
    this.notificar();
  }

  private disponivel() {
    return this.ativo && this.pronto && !this.gesto;
  }

  private contexto(): ToolCtx {
    const { color1, color2, size, filled } = useEditor.getState();
    return {
      largura: this.doc.width,
      altura: this.doc.height,
      opcoes: { cor1: color1, cor2: color2, espessura: size, preenchida: filled },
      selecao: this.selecao,
      executar: (comando) => this.executar(comando),
      selecionar: (area) => this.selecionar(area),
      capturarCor: (ponto) => this.capturarCor(ponto),
      lerPixels: (area) => this.doc.lerPixels(area),
      previsualizarTraco: (de, ate, estilo) => this.previsualizarTraco(de, ate, estilo),
      previsualizarSelecao: (origem, destino, imagem) =>
        this.previsualizarSelecao(origem, destino, imagem),
      limparPrevia: () => this.limparPrevia(),
    };
  }

  private capturarCor(ponto: Point) {
    const pixel = this.doc.lerPixels({
      x: Math.floor(ponto.x),
      y: Math.floor(ponto.y),
      width: 1,
      height: 1,
    });
    const hex = Array.from(pixel.data.subarray(0, 3), (valor) =>
      valor.toString(16).padStart(2, '0'),
    );
    useEditor.getState().setColor(`#${hex.join('')}`);
  }

  private selecionar(area: Rect | null) {
    const proxima = area && area.width > 0 && area.height > 0 ? area : null;
    if (this.selecao === proxima) return;
    this.selecao = proxima;
    this.notificar();
  }

  private previsualizarTraco(de: Point, ate: Point, estilo: EstiloTraco) {
    desenharSegmento(this.grafico, de, ate, estilo);
    const area = areaDoSegmento(de, ate, estilo);
    this.areaPrevia = this.areaPrevia ? unirAreas(this.areaPrevia, area) : area;
  }

  private previsualizarSelecao(origem: Rect, destino: Rect, imagem: ImageData) {
    this.limparPrevia();
    this.grafico.clearRect(origem.x, origem.y, origem.width, origem.height);
    this.grafico.putImageData(imagem, destino.x, destino.y);
    this.areaPrevia = unirAreas(origem, destino);
  }

  private limparPrevia() {
    if (!this.areaPrevia) return;
    this.compor(this.areaPrevia);
    this.areaPrevia = null;
  }

  private limparOverlay() {
    const { width, height } = this.overlay.canvas;
    this.overlay.clearRect(0, 0, width, height);
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
    aposExecutar?.();
    this.edicaoAplicada();
    return true;
  }

  private restaurarSelecao() {
    this.selecao = null;
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
