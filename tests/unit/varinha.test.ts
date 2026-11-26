import { describe, expect, it } from 'vitest';
import {
  combinarMascaras,
  contornoDaElipse,
  contornosDaMascara,
  juntarContornos,
  limitesDaMascara,
  trechosVisiveis,
} from '../../src/document/mascaraPixels';
import { pontoNaSelecao } from '../../src/document/selecao';
import { mascaraPorCor } from '../../src/tools/pixels';
import type { PixelBuffer } from '../../src/layers/types';

/** Imagem a partir de linhas de texto: "#" preto, "." branco, "r" vermelho. */
function imagem(linhas: string[]): PixelBuffer {
  const width = linhas[0].length;
  const height = linhas.length;
  const data = new Uint8ClampedArray(width * height * 4);
  const cores: Record<string, number[]> = {
    '#': [0, 0, 0, 255],
    '.': [255, 255, 255, 255],
    r: [230, 20, 20, 255],
  };
  linhas.forEach((linha, y) =>
    [...linha].forEach((c, x) => data.set(cores[c], (y * width + x) * 4)),
  );
  return { width, height, data };
}

function mascaraDe(img: PixelBuffer, x: number, y: number, global = false) {
  return mascaraPorCor(img, x, y, 0, global)!;
}

/** Rasteriza a seleção (área + contorno juntado) pelo teste de ponto dentro. */
function rasterizar(contorno: ReturnType<typeof juntarContornos>, largura: number, altura: number) {
  const area = { x: 0, y: 0, width: largura, height: altura };
  const linhas: string[] = [];
  for (let y = 0; y < altura; y++) {
    let linha = '';
    for (let x = 0; x < largura; x++)
      linha += pontoNaSelecao(area, { x: x + 0.5, y: y + 0.5 }, { contorno }) ? 'X' : '.';
    linhas.push(linha);
  }
  return linhas;
}

const desenho = ['..........', '.rrr..rr..', '.r.r..rr..', '.rrr......', '..........'];

describe('varinha mágica', () => {
  it('contígua: só a região clicada; o buraco no meio fica de fora', () => {
    const img = imagem(desenho);
    const mascara = mascaraDe(img, 1, 1);
    expect(limitesDaMascara(mascara, 10, 5)).toEqual({ x: 1, y: 1, width: 3, height: 3 });
    const contorno = juntarContornos(contornosDaMascara(mascara, 10, 5)!);
    expect(rasterizar(contorno, 10, 5)).toEqual([
      '..........',
      '.XXX......',
      '.X.X......',
      '.XXX......',
      '..........',
    ]);
  });

  it('global: todas as regiões da mesma cor, juntas por pontes que se anulam', () => {
    const img = imagem(desenho);
    const mascara = mascaraDe(img, 1, 1, true);
    const contornos = contornosDaMascara(mascara, 10, 5)!;
    // O anel (borda de fora e o buraco) e o quadradinho da direita.
    expect(contornos).toHaveLength(3);
    const contorno = juntarContornos(contornos);
    expect(rasterizar(contorno, 10, 5)).toEqual([
      '..........',
      '.XXX..XX..',
      '.X.X..XX..',
      '.XXX......',
      '..........',
    ]);
    // O tracejado mostra os três contornos, sem as pontes.
    expect(trechosVisiveis(contorno)).toHaveLength(3);
  });

  it('cantos: um retângulo vira 4 vértices', () => {
    const img = imagem(['....', '.##.', '.##.', '....']);
    const [laco] = contornosDaMascara(mascaraDe(img, 1, 1), 4, 4)!;
    expect(laco).toHaveLength(4);
  });

  it('Shift soma e Alt subtrai', () => {
    const a = Uint8Array.from([1, 1, 0, 0]);
    const b = Uint8Array.from([0, 1, 1, 0]);
    expect([...combinarMascaras(a, b, 'somar')]).toEqual([1, 1, 1, 0]);
    expect([...combinarMascaras(a, b, 'subtrair')]).toEqual([1, 0, 0, 0]);
    expect([...combinarMascaras(a, b, 'substituir')]).toEqual([0, 1, 1, 0]);
    expect([...combinarMascaras(null, b, 'subtrair')]).toEqual([0, 0, 0, 0]);
  });

  it('seleção elíptica: o contorno cabe na caixa e passa pelos quatro lados', () => {
    const contorno = contornoDaElipse({ x: 10, y: 20, width: 100, height: 40 }, 8);
    expect(contorno[0]).toEqual({ x: 110, y: 40 });
    expect(contorno[2].x).toBeCloseTo(60);
    expect(contorno[2].y).toBeCloseTo(60);
    expect(
      pontoNaSelecao({ x: 10, y: 20, width: 100, height: 40 }, { x: 60, y: 40 }, { contorno }),
    ).toBe(true);
    expect(
      pontoNaSelecao({ x: 10, y: 20, width: 100, height: 40 }, { x: 12, y: 22 }, { contorno }),
    ).toBe(false);
  });
});
