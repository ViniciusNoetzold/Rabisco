import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FILTROS, type IdFiltro } from '../../filtros/registro';
import './filtros.css';

const categorias = [...new Set(FILTROS.map(({ categoria }) => categoria))];

export function FiltrosMenu({
  desabilitado,
  podeRepetir,
  escolher,
  repetir,
}: {
  desabilitado: boolean;
  podeRepetir: boolean;
  escolher(filtro: IdFiltro): void;
  repetir(): void;
}) {
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [itemInicial, definirItemInicial] = useState<'primeiro' | 'ultimo' | null>(null);
  const aberto = itemInicial !== null && !desabilitado;

  function fechar() {
    definirItemInicial(null);
    botao.current?.focus({ preventScroll: true });
  }

  function itens() {
    return Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
  }

  useEffect(() => {
    if (desabilitado) definirItemInicial(null);
  }, [desabilitado]);

  useLayoutEffect(() => {
    if (!aberto) return;
    const painel = menu.current;
    const ancora = botao.current;
    if (!painel || !ancora) return;
    painel.showPopover?.();

    const posicionar = () => {
      const caixa = ancora.getBoundingClientRect();
      const { offsetWidth: largura, offsetHeight: altura } = painel;
      painel.style.left = `${Math.max(8, Math.min(caixa.left, innerWidth - largura - 8))}px`;
      painel.style.top = `${caixa.bottom + altura > innerHeight - 8 ? Math.max(8, caixa.top - altura) : caixa.bottom}px`;
    };
    const clicarFora = (evento: PointerEvent) => {
      const alvo = evento.target;
      if (alvo instanceof Node && !painel.contains(alvo) && !ancora.contains(alvo))
        definirItemInicial(null);
    };

    posicionar();
    const opcoes = itens();
    opcoes.at(itemInicial === 'ultimo' ? -1 : 0)?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', clicarFora);
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    return () => {
      document.removeEventListener('pointerdown', clicarFora);
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
      if (painel.isConnected) painel.hidePopover?.();
    };
  }, [aberto, itemInicial]);

  function navegar(evento: KeyboardEvent<HTMLDivElement>) {
    const { key } = evento;
    if (key === 'Escape' || key === 'Tab') {
      if (key === 'Escape') evento.preventDefault();
      evento.stopPropagation();
      fechar();
      return;
    }
    if (
      (evento.ctrlKey || evento.metaKey) &&
      !evento.shiftKey &&
      !evento.altKey &&
      key.toLowerCase() === 'f'
    ) {
      if (!podeRepetir) return;
      evento.preventDefault();
      evento.stopPropagation();
      if (!evento.repeat) {
        fechar();
        repetir();
      }
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return;
    evento.preventDefault();
    const opcoes = itens();
    const atual = opcoes.findIndex((item) => item === document.activeElement);
    const passo = key === 'ArrowDown' ? 1 : -1;
    const proximo =
      key === 'Home' ? 0 : key === 'End' ? -1 : (atual + passo + opcoes.length) % opcoes.length;
    opcoes.at(proximo)?.focus({ preventScroll: true });
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="filtros-botao"
        disabled={desabilitado}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        onClick={() => (aberto ? fechar() : definirItemInicial('primeiro'))}
        onKeyDown={(evento) => {
          if (!['ArrowDown', 'ArrowUp'].includes(evento.key)) return;
          evento.preventDefault();
          definirItemInicial(evento.key === 'ArrowUp' ? 'ultimo' : 'primeiro');
        }}
      >
        Filtros <span className="chevron" aria-hidden="true" />
      </button>
      {aberto && (
        <div
          ref={menu}
          id={id}
          popover="manual"
          className="orientation-menu filtros-menu"
          role="menu"
          aria-label="Filtros"
          onKeyDown={navegar}
        >
          {categorias.map((categoria) => (
            <div key={categoria} role="group" aria-label={categoria}>
              <div className="filtros-categoria" aria-hidden="true">
                {categoria}
              </div>
              {FILTROS.filter((filtro) => filtro.categoria === categoria).map(({ id, nome }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    fechar();
                    escolher(id);
                  }}
                >
                  {nome}
                </button>
              ))}
            </div>
          ))}
          <div className="filtros-separador" role="separator" />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={!podeRepetir}
            aria-keyshortcuts="Control+F"
            onClick={() => {
              fechar();
              repetir();
            }}
          >
            Repetir último filtro <kbd aria-hidden="true">Ctrl+F</kbd>
          </button>
        </div>
      )}
    </>
  );
}
