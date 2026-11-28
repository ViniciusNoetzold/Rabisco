import { expect, it } from 'vitest';
import { areasDaFormaSimetrica } from '../../src/shapes/render';
import { PARAMETROS_PADRAO, type ConfiguracaoForma } from '../../src/shapes/tipos';

it('calcula áreas separadas para a forma original, o espelho e as cópias giradas', () => {
  const forma: ConfiguracaoForma = {
    id: 'rectangle',
    caixa: { x: 10, y: 10, width: 20, height: 10 },
    rotacao: 0,
    cor1: '#000000',
    cor2: '#ffffff',
    espessura: 4,
    contorno: 'solid',
    preenchimento: 'none',
    parametros: PARAMETROS_PADRAO,
  };
  const configuracao = { centro: { x: 60, y: 30 }, eixos: 4, espelhar: false };
  const original = { x: 7, y: 7, width: 26, height: 16 };
  expect(areasDaFormaSimetrica(forma)).toEqual([original]);
  expect(areasDaFormaSimetrica(forma, { ...configuracao, modo: 'vertical' })).toEqual([
    original,
    { x: 87, y: 7, width: 26, height: 16 },
  ]);
  const partes = areasDaFormaSimetrica(forma, { ...configuracao, modo: 'radial' });
  expect(partes).toHaveLength(4);
  expect(partes[1]).toEqual({ x: 67, y: -23, width: 16, height: 26 });
});
