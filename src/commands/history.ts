import type { PixelBuffer, Rect } from '../layers/types';
import type { Comando } from './comandos';

interface DadosHistorico {
  label: string;
  before: PixelBuffer;
  after: PixelBuffer;
  rect: Rect | null;
}

export interface EntradaComando extends DadosHistorico {
  comando: Comando;
  camada: string;
  dpi?: { antes: number; depois: number };
  apenasDpi?: boolean;
}

function clone(image: PixelBuffer): PixelBuffer {
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

export function recortarPixels(image: PixelBuffer, rect: Rect): PixelBuffer {
  const data = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row++) {
    const offset = ((rect.y + row) * image.width + rect.x) * 4;
    data.set(image.data.subarray(offset, offset + rect.width * 4), row * rect.width * 4);
  }
  return { width: rect.width, height: rect.height, data };
}

/** O orçamento de pixels inclui as pilhas de desfazer e refazer. */
class PilhaHistorico<Entrada extends DadosHistorico> {
  private undoStack: Entrada[] = [];
  private redoStack: Entrada[] = [];
  private bytes = 0;
  private readonly maxBytes: number;

  constructor(
    maxBytes = 128 * 1024 * 1024,
    private readonly manterUltima = false,
  ) {
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

  protected registrar(entrada: Entrada): void {
    for (const descartada of this.redoStack) this.bytes -= this.custo(descartada);
    this.redoStack = [];
    this.undoStack.push(entrada);
    this.bytes += this.custo(entrada);
    const minimo = this.manterUltima ? 1 : 0;
    while (this.bytes > this.maxBytes && this.undoStack.length > minimo) {
      this.bytes -= this.custo(this.undoStack.shift()!);
    }
  }

  protected tirarParaDesfazer(): Entrada | null {
    const entrada = this.undoStack.pop();
    if (!entrada) return null;
    this.redoStack.push(entrada);
    return entrada;
  }

  protected tirarParaRefazer(): Entrada | null {
    const entrada = this.redoStack.pop();
    if (!entrada) return null;
    this.undoStack.push(entrada);
    return entrada;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
  }

  private custo(entrada: Entrada): number {
    return entrada.before.data.byteLength + entrada.after.data.byteLength;
  }
}

/** O executor entrega a área e os pixels próprios do comando, sem varrer o papel. */
export class HistoricoComandos extends PilhaHistorico<EntradaComando> {
  constructor(maxBytes?: number) {
    // Uma transformação de papel grande precisa continuar reversível.
    super(maxBytes, true);
  }

  registrarComando(entrada: EntradaComando): void {
    this.registrar(entrada);
  }

  desfazer(): EntradaComando | null {
    return this.tirarParaDesfazer();
  }

  refazer(): EntradaComando | null {
    return this.tirarParaRefazer();
  }
}

/** Compatibilidade com o histórico de buffers completos da versão 0.1. */
export class PixelHistory extends PilhaHistorico<DadosHistorico> {
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
    this.registrar({
      label,
      before: rect ? recortarPixels(before, rect) : clone(before),
      after: rect ? recortarPixels(after, rect) : clone(after),
      rect,
    });
    return true;
  }

  undo(current: PixelBuffer): PixelBuffer | null {
    const entry = this.tirarParaDesfazer();
    if (!entry) return null;
    return this.apply(current, entry.before, entry.rect);
  }

  redo(current: PixelBuffer): PixelBuffer | null {
    const entry = this.tirarParaRefazer();
    if (!entry) return null;
    return this.apply(current, entry.after, entry.rect);
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
