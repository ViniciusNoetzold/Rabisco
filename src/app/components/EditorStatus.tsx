import { forwardRef, useImperativeHandle, useState, type RefObject } from 'react';
import type { DocumentInfo, EditorApi } from '../../canvas/CanvasSurface';
import type { TamanhoPapel } from '../../canvas/PaperResizeHandles';
import type { Point } from '../../layers/types';
import { useEditor } from '../store';
import { Icon } from './Primitives';

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
      <button
        className="zoom-fit"
        title="Ajustar à janela (Ctrl+0)"
        aria-label="Ajustar desenho à janela"
        onClick={() => editor.current?.fit()}
      >
        <Icon name="application-resize-full" />
      </button>
      <span className="zoom-value">{Math.round(state.zoom * 100)}%</span>
      <div className="zoom-control">
        <button
          aria-label="Diminuir zoom"
          onClick={() => state.set({ zoom: Math.max(0.1, state.zoom - 0.1) })}
        >
          −
        </button>
        <input
          aria-label="Zoom"
          type="range"
          min="10"
          max="400"
          value={Math.round(state.zoom * 100)}
          onChange={(event) => state.set({ zoom: Number(event.target.value) / 100 })}
        />
        <button
          aria-label="Aumentar zoom"
          onClick={() => state.set({ zoom: Math.min(4, state.zoom + 0.1) })}
        >
          +
        </button>
      </div>
    </footer>
  );
});
