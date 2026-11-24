import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { CanvasSurface, type EditorApi } from '../canvas/CanvasSurface';
import type { DadosFormaPropria, FormaPropria } from '../shapes/presets';
// O banco local (Dexie) carrega depois da primeira pintura da janela.
const armazenamentoDeFormas = () => import('../storage/formas');
import { useEditor } from './store';
import type { PixelBuffer, Point } from '../layers/types';
import { imagemDaTransferencia, lerImagemClipboard } from '../io/clipboard';
import { TIPOS_IMAGEM } from '../io/formatosImagem';
import { dimensoesValidas } from '../document/dimensoes';
import { toolRegistry } from '../tools/toolRegistry';
import { CarregandoDiscreto, Icon } from './components/Primitives';
import { initialInfo } from './components/editorUi';
import { EditorChrome, ToolHint } from './components/EditorChrome';
import { Ribbon } from './components/Ribbon';
import { StudioPanel } from './components/StudioPanel';
import { EditorStatus, type CursorStatusApi } from './components/EditorStatus';
import type { EditorDialogKind } from './components/EditorDialogs';
import type { ReferenciaEditorForma } from './components/CustomShapeEditor';
import { useTelaInteira } from './useTelaInteira';
import { nivelSeguinte } from '../canvas/zoom';

const CustomShapeEditor = lazy(() =>
  import('./components/CustomShapeEditor').then(({ CustomShapeEditor: defaultExport }) => ({
    default: defaultExport,
  })),
);
const ShapeLibrary = lazy(() =>
  import('./components/ShapeLibrary').then(({ ShapeLibrary: defaultExport }) => ({
    default: defaultExport,
  })),
);
const EditorDialogs = lazy(() =>
  import('./components/EditorDialogs').then(({ EditorDialogs: defaultExport }) => ({
    default: defaultExport,
  })),
);

function editandoTexto(alvo: EventTarget | null) {
  return (
    alvo instanceof HTMLElement && (alvo.matches('input,textarea,select') || alvo.isContentEditable)
  );
}

type PainelDeFormas =
  | { tipo: 'gerenciar' }
  | { tipo: 'criar'; referencia: ReferenciaEditorForma | null }
  | { tipo: 'editar'; forma: FormaPropria };

export default function App() {
  const telaDoApp = useRef<HTMLElement>(null);
  const {
    ativa: telaInteira,
    sair: sairDaTelaInteira,
    alternar: alternarTelaInteira,
  } = useTelaInteira(telaDoApp);
  const editor = useRef<EditorApi>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const arquivoColagem = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState(initialInfo);
  const papelAtual = useRef(info);
  papelAtual.current = info;
  const cursorStatus = useRef<CursorStatusApi>(null);
  const [tab, setTab] = useState('Início');
  const ferramenta = useEditor((estado) => estado.tool);
  const [dialog, setDialog] = useState<EditorDialogKind>(null);
  const [colagemMaior, definirColagemMaior] = useState<PixelBuffer | null>(null);
  const sequenciaColagem = useRef(0);
  const [formas, setFormas] = useState<FormaPropria[]>([]);
  const [painelFormas, setPainelFormas] = useState<PainelDeFormas | null>(null);
  const corDeFundo = useEditor((estado) => estado.color2);
  const corAtiva = useEditor((estado) =>
    estado.colorTarget === 1 ? estado.color1 : estado.color2,
  );
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
    const atuais = await (await armazenamentoDeFormas()).listarFormas();
    setFormas(atuais);
    useEditor.getState().sincronizarFormaPropria(atuais);
  }, []);
  useEffect(() => run(atualizarFormas), [atualizarFormas, run]);

  const prepararColagem = useCallback(async (arquivo: File, verificarCopia = false) => {
    const versao = ++sequenciaColagem.current;
    const { abrirImagem } = await import('../io/imagens');
    const { width, height, pixels } = await abrirImagem(arquivo);
    if (versao !== sequenciaColagem.current) return;
    const dados = { width, height, data: pixels };
    if (verificarCopia && (await editor.current?.colarCopiaIgual(dados))) return;
    if (versao !== sequenciaColagem.current) return;
    const papel = papelAtual.current;
    if (width > papel.width || height > papel.height) {
      definirColagemMaior(dados);
      setDialog('fit-paste');
    } else editor.current?.colarImagem(dados);
  }, []);

  const colar = useCallback(async () => {
    const versao = ++sequenciaColagem.current;
    const arquivo = await lerImagemClipboard();
    if (versao !== sequenciaColagem.current) return;
    if (arquivo) await prepararColagem(arquivo, true);
    else await editor.current?.paste();
  }, [prepararColagem]);

  function criarForma() {
    setPainelFormas({ tipo: 'criar', referencia: editor.current?.obterReferenciaForma() ?? null });
  }

  async function salvarFormaDoEditor(dados: DadosFormaPropria) {
    const id = painelFormas?.tipo === 'editar' ? painelFormas.forma.id : undefined;
    await (await armazenamentoDeFormas()).salvarForma(dados, id);
    await atualizarFormas();
    setPainelFormas(id ? { tipo: 'gerenciar' } : null);
    notify('Forma salva na sua biblioteca.');
  }

  useEffect(() => {
    document.title = `${info.name} — Rabisco`;
  }, [info.name]);
  useEffect(() => {
    // Abaixo de 1100 px o painel do ateliê fecha para dar espaço ao papel. Só reage quando a
    // janela cruza o limite, então quem reabrir o painel numa janela estreita é respeitado.
    const estreita = window.matchMedia('(max-width: 1099px)');
    const aplicar = () => useEditor.getState().set({ sidebar: !estreita.matches });
    if (estreita.matches) aplicar();
    estreita.addEventListener('change', aplicar);
    return () => estreita.removeEventListener('change', aplicar);
  }, []);
  useEffect(() => {
    setTab((atual) => (ferramenta === 'text' ? 'Texto' : atual === 'Texto' ? 'Início' : atual));
  }, [ferramenta]);
  useEffect(() => {
    function keys(event: KeyboardEvent) {
      const target = event.target;
      const state = useEditor.getState();
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (
        (editandoTexto(target) && !(mod && ['s', 'o', 'n', 'p'].includes(key))) ||
        (target instanceof Element && target.closest('[role="menu"]')) ||
        dialog ||
        painelFormas ||
        info.saving === 'loading'
      )
        return;
      if (mod && key === 'v') {
        // Deixa o navegador entregar os dados pelo evento de colagem antes de tentar o botão.
        const versao = sequenciaColagem.current;
        window.setTimeout(() => {
          if (versao === sequenciaColagem.current) run(colar);
        }, 100);
        return;
      }
      if (editor.current?.tecla(event)) {
        event.preventDefault();
        return;
      }
      if (event.key === 'F11' || (event.key === 'Escape' && telaInteira)) {
        event.preventDefault();
        if (event.key === 'F11') alternarTelaInteira();
        else sairDaTelaInteira();
        return;
      }
      if (mod) {
        const actions: Record<string, () => void> = {
          z: () => (event.shiftKey ? editor.current?.redo() : editor.current?.undo()),
          y: () => editor.current?.redo(),
          s: () => (event.shiftKey ? setDialog('save-as') : run(() => editor.current?.save())),
          p: () => setDialog('print'),
          o: () => fileInput.current?.click(),
          n: () => setDialog('new'),
          e: () => setDialog('properties'),
          w: () => setDialog('transform'),
          a: () => editor.current?.selectAll(),
          c: () => run(() => editor.current?.copy()),
          x: () => run(() => editor.current?.copy(true)),
          '0': () => editor.current?.fit(),
          r: () => state.set({ ruler: !state.ruler }),
          g: () => state.set({ grid: !state.grid }),
          pageup: () => state.set({ zoom: nivelSeguinte(state.zoom, 1) }),
          pagedown: () => state.set({ zoom: nivelSeguinte(state.zoom, -1) }),
          '+': () => state.set({ zoom: nivelSeguinte(state.zoom, 1) }),
          '=': () => state.set({ zoom: nivelSeguinte(state.zoom, 1) }),
          '-': () => state.set({ zoom: nivelSeguinte(state.zoom, -1) }),
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
      if (['[', ']', '-', '+', '='].includes(key)) {
        event.preventDefault();
        const passo = key === '[' || key === '-' ? -1 : 1;
        if (state.tool === 'eraser')
          state.set({ espessuraBorracha: state.espessuraBorracha + passo });
        else state.set({ size: state.size + passo });
      }
    }
    function receberColagem(evento: ClipboardEvent) {
      if (editandoTexto(evento.target) || dialog || painelFormas || info.saving === 'loading')
        return;
      sequenciaColagem.current++;
      const arquivo = imagemDaTransferencia(evento.clipboardData);
      evento.preventDefault();
      if (arquivo) run(() => prepararColagem(arquivo, true));
      else run(() => editor.current?.paste());
    }
    window.addEventListener('keydown', keys);
    window.addEventListener('paste', receberColagem);
    return () => {
      window.removeEventListener('keydown', keys);
      window.removeEventListener('paste', receberColagem);
    };
  }, [
    dialog,
    painelFormas,
    info.saving,
    run,
    telaInteira,
    alternarTelaInteira,
    sairDaTelaInteira,
    colar,
    prepararColagem,
  ]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const openFile = () => fileInput.current?.click();

  return (
    <main
      ref={telaDoApp}
      className="app-shell"
      data-tela-inteira={telaInteira ? '' : undefined}
      onDragOver={(evento) => {
        if (!evento.dataTransfer.types.includes('Files')) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = dialog || painelFormas ? 'none' : 'copy';
      }}
      onDrop={(evento) => {
        if (evento.dataTransfer.types.includes('Files')) evento.preventDefault();
        const arquivo = imagemDaTransferencia(evento.dataTransfer);
        if (arquivo && !dialog && !painelFormas && info.saving !== 'loading')
          run(() => prepararColagem(arquivo));
      }}
    >
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
        onEditarCores={() => setDialog('colors')}
        onColar={() => run(colar)}
        onColarDe={() => arquivoColagem.current?.click()}
        alternarTelaInteira={alternarTelaInteira}
        run={run}
      />

      <div className="workbench">
        <div className="document-area">
          <div className="document-toolbar">
            <span>
              <Icon name="picture" />
              <strong>{info.name}</strong>
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
            revisaoMiniatura={info}
            telaInteira={telaInteira}
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
        accept={TIPOS_IMAGEM}
        aria-label="Abrir arquivo de imagem"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) run(() => editor.current?.open(file));
          event.target.value = '';
        }}
      />
      <input
        ref={arquivoColagem}
        className="visually-hidden"
        type="file"
        accept={TIPOS_IMAGEM}
        aria-label="Colar de arquivo"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo) run(() => prepararColagem(arquivo));
          evento.target.value = '';
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
      <Suspense fallback={<CarregandoDiscreto />}>
        {dialog && (
          <EditorDialogs
            dialog={dialog}
            info={info}
            corDeFundo={corDeFundo}
            corAtiva={corAtiva}
            ajustarColagem={
              colagemMaior
                ? {
                    largura: colagemMaior.width,
                    altura: colagemMaior.height,
                    podeAumentar: dimensoesValidas(
                      Math.max(colagemMaior.width, info.width),
                      Math.max(colagemMaior.height, info.height),
                    ),
                  }
                : null
            }
            onClose={() => {
              setDialog(null);
              definirColagemMaior(null);
            }}
            onNew={(name, width, height) => editor.current?.newDocument(name, width, height)}
            onPropriedades={(largura, altura, fundo, dpi) =>
              editor.current?.redimensionarPapel(largura, altura, fundo, dpi)
            }
            onTransformar={(opcoes) => editor.current?.transformarImagem(opcoes)}
            onSalvarComo={async (opcoes) => {
              await editor.current?.salvarComo(opcoes);
            }}
            onImprimir={async (opcoes) => {
              await editor.current?.imprimir(opcoes);
            }}
            onAplicarCor={(cor) => useEditor.getState().setColor(cor)}
            onColagem={(aumentar) => {
              if (colagemMaior) run(() => editor.current?.colarImagem(colagemMaior, aumentar));
            }}
          />
        )}
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
      </Suspense>
    </main>
  );
}
