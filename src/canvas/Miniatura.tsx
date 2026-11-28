import { useLayoutEffect, useRef, type PointerEvent } from 'react';
import type { Point } from '../layers/types';
import { deslocamentoNaTela, papelParaTela, type Vista } from './vista';
import {
  medirViewport,
  poligonoVisivel,
  prepararTelaPequena,
  type PropsViewportVisual,
} from './viewportVisual';
import './viewportVisual.css';

interface PropsMiniatura extends PropsViewportVisual {
  revisao: unknown;
  fechar(): void;
}

interface ArrasteMiniatura {
  id: number;
  origem: Point;
  scrollX: number;
  scrollY: number;
  razao: number;
  vista: Vista;
}

const MARGEM = 8;

function enquadrar(tela: HTMLCanvasElement, largura: number, altura: number) {
  const escala = Math.min(
    (tela.clientWidth - 2 * MARGEM) / largura,
    (tela.clientHeight - 2 * MARGEM) / altura,
  );
  return {
    escala,
    x: (tela.clientWidth - largura * escala) / 2,
    y: (tela.clientHeight - altura * escala) / 2,
  };
}

export function Miniatura({
  viewport,
  tela,
  zoom,
  largura,
  altura,
  vista,
  revisao,
  fechar,
}: PropsMiniatura) {
  const miniatura = useRef<HTMLCanvasElement>(null);
  const arraste = useRef<ArrasteMiniatura | null>(null);
  const atualizar = useRef<(() => void) | null>(null);
  const { rotacao, espelhar } = vista;

  useLayoutEffect(() => {
    const scroll = viewport.current;
    const desenho = tela.current;
    const mapa = miniatura.current;
    if (!scroll || !desenho || !mapa) return;
    const orientacao = { rotacao, espelhar };
    let quadroPendente = 0;

    function pintar() {
      quadroPendente = 0;
      if (!scroll || !desenho || !mapa) return;
      const ctx = prepararTelaPequena(mapa, mapa.clientWidth, mapa.clientHeight);
      if (!ctx) return;
      const { escala, x, y } = enquadrar(mapa, largura, altura);
      if (escala <= 0) return;
      const w = largura * escala;
      const h = altura * escala;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, w, h);
      ctx.drawImage(desenho, x, y, w, h);
      ctx.strokeStyle = '#9ab1c4';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
      const moldura = poligonoVisivel(
        medirViewport(scroll, desenho),
        zoom,
        largura,
        altura,
        orientacao,
      );
      if (moldura.length < 3) return;
      ctx.fillStyle = '#2a83bc19';
      ctx.strokeStyle = '#1c6da6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + moldura[0].x * escala, y + moldura[0].y * escala);
      for (let i = 1; i < moldura.length; i++) {
        ctx.lineTo(x + moldura[i].x * escala, y + moldura[i].y * escala);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    function agendar() {
      if (!quadroPendente) quadroPendente = requestAnimationFrame(pintar);
    }

    pintar();
    atualizar.current = agendar;
    const observador = new ResizeObserver(agendar);
    observador.observe(scroll);
    observador.observe(desenho);
    observador.observe(mapa);
    scroll.addEventListener('scroll', agendar, { passive: true });
    return () => {
      atualizar.current = null;
      observador.disconnect();
      scroll.removeEventListener('scroll', agendar);
      if (quadroPendente) cancelAnimationFrame(quadroPendente);
    };
  }, [viewport, tela, zoom, largura, altura, rotacao, espelhar]);

  useLayoutEffect(() => atualizar.current?.(), [revisao]);

  function pressionar(evento: PointerEvent<HTMLCanvasElement>) {
    if (evento.button !== 0 || arraste.current) return;
    const scroll = viewport.current;
    const desenho = tela.current;
    if (!scroll || !desenho) return;
    const mapa = evento.currentTarget;
    const dimensoes = mapa.getBoundingClientRect();
    const { escala, x, y } = enquadrar(mapa, largura, altura);
    if (escala <= 0) return;
    evento.preventDefault();
    mapa.focus({ preventScroll: true });
    const ponto = {
      x: Math.max(0, Math.min(largura, (evento.clientX - dimensoes.left - x) / escala)),
      y: Math.max(0, Math.min(altura, (evento.clientY - dimensoes.top - y) / escala)),
    };
    const quadro = medirViewport(scroll, desenho);
    const naTela = papelParaTela(ponto, quadro.papel, largura, altura, zoom, vista);
    const dx = naTela.x - quadro.esquerda;
    const dy = naTela.y - quadro.topo;
    const dentro = dx >= 0 && dy >= 0 && dx <= quadro.width && dy <= quadro.height;
    if (!dentro) {
      scroll.scrollTo({
        left: scroll.scrollLeft + dx - quadro.width / 2,
        top: scroll.scrollTop + dy - quadro.height / 2,
      });
    }
    arraste.current = {
      id: evento.pointerId,
      origem: { x: evento.clientX, y: evento.clientY },
      scrollX: scroll.scrollLeft,
      scrollY: scroll.scrollTop,
      razao: zoom / escala,
      vista,
    };
    mapa.setPointerCapture(evento.pointerId);
  }

  function mover(evento: PointerEvent<HTMLCanvasElement>) {
    const ativo = arraste.current;
    const scroll = viewport.current;
    if (!ativo || !scroll || ativo.id !== evento.pointerId) return;
    const delta = deslocamentoNaTela(
      { x: evento.clientX - ativo.origem.x, y: evento.clientY - ativo.origem.y },
      ativo.razao,
      ativo.vista,
    );
    scroll.scrollTo({
      left: ativo.scrollX + delta.x,
      top: ativo.scrollY + delta.y,
    });
  }

  function liberar(evento: PointerEvent<HTMLCanvasElement>) {
    if (arraste.current?.id === evento.pointerId) arraste.current = null;
  }

  return (
    <section className="canvas-overview" aria-label="Miniatura do desenho">
      <div className="canvas-overview-title">
        <strong>Miniatura</strong>
        <button
          type="button"
          aria-label="Fechar miniatura"
          title="Fechar miniatura"
          onClick={fechar}
        >
          ×
        </button>
      </div>
      <canvas
        ref={miniatura}
        tabIndex={0}
        aria-label="Navegar pela miniatura do desenho"
        title="Arraste ou use as setas para navegar"
        onPointerDown={pressionar}
        onPointerMove={mover}
        onPointerUp={liberar}
        onPointerCancel={liberar}
        onLostPointerCapture={liberar}
        onContextMenu={(evento) => evento.preventDefault()}
        onKeyDown={(evento) => {
          const passo = evento.shiftKey ? 120 : 32;
          const direcoes: Record<string, [number, number]> = {
            ArrowLeft: [-passo, 0],
            ArrowRight: [passo, 0],
            ArrowUp: [0, -passo],
            ArrowDown: [0, passo],
          };
          const direcao = direcoes[evento.key];
          if (!direcao) return;
          evento.preventDefault();
          evento.stopPropagation();
          const delta = deslocamentoNaTela({ x: direcao[0], y: direcao[1] }, 1, vista);
          viewport.current?.scrollBy({ left: delta.x, top: delta.y });
        }}
      />
    </section>
  );
}
