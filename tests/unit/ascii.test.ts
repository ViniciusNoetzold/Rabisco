import { describe, expect, it, vi } from 'vitest';
import {
  converterAscii,
  desenharAscii,
  htmlAscii,
  prepararPreviaAscii,
  textoAscii,
} from '../../src/estilos/ascii';
import { normalizarCamadaAscii } from '../../src/estilos/camadaAscii';

const BRANCO = [255, 255, 255, 255];
const PRETO = [0, 0, 0, 255];
const TRANSPARENTE = [21, 53, 100, 0];

function imagem(linhas: number[][][]) {
  return {
    width: linhas[0]?.length ?? 0,
    height: linhas.length,
    data: new Uint8ClampedArray(linhas.flat(2)),
  };
}

describe('arte ASCII', () => {
  it('mapeia preto, branco e transparência em colunas editáveis, com inversão opcional', () => {
    const pixels = imagem([[BRANCO, PRETO, TRANSPARENTE]]);
    const opcoes = { colunas: 3, colorido: true };
    expect(converterAscii(pixels, opcoes)).toEqual({
      colunas: 3,
      linhas: [' @ '],
      inverter: false,
      cores: [[null, '#000000', null]],
    });
    expect(converterAscii(pixels, { ...opcoes, inverter: true })).toEqual({
      colunas: 3,
      linhas: ['@  '],
      inverter: true,
      cores: [['#ffffff', null, null]],
    });
  });

  it('faz a média proporcional nas bordas dos recortes e pondera pelo alfa', () => {
    expect(converterAscii(imagem([[PRETO, BRANCO, BRANCO]]), { colunas: 2 }).linhas).toEqual(['* ']);
    const semitransparente = imagem([[[0, 0, 0, 128], [80, 40, 0, 255]]]);
    const arte = converterAscii(semitransparente, { colunas: 2, conjunto: 'blocos', colorido: true });
    expect(arte.linhas).toEqual(['▒▓']);
    expect(arte.cores).toEqual([['#000000', '#502800']]);
  });

  it('respeita a proporção aproximada das células monoespaçadas', () => {
    const pixels = imagem(Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => PRETO)));
    const arte = converterAscii(pixels, { colunas: 8, conjunto: 'detalhado' });
    expect(arte.linhas).toEqual(Array(4).fill('$$$$$$$$'));
    expect(converterAscii(imagem([]), { colunas: 4 }).linhas).toEqual([]);
  });

  it('mantém 500 caracteres no texto, no HTML e na camada, e lê artes anteriores', () => {
    const pixels = imagem([Array.from({ length: 500 }, () => PRETO)]);
    const arte = converterAscii(pixels, { colunas: 500, colorido: true });
    const linha = '@'.repeat(500);
    const area = { x: 0, y: 0, width: 500, height: 100 };
    expect(arte.colunas).toBe(500);
    expect(textoAscii(arte)).toBe(linha);
    expect(htmlAscii(arte)).toContain(`<span style="color:#000000">${linha}</span>`);
    expect(normalizarCamadaAscii({ arte, area })?.arte).toEqual(arte);

    const antiga = { colunas: 256, linhas: ['Arte anterior'], inverter: true };
    expect(normalizarCamadaAscii({ arte: antiga, area })?.arte).toMatchObject(antiga);
  });

  it('preserva o limite de células na saída mais larga e reduz só a prévia colorida', () => {
    const larga = converterAscii(imagem([[PRETO]]), { colunas: 4096 });
    expect(larga.colunas).toBe(1024);
    expect(larga.linhas).toHaveLength(128);
    expect(prepararPreviaAscii(larga)).toBe(larga);

    const linhas = Array(80).fill('A'.repeat(250) + 'Z'.repeat(250));
    const cores = Array.from({ length: 80 }, () => [
      ...Array(250).fill('#112233'),
      ...Array(250).fill('#445566'),
    ]);
    const arte = { colunas: 500, linhas, inverter: true, cores };
    const previa = prepararPreviaAscii(arte);
    expect(previa.colunas).toBeLessThanOrEqual(96);
    expect(previa.linhas.length).toBeLessThanOrEqual(64);
    expect(previa.linhas[0]).toMatch(/^A+Z+$/);
    expect(previa.cores?.[0][0]).toBe('#112233');
    expect(previa.cores?.[0].at(-1)).toBe('#445566');
    expect(textoAscii(arte).split('\n')[0]).toHaveLength(500);
  });

  it('preenche os bits da célula Braille 2 × 4 em ordem Unicode', () => {
    const pixels = imagem([
      [[80, 0, 0, 255], BRANCO],
      [BRANCO, [0, 0, 80, 255]],
      [[0, 10, 0, 255], BRANCO],
      [BRANCO, TRANSPARENTE],
    ]);
    expect(converterAscii(pixels, { colunas: 1, conjunto: 'braille', colorido: true })).toEqual({
      colunas: 1,
      linhas: ['⠕'],
      inverter: false,
      cores: [['#1b031b']],
    });
    const vazia = imagem(Array.from({ length: 4 }, () => [BRANCO, BRANCO]));
    expect(converterAscii(vazia, { colunas: 1, conjunto: 'braille' }).linhas).toEqual(['\u2800']);
  });

  it('preserva espaços no texto e escapa letras e cores editadas no HTML', () => {
    const arte = {
      colunas: 4,
      linhas: ['<x&>', '\"  '],
      inverter: false,
      cores: [['#12ab34', '#12ab34', '#fff\" onmouseover=1', null], [null, null, null]],
    };
    expect(textoAscii(arte)).toBe('<x&>\n\"  ');
    const html = htmlAscii(arte);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<span style="color:#12ab34">&lt;x</span>&amp;&gt;\n&quot;  ');
    expect(html).not.toContain('onmouseover');
  });

  it('desenha letras coloridas dentro da área sem preencher células vazias', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      beginPath: vi.fn(),
      fillText: vi.fn(),
    };
    desenharAscii(ctx as unknown as CanvasRenderingContext2D, {
      colunas: 2,
      linhas: ['@ ', '\u2800█'],
      inverter: false,
      cores: [['#ff0000', null], [null, '#0000ff']],
    }, {
      x: 10, y: 20, width: 40, height: 80,
    });
    expect(ctx.rect).toHaveBeenCalledWith(10, 20, 40, 80);
    expect(ctx.fillText.mock.calls).toEqual([['@', 20, 40, 20], ['█', 40, 80, 20]]);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
