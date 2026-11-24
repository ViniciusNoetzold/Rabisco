import type { Comando, EstiloTraco } from '../commands/comandos';
import type { MascaraSelecao, RecorteFlutuante } from '../document/selecao';
import type {
  ConfiguracaoPincel,
  DensidadeSpray,
  MarcaPincel,
  TipoPincel,
} from '../brushes/catalogo';
import type { Point, Rect, ToolId } from '../layers/types';
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
  readonly opcoes: {
    cor1: string;
    cor2: string;
    espessura: number;
    espessuraBorracha: number;
    toleranciaBorracha: number;
    toleranciaBalde: number;
    preenchimentoGlobal: boolean;
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
  readonly colagemFlutuante?: boolean;
  executar(comando: Comando): boolean;
  selecionar(area: Rect | null, mascara?: MascaraSelecao): void;
  capturarCor(ponto: Point, alvo?: 1 | 2): void;
  lerPixels(area: Rect): ImageData;
  previsualizarTraco(de: Point, ate: Point, estilo: EstiloTraco): void;
  iniciarPreviaPincel(configuracao: ConfiguracaoPincel): void;
  previsualizarMarcasPincel(marcas: readonly MarcaPincel[]): void;
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
