import { describe, expect, it } from 'vitest';
import {
  brilhoContraste,
  curvas,
  limiar,
  matizSaturacao,
  niveis,
  posterizar,
  pretoEBranco,
  sepia,
  tabelaCurvas,
} from '../../src/filtros/cores';

function faixa(...pixels: number[][]) {
  return { width: pixels.length, height: 1, data: new Uint8ClampedArray(pixels.flat()) };
}

describe('filtros de cor', () => {
  it('ajusta brilho e contraste em torno do cinza médio', () => {
    const antes = faixa([100, 120, 150, 96]);
    expect(brilhoContraste(antes, {})).toBe(antes);
    expect(brilhoContraste(antes, { brilho: 20 })).toEqual(faixa([151, 171, 201, 96]));
    expect(brilhoContraste(antes, { contraste: -100 })).toEqual(faixa([128, 128, 128, 96]));
    expect(brilhoContraste(faixa([127, 128, 129, 96]), { contraste: 100 })).toEqual(
      faixa([0, 255, 255, 96]),
    );
  });

  it('produz a luminância da cor com saturação zero', () => {
    const antes = faixa([255, 0, 0, 96], [0, 255, 0, 192], [0, 0, 255, 255]);
    const depois = matizSaturacao(antes, { saturacao: 0 });
    expect(depois).toEqual(faixa([76, 76, 76, 96], [150, 150, 150, 192], [29, 29, 29, 255]));
  });

  it('gira o matiz e desloca a luminosidade sem alterar o alfa', () => {
    const antes = faixa([255, 0, 0, 96], [100, 100, 100, 192]);
    expect(matizSaturacao(antes, { matiz: 120 })).toEqual(
      faixa([0, 255, 0, 96], [100, 100, 100, 192]),
    );
    expect(matizSaturacao(antes, { matiz: -120 })).toEqual(
      faixa([0, 0, 255, 96], [100, 100, 100, 192]),
    );
    expect(matizSaturacao(antes, { luminosidade: 100 })).toEqual(
      faixa([255, 255, 255, 96], [255, 255, 255, 192]),
    );
  });

  it('remapeia os pontos preto e branco e aplica gama nos meios-tons', () => {
    const antes = faixa([32, 128, 224, 96]);
    expect(niveis(antes, {})).toBe(antes);
    expect(niveis(antes, { preto: 32, branco: 224 })).toEqual(faixa([0, 128, 255, 96]));
    expect(niveis(antes, { preto: 32, branco: 224, gama: 2 })).toEqual(faixa([0, 180, 255, 96]));
    expect(niveis(antes, { preto: 224, branco: 32 })).toEqual(faixa([0, 128, 255, 96]));
    expect(niveis(antes, { preto: 128, branco: 128 })).toEqual(faixa([0, 0, 255, 96]));
  });

  it('interpola curvas sem saltos ou extrapolação entre os pontos', () => {
    const antes = faixa([0, 128, 255, 96]);
    const pontos = [
      { x: 128, y: 200 },
      { x: 192, y: 215 },
    ];
    const curva = Array.from(tabelaCurvas(pontos));
    expect(curvas(antes, {})).toBe(antes);
    expect(curvas(antes, { pontos })).toEqual(faixa([0, 200, 255, 96]));
    expect(curva[192]).toBe(215);
    expect(curva).toEqual([...curva].sort((a, b) => a - b));
  });

  it('aceita pontos extremos e resolve coordenadas duplicadas', () => {
    const curva = tabelaCurvas([
      { x: 255, y: 15 },
      { x: 0, y: 245 },
      null,
      { x: 128, y: 130 },
      { x: 128, y: 100 },
    ]);
    expect([curva[0], curva[128], curva[255]]).toEqual([245, 100, 15]);
  });

  it('mistura os canais do preto e branco e regula a intensidade da sépia', () => {
    const antes = faixa([100, 50, 0, 96]);
    expect(pretoEBranco(antes, { vermelho: 100, verde: 0, azul: 0 })).toEqual(
      faixa([100, 100, 100, 96]),
    );
    expect(sepia(antes, { intensidade: 0 })).toBe(antes);
    expect(sepia(antes, {})).toEqual(faixa([78, 69, 54, 96]));
    expect(sepia(antes, { intensidade: 50 })).toEqual(faixa([89, 60, 27, 96]));
  });

  it('aplica o limiar pela luminância e reduz o número de valores por canal', () => {
    expect(limiar(faixa([255, 0, 0, 96], [0, 255, 0, 96], [128, 128, 128, 96]), {})).toEqual(
      faixa([0, 0, 0, 96], [255, 255, 255, 96], [255, 255, 255, 96]),
    );
    expect(posterizar(faixa([40, 128, 220, 96]), { niveis: 4 })).toEqual(faixa([0, 170, 255, 96]));
  });

  it('preserva a entrada, o alfa parcial e os canais invisíveis em todos os filtros', () => {
    const parametros = {
      brilho: 20,
      matiz: 120,
      preto: 32,
      pontos: [{ x: 64, y: 128 }],
    };
    const antes = faixa([100, 50, 30, 96], [25, 125, 250, 0]);
    const filtros = [
      brilhoContraste,
      matizSaturacao,
      niveis,
      curvas,
      pretoEBranco,
      sepia,
      limiar,
      posterizar,
    ];
    for (const filtro of filtros) {
      const depois = filtro(antes, parametros);
      expect(Array.from(depois.data.slice(3))).toEqual([96, 25, 125, 250, 0]);
      expect(antes).toEqual(faixa([100, 50, 30, 96], [25, 125, 250, 0]));
    }
  });
});
