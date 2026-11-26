import { useEditor } from '../app/store';
import { comGuia } from '../document/guias';

/** Solta uma guia: dentro do papel ela fica; arrastada para fora, some. */
export function soltarGuia(largura: number, altura: number) {
  const estado = useEditor.getState();
  const nova = estado.guiaNova;
  if (!nova) return;
  const limite = nova.eixo === 'horizontal' ? altura : largura;
  estado.set({
    guiaNova: null,
    guiasDoPapel:
      nova.valor >= 0 && nova.valor <= limite
        ? comGuia(estado.guiasDoPapel, nova.eixo, nova.valor)
        : estado.guiasDoPapel,
  });
}
