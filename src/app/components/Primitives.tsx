import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useRecolhimento } from './ribbonRecolhimento';

export type RunAction = (action: () => void | Promise<void> | undefined) => void;

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <img className={`icon ${className}`} src={`/icons/${name}.png`} alt="" draggable={false} />
  );
}
export function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand ${large ? 'brand-large' : ''}`}>
      <img src="/favicon.svg" alt="" />
      <span>
        rabisco<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function RibbonGroup({
  title,
  children,
  className = '',
  chave,
  prioridade,
  icone,
  compacto = false,
  rotuloRecolhido,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** Identifica o grupo no recolhimento. Sem chave, o grupo nunca recolhe. */
  chave?: string;
  /** Menor prioridade recolhe primeiro quando o ribbon não cabe na janela. */
  prioridade?: number;
  /** Ícone do botão do grupo recolhido. */
  icone?: string;
  /** Mostra uma versão reduzida (usado pela paleta de cores). */
  compacto?: boolean;
  /** Nome mais curto para o botão do grupo recolhido. */
  rotuloRecolhido?: string;
}) {
  const { recolhidos } = useRecolhimento();
  const recolhido = Boolean(chave && recolhidos.has(chave));
  const [aberto, setAberto] = useState(false);
  const grupo = useRef<HTMLElement>(null);
  const idPainel = useId();

  useEffect(() => {
    if (!recolhido) setAberto(false);
  }, [recolhido]);

  useEffect(() => {
    if (!aberto) return;
    function fora(evento: PointerEvent) {
      if (!grupo.current?.contains(evento.target as Node)) setAberto(false);
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return;
      const menu = evento.target instanceof Element && evento.target.closest('[role="menu"]');
      if (!menu || !grupo.current?.contains(menu)) setAberto(false);
    }
    document.addEventListener('pointerdown', fora, true);
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('keydown', tecla, true);
    };
  }, [aberto]);

  const atributos = {
    'data-grupo': chave,
    'data-prioridade': prioridade,
    'data-compacto': compacto ? '' : undefined,
  };
  if (!recolhido) {
    return (
      <section className={`ribbon-group ${className}`} aria-label={title} {...atributos}>
        <div className="ribbon-group-content">{children}</div>
        <div className="ribbon-group-label">{title}</div>
      </section>
    );
  }
  return (
    <section
      ref={grupo}
      className="ribbon-group ribbon-group-recolhido"
      aria-label={title}
      data-recolhido=""
      {...atributos}
    >
      <button
        className="ribbon-large ribbon-group-botao"
        aria-expanded={aberto}
        aria-controls={idPainel}
        title={title}
        onClick={() => setAberto((valor) => !valor)}
      >
        <Icon name={icone ?? 'plus'} className="large-icon" />
        <span>{rotuloRecolhido ?? title}</span>
        <span className="ribbon-group-seta" aria-hidden="true">
          ▾
        </span>
      </button>
      {aberto && (
        <div
          id={idPainel}
          className={`ribbon-painel-recolhido ${className}`}
          role="group"
          aria-label={title}
        >
          <div className="ribbon-group-content">{children}</div>
          <div className="ribbon-group-label">{title}</div>
        </div>
      )}
    </section>
  );
}

/**
 * Aviso discreto enquanto um módulo carregado sob demanda (diálogos, editor de formas) chega.
 * Só aparece se a espera passar de 200 ms, para não piscar em conexões rápidas.
 */
export function CarregandoDiscreto() {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const espera = setTimeout(() => setVisivel(true), 200);
    return () => clearTimeout(espera);
  }, []);
  if (!visivel) return null;
  return (
    <div className="carregando-discreto" role="status">
      <span className="carregando-ponto" aria-hidden="true" />
      Carregando…
    </div>
  );
}
