import type { Point } from '../layers/types';
import { definirFerramenta } from './tool';

/**
 * Mover (V): arrasta a camada ativa inteira (com a máscara). Durante o arraste um contorno
 * tracejado mostra para onde ela vai; ao soltar, um único item entra no histórico.
 */
export const mover = definirFerramenta(
  { id: 'move', nome: 'Mover camada', icone: 'arrow-switch', atalho: 'V' },
  () => {
    let inicio: Point | null = null;
    let deslocamento = { x: 0, y: 0 };
    return {
      cursor: () => 'move',
      onPointerDown(_ctx, { ponto }) {
        inicio = ponto;
        deslocamento = { x: 0, y: 0 };
      },
      onPointerMove(_ctx, { ponto }) {
        if (!inicio) return;
        deslocamento = { x: Math.round(ponto.x - inicio.x), y: Math.round(ponto.y - inicio.y) };
      },
      onPointerUp(ctx) {
        const { x, y } = deslocamento;
        inicio = null;
        deslocamento = { x: 0, y: 0 };
        if (x || y) ctx.executar({ tipo: 'DeslocarCamada', id: ctx.camadaAtiva, dx: x, dy: y });
      },
      onCancel() {
        inicio = null;
        deslocamento = { x: 0, y: 0 };
      },
      overlay(ctx, grafico) {
        if (!inicio) return;
        grafico.save();
        grafico.setLineDash([6 / ctx.opcoes.zoom, 4 / ctx.opcoes.zoom]);
        grafico.strokeStyle = '#2f7fc1';
        grafico.lineWidth = 2 / ctx.opcoes.zoom;
        grafico.strokeRect(deslocamento.x, deslocamento.y, ctx.largura, ctx.altura);
        grafico.restore();
      },
    };
  },
);
