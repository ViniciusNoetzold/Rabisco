import { useLayoutEffect, useRef, type PointerEvent as EventoPonteiro } from 'react';
import { useEditor } from '../app/store';
import { soltarGuia } from './soltarGuia';
import type { Point } from '../layers/types';
import { medirViewport, prepararTelaPequena, type PropsViewportVisual } from './viewportVisual';
import './viewportVisual.css';

const FAIXA = 22;

/** Retorna a primeira medida inteira legível na escala atual. */
function intervaloPrincipal(zoom: number) {
  const alvo = 54 / zoom;
  const potencia = 10 ** Math.floor(Math.log10(alvo));
  return ([1, 2, 5, 10].find((n) => n * potencia >= alvo) ?? 10) * potencia;
}

function desenharRegua(
  tela: HTMLCanvasElement,
  vertical: boolean,
  disponivel: number,
  origem: number,
  total: number,
  zoom: number,
  cursor: number | null,
) {
  const ctx = prepararTelaPequena(
    tela,
    vertical ? FAIXA : disponivel,
    vertical ? disponivel : FAIXA,
  );
  if (!ctx) return;
  if (vertical) {
    ctx.translate(0, disponivel);
    ctx.rotate(-Math.PI / 2);
  }

  const inicio = FAIXA - origem;
  const maior = intervaloPrincipal(zoom);
  const menor = maior % 5 === 0 ? maior / 5 : maior / 2;
  const passo = Math.max(1, menor);
  const primeiro = Math.max(0, Math.ceil(inicio / (zoom * passo)) * passo);
  const ultimo = Math.min(total, (inicio + disponivel) / zoom);
  const sinal = vertical ? -1 : 1;
  const posicao = (offset: number) => (vertical ? disponivel : 0) + sinal * offset;

  ctx.fillStyle = '#f4f8fb';
  ctx.fillRect(0, 0, disponivel, FAIXA);
  ctx.strokeStyle = '#9ab1c4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, FAIXA - 0.5);
  ctx.lineTo(disponivel, FAIXA - 0.5);
  ctx.stroke();
  ctx.fillStyle = '#526e83';
  ctx.font = '10px Selawik, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = vertical ? 'right' : 'left';
  for (let valor = primeiro; valor <= ultimo; valor += passo) {
    const x = Math.round(posicao(valor * zoom - inicio)) - 0.5;
    const marcaMaior = valor % maior === 0;
    const alturaMarca = marcaMaior ? 8 : 4;
    ctx.fillRect(x, FAIXA - alturaMarca, 1, alturaMarca - 1);
    if (marcaMaior) ctx.fillText(String(valor), x + (vertical ? -3 : 3), 2);
  }

  if (cursor !== null && cursor >= FAIXA && cursor <= disponivel + FAIXA) {
    const x = posicao(cursor - FAIXA);
    ctx.fillStyle = '#1b74af';
    ctx.fillRect(Math.round(x), 0, 1, FAIXA);
    ctx.beginPath();
    ctx.moveTo(x - 3, FAIXA - 1);
    ctx.lineTo(x + 3, FAIXA - 1);
    ctx.lineTo(x, FAIXA - 7);
    ctx.closePath();
    ctx.fill();
  }
}

export function Reguas({ viewport, tela, zoom, largura, altura }: PropsViewportVisual) {
  const moldura = useRef<HTMLDivElement>(null);
  const horizontal = useRef<HTMLCanvasElement>(null);
  const vertical = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<Point | null>(null);

  useLayoutEffect(() => {
    const scroll = viewport.current;
    const desenho = tela.current;
    const reguas = moldura.current;
    const topo = horizontal.current;
    const lateral = vertical.current;
    if (!scroll || !desenho || !reguas || !topo || !lateral) return;
    let quadroPendente = 0;

    function pintar() {
      quadroPendente = 0;
      if (!scroll || !desenho || !reguas || !topo || !lateral) return;
      const quadro = medirViewport(scroll, desenho);
      if (quadro.width <= FAIXA || quadro.height <= FAIXA) return;
      reguas.style.width = `${quadro.width}px`;
      reguas.style.height = `${quadro.height}px`;
      const ponto = cursor.current && {
        x: cursor.current.x - quadro.esquerda,
        y: cursor.current.y - quadro.topo,
      };
      const estaNoPapel =
        ponto &&
        ponto.x >= quadro.papelX &&
        ponto.y >= quadro.papelY &&
        ponto.x < quadro.papelX + largura * zoom &&
        ponto.y < quadro.papelY + altura * zoom;
      desenharRegua(
        topo,
        false,
        quadro.width - FAIXA,
        quadro.papelX,
        largura,
        zoom,
        estaNoPapel ? ponto.x : null,
      );
      desenharRegua(
        lateral,
        true,
        quadro.height - FAIXA,
        quadro.papelY,
        altura,
        zoom,
        estaNoPapel ? ponto.y : null,
      );
    }

    function agendar() {
      if (!quadroPendente) quadroPendente = requestAnimationFrame(pintar);
    }

    function mover(evento: PointerEvent) {
      cursor.current = { x: evento.clientX, y: evento.clientY };
      agendar();
    }

    function sair() {
      cursor.current = null;
      agendar();
    }

    pintar();
    const observador = new ResizeObserver(agendar);
    observador.observe(scroll);
    observador.observe(desenho);
    scroll.addEventListener('scroll', agendar, { passive: true });
    scroll.addEventListener('pointermove', mover, { passive: true, capture: true });
    scroll.addEventListener('pointerleave', sair);
    return () => {
      observador.disconnect();
      scroll.removeEventListener('scroll', agendar);
      scroll.removeEventListener('pointermove', mover, true);
      scroll.removeEventListener('pointerleave', sair);
      if (quadroPendente) cancelAnimationFrame(quadroPendente);
    };
  }, [viewport, tela, zoom, largura, altura]);

  /** Arrastar da régua de cima cria uma guia horizontal; da lateral, uma vertical. */
  function arrastarGuia(eixo: 'horizontal' | 'vertical') {
    const valor = (evento: EventoPonteiro) => {
      const papel = tela.current!.getBoundingClientRect();
      return Math.round(
        eixo === 'horizontal'
          ? (evento.clientY - papel.top) / zoom
          : (evento.clientX - papel.left) / zoom,
      );
    };
    return {
      onPointerDown(evento: EventoPonteiro<HTMLCanvasElement>) {
        if (evento.button !== 0 || !tela.current) return;
        evento.preventDefault();
        evento.currentTarget.setPointerCapture(evento.pointerId);
        useEditor.getState().set({ guiaNova: { eixo, valor: valor(evento) }, mostrarGuias: true });
      },
      onPointerMove(evento: EventoPonteiro<HTMLCanvasElement>) {
        if (!evento.currentTarget.hasPointerCapture(evento.pointerId) || !tela.current) return;
        useEditor.getState().set({ guiaNova: { eixo, valor: valor(evento) } });
      },
      onPointerUp(evento: EventoPonteiro<HTMLCanvasElement>) {
        if (!evento.currentTarget.hasPointerCapture(evento.pointerId)) return;
        soltarGuia(largura, altura);
      },
      onPointerCancel() {
        useEditor.getState().set({ guiaNova: null });
      },
    };
  }

  return (
    <div ref={moldura} className="canvas-rulers" aria-hidden="true">
      <div className="canvas-rulers-corner">px</div>
      <canvas
        ref={horizontal}
        className="canvas-ruler-x"
        title="Arraste para o papel para criar uma guia horizontal"
        {...arrastarGuia('horizontal')}
      />
      <canvas
        ref={vertical}
        className="canvas-ruler-y"
        title="Arraste para o papel para criar uma guia vertical"
        {...arrastarGuia('vertical')}
      />
    </div>
  );
}
