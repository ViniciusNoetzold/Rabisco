import type { Point, Rect } from '../layers/types';
import { normalizeRect } from './pixels';
import { definirFerramenta } from './tool';

type GestoSelecao =
  | { tipo: 'marcar'; inicio: Point }
  | { tipo: 'mover'; inicio: Point; origem: Rect; destino: Rect; imagem: ImageData };

function contem(area: Rect, ponto: Point): boolean {
  return (
    ponto.x >= area.x &&
    ponto.x < area.x + area.width &&
    ponto.y >= area.y &&
    ponto.y < area.y + area.height
  );
}

export const selecao = definirFerramenta(
  { id: 'select', nome: 'Seleção', icone: 'selection', atalho: 'S' },
  () => {
    let gesto: GestoSelecao | null = null;
    return {
      cursor: () => 'crosshair',
      onPointerDown(ctx, { ponto }) {
        const origem = ctx.selecao;
        if (origem && contem(origem, ponto)) {
          gesto = {
            tipo: 'mover',
            inicio: ponto,
            origem,
            destino: origem,
            imagem: ctx.lerPixels(origem),
          };
          return;
        }
        gesto = { tipo: 'marcar', inicio: ponto };
        ctx.selecionar(null);
      },
      onPointerMove(ctx, { ponto }) {
        if (!gesto) return;
        if (gesto.tipo === 'marcar') {
          ctx.selecionar(
            normalizeRect(gesto.inicio, ponto, { width: ctx.largura, height: ctx.altura }),
          );
          return;
        }
        const { origem, inicio, imagem } = gesto;
        const x = Math.round(
          Math.max(0, Math.min(ctx.largura - origem.width, origem.x + ponto.x - inicio.x)),
        );
        const y = Math.round(
          Math.max(0, Math.min(ctx.altura - origem.height, origem.y + ponto.y - inicio.y)),
        );
        gesto.destino = { ...origem, x, y };
        ctx.previsualizarSelecao(origem, gesto.destino, imagem);
        ctx.selecionar(gesto.destino);
      },
      onPointerUp(ctx) {
        const concluido = gesto;
        gesto = null;
        if (concluido?.tipo !== 'mover') return;
        ctx.limparPrevia();
        const { origem, destino } = concluido;
        if (origem.x !== destino.x || origem.y !== destino.y) {
          ctx.executar({ tipo: 'MoverSelecao', origem, destino });
        }
      },
      onCancel(ctx) {
        gesto = null;
        ctx.limparPrevia();
        ctx.selecionar(null);
      },
    };
  },
);
