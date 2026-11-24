import type { Point } from '../layers/types';
import {
  corDoBotao,
  definirFerramenta,
  opcaoEspessura,
  type EstiloTraco,
  type Tool,
  type ToolCtx,
} from './tool';

type GestoTraco = Pick<Tool, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onCancel'>;

export function criarGestoTraco(
  estiloDoGesto: (ctx: ToolCtx, botao: number) => EstiloTraco,
): GestoTraco {
  let gesto: { pontos: Point[]; estilo: EstiloTraco } | null = null;
  return {
    onPointerDown(ctx, { ponto, botao }) {
      const estilo = estiloDoGesto(ctx, botao);
      gesto = { pontos: [ponto], estilo };
      ctx.selecionar(null);
      ctx.previsualizarTraco(ponto, ponto, estilo);
    },
    onPointerMove(ctx, { ponto }) {
      if (!gesto) return;
      const anterior = gesto.pontos[gesto.pontos.length - 1];
      gesto.pontos.push(ponto);
      ctx.previsualizarTraco(anterior, ponto, gesto.estilo);
    },
    onPointerUp(ctx, { ponto }) {
      if (!gesto) return;
      const { pontos, estilo } = gesto;
      gesto = null;
      const ultimo = pontos[pontos.length - 1];
      if (ultimo.x !== ponto.x || ultimo.y !== ponto.y) pontos.push(ponto);
      ctx.limparPrevia();
      ctx.executar({ tipo: 'TracarPincel', pontos, ...estilo });
    },
    onCancel(ctx) {
      gesto = null;
      ctx.limparPrevia();
    },
  };
}

export function definirTraco(
  id: EstiloTraco['ferramenta'],
  nome: string,
  icone: string,
  atalho: string,
) {
  return definirFerramenta(
    { id, nome, icone, atalho, opcoes: id === 'pencil' ? undefined : [opcaoEspessura] },
    () => ({
      cursor: () => 'crosshair',
      ...criarGestoTraco((ctx, botao) => ({
        ferramenta: id,
        cor: corDoBotao(ctx, botao),
        espessura: id === 'pencil' ? 1 : ctx.opcoes.espessura,
      })),
    }),
  );
}
