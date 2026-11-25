import { describe, expect, it } from 'vitest';
import { Estabilizador } from '../../src/brushes/estabilizador';
import type { Point } from '../../src/layers/types';

/** Gerador determinístico (para o "tremor" ser sempre o mesmo). */
function aleatorio(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 2 ** 32;
    return estado / 2 ** 32;
  };
}

/** Linha horizontal de 0 a 400 px em y = 100, com tremor de ±6 px em y. */
function linhaTremida(): Point[] {
  const sorteio = aleatorio(7);
  return Array.from({ length: 200 }, (_, i) => ({ x: i * 2, y: 100 + (sorteio() - 0.5) * 12 }));
}

function desvioMedio(pontos: Point[]) {
  return pontos.reduce((soma, p) => soma + Math.abs(p.y - 100), 0) / pontos.length;
}

function estabilizar(pontos: Point[], raio: number, suavizacao = 0) {
  const estabilizador = new Estabilizador(pontos[0], raio, suavizacao);
  const saida = [pontos[0]];
  for (const ponto of pontos.slice(1)) {
    const proximo = estabilizador.mover(ponto);
    if (proximo) saida.push(proximo);
  }
  return saida;
}

describe('estabilizador de traço', () => {
  it('com raio 0 e sem suavização, devolve exatamente os pontos do ponteiro', () => {
    const pontos = linhaTremida();
    expect(estabilizar(pontos, 0)).toEqual(pontos);
  });

  it('o tremor da mão diminui conforme o raio aumenta', () => {
    const pontos = linhaTremida();
    const original = desvioMedio(pontos);
    const leve = desvioMedio(estabilizar(pontos, 10));
    const forte = desvioMedio(estabilizar(pontos, 30));
    expect(leve).toBeLessThan(original * 0.6);
    expect(forte).toBeLessThan(leve);
  });

  it('a suavização arredonda ainda mais o mesmo traço', () => {
    const pontos = linhaTremida();
    expect(desvioMedio(estabilizar(pontos, 10, 1))).toBeLessThan(
      desvioMedio(estabilizar(pontos, 10, 0)),
    );
  });

  it('o ponteiro dentro da corda não move a ponta', () => {
    const estabilizador = new Estabilizador({ x: 0, y: 0 }, 20);
    expect(estabilizador.mover({ x: 10, y: 5 })).toBeNull();
    expect(estabilizador.ponta).toEqual({ x: 0, y: 0 });
    // Fora da corda, a ponta anda só o que passou do comprimento (30 - 20 = 10).
    expect(estabilizador.mover({ x: 30, y: 0 })).toEqual({ x: 10, y: 0 });
  });

  it('ao soltar, a ponta alcança o ponteiro em passos e termina nele', () => {
    const estabilizador = new Estabilizador({ x: 0, y: 0 }, 40);
    estabilizador.mover({ x: 100, y: 0 });
    expect(estabilizador.ponta.x).toBeCloseTo(60);
    const pontos = estabilizador.alcancar({ x: 100, y: 0, pressure: 0.5 });
    expect(pontos.length).toBeGreaterThan(1);
    expect(pontos.at(-1)).toEqual({ x: 100, y: 0, pressure: 0.5 });
    for (let i = 1; i < pontos.length; i++) expect(pontos[i].x).toBeGreaterThan(pontos[i - 1].x);
  });

  it('carrega a pressão da caneta para a ponta', () => {
    const estabilizador = new Estabilizador({ x: 0, y: 0, pressure: 0.2 }, 5);
    expect(estabilizador.mover({ x: 50, y: 0, pressure: 0.8 })?.pressure).toBe(0.8);
  });
});
