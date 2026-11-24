import type { DocumentInfo } from '../../canvas/CanvasSurface';
import type { ToolId } from '../../layers/types';
import { toolRegistry } from '../../tools/toolRegistry';
import { DPI_PADRAO } from '../../document/dimensoes';

export function nomeDaFerramenta(id: ToolId) {
  return toolRegistry[id].nome;
}
export const initialInfo: DocumentInfo = {
  name: 'Sem título',
  width: 1024,
  height: 640,
  dpi: DPI_PADRAO,
  canUndo: false,
  canRedo: false,
  history: [],
  selection: null,
  saving: 'loading',
  estrutura: { camadas: [], grupos: [], ativa: '', editandoMascara: false },
  revisao: 0,
};
export const hints: Record<ToolId, string> = {
  brush: 'Solte a mão. Cada pincelada é uma nova ideia.',
  pencil: 'Para os pequenos detalhes, um traço de cada vez.',
  eraser: 'Todo desenho tem espaço para recomeçar.',
  fill: 'Clique em uma área fechada para dar vida com cor.',
  line: 'Shift restringe os ângulos. Enter confirma ou Esc descarta.',
  rectangle: 'Shift desenha um quadrado. Enter confirma ou Esc descarta.',
  ellipse: 'Shift desenha um círculo. Enter confirma ou Esc descarta.',
  shape: 'Arraste a forma ou suas alças. Enter confirma ou Esc descarta.',
  select: 'Arraste para selecionar. Arraste por dentro para mover.',
  lasso: 'Contorne com o ponteiro. Arraste a seleção ou use as alças.',
  text: 'Clique no papel para digitar. Clique fora da caixa para confirmar.',
  zoom: 'Clique para ampliar. Use o botão direito para reduzir.',
  eyedropper: 'Encontre uma cor no seu desenho e continue com ela.',
};
