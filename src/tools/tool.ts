import type { Comando, EstiloTraco } from '../commands/comandos';
import type { FormaGradiente } from './gradiente';
import type { ConfigSimetria } from '../brushes/simetria';
import type { MascaraSelecao, RecorteFlutuante } from '../document/selecao';
import type {
  ConfiguracaoPincel,
  DensidadeSpray,
  MarcaPincel,
  TipoPincel,
} from '../brushes/catalogo';
import type { Point, Rect, ToolId } from '../layers/types';
import type { GeometriaForma } from './geometriaForma';
import type {
  ConfiguracaoForma,
  EstiloContorno,
  EstiloPreenchimento,
  IdForma,
  ParametrosForma,
} from '../shapes/tipos';

export type { EstiloTraco } from '../commands/comandos';

export interface EventoFerramenta {
  ponto: Point;
  botao: number;
  shift: boolean;
  ctrl?: boolean;
  /** Alt subtrai nas ferramentas de seleção. */
  alt?: boolean;
  instante?: number;
  cliques?: number;
}

export type ToolOptionsSchema = readonly {
  chave: 'espessura';
  tipo: 'numero';
  rotulo: string;
  min: number;
  max: number;
}[];

export interface ToolCtx {
  readonly largura: number;
  readonly altura: number;
  /** Camada onde as ferramentas pintam (comandos de camada precisam do identificador). */
  readonly camadaAtiva: string;
  /** Pixels não transparentes da camada ativa e onde estão (transformação livre). */
  camadaParaTransformar(): { conteudo: HTMLCanvasElement; limites: Rect } | null;
  /** Tira a camada ativa da tela enquanto a prévia da transformação aparece por cima. */
  ocultarCamadaAtiva(ocultar: boolean): void;
  /** Linhas de encaixe: bordas e centro do papel e das outras camadas visíveis. */
  guiasDeEncaixe(): { x: number[]; y: number[] };
  readonly opcoes: {
    cor1: string;
    cor2: string;
    espessura: number;
    espessuraBorracha: number;
    toleranciaBorracha: number;
    toleranciaBalde: number;
    preenchimentoGlobal: boolean;
    amostrarTudo: boolean;
    modoPixelArt: boolean;
    formasEmNovaCamada: boolean;
    guiasInteligentes: boolean;
    /** Pontas afinadas, 0–100% (o fim é aplicado ao soltar). */
    afinar: number;
    formaGradiente: FormaGradiente;
    gradienteTransparente: boolean;
    /** Dedo: quanto arrasta a cor, 0–100. */
    forcaDedo: number;
    pincel: TipoPincel;
    densidadeSpray: DensidadeSpray;
    gotasSpray: 1 | 2;
    forma: IdForma;
    definicaoForma?: ConfiguracaoForma['definicao'];
    contornoForma: EstiloContorno;
    preenchimentoForma: EstiloPreenchimento;
    parametrosForma: ParametrosForma;
    zoom: number;
    selecaoTransparente: boolean;
  };
  readonly selecao: Rect | null;
  readonly mascaraSelecao?: MascaraSelecao;
  readonly simetria?: ConfigSimetria;
  readonly travarAlfa?: boolean;
  readonly colagemFlutuante?: boolean;
  executar(comando: Comando): boolean;
  /** Balde: em papéis grandes, calcula a área num worker e executa quando ficar pronto. */
  preencher?(comando: Extract<Comando, { tipo: 'Preencher' }>): boolean;
  selecionar(area: Rect | null, mascara?: MascaraSelecao): void;
  capturarCor(ponto: Point, alvo?: 1 | 2): void;
  lerPixels(area: Rect): ImageData;
  /** Mostra um aviso na barra (ex.: seleção complexa demais). */
  avisar?(mensagem: string): void;
  previsualizarTraco(de: Point, ate: Point, estilo: EstiloTraco): void;
  iniciarPreviaPincel(configuracao: ConfiguracaoPincel): void;
  previsualizarMarcasPincel(marcas: readonly MarcaPincel[]): void;
  /** Prévia do dedo: um trecho já borrado (px do papel) vai para a tela. */
  previsualizarTrecho?(fonte: HTMLCanvasElement, area: Rect): void;
  prepararRecorte(area: Rect, mascara?: MascaraSelecao, transparente?: string): RecorteFlutuante;
  reposicionarColagem?(destino: Rect): void;
  confirmarColagem?(): void;
  previsualizarSelecao(origem: Rect | null, destino: Rect, recorte: RecorteFlutuante): void;
  limparPrevia(): void;
}

export interface Tool {
  id: ToolId;
  nome: string;
  icone: string;
  atalho?: string;
  opcoes?: ToolOptionsSchema;
  cursor(ctx: ToolCtx): string;
  onPointerDown(ctx: ToolCtx, evento: EventoFerramenta): void;
  onPointerMove(ctx: ToolCtx, evento: EventoFerramenta): void;
  onPointerUp(ctx: ToolCtx, evento: EventoFerramenta): void;
  onHover?(ctx: ToolCtx, evento: EventoFerramenta): boolean;
  onPointerLeave?(ctx: ToolCtx): boolean;
  onKeyDown?(ctx: ToolCtx, evento: KeyboardEvent): boolean;
  onCancel?(ctx: ToolCtx): void;
  overlay?(ctx: ToolCtx, grafico: CanvasRenderingContext2D): void;
  limitesOverlay?(ctx: ToolCtx): Rect | null;
  temPendente?(): boolean;
  obterFormaPendente?(ctx: ToolCtx): ConfiguracaoForma | null;
  descartarPendente?(): void;
  commitPendente?(ctx: ToolCtx): void;
  /** Formas inteligentes: recebe a forma reconhecida no traço como forma pendente. */
  adotarForma?(
    geometria: GeometriaForma,
    estilo: Partial<ConfiguracaoForma>,
    simetria?: ConfigSimetria,
  ): void;
  /** O ponto toca a forma pendente (alças ou dentro dela)? */
  tocaNaForma?(ctx: ToolCtx, ponto: Point): boolean;
}

type Identidade = Pick<Tool, 'id' | 'nome' | 'icone' | 'atalho' | 'opcoes'>;
type Comportamento = Omit<Tool, keyof Identidade>;

export type DefinicaoFerramenta = Readonly<Identidade> & { criar(): Tool };

/** Cada editor instancia suas ferramentas e mantém seus gestos isolados. */
export function definirFerramenta(
  identidade: Identidade,
  criarComportamento: () => Comportamento,
): DefinicaoFerramenta {
  return { ...identidade, criar: () => ({ ...identidade, ...criarComportamento() }) };
}

export function corDoBotao(ctx: ToolCtx, botao: number): string {
  return botao === 2 ? ctx.opcoes.cor2 : ctx.opcoes.cor1;
}

export const opcaoEspessura = {
  chave: 'espessura',
  tipo: 'numero',
  rotulo: 'Espessura do traço',
  min: 1,
  max: 100,
} as const;
