import { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasSurface, type EditorApi } from '../canvas/CanvasSurface';
import type { DadosFormaPropria, FormaPropria } from '../shapes/presets';
import { listarFormas, salvarForma } from '../storage/formas';
import { useEditor } from './store';
import type { Point } from '../layers/types';
import { toolRegistry } from '../tools/toolRegistry';
import { Icon } from './components/Primitives';
import { initialInfo } from './components/editorUi';
import { EditorChrome, ToolHint } from './components/EditorChrome';
import { Ribbon } from './components/Ribbon';
import { StudioPanel } from './components/StudioPanel';
import { EditorStatus, type CursorStatusApi } from './components/EditorStatus';
import { EditorDialogs, type EditorDialogKind } from './components/EditorDialogs';
import { CustomShapeEditor, type ReferenciaEditorForma } from './components/CustomShapeEditor';
import { ShapeLibrary } from './components/ShapeLibrary';

type PainelDeFormas =
  | { tipo: 'gerenciar' }
  | { tipo: 'criar'; referencia: ReferenciaEditorForma | null }
  | { tipo: 'editar'; forma: FormaPropria };

export default function App() {
  const editor = useRef<EditorApi>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState(initialInfo);
  const cursorStatus = useRef<CursorStatusApi>(null);
  const [tab, setTab] = useState('Início');
  const ferramenta = useEditor((estado) => estado.tool);
  const [dialog, setDialog] = useState<EditorDialogKind>(null);
  const [formas, setFormas] = useState<FormaPropria[]>([]);
  const [painelFormas, setPainelFormas] = useState<PainelDeFormas | null>(null);
  const corDeFundo = useEditor((estado) => estado.color2);
  const [message, setMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O movimento do cursor atualiza apenas a barra de status, sem renderizar o ribbon.
  const updateCursor = useCallback(
    (point: Point | null) => cursorStatus.current?.setCursor(point),
    [],
  );
  const mostrarPreviaDoPapel = useCallback(
    (tamanho: { width: number; height: number } | null) =>
      cursorStatus.current?.setPaperPreview(tamanho),
    [],
  );
  const notify = useCallback((text: string) => {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(''), 5500);
  }, []);
  const run = useCallback(
    (action: () => void | Promise<void> | undefined) => {
      try {
        const result = action();
        if (result)
          void result.catch((error: unknown) =>
            notify(error instanceof Error ? error.message : 'Não foi possível concluir esta ação.'),
          );
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Não foi possível concluir esta ação.');
      }
    },
    [notify],
  );

  const atualizarFormas = useCallback(async () => {
    const atuais = await listarFormas();
    setFormas(atuais);
    useEditor.getState().sincronizarFormaPropria(atuais);
  }, []);
  useEffect(() => run(atualizarFormas), [atualizarFormas, run]);

  function criarForma() {
    setPainelFormas({ tipo: 'criar', referencia: editor.current?.obterReferenciaForma() ?? null });
  }

  async function salvarFormaDoEditor(dados: DadosFormaPropria) {
    const id = painelFormas?.tipo === 'editar' ? painelFormas.forma.id : undefined;
    await salvarForma(dados, id);
    await atualizarFormas();
    setPainelFormas(id ? { tipo: 'gerenciar' } : null);
    notify('Forma salva na sua biblioteca.');
  }

  useEffect(() => {
    document.title = `${info.name} — Rabisco`;
  }, [info.name]);
  useEffect(() => {
    setTab((atual) => (ferramenta === 'text' ? 'Texto' : atual === 'Texto' ? 'Início' : atual));
  }, [ferramenta]);
  useEffect(() => {
    function keys(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const state = useEditor.getState();
      if (
        target.matches('input,textarea,select,[contenteditable="true"]') ||
        target.closest('[role="menu"]') ||
        dialog ||
        painelFormas ||
        info.saving === 'loading'
      )
        return;
      if (editor.current?.tecla(event)) {
        event.preventDefault();
        return;
      }
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (mod) {
        const actions: Record<string, () => void> = {
          z: () => (event.shiftKey ? editor.current?.redo() : editor.current?.undo()),
          y: () => editor.current?.redo(),
          s: () => run(() => editor.current?.save()),
          o: () => fileInput.current?.click(),
          n: () => setDialog('new'),
          e: () => setDialog('properties'),
          w: () => setDialog('transform'),
          a: () => editor.current?.selectAll(),
          c: () => run(() => editor.current?.copy()),
          x: () => run(() => editor.current?.copy(true)),
          v: () => run(() => editor.current?.paste()),
          '0': () => editor.current?.fit(),
          '+': () => state.set({ zoom: Math.min(4, state.zoom + 0.1) }),
          '=': () => state.set({ zoom: Math.min(4, state.zoom + 0.1) }),
          '-': () => state.set({ zoom: Math.max(0.1, state.zoom - 0.1) }),
        };
        if (actions[key]) {
          event.preventDefault();
          actions[key]();
        }
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault();
        editor.current?.deleteSelection();
      }
      if (key === 'a' && !event.altKey) {
        event.preventDefault();
        state.setPincel('spray');
        return;
      }
      const ferramenta = Object.values(toolRegistry).find(
        ({ atalho }) => atalho?.toLowerCase() === key,
      );
      if (ferramenta) {
        event.preventDefault();
        state.setTool(ferramenta.id);
      }
      if (key === 'x') state.swapColors();
      if (key === '[' || key === ']') {
        event.preventDefault();
        state.set({ size: state.size + (key === '[' ? -1 : 1) });
      }
    }
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [dialog, painelFormas, info.saving, run]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const openFile = () => fileInput.current?.click();

  return (
    <main className="app-shell">
      <EditorChrome
        info={info}
        editor={editor}
        tab={tab}
        onTab={setTab}
        onDialog={setDialog}
        onOpen={openFile}
        run={run}
      />
      <Ribbon
        tab={tab}
        editor={editor}
        info={info}
        galeriaFormas={{
          formasProprias: formas,
          criarForma,
          gerenciarFormas: () => setPainelFormas({ tipo: 'gerenciar' }),
        }}
        onOpen={openFile}
        onPropriedades={() => setDialog('properties')}
        onTransformar={() => setDialog('transform')}
        run={run}
      />

      <div className="workbench">
        <div className="document-area">
          <div className="document-toolbar">
            <span>
              <Icon name="picture" />
              <strong>{info.name}</strong>
              <span className="paper-badge">PNG</span>
            </span>
            <span className={`autosave ${info.saving === 'error' ? 'save-error' : ''}`}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m3 8 3 3 7-7" />
              </svg>
              {
                {
                  loading: 'Recuperando…',
                  saving: 'Salvando…',
                  saved: 'Salvo neste dispositivo',
                  error: 'Salve uma cópia em PNG',
                }[info.saving]
              }
            </span>
          </div>
          <CanvasSurface
            ref={editor}
            onChange={setInfo}
            onMessage={notify}
            onCursor={updateCursor}
            onPreviewSize={mostrarPreviaDoPapel}
          />
          <ToolHint />
        </div>
        <StudioPanel info={info} editor={editor} onHelp={() => setDialog('help')} />
      </div>
      <EditorStatus ref={cursorStatus} info={info} editor={editor} />
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept="image/png,.png"
        aria-label="Abrir arquivo PNG"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) run(() => editor.current?.open(file));
          event.target.value = '';
        }}
      />
      {message && (
        <div role="status" className="toast">
          <Icon name="information" />
          <span>{message}</span>
          <button aria-label="Dispensar mensagem" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
      <EditorDialogs
        dialog={dialog}
        info={info}
        corDeFundo={corDeFundo}
        onClose={() => setDialog(null)}
        onNew={(name, width, height) => editor.current?.newDocument(name, width, height)}
        onPropriedades={(largura, altura, fundo, dpi) =>
          editor.current?.redimensionarPapel(largura, altura, fundo, dpi)
        }
        onTransformar={(opcoes) => editor.current?.transformarImagem(opcoes)}
      />
      {painelFormas?.tipo === 'gerenciar' && (
        <ShapeLibrary
          formas={formas}
          editar={(forma) => setPainelFormas({ tipo: 'editar', forma })}
          atualizar={atualizarFormas}
          fechar={() => setPainelFormas(null)}
        />
      )}
      {(painelFormas?.tipo === 'criar' || painelFormas?.tipo === 'editar') && (
        <CustomShapeEditor
          editar={painelFormas.tipo === 'editar' ? painelFormas.forma : null}
          referencia={painelFormas.tipo === 'criar' ? painelFormas.referencia : null}
          aoSalvar={salvarFormaDoEditor}
          fechar={() =>
            setPainelFormas(painelFormas.tipo === 'editar' ? { tipo: 'gerenciar' } : null)
          }
        />
      )}
    </main>
  );
}
