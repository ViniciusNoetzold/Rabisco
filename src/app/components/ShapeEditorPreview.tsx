import { useLayoutEffect, useRef } from 'react';
import type { Point } from '../../layers/types';
import type { EstiloFormaSalvo } from '../../shapes/presets';
import { desenharForma } from '../../shapes/render';
import { PARAMETROS_PADRAO } from '../../shapes/tipos';
import {
  DIVISOES_DA_GRADE,
  QUADRO_PREVIA,
  TAMANHO_PREVIA,
  type EdicaoPontos,
} from './FreeShapeControls';

function pontoNaPrevia(ponto: Point): [number, number] {
  return [
    QUADRO_PREVIA.x + ponto.x * QUADRO_PREVIA.width,
    QUADRO_PREVIA.y + ponto.y * QUADRO_PREVIA.height,
  ];
}

function desenharGrade(ctx: CanvasRenderingContext2D) {
  const { x, y, width, height } = QUADRO_PREVIA;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#deebf4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= DIVISOES_DA_GRADE; i++) {
    const px = Math.round(x + (i * width) / DIVISOES_DA_GRADE) + 0.5;
    const py = Math.round(y + (i * height) / DIVISOES_DA_GRADE) + 0.5;
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + height);
    ctx.moveTo(x, py);
    ctx.lineTo(x + width, py);
  }
  ctx.stroke();
}

function desenharControles(ctx: CanvasRenderingContext2D, edicao: EdicaoPontos) {
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#15638e';
  edicao.contornos.forEach(({ nos }, contorno) =>
    nos.forEach(({ ponto, entrada, saida, segmento }, no) => {
      const [x, y] = pontoNaPrevia(ponto);
      const ativo = contorno === edicao.selecao?.contorno && no === edicao.selecao.no;
      if (ativo) {
        for (const controle of [
          entrada,
          saida,
          segmento?.tipo === 'Q' ? segmento.controle : undefined,
        ]) {
          if (!controle) continue;
          const [controleX, controleY] = pontoNaPrevia(controle);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(controleX, controleY);
          ctx.stroke();
          ctx.fillStyle = '#5b94be';
          ctx.fillRect(controleX - 2, controleY - 2, 4, 4);
        }
      }
      ctx.beginPath();
      ctx.arc(x, y, ativo ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = ativo ? '#157bb2' : '#fff';
      ctx.fill();
      ctx.stroke();
    }),
  );
}

export function ShapeEditorPreview({
  path,
  fechada,
  estilo,
  edicao,
}: {
  path: string;
  fechada: boolean;
  estilo: EstiloFormaSalvo;
  edicao?: EdicaoPontos;
}) {
  const tela = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = tela.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    function pintar() {
      if (!canvas || !ctx) return;
      const lado = Math.round(canvas.clientWidth * Math.min(3, window.devicePixelRatio || 1));
      if (lado < 1) return;
      canvas.width = canvas.height = lado;
      ctx.setTransform(lado / TAMANHO_PREVIA, 0, 0, lado / TAMANHO_PREVIA, 0, 0);
      if (edicao) desenharGrade(ctx);
      if (path) {
        desenharForma(ctx, {
          id: 'propria:editor',
          definicao: { path, nome: 'Prévia', fechada },
          caixa: QUADRO_PREVIA,
          rotacao: 0,
          parametros: PARAMETROS_PADRAO,
          ...estilo,
        });
      }
      if (edicao) desenharControles(ctx, edicao);
    }

    pintar();
    const observador = new ResizeObserver(pintar);
    observador.observe(canvas);
    return () => observador.disconnect();
  }, [path, fechada, estilo, edicao]);

  return (
    <div className="shape-editor-artboard">
      <canvas
        ref={tela}
        role={edicao ? undefined : 'img'}
        aria-label={edicao ? 'Grade de desenho da forma' : 'Prévia da forma'}
        tabIndex={edicao ? 0 : undefined}
        data-editavel={edicao ? edicao.ferramenta : undefined}
        onPointerDown={edicao?.aoPressionar}
        onPointerMove={edicao?.aoArrastar}
        onPointerUp={(evento) => edicao?.finalizar(evento)}
        onPointerCancel={(evento) => edicao?.finalizar(evento, true)}
        onLostPointerCapture={(evento) => edicao?.finalizar(evento)}
        onKeyDown={edicao?.aoTeclar}
      />
      {!path && !edicao && <span className="shape-editor-artboard-empty">Origem indisponível</span>}
    </div>
  );
}
