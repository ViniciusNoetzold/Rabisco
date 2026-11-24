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
    </div>
  );
}
