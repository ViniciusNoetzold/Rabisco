import { criarPreenchedor, PIXELS_PARA_WORKER } from './preenchedor';
import { registrarDuracao } from '../medicao';
import { FERRAMENTAS_DE_SELECAO } from '../../tools/select';
import { useEditor } from '../../app/store';
import {
  distanciaDaRegua,
  encaixarNasGuias,
  projetarNaRegua,
  RAIO_GUIAS,
  RAIO_REGUA,
  type Regua,
} from '../../document/guias';
import { Estabilizador, FERRAMENTAS_ESTABILIZAVEIS } from '../../brushes/estabilizador';
import {
  aplicarCurva,
  comprimentoDaPonta,
  fatorDaPonta,
  PressaoPorVelocidade,
} from '../../brushes/pressao';
import {
  configDaSimetria,
  transformacoes,
  type ConfigSimetria,
  type Transformacao,
} from '../../brushes/simetria';
import { prepararRecorteDaArea } from '../../document/selecao';
import type { Comando } from '../../commands/comandos';
import { reconhecerForma } from '../../shapes/reconhecer';
import type { ConfiguracaoForma, EstiloContorno } from '../../shapes/tipos';
import type { Point, ToolId } from '../../layers/types';
import type { EventoFerramenta, Tool, ToolCtx } from '../../tools/tool';
import { criarFerramentas } from '../../tools/toolRegistry';
import type { ControleColagem } from './colagem';
import type { NucleoEditor } from './nucleo';
import { opcoesDaFerramenta } from './opcoes';
import type { ControleSelecao } from './selecao';
import type { SuperficieTela } from './superficie';

type EstadoEditor = ReturnType<typeof useEditor.getState>;

/** Ferramentas cujos pontos encaixam nas guias do papel. */
const FERRAMENTAS_COM_ENCAIXE = new Set<ToolId>([
  'select',
  'ellipseSelect',
  'line',
  'rectangle',
  'ellipse',
  'shape',
]);

/**
 * As ferramentas e o gesto em andamento: repassa ponteiro e teclado para a ferramenta ativa,
 * monta o contexto que ela recebe e cuida das formas e textos que ainda esperam confirmação.
 */
export class ControleFerramentas {
  private readonly ferramentas = criarFerramentas();
  private gesto: { ponteiro: number; ferramenta: Tool } | null = null;
  /** Ligado durante um traço com "Estabilizar" acima de zero. */
  private estabilizador: Estabilizador | null = null;
  /** A corda do estabilizador, desenhada sobre o papel (SVG, fora dos canvas). */
  private corda: SVGSVGElement | null = null;
  /** Pressão do pincel durante o gesto: curva da caneta, velocidade e começo afinado. */
  private pressao: {
    velocidade: PressaoPorVelocidade | null;
    comprimento: number;
    percorrido: number;
    ultimo: Point;
  } | null = null;

  /** Formas inteligentes durante o traço: os pontos e o relógio de "segurou parado". */
  private inteligente: {
    pontos: Point[];
    ancora: Point;
    relogio: ReturnType<typeof setTimeout> | null;
    ultimo: EventoFerramenta;
  } | null = null;
  /** Forma reconhecida esperando Enter ou Esc: o traço original e a ferramenta de volta. */
  private formaInteligente: { original: Comando; voltarPara: ToolId } | null = null;
  /** Enquanto definido, `executar` guarda o comando em vez de executá-lo. */
  private capturando: { comando: Comando | null } | null = null;

  private readonly preenchedor = criarPreenchedor();
  /** Balde em andamento no worker: novos gestos esperam (a tela não trava). */
  private preenchendo = false;

  /** Régua em que o traço em andamento grudou (começou perto da borda dela). */
  private reguaDoGesto: Regua | null = null;

  /** Simetria do traço em andamento (lápis, pincéis e borrachas), com as cópias da prévia. */
  private simetria: { config: ConfigSimetria; copias: Transformacao[] } | null = null;

  constructor(
    private readonly nucleo: NucleoEditor,
    private readonly superficie: SuperficieTela,
    private readonly selecao: ControleSelecao,
    private readonly colagem: ControleColagem,
  ) {}

  get emGesto(): boolean {
    return this.gesto !== null || this.preenchendo;
  }

  get ativa(): Tool {
    return this.ferramentas[useEditor.getState().tool];
  }

  cursor(id: ToolId) {
    return this.ferramentas[id].cursor(this.contexto());
  }

  iniciarGesto(ponteiro: number, evento: EventoFerramenta, atalhoContaGotas: boolean) {
    if (this.gesto || this.preenchendo || (evento.botao !== 0 && evento.botao !== 2)) return false;
    // Clicar fora da forma inteligente a confirma e volta a desenhar com o lápis ou pincel.
    if (
      this.formaInteligente &&
      !atalhoContaGotas &&
      useEditor.getState().tool === 'shape' &&
      !this.ferramentas.shape.tocaNaForma?.(this.contexto(), evento.ponto)
    )
      this.encerrarFormaInteligente('confirmar');
    const id = atalhoContaGotas ? 'eyedropper' : useEditor.getState().tool;
    const ferramenta = this.ferramentas[id];
    this.gesto = { ponteiro, ferramenta };
    // Régua de desenho: o traço que começa perto da borda gruda nela até soltar.
    const { regua } = useEditor.getState().guiasDoPapel;
    this.reguaDoGesto =
      regua &&
      FERRAMENTAS_ESTABILIZAVEIS.has(id) &&
      distanciaDaRegua(evento.ponto, regua) * useEditor.getState().zoom <= RAIO_REGUA
        ? regua
        : null;
    evento = this.ajustarPonto(id, evento);
    const { estabilizar, suavizar, zoom, pressaoVelocidade, afinar, size } = useEditor.getState();
    this.pressao =
      id === 'brush'
        ? {
            velocidade:
              pressaoVelocidade && evento.ponto.pressure === undefined
                ? new PressaoPorVelocidade(zoom)
                : null,
            comprimento: comprimentoDaPonta(afinar, size),
            percorrido: 0,
            ultimo: evento.ponto,
          }
        : null;
    evento = this.ajustarPressao(evento);
    this.estabilizador =
      estabilizar > 0 && FERRAMENTAS_ESTABILIZAVEIS.has(id)
        ? new Estabilizador(evento.ponto, estabilizar / zoom, suavizar / 100)
        : null;
    const config = FERRAMENTAS_ESTABILIZAVEIS.has(id)
      ? configDaSimetria(useEditor.getState(), this.nucleo.doc.width, this.nucleo.doc.height)
      : null;
    this.simetria = config && { config, copias: transformacoes(config) };
    // A prévia do traço fica atrás das camadas de cima, como o resultado final.
    if (FERRAMENTAS_ESTABILIZAVEIS.has(id)) this.superficie.mostrarCamadasDeCima();
    // Formas inteligentes: lápis e pincel, sem simetria (as cópias ficam para depois).
    this.inteligente =
      useEditor.getState().formasInteligentes &&
      ((id === 'pencil' && !useEditor.getState().modoPixelArt) ||
        (id === 'brush' && useEditor.getState().pincel !== 'dedo')) &&
      !config
        ? { pontos: [evento.ponto], ancora: evento.ponto, relogio: null, ultimo: evento }
        : null;
    this.armarRelogio();
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
    evento = this.ajustarPonto(ferramenta.id, evento);
    evento = this.ajustarPressao(evento);
    this.vigiarParada(evento.ponto);
    if (this.estabilizador) {
      const ponta = this.estabilizador.mover(evento.ponto);
      this.mostrarCorda(evento.ponto, this.estabilizador.ponta);
      if (!ponta) return;
      evento = { ...evento, ponto: ponta };
    }
    if (this.inteligente) {
      this.inteligente.pontos.push(evento.ponto);
      this.inteligente.ultimo = evento;
    }
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
    this.desarmarRelogio();
    if (evento) evento = this.ajustarPonto(ferramenta.id, evento);
    this.reguaDoGesto = null;
    const estabilizador = this.estabilizador;
    this.estabilizador = null;
    if (evento) evento = this.ajustarPressao(evento);
    this.pressao = null;
    this.mostrarCorda(null);
    try {
      if (evento && estabilizador) {
        if (useEditor.getState().alcancarFim) {
          // O fim do traço vai até onde a mão parou, em passos, sem um salto reto.
          for (const ponto of estabilizador.alcancar(evento.ponto))
            ferramenta.onPointerMove(this.contexto(), { ...evento, ponto });
        } else evento = { ...evento, ponto: estabilizador.ponta };
      }
      if (evento) ferramenta.onPointerUp(this.contexto(), evento);
      else ferramenta.onCancel?.(this.contexto());
    } finally {
      this.simetria = null;
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
    if (this.formaInteligente && !this.gesto) {
      if (evento.key === 'Escape') return this.encerrarFormaInteligente('original');
      if (evento.key === 'Enter') return this.encerrarFormaInteligente('confirmar');
    }
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
    if (this.encerrarFormaInteligente('confirmar')) return;
    this.colagem.confirmar();
    const ferramenta = this.ativa;
    if (!ferramenta.temPendente?.()) return;
    ferramenta.commitPendente?.(this.contexto());
    this.redesenharOverlay(ferramenta);
  }

  /** Descarta a forma ou texto ainda editável. Devolve true se havia um. */
  descartarPendente() {
    if (this.encerrarFormaInteligente('descartar')) return true;
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
    this.preenchedor.encerrar();
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
      // Trocar de ferramenta confirma a forma inteligente (como qualquer forma pendente).
      if (anterior.tool === 'shape') this.formaInteligente = null;
      if (this.gesto) this.cancelarGesto();
      if (!FERRAMENTAS_DE_SELECAO.has(atual.tool)) this.colagem.confirmar();
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
      guiasDeEncaixe: () => this.guiasDeEncaixe(),
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
      executar: (comando) => {
        // O comando leva a simetria e as marcas de um eixo só; o executor pinta as cópias.
        const simetria = this.simetria?.config;
        const final =
          simetria && (comando.tipo === 'TracarPincel' || comando.tipo === 'Pincelar')
            ? { ...comando, simetria }
            : comando;
        if (this.capturando) {
          this.capturando.comando = final;
          return true;
        }
        return nucleo.executar(final);
      },
      preencher: (comando) => this.preencher(comando),
      selecionar: (area, mascara) => selecao.selecionar(area, mascara),
      capturarCor: (ponto, alvo) => this.capturarCor(ponto, alvo),
      lerPixels: (area) => doc.lerPixels(area),
      avisar: (mensagem) => nucleo.avisar(mensagem),
      previsualizarTraco: (de, ate, estilo) => {
        for (const transformar of this.simetria?.copias ?? [null])
          if (transformar) superficie.traco(transformar(de), transformar(ate), estilo);
          else superficie.traco(de, ate, estilo);
      },
      iniciarPreviaPincel: (configuracao) =>
        superficie.iniciarPincel(configuracao, this.simetria?.copias),
      previsualizarMarcasPincel: (marcas) => superficie.marcasPincel(marcas),
      previsualizarTrecho: (fonte, area) => superficie.trecho(fonte, area),
      prepararRecorte: (area, mascara, transparente) =>
        prepararRecorteDaArea(doc.lerPixels(area), area, mascara, transparente),
      reposicionarColagem: (destino) => colagem.reposicionar(destino),
      confirmarColagem: () => colagem.confirmar(),
      previsualizarSelecao: (origem, destino, recorte) =>
        superficie.selecao(origem, destino, recorte),
      limparPrevia: () => superficie.limpar(),
    };
  }

  /**
   * Bordas e centro do papel e das outras camadas visíveis. Para não travar em papéis grandes
   * com muitas camadas, as outras camadas só entram até ~40 milhões de pixels somados.
   */
  private guiasDeEncaixe() {
    const { doc } = this.nucleo;
    const { guiasDoPapel, mostrarGuias } = useEditor.getState();
    const x = [0, doc.width / 2, doc.width, ...(mostrarGuias ? guiasDoPapel.verticais : [])];
    const y = [0, doc.height / 2, doc.height, ...(mostrarGuias ? guiasDoPapel.horizontais : [])];
    let orcamento = 40_000_000;
    for (const camada of doc.layers) {
      if (camada.id === doc.activeLayerId || !camada.visible || camada.fundo) continue;
      orcamento -= doc.width * doc.height;
      if (orcamento < 0) break;
      const limites = limitesDosPixels(doc.lerPixels(undefined, { camada: camada.id }));
      if (!limites) continue;
      x.push(limites.x, limites.x + limites.width / 2, limites.x + limites.width);
      y.push(limites.y, limites.y + limites.height / 2, limites.y + limites.height);
    }
    return { x, y };
  }

  /**
   * Traço grudado na régua: o ponto vai para a borda dela. Formas e seleção: os pontos
   * encaixam nas guias do papel.
   */
  private ajustarPonto(id: ToolId, evento: EventoFerramenta): EventoFerramenta {
    if (this.reguaDoGesto)
      return { ...evento, ponto: projetarNaRegua(evento.ponto, this.reguaDoGesto) };
    const { guiasDoPapel, mostrarGuias, zoom } = useEditor.getState();
    if (!mostrarGuias || !FERRAMENTAS_COM_ENCAIXE.has(id)) return evento;
    if (!guiasDoPapel.horizontais.length && !guiasDoPapel.verticais.length) return evento;
    const ponto = encaixarNasGuias(evento.ponto, guiasDoPapel, RAIO_GUIAS / zoom);
    return ponto === evento.ponto ? evento : { ...evento, ponto };
  }

  /**
   * Balde: papéis pequenos executam na hora; nos grandes, a área é calculada num worker e o
   * comando é executado quando ela chega. Passando de 200 ms, a barra avisa "Preenchendo…".
   */
  private preencher(comando: Extract<Comando, { tipo: 'Preencher' }>): boolean {
    const { doc, comandos } = this.nucleo;
    if (this.preenchendo) return false;
    if (doc.width * doc.height < PIXELS_PARA_WORKER || !this.preenchedor.noWorker)
      return this.nucleo.executar(comando);
    this.preenchendo = true;
    const inicio = performance.now();
    const aviso = setTimeout(() => this.nucleo.avisar('Preenchendo…'), 200);
    const referencia = comandos.referenciaDoBalde(comando);
    this.preenchedor
      .planejar(referencia, comando)
      .then(({ plano, referencia }) => {
        if (!this.nucleo.ativo()) return;
        comandos.usarPlanoPronto(comando, plano, referencia);
        this.preenchendo = false;
        this.nucleo.executar(comando);
        registrarDuracao('balde:total', performance.now() - inicio);
      })
      .catch(() => {
        if (!this.nucleo.ativo()) return;
        this.preenchendo = false;
        this.nucleo.executar(comando);
      })
      .finally(() => {
        clearTimeout(aviso);
        this.preenchendo = false;
        if (this.nucleo.ativo()) this.nucleo.notificar();
      });
    return true;
  }

  /** (Re)começa a contar o tempo parado. */
  private armarRelogio() {
    const info = this.inteligente;
    if (!info) return;
    if (info.relogio) clearTimeout(info.relogio);
    info.relogio = setTimeout(
      () => this.transformarEmForma(),
      useEditor.getState().esperaFormaInteligente,
    );
  }

  private desarmarRelogio() {
    if (this.inteligente?.relogio) clearTimeout(this.inteligente.relogio);
    this.inteligente = null;
  }

  /** Mexeu mais de 3 px de tela: não está parado, recomeça a contar. */
  private vigiarParada(ponto: Point) {
    const info = this.inteligente;
    if (!info) return;
    const zoom = useEditor.getState().zoom;
    if (Math.hypot(ponto.x - info.ancora.x, ponto.y - info.ancora.y) * zoom <= 3) return;
    info.ancora = ponto;
    this.armarRelogio();
  }

  /**
   * Segurou parado: se o traço parece uma forma, termina o gesto sem pintar e mostra a forma
   * editável no lugar. Em dúvida, nada muda e o traço continua.
   */
  private transformarEmForma() {
    const info = this.inteligente;
    const gesto = this.gesto;
    if (!info || !gesto) return;
    info.relogio = null;
    const forma = reconhecerForma(info.pontos);
    if (!forma) return;
    const { ferramenta, ponteiro } = gesto;
    // O traço termina como sempre, mas o comando fica guardado (Esc volta a ele).
    this.capturando = { comando: null };
    try {
      ferramenta.onPointerUp(this.contexto(), info.ultimo);
    } finally {
      this.gesto = null;
      this.estabilizador = null;
      this.pressao = null;
      this.simetria = null;
      this.inteligente = null;
      this.reguaDoGesto = null;
      this.mostrarCorda(null);
      this.superficie.limpar();
    }
    const original = this.capturando.comando;
    this.capturando = null;
    const { tela } = this.superficie;
    if (tela.hasPointerCapture(ponteiro)) tela.releasePointerCapture(ponteiro);
    if (!original) return;
    useEditor.getState().setTool('shape');
    this.formaInteligente = { original, voltarPara: ferramenta.id };
    const formas = this.ferramentas.shape;
    formas.adotarForma?.(forma.geometria, estiloDoTraco(original));
    this.redesenharOverlay(formas);
    const { caixa } = forma.geometria;
    this.superficie.pular(
      { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 },
      useEditor.getState().zoom,
    );
    this.nucleo.avisar(`Virou ${forma.nome}! Enter confirma, Esc desfaz.`);
  }

  /**
   * Fecha a forma inteligente: confirma, volta ao traço original (Esc) ou descarta tudo
   * (desfazer). Depois volta à ferramenta do traço. Devolve true se havia uma.
   */
  private encerrarFormaInteligente(modo: 'confirmar' | 'original' | 'descartar'): boolean {
    const info = this.formaInteligente;
    if (!info) return false;
    this.formaInteligente = null;
    const formas = this.ferramentas.shape;
    if (modo === 'confirmar') formas.commitPendente?.(this.contexto());
    else formas.descartarPendente?.();
    if (modo === 'original') this.nucleo.executar(info.original);
    if (useEditor.getState().tool === 'shape') useEditor.getState().setTool(info.voltarPara);
    else this.redesenharOverlay(formas);
    if (modo === 'original') this.nucleo.avisar('Voltou ao traço como você desenhou.');
    return true;
  }

  /** Curva da caneta, pressão pela velocidade (mouse e toque) e começo do traço afinado. */
  private ajustarPressao(evento: EventoFerramenta): EventoFerramenta {
    const estado = this.pressao;
    if (!estado) return evento;
    const { ponto } = evento;
    let pressao =
      ponto.pressure !== undefined
        ? aplicarCurva(ponto.pressure, useEditor.getState().curvaPressao)
        : (estado.velocidade?.proxima(ponto, evento.instante ?? performance.now()) ?? undefined);
    estado.percorrido += Math.hypot(ponto.x - estado.ultimo.x, ponto.y - estado.ultimo.y);
    estado.ultimo = ponto;
    const ponta = fatorDaPonta(estado.percorrido, estado.comprimento);
    if (ponta < 1) pressao = (pressao ?? 1) * ponta;
    return pressao === undefined ? evento : { ...evento, ponto: { ...ponto, pressure: pressao } };
  }

  /** Linha fina do ponteiro até a ponta do pincel, e um anel na ponta. `null` esconde. */
  private mostrarCorda(ponteiro: Point | null, ponta?: Point) {
    if (!ponteiro || !ponta) {
      this.corda?.remove();
      this.corda = null;
      return;
    }
    const { zoom } = useEditor.getState();
    const palco = this.superficie.tela.parentElement;
    if (!palco) return;
    if (!this.corda) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('corda-estabilizador');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = '<line /><circle r="4" />';
      palco.append(svg);
      this.corda = svg;
    }
    const linha = this.corda.querySelector('line')!;
    const anel = this.corda.querySelector('circle')!;
    linha.setAttribute('x1', String(ponteiro.x * zoom));
    linha.setAttribute('y1', String(ponteiro.y * zoom));
    linha.setAttribute('x2', String(ponta.x * zoom));
    linha.setAttribute('y2', String(ponta.y * zoom));
    anel.setAttribute('cx', String(ponta.x * zoom));
    anel.setAttribute('cy', String(ponta.y * zoom));
  }

  /** Recorta os pixels não transparentes da camada ativa (com a máscara aplicada à prévia). */
  private camadaParaTransformar() {
    const { doc } = this.nucleo;
    const camada = doc.activeLayer;
    if (camada.ajuste) return null;
    if (camada.locked || camada.bloqueioPosicao) {
      this.nucleo.avisar('Esta camada está bloqueada. Desbloqueie para transformar.');
      return null;
    }
    const limites = limitesDosPixels(doc.lerPixels(undefined, { camada: camada.id }));
    if (!limites) {
      this.nucleo.avisar('A camada está vazia: não há o que transformar.');
      return null;
    }
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

/** Retângulo que contém os pixels não transparentes, ou `null` se a imagem estiver vazia. */
export function limitesDosPixels({ data, width, height }: ImageData) {
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
  if (direita < 0) return null;
  return { x: esquerda, y: topo, width: direita - esquerda + 1, height: base - topo + 1 };
}

/** Cor, espessura e pincel do traço que virou forma: só contorno, sem preenchimento. */
function estiloDoTraco(comando: Comando): Partial<ConfiguracaoForma> {
  if (comando.tipo === 'Pincelar') {
    const { cor, espessura, tipo } = comando.configuracao;
    const contorno: EstiloContorno =
      tipo === 'giz' || tipo === 'marcador' || tipo === 'aquarela' ? tipo : 'solid';
    return { cor1: cor, espessura, contorno, preenchimento: 'none' };
  }
  if (comando.tipo === 'TracarPincel')
    return {
      cor1: comando.cor,
      espessura: comando.espessura,
      contorno: 'solid',
      preenchimento: 'none',
    };
  return {};
}
