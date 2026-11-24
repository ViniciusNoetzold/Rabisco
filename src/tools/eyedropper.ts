import { definirFerramenta } from './tool';

export const contaGotas = definirFerramenta(
  { id: 'eyedropper', nome: 'Conta-gotas', icone: 'pipette', atalho: 'I' },
  () => ({
    cursor: () => 'copy',
    onPointerDown(ctx, { ponto }) {
      ctx.capturarCor(ponto);
    },
    onPointerMove() {},
    onPointerUp() {},
  }),
);
