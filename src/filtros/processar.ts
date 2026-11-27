import type { ComandoAplicarFiltro } from '../commands/comandos';
import { recortarPixels } from '../commands/history';
import type { PixelBuffer, Rect } from '../layers/types';
import { obterFiltro } from './registro';

/** Executa em memória, com a mesma cobertura e alfa na prévia e no comando. */
export function processarFiltro(
  entrada: PixelBuffer,
  comando: ComandoAplicarFiltro,
  cobertura?: Uint8ClampedArray,
  travarAlfa = false,
  recorte?: Rect,
): { antes: PixelBuffer; depois: PixelBuffer } {
  const filtro = obterFiltro(comando.filtro);
  const filtrado = filtro.aplicar(entrada, comando.parametros, comando.semente);
  if (
    filtrado.width !== entrada.width ||
    filtrado.height !== entrada.height ||
    filtrado.data.length !== entrada.data.length
  ) {
    throw new Error('O filtro devolveu um recorte de tamanho diferente.');
  }
  // Filtros espaciais recebem a margem de vizinhos e a descartam antes de misturar a seleção.
  const antes = recorte ? recortarPixels(entrada, recorte) : entrada;
  if (filtrado === entrada) return { antes, depois: antes };
  const depois = recorte ? recortarPixels(filtrado, recorte) : filtrado;
  if (!cobertura && !travarAlfa) return { antes, depois };

  for (let pixel = 0, i = 0; i < antes.data.length; pixel++, i += 4) {
    const opacidade = cobertura ? cobertura[pixel] : 255;
    const alfaAntes = antes.data[i + 3];
    if (opacidade === 0 || (travarAlfa && alfaAntes === 0)) {
      for (let canal = 0; canal < 4; canal++) depois.data[i + canal] = antes.data[i + canal];
      continue;
    }
    if (travarAlfa) depois.data[i + 3] = alfaAntes;
    if (opacidade === 255) continue;

    // Mistura as bordas da seleção com alfa pré-multiplicado, como uma cobertura do canvas.
    const pesoAntes = alfaAntes * (255 - opacidade);
    const pesoDepois = depois.data[i + 3] * opacidade;
    const pesoTotal = pesoAntes + pesoDepois;
    for (let canal = 0; canal < 3; canal++) {
      const n = i + canal;
      depois.data[n] = pesoTotal
        ? (antes.data[n] * pesoAntes + depois.data[n] * pesoDepois) / pesoTotal
        : antes.data[n];
    }
    depois.data[i + 3] = pesoTotal / 255;
  }
  return { antes, depois };
}
