import { describe, expect, it } from 'vitest';
import {
  aplicarPaleta,
  PALETAS_PIXEL_ART,
  paletaDoDesenho,
  pixelizar,
  reduzirPaleta,
  type CorPaleta,
} from '../../src/filtros/pixelArt';

function imagem(width: number, ...pixels: readonly number[][]) {
  return { width, height: pixels.length / width, data: new Uint8ClampedArray(pixels.flat()) };
}

describe('pixelizar', () => {
  it('calcula a média com alfa e trata o bloco incompleto na borda', () => {
    const entrada = imagem(
      3,
      [200, 40, 0, 255],
      [0, 0, 255, 0],
      [255, 255, 255, 255],
      [0, 40, 200, 255],
      [255, 0, 0, 0],
      [0, 0, 0, 255],
    );
    const original = entrada.data.slice();
    expect(pixelizar(entrada, { tamanho: 2 })).toEqual(
      imagem(
        3,
        [100, 40, 100, 128],
        [100, 40, 100, 128],
        [128, 128, 128, 255],
        [100, 40, 100, 128],
        [100, 40, 100, 128],
        [128, 128, 128, 255],
      ),
    );
    expect(entrada.data).toEqual(original);
  });

  it('mantém pixels em blocos de tamanho unitário e em blocos vazios', () => {
    const entrada = imagem(2, [1, 2, 3, 0], [5, 6, 7, 0]);
    expect(pixelizar(entrada, { tamanho: 1 })).toBe(entrada);
    expect(pixelizar(entrada, { tamanho: 20 })).toEqual(entrada);
  });
});

describe('reduzir para paleta de pixel art', () => {
  it.each(Object.entries(PALETAS_PIXEL_ART))(
    'usa somente cores de %s em pixels visíveis',
    (nome, paleta) => {
      const entrada = imagem(
        3,
        [30, 40, 72, 255],
        [156, 54, 202, 255],
        [50, 202, 87, 129],
        [231, 201, 12, 255],
        [99, 45, 186, 0],
        [80, 40, 12, 255],
      );
      for (const dithering of [true, false]) {
        const { data } = reduzirPaleta(entrada, { paleta: nome, dithering });
        for (let i = 0; i < data.length; i += 4) {
          expect(data[i + 3]).toBe(entrada.data[i + 3]);
          if (data[i + 3] === 0) {
            expect(data.slice(i, i + 4)).toEqual(entrada.data.slice(i, i + 4));
          } else {
            expect(paleta).toContainEqual(Array.from(data.slice(i, i + 3)));
          }
        }
      }
    },
  );

  it('mantém cores exatas quando o desenho já cabe na paleta e ignora cores invisíveis', () => {
    const entrada = imagem(3, [18, 18, 18, 255], [21, 21, 21, 128], [0, 255, 0, 0]);
    expect(paletaDoDesenho(entrada, 2)).toEqual([
      [18, 18, 18],
      [21, 21, 21],
    ]);
    expect(reduzirPaleta(entrada, { paleta: 'desenho', cores: 2 })).toEqual(entrada);
    expect(reduzirPaleta(imagem(1, [0, 255, 0, 0]), { paleta: 'desenho' }).data[3]).toBe(0);
  });

  it('gera um número limitado de cores representativas de forma determinística', () => {
    const entrada = imagem(
      4,
      [0, 0, 0, 255],
      [32, 32, 32, 255],
      [224, 224, 224, 255],
      [255, 255, 255, 255],
    );
    const paleta = paletaDoDesenho(entrada, 2);
    expect(paleta).toEqual([
      [16, 16, 16],
      [240, 240, 240],
    ]);
    expect(paletaDoDesenho(entrada, 2)).toEqual(paleta);
    expect(reduzirPaleta(entrada, { paleta: 'desenho', cores: 2 })).toEqual(
      imagem(4, [16, 16, 16, 255], [16, 16, 16, 255], [240, 240, 240, 255], [240, 240, 240, 255]),
    );
  });

  it('difunde o erro de Floyd–Steinberg sem o transmitir por um pixel invisível', () => {
    const paleta: CorPaleta[] = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    const cinza = [127, 127, 127, 255];
    const oculto = [200, 50, 2, 0];
    const preto = [0, 0, 0, 255];
    const branco = [255, 255, 255, 255];
    expect(aplicarPaleta(imagem(4, cinza, cinza, cinza, cinza), paleta, true)).toEqual(
      imagem(4, preto, branco, preto, branco),
    );
    expect(aplicarPaleta(imagem(3, cinza, oculto, cinza), paleta, true)).toEqual(
      imagem(3, preto, oculto, preto),
    );
  });
});
