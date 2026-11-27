import { expect, it, vi } from 'vitest';
import type { EstiloTraco } from '../../src/commands/comandos';
import { areaDoSegmento, desenharSegmento } from '../../src/commands/desenho';

it('rasteriza o lápis pixel art em células de 1 px, com recorte justo e sem stroke suavizado', () => {
  const grafico = { save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), stroke: vi.fn() };
  const estilo: EstiloTraco = {
    ferramenta: 'pencil',
    cor: '#123456',
    espessura: 1,
    pixelArt: true,
  };
  const de = { x: 0.2, y: 0.4 };
  const ate = { x: 3.8, y: 2.1 };
  expect(areaDoSegmento(de, ate, estilo)).toEqual({ x: 0, y: 0, width: 4, height: 3 });
  desenharSegmento(grafico as unknown as CanvasRenderingContext2D, de, ate, estilo);
  expect(grafico.fillRect.mock.calls).toEqual([
    [0, 0, 1, 1],
    [1, 1, 1, 1],
    [2, 1, 1, 1],
    [3, 2, 1, 1],
  ]);
  expect(grafico.stroke).not.toHaveBeenCalled();
});
