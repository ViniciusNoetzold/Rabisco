import { describe, expect, it } from 'vitest';
import {
  copiasDosPontos,
  limitarEixos,
  linhasGuia,
  transformacoes,
  type ConfigSimetria,
} from '../../src/brushes/simetria';

const centro = { x: 100, y: 100 };
const config = (parcial: Partial<ConfigSimetria>): ConfigSimetria => ({
  modo: 'nenhuma',
  eixos: 6,
  espelhar: false,
  centro,
  ...parcial,
});

function arredondar(pontos: { x: number; y: number }[]) {
  return pontos.map(({ x, y }) => ({
    x: Math.round(x * 1000) / 1000 + 0,
    y: Math.round(y * 1000) / 1000 + 0,
  }));
}

describe('simetria', () => {
  it('sem simetria só existe a original', () => {
    expect(transformacoes(config({}))).toHaveLength(1);
    expect(transformacoes(null)).toHaveLength(1);
  });

  it('espelhos vertical, horizontal e quatro quadrantes', () => {
    const p = { x: 130, y: 80, pressure: 0.4 };
    const aplicar = (modo: ConfigSimetria['modo']) =>
      transformacoes(config({ modo })).map((t) => t(p));
    expect(aplicar('vertical')).toEqual([p, { x: 70, y: 80, pressure: 0.4 }]);
    expect(aplicar('horizontal')).toEqual([p, { x: 130, y: 120, pressure: 0.4 }]);
    expect(arredondar(aplicar('quatro'))).toEqual([
      { x: 130, y: 80 },
      { x: 70, y: 80 },
      { x: 130, y: 120 },
      { x: 70, y: 120 },
    ]);
  });

  it('radial de 4 eixos gira de 90 em 90 graus em torno do centro', () => {
    const copias = transformacoes(config({ modo: 'radial', eixos: 4 })).map((t) =>
      t({ x: 100, y: 50 }),
    );
    expect(arredondar(copias)).toEqual([
      { x: 100, y: 50 },
      { x: 150, y: 100 },
      { x: 100, y: 150 },
      { x: 50, y: 100 },
    ]);
  });

  it('mandala: espelhar dentro de cada fatia dobra as cópias', () => {
    const lista = transformacoes(config({ modo: 'radial', eixos: 6, espelhar: true }));
    expect(lista).toHaveLength(12);
    // O espelho da fatia 0 reflete no eixo vertical que passa pelo centro.
    expect(arredondar([lista[6]({ x: 120, y: 60 })])).toEqual([{ x: 80, y: 60 }]);
    // Todas as cópias ficam à mesma distância do centro.
    for (const t of lista) {
      const q = t({ x: 120, y: 60 });
      expect(Math.hypot(q.x - 100, q.y - 100)).toBeCloseTo(Math.hypot(20, 40));
    }
  });

  it('os eixos ficam entre 2 e 24', () => {
    expect(limitarEixos(1)).toBe(2);
    expect(limitarEixos(30)).toBe(24);
    expect(limitarEixos(7.4)).toBe(7);
    expect(transformacoes(config({ modo: 'radial', eixos: 99 }))).toHaveLength(24);
  });

  it('as cópias dos pontos preservam a original e os campos extras', () => {
    const marcas = [
      { x: 110, y: 100, quantidade: 3 },
      { x: 120, y: 100, quantidade: 2 },
    ];
    const [original, espelho] = copiasDosPontos(marcas, config({ modo: 'vertical' }));
    expect(original).toEqual(marcas);
    expect(espelho).toEqual([
      { x: 90, y: 100, quantidade: 3 },
      { x: 80, y: 100, quantidade: 2 },
    ]);
  });

  it('linhas-guia: uma por espelho, e uma por fatia no radial', () => {
    expect(linhasGuia(config({ modo: 'vertical' }), 200, 300)).toEqual([
      { de: { x: 100, y: 0 }, ate: { x: 100, y: 300 } },
    ]);
    expect(linhasGuia(config({ modo: 'quatro' }), 200, 300)).toHaveLength(2);
    const radial = linhasGuia(config({ modo: 'radial', eixos: 8 }), 200, 200);
    expect(radial).toHaveLength(8);
    expect(radial[0].ate.x).toBeCloseTo(100);
    expect(radial[0].ate.y).toBeLessThan(0);
  });
});
