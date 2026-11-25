import type { PixelBuffer, Point, Rect } from '../layers/types';
import type { OpcoesExportacao } from '../io/imagens';
import type { OpcoesImpressao } from '../io/imprimir';
import type {
  Comando,
  ComandoCamada,
  OpcoesTransformacao,
  OrientacaoImagem,
} from '../commands/comandos';
import type { EstruturaDocumento } from '../document/camadas';
import type { DadosFormaPropria } from '../shapes/presets';

export interface DocumentInfo {
  name: string;
  width: number;
  height: number;
  dpi: number;
  canUndo: boolean;
  canRedo: boolean;
  history: { label: string }[];
  selection: Rect | null;
  saving: 'loading' | 'saving' | 'saved' | 'error';
  /** Camadas, grupos e camada ativa, para o painel Camadas. */
  estrutura: EstruturaDocumento;
  /** Cresce a cada edição: o painel usa para atualizar as miniaturas. */
  revisao: number;
}

export interface EditorApi {
  undo(): void;
  redo(): void;
  save(): Promise<void>;
  salvarComo(opcoes: OpcoesExportacao): Promise<void>;
  salvarRabisco(): Promise<void>;
  imprimir(opcoes: OpcoesImpressao): Promise<void>;
  open(file: File): Promise<void>;
  newDocument(name: string, width: number, height: number): void;
  selectAll(): void;
  inverterSelecao(): void;
  deleteSelection(): void;
  crop(): void;
  copy(cut?: boolean): Promise<void>;
  paste(): Promise<void>;
  colarImagem(pixels: PixelBuffer, aumentar?: boolean, nomeCamada?: string): void;
  colarCopiaIgual(pixels: PixelBuffer): Promise<boolean>;
  fit(): void;
  redimensionarPapel(largura: number, altura: number, fundo?: string, dpi?: number): void;
  transformarImagem(opcoes: OpcoesTransformacao): void;
  girarImagem(orientacao: OrientacaoImagem): void;
  tecla(evento: KeyboardEvent): boolean;
  obterReferenciaForma(): Omit<DadosFormaPropria, 'pasta'> | null;
  executarCamada(comando: ComandoCamada | Extract<Comando, { tipo: 'Lote' }>): boolean;
  novaCamada(): boolean;
  agruparAtiva(): boolean;
  alinharAtiva(lado: 'esquerda' | 'centro-h' | 'direita' | 'topo' | 'centro-v' | 'base'): boolean;
  copiarMesclado(): Promise<void>;
  adicionarMascara(id: string): boolean;
  importarComoCamada(pixels: PixelBuffer, nome: string): boolean;
  ativarCamada(id: string, mascara?: boolean): void;
  miniatura(id: string, destino: HTMLCanvasElement, mascara?: boolean): void;
}

export interface CanvasCallbacks {
  onChange(info: DocumentInfo): void;
  onMessage(message: string): void;
  onCursor(point: Point | null): void;
  onPreviewSize?(tamanho: { width: number; height: number } | null): void;
  revisaoMiniatura?: unknown;
  telaInteira?: boolean;
}
