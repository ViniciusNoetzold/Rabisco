import type { RefObject } from 'react';
import type { DocumentInfo, EditorApi } from '../../canvas/CanvasSurface';
import { useEditor } from '../store';
import { FileMenu } from './FileMenu';
import { Icon, Logo, type RunAction } from './Primitives';
import { hints, nomeDaFerramenta } from './editorUi';
import type { EditorDialogKind } from './EditorDialogs';

interface EditorChromeProps {
  info: DocumentInfo;
  editor: RefObject<EditorApi | null>;
  tab: string;
  onTab(tab: string): void;
  onDialog(dialog: EditorDialogKind): void;
  onOpen(): void;
  run: RunAction;
}

export function EditorChrome({
  info,
  editor,
  tab,
  onTab,
  onDialog,
  onOpen,
  run,
}: EditorChromeProps) {
  const textoAtivo = useEditor((estado) => estado.tool === 'text');
  const abas = textoAtivo ? ['Início', 'Exibir', 'Texto'] : ['Início', 'Exibir'];
  const quick = (icon: string, label: string, action: () => void, disabled = false) => (
    <button
      className="quick-button"
      title={label}
      aria-label={label}
      onClick={action}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );

  return (
    <>
      <header className="title-bar app-title-bar">
        <Logo />
        <div className="quick-access" aria-label="Acesso rápido">
          {quick(
            'disk',
            'Exportar PNG',
            () => run(() => editor.current?.save()),
            info.saving === 'loading',
          )}
          <span className="quick-divider" />
          {quick(
            'arrow-curve-180-left',
            'Desfazer (Ctrl+Z)',
            () => editor.current?.undo(),
            !info.canUndo,
          )}
          {quick('arrow-curve', 'Refazer (Ctrl+Y)', () => editor.current?.redo(), !info.canRedo)}
        </div>
        <span className="document-title">
          {info.name}
          <span> — Rabisco</span>
        </span>
        <span className="edition-badge">Seu pequeno ateliê digital</span>
        <button
          className="about-top"
          aria-label="Sobre o Rabisco"
          title="Sobre o Rabisco"
          onClick={() => onDialog('about')}
        >
          <Icon name="information" />
        </button>
      </header>
      <nav className="tab-bar" aria-label="Faixa de opções">
        <FileMenu
          onNew={() => onDialog('new')}
          onOpen={onOpen}
          onSave={() => run(() => editor.current?.salvarRabisco())}
          onExportPng={() => run(() => editor.current?.save())}
          onOpenRecent={(arquivo) => run(() => editor.current?.open(arquivo))}
          onSaveAs={() => onDialog('save-as')}
          onPrint={() => onDialog('print')}
          onAbout={() => onDialog('about')}
        />
        <div className="tabs" role="tablist" aria-label="Abas de ferramentas">
          {abas.map((label, indice) => (
            <button
              key={label}
              role="tab"
              id={`tab-${label}`}
              aria-controls="ribbon-panel"
              aria-selected={tab === label}
              tabIndex={tab === label ? 0 : -1}
              data-opcoes-texto={label === 'Texto' ? '' : undefined}
              onKeyDown={(event) => {
                if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                  event.preventDefault();
                  const passo = event.key === 'ArrowRight' ? 1 : -1;
                  const next = abas[(indice + passo + abas.length) % abas.length];
                  onTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
              onClick={() => onTab(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="learn-link" onClick={() => onDialog('help')}>
          <span className="little-spark">✧</span> Uma ajudinha?
        </button>
        <span className="version-label">Versão 0.5.0</span>
      </nav>
    </>
  );
}

export function ToolHint() {
  const tool = useEditor((state) => state.tool);
  return (
    <div className="tool-hint">
      <span className="hint-key">{nomeDaFerramenta(tool)}</span>
      <span>{hints[tool]}</span>
      <span className="hint-right">Botão direito usa a Cor 2</span>
    </div>
  );
}
