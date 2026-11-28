import { describe, expect, it } from 'vitest';
import { efeitoCrt, meioTom, mosaico, pontilhismo, vitral } from '../../src/filtros/estilos';
import type { PixelBuffer } from '../../src/layers/types';

function imagem(
  width: number,
  height: number,
  cor: (x: number, y: number) => number[],
): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(cor(x, y), (y * width + x) * 4);
  }
  return { width, height, data };
}

function pixel(imagem: PixelBuffer, x: number, y: number) {
  const i = (y * imagem.width + x) * 4;
  return [...imagem.data.subarray(i, i + 4)];
}

describe('estilos artísticos', () => {
  it('meio-tom desenha pontos da tinta escolhida no ângulo da retícula', () => {
    const entrada = imagem(12, 8, () => [128, 128, 128, 170]);
    const parametros = { modo: 'mono', tamanho: 4, angulo: 0, cor: '#9c2200' };
    const filtrada = meioTom(entrada, parametros);
    expect(pixel(filtrada, 1, 1)).toEqual([156, 34, 0, 170]);
    expect(pixel(filtrada, 0, 0)).toEqual([255, 255, 255, 170]);
    expect(filtrada).not.toEqual(meioTom(entrada, { ...parametros, angulo: 45 }));
  });

  it('meio-tom CMYK mantém branco, preto e primárias em tintas plenas', () => {
    const cores = [
      [255, 255, 255, 150],
      [0, 0, 0, 200],
      [255, 0, 0, 255],
      [0, 255, 255, 255],
    ];
    const entrada = imagem(cores.length, 1, (x) => cores[x]);
    expect(meioTom(entrada, { modo: 'cmyk' })).toEqual(entrada);
  });

  it('mosaico usa a média visível da peça e pinta as juntas', () => {
    const cores = [
      [200, 0, 0, 255],
      [0, 200, 0, 255],
      [80, 120, 200, 0],
      [0, 0, 200, 255],
    ];
    const entrada = imagem(2, 2, (x, y) => cores[y * 2 + x]);
    const filtrada = mosaico(entrada, { tamanho: 2, junta: 1, corJuntas: '#503214' });
    expect(pixel(filtrada, 0, 0)).toEqual([80, 50, 20, 255]);
    expect(pixel(filtrada, 0, 1)).toEqual([80, 120, 200, 0]);
    expect(pixel(filtrada, 1, 1)).toEqual([67, 67, 67, 255]);
    expect(pixel(entrada, 1, 1)).toEqual([0, 0, 200, 255]);
  });

  it('pontilhismo repete os pontos da semente sobre o fundo claro', () => {
    const entrada = imagem(24, 24, () => [10, 80, 130, 190]);
    const parametros = { densidade: 100, tamanho: 6 };
    const filtrada = pontilhismo(entrada, parametros, 22);
    expect(filtrada).toEqual(pontilhismo(entrada, parametros, 22));
    expect(filtrada).not.toEqual(pontilhismo(entrada, parametros, 23));
    const vermelhos = filtrada.data.filter((_, i) => i % 4 === 0);
    expect(vermelhos).toContain(10);
    expect(vermelhos).toContain(250);
  });

  it('vitral repete a distribuição e a cor dos centros de Voronoi com semente fixa', () => {
    const entrada = imagem(24, 17, (x, y) => [x * 10, y * 10, (x + y) * 6, 210]);
    const parametros = { tamanho: 5, borda: 2 };
    const filtrada = vitral(entrada, parametros, 42);
    expect(filtrada).toEqual(vitral(entrada, parametros, 42));
    expect(filtrada).not.toEqual(vitral(entrada, parametros, 13));
    expect(filtrada).not.toEqual(vitral(entrada, { ...parametros, borda: 0 }, 42));
    expect(filtrada.data.filter((_, i) => i % 4 === 3)).toEqual(
      entrada.data.filter((_, i) => i % 4 === 3),
    );
  });

  it('CRT desloca vermelho e azul e escurece cada linha de varredura', () => {
    const entrada = imagem(3, 2, (x) => [20 + 30 * x, 30 + 30 * x, 40 + 30 * x, 180]);
    entrada.data[3] = 255;
    entrada.data[11] = 255;
    entrada.data[15] = 255;
    entrada.data[23] = 255;
    const filtrada = efeitoCrt(entrada, { periodo: 2, linhas: 50, separacao: 1 });
    expect(pixel(filtrada, 1, 0)).toEqual([20, 60, 100, 180]);
    expect(pixel(filtrada, 1, 1)).toEqual([10, 30, 50, 180]);
  });

  it('os estilos preservam o alfa e o RGB invisível em camadas transparentes', () => {
    const entrada = imagem(17, 17, (x, y) => [230, 24, 110, (x + y) % 3 ? 255 : 0]);
    const alfa = entrada.data.filter((_, i) => i % 4 === 3);
    for (const filtro of [meioTom, mosaico, pontilhismo, vitral, efeitoCrt]) {
      const filtrada = filtro(entrada, {});
      expect(filtrada.data.filter((_, i) => i % 4 === 3)).toEqual(alfa);
      expect(pixel(filtrada, 0, 0)).toEqual([230, 24, 110, 0]);
    }
    const borda = imagem(2, 1, (x) => (x ? [60, 80, 100, 255] : [255, 0, 0, 0]));
    expect(pixel(efeitoCrt(borda, { separacao: 1, linhas: 0 }), 1, 0)).toEqual([60, 80, 100, 255]);
  });
});
