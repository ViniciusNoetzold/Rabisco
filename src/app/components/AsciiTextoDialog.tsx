import { useId, useLayoutEffect, useRef, useState } from 'react';
import { textoAscii, type ArteAscii } from '../../estilos/ascii';
import { atualizarTextoAscii } from '../../estilos/camadaAscii';
import './ascii-dialog.css';

export function AsciiTextoDialog({
  arte,
  aplicar,
  fechar,
}: {
  arte: ArteAscii;
  aplicar(arte: ArteAscii): void;
  fechar(): void;
}) {
  const titulo = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [texto, definirTexto] = useState(() => textoAscii(arte));

  useLayoutEffect(() => {
    const janela = dialogo.current;
    janela?.showModal();
    return () => janela?.close();
  }, []);

  return (
    <dialog
      className="window glass app-dialog ascii-texto-dialog"
      ref={dialogo}
      aria-labelledby={titulo}
      onCancel={(evento) => {
        evento.preventDefault();
        fechar();
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id={titulo}>
          Editar camada ASCII
        </div>
        <button type="button" className="dialog-close" aria-label="Fechar janela" onClick={fechar}>
          ×
        </button>
      </div>
      <form
        className="window-body dialog-body"
        onSubmit={(evento) => {
          evento.preventDefault();
          aplicar(atualizarTextoAscii(arte, texto));
          fechar();
        }}
      >
        <label className="ascii-texto-campo">
          Texto ASCII
          <textarea
            aria-label="Texto ASCII"
            value={texto}
            spellCheck={false}
            rows={10}
            wrap="off"
            onChange={(evento) => definirTexto(evento.target.value)}
            aria-describedby={`${titulo}-colunas`}
          />
        </label>
        <p id={`${titulo}-colunas`}>Até {arte.colunas} colunas por linha.</p>
        <div className="ascii-acoes">
          <button type="button" onClick={fechar}>
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            Salvar texto
          </button>
        </div>
      </form>
    </dialog>
  );
}
