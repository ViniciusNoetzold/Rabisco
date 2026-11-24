import type { RefObject } from 'react';
import type { DocumentInfo, EditorApi } from '../../canvas/CanvasSurface';
import type { ToolId } from '../../layers/types';
import { toolRegistry } from '../../tools/toolRegistry';
import { PALETTE, useEditor } from '../store';
import { BrushGallery } from './BrushGallery';
import { OrientationMenu } from './OrientationMenu';
import { Icon, RibbonGroup, type RunAction } from './Primitives';
import { ShapeGallery } from './ShapeGallery';
import { SprayControls, StrokeThickness } from './StrokeThickness';

interface RibbonProps {
  tab: string;
  editor: RefObject<EditorApi | null>;
  info: DocumentInfo;
  onOpen(): void;
  onPropriedades(): void;
  onTransformar(): void;
  run: RunAction;
}

export function Ribbon({
  tab,
  editor,
  info,
  onOpen,
  onPropriedades,
  onTransformar,
  run,
}: RibbonProps) {
  const state = useEditor();
  const carregando = info.saving === 'loading';
  function botaoFerramenta(id: ToolId) {
    const { nome, atalho, icone } = toolRegistry[id];
    const rotulo = atalho ? `${nome} (${atalho})` : nome;
    return (
      <button
        className={`tool-button ${state.tool === id ? 'selected' : ''}`}
        aria-label={rotulo}
        title={rotulo}
        aria-pressed={state.tool === id}
        onClick={() => state.setTool(id)}
      >
        <Icon name={icone} />
      </button>
    );
  }

  return (
    <div className="ribbon" id="ribbon-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab === 'Início' ? (
        <>
          <RibbonGroup title="Área de transferência" className="clipboard-group">
            <button
              className="ribbon-large"
              onClick={() => run(() => editor.current?.paste())}
              title="Colar seleção (Ctrl+V)"
            >
              <Icon name="clipboard-paste" className="large-icon" />
              <span>Colar</span>
            </button>
            <div className="ribbon-stack">
              <button
                onClick={() => run(() => editor.current?.copy(true))}
                disabled={!info.selection}
              >
                <Icon name="scissors" />
                Recortar
              </button>
              <button onClick={() => run(() => editor.current?.copy())} disabled={!info.selection}>
                <Icon name="document-copy" />
                Copiar
              </button>
            </div>
          </RibbonGroup>
          <RibbonGroup title="Imagem" className="image-group">
            <button
              className={`ribbon-large ${state.tool === 'select' ? 'selected' : ''}`}
              onClick={() => state.setTool('select')}
              aria-label="Selecionar (S)"
              aria-pressed={state.tool === 'select'}
            >
              <Icon name={toolRegistry.select.icone} className="large-icon" />
              <span>Selecionar</span>
            </button>
            <div className="ribbon-stack">
              <button
                onClick={() => editor.current?.crop()}
                disabled={!info.selection || !info.selection.width || !info.selection.height}
              >
                <Icon name="image-crop" />
                Cortar
              </button>
              <button onClick={onOpen}>
                <Icon name="folder-open" />
                Abrir
              </button>
            </div>
            <div className="ribbon-stack image-actions">
              <button
                type="button"
                disabled={carregando}
                title="Propriedades da imagem (Ctrl+E)"
                onClick={onPropriedades}
              >
                <Icon name="information" />
                Propriedades da imagem
              </button>
              <button
                type="button"
                disabled={carregando}
                title="Redimensionar e inclinar (Ctrl+W)"
                onClick={onTransformar}
              >
                <Icon name="application-resize-full" />
                Redimensionar e inclinar
              </button>
              <OrientationMenu
                desabilitado={carregando}
                aplicar={(orientacao) => run(() => editor.current?.girarImagem(orientacao))}
              />
            </div>
          </RibbonGroup>
          <RibbonGroup title="Ferramentas" className="tools-group">
            <div className="tools-grid">
              {botaoFerramenta('pencil')}
              {botaoFerramenta('fill')}
              {botaoFerramenta('eyedropper')}
              {botaoFerramenta('brush')}
              {botaoFerramenta('eraser')}
              <button
                className="tool-button"
                title="Ajustar à janela"
                aria-label="Ajustar à janela"
                onClick={() => editor.current?.fit()}
              >
                <Icon name="magnifier" />
              </button>
            </div>
          </RibbonGroup>
          <RibbonGroup title="Pincéis" className="brush-group">
            <BrushGallery carregando={carregando} />
            {state.tool === 'brush' && state.pincel === 'spray' && <SprayControls />}
          </RibbonGroup>
          <RibbonGroup title="Formas" className="formas-ribbon">
            <ShapeGallery carregando={carregando} />
          </RibbonGroup>
          <RibbonGroup title="Espessura" className="size-group">
            <StrokeThickness />
          </RibbonGroup>
          <RibbonGroup title="Cores" className="colors-group">
            <div className="color-targets">
              {([1, 2] as const).map((id) => (
                <button
                  key={id}
                  className={`color-target ${state.colorTarget === id ? 'selected' : ''}`}
                  aria-pressed={state.colorTarget === id}
                  aria-label={`Selecionar Cor ${id}`}
                  onClick={() => state.set({ colorTarget: id })}
                >
                  <span
                    style={{
                      backgroundColor: id === 1 ? state.color1 : state.color2,
                    }}
                  />
                  <span>Cor {id}</span>
                </button>
              ))}
            </div>
            <button
              className="swap-colors"
              title="Trocar cores (X)"
              aria-label="Trocar cores (X)"
              onClick={state.swapColors}
            >
              <Icon name="arrow-switch" />
            </button>
            <div className="palette" aria-label="Paleta de 28 cores">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  className={`swatch ${color === (state.colorTarget === 1 ? state.color1 : state.color2) ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  title={color}
                  aria-label={`Usar cor ${color}`}
                  aria-pressed={color === (state.colorTarget === 1 ? state.color1 : state.color2)}
                  onClick={() => state.setColor(color)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    state.set({ colorTarget: 2 });
                    state.setColor(color);
                  }}
                />
              ))}
            </div>
            <label className="edit-colors">
              <input
                type="color"
                aria-label="Editar cor personalizada"
                value={state.colorTarget === 1 ? state.color1 : state.color2}
                onChange={(event) => state.setColor(event.target.value)}
              />
              <span className="color-wheel" />
              <span>
                Editar
                <br />
                cores
              </span>
            </label>
          </RibbonGroup>
        </>
      ) : (
        <>
          <RibbonGroup title="Zoom">
            <div className="view-buttons">
              <button
                className="ribbon-large"
                onClick={() => state.set({ zoom: Math.min(4, state.zoom + 0.25) })}
              >
                <Icon name="magnifier" className="large-icon" />
                <span>Ampliar</span>
              </button>
              <button
                className="ribbon-large"
                onClick={() => state.set({ zoom: Math.max(0.1, state.zoom - 0.25) })}
              >
                <Icon name="minus" className="large-icon" />
                <span>Reduzir</span>
              </button>
              <button className="ribbon-large" onClick={() => state.set({ zoom: 1 })}>
                <span className="zoom-number">1:1</span>
                <span>100%</span>
              </button>
              <button className="ribbon-large" onClick={() => editor.current?.fit()}>
                <Icon name="application-resize-full" className="large-icon" />
                <span>Ajustar à janela</span>
              </button>
            </div>
          </RibbonGroup>
          <RibbonGroup title="Mostrar ou ocultar">
            <div className="view-checks">
              {(
                [
                  ['grid', 'Linhas de grade'],
                  ['ruler', 'Régua'],
                  ['sidebar', 'Painel do ateliê'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={state[key]}
                    onChange={(event) => state.set({ [key]: event.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </RibbonGroup>
          <RibbonGroup title="Seu espaço">
            <p className="view-note">
              Aproxime para cuidar dos detalhes.
              <br />
              Afaste para enxergar novas ideias.
            </p>
          </RibbonGroup>
        </>
      )}
    </div>
  );
}
