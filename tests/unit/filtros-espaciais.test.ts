import { describe, expect, it } from 'vitest';
import {
  adicionarRuido,
  aplicarRelevo,
  desfoqueGaussiano,
  desfoqueMovimento,
  detectarBordas,
  mascaraNitidez,
  reduzirRuidoMediana,
} from '../../src/filtros/espaciais';
import type { PixelBuffer } from '../../src/layers/types';

function imagem(
  width: number,
  height: number,
  cor: (x: number, y: number) => number[],
): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(cor(x, y), (y * width + x) * 4);
  return { width, height, data };
}

function faixa(...pixels: number[][]): PixelBuffer {
  return imagem(pixels.length, 1, (x) => pixels[x]);
}

function pixel(buffer: PixelBuffer, x: number, y = 0) {
  const i = (y * buffer.width + x) * 4;
  return [...buffer.data.subarray(i, i + 4)];
}

describe('filtros espaciais', () => {
  it('desfoque gaussiano distribui um pulso na borda e conserva sua soma', () => {
    const entrada = imagem(8, 1, (x) => [x === 0 ? 255 : 0, 0, 0, 255]);
    const filtrada = desfoqueGaussiano(entrada, { raio: 1 });
    expect(pixel(filtrada, 0)).toEqual([228, 0, 0, 255]);
    expect(pixel(filtrada, 1)).toEqual([27, 0, 0, 255]);
    const vermelhos = filtrada.data.filter((_, i) => i % 4 === 0);
    expect(vermelhos.reduce((soma, valor) => soma + valor, 0)).toBe(255);
    expect(pixel(entrada, 0)).toEqual([255, 0, 0, 255]);
    expect(desfoqueGaussiano(entrada, { raio: 0 })).toBe(entrada);
  });

  it('desfoca um recorte com margens como o papel inteiro, inclusive entre faixas', () => {
    const entrada = imagem(15, 18, (x, y) => [
      x * 13,
      y * 11,
      (x * y * 7) % 256,
      127 + ((x * y) % 128),
    ]);
    const recorte = imagem(10, 12, (x, y) => pixel(entrada, x + 3, y + 2));
    const inteiro = desfoqueGaussiano(entrada, { raio: 2 });
    const parte = desfoqueGaussiano(recorte, { raio: 2 });
    for (let y = 2; y < 10; y++)
      for (let x = 2; x < 8; x++) expect(pixel(parte, x, y)).toEqual(pixel(inteiro, x + 3, y + 2));
  });

  it('preserva a cor visível quando o desfoque gaussiano recebe RGB transparente', () => {
    const entrada = faixa([224, 45, 59, 255], [19, 205, 234, 0], [0, 0, 0, 0]);
    const filtrada = desfoqueGaussiano(entrada, { raio: 1 });
    expect(pixel(filtrada, 0)).toEqual([224, 45, 59, 228]);
    expect(pixel(filtrada, 1)).toEqual([224, 45, 59, 27]);
    expect(pixel(filtrada, 2)).toEqual([0, 0, 0, 0]);
  });

  it('desfoque de movimento espalha cor e alfa no ângulo escolhido', () => {
    const entrada = imagem(3, 3, (x, y) =>
      x === 1 && y === 1 ? [255, 85, 10, 255] : [0, 200, 0, 0],
    );
    const filtrada = desfoqueMovimento(entrada, { raio: 1, angulo: 90 });
    expect(pixel(filtrada, 1, 0)).toEqual([255, 85, 10, 85]);
    expect(pixel(filtrada, 1, 2)).toEqual([255, 85, 10, 85]);
    expect(pixel(filtrada, 0, 1)).toEqual([0, 0, 0, 0]);
  });

  it('reforça o contraste local com nitidez e mantém o alfa', () => {
    const entrada = faixa([128, 128, 128, 255], [150, 150, 150, 121], [128, 128, 128, 255]);
    const filtrada = mascaraNitidez(entrada, { raio: 1, intensidade: 100 });
    expect(pixel(filtrada, 1)[0]).toBeGreaterThan(150);
    expect(pixel(filtrada, 0)[0]).toBeLessThan(128);
    expect(pixel(filtrada, 1)[3]).toBe(121);
  });

  it('aplica ruído determinístico pela semente e conserva os canais de uma imagem cinza', () => {
    const entrada = imagem(6, 4, () => [128, 128, 128, 170]);
    const filtrada = adicionarRuido(entrada, {}, 17);
    expect(filtrada).toEqual(adicionarRuido(entrada, {}, 17));
    expect(filtrada).not.toEqual(adicionarRuido(entrada, {}, 18));
    const [r, g, b, a] = pixel(filtrada, 3, 2);
    expect([g, b, a]).toEqual([r, r, 170]);
    expect(pixel(entrada, 3, 2)).toEqual([128, 128, 128, 170]);
  });

  it('a mediana remove um ponto isolado e pondera as amostras pelo alfa', () => {
    const entrada = faixa([200, 100, 50, 200], [0, 0, 0, 10], [250, 0, 250, 0]);
    const filtrada = reduzirRuidoMediana(entrada, {});
    expect(pixel(filtrada, 0)).toEqual([200, 100, 50, 200]);
    expect(pixel(filtrada, 1)).toEqual([200, 100, 50, 10]);
    expect(pixel(filtrada, 2)).toEqual([250, 0, 250, 0]);
  });

  it('Sobel detecta o contraste entre cores e o relevo parte de cinza neutro', () => {
    const entrada = faixa(
      [0, 0, 0, 255],
      [0, 0, 0, 255],
      [255, 255, 255, 255],
      [255, 255, 255, 255],
    );
    const bordas = detectarBordas(entrada, {});
    expect([0, 1, 2, 3].map((x) => pixel(bordas, x)[0])).toEqual([0, 255, 255, 0]);
    const relevo = aplicarRelevo(entrada, {});
    expect([0, 1, 2, 3].map((x) => pixel(relevo, x)[0])).toEqual([128, 255, 255, 128]);
  });

  it('Sobel e relevo ignoram as cores escondidas atrás de transparência', () => {
    const entrada = faixa([180, 100, 120, 120], [0, 240, 90, 0]);
    expect(pixel(detectarBordas(entrada, {}), 0)).toEqual([0, 0, 0, 120]);
    expect(pixel(aplicarRelevo(entrada, {}), 0)).toEqual([128, 128, 128, 120]);
  });
});
