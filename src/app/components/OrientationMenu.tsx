import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { OrientacaoImagem } from '../../commands/comandos';
import { Icon } from './Primitives';
import './paper-tools.css';

const opcoes = [
  { id: 'direita', rotulo: 'Girar 90° à direita', icone: 'arrow-return' },
  { id: 'esquerda', rotulo: 'Girar 90° à esquerda', icone: 'arrow-return-180-left' },
  { id: '180', rotulo: 'Girar 180°', icone: 'arrow-curve-180-left' },
  { id: 'vertical', rotulo: 'Inverter verticalmente', icone: 'arrow-switch' },
  { id: 'horizontal', rotulo: 'Inverter horizontalmente', icone: 'arrow-switch' },
] as const;

function ancorar(botao: HTMLButtonElement) {
  const caixa = botao.getBoundingClientRect();
  const larguraMenu = 224;
  const alturaMenu = 168;
  return {
    left: Math.max(8, Math.min(caixa.left, window.innerWidth - larguraMenu - 8)),
    top:
      caixa.bottom + alturaMenu > window.innerHeight
        ? Math.max(8, caixa.top - alturaMenu)
        : caixa.bottom,
  };
}

export function OrientationMenu({
  aplicar,
  desabilitado,
}: {
  aplicar(orientacao: OrientacaoImagem): void;
  desabilitado: boolean;
}) {
  const idMenu = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const primeiroFoco = useRef(0);
  const [posicao, definirPosicao] = useState<{ left: number; top: number } | null>(null);
  const aberto = posicao !== null;

  useEffect(() => {
    if (!aberto) return;
    menu.current
      ?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
      [primeiroFoco.current]?.focus({ preventScroll: true });

    function clicarFora(evento: PointerEvent) {
      const alvo = evento.target;
      if (alvo instanceof Node && !menu.current?.contains(alvo) && !botao.current?.contains(alvo)) {
        definirPosicao(null);
      }
    }
    function atualizarAncora() {
      if (!botao.current) return;
      const nova = ancorar(botao.current);
      definirPosicao((atual) => {
        if (!atual || (atual.left === nova.left && atual.top === nova.top)) return atual;
        return nova;
      });
    }
    document.addEventListener('pointerdown', clicarFora);
    window.addEventListener('scroll', atualizarAncora, true);
    window.addEventListener('resize', atualizarAncora);
    return () => {
      document.removeEventListener('pointerdown', clicarFora);
      window.removeEventListener('scroll', atualizarAncora, true);
      window.removeEventListener('resize', atualizarAncora);
    };
  }, [aberto]);

  function abrir(itemInicial = 0) {
    if (!botao.current) return;
    primeiroFoco.current = itemInicial;
    definirPosicao(ancorar(botao.current));
  }

  function fechar() {
    definirPosicao(null);
    botao.current?.focus({ preventScroll: true });
  }

  function navegar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape' || evento.key === 'Tab') {
      if (evento.key === 'Escape') evento.preventDefault();
      fechar();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) return;
    evento.preventDefault();
    const itens = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    const atual = itens.findIndex((item) => item === document.activeElement);
    const deslocamento = evento.key === 'ArrowDown' ? 1 : -1;
    const proximo =
      evento.key === 'Home'
        ? 0
        : evento.key === 'End'
          ? itens.length - 1
          : (atual + deslocamento + itens.length) % itens.length;
    itens[proximo]?.focus({ preventScroll: true });
  }

  return (
    <>
      <button
        type="button"
        ref={botao}
        disabled={desabilitado}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={(evento) => {
          if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
          evento.preventDefault();
          abrir(evento.key === 'ArrowDown' ? 0 : opcoes.length - 1);
        }}
      >
        <Icon name="arrow-return" />
        Girar <span className="chevron" aria-hidden="true" />
      </button>
      {posicao &&
        createPortal(
          <div
            id={idMenu}
            className="orientation-menu"
            ref={menu}
            style={posicao}
            role="menu"
            aria-label="Girar ou inverter"
            onKeyDown={navegar}
          >
            {opcoes.map(({ id, rotulo, icone }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => {
                  fechar();
                  aplicar(id);
                }}
              >
                <Icon
                  name={icone}
                  className={id === 'vertical' ? 'orientation-icon-vertical' : undefined}
                />
                {rotulo}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
