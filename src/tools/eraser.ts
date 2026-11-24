import type { Point } from '../layers/types';
import { toleranciaEmCanais } from './pixels';
import { definirFerramenta, opcaoEspessura } from './tool';
import { criarGestoTraco } from './traco';

export const borracha = definirFerramenta(
  { id: 'eraser', nome: 'Borracha', icone: 'eraser', atalho: 'E', opcoes: [opcaoEspessura] },
  () => {
    let centro: Point | null = null;
    let espessuraAtiva: number | null = null;
    const traco = criarGestoTraco((ctx, botao) => ({
      ferramenta: 'eraser',
      cor: ctx.opcoes.cor2,
      espessura: ctx.opcoes.espessuraBorracha,
      ...(botao === 2 && {
        substituirCor: ctx.opcoes.cor1,
        toleranciaSubstituicao: toleranciaEmCanais(ctx.opcoes.toleranciaBorracha),
      }),
    }));

    return {
      cursor: () => 'none',
      onHover(_ctx, { ponto }) {
        centro = ponto;
        return true;
      },
      onPointerDown(ctx, evento) {
        centro = evento.ponto;
        espessuraAtiva = ctx.opcoes.espessuraBorracha;
        traco.onPointerDown(ctx, evento);
      },
      onPointerMove(ctx, evento) {
        centro = evento.ponto;
        traco.onPointerMove(ctx, evento);
      },
      onPointerUp(ctx, evento) {
        espessuraAtiva = null;
        traco.onPointerUp(ctx, evento);
      },
      onCancel(ctx) {
        centro = null;
        espessuraAtiva = null;
        traco.onCancel?.(ctx);
      },
      onPointerLeave() {
        const visivel = Boolean(centro);
        centro = null;
        return visivel;
      },
      limitesOverlay({ opcoes }) {
        if (!centro) return null;
        const margem = (espessuraAtiva ?? opcoes.espessuraBorracha) / 2 + 2 / opcoes.zoom + 1;
        return {
          x: centro.x - margem,
          y: centro.y - margem,
          width: margem * 2,
          height: margem * 2,
        };
      },
      overlay({ opcoes }, grafico) {
        if (!centro) return;
        const raio = (espessuraAtiva ?? opcoes.espessuraBorracha) / 2;
        grafico.save();
        grafico.beginPath();
        grafico.arc(centro.x, centro.y, raio, 0, 2 * Math.PI);
        grafico.strokeStyle = '#ffffff';
        grafico.lineWidth = 3 / opcoes.zoom;
        grafico.stroke();
        grafico.strokeStyle = '#203145';
        grafico.lineWidth = 1 / opcoes.zoom;
        grafico.stroke();
        grafico.restore();
      },
    };
  },
);
