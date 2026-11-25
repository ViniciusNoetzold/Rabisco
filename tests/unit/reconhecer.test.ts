import { describe, expect, it } from 'vitest';
import type { Point } from '../../src/layers/types';
import { reconhecerForma, simplificar } from '../../src/shapes/reconhecer';

/** Sorteio com semente fixa: o mesmo "tremor" em toda execução. */
function sorteio(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 2 ** 32;
    return estado / 2 ** 32 - 0.5;
  };
}

/** Caminho passando pelos vértices, com `passo` px entre pontos e ruído de ±`ruido` px. */
function tracar(vertices: Point[], passo: number, ruido: number, semente = 7): Point[] {
  const aleatorio = sorteio(semente);
  const pontos: Point[] = [];
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1];
    const b = vertices[i];
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / passo));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pontos.push({
        x: a.x + (b.x - a.x) * t + aleatorio() * 2 * ruido,
        y: a.y + (b.y - a.y) * t + aleatorio() * 2 * ruido,
      });
    }
  }
  pontos.push(vertices[vertices.length - 1]);
  return pontos;
}

function circulo(cx: number, cy: number, rx: number, ry: number, ruido: number, volta = 1) {
  const aleatorio = sorteio(3);
  return Array.from({ length: 90 }, (_, i) => {
    const t = (i / 89) * 2 * Math.PI * volta - Math.PI / 2;
    const r = 1 + aleatorio() * 2 * ruido;
    return { x: cx + Math.cos(t) * rx * r, y: cy + Math.sin(t) * ry * r };
  });
}

describe('reconhecer formas', () => {
  it('Ramer–Douglas–Peucker guarda só os cantos', () => {
    const pontos = tracar(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      5,
      0,
    );
    expect(simplificar(pontos, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('linha trêmula vira linha reta entre o começo e o fim', () => {
    const forma = reconhecerForma(
      tracar(
        [
          { x: 20, y: 50 },
          { x: 320, y: 90 },
        ],
        4,
        3,
      ),
    );
    expect(forma?.tipo).toBe('linha');
    expect(forma?.geometria.id).toBe('line');
  });

  it('círculo com ruído vira círculo; oval vira elipse', () => {
    const redondo = reconhecerForma(circulo(200, 200, 80, 84, 0.04));
    expect(redondo?.tipo).toBe('circulo');
    const { caixa } = redondo!.geometria;
    expect(caixa.width).toBe(caixa.height);
    expect(caixa.x + caixa.width / 2).toBeCloseTo(200, -1);
    const oval = reconhecerForma(circulo(200, 200, 140, 60, 0.03));
    expect(oval?.tipo).toBe('elipse');
    expect(oval?.geometria.rotacao).toBe(0);
    expect(oval!.geometria.caixa.width).toBeGreaterThan(oval!.geometria.caixa.height * 2);
  });

  it('retângulo torto vira retângulo reto; quase quadrado vira quadrado', () => {
    const torto = [
      { x: 50, y: 52 },
      { x: 252, y: 48 },
      { x: 249, y: 151 },
      { x: 53, y: 148 },
      { x: 51, y: 56 },
    ];
    const forma = reconhecerForma(tracar(torto, 4, 2));
    expect(forma?.tipo).toBe('retangulo');
    expect(forma?.geometria.id).toBe('rectangle');
    expect(forma?.geometria.rotacao).toBe(0);
    expect(forma!.geometria.caixa.width).toBeCloseTo(199, -1);
    expect(forma!.geometria.caixa.height).toBeCloseTo(99, -1);
    const quase = reconhecerForma(
      tracar(
        [
          { x: 0, y: 0 },
          { x: 104, y: 2 },
          { x: 102, y: 98 },
          { x: 1, y: 100 },
          { x: 2, y: 4 },
        ],
        4,
        1.5,
      ),
    );
    expect(quase?.tipo).toBe('quadrado');
    expect(quase!.geometria.caixa.width).toBe(quase!.geometria.caixa.height);
  });

  it('triângulo vira polígono de 3 vértices', () => {
    const forma = reconhecerForma(
      tracar(
        [
          { x: 150, y: 20 },
          { x: 260, y: 200 },
          { x: 40, y: 200 },
          { x: 148, y: 26 },
        ],
        4,
        2,
      ),
    );
    expect(forma?.tipo).toBe('triangulo');
    expect(forma?.geometria.pontos).toHaveLength(3);
  });

  it('seta num traço só vira a seta do catálogo, girada na direção do cabo', () => {
    const forma = reconhecerForma(
      tracar(
        [
          { x: 20, y: 100 },
          { x: 220, y: 100 },
          { x: 180, y: 70 },
          { x: 219, y: 101 },
          { x: 180, y: 130 },
        ],
        4,
        1,
      ),
    );
    expect(forma?.tipo).toBe('seta');
    expect(forma?.geometria.id).toBe('seta-direita');
    expect(forma?.geometria.rotacao).toBe(0);
    expect(forma!.geometria.caixa.width).toBeCloseTo(200, -1);
  });

  it('rabisco aleatório e traço curvo aberto não viram forma', () => {
    const aleatorio = sorteio(42);
    const rabisco = Array.from({ length: 80 }, () => ({
      x: 200 + aleatorio() * 300,
      y: 200 + aleatorio() * 300,
    }));
    expect(reconhecerForma(rabisco)).toBeNull();
    // Um "S" aberto: nem linha, nem seta.
    const s = Array.from({ length: 60 }, (_, i) => ({
      x: 100 + i * 4,
      y: 200 + Math.sin((i / 59) * 2 * Math.PI) * 60,
    }));
    expect(reconhecerForma(s)).toBeNull();
    // Espiral de várias voltas fechando perto do começo: rabisco, não círculo.
    expect(reconhecerForma(circulo(200, 200, 80, 80, 0.3, 3))).toBeNull();
    // Traço curtinho: em dúvida, nada.
    expect(
      reconhecerForma([
        { x: 0, y: 0 },
        { x: 3, y: 2 },
        { x: 5, y: 1 },
        { x: 6, y: 3 },
      ]),
    ).toBeNull();
  });
});
