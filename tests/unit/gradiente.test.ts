import { describe, expect, it } from 'vitest';
import { corNoGradiente, fatorDoGradiente } from '../../src/tools/gradiente';

const inicio = { x: 100, y: 100 };
const fim = { x: 300, y: 100 };

describe('gradiente', () => {
  it('linear: fator pela projeção na reta, preso entre 0 e 1', () => {
    expect(fatorDoGradiente('linear', inicio, fim, { x: 100, y: 50 })).toBe(0);
    expect(fatorDoGradiente('linear', inicio, fim, { x: 200, y: 400 })).toBe(0.5);
    expect(fatorDoGradiente('linear', inicio, fim, { x: 350, y: 100 })).toBe(1);
    expect(fatorDoGradiente('linear', inicio, fim, { x: 0, y: 100 })).toBe(0);
  });

  it('radial: fator pela distância ao início, com raio até o fim', () => {
    expect(fatorDoGradiente('radial', inicio, fim, { x: 100, y: 100 })).toBe(0);
    expect(fatorDoGradiente('radial', inicio, fim, { x: 100, y: 200 })).toBe(0.5);
    expect(fatorDoGradiente('radial', inicio, fim, { x: 100, y: 400 })).toBe(1);
    // Início e fim no mesmo ponto: tudo na Cor 1.
    expect(fatorDoGradiente('radial', inicio, inicio, { x: 0, y: 0 })).toBe(0);
  });

  it('mistura as cores; "até transparente" mantém a Cor 1 e some o alfa', () => {
    expect(corNoGradiente('#000000', '#ffffff', 0)).toEqual([0, 0, 0, 1]);
    expect(corNoGradiente('#000000', '#ffffff', 0.5)).toEqual([128, 128, 128, 1]);
    expect(corNoGradiente('#ff0000', '#0000ff', 1)).toEqual([0, 0, 255, 1]);
    expect(corNoGradiente('#3083c5', '#ffffff', 0.5, true)).toEqual([48, 131, 197, 0.5]);
  });
});
