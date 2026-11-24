import { describe, expect, it } from 'vitest';
import {
  areaDeZoom,
  formatarZoom,
  indiceDoZoom,
  limitarZoom,
  nivelSeguinte,
} from '../../src/canvas/zoom';

describe('zoom do papel', () => {
  it('avança por níveis fixos também depois de ajustar o papel à janela', () => {
    expect(nivelSeguinte(0.76, 1)).toBe(1);
    expect(nivelSeguinte(0.76, -1)).toBe(0.5);
    expect(nivelSeguinte(1, 1)).toBe(2);
    expect(nivelSeguinte(4, -1)).toBe(3);
    expect(nivelSeguinte(0.125, -1)).toBe(0.125);
    expect(nivelSeguinte(8, 1)).toBe(8);
  });

  it('limita e apresenta as escalas incluindo a fração em português', () => {
    expect(limitarZoom(0.02)).toBe(0.125);
    expect(limitarZoom(100)).toBe(8);
    expect(limitarZoom(NaN)).toBe(1);
    expect(indiceDoZoom(0.76)).toBe(3);
    expect(indiceDoZoom(2.8)).toBe(5);
    expect(formatarZoom(0.125)).toBe('12,5%');
  });

  it('calcula a região da lupa no nível de destino e respeita o papel', () => {
    const tela = { width: 600, height: 400 };
    const papel = { width: 1000, height: 640 };
    expect(areaDeZoom({ x: 510, y: 320 }, tela, papel, 2)).toEqual({
      x: 360,
      y: 220,
      width: 300,
      height: 200,
    });
    expect(areaDeZoom({ x: 5, y: 630 }, tela, papel, 2)).toEqual({
      x: 0,
      y: 440,
      width: 300,
      height: 200,
    });
    expect(areaDeZoom({ x: 5, y: 630 }, tela, papel, 0.125)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 640,
    });
  });
});
