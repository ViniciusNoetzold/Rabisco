import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEditor } from '../app/store';
import { PixelHistory } from '../commands/history';
import { clearRectPixels, floodFill, normalizeRect } from '../tools/pixels';
import type { PixelBuffer, Point, Rect, ToolId } from '../layers/types';
import { loadDocument, saveDocument } from '../storage/documents';
import { exportPng, openPng } from '../io/png';

export interface DocumentInfo {
  name: string;
  width: number;
  height: number;
  canUndo: boolean;
  canRedo: boolean;
  history: { label: string }[];
  selection: Rect | null;
  saving: 'loading' | 'saving' | 'saved' | 'error';
}
export interface EditorApi {
  undo(): void;
  redo(): void;
  save(): Promise<void>;
  open(file: File): Promise<void>;
  newDocument(name: string, width: number, height: number): void;
  selectAll(): void;
  deleteSelection(): void;
  crop(): void;
  copy(cut?: boolean): Promise<void>;
  paste(): Promise<void>;
  fit(): void;
}
interface Props {
  onChange(info: DocumentInfo): void;
  onMessage(message: string): void;
  onCursor(point: Point | null): void;
}
interface Gesture {
  tool: ToolId;
  start: Point;
  last: Point;
  before: PixelBuffer;
  color: string;
  size: number;
  filled: boolean;
  moving?: Rect;
  image?: ImageData;
}

/** Gestos ficam fora do React; cada gesto completo produz um único comando no histórico. */
export const CanvasSurface = forwardRef<EditorApi, Props>(function CanvasSurface(
  { onChange, onMessage, onCursor },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const history = useRef(new PixelHistory());
  const gesture = useRef<Gesture | null>(null);
  const selectionRef = useRef<Rect | null>(null);
  const copied = useRef<ImageData | null>(null);
  const name = useRef('Sem título');
  const ready = useRef(false);
  const revision = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const saving = useRef<DocumentInfo['saving']>('loading');
  const [dimensions, setDimensions] = useState({ width: 1024, height: 640 });
  const [selection, setSelection] = useState<Rect | null>(null);
  const zoom = useEditor((s) => s.zoom);
  const tool = useEditor((s) => s.tool);
  const grid = useEditor((s) => s.grid);
  const ruler = useEditor((s) => s.ruler);
  const callbacks = useRef({ onChange, onMessage, onCursor });
  callbacks.current = { onChange, onMessage, onCursor };

  function context() {
    return canvas.current!.getContext('2d', { willReadFrequently: true })!;
  }
  function snapshot(): PixelBuffer {
    return context().getImageData(0, 0, canvas.current!.width, canvas.current!.height);
  }
  function notify() {
    if (!canvas.current) return;
    callbacks.current.onChange({
      name: name.current,
      width: canvas.current.width,
      height: canvas.current.height,
      canUndo: history.current.canUndo,
      canRedo: history.current.canRedo,
      history: history.current.entries,
      selection: selectionRef.current,
      saving: saving.current,
    });
  }
  function persist() {
    const image = snapshot();
    const currentRevision = ++revision.current;
    const title = name.current;
    saving.current = 'saving';
    notify();
    // As transações seguem a ordem dos comandos; uma gravação antiga nunca vence a nova.
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await saveDocument({
            id: 'current',
            name: title,
            width: image.width,
            height: image.height,
            pixels: new Uint8ClampedArray(image.data),
            updatedAt: Date.now(),
          });
          if (currentRevision === revision.current) {
            saving.current = 'saved';
            notify();
          }
        } catch (error) {
          if (currentRevision === revision.current) {
            saving.current = 'error';
            notify();
            callbacks.current.onMessage(
              error instanceof Error ? error.message : 'Salve uma cópia em PNG.',
            );
          }
        }
      });
  }
  function select(rect: Rect | null) {
    const valid = rect && rect.width > 0 && rect.height > 0 ? rect : null;
    selectionRef.current = valid;
    setSelection(valid);
    notify();
  }
  function put(buffer: PixelBuffer) {
    const surface = canvas.current!;
    surface.width = buffer.width;
    surface.height = buffer.height;
    preview.current!.width = buffer.width;
    preview.current!.height = buffer.height;
    context().putImageData(
      new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height),
      0,
      0,
    );
    setDimensions({ width: buffer.width, height: buffer.height });
  }
  function fit() {
    if (!workspace.current || !canvas.current) return;
    const bounds = workspace.current.getBoundingClientRect();
    useEditor
      .getState()
      .set({
        zoom: Math.max(
          0.1,
          Math.min(
            1,
            (bounds.width - 100) / canvas.current.width,
            (bounds.height - 90) / canvas.current.height,
          ),
        ),
      });
  }
  function commit(before: PixelBuffer, label: string) {
    if (history.current.push(before, snapshot(), label)) persist();
    notify();
  }
  function restore(direction: 'undo' | 'redo') {
    if (!ready.current || gesture.current) return;
    const image = history.current[direction](snapshot());
    if (image) {
      put(image);
      select(null);
      persist();
    }
  }
  function deleteSelection() {
    if (!ready.current || !selectionRef.current) return;
    const before = snapshot();
    const after = snapshot();
    clearRectPixels(after, selectionRef.current);
    put(after);
    select(null);
    commit(before, 'Apagar seleção');
  }

  useImperativeHandle(ref, () => ({
    undo: () => restore('undo'),
    redo: () => restore('redo'),
    fit,
    save: async () => {
      if (ready.current) {
        await exportPng(canvas.current!, name.current);
        callbacks.current.onMessage('PNG exportado. Seu rabisco está pronto para levar.');
      }
    },
    open: async (file) => {
      const image = await openPng(file);
      const before = snapshot();
      name.current = image.name;
      put({ width: image.width, height: image.height, data: image.pixels });
      select(null);
      history.current.push(before, snapshot(), 'Abrir PNG');
      persist();
      fit();
    },
    newDocument: (title, width, height) => {
      if (!ready.current) return;
      const data = new Uint8ClampedArray(width * height * 4);
      data.fill(255);
      name.current = title.trim() || 'Sem título';
      put({ width, height, data });
      history.current.clear();
      select(null);
      persist();
      fit();
    },
    selectAll: () => {
      useEditor.getState().setTool('select');
      select({ x: 0, y: 0, width: canvas.current!.width, height: canvas.current!.height });
    },
    deleteSelection,
    crop: () => {
      const rect = selectionRef.current;
      if (!rect) return;
      const before = snapshot();
      const image = context().getImageData(rect.x, rect.y, rect.width, rect.height);
      put(image);
      select(null);
      commit(before, 'Cortar para seleção');
      fit();
    },
    copy: async (cut = false) => {
      const rect = selectionRef.current;
      if (!rect) {
        callbacks.current.onMessage('Selecione uma parte do desenho primeiro.');
        return;
      }
      copied.current = context().getImageData(rect.x, rect.y, rect.width, rect.height);
      if (cut) deleteSelection();
      callbacks.current.onMessage(
        cut
          ? 'Seleção recortada. Use Colar para reposicionar.'
          : 'Seleção copiada. Use Colar neste desenho.',
      );
    },
    paste: async () => {
      if (!copied.current) {
        callbacks.current.onMessage('Copie uma seleção primeiro, ou abra um arquivo PNG.');
        return;
      }
      const before = snapshot();
      const x = Math.min(24, canvas.current!.width - 1),
        y = Math.min(24, canvas.current!.height - 1);
      context().putImageData(copied.current, x, y);
      select({
        x,
        y,
        width: Math.min(copied.current.width, canvas.current!.width - x),
        height: Math.min(copied.current.height, canvas.current!.height - y),
      });
      useEditor.getState().setTool('select');
      commit(before, 'Colar seleção');
    },
  }));

  useEffect(() => {
    let cancelled = false;
    const data = new Uint8ClampedArray(1024 * 640 * 4);
    data.fill(255);
    put({ width: 1024, height: 640, data });
    fit();
    void loadDocument()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          name.current = saved.name;
          put({ width: saved.width, height: saved.height, data: saved.pixels });
          fit();
          callbacks.current.onMessage('Seu último rabisco foi recuperado. Continue de onde parou.');
        }
        saving.current = 'saved';
        ready.current = true;
        notify();
      })
      .catch(() => {
        if (cancelled) return;
        ready.current = true;
        saving.current = 'error';
        notify();
        callbacks.current.onMessage('O autosave não está disponível. Salve seu trabalho em PNG.');
      });
    const observer = new ResizeObserver(() => {
      if (ready.current && !gesture.current) fit();
    });
    observer.observe(workspace.current!);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  function point(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const bounds = canvas.current!.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          canvas.current!.width - 1,
          (event.clientX - bounds.left) / useEditor.getState().zoom,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          canvas.current!.height - 1,
          (event.clientY - bounds.top) / useEditor.getState().zoom,
        ),
      ),
      pressure: event.pressure,
    };
  }
  function brush(ctx: CanvasRenderingContext2D, from: Point, to: Point, active: Gesture) {
    ctx.save();
    ctx.lineWidth = active.tool === 'pencil' ? 1 : active.size;
    ctx.strokeStyle = active.tool === 'eraser' ? '#ffffff' : active.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + 0.01, to.y + 0.01);
    ctx.stroke();
    ctx.restore();
  }
  function shape(ctx: CanvasRenderingContext2D, active: Gesture, end: Point, constrain: boolean) {
    let dx = end.x - active.start.x,
      dy = end.y - active.start.y;
    if (constrain) {
      if (active.tool === 'line') {
        const length = Math.hypot(dx, dy);
        const angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
        dx = Math.cos(angle) * length;
        dy = Math.sin(angle) * length;
      } else {
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx || 1) * side;
        dy = Math.sign(dy || 1) * side;
      }
    }
    ctx.save();
    ctx.lineWidth = active.size;
    ctx.strokeStyle = active.color;
    ctx.fillStyle = active.color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (active.tool === 'line') {
      ctx.moveTo(active.start.x, active.start.y);
      ctx.lineTo(active.start.x + dx, active.start.y + dy);
    }
    if (active.tool === 'rectangle') ctx.rect(active.start.x, active.start.y, dx, dy);
    if (active.tool === 'ellipse')
      ctx.ellipse(
        active.start.x + dx / 2,
        active.start.y + dy / 2,
        Math.max(0.5, Math.abs(dx / 2)),
        Math.max(0.5, Math.abs(dy / 2)),
        0,
        0,
        Math.PI * 2,
      );
    if (active.filled && active.tool !== 'line') ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!ready.current || gesture.current || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    canvas.current!.focus();
    canvas.current!.setPointerCapture(event.pointerId);
    const state = useEditor.getState();
    const at = point(event);
    if (state.tool === 'eyedropper' || event.altKey) {
      const pixel = context().getImageData(Math.floor(at.x), Math.floor(at.y), 1, 1).data;
      state.setColor(
        `#${Array.from(pixel.slice(0, 3))
          .map((v) => v.toString(16).padStart(2, '0'))
          .join('')}`,
      );
      return;
    }
    const before = snapshot();
    const active: Gesture = {
      tool: state.tool,
      start: at,
      last: at,
      before,
      color: event.button === 2 ? state.color2 : state.color1,
      size: state.size,
      filled: state.filled,
    };
    if (state.tool === 'fill') {
      const image = snapshot();
      if (floodFill(image, at.x, at.y, active.color, 12)) {
        put(image);
        commit(before, 'Preenchimento');
      }
      return;
    }
    if (state.tool === 'select') {
      const rect = selectionRef.current;
      if (
        rect &&
        at.x >= rect.x &&
        at.x < rect.x + rect.width &&
        at.y >= rect.y &&
        at.y < rect.y + rect.height
      ) {
        active.moving = rect;
        active.image = context().getImageData(rect.x, rect.y, rect.width, rect.height);
      } else select(null);
    } else {
      select(null);
      if (['pencil', 'brush', 'eraser'].includes(active.tool)) brush(context(), at, at, active);
    }
    gesture.current = active;
  }
  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const at = point(event);
    callbacks.current.onCursor(at);
    const active = gesture.current;
    if (!active) return;
    if (['pencil', 'brush', 'eraser'].includes(active.tool)) {
      brush(context(), active.last, at, active);
      active.last = at;
    } else if (active.tool === 'select') {
      if (active.moving && active.image) {
        const rect = {
          ...active.moving,
          x: Math.round(
            Math.max(
              0,
              Math.min(
                canvas.current!.width - active.moving.width,
                active.moving.x + at.x - active.start.x,
              ),
            ),
          ),
          y: Math.round(
            Math.max(
              0,
              Math.min(
                canvas.current!.height - active.moving.height,
                active.moving.y + at.y - active.start.y,
              ),
            ),
          ),
        };
        // ImageData expõe dimensões por getters, que não são copiados pelo spread.
        const cleared: PixelBuffer = {
          width: active.before.width,
          height: active.before.height,
          data: new Uint8ClampedArray(active.before.data),
        };
        clearRectPixels(cleared, active.moving);
        context().putImageData(
          new ImageData(new Uint8ClampedArray(cleared.data), cleared.width, cleared.height),
          0,
          0,
        );
        context().putImageData(active.image, rect.x, rect.y);
        select(rect);
      } else
        select(
          normalizeRect(active.start, at, {
            width: canvas.current!.width,
            height: canvas.current!.height,
          }),
        );
    } else {
      const ctx = preview.current!.getContext('2d')!;
      ctx.clearRect(0, 0, preview.current!.width, preview.current!.height);
      shape(ctx, active, at, event.shiftKey);
    }
  }
  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>, cancelled = false) {
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;
    const ctx = preview.current!.getContext('2d')!;
    ctx.clearRect(0, 0, preview.current!.width, preview.current!.height);
    if (cancelled) {
      put(active.before);
      select(null);
      return;
    }
    if (['line', 'rectangle', 'ellipse'].includes(active.tool))
      shape(context(), active, point(event), event.shiftKey);
    const labels: Record<ToolId, string> = {
      pencil: 'Traço de lápis',
      brush: 'Pincelada',
      eraser: 'Borracha',
      fill: 'Preenchimento',
      line: 'Linha',
      rectangle: 'Retângulo',
      ellipse: 'Elipse',
      select: 'Mover seleção',
      eyedropper: 'Conta-gotas',
    };
    if (active.tool !== 'select' || active.moving) commit(active.before, labels[active.tool]);
    if (canvas.current!.hasPointerCapture(event.pointerId))
      canvas.current!.releasePointerCapture(event.pointerId);
  }

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
      <div
        className="canvas-stage"
        style={{ width: dimensions.width * zoom, height: dimensions.height * zoom }}
      >
        <canvas
          ref={canvas}
          className={`drawing-canvas tool-${tool}`}
          width={1024}
          height={640}
          tabIndex={0}
          aria-label="Tela de desenho. Use o ponteiro para desenhar e os botões das ferramentas para escolher uma ação."
          style={{ width: dimensions.width * zoom, height: dimensions.height * zoom }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={(event) => pointerUp(event)}
          onPointerCancel={(event) => pointerUp(event, true)}
          onLostPointerCapture={(event) => pointerUp(event, true)}
          onPointerLeave={() => callbacks.current.onCursor(null)}
        />
        <canvas
          ref={preview}
          width={1024}
          height={640}
          className="preview-canvas"
          style={{ width: dimensions.width * zoom, height: dimensions.height * zoom }}
          aria-hidden="true"
        />
        {grid && (
          <div
            className="canvas-grid"
            style={{ backgroundSize: `${16 * zoom}px ${16 * zoom}px` }}
          />
        )}
        {selection && selection.width > 0 && selection.height > 0 && (
          <div
            className="selection-marquee"
            style={{
              left: selection.x * zoom,
              top: selection.y * zoom,
              width: selection.width * zoom,
              height: selection.height * zoom,
            }}
          />
        )}
        <i className="canvas-grip" aria-hidden="true" />
      </div>
      <div className="workspace-hint">
        <span>Um pequeno espaço para grandes ideias.</span>
        <span>
          PNG · {dimensions.width} × {dimensions.height} px
        </span>
      </div>
    </div>
  );
});
