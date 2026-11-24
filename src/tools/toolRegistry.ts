import type { ToolId } from '../layers/types';
import { pincel } from './brush';
import { elipse } from './ellipse';
import { borracha } from './eraser';
import { contaGotas } from './eyedropper';
import { balde } from './fill';
import { formaLivre } from './formaLivre';
import { linha } from './line';
import { lapis } from './pencil';
import { retangulo } from './rectangle';
import { selecao, selecaoLaco } from './select';
import { ferramentaTexto } from './texto';
import type { DefinicaoFerramenta, Tool } from './tool';

export const toolRegistry: Readonly<Record<ToolId, DefinicaoFerramenta>> = {
  pencil: lapis,
  brush: pincel,
  eraser: borracha,
  fill: balde,
  line: linha,
  rectangle: retangulo,
  ellipse: elipse,
  shape: formaLivre,
  select: selecao,
  lasso: selecaoLaco,
  text: ferramentaTexto,
  eyedropper: contaGotas,
};

export function criarFerramentas(): Record<ToolId, Tool> {
  const definicoes = Object.values(toolRegistry);
  return Object.fromEntries(
    definicoes.map((definicao) => [definicao.id, definicao.criar()]),
  ) as Record<ToolId, Tool>;
}
