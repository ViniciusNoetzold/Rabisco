import { describe, expect, it } from 'vitest';
import { eixosDasReguas, poligonoVisivel } from '../../src/canvas/viewportVisual';
import { caixaGirada, deslocamentoNaTela, deslocamentoNoPapel } from '../../src/canvas/vista';

describe('réguas e miniatura com vista transformada', () => {
  it('troca os eixos a 90° e inverte o sentido da régua no espelho', () => {
    expect(eixosDasReguas(2, 200, 100, { rotacao: 0, espelhar: false })).toEqual({
      topo: { eixo: 'x', total: 200, escala: 2 },
      lateral: { eixo: 'y', total: 100, escala: 2 },
    });
    expect(eixosDasReguas(2, 200, 100, { rotacao: 90, espelhar: false })).toEqual({
      topo: { eixo: 'y', total: 100, escala: -2 },
      lateral: { eixo: 'x', total: 200, escala: 2 },
    });
    expect(eixosDasReguas(2, 200, 100, { rotacao: 0, espelhar: true }).topo.escala).toBe(-2);
    expect(eixosDasReguas(2, 200, 100, { rotacao: 90, espelhar: true }).lateral.escala).toBe(-2);
  });

  it('mapeia a metade direita da vista girada para a metade superior do papel', () => {
    const vista = { rotacao: 90, espelhar: false };
    const poligono = poligonoVisivel(
      {
        esquerda: 500,
        topo: 100,
        width: 100,
        height: 400,
        papel: { left: 400, top: 100, width: 200, height: 400 },
      },
      2,
      200,
      100,
      vista,
    );
    expect(Math.min(...poligono.map(({ x }) => x))).toBeCloseTo(0);
    expect(Math.max(...poligono.map(({ x }) => x))).toBeCloseTo(200);
    expect(Math.min(...poligono.map(({ y }) => y))).toBeCloseTo(0);
    expect(Math.max(...poligono.map(({ y }) => y))).toBeCloseTo(50);
  });

  it('desenha um losango na miniatura a 45° e recorta o enquadramento na borda da imagem', () => {
    const caixa = caixaGirada(100, 100, 45);
    const quadro = {
      esquerda: 90,
      topo: 40,
      width: 20,
      height: 20,
      papel: { left: 100 - caixa.width / 2, top: 50 - caixa.height / 2, ...caixa },
    };
    const vista = { rotacao: 45, espelhar: false };
    const pontos = poligonoVisivel(quadro, 1, 100, 100, vista);
    expect(pontos).toHaveLength(4);
    expect(pontos[0].x).toBeCloseTo(50 - Math.SQRT2 * 10);
    expect(pontos[0].y).toBeCloseTo(50);
    expect(pontos[1].x).toBeCloseTo(50);
    expect(pontos[1].y).toBeCloseTo(50 - Math.SQRT2 * 10);
    const inteira = poligonoVisivel(
      { ...quadro, esquerda: -500, topo: -500, width: 1000, height: 1000 },
      1,
      100,
      100,
      vista,
    );
    expect(inteira).toHaveLength(4);
    expect(inteira.every(({ x, y }) => x >= 0 && x <= 100 && y >= 0 && y <= 100)).toBe(true);
    expect(poligonoVisivel({ ...quadro, esquerda: 1000 }, 1, 100, 100, vista)).toEqual([]);
  });

  it('transforma o arraste da miniatura em rolagem para a vista atual', () => {
    const vista = { rotacao: 90, espelhar: true };
    const delta = deslocamentoNaTela({ x: 12, y: -7 }, 2, vista);
    expect(delta.x).toBeCloseTo(14);
    expect(delta.y).toBeCloseTo(-24);
    const volta = deslocamentoNoPapel(delta, 2, vista);
    expect(volta.x).toBeCloseTo(12);
    expect(volta.y).toBeCloseTo(-7);
  });
});
