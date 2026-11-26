import { forwardRef, useImperativeHandle, useState, type RefObject } from 'react';
import type { DocumentInfo, EditorApi } from '../../canvas/CanvasSurface';
import type { TamanhoPapel } from '../../canvas/PaperResizeHandles';
import type { Point } from '../../layers/types';
import { useEditor } from '../store';
import { Icon } from './Primitives';
import { formatarZoom, indiceDoZoom, nivelSeguinte, NIVEIS_ZOOM } from '../../canvas/zoom';

const numeroEmDisco = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function estimativaEmDisco(width: number, height: number) {
  const kib = (width * height * 4) / 1024;
  return kib >= 1024
    ? `${numeroEmDisco.format(kib / 1024)} MiB`
    : `${numeroEmDisco.format(kib)} KiB`;
}

export interface CursorStatusApi {
  setCursor(point: Point | null): void;
  setPaperPreview(tamanho: TamanhoPapel | null): void;
}

interface EditorStatusProps {
  info: DocumentInfo;
  editor: RefObject<EditorApi | null>;
}

export const EditorStatus = forwardRef<CursorStatusApi, EditorStatusProps>(function EditorStatus(
  { info, editor },
  ref,
) {
  const [cursor, setCursor] = useState<Point | null>(null);
  const [previaPapel, setPaperPreview] = useState<TamanhoPapel | null>(null);
  useImperativeHandle(ref, () => ({ setCursor, setPaperPreview }), []);
  const state = useEditor();
  const { width, height } = previaPapel ?? info;
  return (
    <footer className="status-bar app-status">
      <span className="cursor-position">
        <Icon name="pencil" />
        {cursor ? `${Math.floor(cursor.x)}, ${Math.floor(cursor.y)} px` : 'Pronto para criar'}
      </span>
      <span className="image-dimensions" data-preview={previaPapel ? '' : undefined}>
        <Icon name="picture" />
        {width} × {height} px
      </span>
      <span className="selection-status">
        {info.selection && `${info.selection.width} × ${info.selection.height} px selecionados`}
      </span>
      <span className="disk-status" title="Estimativa da cópia de recuperação neste navegador">
        Em disco ≈ {estimativaEmDisco(info.width, info.height)}
      </span>
      <button
        className="zoom-fit"
        title="Ajustar à janela (Ctrl+0)"
        aria-label="Ajustar desenho à janela"
        onClick={() => editor.current?.fit()}
      >
        <Icon name="application-resize-full" />
      </button>
      {(state.rotacaoVista !== 0 || state.espelharVista) && (
        <button
          type="button"
          className="vista-status"
          title="A vista está girada ou espelhada (a imagem não). Clique para voltar ao normal."
          onClick={() => state.set({ rotacaoVista: 0, espelharVista: false })}
        >
          {state.rotacaoVista !== 0 && `↻ ${state.rotacaoVista}°`}
          {state.rotacaoVista !== 0 && state.espelharVista && ' · '}
          {state.espelharVista && '⇋ espelhada'}
        </button>
      )}
      <span className="zoom-value">{formatarZoom(state.zoom)}</span>
      <div className="zoom-control">
        <button
          aria-label="Diminuir zoom"
          onClick={() => state.set({ zoom: nivelSeguinte(state.zoom, -1) })}
        >
          −
        </button>
        <input
          aria-label="Zoom"
          type="range"
          min="0"
          max={NIVEIS_ZOOM.length - 1}
          value={indiceDoZoom(state.zoom)}
          aria-valuetext={formatarZoom(state.zoom)}
          onChange={(event) => state.set({ zoom: NIVEIS_ZOOM[Number(event.target.value)] })}
        />
        <button
          aria-label="Aumentar zoom"
          onClick={() => state.set({ zoom: nivelSeguinte(state.zoom, 1) })}
        >
          +
        </button>
      </div>
    </footer>
  );
});
