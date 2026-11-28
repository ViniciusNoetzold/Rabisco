import { describe, expect, it, vi } from 'vitest';
import {
  prepararPreenchimentoEmFaixas,
  type PlanoDoBalde,
} from '../../src/canvas/controle/preenchedor';
import type { Comando } from '../../src/commands/comandos';
import { Executador } from '../../src/commands/executador';
import { recortarPixels } from '../../src/commands/history';
import type { PixelBuffer, Rect } from '../../src/layers/types';
import { aplicarPreenchimento, preservarAlfa } from '../../src/tools/pixels';
import { documentoFalso } from './documentoFalso';

function papel(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
}

describe('preenchimento em faixas', () => {
  it('aplica o plano de um recorte deslocado com o mesmo alfa do caminho síncrono', async () => {
    const pixels = papel(352, 290);
    pixels.data[(20 * pixels.width + 31) * 4 + 3] = 0;
    pixels.data[(21 * pixels.width + 31) * 4 + 3] = 98;
    const area = { x: 15, y: 10, width: 280, height: 245 };
    const mascara = new Uint8Array(pixels.width * pixels.height).map((_, i) => (i % 5 ? 1 : 0));
    const plano: NonNullable<PlanoDoBalde> = {
      area,
      largura: pixels.width,
      mascara,
      cor: [40, 80, 120, 255],
    };
    const original = recortarPixels(pixels, area);
    const preenchido = recortarPixels(pixels, area);
    aplicarPreenchimento(preenchido, plano, area);
    const lerFaixa = vi.fn((faixa: Rect) => recortarPixels(pixels, faixa));
    const preparado = await prepararPreenchimentoEmFaixas(plano, lerFaixa, () => true, {
      aguardarQuadro: async () => {},
      travarAlfa: true,
    });
    const esperado = preservarAlfa(original, preenchido);
    expect(preparado?.before.data.every((byte, i) => byte === original.data[i])).toBe(true);
    expect(preparado?.after.data.every((byte, i) => byte === esperado.data[i])).toBe(true);
    expect(lerFaixa.mock.calls.length).toBeGreaterThan(1);
  });

  it('descarta resultados ao cancelar depois de preparar um quadro', async () => {
    const before = papel(1024, 600);
    const area = { x: 0, y: 0, width: before.width, height: before.height };
    const mascara = new Uint8Array(before.width * before.height).fill(1);
    const plano: NonNullable<PlanoDoBalde> = {
      area,
      largura: before.width,
      mascara,
      cor: [40, 80, 120, 255],
    };
    const lerFaixa = vi.fn((faixa: Rect) => recortarPixels(before, faixa));
    let quadros = 0;
    const preparado = await prepararPreenchimentoEmFaixas(plano, lerFaixa, () => quadros < 2, {
      aguardarQuadro: async () => {
        quadros++;
      },
    });
    expect(preparado).toBeNull();
    expect(lerFaixa.mock.calls.length).toBeGreaterThan(0);
    expect(lerFaixa.mock.calls.length).toBeLessThan(10);
    expect(before.data.every((byte) => byte === 255)).toBe(true);
  });

  it('publica os pixels preparados com um comando e uma gravação reversível', async () => {
    const before = papel(32, 28);
    const doc = documentoFalso(before);
    const executor = new Executador(doc);
    const alvo = doc.alvoAtivo();
    const rect = { x: 0, y: 0, width: before.width, height: before.height };
    const plano: NonNullable<PlanoDoBalde> = {
      area: rect,
      largura: before.width,
      mascara: new Uint8Array(rect.width * rect.height).fill(1),
      cor: [40, 80, 120, 255],
    };
    const comando: Extract<Comando, { tipo: 'Preencher' }> = {
      tipo: 'Preencher',
      ponto: { x: 1, y: 2 },
      cor: '#285078',
      tolerancia: 0,
    };
    const lerFaixa = vi.fn((faixa: Rect) => doc.lerPixels(faixa));
    const preparado = await prepararPreenchimentoEmFaixas(plano, lerFaixa, () => true, {
      antesCompleto: before,
      aguardarQuadro: async () => {},
    });
    expect(lerFaixa).not.toHaveBeenCalled();
    expect(doc.aplicarPixels).not.toHaveBeenCalled();
    expect(preparado?.before).toBe(before);
    executor.usarPreenchimentoPronto(comando, { ...preparado!, alvo, rect });
    expect(executor.executar(comando)).toBe(true);
    expect(doc.aplicarPixels).toHaveBeenCalledTimes(1);
    expect(executor.historico.entries).toEqual([{ label: 'Preenchimento' }]);
    expect(doc.raster).toEqual(preparado?.after);
    expect(executor.desfazer()).toBe(true);
    expect(doc.raster).toEqual(before);
    expect(executor.refazer()).toBe(true);
    expect(doc.raster).toEqual(preparado?.after);
  });

  it('cancela e libera a espera mesmo se o próximo quadro estiver suspenso', async () => {
    const before = papel(32, 28);
    const area = { x: 0, y: 0, width: before.width, height: before.height };
    const plano: NonNullable<PlanoDoBalde> = {
      area,
      largura: before.width,
      mascara: new Uint8Array(area.width * area.height).fill(1),
      cor: [40, 80, 120, 255],
    };
    const documento = { hidden: false };
    const agendar = vi.fn(() => 37);
    const remover = vi.fn();
    const lerFaixa = vi.fn((faixa: Rect) => recortarPixels(before, faixa));
    const cancelamento = new AbortController();
    vi.stubGlobal('document', documento);
    vi.stubGlobal('requestAnimationFrame', agendar);
    vi.stubGlobal('cancelAnimationFrame', remover);
    try {
      const preparado = prepararPreenchimentoEmFaixas(plano, lerFaixa, () => true, {
        sinal: cancelamento.signal,
      });
      expect(agendar).toHaveBeenCalledTimes(1);
      documento.hidden = true;
      cancelamento.abort();
      await expect(preparado).resolves.toBeNull();
      expect(remover).toHaveBeenCalledWith(37);
      expect(lerFaixa).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
