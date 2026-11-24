import { useEditor } from '../store';
import { useState } from 'react';
import {
  FONTES_TEXTO,
  MAXIMO_TEXTO,
  MINIMO_TEXTO,
  tamanhoTexto,
  type EstiloTexto,
  type FamiliaTexto,
} from '../../tools/texto';
import { RibbonGroup } from './Primitives';
import './text-tools.css';

const ESTILOS = [
  { chave: 'negrito', rotulo: 'Negrito', letra: 'N' },
  { chave: 'italico', rotulo: 'Itálico', letra: 'I' },
  { chave: 'sublinhado', rotulo: 'Sublinhado', letra: 'S' },
  { chave: 'tachado', rotulo: 'Tachado', letra: 'T' },
] as const;

const NOMES_GENERICOS: Partial<Record<FamiliaTexto, string>> = {
  'sans-serif': 'Sem serifa',
  serif: 'Com serifa',
  monospace: 'Monoespaçada',
};

export function TextTools({
  estilo,
  definirEstilo,
}: {
  estilo: EstiloTexto;
  definirEstilo(estilo: EstiloTexto): void;
}) {
  const [rascunho, definirRascunho] = useState<string | null>(null);

  function confirmarTamanho() {
    if (rascunho !== null && rascunho.trim()) {
      definirEstilo({ ...estilo, tamanho: tamanhoTexto(Number(rascunho)) });
    }
    definirRascunho(null);
  }

  return (
    <>
      <RibbonGroup
        title="Fonte"
        className="text-tools-group"
        chave="fonte"
        prioridade={2}
        icone="document"
      >
        <div className="text-tools" data-opcoes-texto>
          <div className="text-tools-font">
            <label>
              Fonte
              <select
                value={estilo.familia}
                onChange={(evento) =>
                  definirEstilo({ ...estilo, familia: evento.target.value as FamiliaTexto })
                }
              >
                {FONTES_TEXTO.map((familia) => (
                  <option value={familia} key={familia}>
                    {NOMES_GENERICOS[familia] ?? familia}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tamanho (px)
              <input
                type="number"
                value={rascunho ?? estilo.tamanho}
                min={MINIMO_TEXTO}
                max={MAXIMO_TEXTO}
                onChange={(evento) => {
                  definirRascunho(evento.target.value);
                  const tamanho = evento.target.valueAsNumber;
                  if (
                    Number.isInteger(tamanho) &&
                    tamanho >= MINIMO_TEXTO &&
                    tamanho <= MAXIMO_TEXTO
                  ) {
                    definirEstilo({ ...estilo, tamanho });
                  }
                }}
                onBlur={confirmarTamanho}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault();
                    evento.stopPropagation();
                    confirmarTamanho();
                  }
                }}
              />
            </label>
          </div>
          <div className="text-tools-buttons" role="group" aria-label="Formatação do texto">
            {ESTILOS.map(({ chave, rotulo, letra }) => (
              <button
                type="button"
                className={estilo[chave] ? 'selected' : ''}
                data-formato={chave}
                key={chave}
                title={rotulo}
                aria-label={rotulo}
                aria-pressed={estilo[chave]}
                onClick={() => definirEstilo({ ...estilo, [chave]: !estilo[chave] })}
              >
                {letra}
              </button>
            ))}
          </div>
        </div>
      </RibbonGroup>
      <RibbonGroup
        title="Fundo"
        className="text-tools-group"
        chave="fundo"
        prioridade={1}
        icone="color"
      >
        <div className="text-tools text-background-options" data-opcoes-texto>
          <button
            type="button"
            className={!estilo.fundoOpaco ? 'selected' : ''}
            aria-pressed={!estilo.fundoOpaco}
            onClick={() => definirEstilo({ ...estilo, fundoOpaco: false })}
          >
            Transparente
          </button>
          <button
            type="button"
            className={estilo.fundoOpaco ? 'selected' : ''}
            aria-pressed={estilo.fundoOpaco}
            onClick={() => definirEstilo({ ...estilo, fundoOpaco: true })}
          >
            Opaco (Cor 2)
          </button>
          <label className="texto-nova-camada" title="O texto confirmado entra numa camada própria">
            <input
              type="checkbox"
              checked={useEditor((estado) => estado.textoEmNovaCamada)}
              onChange={(evento) =>
                useEditor.getState().set({ textoEmNovaCamada: evento.currentTarget.checked })
              }
            />
            Em nova camada
          </label>
        </div>
      </RibbonGroup>
    </>
  );
}
