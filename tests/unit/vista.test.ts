import { describe, expect, it } from 'vitest';
import {
  caixaGirada,
  deslocamentoNoPapel,
  normalizarAngulo,
  papelParaTela,
  telaParaPapel,
  transformacaoCss,
} from '../../src/canvas/vista';

// Papel 200 × 100 no zoom 2: 400 × 200 px de tela.
const L = 200;
const A = 100;
const Z = 2;

function caixa(graus: number) {
  const { width, height } = caixaGirada(L * Z, A * Z, graus);
  // Centro da caixa em (500, 300).
  return { left: 500 - width / 2, top: 300 - height / 2, width, height };
}

describe('vista girada e espelhada', () => {
  it('sem giro: a conversão é a de sempre', () => {
    const vista = { rotacao: 0, espelhar: false };
    expect(telaParaPapel({ x: 300, y: 200 }, caixa(0), L, A, Z, vista)).toEqual({ x: 0, y: 0 });
    expect(telaParaPapel({ x: 500, y: 300 }, caixa(0), L, A, Z, vista)).toEqual({ x: 100, y: 50 });
  });

  it('girada 90°: um traço horizontal na tela vira vertical no papel', () => {
    const vista = { rotacao: 90, espelhar: false };
    const a = telaParaPapel({ x: 450, y: 300 }, caixa(90), L, A, Z, vista);
    const b = telaParaPapel({ x: 550, y: 300 }, caixa(90), L, A, Z, vista);
    expect(a.x).toBeCloseTo(b.x);
    expect(Math.abs(b.y - a.y)).toBeCloseTo(50);
    // O canto (0, 0) do papel aparece no canto de cima à direita da caixa girada.
    const canto = papelParaTela({ x: 0, y: 0 }, caixa(90), L, A, Z, vista);
    expect(canto.x).toBeCloseTo(600);
    expect(canto.y).toBeCloseTo(100);
  });

  it('espelhada: a esquerda da tela é a direita do papel', () => {
    const vista = { rotacao: 0, espelhar: true };
    expect(telaParaPapel({ x: 300, y: 200 }, caixa(0), L, A, Z, vista)).toEqual({ x: 200, y: 0 });
  });

  it('ida e volta em qualquer ângulo, com e sem espelho', () => {
    for (const rotacao of [-135, -30, 0, 17, 90, 180]) {
      for (const espelhar of [false, true]) {
        const vista = { rotacao, espelhar };
        const ponto = { x: 37, y: 81 };
        const tela = papelParaTela(ponto, caixa(rotacao), L, A, Z, vista);
        const volta = telaParaPapel(tela, caixa(rotacao), L, A, Z, vista);
        expect(volta.x).toBeCloseTo(ponto.x);
        expect(volta.y).toBeCloseTo(ponto.y);
      }
    }
  });

  it('deslocamento de arraste também gira', () => {
    const d = deslocamentoNoPapel({ x: 20, y: 0 }, 2, { rotacao: 90, espelhar: false });
    expect(d.x).toBeCloseTo(0);
    expect(d.y).toBeCloseTo(-10);
  });

  it('ângulos ficam entre −180 e 180 e o CSS só aparece quando precisa', () => {
    expect(normalizarAngulo(270)).toBe(-90);
    expect(normalizarAngulo(-180)).toBe(180);
    expect(normalizarAngulo(360)).toBe(0);
    expect(transformacaoCss({ rotacao: 0, espelhar: false })).toBeUndefined();
    expect(transformacaoCss({ rotacao: 45, espelhar: true })).toBe('rotate(45deg) scaleX(-1)');
    const giro = caixaGirada(400, 200, 90);
    expect(giro.width).toBeCloseTo(200);
    expect(giro.height).toBeCloseTo(400);
  });
});
