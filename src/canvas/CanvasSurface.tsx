import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as EventoPonteiro } from 'react';
import { useEditor } from '../app/store';
import type { Rect } from '../layers/types';
import { EditorController } from './editorController';
import type { CanvasCallbacks, EditorApi } from './editorTypes';
import { PaperResizeHandles, type TamanhoPapel } from './PaperResizeHandles';
import { TextOverlay } from './TextOverlay';

export type { DocumentInfo, EditorApi } from './editorTypes';

const dimensoesIniciais = { width: 1024, height: 640 };

function traduzirEvento(evento: EventoPonteiro<HTMLCanvasElement>) {
  const tela = evento.currentTarget;
  const caixa = tela.getBoundingClientRect();
  const zoom = useEditor.getState().zoom;
  return {
    ponto: {
      x: Math.max(0, Math.min(tela.width - 1, (evento.clientX - caixa.left) / zoom)),
      y: Math.max(0, Math.min(tela.height - 1, (evento.clientY - caixa.top) / zoom)),
      pressure: evento.pointerType === 'pen' ? evento.pressure : undefined,
    },
    botao: evento.button,
    shift: evento.shiftKey,
    ctrl: evento.ctrlKey || evento.metaKey,
    instante: evento.timeStamp,
    cliques: evento.detail,
  };
}

export const CanvasSurface = forwardRef<EditorApi, CanvasCallbacks>(
  function CanvasSurface(callbacks, ref) {
    const tela = useRef<HTMLCanvasElement>(null);
    const previa = useRef<HTMLCanvasElement>(null);
    const workspace = useRef<HTMLDivElement>(null);
    const editor = useRef<EditorController>(null);
    const redimensionando = useRef(false);
    const eventos = useRef(callbacks);
    eventos.current = callbacks;
    const [dimensoes, definirDimensoes] = useState(dimensoesIniciais);
    const [selecao, definirSelecao] = useState<Rect | null>(null);
    const zoom = useEditor((estado) => estado.zoom);
    const tool = useEditor((estado) => estado.tool);
    const grid = useEditor((estado) => estado.grid);
    const ruler = useEditor((estado) => estado.ruler);
    const estiloTexto = useEditor((estado) => estado.estiloTexto);
    const cor1 = useEditor((estado) => estado.color1);
    const cor2 = useEditor((estado) => estado.color2);

    useLayoutEffect(() => {
      const instancia = new EditorController(tela.current!, previa.current!, workspace.current!, {
        mudar: (info) => {
          definirDimensoes((atual) =>
            atual.width === info.width && atual.height === info.height
              ? atual
              : { width: info.width, height: info.height },
          );
          definirSelecao(info.selection);
          eventos.current.onChange(info);
        },
        avisar: (mensagem) => eventos.current.onMessage(mensagem),
      });
      editor.current = instancia;
      void instancia.iniciar();
      const observador = new ResizeObserver(() => {
        if (!redimensionando.current) instancia.ajustarAoRedimensionar();
      });
      observador.observe(workspace.current!);
      const perderFoco = () => instancia.cancelarGesto();
      const mudarVisibilidade = () => {
        if (document.hidden) perderFoco();
      };
      window.addEventListener('blur', perderFoco);
      document.addEventListener('visibilitychange', mudarVisibilidade);
      return () => {
        window.removeEventListener('blur', perderFoco);
        document.removeEventListener('visibilitychange', mudarVisibilidade);
        instancia.encerrar();
        observador.disconnect();
        editor.current = null;
      };
    }, []);

    useImperativeHandle(ref, () => editor.current!, []);
    useLayoutEffect(() => {
      tela.current!.style.cursor = editor.current!.cursor(tool);
    }, [tool]);

    function pressionar(evento: EventoPonteiro<HTMLCanvasElement>) {
      if (
        redimensionando.current ||
        !editor.current?.iniciarGesto(evento.pointerId, traduzirEvento(evento), evento.altKey)
      )
        return;
      evento.preventDefault();
      evento.currentTarget.focus();
      evento.currentTarget.setPointerCapture(evento.pointerId);
    }

    function previsualizarPapel(proposta: TamanhoPapel | null) {
      redimensionando.current = proposta !== null;
      eventos.current.onPreviewSize?.(proposta);
    }

    function aplicarPapel(proposta: TamanhoPapel) {
      try {
        editor.current?.redimensionarPapel(proposta.width, proposta.height);
      } catch (erro) {
        eventos.current.onMessage(
          erro instanceof Error ? erro.message : 'Não foi possível redimensionar o papel.',
        );
      }
    }

    function mover(evento: EventoPonteiro<HTMLCanvasElement>) {
      const convertido = traduzirEvento(evento);
      eventos.current.onCursor(convertido.ponto);
      editor.current?.moverGesto(evento.pointerId, convertido);
    }

    function terminar(evento: EventoPonteiro<HTMLCanvasElement>, cancelar = false) {
      editor.current?.terminarGesto(
        evento.pointerId,
        cancelar ? undefined : traduzirEvento(evento),
      );
      if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
        evento.currentTarget.releasePointerCapture(evento.pointerId);
      }
    }

    const tamanho = { width: dimensoes.width * zoom, height: dimensoes.height * zoom };
    return (
      <div
        ref={workspace}
        className={`workspace ${ruler ? 'with-rulers' : ''}`}
        aria-label="Área de trabalho"
      >
        {ruler && (
          <>
            <div className="ruler ruler-top">
              0　　　　　100　　　　　200　　　　　300　　　　　400　　　　　500　　　　　600　　　　　700　　　　　800
            </div>
            <div className="ruler ruler-side">
              0　　　　　100　　　　　200　　　　　300　　　　　400　　　　　500
            </div>
          </>
        )}
        <div className="canvas-stage" style={tamanho}>
          <canvas
            ref={tela}
            className={`drawing-canvas tool-${tool}`}
            width={dimensoesIniciais.width}
            height={dimensoesIniciais.height}
            tabIndex={0}
            aria-label="Tela de desenho. Use o ponteiro para desenhar e os botões das ferramentas para escolher uma ação."
            style={tamanho}
            onContextMenu={(evento) => evento.preventDefault()}
            onPointerDown={pressionar}
            onPointerMove={mover}
            onPointerUp={(evento) => terminar(evento)}
            onPointerCancel={(evento) => terminar(evento, true)}
            onLostPointerCapture={(evento) => terminar(evento, true)}
            onPointerLeave={() => {
              editor.current?.sairDoPonteiro();
              eventos.current.onCursor(null);
            }}
          />
          <canvas
            ref={previa}
            width={dimensoesIniciais.width}
            height={dimensoesIniciais.height}
            className="preview-canvas"
            style={tamanho}
            aria-hidden="true"
          />
          {grid && (
            <div
              className="canvas-grid"
              style={{ backgroundSize: `${16 * zoom}px ${16 * zoom}px` }}
            />
          )}
          {selecao && (
            <div
              className="selection-marquee"
              style={{
                left: selecao.x * zoom,
                top: selecao.y * zoom,
                width: selecao.width * zoom,
                height: selecao.height * zoom,
              }}
            />
          )}
          <PaperResizeHandles
            tamanho={dimensoes}
            zoom={zoom}
            aoPrevisualizar={previsualizarPapel}
            aoAplicar={aplicarPapel}
            aoAvisar={(mensagem) => eventos.current.onMessage(mensagem)}
          />
          <TextOverlay
            ativo={tool === 'text'}
            zoom={zoom}
            largura={dimensoes.width}
            altura={dimensoes.height}
            estilo={estiloTexto}
            cor1={cor1}
            cor2={cor2}
            confirmar={(configuracao) => editor.current?.aplicarTexto(configuracao)}
          />
        </div>
        <div className="workspace-hint">
          <span className="workspace-default-hint">Um pequeno espaço para grandes ideias.</span>
          <span className="workspace-shape-hint">Enter confirma · Esc descarta</span>
          <span>
            PNG · {dimensoes.width} × {dimensoes.height} px
          </span>
        </div>
      </div>
    );
  },
);
