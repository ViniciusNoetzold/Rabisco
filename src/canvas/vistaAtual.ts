import { useEditor } from '../app/store';
import type { Point } from '../layers/types';
import { telaParaPapel, type Vista } from './vista';

export function vistaAtual(): Vista {
  const { rotacaoVista, espelharVista } = useEditor.getState();
  return { rotacao: rotacaoVista, espelhar: espelharVista };
}

/** Ponto da tela para o papel, com o zoom e a vista atuais. */
export function clienteNoPapel(
  cliente: Point,
  caixa: { left: number; top: number; width: number; height: number },
  largura: number,
  altura: number,
): Point {
  return telaParaPapel(cliente, caixa, largura, altura, useEditor.getState().zoom, vistaAtual());
}
