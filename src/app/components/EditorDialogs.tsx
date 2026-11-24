import { useEffect, useRef, useState } from 'react';
import { Logo } from './Primitives';

export type EditorDialogKind = 'new' | 'about' | 'help' | null;

interface EditorDialogsProps {
  dialog: EditorDialogKind;
  onClose(): void;
  onNew(name: string, width: number, height: number): void;
}

export function EditorDialogs({ dialog, onClose, onNew }: EditorDialogsProps) {
  const [newName, setNewName] = useState('Meu rabisco');
  const [newWidth, setNewWidth] = useState(1024);
  const [newHeight, setNewHeight] = useState(640);
  const [newError, setNewError] = useState('');
  const modal = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialog) {
      setNewError('');
      modal.current?.showModal();
      if (dialog === 'new') nameInput.current?.focus();
    } else modal.current?.close();
  }, [dialog]);

  return (
    <dialog
      ref={modal}
      className="window glass app-dialog"
      aria-labelledby="editor-dialog-title"
      onCancel={() => onClose()}
      onClick={(event) => {
        if (event.target === modal.current) onClose();
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id="editor-dialog-title">
          {dialog === 'new'
            ? 'Um novo começo'
            : dialog === 'about'
              ? 'Sobre o Rabisco'
              : 'Uma ajudinha para começar'}
        </div>
        <button className="dialog-close" aria-label="Fechar janela" onClick={() => onClose()}>
          ×
        </button>
      </div>
      <div className="window-body dialog-body">
        {dialog === 'new' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !Number.isInteger(newWidth) ||
                !Number.isInteger(newHeight) ||
                newWidth < 1 ||
                newHeight < 1 ||
                newWidth > 4096 ||
                newHeight > 4096 ||
                newWidth * newHeight > 16000000
              ) {
                setNewError('Use dimensões de 1 a 4096 px e no máximo 16 milhões de pixels.');
                return;
              }
              onNew(newName, newWidth, newHeight);
              onClose();
            }}
          >
            <h2>O que vamos criar hoje?</h2>
            <p>Exporte o desenho atual em PNG antes de começar outro.</p>
            <label className="field">
              Nome do desenho
              <input
                ref={nameInput}
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={120}
              />
            </label>
            <div className="dimension-fields">
              <label className="field">
                Largura (px)
                <input
                  type="number"
                  min="1"
                  max="4096"
                  value={newWidth}
                  onChange={(event) => setNewWidth(Number(event.target.value))}
                  required
                />
              </label>
              <span>×</span>
              <label className="field">
                Altura (px)
                <input
                  type="number"
                  min="1"
                  max="4096"
                  value={newHeight}
                  onChange={(event) => setNewHeight(Number(event.target.value))}
                  required
                />
              </label>
            </div>
            <div className="preset-buttons">
              <button
                type="button"
                onClick={() => {
                  setNewWidth(1024);
                  setNewHeight(640);
                }}
              >
                Paisagem
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewWidth(800);
                  setNewHeight(800);
                }}
              >
                Quadrado
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewWidth(640);
                  setNewHeight(900);
                }}
              >
                Retrato
              </button>
            </div>
            {newError && (
              <p role="alert" className="form-error">
                {newError}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => onClose()}>
                Cancelar
              </button>
              <button className="primary-button" type="submit">
                Criar desenho
              </button>
            </div>
          </form>
        )}
        {dialog === 'about' && (
          <>
            <Logo large />
            <p className="about-tagline">Um pequeno ateliê. Infinitas possibilidades.</p>
            <p>
              Versão 0.1.0 · Feito para desenhar com calma, curiosidade e um pouco de nostalgia.
            </p>
            <div className="about-credits">
              <h3>Feito com ferramentas abertas</h3>
              <p>
                Interface: 7.css (MIT). Fonte: Selawik (OFL 1.1). Ícones: Fugue, por Yusuke
                Kamiyamane (
                <a
                  href="https://creativecommons.org/licenses/by/3.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 3.0
                </a>
                ).
              </p>
              <p>
                React, Zustand, Immer, Vite e Vitest (MIT); Dexie, TypeScript, Playwright e
                fake-indexeddb (Apache-2.0). Logo e ilustrações originais do Rabisco.
              </p>
              <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">
                Ver licenças e créditos completos
              </a>
            </div>
            <p className="about-footnote">
              Seu desenho é salvo apenas neste navegador. Use Salvar PNG para
              guardar uma cópia.
            </p>
            <div className="dialog-actions">
              <button className="primary-button" onClick={() => onClose()}>
                Vamos desenhar
              </button>
            </div>
          </>
        )}
        {dialog === 'help' && (
          <>
            <h2>Seu próximo traço começa aqui.</h2>
            <p>
              Escolha uma ferramenta, uma cor e faça o primeiro risco. Você pode desfazer quando
              quiser.
            </p>
            <div className="shortcut-list">
              {[
                ['B / P', 'Pincel / lápis'],
                ['E / F', 'Borracha / balde'],
                ['S / I', 'Seleção / conta-gotas'],
                ['L / R / O', 'Linha / retângulo / elipse'],
                ['Ctrl + Z / Y', 'Desfazer / refazer'],
                ['Ctrl + S / O', 'Salvar / abrir PNG'],
                ['Ctrl + A', 'Selecionar tudo'],
                ['Ctrl + C / X / V', 'Copiar / recortar / colar seleção'],
                ['Delete', 'Apagar seleção'],
                ['Alt + clique', 'Capturar uma cor'],
                ['X', 'Trocar Cor 1 e Cor 2'],
                ['Shift + arrastar', 'Restringir formas'],
                ['Ctrl + 0', 'Ajustar à janela'],
              ].map(([key, label]) => (
                <div key={key}>
                  <kbd>{key}</kbd>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="help-note">
              A seleção pode ser movida arrastando por dentro dela. O botão direito desenha com a
              Cor 2.
            </p>
            <div className="dialog-actions">
              <button className="primary-button" onClick={() => onClose()}>
                Entendi, mãos à obra
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
