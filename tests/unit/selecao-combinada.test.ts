import { describe, expect, it } from 'vitest';
import { combinarSelecoes, pontoNaSelecao } from '../../src/document/selecao';

describe('combinar seleções', () => {
  it('une caixas separadas sem incluir o espaço entre elas, em coordenadas do papel', () => {
    const resultado = combinarSelecoes(
      { area: { x: 3, y: 5, width: 4, height: 4 } },
      { area: { x: 12, y: 7, width: 3, height: 5 } },
      'somar',
    );
    if (!resultado || resultado === 'limite') throw new Error('Seleção vazia');
    expect(resultado.area).toEqual({ x: 3, y: 5, width: 12, height: 7 });
    expect(pontoNaSelecao(resultado.area, { x: 4.5, y: 8.5 }, resultado.mascara)).toBe(true);
    expect(pontoNaSelecao(resultado.area, { x: 13.5, y: 10.5 }, resultado.mascara)).toBe(true);
    expect(pontoNaSelecao(resultado.area, { x: 8.5, y: 7.5 }, resultado.mascara)).toBe(false);
  });

  it('subtrai somente a parte dentro da seleção base, inclusive ao deixar um buraco', () => {
    const origem = { area: { x: 12, y: 18, width: 8, height: 7 } };
    const resultado = combinarSelecoes(
      origem,
      { area: { x: 14, y: 20, width: 4, height: 3 } },
      'subtrair',
    );
    if (!resultado || resultado === 'limite') throw new Error('Seleção vazia');
    expect(resultado.area).toEqual(origem.area);
    expect(pontoNaSelecao(resultado.area, { x: 13, y: 19 }, resultado.mascara)).toBe(true);
    expect(pontoNaSelecao(resultado.area, { x: 15, y: 21 }, resultado.mascara)).toBe(false);
    expect(
      combinarSelecoes(origem, { area: { x: 31, y: 19, width: 2, height: 2 } }, 'subtrair'),
    ).toBe(origem);
    expect(
      combinarSelecoes(origem, { area: { x: 10, y: 17, width: 20, height: 12 } }, 'subtrair'),
    ).toBeNull();
  });
});
