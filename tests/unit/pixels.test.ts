import { describe, expect, it } from 'vitest';
import { clearRectPixels, floodFill, normalizeRect, parseHexColor } from '../../src/tools/pixels';
import type { PixelBuffer } from '../../src/layers/types';

function image(width: number, height: number, color = '#ffffff'): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set(parseHexColor(color), offset);
  return { width, height, data };
}

describe('operações de pixels', () => {
  it('interpreta RGB/RGBA e rejeita cores malformadas', () => {
    expect(parseHexColor('#0aF')).toEqual([0, 170, 255, 255]);
    expect(parseHexColor('#0123')).toEqual([0, 17, 34, 51]);
    expect(parseHexColor('#12345680')).toEqual([18, 52, 86, 128]);
    expect(() => parseHexColor('#12')).toThrow();
  });

  it('o balde respeita barreiras e bordas e não conecta diagonais', () => {
    const buffer = image(3, 3);
    for (const pixel of [1, 3, 5, 7]) buffer.data.set([0, 0, 0, 255], pixel * 4);
    expect(floodFill(buffer, 0, 0, '#ff0000')).toBe(true);
    expect([...buffer.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...buffer.data.slice(16, 20)]).toEqual([255, 255, 255, 255]);
    expect(floodFill(buffer, -1, 0, '#000')).toBe(false);
    expect(floodFill(buffer, 3, 3, '#000')).toBe(false);
  });

  it('compara tolerância com o pixel inicial, incluindo alfa', () => {
    const buffer = image(4, 1, '#646464');
    buffer.data.set([108, 100, 100, 255], 4);
    buffer.data.set([116, 100, 100, 255], 8);
    buffer.data.set([100, 100, 100, 200], 12);
    floodFill(buffer, 0, 0, '#f00', 10);
    expect([...buffer.data.slice(4, 8)]).toEqual([255, 0, 0, 255]);
    expect(buffer.data[8]).toBe(116);
    expect(buffer.data[15]).toBe(200);
  });

  it('preenche áreas grandes sem recursão e detecta operação vazia', () => {
    const buffer = image(600, 500);
    expect(floodFill(buffer, 599, 499, '#fff')).toBe(false);
    expect(floodFill(buffer, 599, 499, '#102030')).toBe(true);
    expect([...buffer.data.slice(0, 4)]).toEqual([16, 32, 48, 255]);
    expect([...buffer.data.slice(-4)]).toEqual([16, 32, 48, 255]);
  });

  it('termina quando a cor de destino ainda pertence à tolerância', () => {
    const buffer = image(20, 20, '#646464');
    expect(floodFill(buffer, 10, 10, '#656565', 4)).toBe(true);
    expect(buffer.data[0]).toBe(101);
  });

  it('normaliza gesto inverso e limita o retângulo ao documento', () => {
    expect(normalizeRect({ x: 12, y: 11 }, { x: -4, y: 3 }, { width: 10, height: 8 })).toEqual({
      x: 0,
      y: 3,
      width: 10,
      height: 5,
    });
  });

  it('apaga somente a seleção limitada, preservando pixels externos', () => {
    const buffer = image(3, 3);
    clearRectPixels(buffer, { x: 1, y: 1, width: 5, height: 5 });
    expect([...buffer.data.slice(16, 20)]).toEqual([0, 0, 0, 0]);
    expect([...buffer.data.slice(0, 4)]).toEqual([255, 255, 255, 255]);
    expect([...buffer.data.slice(-4)]).toEqual([0, 0, 0, 0]);
  });
});
