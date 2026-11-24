import { useState } from 'react';
import type { DensidadeSpray } from '../../brushes/catalogo';
import { ESPESSURA_MAXIMA, useEditor } from '../store';
import './brush-controls.css';

const ESPESSURAS_PREDEFINIDAS = [1, 3, 5, 8] as const;
const TAMANHOS_SPRAY = [
  { nome: 'pequeno', abreviacao: 'P', valor: 16 },
  { nome: 'médio', abreviacao: 'M', valor: 32 },
  { nome: 'grande', abreviacao: 'G', valor: 64 },
] as const;

export function StrokeThickness() {
  const espessura = useEditor((estado) => estado.size);
  const set = useEditor((estado) => estado.set);
  const [rascunho, setRascunho] = useState<string | null>(null);

  return (
    <div className="stroke-thickness">
      <div className="stroke-size-presets" role="group" aria-label="Espessuras clássicas">
        {ESPESSURAS_PREDEFINIDAS.map((tamanho) => (
          <button
            key={tamanho}
            type="button"
            className={espessura === tamanho ? 'selected' : ''}
            title={`${tamanho} px`}
            aria-label={`Usar espessura de ${tamanho} px`}
            aria-pressed={espessura === tamanho}
            onClick={() => set({ size: tamanho })}
          >
            <span style={{ height: tamanho }} aria-hidden="true" />
          </button>
        ))}
      </div>
      <label className="stroke-size-field">
        <input
          type="number"
          min={1}
          max={ESPESSURA_MAXIMA}
          step={1}
          inputMode="numeric"
          aria-label="Espessura do traço"
          value={rascunho ?? espessura}
          onFocus={(evento) => evento.currentTarget.select()}
          onChange={(evento) => {
            const valor = evento.currentTarget.value;
            const numero = Number(valor);
            setRascunho(valor);
            if (Number.isInteger(numero) && numero >= 1 && numero <= ESPESSURA_MAXIMA) {
              set({ size: numero });
            }
          }}
          onBlur={() => {
            if (rascunho) set({ size: Number(rascunho) });
            setRascunho(null);
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') evento.currentTarget.blur();
          }}
        />
        <span aria-hidden="true">px</span>
      </label>
    </div>
  );
}

export function SprayControls() {
  const espessura = useEditor((estado) => estado.size);
  const densidade = useEditor((estado) => estado.densidadeSpray);
  const set = useEditor((estado) => estado.set);

  return (
    <div className="spray-controls">
      <div className="spray-size-presets" role="group" aria-label="Tamanhos do spray">
        {TAMANHOS_SPRAY.map(({ nome, abreviacao, valor }) => (
          <button
            type="button"
            key={valor}
            className={espessura === valor ? 'selected' : ''}
            title={`Spray ${nome} (${valor} px)`}
            aria-label={`Spray ${nome} (${valor} px)`}
            aria-pressed={espessura === valor}
            onClick={() => set({ size: valor })}
          >
            {abreviacao}
          </button>
        ))}
      </div>
      <label className="spray-density">
        Densidade
        <select
          aria-label="Densidade do spray"
          value={densidade}
          onChange={(evento) => set({ densidadeSpray: evento.target.value as DensidadeSpray })}
        >
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </select>
      </label>
    </div>
  );
}
