/** Coordenadas no documento, independentes do zoom da interface. */
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ToolId =
  | 'pencil'
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'shape'
  | 'select'
  | 'lasso'
  | 'text'
  | 'zoom'
  | 'eyedropper'
  | 'move';

/** Forma mínima de ImageData, também utilizável em testes e workers. */
export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
