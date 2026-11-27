import { caminhoDaSelecao, type MascaraSelecao } from '../document/selecao';
import type { Rect } from '../layers/types';

/** Rasteriza o laço, a elipse ou a varinha na área do filtro, com um byte por pixel. */
export function coberturaDaSelecao(area: Rect, mascara: MascaraSelecao): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(-area.x, -area.y);
  ctx.fill(caminhoDaSelecao(area, mascara), 'evenodd');
  const dados = ctx.getImageData(0, 0, area.width, area.height).data;
  const cobertura = new Uint8ClampedArray(area.width * area.height);
  for (let i = 0; i < cobertura.length; i++) cobertura[i] = dados[i * 4 + 3];
  return cobertura;
}
