import { normalizarAngulo } from '../../canvas/vista';
import { useEditor } from '../store';
import { Icon } from './Primitives';

/** Gira a vista para o ângulo pedido. Devolve o aviso para a barra. */
export function girarVistaPara(graus: number): string {
  const rotacaoVista = normalizarAngulo(graus);
  useEditor.getState().set({ rotacaoVista });
  return rotacaoVista ? `Vista girada: ${rotacaoVista}°` : 'Vista sem giro (0°)';
}

export function alternarEspelhoDaVista(): string {
  const espelharVista = !useEditor.getState().espelharVista;
  useEditor.getState().set({ espelharVista });
  return espelharVista
    ? 'Vista espelhada: confira as proporções. H volta ao normal.'
    : 'Vista normal (sem espelho)';
}

/** Grupo "Girar e espelhar" da aba Exibir. */
export function VistaControles({ avisar = () => {} }: { avisar?(mensagem: string): void }) {
  const rotacao = useEditor((estado) => estado.rotacaoVista);
  const espelhar = useEditor((estado) => estado.espelharVista);
  return (
    <div className="vista-controles">
      <div className="vista-giro">
        <button
          type="button"
          title="Girar a vista 15° para a esquerda (4)"
          aria-label="Girar a vista para a esquerda"
          onClick={() => avisar(girarVistaPara(rotacao - 15))}
        >
          <Icon name="arrow-curve-180-left" />
        </button>
        <button
          type="button"
          className="vista-angulo"
          title="Voltar a vista para 0° (5). R + arrastar no papel gira livre."
          aria-label="Vista sem giro"
          disabled={!rotacao}
          onClick={() => avisar(girarVistaPara(0))}
        >
          {rotacao}°
        </button>
        <button
          type="button"
          title="Girar a vista 15° para a direita (6)"
          aria-label="Girar a vista para a direita"
          onClick={() => avisar(girarVistaPara(rotacao + 15))}
        >
          <Icon name="arrow-curve" />
        </button>
      </div>
      <button
        type="button"
        className="vista-espelho"
        title="Espelhar a vista (H): a imagem não muda, só o jeito de ver"
        aria-pressed={espelhar}
        onClick={() => avisar(alternarEspelhoDaVista())}
      >
        <Icon name="arrow-switch" />
        Espelhar
      </button>
    </div>
  );
}
