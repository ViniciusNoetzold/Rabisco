import type { ComandoAplicarFiltro } from '../commands/comandos';
import type { PixelBuffer } from '../layers/types';
import { obterFiltro } from './registro';

/** Executa em memória, com a mesma cobertura e alfa na prévia e no comando. */
export function processarFiltro(
  antes: PixelBuffer,
  comando: ComandoAplicarFiltro,
  cobertura?: Uint8ClampedArray,
  travarAlfa = false,
): PixelBuffer {
  const filtro = obterFiltro(comando.filtro);
  const depois = filtro.aplicar(antes, comando.parametros, comando.semente);
  if (
    depois.width !== antes.width ||
    depois.height !== antes.height ||
    depois.data.length !== antes.data.length
  ) {
    throw new Error('O filtro devolveu um recorte de tamanho diferente.');
  }
  if (depois === antes) return antes;
  if (!cobertura && !travarAlfa) return depois;

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
  return depois;
}
