import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ArquivoRecente } from '../../storage/recentes';
import { Icon } from './Primitives';

interface FileMenuProps {
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onSaveAs(): void;
  onExportPng(): void;
  onPrint(): void;
  onAbout(): void;
  /** Abre um arquivo da lista de recentes. */
  onOpenRecent(arquivo: File): void;
}

/** Menu com foco circular: as setas navegam e Escape devolve o foco ao botão. */
export function FileMenu({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExportPng,
  onPrint,
  onAbout,
  onOpenRecent,
}: FileMenuProps) {
  const [open, setOpen] = useState(false);
  const [recentes, setRecentes] = useState<ArquivoRecente[]>([]);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    void import('../../storage/recentes')
      .then(({ listarRecentes }) => listarRecentes())
      .then((lista) => ativo && setRecentes(lista))
      .catch(() => ativo && setRecentes([]));
    return () => {
      ativo = false;
    };
  }, [open]);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const initialItem = useRef<'first' | 'last'>('first');

  useEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[initialItem.current === 'last' ? items.length - 1 : 0]?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function activate(action: () => void) {
    close();
    action();
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const current = items.findIndex((item) => item === document.activeElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div className="file-menu-anchor">
      <button
        ref={trigger}
        className={`file-button ${open ? 'open' : ''}`}
        aria-haspopup="menu"
        aria-controls="file-menu"
        aria-expanded={open}
        onClick={() => {
          initialItem.current = 'first';
          open ? close() : setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          initialItem.current = ['ArrowUp', 'End'].includes(event.key) ? 'last' : 'first';
          setOpen(true);
        }}
      >
        Arquivo <span className="chevron" />
      </button>
      {open && (
        <>
          <button
            className="menu-scrim"
            tabIndex={-1}
            aria-label="Fechar menu Arquivo"
            onClick={close}
          />
          <div
            ref={menu}
            id="file-menu"
            className="file-menu"
            role="menu"
            aria-label="Arquivo"
            onKeyDown={navigate}
          >
            <button role="menuitem" tabIndex={-1} onClick={() => activate(onNew)}>
              <Icon name="document" />
              Novo desenho <kbd>Ctrl+N</kbd>
            </button>
            <button role="menuitem" tabIndex={-1} onClick={() => activate(onOpen)}>
              <Icon name="folder-open" />
              Abrir imagem ou desenho <kbd>Ctrl+O</kbd>
            </button>
            <button role="menuitem" tabIndex={-1} onClick={() => activate(onSave)}>
              <Icon name="disk" />
              Salvar (.rabisco) <kbd>Ctrl+S</kbd>
            </button>
            <button role="menuitem" tabIndex={-1} onClick={() => activate(onSaveAs)}>
              <Icon name="disk" />
              Salvar como <kbd>Ctrl+Shift+S</kbd>
            </button>
            <button role="menuitem" tabIndex={-1} onClick={() => activate(onExportPng)}>
              <Icon name="picture" />
              Exportar PNG
            </button>
            <button role="menuitem" tabIndex={-1} onClick={() => activate(onPrint)}>
              <Icon name="document" />
              Imprimir <kbd>Ctrl+P</kbd>
            </button>
            {recentes.length > 0 && (
              <>
                <div className="menu-rule" />
                <p className="menu-secao">Recentes</p>
                {recentes.map((recente) => (
                  <button
                    key={recente.id}
                    role="menuitem"
                    tabIndex={-1}
                    className="menu-recente"
                    title={recente.arquivo}
                    onClick={() =>
                      activate(() => {
                        void import('../../storage/recentes')
                          .then(({ lerRecente }) => lerRecente(recente.id!))
                          .then((arquivo) => arquivo && onOpenRecent(arquivo));
                      })
                    }
                  >
                    <img src={recente.miniatura} alt="" />
                    <span>{recente.arquivo}</span>
                  </button>
                ))}
                <button
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() =>
                    activate(() => {
                      void import('../../storage/recentes').then(({ limparRecentes }) =>
                        limparRecentes(),
                      );
                    })
                  }
                >
                  <Icon name="bin" />
                  Limpar recentes
                </button>
              </>
            )}
            <div className="menu-rule" />
            <button role="menuitem" tabIndex={-1} onClick={() => activate(onAbout)}>
              <Icon name="information" />
              Sobre o Rabisco
            </button>
            <p>Seu trabalho é salvo automaticamente neste dispositivo.</p>
          </div>
        </>
      )}
    </div>
  );
}
