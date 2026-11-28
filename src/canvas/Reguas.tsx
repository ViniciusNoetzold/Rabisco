import { useLayoutEffect, useRef, type PointerEvent as EventoPonteiro } from 'react';
import { useEditor } from '../app/store';
import type { ComandoGuia } from '../commands/comandos';
import { soltarGuia } from './soltarGuia';
import type { Point } from '../layers/types';
import { telaParaPapel } from './vista';
import {
  eixosDasReguas,
  medirViewport,
  prepararTelaPequena,
  type PropsViewportVisual,
} from './viewportVisual';
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
  escala: number,
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

  const da = (FAIXA - origem) / escala;
  const ate = (FAIXA + disponivel - origem) / escala;
  const maior = intervaloPrincipal(Math.abs(escala));
  const menor = maior % 5 === 0 ? maior / 5 : maior / 2;
  const passo = Math.max(1, menor);
  const primeiro = Math.max(0, Math.ceil(Math.min(da, ate) / passo) * passo);
  const ultimo = Math.min(total, Math.max(da, ate));
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
    const x = Math.round(posicao(origem + valor * escala - FAIXA)) - 0.5;
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

export function Reguas({
  viewport,
  tela,
  zoom,
  largura,
  altura,
  vista,
  executarGuia,
}: PropsViewportVisual & { executarGuia(comando: ComandoGuia): void }) {
  const moldura = useRef<HTMLDivElement>(null);
  const horizontal = useRef<HTMLCanvasElement>(null);
  const vertical = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<Point | null>(null);
  const { rotacao, espelhar } = vista;
  const eixos = eixosDasReguas(zoom, largura, altura, vista);

  useLayoutEffect(() => {
    const scroll = viewport.current;
    const desenho = tela.current;
    const reguas = moldura.current;
    const topo = horizontal.current;
    const lateral = vertical.current;
    if (!scroll || !desenho || !reguas || !topo || !lateral) return;
    const orientacao = { rotacao, espelhar };
    const eixos = eixosDasReguas(zoom, largura, altura, orientacao);
    let quadroPendente = 0;

    function pintar() {
      quadroPendente = 0;
      if (!scroll || !desenho || !reguas || !topo || !lateral) return;
      const quadro = medirViewport(scroll, desenho);
      if (quadro.width <= FAIXA || quadro.height <= FAIXA) return;
      reguas.style.width = `${quadro.width}px`;
      reguas.style.height = `${quadro.height}px`;
      const ponto =
        cursor.current &&
        telaParaPapel(cursor.current, quadro.papel, largura, altura, zoom, orientacao);
      const visivel =
        ponto && ponto.x >= 0 && ponto.y >= 0 && ponto.x < largura && ponto.y < altura
          ? ponto
          : null;
      const origemX =
        quadro.papel.left +
        quadro.papel.width / 2 -
        quadro.esquerda -
        (eixos.topo.total * eixos.topo.escala) / 2;
      const origemY =
        quadro.papel.top +
        quadro.papel.height / 2 -
        quadro.topo -
        (eixos.lateral.total * eixos.lateral.escala) / 2;
      desenharRegua(
        topo,
        false,
        quadro.width - FAIXA,
        origemX,
        eixos.topo.total,
        eixos.topo.escala,
        visivel ? origemX + visivel[eixos.topo.eixo] * eixos.topo.escala : null,
      );
      desenharRegua(
        lateral,
        true,
        quadro.height - FAIXA,
        origemY,
        eixos.lateral.total,
        eixos.lateral.escala,
        visivel ? origemY + visivel[eixos.lateral.eixo] * eixos.lateral.escala : null,
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
  }, [viewport, tela, zoom, largura, altura, rotacao, espelhar]);

  /** Cada régua cria uma guia paralela ao seu eixo no papel. */
  function arrastarGuia(eixo: 'horizontal' | 'vertical') {
    const valor = (evento: EventoPonteiro, direcao: typeof eixo) => {
      const ponto = telaParaPapel(
        { x: evento.clientX, y: evento.clientY },
        tela.current!.getBoundingClientRect(),
        largura,
        altura,
        zoom,
        vista,
      );
      return Math.round(direcao === 'horizontal' ? ponto.y : ponto.x);
    };
    const atualizar = (evento: EventoPonteiro<HTMLCanvasElement>) => {
      const estado = useEditor.getState();
      if (!estado.guiaNova || !tela.current) return;
      const guiaNova = { ...estado.guiaNova, valor: valor(evento, estado.guiaNova.eixo) };
      estado.set({ guiaNova });
    };
    return {
      onPointerDown(evento: EventoPonteiro<HTMLCanvasElement>) {
        if (evento.button !== 0 || !tela.current || useEditor.getState().guiaNova) return;
        evento.preventDefault();
        evento.currentTarget.setPointerCapture(evento.pointerId);
        useEditor
          .getState()
          .set({ guiaNova: { eixo, valor: valor(evento, eixo) }, mostrarGuias: true });
      },
      onPointerMove(evento: EventoPonteiro<HTMLCanvasElement>) {
        if (!evento.currentTarget.hasPointerCapture(evento.pointerId)) return;
        atualizar(evento);
      },
      onPointerUp(evento: EventoPonteiro<HTMLCanvasElement>) {
        if (!evento.currentTarget.hasPointerCapture(evento.pointerId)) return;
        atualizar(evento);
        soltarGuia(largura, altura, executarGuia);
      },
      onPointerCancel() {
        useEditor.getState().set({ guiaNova: null });
      },
      onLostPointerCapture() {
        useEditor.getState().set({ guiaNova: null });
      },
    };
  }

  const guiaTopo = eixos.topo.eixo === 'x' ? 'horizontal' : 'vertical';
  const guiaLateral = eixos.lateral.eixo === 'x' ? 'horizontal' : 'vertical';

  return (
    <div ref={moldura} className="canvas-rulers" aria-hidden="true">
      <div className="canvas-rulers-corner">px</div>
      <canvas
        ref={horizontal}
        className="canvas-ruler-x"
        data-eixo={eixos.topo.eixo}
        title={`Eixo ${eixos.topo.eixo.toUpperCase()} do papel. Arraste para criar uma guia ${guiaTopo}.`}
        {...arrastarGuia(guiaTopo)}
      />
      <canvas
        ref={vertical}
        className="canvas-ruler-y"
        data-eixo={eixos.lateral.eixo}
        title={`Eixo ${eixos.lateral.eixo.toUpperCase()} do papel. Arraste para criar uma guia ${guiaLateral}.`}
        {...arrastarGuia(guiaLateral)}
      />
    </div>
  );
}
