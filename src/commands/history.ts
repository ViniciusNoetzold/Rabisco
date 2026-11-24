import type { PixelBuffer, Rect } from '../layers/types';

interface HistoryEntry {
  label: string;
  before: PixelBuffer;
  after: PixelBuffer;
  rect: Rect | null;
  bytes: number;
}

function clone(image: PixelBuffer): PixelBuffer {
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

function extract(image: PixelBuffer, rect: Rect): PixelBuffer {
  const data = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row++) {
    const offset = ((rect.y + row) * image.width + rect.x) * 4;
    data.set(image.data.subarray(offset, offset + rect.width * 4), row * rect.width * 4);
  }
  return { width: rect.width, height: rect.height, data };
}

/**
 * Histórico por retângulos de pixels alterados. O limite inclui desfazer e
 * refazer; comandos mais antigos saem primeiro para manter a memória limitada.
 */
export class PixelHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private bytes = 0;
  private readonly maxBytes: number;

  constructor(maxBytes = 128 * 1024 * 1024) {
    this.maxBytes = Math.max(0, maxBytes);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  get memoryBytes(): number {
    return this.bytes;
  }
  get entries(): { label: string }[] {
    return this.undoStack.map(({ label }) => ({ label }));
  }

  push(before: PixelBuffer, after: PixelBuffer, label: string): boolean {
    let rect: Rect | null = null;
    if (before.width === after.width && before.height === after.height) {
      let left = before.width;
      let top = before.height;
      let right = -1;
      let bottom = -1;
      for (let pixel = 0; pixel < before.width * before.height; pixel++) {
        const offset = pixel * 4;
        if (
          before.data[offset] === after.data[offset] &&
          before.data[offset + 1] === after.data[offset + 1] &&
          before.data[offset + 2] === after.data[offset + 2] &&
          before.data[offset + 3] === after.data[offset + 3]
        )
          continue;
        const x = pixel % before.width;
        const y = Math.floor(pixel / before.width);
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
      if (right < 0) return false;
      rect = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    }
    const prior = rect ? extract(before, rect) : clone(before);
    const next = rect ? extract(after, rect) : clone(after);
    const entry = {
      label,
      before: prior,
      after: next,
      rect,
      bytes: prior.data.byteLength + next.data.byteLength,
    };
    for (const discarded of this.redoStack) this.bytes -= discarded.bytes;
    this.redoStack = [];
    this.undoStack.push(entry);
    this.bytes += entry.bytes;
    while (this.bytes > this.maxBytes && this.undoStack.length) {
      this.bytes -= this.undoStack.shift()!.bytes;
    }
    return true;
  }

  undo(current: PixelBuffer): PixelBuffer | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return this.apply(current, entry.before, entry.rect);
  }

  redo(current: PixelBuffer): PixelBuffer | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return this.apply(current, entry.after, entry.rect);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
  }

  private apply(current: PixelBuffer, patch: PixelBuffer, rect: Rect | null): PixelBuffer {
    if (!rect) return clone(patch);
    const result = clone(current);
    for (let row = 0; row < rect.height; row++) {
      const offset = ((rect.y + row) * current.width + rect.x) * 4;
      result.data.set(
        patch.data.subarray(row * rect.width * 4, (row + 1) * rect.width * 4),
        offset,
      );
    }
    return result;
  }
}
