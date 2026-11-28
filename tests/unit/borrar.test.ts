import { describe, expect, it } from 'vitest';
import { areaDoBorrao, borrarTraco, BorradorSimetrico } from '../../src/brushes/borrar';
import type { ConfigSimetria } from '../../src/brushes/simetria';
import { Executador } from '../../src/commands/executador';
import type { PixelBuffer } from '../../src/layers/types';
import { documentoFalso } from './documentoFalso';

/** 60 × 20: metade esquerda vermelha, direita branca. */
function papel(): PixelBuffer {
  const width = 60;
  const height = 20;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      data.set(x < 30 ? [220, 20, 20, 255] : [255, 255, 255, 255], (y * width + x) * 4);
  return { width, height, data };
}

function pixel(imagem: PixelBuffer, x: number, y: number) {
  const i = (y * imagem.width + x) * 4;
  return [...imagem.data.subarray(i, i + 4)];
}

const traco = [
  { x: 22, y: 10 },
  { x: 32, y: 10 },
  { x: 42, y: 10 },
];

describe('dedo (borrar)', () => {
  it('arrasta o vermelho para dentro do branco; longe da ponta nada muda', () => {
    const imagem = papel();
    borrarTraco(imagem, { x: 0, y: 0 }, traco, 10, 0.8);
    const [r, g] = pixel(imagem, 36, 10);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(200);
    expect(pixel(imagem, 36, 1)).toEqual([255, 255, 255, 255]);
    expect(pixel(imagem, 5, 10)).toEqual([220, 20, 20, 255]);
  });

  it('força 0 não mexe em nada; mais força arrasta mais longe', () => {
    const parado = papel();
    borrarTraco(parado, { x: 0, y: 0 }, traco, 10, 0);
    expect(parado.data).toEqual(papel().data);
    const fraco = papel();
    const forte = papel();
    borrarTraco(fraco, { x: 0, y: 0 }, traco, 10, 0.3);
    borrarTraco(forte, { x: 0, y: 0 }, traco, 10, 0.9);
    expect(pixel(forte, 40, 10)[1]).toBeLessThan(pixel(fraco, 40, 10)[1]);
  });

  it('no recorte dá o mesmo que no papel inteiro (prévia fiel ao resultado)', () => {
    const inteiro = papel();
    borrarTraco(inteiro, { x: 0, y: 0 }, traco, 10, 0.7);
    const area = areaDoBorrao(traco, 10)!;
    const recorte = papel();
    const corte: PixelBuffer = {
      width: area.width,
      height: area.height,
      data: new Uint8ClampedArray(area.width * area.height * 4),
    };
    for (let y = 0; y < area.height; y++)
      for (let x = 0; x < area.width; x++)
        corte.data.set(pixel(recorte, area.x + x, area.y + y), (y * area.width + x) * 4);
    borrarTraco(corte, { x: area.x, y: area.y }, traco, 10, 0.7);
    for (const [x, y] of [
      [30, 10],
      [38, 8],
      [44, 12],
    ])
      expect(pixel(corte, x - area.x, y - area.y)).toEqual(pixel(inteiro, x, y));
  });

  it('borda transparente não puxa preto', () => {
    const imagem = papel();
    // Metade direita transparente (r, g, b = 0).
    for (let y = 0; y < 20; y++)
      for (let x = 30; x < 60; x++) imagem.data.set([0, 0, 0, 0], (y * 60 + x) * 4);
    borrarTraco(imagem, { x: 0, y: 0 }, traco, 10, 0.8);
    const [r, , , a] = pixel(imagem, 34, 10);
    expect(a).toBeGreaterThan(0);
    expect(r).toBeGreaterThan(180);
  });

  it('o mesmo comando borra o traço e o seu espelho, num item reversível', () => {
    const antes = papel();
    const doc = documentoFalso(antes);
    const editor = new Executador(doc);
    const simetria: ConfigSimetria = {
      modo: 'horizontal',
      eixos: 2,
      espelhar: false,
      centro: { x: 30, y: 10 },
    };
    const pontos = traco.map(({ x }) => ({ x, y: 5 }));
    expect(editor.executar({ tipo: 'Borrar', pontos, espessura: 8, forca: 0.8, simetria })).toBe(
      true,
    );
    expect(pixel(doc.raster, 36, 5)[1]).toBeLessThan(200);
    expect(pixel(doc.raster, 36, 15)[1]).toBeLessThan(200);
    expect(editor.historico.entries).toEqual([{ label: 'Dedo' }]);
    const depois = doc.raster;
    expect(editor.desfazer()).toBe(true);
    expect(doc.raster).toEqual(antes);
    expect(editor.refazer()).toBe(true);
    expect(doc.raster).toEqual(depois);
  });

  it('o replay radial coincide com a prévia e respeita a cobertura da seleção', () => {
    const previa = papel();
    const resultado = papel();
    const area = { x: 30, y: 7, width: 12, height: 8 };
    const cobertura = new Uint8ClampedArray(area.width * area.height).fill(255);
    cobertura[3 * area.width + 6] = 0;
    const simetria: ConfigSimetria = {
      modo: 'radial',
      eixos: 4,
      espelhar: true,
      centro: { x: 30, y: 10 },
    };
    const opcoes = { area, cobertura, simetria };
    const borrador = new BorradorSimetrico(previa, { x: 0, y: 0 }, 8, 0.8, opcoes);
    borrador.iniciar(traco[0]);
    for (const ponto of traco.slice(1)) borrador.mover(ponto);
    borrarTraco(resultado, { x: 0, y: 0 }, traco, 8, 0.8, opcoes);
    expect(resultado).toEqual(previa);
    expect(pixel(resultado, 36, 10)).toEqual([255, 255, 255, 255]);
    expect(pixel(resultado, 43, 10)).toEqual([255, 255, 255, 255]);
    expect(pixel(resultado, 35, 10)[1]).toBeLessThan(255);
  });
});
