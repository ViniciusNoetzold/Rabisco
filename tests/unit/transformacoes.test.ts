import { documentoFalso } from './documentoFalso';
import { describe, expect, it } from 'vitest';
import { HistoricoComandos } from '../../src/commands/history';
import { Executador } from '../../src/commands/executador';
import {
  calcularInclinacao,
  girarPixels,
  inverterPixels,
  redimensionarPapel,
  sobreporPixels,
} from '../../src/document/transformacoes';
import type { PixelBuffer } from '../../src/layers/types';

function imagem(width: number, height: number, valores: number[]): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(valores) };
}

function numerada(width: number, height: number): PixelBuffer {
  const valores = Array.from({ length: width * height }, (_, i) => [i + 1, 0, 0, 255]).flat();
  return imagem(width, height, valores);
}

function vermelhos({ data }: PixelBuffer) {
  return [...data].filter((_, i) => i % 4 === 0);
}

describe('transformações do papel', () => {
  it('gira um desenho retangular para os dois lados e em 180°', () => {
    const original = numerada(3, 2);
    const direita = girarPixels(original, 90);
    expect([direita.width, direita.height]).toEqual([2, 3]);
    expect(vermelhos(direita)).toEqual([4, 1, 5, 2, 6, 3]);
    expect(girarPixels(direita, -90)).toEqual(original);
    expect(vermelhos(girarPixels(original, -90))).toEqual([3, 6, 2, 5, 1, 4]);
    expect(vermelhos(girarPixels(original, 180))).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('espelha linhas e colunas sem trocar as dimensões', () => {
    const original = numerada(3, 2);
    const horizontal = inverterPixels(original, 'horizontal');
    const vertical = inverterPixels(original, 'vertical');
    expect([horizontal.width, horizontal.height]).toEqual([3, 2]);
    expect(vermelhos(horizontal)).toEqual([3, 2, 1, 6, 5, 4]);
    expect([vertical.width, vertical.height]).toEqual([3, 2]);
    expect(vermelhos(vertical)).toEqual([4, 5, 6, 1, 2, 3]);
    expect(vermelhos(original)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('mantém RGBA no papel existente e pinta apenas o espaço acrescentado', () => {
    const original = imagem(2, 1, [4, 3, 2, 0, 50, 100, 150, 128]);
    const maior = redimensionarPapel(original, 3, 2, '#abc');
    expect([...maior.data]).toEqual([
      4, 3, 2, 0, 50, 100, 150, 128, 170, 187, 204, 255, 170, 187, 204, 255, 170, 187, 204, 255,
      170, 187, 204, 255,
    ]);
    const menor = redimensionarPapel(maior, 1, 1, '#000');
    expect([...menor.data]).toEqual([4, 3, 2, 0]);
  });

  it('calcula o contorno da inclinação negativa e mantém área com inclinações combinadas', () => {
    const esquerda = calcularInclinacao(3, 2, -45, 0);
    expect([esquerda.width, esquerda.height]).toEqual([5, 2]);
    expect(esquerda.c).toBeCloseTo(-1);
    expect(esquerda.e).toBeCloseTo(2);
    const dupla = calcularInclinacao(3, 2, 45, 45);
    expect([dupla.width, dupla.height]).toEqual([5, 7]);
    expect(dupla.a * dupla.d - dupla.b * dupla.c).toBeCloseTo(1);
  });

  it('rejeita ângulos ou limites do resultado antes de rasterizar', () => {
    expect(() => calcularInclinacao(5, 5, 90, 0)).toThrow('89°');
    expect(() => calcularInclinacao(5, 5, 0, Number.NaN)).toThrow('inclinação');
    expect(() => calcularInclinacao(800, 800, 89, 89)).toThrow('40 milhões');
    expect(() => redimensionarPapel(numerada(1, 1), 8192, 8192, '#ffffff')).toThrow('40 milhões');
  });

  it('compõe a seleção e preserva o papel sob os pontos transparentes', () => {
    const recorte = imagem(3, 1, [0, 0, 0, 0, 200, 0, 0, 128, 255, 255, 255, 255]);
    const alvo = imagem(3, 1, [20, 60, 80, 255, 0, 0, 100, 255, 0, 0, 0, 255]);
    sobreporPixels(recorte, alvo, 0, 0);
    expect([...alvo.data]).toEqual([20, 60, 80, 255, 100, 0, 50, 255, 255, 255, 255, 255]);
  });
});

describe('histórico de transformações', () => {
  it('conserva a edição mais recente quando ela ultrapassa o orçamento de pixels', () => {
    const historico = new HistoricoComandos(16);
    const registrar = (largura: number) =>
      historico.registrarComando({
        comando: { tipo: 'RedimensionarPapel', largura, altura: 1, fundo: '#fff' },
        camada: 'papel',
        label: 'Redimensionar papel',
        rect: null,
        before: numerada(1, 1),
        after: numerada(largura, 1),
      });
    registrar(2);
    registrar(4);
    expect(historico.entries).toHaveLength(1);
    expect(historico.memoryBytes).toBe(20);
    expect(historico.desfazer()?.after.width).toBe(4);
    expect(historico.refazer()?.before.width).toBe(1);
  });

  it('restaura DPI e dimensões do papel separadamente e com um item por comando', () => {
    const doc = documentoFalso(numerada(2, 2));
    doc.name = 'Teste';
    const editor = new Executador(doc);
    const propriedades = {
      tipo: 'RedimensionarPapel',
      largura: 2,
      altura: 2,
      fundo: '#fff',
      dpi: 300,
    } as const;
    expect(editor.executar(propriedades)).toBe(true);
    expect(doc.dpi).toBe(300);
    expect(editor.historico.memoryBytes).toBe(0);
    expect(editor.executar({ ...propriedades, largura: 4, dpi: 200 })).toBe(true);
    expect([doc.width, doc.dpi]).toEqual([4, 200]);
    expect(editor.historico.entries).toHaveLength(2);
    expect(editor.desfazer()).toBe(true);
    expect([doc.width, doc.dpi]).toEqual([2, 300]);
    expect(editor.desfazer()).toBe(true);
    expect([doc.width, doc.dpi]).toEqual([2, 96]);
    expect(editor.refazer()).toBe(true);
    expect([doc.width, doc.dpi]).toEqual([2, 300]);
  });
});
