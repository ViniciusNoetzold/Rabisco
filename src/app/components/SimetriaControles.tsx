import { EIXOS_MAXIMOS, EIXOS_MINIMOS, type ModoSimetria } from '../../brushes/simetria';
import { useEditor } from '../store';

export const MODOS_SIMETRIA: readonly [ModoSimetria, string][] = [
  ['nenhuma', 'Desligada'],
  ['vertical', 'Espelho esquerda/direita'],
  ['horizontal', 'Espelho cima/baixo'],
  ['quatro', 'Quatro quadrantes'],
  ['radial', 'Radial (mandala)'],
];

/** O último modo ligado, para o Shift+S voltar a ele. */
let ultimoModo: Exclude<ModoSimetria, 'nenhuma'> = 'vertical';

/** Shift+S: liga a simetria no último modo usado ou desliga. Devolve o aviso para a barra. */
export function alternarSimetria(): string {
  const estado = useEditor.getState();
  if (estado.simetria !== 'nenhuma') {
    ultimoModo = estado.simetria;
    estado.set({ simetria: 'nenhuma' });
    return 'Simetria desligada';
  }
  estado.set({ simetria: ultimoModo });
  return `Simetria: ${MODOS_SIMETRIA.find(([modo]) => modo === ultimoModo)![1].toLowerCase()}`;
}

/** Grupo "Simetria" da aba Exibir: modo, fatias, mandala, guias e centro. */
export function SimetriaControles() {
  const simetria = useEditor((e) => e.simetria);
  const eixos = useEditor((e) => e.eixosSimetria);
  const espelhar = useEditor((e) => e.espelharFatias);
  const guias = useEditor((e) => e.guiasSimetria);
  const centro = useEditor((e) => e.centroSimetria);
  const set = useEditor((e) => e.set);
  const radial = simetria === 'radial';
  return (
    <div className="simetria-controles">
      <label title="Os traços de lápis, pincéis e borrachas se repetem em espelho (Shift+S)">
        <span>Modo</span>
        <select
          aria-label="Modo de simetria"
          value={simetria}
          onChange={(evento) => {
            const modo = evento.target.value as ModoSimetria;
            if (modo !== 'nenhuma') ultimoModo = modo;
            set({ simetria: modo });
          }}
        >
          {MODOS_SIMETRIA.map(([modo, nome]) => (
            <option key={modo} value={modo}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <div className="simetria-opcoes">
        <label title="Quantas fatias a mandala tem">
          <span>Fatias</span>
          <input
            type="number"
            aria-label="Fatias da simetria radial"
            min={EIXOS_MINIMOS}
            max={EIXOS_MAXIMOS}
            value={eixos}
            disabled={!radial}
            onChange={(evento) => {
              const valor = Number(evento.target.value);
              if (Number.isFinite(valor))
                set({ eixosSimetria: Math.max(EIXOS_MINIMOS, Math.min(EIXOS_MAXIMOS, valor)) });
            }}
          />
        </label>
        <label title="Cada fatia também é espelhada, como num caleidoscópio">
          <input
            type="checkbox"
            checked={espelhar}
            disabled={!radial}
            onChange={(evento) => set({ espelharFatias: evento.target.checked })}
          />
          Caleidoscópio
        </label>
      </div>
      <div className="simetria-opcoes">
        <label>
          <input
            type="checkbox"
            checked={guias}
            onChange={(evento) => set({ guiasSimetria: evento.target.checked })}
          />
          Linhas-guia
        </label>
        <button
          type="button"
          disabled={simetria === 'nenhuma' || centro === null}
          title="Volta o centro da simetria para o meio do papel"
          onClick={() => set({ centroSimetria: null })}
        >
          Centralizar no papel
        </button>
      </div>
    </div>
  );
}
