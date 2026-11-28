import { useEditor } from '../app/store';
import type { ComandoGuia } from '../commands/comandos';

/** Solta uma guia: dentro do papel ela fica; arrastada para fora, some. */
export function soltarGuia(
  largura: number,
  altura: number,
  executar: (comando: ComandoGuia) => void,
) {
  const estado = useEditor.getState();
  const nova = estado.guiaNova;
  if (!nova) return;
  const { eixo, valor, origem } = nova;
  const limite = eixo === 'horizontal' ? altura : largura;
  const dentro = valor >= 0 && valor <= limite;
  estado.set({ guiaNova: null });
  if (origem === undefined) {
    if (dentro) executar({ tipo: 'AdicionarGuia', eixo, valor });
  } else if (dentro) {
    executar({ tipo: 'MoverGuia', eixo, origem, destino: valor });
  } else {
    executar({ tipo: 'RemoverGuia', eixo, valor: origem });
  }
}
