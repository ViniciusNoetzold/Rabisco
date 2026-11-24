import type { Comando, EstiloTraco } from '../commands/comandos';
import type {
  ConfiguracaoPincel,
  DensidadeSpray,
  MarcaPincel,
  TipoPincel,
} from '../brushes/catalogo';
import type { Point, Rect, ToolId } from '../layers/types';

export type { EstiloTraco } from '../commands/comandos';

export interface EventoFerramenta {
  ponto: Point;
  botao: number;
  shift: boolean;
}

export type ToolOptionsSchema = readonly (
  | { chave: 'espessura'; tipo: 'numero'; rotulo: string; min: number; max: number }
  | { chave: 'preenchida'; tipo: 'booleano'; rotulo: string }
)[];

export interface ToolCtx {
  readonly largura: number;
  readonly altura: number;
  readonly opcoes: {
    cor1: string;
    cor2: string;
    espessura: number;
    preenchida: boolean;
    pincel: TipoPincel;
    densidadeSpray: DensidadeSpray;
  };
  readonly selecao: Rect | null;
  executar(comando: Comando): boolean;
  selecionar(area: Rect | null): void;
  capturarCor(ponto: Point): void;
  lerPixels(area: Rect): ImageData;
  previsualizarTraco(de: Point, ate: Point, estilo: EstiloTraco): void;
  iniciarPreviaPincel(configuracao: ConfiguracaoPincel): void;
  previsualizarMarcasPincel(marcas: readonly MarcaPincel[]): void;
  previsualizarSelecao(origem: Rect, destino: Rect, imagem: ImageData): void;
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
  onKeyDown?(ctx: ToolCtx, evento: KeyboardEvent): boolean;
  onCancel?(ctx: ToolCtx): void;
  overlay?(ctx: ToolCtx, grafico: CanvasRenderingContext2D): void;
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
