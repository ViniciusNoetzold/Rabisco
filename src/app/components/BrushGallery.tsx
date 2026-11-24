import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { PINCEIS } from '../../brushes/catalogo';
import { useEditor } from '../store';
import { BrushStrokeSample } from './BrushStrokeSample';
import { Icon } from './Primitives';
import './brush-controls.css';

const COLUNAS = 3;
const ESPACO_DA_TELA = 8;
const SELETOR_OPCOES = '[role="menuitemradio"]';

export function BrushGallery({ carregando }: { carregando: boolean }) {
  const pincel = useEditor((estado) => estado.pincel);
  const ferramentaAtiva = useEditor((estado) => estado.tool === 'brush');
  const selecionar = useEditor((estado) => estado.setPincel);
  const [aberto, setAberto] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const primeiroFoco = useRef(0);
  const menuId = useId();
  const indiceAtual = PINCEIS.findIndex(({ id }) => id === pincel);
  const nomeAtual = PINCEIS[indiceAtual]?.nome ?? 'Pincel redondo';

  useLayoutEffect(() => {
    if (!aberto || !gatilho.current || !menu.current) return;
    const botao = gatilho.current;
    const painel = menu.current;

    function posicionar() {
      const ancora = botao.getBoundingClientRect();
      const { width, height } = painel.getBoundingClientRect();
      const encaixaAbaixo = ancora.bottom + height + ESPACO_DA_TELA <= window.innerHeight;
      painel.style.left = `${Math.max(
        ESPACO_DA_TELA,
        Math.min(ancora.left, window.innerWidth - width - ESPACO_DA_TELA),
      )}px`;
      painel.style.top = `${Math.max(
        ESPACO_DA_TELA,
        encaixaAbaixo ? ancora.bottom : ancora.top - height,
      )}px`;
    }

    function clicarFora(evento: PointerEvent) {
      const alvo = evento.target;
      if (alvo instanceof Node && !painel.contains(alvo) && !botao.contains(alvo)) {
        setAberto(false);
      }
    }

    posicionar();
    painel.querySelectorAll<HTMLButtonElement>(SELETOR_OPCOES)[primeiroFoco.current]?.focus({
      preventScroll: true,
    });
    document.addEventListener('pointerdown', clicarFora);
    window.addEventListener('scroll', posicionar, true);
    window.addEventListener('resize', posicionar);
    return () => {
      document.removeEventListener('pointerdown', clicarFora);
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [aberto]);

  function abrir(indice = Math.max(0, indiceAtual)) {
    primeiroFoco.current = indice;
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    gatilho.current?.focus({ preventScroll: true });
  }

  function navegar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape' || evento.key === 'Tab') {
      if (evento.key === 'Escape') evento.preventDefault();
      fechar();
      return;
    }

    const itens = Array.from(
      evento.currentTarget.querySelectorAll<HTMLButtonElement>(SELETOR_OPCOES),
    );
    const atual = Math.max(
      0,
      itens.findIndex((item) => item === document.activeElement),
    );
    let proximo: number;
    switch (evento.key) {
      case 'ArrowRight':
        proximo = atual + 1;
        break;
      case 'ArrowLeft':
        proximo = atual - 1;
        break;
      case 'ArrowDown':
        proximo = atual + COLUNAS;
        break;
      case 'ArrowUp':
        proximo = atual - COLUNAS;
        break;
      case 'Home':
        proximo = 0;
        break;
      case 'End':
        proximo = itens.length - 1;
        break;
      default:
        return;
    }
    evento.preventDefault();
    itens[(proximo + itens.length) % itens.length]?.focus();
  }

  return (
    <>
      <button
        type="button"
        className={`ribbon-large brush-choice brush-gallery-trigger ${ferramentaAtiva ? 'selected' : ''}`}
        ref={gatilho}
        disabled={carregando}
        aria-label="Galeria de pincéis"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? menuId : undefined}
        title={`Galeria de pincéis. Atual: ${nomeAtual}`}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={(evento) => {
          if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
          evento.preventDefault();
          abrir(evento.key === 'ArrowUp' ? PINCEIS.length - 1 : 0);
        }}
      >
        <Icon name="paint-brush" className="large-icon" />
        <span className="brush-gallery-caption">
          <span>{pincel === 'spray' ? 'Spray' : nomeAtual}</span>
          <span className="chevron" aria-hidden="true" />
        </span>
      </button>
      {aberto &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            className="brush-gallery-menu"
            role="menu"
            aria-label="Pincéis"
            onKeyDown={navegar}
          >
            {PINCEIS.map(({ id, nome }) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={id === pincel}
                tabIndex={-1}
                onClick={() => {
                  selecionar(id);
                  fechar();
                }}
              >
                <BrushStrokeSample tipo={id} cor="#315d7e" espessura={id === 'spray' ? 17 : 12} />
                <span>{nome}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
