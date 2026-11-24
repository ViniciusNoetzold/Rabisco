import type { Point } from '../layers/types';
import { definirFerramenta, type ToolCtx } from './tool';

const LADO = 7;
const CENTRO = Math.floor(LADO / 2);

function geometriaDaLupa(ctx: ToolCtx, ponto: Point) {
  const celula = Math.min(12 / ctx.opcoes.zoom, ctx.largura / (LADO + 2), ctx.altura / (LADO + 2));
  const lado = celula * LADO;
  const margem = Math.min(celula / 2, 3 / ctx.opcoes.zoom);
  function posicionar(coordenada: number, limite: number) {
    const depois = coordenada + celula * 1.5;
    const antes = coordenada - celula * 1.5 - lado;
    const destino = depois + lado + margem <= limite ? depois : antes;
    return Math.max(margem, Math.min(limite - lado - margem, destino));
  }
  return {
    x: posicionar(ponto.x, ctx.largura),
    y: posicionar(ponto.y, ctx.altura),
    celula,
    lado,
    margem,
  };
}

export const contaGotas = definirFerramenta(
  { id: 'eyedropper', nome: 'Conta-gotas', icone: 'pipette', atalho: 'I' },
  () => {
    let pixel: Point | null = null;

    return {
      cursor: () => 'copy',
      onPointerDown() {},
      onPointerMove() {},
      onPointerUp(ctx, { ponto, botao }) {
        pixel = null;
        ctx.capturarCor(ponto, botao === 2 ? 2 : 1);
      },
      onHover(_ctx, { ponto }) {
        const x = Math.floor(ponto.x);
        const y = Math.floor(ponto.y);
        if (pixel?.x === x && pixel.y === y) return false;
        pixel = { x, y };
        return true;
      },
      onPointerLeave() {
        const visivel = Boolean(pixel);
        pixel = null;
        return visivel;
      },
      limitesOverlay(ctx) {
        if (!pixel) return null;
        const { x, y, lado, margem } = geometriaDaLupa(ctx, pixel);
        return {
          x: x - margem - 1,
          y: y - margem - 1,
          width: lado + margem * 2 + 2,
          height: lado + margem * 2 + 2,
        };
      },
      overlay(ctx, grafico) {
        if (!pixel) return;
        const { x, y, celula, lado, margem } = geometriaDaLupa(ctx, pixel);
        const { data } = ctx.lerPixels({
          x: pixel.x - CENTRO,
          y: pixel.y - CENTRO,
          width: LADO,
          height: LADO,
        });
        grafico.save();
        grafico.fillStyle = '#203145';
        grafico.fillRect(x - margem, y - margem, lado + margem * 2, lado + margem * 2);
        for (let linha = 0; linha < LADO; linha++) {
          for (let coluna = 0; coluna < LADO; coluna++) {
            const offset = (linha * LADO + coluna) * 4;
            const esquerda = x + coluna * celula;
            const topo = y + linha * celula;
            const alfa = data[offset + 3] / 255;
            if (alfa < 1) {
              grafico.fillStyle = (linha + coluna) % 2 === 0 ? '#ffffff' : '#c5d2df';
              grafico.fillRect(esquerda, topo, celula, celula);
            }
            grafico.fillStyle = `rgba(${data[offset]}, ${data[offset + 1]}, ${data[offset + 2]}, ${alfa})`;
            grafico.fillRect(esquerda, topo, celula, celula);
          }
        }
        const centralX = x + CENTRO * celula;
        const centralY = y + CENTRO * celula;
        grafico.strokeStyle = '#ffffff';
        grafico.lineWidth = Math.min(3 / ctx.opcoes.zoom, celula / 3);
        grafico.strokeRect(centralX, centralY, celula, celula);
        grafico.strokeStyle = '#203145';
        grafico.lineWidth /= 3;
        grafico.strokeRect(centralX, centralY, celula, celula);
        grafico.restore();
      },
    };
  },
);
