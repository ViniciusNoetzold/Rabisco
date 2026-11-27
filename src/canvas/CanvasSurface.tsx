import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { atualizarCursorPincel } from './cursorPincel';
import { caixaGirada, transformacaoCss, vistaNormal } from './vista';
import { clienteNoPapel } from './vistaAtual';
import type { PointerEvent as EventoPonteiro } from 'react';
import { useEditor } from '../app/store';
import type { Rect } from '../layers/types';
import { EditorController } from './editorController';
import type { CanvasCallbacks, EditorApi } from './editorTypes';
import { PaperResizeHandles, type TamanhoPapel } from './PaperResizeHandles';
import { TextOverlay } from './TextOverlay';
import { Reguas } from './Reguas';
import { GuiasSimetria } from './GuiasSimetria';
import { GuiasPapel } from './GuiasPapel';
import { Miniatura } from './Miniatura';
import { LupaOverlay } from './LupaOverlay';
import { useNavegacaoCanvas } from './useNavegacaoCanvas';
import { medicaoAtiva, medirOperacao, type FaseDoTraco } from './medicao';

export type { DocumentInfo, EditorApi } from './editorTypes';

const dimensoesIniciais = { width: 1024, height: 640 };

function traduzirEvento(evento: EventoPonteiro<HTMLCanvasElement>) {
  const tela = evento.currentTarget;
  // A vista pode estar girada ou espelhada: a conversão desfaz isso.
  const ponto = clienteNoPapel(
    { x: evento.clientX, y: evento.clientY },
    tela.getBoundingClientRect(),
    tela.width,
    tela.height,
  );
  return {
    ponto: {
      x: Math.max(0, Math.min(tela.width - 1, ponto.x)),
      y: Math.max(0, Math.min(tela.height - 1, ponto.y)),
      pressure: evento.pointerType === 'pen' ? evento.pressure : undefined,
    },
    botao: evento.button,
    shift: evento.shiftKey,
    ctrl: evento.ctrlKey || evento.metaKey,
    alt: evento.altKey,
    instante: evento.timeStamp,
    cliques: evento.detail,
  };
}

function medirPonteiro(
  evento: EventoPonteiro<HTMLCanvasElement>,
  fase: FaseDoTraco,
  executar: () => void,
) {
  const { tool, pincel } = useEditor.getState();
  const gesto =
    fase === 'inicio'
      ? !evento.altKey && (evento.button === 0 || evento.button === 2)
      : evento.currentTarget.hasPointerCapture(evento.pointerId);
  if (gesto && tool === 'brush') {
    medirOperacao(`${pincel === 'spray' ? 'spray' : 'pincel'}:${fase}`, executar);
  } else if (gesto && tool === 'fill' && fase === 'fim') {
    medirOperacao('balde', executar);
  } else executar();
}

export const CanvasSurface = forwardRef<EditorApi, CanvasCallbacks>(
  function CanvasSurface(callbacks, ref) {
    const tela = useRef<HTMLCanvasElement>(null);
    const previa = useRef<HTMLCanvasElement>(null);
    const workspace = useRef<HTMLDivElement>(null);
    const palco = useRef<HTMLDivElement>(null);
    const camadaColagem = useRef<HTMLDivElement>(null);
    const cursorPincel = useRef<SVGSVGElement>(null);
    const editor = useRef<EditorController>(null);
    const redimensionando = useRef(false);
    const eventos = useRef(callbacks);
    eventos.current = callbacks;
    const [dimensoes, definirDimensoes] = useState(dimensoesIniciais);
    const [selecao, definirSelecao] = useState<Rect | null>(null);
    const zoom = useEditor((estado) => estado.zoom);
    const tool = useEditor((estado) => estado.tool);
    const grid = useEditor((estado) => estado.grid);
    const modoPixelArt = useEditor((estado) => estado.modoPixelArt);
    const gradePixelArt = useEditor((estado) => estado.gradePixelArt);
    const ruler = useEditor((estado) => estado.ruler);
    const miniatura = useEditor((estado) => estado.miniatura);
    const rotacaoVista = useEditor((estado) => estado.rotacaoVista);
    const espelharVista = useEditor((estado) => estado.espelharVista);
    const vista = { rotacao: rotacaoVista, espelhar: espelharVista };
    const girada = !vistaNormal(vista);
    const estiloTexto = useEditor((estado) => estado.estiloTexto);
    const cor1 = useEditor((estado) => estado.color1);
    const cor2 = useEditor((estado) => estado.color2);
    const navegacao = useNavegacaoCanvas({
      viewport: workspace,
      palco,
      zoom,
      lupaAtiva: tool === 'zoom',
      cancelarDesenho: () => editor.current?.cancelarGesto(),
      desfazer: () => editor.current?.undo(),
      refazer: () => editor.current?.redo(),
      bloqueada: () => redimensionando.current,
    });

    useLayoutEffect(() => {
      const instancia = new EditorController(
        tela.current!,
        previa.current!,
        workspace.current!,
        camadaColagem.current!,
        {
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
        },
      );
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
        !editor.current?.iniciarGesto(
          evento.pointerId,
          traduzirEvento(evento),
          // Alt+clique é o conta-gotas, menos na varinha (lá, Alt subtrai da seleção).
          evento.altKey && useEditor.getState().tool !== 'wand',
        )
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
      atualizarCursorPincel(
        cursorPincel.current,
        evento.pointerType === 'touch' ? null : convertido.ponto,
      );
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
    // O palco gira em torno do centro; a moldura ocupa a caixa girada (para a rolagem certa).
    const moldura = caixaGirada(tamanho.width, tamanho.height, rotacaoVista);
    const estiloPalco = {
      ...tamanho,
      left: (moldura.width - tamanho.width) / 2,
      top: (moldura.height - tamanho.height) / 2,
      transform: transformacaoCss(vista),
    };
    const propsViewport = {
      viewport: workspace,
      tela,
      zoom,
      largura: dimensoes.width,
      altura: dimensoes.height,
    };
    return (
      <div className="canvas-viewport-frame">
        <div
          ref={workspace}
          className={`workspace ${ruler ? 'with-rulers' : ''}`}
          aria-label="Área de trabalho"
          {...navegacao.eventos}
        >
          <div className="canvas-giro" style={moldura}>
            <div
              ref={palco}
              className="canvas-stage"
              style={estiloPalco}
              data-vista-girada={girada ? '' : undefined}
            >
              <canvas
                ref={tela}
                className={`drawing-canvas tool-${tool} ${zoom >= 1 || modoPixelArt ? 'zoom-nitido' : ''}`}
                width={dimensoesIniciais.width}
                height={dimensoesIniciais.height}
                tabIndex={0}
                aria-label="Tela de desenho. Use o ponteiro para desenhar e os botões das ferramentas para escolher uma ação."
                style={tamanho}
                onContextMenu={(evento) => evento.preventDefault()}
                onPointerDown={
                  medicaoAtiva
                    ? (evento) => medirPonteiro(evento, 'inicio', () => pressionar(evento))
                    : pressionar
                }
                onPointerMove={
                  medicaoAtiva
                    ? (evento) => medirPonteiro(evento, 'movimento', () => mover(evento))
                    : mover
                }
                onPointerUp={
                  medicaoAtiva
                    ? (evento) => medirPonteiro(evento, 'fim', () => terminar(evento))
                    : terminar
                }
                onPointerCancel={(evento) => terminar(evento, true)}
                onLostPointerCapture={(evento) => terminar(evento, true)}
                onPointerLeave={() => {
                  editor.current?.sairDoPonteiro();
                  eventos.current.onCursor(null);
                  atualizarCursorPincel(cursorPincel.current, null);
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
              <div ref={camadaColagem} className="camada-colagem" aria-hidden="true" />
              <svg
                ref={cursorPincel}
                className="cursor-pincel"
                width={tamanho.width}
                height={tamanho.height}
                aria-hidden="true"
                style={{ display: 'none' }}
              />
              {(grid || zoom >= 4) && (
                <div
                  className={`canvas-grid ${zoom >= 4 ? 'grade-de-pixels' : ''}`}
                  style={{
                    backgroundSize: `${(zoom >= 4 ? 1 : 16) * zoom}px ${(zoom >= 4 ? 1 : 16) * zoom}px`,
                  }}
                />
              )}
              {modoPixelArt && gradePixelArt > 0 && (
                <div
                  className="canvas-grid grade-de-blocos"
                  aria-hidden="true"
                  style={{ backgroundSize: `${gradePixelArt * zoom}px ${gradePixelArt * zoom}px` }}
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
              <GuiasSimetria largura={dimensoes.width} altura={dimensoes.height} zoom={zoom} />
              <GuiasPapel largura={dimensoes.width} altura={dimensoes.height} zoom={zoom} />
              {!girada && (
                <PaperResizeHandles
                  tamanho={dimensoes}
                  zoom={zoom}
                  aoPrevisualizar={previsualizarPapel}
                  aoAplicar={aplicarPapel}
                  aoAvisar={(mensagem) => eventos.current.onMessage(mensagem)}
                />
              )}
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
              <LupaOverlay area={navegacao.previaLupa} zoom={zoom} />
            </div>
          </div>
          <div className="workspace-hint">
            <span className="workspace-default-hint">Um pequeno espaço para grandes ideias.</span>
            <span className="workspace-shape-hint">Enter confirma · Esc descarta</span>
            <span>
              {dimensoes.width} × {dimensoes.height} px
            </span>
          </div>
        </div>
        {ruler && !callbacks.telaInteira && !girada && <Reguas {...propsViewport} />}
        {miniatura && !callbacks.telaInteira && !girada && (
          <Miniatura
            {...propsViewport}
            revisao={callbacks.revisaoMiniatura}
            fechar={() => useEditor.getState().set({ miniatura: false })}
          />
        )}
      </div>
    );
  },
);
