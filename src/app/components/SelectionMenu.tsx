import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EditorApi } from '../../canvas/editorTypes';
import { useEditor } from '../store';

export function SelectionMenu({
  editor,
  selecionada,
}: {
  editor: EditorApi | null;
  selecionada: boolean;
}) {
  const [posicao, definirPosicao] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const id = useId();
  const aberto = Boolean(posicao);
  const transparente = useEditor((estado) => estado.selecaoTransparente);
  function fechar() {
    definirPosicao(null);
    botao.current?.focus();
  }
  useEffect(() => {
    if (!aberto) return;
    painel.current?.querySelector('button')?.focus();
    const fora = (evento: PointerEvent) => {
      const alvo = evento.target;
      if (alvo instanceof Node && !painel.current?.contains(alvo) && !botao.current?.contains(alvo))
        definirPosicao(null);
    };
    const escapar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      evento.preventDefault();
      evento.stopPropagation();
      fechar();
    };
    const recolher = () => definirPosicao(null);
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', escapar, true);
    window.addEventListener('resize', recolher);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', escapar, true);
      window.removeEventListener('resize', recolher);
    };
  }, [aberto]);
  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={(evento) => {
          const caixa = evento.currentTarget.getBoundingClientRect();
          definirPosicao(
            aberto
              ? null
              : { top: caixa.bottom + 2, left: Math.min(caixa.left, window.innerWidth - 200) },
          );
        }}
      >
        Opções de seleção
      </button>
      {posicao &&
        createPortal(
          <div
            ref={painel}
            id={id}
            className="selection-options"
            role="group"
            aria-label="Comandos de seleção"
            style={posicao}
          >
            <button
              type="button"
              onClick={() => {
                useEditor.getState().setTool('lasso');
                fechar();
              }}
            >
              Laço (L)
            </button>
            <button
              type="button"
              onClick={() => {
                editor?.selectAll();
                fechar();
              }}
            >
              Selecionar tudo
            </button>
            <button
              type="button"
              onClick={() => {
                editor?.inverterSelecao();
                fechar();
              }}
            >
              Inverter seleção
            </button>
            <button
              type="button"
              onClick={() => {
                editor?.deleteSelection();
                fechar();
              }}
              disabled={!selecionada}
            >
              Excluir seleção
            </button>
            <label>
              <input
                type="checkbox"
                checked={transparente}
                onChange={(evento) =>
                  useEditor.getState().set({ selecaoTransparente: evento.target.checked })
                }
              />
              Seleção transparente
            </label>
          </div>,
          document.body,
        )}
    </>
  );
}
