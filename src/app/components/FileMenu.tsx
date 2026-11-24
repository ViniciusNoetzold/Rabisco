import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Primitives';

interface FileMenuProps {
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onAbout(): void;
}

/** Menu com foco circular: as setas navegam e Escape devolve o foco ao botão. */
export function FileMenu({ onNew, onOpen, onSave, onAbout }: FileMenuProps) {
  const [open, setOpen] = useState(false);
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
              Abrir PNG <kbd>Ctrl+O</kbd>
            </button>
            <button role="menuitem" tabIndex={-1} onClick={() => activate(onSave)}>
              <Icon name="disk" />
              Salvar PNG <kbd>Ctrl+S</kbd>
            </button>
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
