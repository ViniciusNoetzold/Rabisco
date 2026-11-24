import { describe, expect, it } from 'vitest';
import { PixelHistory } from '../../src/commands/history';
import type { PixelBuffer } from '../../src/layers/types';

const blank = (width = 4, height = 4): PixelBuffer => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
});
const edit = (image: PixelBuffer, pixel: number, red: number): PixelBuffer => {
  const next = { ...image, data: new Uint8ClampedArray(image.data) };
  next.data.set([red, 0, 0, 255], pixel * 4);
  return next;
};

describe('histórico de pixels', () => {
  it('desfaz/refaz sem manter referências mutáveis ao documento', () => {
    const history = new PixelHistory();
    const first = blank();
    const second = edit(first, 5, 123);
    history.push(first, second, 'Pincel');
    second.data.fill(0);
    const restored = history.redo(history.undo(second)!);
    expect(restored?.data[20]).toBe(123);
    expect(history.entries).toEqual([{ label: 'Pincel' }]);
    restored!.data.fill(0);
    expect(history.redo(history.undo(restored!)!)?.data[20]).toBe(123);
  });

  it('descarta a ramificação de refazer após novo comando', () => {
    const history = new PixelHistory();
    const a = blank();
    const b = edit(a, 0, 100);
    const c = edit(b, 1, 200);
    history.push(a, b, 'A');
    history.push(b, c, 'B');
    const back = history.undo(c)!;
    const d = edit(back, 2, 50);
    history.push(back, d, 'C');
    expect(history.canRedo).toBe(false);
    expect(history.entries).toEqual([{ label: 'A' }, { label: 'C' }]);
    expect(history.undo(d)?.data).toEqual(b.data);
  });

  it('ignora comandos vazios e preserva refazer', () => {
    const history = new PixelHistory();
    const a = blank();
    const b = edit(a, 0, 100);
    expect(history.push(a, a, 'Vazio')).toBe(false);
    history.push(a, b, 'Desenho');
    history.undo(b);
    expect(history.push(a, a, 'Vazio')).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  it('armazena apenas o retângulo alterado e elimina comandos antigos no limite', () => {
    const history = new PixelHistory(16);
    const a = blank(100, 100);
    const b = edit(a, 0, 10);
    const c = edit(b, 1, 20);
    const d = edit(c, 2, 30);
    history.push(a, b, 'A');
    expect(history.memoryBytes).toBe(8);
    history.push(b, c, 'B');
    history.push(c, d, 'C');
    expect(history.memoryBytes).toBe(16);
    expect(history.entries).toEqual([{ label: 'B' }, { label: 'C' }]);
    expect(history.undo(history.undo(d)!)?.data).toEqual(b.data);
    expect(history.canUndo).toBe(false);
  });

  it('restaura dimensões em comandos que substituem o documento', () => {
    const history = new PixelHistory();
    const a = blank(2, 2);
    const b = edit(blank(3, 5), 14, 220);
    history.push(a, b, 'Abrir imagem');
    expect(history.undo(b)).toEqual(a);
    expect(history.redo(a)).toEqual(b);
    history.clear();
    expect(history.memoryBytes).toBe(0);
    expect(history.undo(b)).toBeNull();
    expect(history.redo(b)).toBeNull();
  });

  it('permanece no orçamento mesmo quando um comando é maior que o limite', () => {
    const history = new PixelHistory(4);
    const a = blank();
    expect(history.push(a, edit(a, 0, 1), 'Grande')).toBe(true);
    expect(history.memoryBytes).toBe(0);
    expect(history.canUndo).toBe(false);
  });
});
