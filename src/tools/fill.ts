import { toleranciaEmCanais } from './pixels';
import { corDoBotao, definirFerramenta } from './tool';

export const balde = definirFerramenta(
  { id: 'fill', nome: 'Balde', icone: 'paint-can', atalho: 'F' },
  () => ({
    cursor: () => 'cell',
    onPointerDown() {},
    onPointerMove() {},
    onPointerUp(ctx, { ponto, botao }) {
      (ctx.preencher ?? ctx.executar)({
        tipo: 'Preencher',
        ponto,
        cor: corDoBotao(ctx, botao),
        tolerancia: toleranciaEmCanais(ctx.opcoes.toleranciaBalde),
        global: ctx.opcoes.preenchimentoGlobal,
        ...(ctx.opcoes.amostrarTudo ? { amostrarTudo: true } : {}),
      });
    },
  }),
);
