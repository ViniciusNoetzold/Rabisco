import { describe, expect, it, vi } from 'vitest';
import type { Rect } from '../../src/layers/types';
import { PARAMETROS_PADRAO } from '../../src/shapes/tipos';
import type { EventoFerramenta, ToolCtx } from '../../src/tools/tool';
import { criarFerramentas, toolRegistry } from '../../src/tools/toolRegistry';

function ponteiro(x: number, y: number, botao = 0, shift = false): EventoFerramenta {
  return { ponto: { x, y }, botao, shift };
}

function contexto(selecao: Rect | null = null, pincel: ToolCtx['opcoes']['pincel'] = 'redondo') {
  const executar = vi.fn<ToolCtx['executar']>(() => true);
  const imagem = { width: 5, height: 4, data: new Uint8ClampedArray(80) } as ImageData;
  const recorte = { imagem: {} as HTMLCanvasElement, corte: null };
  const ctx = {
    largura: 30,
    altura: 30,
    opcoes: {
      cor1: '#3083c5',
      cor2: '#ff0000',
      espessura: 6,
      pincel,
      densidadeSpray: 'media',
      forma: 'rectangle',
      contornoForma: 'solid',
      preenchimentoForma: 'solid',
      parametrosForma: { ...PARAMETROS_PADRAO },
      zoom: 1,
    } as ToolCtx['opcoes'],
    selecao,
    executar,
    selecionar: vi.fn<ToolCtx['selecionar']>(),
    capturarCor: vi.fn<ToolCtx['capturarCor']>(),
    lerPixels: vi.fn<ToolCtx['lerPixels']>(() => imagem),
    previsualizarTraco: vi.fn<ToolCtx['previsualizarTraco']>(),
    iniciarPreviaPincel: vi.fn<ToolCtx['iniciarPreviaPincel']>(),
    previsualizarMarcasPincel: vi.fn<ToolCtx['previsualizarMarcasPincel']>(),
    prepararRecorte: vi.fn<ToolCtx['prepararRecorte']>(() => recorte),
    previsualizarSelecao: vi.fn<ToolCtx['previsualizarSelecao']>(),
    limparPrevia: vi.fn<ToolCtx['limparPrevia']>(),
  } satisfies ToolCtx;
  return { ctx, recorte };
}

describe('registro de ferramentas', () => {
  it('registra as ferramentas clássicas e a galeria de formas com atalhos únicos', () => {
    const ids = [
      'pencil',
      'brush',
      'eraser',
      'fill',
      'line',
      'rectangle',
      'ellipse',
      'shape',
      'select',
      'lasso',
      'text',
      'zoom',
      'eyedropper',
      'move',
      'transform',
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
    expect(ctx.previsualizarMarcasPincel).toHaveBeenCalledTimes(1);
    expect(ctx.executar).not.toHaveBeenCalled();
    primeiro.onPointerMove(ctx, movimento);
    primeiro.onPointerUp(ctx, movimento);
    expect(ctx.executar).toHaveBeenCalledOnce();
    const [comando] = ctx.executar.mock.calls[0];
    expect(comando).toMatchObject({
      tipo: 'Pincelar',
      configuracao: { tipo: 'redondo', cor: '#ff0000', espessura: 6, semente: expect.any(Number) },
    });
    if (comando.tipo !== 'Pincelar') throw new Error('O gesto precisa gerar uma pincelada.');
    expect(comando.marcas[0]).toMatchObject(inicio.ponto);
    expect(comando.marcas.at(-1)).toMatchObject(movimento.ponto);
    expect(comando.marcas).toEqual(
      ctx.previsualizarMarcasPincel.mock.calls.flatMap(([marcas]) => marcas),
    );
  });

  it('cancela o próximo quadro do spray sem confirmar o gesto', () => {
    const { ctx } = contexto(null, 'spray');
    const ferramenta = criarFerramentas().brush;
    const quadros = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      quadros.set(++id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (quadro: number) => quadros.delete(quadro));
    try {
      const inicio = ponteiro(2, 3);
      ferramenta.onPointerDown(ctx, inicio);
      const callback = quadros.get(1)!;
      quadros.delete(1);
      callback(performance.now() + 50);
      expect(ctx.previsualizarMarcasPincel).toHaveBeenCalledTimes(2);
      expect(quadros.size).toBe(1);
      ferramenta.onCancel?.(ctx);
      expect(quadros.size).toBe(0);
      ferramenta.onPointerUp(ctx, inicio);
      expect(ctx.limparPrevia).toHaveBeenCalledOnce();
      expect(ctx.executar).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('mantém a forma editável com o Shift da soltura e aplica o estilo atual ao confirmar', () => {
    const { ctx } = contexto();
    const ferramenta = criarFerramentas().rectangle;
    const inicio = ponteiro(1, 6);
    ferramenta.onPointerDown(ctx, inicio);
    ferramenta.onPointerMove(ctx, ponteiro(12, 20));
    expect(ctx.executar).not.toHaveBeenCalled();
    const fim = ponteiro(11, 19, 0, true);
    ferramenta.onPointerUp(ctx, fim);
    expect(ferramenta.temPendente?.()).toBe(true);
    expect(ctx.executar).not.toHaveBeenCalled();
    ctx.opcoes.cor2 = '#70a54a';
    ferramenta.commitPendente?.(ctx);
    expect(ctx.executar).toHaveBeenCalledExactlyOnceWith({
      tipo: 'AplicarForma',
      configuracao: {
        id: 'rectangle',
        caixa: { x: 1, y: 6, width: 13, height: 13 },
        rotacao: 0,
        cor1: '#3083c5',
        cor2: '#70a54a',
        espessura: 6,
        contorno: 'solid',
        preenchimento: 'solid',
        parametros: PARAMETROS_PADRAO,
      },
    });
    expect(ferramenta.temPendente?.()).toBe(false);
  });

  it('redimensiona, move e gira uma estrela sem pintar antes do Enter', () => {
    const { ctx } = contexto();
    ctx.largura = 400;
    ctx.altura = 300;
    ctx.opcoes.forma = 'estrela-5';
    const ferramenta = criarFerramentas().shape;
    const arrastar = (x: number, y: number, novoX: number, novoY: number) => {
      ferramenta.onPointerDown(ctx, ponteiro(x, y));
      ferramenta.onPointerMove(ctx, ponteiro(novoX, novoY));
      ferramenta.onPointerUp(ctx, ponteiro(novoX, novoY));
    };
    arrastar(60, 80, 160, 160);
    arrastar(160, 120, 190, 120);
    arrastar(125, 120, 150, 150);
    arrastar(150, 84, 216, 150);
    expect(ctx.executar).not.toHaveBeenCalled();
    expect(ferramenta.onKeyDown?.(ctx, { key: 'Enter' } as KeyboardEvent)).toBe(true);
    expect(ctx.executar).toHaveBeenCalledOnce();
    const comando = ctx.executar.mock.calls[0][0];
    expect(comando).toMatchObject({
      tipo: 'AplicarForma',
      configuracao: { id: 'estrela-5', caixa: { x: 85, y: 110, width: 130, height: 80 } },
    });
    if (comando.tipo !== 'AplicarForma') throw new Error('A estrela precisa gerar uma forma.');
    expect(comando.configuracao.rotacao).toBeCloseTo(Math.PI / 2);
  });

  it('coleta dois controles da curva e descarta a forma com Escape', () => {
    const { ctx } = contexto();
    ctx.opcoes.forma = 'curve';
    const ferramenta = criarFerramentas().shape;
    const arrastar = (x: number, y: number, novoX: number, novoY: number) => {
      ferramenta.onPointerDown(ctx, ponteiro(x, y));
      ferramenta.onPointerUp(ctx, ponteiro(novoX, novoY));
    };
    arrastar(1, 10, 21, 10);
    arrastar(5, 5, 6, 2);
    arrastar(16, 15, 16, 22);
    expect(ctx.executar).not.toHaveBeenCalled();
    ferramenta.commitPendente?.(ctx);
    const comando = ctx.executar.mock.calls[0][0];
    expect(comando).toMatchObject({
      tipo: 'AplicarForma',
      configuracao: {
        id: 'curve',
        caixa: { x: 1, y: 2, width: 20, height: 20 },
        pontos: [
          { x: 0, y: 0.4 },
          { x: 1, y: 0.4 },
          { x: 0.25, y: 0 },
          { x: 0.75, y: 1 },
        ],
      },
    });
    ctx.executar.mockClear();
    arrastar(1, 10, 21, 10);
    expect(ferramenta.onKeyDown?.(ctx, { key: 'Escape' } as KeyboardEvent)).toBe(true);
    ferramenta.commitPendente?.(ctx);
    expect(ctx.executar).not.toHaveBeenCalled();
  });

  it.each(['primeiro vértice', 'clique duplo'] as const)(
    'fecha o polígono pelo %s e confirma uma vez',
    (fechamento) => {
      const { ctx } = contexto();
      ctx.opcoes.forma = 'polygon';
      const ferramenta = criarFerramentas().shape;
      function clicar(x: number, y: number, shift = false, cliques = 1) {
        const evento = { ...ponteiro(x, y, 0, shift), cliques };
        ferramenta.onPointerDown(ctx, evento);
        ferramenta.onPointerUp(ctx, evento);
      }
      clicar(2, 3);
      clicar(16, 3);
      clicar(18, 23, true);
      if (fechamento === 'primeiro vértice') clicar(2, 3);
      else clicar(16, 23, false, 2);
      expect(ctx.executar).not.toHaveBeenCalled();
      expect(ferramenta.temPendente?.()).toBe(true);
      ferramenta.commitPendente?.(ctx);
      expect(ctx.executar).toHaveBeenCalledOnce();
      expect(ctx.executar.mock.calls[0][0]).toMatchObject({
        tipo: 'AplicarForma',
        configuracao: {
          id: 'polygon',
          pontos: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
        },
      });
    },
  );

  it('lê somente a origem da seleção na prévia e limita o destino ao papel', () => {
    const origem: Rect = { x: 3, y: 4, width: 5, height: 4 };
    const destino: Rect = { x: 25, y: 26, width: 5, height: 4 };
    const { ctx, recorte } = contexto(origem);
    const ferramenta = criarFerramentas().select;
    ferramenta.onPointerDown(ctx, ponteiro(4, 5));
    ferramenta.onPointerMove(ctx, ponteiro(29, 29));
    expect(ctx.prepararRecorte).toHaveBeenCalledExactlyOnceWith(origem, undefined, undefined);
    expect(ctx.previsualizarSelecao).toHaveBeenCalledExactlyOnceWith(origem, destino, recorte);
    expect(ctx.selecionar).toHaveBeenCalledExactlyOnceWith(destino, undefined);
    expect(ctx.executar).not.toHaveBeenCalled();
    ferramenta.onPointerUp(ctx, ponteiro(29, 29));
    expect(ctx.executar).toHaveBeenCalledExactlyOnceWith({
      tipo: 'MoverSelecao',
      origem,
      destino,
      duplicar: false,
      mascara: undefined,
      corTransparente: undefined,
    });
  });
});
