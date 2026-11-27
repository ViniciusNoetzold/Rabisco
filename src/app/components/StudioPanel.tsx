import type { RefObject } from 'react';
import type { DocumentInfo, EditorApi } from '../../canvas/CanvasSurface';
import { ESPESSURA_MAXIMA, useEditor } from '../store';
import { BrushStrokeSample } from './BrushStrokeSample';
import { Icon } from './Primitives';
import { CamadasPainel } from './CamadasPainel';
import { pontosDaCurva, type CurvaPressao } from '../../brushes/pressao';

interface StudioPanelProps {
  info: DocumentInfo;
  editor: RefObject<EditorApi | null>;
  onHelp(): void;
  onEditarAscii(id: string): void;
}

export function StudioPanel({ info, editor, onHelp, onEditarAscii }: StudioPanelProps) {
  const state = useEditor();
  if (!state.sidebar) return null;
  return (
    <aside className="studio-panel" aria-label="Painel do ateliê">
      <div className="panel-heading">
        <span>Meu ateliê</span>
        <button
          aria-label="Fechar painel do ateliê"
          title="Fechar painel"
          onClick={() => state.set({ sidebar: false })}
        >
          ×
        </button>
      </div>
      <section className="stroke-card">
        <div className="section-heading">
          Seu traço <span>{state.tool === 'pencil' ? 1 : state.size} px</span>
        </div>
        <div className="stroke-preview">
          {state.tool === 'brush' ? (
            <BrushStrokeSample
              tipo={state.pincel}
              cor={state.color1}
              espessura={Math.min(state.size, 26)}
              largura={190}
              altura={65}
              pontosPorMarca={{ baixa: 4, media: 8, alta: 13 }[state.densidadeSpray]}
              rotulo="Prévia do traço"
            />
          ) : (
            <svg viewBox="0 0 190 65" aria-label="Prévia do traço">
              <path
                d="M12 46C35 49 37 12 61 20S87 60 111 36s35-29 65-12"
                fill="none"
                stroke={state.tool === 'eraser' ? '#b7c4d1' : state.color1}
                strokeWidth={state.tool === 'pencil' ? 1 : Math.min(state.size, 22)}
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
        <label className="thickness-range">
          <span>Fino</span>
          <input
            type="range"
            min="1"
            max={ESPESSURA_MAXIMA}
            value={state.size}
            aria-label="Ajustar espessura"
            onChange={(event) => state.set({ size: Number(event.target.value) })}
          />
          <span>Grosso</span>
        </label>
        <div className="estabilizador-controles" role="group" aria-label="Estabilizador de traço">
          <label title="Segura o tremor da mão: o pincel segue o ponteiro como se puxado por uma corda (Alt+[ / Alt+])">
            <span>Estabilizar</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={state.estabilizar}
              aria-label="Estabilizar traço"
              aria-valuetext={state.estabilizar ? `${state.estabilizar}` : 'desligado'}
              onChange={(event) => state.set({ estabilizar: Number(event.target.value) })}
            />
            <span className="estabilizador-valor" aria-hidden="true">
              {state.estabilizar || 'não'}
            </span>
          </label>
          <label title="Amortece ainda mais cada passo do pincel (curvas mais redondas)">
            <span>Suavizar</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={state.suavizar}
              disabled={!state.estabilizar}
              aria-label="Suavizar traço"
              onChange={(event) => state.set({ suavizar: Number(event.target.value) })}
            />
            <span className="estabilizador-valor" aria-hidden="true">
              {state.suavizar}%
            </span>
          </label>
          <label className="estabilizador-alcancar">
            <input
              type="checkbox"
              checked={state.alcancarFim}
              disabled={!state.estabilizar}
              onChange={(event) => state.set({ alcancarFim: event.target.checked })}
            />
            Terminar onde a mão parou
          </label>
        </div>
        <div className="pressao-controles" role="group" aria-label="Pressão dos pincéis">
          <label title="Como a força da caneta vira espessura e opacidade dos pincéis">
            <span>Caneta</span>
            <select
              aria-label="Curva de pressão da caneta"
              value={state.curvaPressao}
              onChange={(event) => state.set({ curvaPressao: event.target.value as CurvaPressao })}
            >
              <option value="suave">Suave (toque leve já pinta)</option>
              <option value="linear">Linear</option>
              <option value="firme">Firme (aperte para engrossar)</option>
            </select>
            <svg className="curva-previa" viewBox="0 0 1 1" aria-hidden="true">
              <path d="M0 1 L1 0" className="curva-referencia" />
              <polyline
                points={pontosDaCurva(state.curvaPressao)
                  .map(({ x, y }) => `${x},${1 - y}`)
                  .join(' ')}
              />
            </svg>
          </label>
          <label
            className="pressao-velocidade"
            title="No mouse e no toque: rápido afina, devagar engrossa"
          >
            <input
              type="checkbox"
              checked={state.pressaoVelocidade}
              onChange={(event) => state.set({ pressaoVelocidade: event.target.checked })}
            />
            Simular pressão pela velocidade
          </label>
          <label title="Pontas finas no começo e no fim de cada pincelada">
            <span>Afinar pontas</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={state.afinar}
              aria-label="Afinar pontas"
              onChange={(event) => state.set({ afinar: Number(event.target.value) })}
            />
            <span className="estabilizador-valor" aria-hidden="true">
              {state.afinar}%
            </span>
          </label>
        </div>
        <div className="pressao-controles" role="group" aria-label="Formas inteligentes">
          <label
            className="pressao-velocidade"
            title="Termine um traço de lápis ou pincel e segure parado: ele vira linha, círculo, retângulo, triângulo, seta ou polígono"
          >
            <input
              type="checkbox"
              checked={state.formasInteligentes}
              onChange={(event) => state.set({ formasInteligentes: event.target.checked })}
            />
            Formas inteligentes (segure no fim)
          </label>
          <label title="Quanto tempo segurar parado no fim do traço">
            <span>Esperar</span>
            <input
              type="range"
              min="300"
              max="1500"
              step="100"
              value={state.esperaFormaInteligente}
              disabled={!state.formasInteligentes}
              aria-label="Tempo para virar forma"
              onChange={(event) =>
                state.set({ esperaFormaInteligente: Number(event.target.value) })
              }
            />
            <span className="estabilizador-valor" aria-hidden="true">
              {(state.esperaFormaInteligente / 1000).toLocaleString('pt-BR')} s
            </span>
          </label>
        </div>
        <div className="current-color">
          <span style={{ background: state.color1 }} />
          <span>
            Cor principal <strong>{state.color1.toUpperCase()}</strong>
          </span>
          <button
            onClick={state.swapColors}
            title="Trocar cores"
            aria-label="Trocar cor principal e secundária"
          >
            <Icon name="arrow-switch" />
          </button>
        </div>
      </section>
      <CamadasPainel info={info} editor={editor} onEditarAscii={onEditarAscii} />
      <section className="history-panel">
        <div className="section-heading">
          <span>
            <Icon name="clock-history" />
            Histórico
          </span>
          <span>{info.history.length}</span>
        </div>
        <div className="history-list" aria-live="polite">
          <div className={`history-item initial-history ${!info.history.length ? 'current' : ''}`}>
            <Icon name="document" />
            <span>Papel em branco</span>
          </div>
          {info.history.slice(-12).map((entry, index, entries) => (
            <div
              key={`${index}-${entry.label}`}
              className={`history-item ${index === entries.length - 1 ? 'current' : ''}`}
            >
              <Icon
                name={
                  entry.label.includes('Borracha')
                    ? 'eraser'
                    : entry.label.includes('PNG')
                      ? 'folder-open'
                      : 'paint-brush'
                }
              />
              <span>{entry.label}</span>
              {index === entries.length - 1 && <span className="history-current-dot" />}
            </div>
          ))}
        </div>
        <div className="history-controls">
          <button disabled={!info.canUndo} onClick={() => editor.current?.undo()}>
            <Icon name="arrow-curve-180-left" />
            Desfazer
          </button>
          <button disabled={!info.canRedo} onClick={() => editor.current?.redo()}>
            <Icon name="arrow-curve" />
            Refazer
          </button>
        </div>
      </section>
      <div className="atelier-note">
        <svg viewBox="0 0 70 60" aria-hidden="true">
          <path
            d="M15 37c2-19 24-27 36-12 11 14-6 29-21 22-16-8-4-27 8-18"
            fill="none"
            stroke="#83acb9"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="m12 12 4 4m40 25 5 1M46 6l-1 6"
            stroke="#d4ac50"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
        <strong>Começa com um rabisco.</strong>
        <p>
          Não precisa ficar perfeito.
          <br />
          Só precisa ser seu.
        </p>
        <button onClick={onHelp}>Conheça os atalhos</button>
      </div>
      <div className="local-note">
        <span>⌂</span> Seu desenho fica com você.
      </div>
    </aside>
  );
}
