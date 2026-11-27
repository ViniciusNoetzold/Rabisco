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

function alinharPonto(ponto: Point, estilo: EstiloTraco): Point {
  if (!estilo.pixelArt) return ponto;
  // O centro da célula também cai no pixel correto ao espelhar sobre a borda do papel.
  return { ...ponto, x: Math.floor(ponto.x) + 0.5, y: Math.floor(ponto.y) + 0.5 };
}

export function criarGestoTraco(
  estiloDoGesto: (ctx: ToolCtx, botao: number) => EstiloTraco,
): GestoTraco {
  let gesto: { pontos: Point[]; estilo: EstiloTraco } | null = null;
  return {
    onPointerDown(ctx, { ponto, botao }) {
      const estilo = estiloDoGesto(ctx, botao);
      const inicio = alinharPonto(ponto, estilo);
      gesto = { pontos: [inicio], estilo };
      ctx.selecionar(null);
      ctx.previsualizarTraco(inicio, inicio, estilo);
    },
    onPointerMove(ctx, { ponto }) {
      if (!gesto) return;
      const anterior = gesto.pontos[gesto.pontos.length - 1];
      const atual = alinharPonto(ponto, gesto.estilo);
      if (gesto.estilo.pixelArt && anterior.x === atual.x && anterior.y === atual.y) return;
      gesto.pontos.push(atual);
      ctx.previsualizarTraco(anterior, atual, gesto.estilo);
    },
    onPointerUp(ctx, { ponto }) {
      if (!gesto) return;
      const { pontos, estilo } = gesto;
      gesto = null;
      const ultimo = pontos[pontos.length - 1];
      const fim = alinharPonto(ponto, estilo);
      if (ultimo.x !== fim.x || ultimo.y !== fim.y) pontos.push(fim);
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
        pixelArt: id === 'pencil' && ctx.opcoes.modoPixelArt ? true : undefined,
      })),
    }),
  );
}
