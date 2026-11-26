import type { Point } from '../layers/types';
import { desenharGradiente, type ConfigGradiente } from './gradiente';
import { definirFerramenta, type ToolCtx } from './tool';

/** Arraste no papel: do ponto inicial (Cor 1) ao final (Cor 2 ou transparente). */
export const gradiente = definirFerramenta(
  { id: 'gradient', nome: 'Gradiente', icone: 'color', atalho: 'G' },
  () => {
    let gesto: { inicio: Point; fim: Point; inverter: boolean } | null = null;

    function configurar(ctx: ToolCtx): ConfigGradiente | null {
      if (!gesto) return null;
      const { cor1, cor2, formaGradiente, gradienteTransparente } = ctx.opcoes;
      // Botão direito começa na Cor 2, como no balde.
      const [primeira, segunda] = gesto.inverter ? [cor2, cor1] : [cor1, cor2];
      return {
        forma: formaGradiente,
        inicio: gesto.inicio,
        fim: gesto.fim,
        cor1: primeira,
        cor2: segunda,
        ...(gradienteTransparente ? { transparente: true } : {}),
        ...(ctx.selecao && ctx.selecao.width && ctx.selecao.height
          ? {
              recorte: {
                area: ctx.selecao,
                ...(ctx.mascaraSelecao ? { mascara: ctx.mascaraSelecao } : {}),
              },
            }
          : {}),
      };
    }

    return {
      cursor: () => 'crosshair',
      onPointerDown(_ctx, { ponto, botao }) {
        gesto = { inicio: ponto, fim: ponto, inverter: botao === 2 };
      },
      onPointerMove(_ctx, { ponto, shift }) {
        if (!gesto) return;
        gesto.fim = shift ? prenderEm45(gesto.inicio, ponto) : ponto;
      },
      onPointerUp(ctx, { ponto, shift }) {
        if (!gesto) return;
        gesto.fim = shift ? prenderEm45(gesto.inicio, ponto) : ponto;
        const config = configurar(ctx);
        const { inicio, fim } = gesto;
        gesto = null;
        // Um clique sem arrastar não pinta nada.
        if (!config || Math.hypot(fim.x - inicio.x, fim.y - inicio.y) < 2) return;
        ctx.executar({ tipo: 'Gradiente', ...config });
      },
      onCancel() {
        gesto = null;
      },
      limitesOverlay(ctx) {
        return gesto ? { x: 0, y: 0, width: ctx.largura, height: ctx.altura } : null;
      },
      overlay(ctx, grafico) {
        const config = configurar(ctx);
        if (!config || !gesto) return;
        const area = config.recorte?.area ?? { x: 0, y: 0, width: ctx.largura, height: ctx.altura };
        grafico.save();
        grafico.globalAlpha = 0.85;
        desenharGradiente(grafico, config, area);
        grafico.restore();
        // A linha do arraste, com pontas.
        const { zoom } = ctx.opcoes;
        grafico.save();
        grafico.lineWidth = 2 / zoom;
        grafico.strokeStyle = '#ffffff';
        grafico.beginPath();
        grafico.moveTo(gesto.inicio.x, gesto.inicio.y);
        grafico.lineTo(gesto.fim.x, gesto.fim.y);
        grafico.stroke();
        grafico.lineWidth = 1 / zoom;
        grafico.strokeStyle = '#1d6eb0';
        grafico.stroke();
        for (const ponto of [gesto.inicio, gesto.fim]) {
          grafico.beginPath();
          grafico.arc(ponto.x, ponto.y, 4 / zoom, 0, 2 * Math.PI);
          grafico.fillStyle = '#ffffff';
          grafico.fill();
          grafico.stroke();
        }
        grafico.restore();
      },
    };
  },
);

function prenderEm45(origem: Point, ponto: Point): Point {
  const angulo = Math.atan2(ponto.y - origem.y, ponto.x - origem.x);
  const preso = (Math.round(angulo / (Math.PI / 4)) * Math.PI) / 4;
  const distancia = Math.hypot(ponto.x - origem.x, ponto.y - origem.y);
  return { x: origem.x + Math.cos(preso) * distancia, y: origem.y + Math.sin(preso) * distancia };
}
