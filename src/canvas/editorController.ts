import { useEditor } from '../app/store';
import {
  type Comando,
  type OpcoesTransformacao,
  type OrientacaoImagem,
} from '../commands/comandos';
import { serializarImagem, type ComandoCamada } from '../commands/comandos';
import { redimensionarEInclinar } from '../document/transformacoes';
import { Executador } from '../commands/executador';
import { chaveDoAlvo, novoId } from '../document/camadas';
import { RabiscoDocument } from '../document/model';
import type { OpcoesExportacao } from '../io/imagens';
import type { OpcoesImpressao } from '../io/imprimir';
import type { PixelBuffer, ToolId } from '../layers/types';
import { referenciaDaForma } from '../shapes/referencia';
import type { ConfiguracaoForma } from '../shapes/tipos';
import type { EventoFerramenta } from '../tools/tool';
import type { ConfiguracaoTexto } from '../tools/texto';
import * as arquivos from './controle/arquivos';
import { ControleColagem } from './controle/colagem';
import { ControleFerramentas } from './controle/ferramentas';
import { ControlePapel } from './controle/papel';
import type { NucleoEditor } from './controle/nucleo';
import { Persistencia } from './controle/persistencia';
import { ControleSelecao } from './controle/selecao';
import { SuperficieTela } from './controle/superficie';
import type { DocumentInfo, EditorApi } from './editorTypes';
import { medicaoAtiva, medirOperacao } from './medicao';
import { ZOOM_MIN } from './zoom';

const MENSAGENS_RECUSA = {
  bloqueada: 'Esta camada está bloqueada. Desbloqueie no painel Camadas para pintar nela.',
  oculta: 'Esta camada está oculta. Mostre-a no painel Camadas (o olho) para pintar nela.',
  'ultima-camada': 'O desenho precisa de pelo menos uma camada.',
  'sem-camada-abaixo': 'Não há camada abaixo para mesclar.',
} as const;

interface EventosEditor {
  mudar(info: DocumentInfo): void;
  avisar(mensagem: string): void;
}

/**
 * Coordena uma instância do editor: gestos das ferramentas, histórico e as ações da interface.
 * O trabalho especializado fica em controle/: tela e prévias, seleção, colagem, persistência
 * e arquivos.
 */
export class EditorController implements EditorApi, NucleoEditor {
  readonly doc = new RabiscoDocument();
  readonly comandos = new Executador(this.doc);
  private readonly superficie: SuperficieTela;
  private readonly selecao: ControleSelecao;
  private readonly colagem: ControleColagem;
  private readonly persistencia: Persistencia;
  private readonly ferramentas: ControleFerramentas;
  private readonly papel: ControlePapel;
  private readonly desconectarOpcoes: () => void;
  private ultimaForma: ConfiguracaoForma | null = null;
  private pronto = false;
  private ligado = true;
  private acompanharAjuste = true;
  private revisao = 0;
  private ajustandoZoom = false;

  constructor(
    tela: HTMLCanvasElement,
    previa: HTMLCanvasElement,
    private readonly workspace: HTMLDivElement,
    camadaColagem: HTMLDivElement,
    private readonly eventos: EventosEditor,
  ) {
    this.superficie = new SuperficieTela(this.doc, tela, previa, workspace);
    this.selecao = new ControleSelecao(this, () => this.ferramentas.redesenharAtiva());
    this.colagem = new ControleColagem(this, this.selecao, camadaColagem, workspace);
    this.persistencia = new Persistencia(this);
    this.ferramentas = new ControleFerramentas(this, this.superficie, this.selecao, this.colagem);
    this.papel = new ControlePapel(this, this.selecao, this.colagem, this.ferramentas);
    this.desconectarOpcoes = useEditor.subscribe((atual, anterior) =>
      this.opcoesMudaram(atual, anterior),
    );
  }

  // ---- Núcleo compartilhado com os módulos -------------------------------------------------

  ativo() {
    return this.ligado;
  }

  disponivel() {
    return this.ligado && this.pronto && !this.ferramentas.emGesto;
  }

  executar(comando: Comando, aposExecutar?: () => void) {
    // As prévias não entram no histórico. O comando rasteriza uma única vez na camada.
    this.superficie.limpar();
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
    if (!mudou) {
      const motivo = this.comandos.motivoRecusa;
      if (motivo) this.avisar(MENSAGENS_RECUSA[motivo]);
      return false;
    }
    if (comando.tipo === 'AplicarForma') this.ultimaForma = comando.configuracao;
    if (comando.tipo === 'NovoDocumento' || comando.tipo === 'AbrirImagem') this.ultimaForma = null;
    aposExecutar?.();
    this.edicaoAplicada();
    return true;
  }

  notificar() {
    if (!this.ligado) return;
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
      selection: this.selecao.area,
      saving: this.persistencia.estado,
      estrutura: this.doc.estrutura(),
      revisao: this.revisao,
    });
  }

  avisar(mensagem: string) {
    this.eventos.avisar(mensagem);
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

  // ---- Ciclo de vida -----------------------------------------------------------------------

  async iniciar() {
    this.superficie.compor();
    this.fit();
    const recuperado = await this.persistencia.recuperar();
    if (!this.ligado) return;
    if (recuperado) {
      this.superficie.compor();
      this.fit();
      this.avisar('Seu último rabisco foi recuperado. Continue de onde parou.');
    }
    this.pronto = true;
    this.notificar();
  }

  encerrar() {
    // Primeiro desliga: a última gravação não pode mais avisar a interface (em desenvolvimento,
    // o React monta o editor duas vezes, e a instância antiga anunciava "Salvo" enquanto a
    // nova ainda recuperava o desenho).
    this.ligado = false;
    this.persistencia.encerrar();
    this.desconectarOpcoes();
    this.ferramentas.encerrar();
    this.selecao.encerrar();
    this.workspace.removeAttribute('data-forma-pendente');
    this.colagem.limpar();
  }

  ajustarAoRedimensionar() {
    if (this.pronto && !this.ferramentas.emGesto && this.acompanharAjuste) this.fit();
  }

  // ---- Gestos e teclado --------------------------------------------------------------------

  cursor(id: ToolId) {
    return this.ferramentas.cursor(id);
  }

  iniciarGesto(ponteiro: number, evento: EventoFerramenta, atalhoContaGotas: boolean) {
    return this.pronto && this.ferramentas.iniciarGesto(ponteiro, evento, atalhoContaGotas);
  }

  moverGesto(ponteiro: number, evento: EventoFerramenta) {
    this.ferramentas.moverGesto(ponteiro, evento);
  }

  sairDoPonteiro() {
    this.ferramentas.sairDoPonteiro();
  }

  terminarGesto(ponteiro: number, evento?: EventoFerramenta) {
    this.ferramentas.terminarGesto(ponteiro, evento);
  }

  cancelarGesto() {
    this.ferramentas.cancelarGesto();
  }

  tecla(evento: KeyboardEvent) {
    return this.ferramentas.tecla(evento);
  }

  // ---- Histórico ---------------------------------------------------------------------------

  undo() {
    if (medicaoAtiva) medirOperacao('desfazer', () => this.mudarHistorico('desfazer'));
    else this.mudarHistorico('desfazer');
  }

  redo() {
    if (medicaoAtiva) medirOperacao('refazer', () => this.mudarHistorico('refazer'));
    else this.mudarHistorico('refazer');
  }

  private mudarHistorico(operacao: 'desfazer' | 'refazer') {
    if (!this.disponivel() || this.colagem.descartar() || this.ferramentas.descartarPendente())
      return;
    const mudou = medicaoAtiva
      ? medirOperacao(`historico:${operacao}`, () => this.comandos[operacao]())
      : this.comandos[operacao]();
    if (!mudou) return;
    this.selecao.selecionar(null);
    this.edicaoAplicada();
  }

  // ---- Arquivos ----------------------------------------------------------------------------

  async save() {
    if (!this.pronto) return;
    await arquivos.salvarPng(this.doc, this.telaParaSaida());
    this.avisar('PNG exportado. Seu rabisco está pronto para levar.');
  }

  async salvarComo(opcoes: OpcoesExportacao) {
    if (!this.pronto) return;
    await arquivos.salvarComo(this.doc, this.telaParaSaida(), opcoes);
    this.avisar(`${opcoes.formato.toUpperCase()} exportado.`);
  }

  async imprimir(opcoes: OpcoesImpressao) {
    if (!this.pronto) return;
    await arquivos.imprimir(this.doc, this.telaParaSaida(), opcoes);
  }

  open(arquivo: File) {
    return this.papel.abrir(arquivo);
  }

  newDocument(nome: string, largura: number, altura: number) {
    this.papel.novo(nome, largura, altura);
  }

  private telaParaSaida() {
    this.ferramentas.confirmarPendente();
    return this.superficie.telaParaSaida();
  }

  // ---- Papel e transformações --------------------------------------------------------------

  redimensionarPapel(largura: number, altura: number, fundo?: string, dpi?: number) {
    this.papel.redimensionar(largura, altura, fundo, dpi);
  }

  transformarImagem(opcoes: OpcoesTransformacao) {
    this.papel.transformar(opcoes);
  }

  girarImagem(orientacao: OrientacaoImagem) {
    this.papel.girar(orientacao);
  }

  // ---- Seleção, texto e colagem ------------------------------------------------------------

  selectAll() {
    if (!this.disponivel()) return;
    this.colagem.confirmar();
    this.selecao.selecionarTudo();
  }

  inverterSelecao() {
    if (!this.disponivel()) return;
    this.colagem.confirmar();
    this.selecao.inverter();
  }

  deleteSelection() {
    if (!this.disponivel() || !this.selecao.area) return;
    if (this.colagem.descartar()) return;
    this.selecao.apagar();
  }

  crop() {
    if (!this.disponivel() || !this.selecao.area) return;
    this.colagem.confirmar();
    this.selecao.cortarPapel();
  }

  aplicarTexto(configuracao: ConfiguracaoTexto) {
    if (!this.disponivel()) return;
    this.selecao.selecionar(null);
    this.executar({ tipo: 'AplicarTexto', configuracao });
  }

  async copy(recortar = false) {
    if (!this.disponivel()) return;
    if (!this.selecao.area) {
      this.avisar('Selecione uma parte do desenho primeiro.');
      return;
    }
    this.colagem.confirmar();
    await this.colagem.copiar(recortar, () => this.deleteSelection());
  }

  async paste() {
    if (!this.disponivel()) return;
    this.colagem.colar();
  }

  async colarCopiaIgual(pixels: PixelBuffer) {
    if (!this.colagem.igualACopia(pixels)) return false;
    await this.paste();
    return true;
  }

  colarImagem(pixels: PixelBuffer, aumentar = false, nomeCamada?: string) {
    if (!this.disponivel()) return;
    this.ferramentas.confirmarPendente();
    this.colagem.colarImagem(pixels, aumentar, nomeCamada);
  }

  obterReferenciaForma(): ReturnType<EditorApi['obterReferenciaForma']> {
    const ativa = this.ferramentas.formaPendente();
    if (ativa) return referenciaDaForma(ativa);
    const daImagem = this.colagem.ativa ? this.colagem.referencia() : this.selecao.referencia();
    if (daImagem) return daImagem;
    return this.ultimaForma ? referenciaDaForma(this.ultimaForma) : null;
  }

  // ---- Camadas ---------------------------------------------------------------------------

  /** Comandos do painel de camadas. Confirma antes o que estiver pendente (forma, texto, colagem). */
  executarCamada(comando: ComandoCamada | Extract<Comando, { tipo: 'Lote' }>) {
    if (!this.disponivel()) return false;
    this.ferramentas.confirmarPendente();
    return this.executar(comando);
  }

  novaCamada() {
    const total = this.doc.layers.length;
    return this.executarCamada({
      tipo: 'NovaCamada',
      id: novoId('camada'),
      nome: `Camada ${total}`,
    });
  }

  /**
   * Imagem de fora como camada nova, centralizada. Maior que o papel: é reduzida para caber,
   * mantendo a proporção (a original não é cortada).
   */
  importarComoCamada(pixels: PixelBuffer, nome: string) {
    if (!this.disponivel()) return false;
    let imagem = pixels;
    const escala = Math.min(1, this.doc.width / pixels.width, this.doc.height / pixels.height);
    if (escala < 1) {
      imagem = redimensionarEInclinar(
        pixels,
        Math.max(1, Math.round(pixels.width * escala)),
        Math.max(1, Math.round(pixels.height * escala)),
        0,
        0,
      );
      this.avisar('A imagem era maior que o papel e foi reduzida para caber, numa camada nova.');
    }
    const id = novoId('camada');
    const mudou = this.executarCamada({
      tipo: 'NovaCamada',
      id,
      nome,
      imagem: serializarImagem(imagem),
      x: Math.round((this.doc.width - imagem.width) / 2),
      y: Math.round((this.doc.height - imagem.height) / 2),
    });
    if (mudou && escala === 1)
      this.avisar(`"${nome}" entrou numa camada nova. Use Mover (V) para posicionar.`);
    return mudou;
  }

  /** Troca a camada ativa (não entra no histórico). Com `mascara`, passa a pintar na máscara. */
  ativarCamada(id: string, mascara = false) {
    const camada = this.doc.camada(id);
    if (!camada || !this.disponivel()) return;
    this.ferramentas.confirmarPendente();
    this.doc.activeLayerId = id;
    this.doc.editandoMascara = mascara && Boolean(camada.mascara);
    this.persistencia.marcarDescricao();
    this.notificar();
  }

  /** Desenha a miniatura de uma camada (ou da máscara) num canvas pequeno do painel. */
  miniatura(id: string, destino: HTMLCanvasElement, mascara = false) {
    const camada = this.doc.camada(id);
    const origem = mascara ? camada?.mascara : camada?.canvas;
    const contexto = destino.getContext('2d');
    if (!origem || !contexto) return;
    contexto.clearRect(0, 0, destino.width, destino.height);
    const escala = Math.min(destino.width / origem.width, destino.height / origem.height);
    const largura = origem.width * escala;
    const altura = origem.height * escala;
    contexto.drawImage(
      origem,
      (destino.width - largura) / 2,
      (destino.height - altura) / 2,
      largura,
      altura,
    );
  }

  // ---- Internos ----------------------------------------------------------------------------

  private edicaoAplicada() {
    const { ultimasAlteracoes, estruturaMudou, ultimaAlteracao } = this.comandos;
    this.superficie.compor(ultimaAlteracao ?? undefined);
    for (const { alvo, area } of ultimasAlteracoes)
      this.persistencia.marcar(chaveDoAlvo(alvo), area);
    if (estruturaMudou) this.persistencia.marcarDescricao();
    this.revisao++;
    this.notificar();
  }

  private opcoesMudaram(
    atual: ReturnType<typeof useEditor.getState>,
    anterior: ReturnType<typeof useEditor.getState>,
  ) {
    if (atual.zoom !== anterior.zoom && !this.ajustandoZoom) this.acompanharAjuste = false;
    if (!this.pronto) return;
    if (this.colagem.ativa) {
      if (
        atual.selecaoTransparente !== anterior.selecaoTransparente ||
        atual.color2 !== anterior.color2
      ) {
        this.colagem.atualizarRecorte();
      } else if (atual.zoom !== anterior.zoom) {
        this.colagem.mostrar();
      }
    }
    this.ferramentas.opcoesMudaram(atual, anterior);
  }
}
