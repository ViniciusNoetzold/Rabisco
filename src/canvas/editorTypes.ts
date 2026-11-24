import type { PixelBuffer, Point, Rect } from '../layers/types';
import type { OpcoesExportacao } from '../io/imagens';
import type { OpcoesImpressao } from '../io/imprimir';
import type { OpcoesTransformacao, OrientacaoImagem } from '../commands/comandos';
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
}

export interface EditorApi {
  undo(): void;
  redo(): void;
  save(): Promise<void>;
  salvarComo(opcoes: OpcoesExportacao): Promise<void>;
  imprimir(opcoes: OpcoesImpressao): Promise<void>;
  open(file: File): Promise<void>;
  newDocument(name: string, width: number, height: number): void;
  selectAll(): void;
  inverterSelecao(): void;
  deleteSelection(): void;
  crop(): void;
  copy(cut?: boolean): Promise<void>;
  paste(): Promise<void>;
  colarImagem(pixels: PixelBuffer, aumentar?: boolean): void;
  colarCopiaIgual(pixels: PixelBuffer): Promise<boolean>;
  fit(): void;
  redimensionarPapel(largura: number, altura: number, fundo?: string, dpi?: number): void;
  transformarImagem(opcoes: OpcoesTransformacao): void;
  girarImagem(orientacao: OrientacaoImagem): void;
  tecla(evento: KeyboardEvent): boolean;
  obterReferenciaForma(): Omit<DadosFormaPropria, 'pasta'> | null;
}

export interface CanvasCallbacks {
  onChange(info: DocumentInfo): void;
  onMessage(message: string): void;
  onCursor(point: Point | null): void;
  onPreviewSize?(tamanho: { width: number; height: number } | null): void;
  revisaoMiniatura?: unknown;
  telaInteira?: boolean;
}
