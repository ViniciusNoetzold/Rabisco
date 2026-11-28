import { combinarMascaras } from '../document/mascaraPixels';
import { rasterizarSelecao, selecaoDaMascara } from '../document/selecao';
import { mascaraPorCor, toleranciaEmCanais } from './pixels';
import { desenharSelecao } from './select';
import { definirFerramenta } from './tool';

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
      const papel = { x: 0, y: 0, width: largura, height: altura };
      const imagem = ctx.lerPixels(papel);
      const nova = mascaraPorCor(
        imagem,
        ponto.x,
        ponto.y,
        toleranciaEmCanais(ctx.opcoes.toleranciaBalde),
        ctx.opcoes.preenchimentoGlobal,
      );
      if (!nova) return;
      const modo = alt ? 'subtrair' : shift ? 'somar' : 'substituir';
      const atual =
        modo !== 'substituir' && ctx.selecao
          ? rasterizarSelecao({ area: ctx.selecao, mascara: ctx.mascaraSelecao }, papel)
          : null;
      const resultado = selecaoDaMascara(combinarMascaras(atual, nova, modo), papel);
      if (resultado === 'limite') {
        ctx.avisar?.(
          'Essa área tem detalhes demais para a varinha. Diminua a tolerância ou desligue "toda a imagem".',
        );
        return;
      }
      ctx.selecionar(resultado?.area ?? null, resultado?.mascara);
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
