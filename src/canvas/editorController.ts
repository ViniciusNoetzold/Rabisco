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
import { DPI_PADRAO, validarDimensoes } from '../document/dimensoes';
import { RabiscoDocument } from '../document/model';
import {
  contornoRetangular,
  pintarRecorte,
  prepararRecorte,
  prepararRecorteDaArea,
  type MascaraSelecao,
  type RecorteFlutuante,
} from '../document/selecao';
import { exportPng } from '../io/png';
import { copiarImagemClipboard } from '../io/clipboard';
import type { OpcoesExportacao } from '../io/imagens';
import type { OpcoesImpressao } from '../io/imprimir';
import type { PixelBuffer, Point, Rect, ToolId } from '../layers/types';
import { referenciaDaForma, referenciaDaSelecao } from '../shapes/referencia';
import type { ConfiguracaoForma } from '../shapes/tipos';
import { AutosaveBlocos } from '../storage/autosave';
import { LADO_BLOCO, rgbaDaCor } from '../storage/blocos';
import { criarCodificadorPng } from '../storage/codificador';
import { validateSnapshot } from '../storage/documents';
import { apagarLegado, lerPapel, type BlocoSalvo } from '../storage/papel';
import type { EstiloTraco, EventoFerramenta, Tool, ToolCtx } from '../tools/tool';
import { aplicarBorrachaDeCor } from '../tools/pixels';
import type { ConfiguracaoTexto } from '../tools/texto';
import { criarFerramentas } from '../tools/toolRegistry';
import type { DocumentInfo, EditorApi } from './editorTypes';
import { ZOOM_MIN } from './zoom';
import { medicaoAtiva, medirOperacao, registrarGravacao } from './medicao';

interface EventosEditor {
  mudar(info: DocumentInfo): void;
  avisar(mensagem: string): void;
}

interface ColagemFlutuante {
  pixels: PixelBuffer;
  destino: Rect;
  recorte: RecorteFlutuante;
  corTransparente?: string;
  papel?: { largura: number; altura: number; fundo: string };
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
  private colagem: ColagemFlutuante | null = null;
  private pronto = false;
  private acompanharAjuste = true;
  private ajustandoZoom = false;
  private ativo = true;
  private readonly codificador = criarCodificadorPng();
  private readonly autosave: AutosaveBlocos;
  private readonly aoOcultar = () => {
    if (document.visibilityState === 'hidden') void this.autosave.gravarAgora();
  };
  private readonly aoSair = () => void this.autosave.gravarAgora();
  private salvamento: DocumentInfo['saving'] = 'loading';

  constructor(
    private readonly tela: HTMLCanvasElement,
    previa: HTMLCanvasElement,
    private readonly workspace: HTMLDivElement,
    private readonly camadaColagem: HTMLDivElement,
    private readonly eventos: EventosEditor,
  ) {
    this.grafico = tela.getContext('2d', { willReadFrequently: true })!;
    this.overlay = previa.getContext('2d')!;
    this.autosave = new AutosaveBlocos({
      fonte: {
        descrever: () => ({
          nome: this.doc.name,
          largura: this.doc.width,
          altura: this.doc.height,
          dpi: this.doc.dpi,
          camadas: this.doc.layers.map(({ id, name }) => ({ id, nome: name })),
        }),
        lerArea: (_camada, area) => this.doc.lerPixels(area),
      },
      codificar: this.codificador.codificar,
      aoMudar: (estado, erro) => {
        if (!this.ativo) return;
        this.salvamento = estado;
        this.notificar();
        if (erro) this.eventos.avisar(erro.message);
      },
      aoGravar: medicaoAtiva ? registrarGravacao : undefined,
    });
    document.addEventListener('visibilitychange', this.aoOcultar);
    window.addEventListener('pagehide', this.aoSair);
    this.desconectarOpcoes = useEditor.subscribe((atual, anterior) => {
      if (atual.zoom !== anterior.zoom && !this.ajustandoZoom) this.acompanharAjuste = false;
      if (!this.pronto) return;
      if (this.colagem) {
        if (
          atual.selecaoTransparente !== anterior.selecaoTransparente ||
          atual.color2 !== anterior.color2
        ) {
          this.definirRecorteDaColagem();
        } else if (atual.zoom !== anterior.zoom) {
          this.mostrarColagem();
        }
      }
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
        if (atual.tool !== 'select' && atual.tool !== 'lasso') this.confirmarColagem();
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
      const salvo = await lerPapel();
      if (!this.ativo) return;
      if (salvo?.tipo === 'blocos') {
        const { papel, blocos } = salvo;
        await this.restaurarBlocos(papel.nome, papel.largura, papel.altura, blocos);
        if (!this.ativo) return;
        this.doc.dpi = papel.dpi;
      } else if (salvo?.tipo === 'legado') {
        // Registro da 0.2 (pixels inteiros): converte em blocos e só então apaga o antigo.
        const { snapshot } = salvo;
        validateSnapshot(snapshot);
        this.doc.substituir(snapshot.name, {
          width: snapshot.width,
          height: snapshot.height,
          data: snapshot.pixels,
        });
        this.doc.dpi = snapshot.dpi ?? DPI_PADRAO;
        this.autosave.marcar(this.doc.activeLayerId, null);
        await this.autosave.gravarAgora();
        if (this.salvamento !== 'error') await apagarLegado();
      }
      if (salvo) {
        this.compor();
        this.fit();
        this.eventos.avisar('Seu último rabisco foi recuperado. Continue de onde parou.');
      }
      if (this.salvamento !== 'error') this.salvamento = 'saved';
    } catch {
      if (!this.ativo) return;
      this.salvamento = 'error';
      this.eventos.avisar('O autosave não está disponível. Salve seu trabalho em PNG.');
    }
    this.pronto = true;
    this.notificar();
  }

  /** Monta a camada a partir dos blocos salvos: cores lisas são pintadas, PNGs decodificados. */
  private async restaurarBlocos(
    nome: string,
    largura: number,
    altura: number,
    blocos: BlocoSalvo[],
  ) {
    const imagens = await Promise.all(
      blocos.map((bloco) => (bloco.png ? createImageBitmap(bloco.png) : null)),
    );
    if (!this.ativo) return;
    this.doc.preencherPapel(largura, altura, 'transparent');
    this.doc.name = nome;
    const contexto = this.doc.contextoAtivo();
    blocos.forEach((bloco, i) => {
      if (bloco.camada !== this.doc.activeLayerId) return;
      const x = bloco.bx * LADO_BLOCO;
      const y = bloco.by * LADO_BLOCO;
      const imagem = imagens[i];
      if (imagem) {
        contexto.drawImage(imagem, x, y);
        imagem.close();
      } else if (bloco.cor !== undefined) {
        const [r, g, b, a] = rgbaDaCor(bloco.cor);
        contexto.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        contexto.fillRect(x, y, LADO_BLOCO, LADO_BLOCO);
      }
    });
  }

  encerrar() {
    void this.autosave.gravarAgora().finally(() => this.codificador.encerrar());
    this.autosave.encerrar();
    document.removeEventListener('visibilitychange', this.aoOcultar);
    window.removeEventListener('pagehide', this.aoSair);
    this.ativo = false;
    this.desconectarOpcoes();
    this.cancelarGesto();
    window.clearTimeout(this.timerMarquise);
    this.workspace.removeAttribute('data-forma-pendente');
    this.limparColagem();
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
    if (this.colagem && (evento.key === 'Escape' || evento.key === 'Enter')) {
      if (evento.key === 'Escape') this.descartarColagem();
      else this.confirmarColagem();
      return true;
    }
    const ferramenta = this.gesto?.ferramenta ?? this.ferramentas[useEditor.getState().tool];
    if (!ferramenta.onKeyDown?.(this.contexto(), evento)) return false;
    this.redesenharOverlay(ferramenta);
    return true;
  }

  undo() {
    if (medicaoAtiva) medirOperacao('desfazer', () => this.mudarHistorico('desfazer'));
    else this.mudarHistorico('desfazer');
  }

  redo() {
    if (medicaoAtiva) medirOperacao('refazer', () => this.mudarHistorico('refazer'));
    else this.mudarHistorico('refazer');
  }

  private mudarHistorico(operacao: 'desfazer' | 'refazer') {
    if (!this.disponivel() || this.descartarColagem() || this.descartarFormaPendente()) return;
    const mudou = medicaoAtiva
      ? medirOperacao(`historico:${operacao}`, () => this.comandos[operacao]())
      : this.comandos[operacao]();
    if (mudou) this.restaurarSelecao();
  }

  async save() {
    if (!this.pronto) return;
    await exportPng(this.telaParaSaida(), this.doc.name, this.doc.dpi);
    this.eventos.avisar('PNG exportado. Seu rabisco está pronto para levar.');
  }

  async salvarComo({ nome, formato, qualidade }: OpcoesExportacao) {
    if (!this.pronto) return;
    const { exportarImagem, baixarImagem } = await import('../io/imagens');
    const blob = await exportarImagem(this.telaParaSaida(), formato, qualidade, this.doc.dpi);
    baixarImagem(blob, nome, formato);
    this.eventos.avisar(`${formato.toUpperCase()} exportado.`);
  }

  async imprimir(opcoes: OpcoesImpressao) {
    if (!this.pronto) return;
    const { imprimirImagem } = await import('../io/imprimir');
    await imprimirImagem(this.telaParaSaida(), this.doc.dpi, opcoes);
  }

  private telaParaSaida() {
    this.confirmarFormaPendente();
    // Uma prévia de gesto pertence à tela, não ao documento salvo.
    const tela = this.areaPrevia ? document.createElement('canvas') : this.tela;
    if (tela !== this.tela) comporDocumento(this.doc, tela);
    return tela;
  }

  async open(arquivo: File) {
    const { abrirImagem } = await import('../io/imagens');
    const imagem = await abrirImagem(arquivo);
    if (!this.disponivel()) return;
    this.descartarColagem();
    this.confirmarFormaPendente();
    const { name, width, height, pixels, dpi, formato } = imagem;
    this.selecao = null;
    this.mascaraSelecao = undefined;
    this.executar({
      tipo: 'AbrirImagem',
      nome: name,
      dpi,
      formato,
      imagem: serializarImagem({ width, height, data: pixels }),
    });
    this.fit();
    this.notificar();
  }

  newDocument(nome: string, largura: number, altura: number) {
    if (!this.disponivel()) return;
    this.descartarColagem();
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
    this.confirmarColagem();
    useEditor.getState().setTool('select');
    this.selecionar({ x: 0, y: 0, width: this.doc.width, height: this.doc.height });
  }

  inverterSelecao() {
    if (!this.disponivel()) return;
    this.confirmarColagem();
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
    if (this.descartarColagem()) return;
    const area = this.selecao;
    const mascara = this.mascaraSelecao;
    this.selecionar(null);
    this.executar({ tipo: 'ApagarSelecao', area, mascara });
    this.notificar();
  }

  crop() {
    if (!this.disponivel() || !this.selecao) return;
    this.confirmarColagem();
    if (!this.selecao) return;
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
    this.confirmarColagem();
    if (!this.selecao) return;
    const { selecaoTransparente, color2 } = useEditor.getState();
    const area = this.selecao;
    const recorte = prepararRecorteDaArea(
      this.doc.lerPixels(area),
      area,
      this.mascaraSelecao,
      selecaoTransparente ? color2 : undefined,
    ).imagem;
    this.copiado = recorte.getContext('2d')!.getImageData(0, 0, area.width, area.height);
    const paraSistema = copiarImagemClipboard(recorte).then(
      () => true,
      () => false,
    );
    if (recortar) this.deleteSelection();
    const copiadoNoSistema = await paraSistema;
    this.eventos.avisar(
      recortar
        ? 'Seleção recortada. Use Colar para reposicionar.'
        : copiadoNoSistema
          ? 'Seleção copiada como PNG.'
          : 'Seleção copiada neste editor.',
    );
  }

  async paste() {
    if (!this.disponivel()) return;
    if (!this.copiado) {
      this.eventos.avisar(
        'Use Ctrl+V para colar uma imagem ou Colar de… para escolher um arquivo.',
      );
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
    this.confirmarColagem();
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

  async colarCopiaIgual(pixels: PixelBuffer) {
    const capa = this.copiado;
    if (
      !capa ||
      pixels.width !== capa.width ||
      pixels.height !== capa.height ||
      !pixels.data.every((valor, i) => valor === capa.data[i])
    )
      return false;
    await this.paste();
    return true;
  }

  colarImagem(pixels: PixelBuffer, aumentar = false) {
    if (!this.disponivel()) return;
    this.confirmarFormaPendente();
    const { color2, selecaoTransparente, setTool } = useEditor.getState();
    const largura = Math.max(pixels.width, this.doc.width);
    const altura = Math.max(pixels.height, this.doc.height);
    const papel =
      aumentar && (largura !== this.doc.width || altura !== this.doc.height)
        ? { largura, altura, fundo: color2 }
        : undefined;
    if (papel) validarDimensoes(papel.largura, papel.altura);
    const destino = {
      x: Math.max(0, Math.min(24, this.doc.width - pixels.width)),
      y: Math.max(0, Math.min(24, this.doc.height - pixels.height)),
      width: pixels.width,
      height: pixels.height,
    };
    const corTransparente = selecaoTransparente ? color2 : undefined;
    const recorte = prepararRecorte(pixels, { ...destino, x: 0, y: 0 }, undefined, corTransparente);
    setTool('select');
    this.colagem = { pixels, destino, papel, recorte, corTransparente };
    this.mostrarColagem();
    this.selecionar(destino);
    this.eventos.avisar('Arraste a imagem para posicionar. Enter confirma, Esc descarta.');
  }

  private definirRecorteDaColagem() {
    const colagem = this.colagem;
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
    this.mostrarColagem();
  }

  private mostrarColagem() {
    if (!this.colagem) return;
    const { destino, recorte } = this.colagem;
    const { zoom } = useEditor.getState();
    if (recorte.imagem.parentElement !== this.camadaColagem)
      this.camadaColagem.replaceChildren(recorte.imagem);
    Object.assign(recorte.imagem.style, {
      left: `${destino.x * zoom}px`,
      top: `${destino.y * zoom}px`,
      width: `${destino.width * zoom}px`,
      height: `${destino.height * zoom}px`,
    });
    this.workspace.setAttribute('data-colagem-pendente', '');
  }

  private reposicionarColagem(destino: Rect) {
    if (!this.colagem) return;
    this.colagem.destino = destino;
    this.mostrarColagem();
    this.selecionar(destino);
  }

  private confirmarColagem() {
    const colagem = this.colagem;
    if (!colagem) return;
    const { pixels, destino, papel, corTransparente } = colagem;
    this.limparColagem();
    const mudou = this.executar({
      tipo: 'ColarImagem',
      x: destino.x,
      y: destino.y,
      imagem: serializarImagem(pixels),
      tamanho: { largura: destino.width, altura: destino.height },
      papel,
      corTransparente,
    });
    if (mudou && papel) this.fit();
    this.selecionar(limitarArea(destino, this.doc));
  }

  private limparColagem() {
    this.colagem = null;
    this.camadaColagem.replaceChildren();
    this.workspace.removeAttribute('data-colagem-pendente');
  }

  private descartarColagem() {
    if (!this.colagem) return false;
    this.limparColagem();
    this.selecionar(null);
    return true;
  }

  private disponivel() {
    return this.ativo && this.pronto && !this.gesto;
  }

  obterReferenciaForma(): ReturnType<EditorApi['obterReferenciaForma']> {
    const estado = useEditor.getState();
    const ativa = this.ferramentas[estado.tool].obterFormaPendente?.(this.contexto(estado));
    if (ativa) return referenciaDaForma(ativa);
    if (this.colagem) {
      const { pixels } = this.colagem;
      const referencia = referenciaDaSelecao(pixels, {
        x: 0,
        y: 0,
        width: pixels.width,
        height: pixels.height,
      });
      if (referencia) return referencia;
    } else if (this.selecao && this.mascaraSelecao) {
      const area = this.selecao;
      const recorte = prepararRecorteDaArea(this.doc.lerPixels(area), area, this.mascaraSelecao);
      const pixels = recorte.imagem.getContext('2d')!.getImageData(0, 0, area.width, area.height);
      const referencia = referenciaDaSelecao(pixels, { ...area, x: 0, y: 0 });
      if (referencia) return referencia;
    } else if (this.selecao) {
      const area = this.selecao;
      const referencia = referenciaDaSelecao(this.doc.lerPixels(area), { ...area, x: 0, y: 0 });
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
      colagemFlutuante: Boolean(this.colagem),
      executar: (comando) => this.executar(comando),
      selecionar: (area, mascara) => this.selecionar(area, mascara),
      capturarCor: (ponto, alvo) => this.capturarCor(ponto, alvo),
      lerPixels: (area) => this.doc.lerPixels(area),
      previsualizarTraco: (de, ate, estilo) => this.previsualizarTraco(de, ate, estilo),
      iniciarPreviaPincel: (configuracao) => this.iniciarPreviaPincel(configuracao),
      previsualizarMarcasPincel: (marcas) => this.previsualizarMarcasPincel(marcas),
      prepararRecorte: (area, mascara, transparente) =>
        prepararRecorteDaArea(this.doc.lerPixels(area), area, mascara, transparente),
      reposicionarColagem: (destino) => this.reposicionarColagem(destino),
      confirmarColagem: () => this.confirmarColagem(),
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
    this.confirmarColagem();
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
    const categoria =
      medicaoAtiva &&
      (comando.tipo === 'Pincelar'
        ? comando.configuracao.tipo === 'spray'
          ? 'spray'
          : 'pincel'
        : comando.tipo === 'Preencher'
          ? 'balde'
          : null);
    const mudou = categoria
      ? medirOperacao(`historico:${categoria}`, () => this.comandos.executar(comando))
      : this.comandos.executar(comando);
    if (!mudou) return false;
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
    const area = this.comandos.ultimaAlteracao;
    this.compor(area ?? undefined);
    this.autosave.marcar(this.doc.activeLayerId, area);
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
