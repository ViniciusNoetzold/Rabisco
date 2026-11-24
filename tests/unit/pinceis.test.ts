import { describe, expect, it } from 'vitest';
import { AmostradorPincel } from '../../src/brushes/amostrador';
import type { ConfiguracaoPincel, MarcaPincel } from '../../src/brushes/catalogo';
import { criarAleatorioPincel, criarPintorPincel, gerarPontosSpray } from '../../src/brushes/motor';
import type { Point } from '../../src/layers/types';

function amostrar(espessura: number, pontos: Point[]) {
  const amostrador = new AmostradorPincel(espessura);
  return [...pontos.flatMap((ponto) => amostrador.adicionar(ponto)), ...amostrador.finalizar()];
}

describe('espaçamento das marcas de pincel', () => {
  it('mantém o intervalo acumulado nas bordas entre eventos do ponteiro', () => {
    const pontos = [
      { x: 0, y: 3 },
      { x: 5, y: 3 },
      { x: 9, y: 3 },
      { x: 40, y: 3 },
    ];
    const marcas = amostrar(10, pontos);
    const eventoUnico = amostrar(10, [pontos[0], pontos[3]]);

    expect(marcas.map(({ x }) => Number(x.toFixed(5)))).toEqual(
      eventoUnico.map(({ x }) => Number(x.toFixed(5))),
    );
    expect(marcas[0]).toEqual({ x: 0, y: 3, pressure: 1 });
    expect(marcas.at(-1)).toEqual({ x: 40, y: 3, pressure: 1 });
    expect(marcas[1].x).toBeCloseTo(1.4);

    const marcasGrossas = amostrar(20, pontos);
    expect(marcasGrossas[1].x).toBeCloseTo(2.8);
    expect(marcasGrossas.length).toBeLessThan(marcas.length);
  });

  it('arredonda uma mudança de direção sem abrir lacunas', () => {
    const marcas = amostrar(10, [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ]);
    expect(marcas.some(({ x, y }) => x > 10 && x < 20 && y > 0 && y < 10)).toBe(true);
    for (let i = 1; i < marcas.length; i++) {
      const anterior = marcas[i - 1];
      const atual = marcas[i];
      expect(Math.hypot(atual.x - anterior.x, atual.y - anterior.y)).toBeLessThanOrEqual(1.401);
    }
  });

  it('suaviza a pressão do dispositivo e não duplica a marca de um clique', () => {
    const clique = amostrar(6, [{ x: 2, y: 2 }]);
    expect(clique).toEqual([{ x: 2, y: 2, pressure: 1 }]);

    const marcas = amostrar(10, [
      { x: 0, y: 0, pressure: 0.1 },
      { x: 20, y: 0, pressure: 1.5 },
    ]);
    expect(marcas[0].pressure).toBe(0.1);
    expect(marcas.at(-1)!.pressure).toBeGreaterThan(0.1);
    expect(marcas.at(-1)!.pressure).toBeLessThan(1);
    expect(marcas[1].x - marcas[0].x).toBeLessThan(marcas.at(-2)!.x - marcas.at(-3)!.x);
  });
});

describe('partículas do aerógrafo', () => {
  it('distribui as partículas na área circular sem concentração artificial no centro', () => {
    const centro = { x: 90, y: 120 };
    const raio = 16;
    const pontos = gerarPontosSpray(centro, raio * 2, 1_000, criarAleatorioPincel(512));
    const distancias = pontos.map((ponto) => Math.hypot(ponto.x - centro.x, ponto.y - centro.y));
    const foraDaMetade = distancias.filter((distancia) => distancia > raio / 2).length;
    expect(Math.max(...distancias)).toBeLessThanOrEqual(raio);
    expect(foraDaMetade).toBeGreaterThan(710);
    expect(foraDaMetade).toBeLessThan(790);
  });

  it('pinta os mesmos pixels para a mesma semente mesmo em lotes diferentes', () => {
    const marcas: MarcaPincel[] = [
      { x: 10.2, y: 15.6, quantidade: 36 },
      { x: 12.5, y: 20.75, quantidade: 29, pressure: 0.7 },
    ];

    function pintar(semente: number, lotes: MarcaPincel[][]) {
      const pixels: string[] = [];
      const ctx = {
        save() {},
        restore() {},
        fillRect(x: number, y: number, largura: number, altura: number) {
          pixels.push(`${x},${y}`);
          expect(largura).toBe(1);
          expect(altura).toBe(1);
          expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
        },
      } as unknown as CanvasRenderingContext2D;
      const configuracao: ConfiguracaoPincel = {
        tipo: 'spray',
        cor: '#3083c5',
        espessura: 24,
        semente,
      };
      const pintor = criarPintorPincel(ctx, configuracao);
      for (const lote of lotes) pintor.pintar(lote);
      return pixels;
    }

    const pixels = pintar(108, [marcas]);
    expect(pixels).toHaveLength(65);
    expect(pixels).toEqual(pintar(108, [[marcas[0]], [marcas[1]]]));
    expect(pixels).not.toEqual(pintar(109, [marcas]));
  });
});
