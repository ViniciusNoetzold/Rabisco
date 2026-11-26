import { describe, expect, it } from 'vitest';
import { planoDeDistribuicao } from '../../src/document/distribuir';

const caixa = (x: number, y: number, width = 20, height = 20) => ({ x, y, width, height });

describe('distribuir camadas', () => {
  it('horizontal: pontas paradas e espaços iguais entre as bordas', () => {
    const plano = planoDeDistribuicao(
      [
        { id: 'a', limites: caixa(0, 0) },
        { id: 'c', limites: caixa(200, 50) },
        { id: 'b', limites: caixa(30, 10, 40) },
      ],
      'horizontal',
    );
    // Total 0..220, ocupado 80: dois vãos de 70. "b" (40 px) vai para x = 90.
    expect(plano).toEqual([{ id: 'b', dx: 60, dy: 0 }]);
  });

  it('vertical: ordena pelo centro e só mexe em y', () => {
    const plano = planoDeDistribuicao(
      [
        { id: 'a', limites: caixa(0, 300) },
        { id: 'b', limites: caixa(0, 0) },
        { id: 'c', limites: caixa(0, 40) },
        { id: 'd', limites: caixa(0, 50) },
      ],
      'vertical',
    );
    // Pontas: b (0) e a (300..320). Vãos de (320 − 80) / 3 = 80: c em 100, d em 200.
    expect(plano).toEqual([
      { id: 'c', dx: 0, dy: 60 },
      { id: 'd', dx: 0, dy: 150 },
    ]);
  });

  it('menos de 3 camadas ou já distribuídas: nada a fazer', () => {
    expect(planoDeDistribuicao([{ id: 'a', limites: caixa(0, 0) }], 'horizontal')).toEqual([]);
    expect(
      planoDeDistribuicao(
        [
          { id: 'a', limites: caixa(0, 0) },
          { id: 'b', limites: caixa(50, 0) },
          { id: 'c', limites: caixa(100, 0) },
        ],
        'horizontal',
      ),
    ).toEqual([]);
  });
});
