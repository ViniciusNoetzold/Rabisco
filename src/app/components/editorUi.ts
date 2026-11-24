import type { DocumentInfo } from '../../canvas/CanvasSurface';
import type { ToolId } from '../../layers/types';
import { toolRegistry } from '../../tools/toolRegistry';

export function nomeDaFerramenta(id: ToolId) {
  return toolRegistry[id].nome;
}
export const initialInfo: DocumentInfo = {
  name: 'Sem título',
  width: 1024,
  height: 640,
  canUndo: false,
  canRedo: false,
  history: [],
  selection: null,
  saving: 'loading',
};
export const hints: Record<ToolId, string> = {
  brush: 'Solte a mão. Cada pincelada é uma nova ideia.',
  pencil: 'Para os pequenos detalhes, um traço de cada vez.',
  eraser: 'Todo desenho tem espaço para recomeçar.',
  fill: 'Clique em uma área fechada para dar vida com cor.',
  line: 'Segure Shift para uma linha em ângulos regulares.',
  rectangle: 'Segure Shift para desenhar um quadrado.',
  ellipse: 'Segure Shift para desenhar um círculo.',
  select: 'Arraste para selecionar. Arraste por dentro para mover.',
  eyedropper: 'Encontre uma cor no seu desenho e continue com ela.',
};
