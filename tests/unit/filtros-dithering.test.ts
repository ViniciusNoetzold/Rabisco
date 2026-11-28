import { describe, expect, it } from 'vitest';
import { dithering, OPCOES_DITHERING } from '../../src/filtros/dithering';
import { paletaDoDesenho } from '../../src/filtros/pixelArt';

function imagem(width: number, ...pixels: readonly number[][]) {
  return { width, height: pixels.length / width, data: new Uint8ClampedArray(pixels.flat()) };
}

function cinza(width: number, height: number, valor: number) {
  return imagem(width, ...Array.from({ length: width * height }, () => [valor, valor, valor, 255]));
}

function canaisVermelhos(data: Uint8ClampedArray) {
  return Array.from(data.filter((_, i) => i % 4 === 0));
}

describe('dithering', () => {
  it('gera o padrão Bayer 4 × 4 de cinza a 50%', () => {
    const resultado = dithering(cinza(4, 4, 128), { algoritmo: 'bayer-4' });
    expect(canaisVermelhos(resultado.data)).toEqual([
      255, 0, 255, 0,
      0, 255, 0, 255,
      255, 0, 255, 0,
      0, 255, 0, 255,
    ]);
  });

  it('usa matrizes distintas para Bayer 2 × 2, 4 × 4 e 8 × 8', () => {
    const entrada = cinza(8, 8, 26);
    const contarBrancos = (algoritmo: string) =>
      canaisVermelhos(dithering(entrada, { algoritmo }).data).filter((canal) => canal === 255).length;
    expect(contarBrancos('bayer-2')).toBe(0);
    expect(contarBrancos('bayer-4')).toBe(8);
    expect(contarBrancos('bayer-8')).toBe(7);
  });

  it('difunde o erro de Atkinson até duas colunas e duas linhas adiante', () => {
    const linha = dithering(cinza(4, 1, 124), { algoritmo: 'atkinson' });
    expect(canaisVermelhos(linha.data)).toEqual([0, 255, 0, 0]);
    const coluna = dithering(cinza(1, 3, 126), { algoritmo: 'atkinson' });
    expect(canaisVermelhos(coluna.data)).toEqual([0, 255, 255]);
    const floyd = dithering(cinza(4, 1, 124), { algoritmo: 'floyd-steinberg' });
    expect(canaisVermelhos(floyd.data)).toEqual([0, 255, 0, 255]);
  });

  it.each(OPCOES_DITHERING)('conserva o alfa em $nome e só usa cores da paleta', ({ valor }) => {
    const entrada = imagem(2, [155, 89, 202, 133], [5, 12, 22, 0], [240, 40, 45, 255], [10, 254, 8, 96]);
    const original = entrada.data.slice();
    const parametros = { algoritmo: valor, cores: 3 };
    const { data } = dithering(entrada, parametros);
    expect(dithering(entrada, parametros).data).toEqual(data);
    expect(entrada.data).toEqual(original);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 3]).toBe(original[i + 3]);
      if (data[i + 3] === 0) {
        expect(data.slice(i, i + 4)).toEqual(original.slice(i, i + 4));
        continue;
      }
      expect([0, 128, 255]).toContain(data[i]);
      expect(data[i + 1]).toBe(data[i]);
      expect(data[i + 2]).toBe(data[i]);
    }
  });

  it('aplica Bayer sobre a paleta reduzida do desenho', () => {
    const entrada = imagem(4, [193, 10, 20, 255], [184, 40, 30, 255], [1, 12, 95, 255], [8, 9, 112, 255]);
    const paleta = paletaDoDesenho(entrada, 2);
    const { data } = dithering(entrada, { algoritmo: 'bayer-8', paleta: 'desenho', cores: 2 });
    expect(paleta).toHaveLength(2);
    for (let i = 0; i < data.length; i += 4) {
      expect(paleta).toContainEqual(Array.from(data.slice(i, i + 3)));
    }
  });
});
