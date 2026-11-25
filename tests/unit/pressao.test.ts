import { describe, expect, it } from 'vitest';
import {
  afinarFim,
  aplicarCurva,
  comprimentoDaPonta,
  fatorDaPonta,
  PressaoPorVelocidade,
} from '../../src/brushes/pressao';

describe('curva de pressão', () => {
  it('linear não muda; suave engrossa toques leves; firme pede mais força', () => {
    expect(aplicarCurva(0.5, 'linear')).toBe(0.5);
    expect(aplicarCurva(0.5, 'suave')).toBeGreaterThan(0.6);
    expect(aplicarCurva(0.5, 'firme')).toBeLessThan(0.35);
    for (const curva of ['suave', 'linear', 'firme'] as const) {
      expect(aplicarCurva(0, curva)).toBe(0);
      expect(aplicarCurva(1, curva)).toBe(1);
      expect(aplicarCurva(2, curva)).toBe(1);
    }
  });
});

describe('pressão pela velocidade', () => {
  it('devagar fica cheio e rápido afina, sem saltos bruscos', () => {
    const pressao = new PressaoPorVelocidade(1);
    let x = 0;
    let instante = 0;
    pressao.proxima({ x, y: 0 }, instante);
    for (let i = 0; i < 20; i++) pressao.proxima({ x: (x += 1), y: 0 }, (instante += 16));
    const devagar = pressao.proxima({ x: (x += 1), y: 0 }, (instante += 16));
    expect(devagar).toBeGreaterThan(0.95);
    let anterior = devagar;
    for (let i = 0; i < 20; i++) {
      const atual = pressao.proxima({ x: (x += 60), y: 0 }, (instante += 16));
      expect(anterior - atual).toBeLessThan(0.3);
      anterior = atual;
    }
    expect(anterior).toBeLessThan(0.4);
  });

  it('o zoom conta: a mesma distância no papel é mais rápida na tela com zoom maior', () => {
    const perto = new PressaoPorVelocidade(4);
    const longe = new PressaoPorVelocidade(0.25);
    for (const p of [perto, longe]) {
      p.proxima({ x: 0, y: 0 }, 0);
      for (let i = 1; i <= 10; i++) p.proxima({ x: i * 10, y: 0 }, i * 16);
    }
    expect(perto.proxima({ x: 110, y: 0 }, 176)).toBeLessThan(longe.proxima({ x: 110, y: 0 }, 176));
  });
});

describe('afinar as pontas', () => {
  it('a ponta começa fina e chega a cheio no comprimento', () => {
    expect(fatorDaPonta(0, 50)).toBeCloseTo(0.15);
    expect(fatorDaPonta(25, 50)).toBeCloseTo(0.575);
    expect(fatorDaPonta(50, 50)).toBe(1);
    expect(fatorDaPonta(10, 0)).toBe(1);
  });

  it('o comprimento cresce com o pincel e respeita os limites', () => {
    expect(comprimentoDaPonta(0, 20)).toBe(0);
    expect(comprimentoDaPonta(100, 2)).toBe(30);
    expect(comprimentoDaPonta(100, 20)).toBe(120);
    expect(comprimentoDaPonta(100, 100)).toBe(240);
    expect(comprimentoDaPonta(50, 20)).toBe(60);
  });

  it('afina só o fim do traço e não altera as marcas originais', () => {
    const marcas = Array.from({ length: 11 }, (_, i) => ({ x: i * 10, y: 0 }));
    const afinadas = afinarFim(marcas, 30);
    expect(afinadas.at(-1)!.pressure).toBeCloseTo(0.15);
    expect(afinadas[0].pressure).toBeUndefined();
    expect(afinadas[5]).toBe(marcas[5]);
    expect(marcas.at(-1)!.pressure).toBeUndefined();
  });
});
