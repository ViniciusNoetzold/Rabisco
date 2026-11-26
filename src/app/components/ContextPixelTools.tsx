import { useEditor } from '../store';
import { StrokeThickness } from './StrokeThickness';
import './pixel-tools.css';

function ControleTolerancia({ borracha = false }: { borracha?: boolean }) {
  const valor = useEditor((estado) => estado[borracha ? 'toleranciaBorracha' : 'toleranciaBalde']);
  const set = useEditor((estado) => estado.set);

  return (
    <label className="pixel-tools-tolerance">
      <span>Tolerância</span>
      <output>{valor}%</output>
      <input
        type="range"
        min={0}
        max={100}
        value={valor}
        aria-label={borracha ? 'Tolerância da borracha de cor' : 'Tolerância do balde'}
        aria-valuetext={`${valor}%`}
        title={borracha ? 'Tolerância da borracha de cor (botão direito)' : undefined}
        onChange={(evento) =>
          set({
            [borracha ? 'toleranciaBorracha' : 'toleranciaBalde']: Number(
              evento.currentTarget.value,
            ),
          })
        }
      />
    </label>
  );
}

export function ControlesDeBorracha() {
  return (
    <div className="pixel-tool-options pixel-eraser-options">
      <StrokeThickness borracha />
      <ControleTolerancia borracha />
    </div>
  );
}

export function ControlesDeBalde() {
  const preenchimentoGlobal = useEditor((estado) => estado.preenchimentoGlobal);
  const amostrarTudo = useEditor((estado) => estado.amostrarTudo);
  const set = useEditor((estado) => estado.set);

  return (
    <div className="pixel-tool-options">
      <ControleTolerancia />
      <label className="pixel-tools-global">
        <input
          type="checkbox"
          checked={preenchimentoGlobal}
          onChange={(evento) => set({ preenchimentoGlobal: evento.currentTarget.checked })}
        />
        Preencher cor em toda a imagem
      </label>
      <label
        className="pixel-tools-global"
        title="Decide a área pelo que se vê; pinta só na camada ativa"
      >
        <input
          type="checkbox"
          checked={amostrarTudo}
          onChange={(evento) => set({ amostrarTudo: evento.currentTarget.checked })}
        />
        Amostrar todas as camadas
      </label>
    </div>
  );
}

/** Alterna entre o balde (F) e o gradiente (G), que dividem o mesmo grupo do ribbon. */
function TrocarBaldeGradiente() {
  const ferramenta = useEditor((estado) => estado.tool);
  const setTool = useEditor((estado) => estado.setTool);
  return (
    <div className="balde-gradiente" role="group" aria-label="Balde ou gradiente">
      {(
        [
          ['fill', 'Balde (F)'],
          ['gradient', 'Gradiente (G)'],
        ] as const
      ).map(([id, nome]) => (
        <button
          key={id}
          type="button"
          aria-pressed={ferramenta === id}
          className={ferramenta === id ? 'selected' : ''}
          onClick={() => setTool(id)}
        >
          {nome}
        </button>
      ))}
    </div>
  );
}

/** Opções da varinha mágica: a tolerância e "toda a imagem" são as mesmas do balde. */
export function ControlesDeVarinha() {
  const global = useEditor((estado) => estado.preenchimentoGlobal);
  const set = useEditor((estado) => estado.set);
  return (
    <div className="pixel-tool-options">
      <ControleTolerancia />
      <label className="pixel-tools-global">
        <input
          type="checkbox"
          checked={global}
          onChange={(evento) => set({ preenchimentoGlobal: evento.currentTarget.checked })}
        />
        Mesma cor em toda a imagem
      </label>
      <span className="varinha-dica">Shift soma · Alt subtrai</span>
    </div>
  );
}

/** Opções do gradiente: linear ou radial, e até transparente. */
export function ControlesDeGradiente() {
  const forma = useEditor((estado) => estado.formaGradiente);
  const transparente = useEditor((estado) => estado.gradienteTransparente);
  const set = useEditor((estado) => estado.set);
  return (
    <div className="pixel-tool-options">
      <label className="gradiente-forma">
        <span>Forma</span>
        <select
          aria-label="Forma do gradiente"
          value={forma}
          onChange={(evento) =>
            set({ formaGradiente: evento.currentTarget.value as 'linear' | 'radial' })
          }
        >
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
      </label>
      <label className="pixel-tools-global" title="A Cor 1 vai sumindo, sem usar a Cor 2">
        <input
          type="checkbox"
          checked={transparente}
          onChange={(evento) => set({ gradienteTransparente: evento.currentTarget.checked })}
        />
        Até transparente
      </label>
      <TrocarBaldeGradiente />
    </div>
  );
}
