import {
  combinarMascaras,
  contornosDaMascara,
  juntarContornos,
  limitesDaMascara,
  type MascaraPixels,
} from '../document/mascaraPixels';
import { caminhoDaSelecao } from '../document/selecao';
import { mascaraPorCor, toleranciaEmCanais } from './pixels';
import { desenharSelecao } from './select';
import { definirFerramenta, type ToolCtx } from './tool';

/** A seleção atual como máscara de pixels (para somar ou subtrair). */
function mascaraDaSelecao(ctx: ToolCtx): MascaraPixels | null {
  const area = ctx.selecao;
  if (!area) return null;
  const tela = document.createElement('canvas');
  tela.width = ctx.largura;
  tela.height = ctx.altura;
  const grafico = tela.getContext('2d', { willReadFrequently: true });
  if (!grafico) return null;
  try {
    grafico.fillStyle = '#000';
    grafico.fill(caminhoDaSelecao(area, ctx.mascaraSelecao), 'evenodd');
    const { data } = grafico.getImageData(0, 0, ctx.largura, ctx.altura);
    const mascara = new Uint8Array(ctx.largura * ctx.altura);
    for (let i = 0; i < mascara.length; i++) mascara[i] = data[i * 4 + 3] >= 128 ? 1 : 0;
    return mascara;
  } finally {
    tela.width = tela.height = 1;
  }
}

/**
 * Varinha mágica: clique seleciona a área da mesma cor (com a tolerância e "toda a imagem" do
 * balde). Shift soma à seleção atual, Alt subtrai.
 */
export const varinha = definirFerramenta(
  { id: 'wand', nome: 'Varinha mágica', icone: 'selection-input', atalho: 'W' },
  () => ({
    cursor: () => 'crosshair',
    onPointerDown() {},
    onPointerMove() {},
    onPointerUp(ctx, { ponto, shift, alt }) {
      const { largura, altura } = ctx;
      const imagem = ctx.lerPixels({ x: 0, y: 0, width: largura, height: altura });
      const nova = mascaraPorCor(
        imagem,
        ponto.x,
        ponto.y,
        toleranciaEmCanais(ctx.opcoes.toleranciaBalde),
        ctx.opcoes.preenchimentoGlobal,
      );
      if (!nova) return;
      const modo = alt ? 'subtrair' : shift ? 'somar' : 'substituir';
      const mascara = combinarMascaras(
        modo === 'substituir' ? null : mascaraDaSelecao(ctx),
        nova,
        modo,
      );
      const area = limitesDaMascara(mascara, largura, altura);
      if (!area) {
        ctx.selecionar(null);
        return;
      }
      const contornos = contornosDaMascara(mascara, largura, altura, area);
      if (!contornos) {
        ctx.avisar?.(
          'Essa área tem detalhes demais para a varinha. Diminua a tolerância ou desligue "toda a imagem".',
        );
        return;
      }
      ctx.selecionar(area, { contorno: juntarContornos(contornos) });
    },
    limitesOverlay(ctx) {
      if (!ctx.selecao) return null;
      const { x, y, width, height } = ctx.selecao;
      const margem = 7 / ctx.opcoes.zoom;
      return {
        x: x - margem,
        y: y - margem,
        width: width + margem * 2,
        height: height + margem * 2,
      };
    },
    overlay(ctx, grafico) {
      desenharSelecao(ctx, grafico, false);
    },
  }),
);
