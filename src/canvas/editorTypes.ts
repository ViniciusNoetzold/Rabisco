import type { Point, Rect } from '../layers/types';

export interface DocumentInfo {
  name: string;
  width: number;
  height: number;
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
  open(file: File): Promise<void>;
  newDocument(name: string, width: number, height: number): void;
  selectAll(): void;
  deleteSelection(): void;
  crop(): void;
  copy(cut?: boolean): Promise<void>;
  paste(): Promise<void>;
  fit(): void;
  tecla(evento: KeyboardEvent): boolean;
}

export interface CanvasCallbacks {
  onChange(info: DocumentInfo): void;
  onMessage(message: string): void;
  onCursor(point: Point | null): void;
}
