import { describe, expect, it, vi } from 'vitest';
import type { Rect } from '../../src/layers/types';
import type { EventoFerramenta, ToolCtx } from '../../src/tools/tool';
import { criarFerramentas, toolRegistry } from '../../src/tools/toolRegistry';

function ponteiro(x: number, y: number, botao = 0, shift = false): EventoFerramenta {
  return { ponto: { x, y }, botao, shift };
}

function contexto(selecao: Rect | null = null) {
  const executar = vi.fn<ToolCtx['executar']>(() => true);
  const imagem = { width: 5, height: 4, data: new Uint8ClampedArray(80) } as ImageData;
  const ctx = {
    largura: 30,
    altura: 30,
    opcoes: { cor1: '#3083c5', cor2: '#ff0000', espessura: 6, preenchida: true },
    selecao,
    executar,
    selecionar: vi.fn<ToolCtx['selecionar']>(),
    capturarCor: vi.fn<ToolCtx['capturarCor']>(),
    lerPixels: vi.fn<ToolCtx['lerPixels']>(() => imagem),
    previsualizarTraco: vi.fn<ToolCtx['previsualizarTraco']>(),
    previsualizarSelecao: vi.fn<ToolCtx['previsualizarSelecao']>(),
    limparPrevia: vi.fn<ToolCtx['limparPrevia']>(),
  } satisfies ToolCtx;
  return { ctx, imagem };
}

describe('registro de ferramentas', () => {
  it('registra todas as ferramentas da 0.1 com atalhos únicos', () => {
    const ids = [
      'pencil',
      'brush',
      'eraser',
      'fill',
      'line',
      'rectangle',
      'ellipse',
      'select',
      'eyedropper',
    ] as const;
    expect(Object.keys(toolRegistry).sort()).toEqual([...ids].sort());
    expect(new Set(ids.map((id) => toolRegistry[id].atalho)).size).toBe(ids.length);
    for (const id of ids) {
      const ferramenta = toolRegistry[id].criar();
      expect(ferramenta).toMatchObject({
        id,
        nome: toolRegistry[id].nome,
        icone: toolRegistry[id].icone,
      });
    }
  });

  it('isola os gestos de cada editor e executa uma pincelada só no fim', () => {
    const { ctx } = contexto();
    const primeiro = criarFerramentas().brush;
    const segundo = criarFerramentas().brush;
    const inicio = ponteiro(2, 3, 2);
    const movimento = ponteiro(4, 10);
    primeiro.onPointerDown(ctx, inicio);
    segundo.onPointerMove(ctx, movimento);
    segundo.onPointerUp(ctx, movimento);
    expect(ctx.previsualizarTraco).toHaveBeenCalledTimes(1);
    expect(ctx.executar).not.toHaveBeenCalled();
    primeiro.onPointerMove(ctx, movimento);
    primeiro.onPointerUp(ctx, movimento);
    expect(ctx.executar).toHaveBeenCalledExactlyOnceWith({
      tipo: 'TracarPincel',
      ferramenta: 'brush',
      pontos: [inicio.ponto, movimento.ponto],
      cor: '#ff0000',
      espessura: 6,
    });
  });

  it('cancela a prévia de um traço sem criar comando', () => {
    const { ctx } = contexto();
    const ferramenta = criarFerramentas().pencil;
    const inicio = ponteiro(1, 6);
    ferramenta.onPointerDown(ctx, inicio);
    ferramenta.onCancel?.(ctx);
    ferramenta.onPointerUp(ctx, inicio);
    expect(ctx.limparPrevia).toHaveBeenCalledTimes(1);
    expect(ctx.executar).not.toHaveBeenCalled();
  });

  it('confirma a forma com o ponto final e Shift do evento de soltura', () => {
    const { ctx } = contexto();
    const ferramenta = criarFerramentas().rectangle;
    const inicio = ponteiro(1, 6);
    ferramenta.onPointerDown(ctx, inicio);
    ferramenta.onPointerMove(ctx, ponteiro(12, 20));
    expect(ctx.executar).not.toHaveBeenCalled();
    const fim = ponteiro(11, 19, 0, true);
    ferramenta.onPointerUp(ctx, fim);
    expect(ctx.executar).toHaveBeenCalledExactlyOnceWith({
      tipo: 'DesenharForma',
      forma: 'rectangle',
      inicio: inicio.ponto,
      fim: fim.ponto,
      cor: '#3083c5',
      espessura: 6,
      preenchida: true,
      restringir: true,
    });
  });

  it('lê somente a origem da seleção na prévia e limita o destino ao papel', () => {
    const origem: Rect = { x: 3, y: 4, width: 5, height: 4 };
    const destino: Rect = { x: 25, y: 26, width: 5, height: 4 };
    const { ctx, imagem } = contexto(origem);
    const ferramenta = criarFerramentas().select;
    ferramenta.onPointerDown(ctx, ponteiro(4, 5));
    ferramenta.onPointerMove(ctx, ponteiro(29, 29));
    expect(ctx.lerPixels).toHaveBeenCalledExactlyOnceWith(origem);
    expect(ctx.previsualizarSelecao).toHaveBeenCalledExactlyOnceWith(origem, destino, imagem);
    expect(ctx.selecionar).toHaveBeenCalledExactlyOnceWith(destino);
    expect(ctx.executar).not.toHaveBeenCalled();
    ferramenta.onPointerUp(ctx, ponteiro(29, 29));
    expect(ctx.executar).toHaveBeenCalledExactlyOnceWith({ tipo: 'MoverSelecao', origem, destino });
  });
});
