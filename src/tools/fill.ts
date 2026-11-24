import { corDoBotao, definirFerramenta } from './tool';

export const balde = definirFerramenta(
  { id: 'fill', nome: 'Balde', icone: 'paint-can', atalho: 'F' },
  () => ({
    cursor: () => 'cell',
    onPointerDown(ctx, { ponto, botao }) {
      ctx.executar({ tipo: 'Preencher', ponto, cor: corDoBotao(ctx, botao), tolerancia: 12 });
    },
    onPointerMove() {},
    onPointerUp() {},
  }),
);
