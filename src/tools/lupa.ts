import { definirFerramenta } from './tool';

export const lupa = definirFerramenta(
  { id: 'zoom', nome: 'Lupa', icone: 'magnifier', atalho: 'Z' },
  () => ({
    cursor: () => 'zoom-in',
    onPointerDown() {},
    onPointerMove() {},
    onPointerUp() {},
  }),
);
