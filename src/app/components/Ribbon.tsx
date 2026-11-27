import { useRef, type RefObject } from 'react';
import type { DocumentInfo, EditorApi } from '../../canvas/CanvasSurface';
import type { ToolId } from '../../layers/types';
import { toolRegistry } from '../../tools/toolRegistry';
import type { IdFiltro } from '../../filtros/registro';
import { PALETTE, useEditor } from '../store';
import { BrushGallery } from './BrushGallery';
import { FiltrosMenu } from './FiltrosMenu';
import { OrientationMenu } from './OrientationMenu';
import { Icon, RibbonGroup, type RunAction } from './Primitives';
import { ShapeGallery, type ShapeGalleryProps } from './ShapeGallery';
import { DedoControles, SprayControls, StrokeThickness } from './StrokeThickness';
import { TextTools } from './TextTools';
import { SimetriaControles } from './SimetriaControles';
import { VistaControles } from './VistaControles';
import {
  ControlesDeBalde,
  ControlesDeBorracha,
  ControlesDeGradiente,
  ControlesDeVarinha,
} from './ContextPixelTools';
import { SelectionMenu } from './SelectionMenu';
import { nivelSeguinte } from '../../canvas/zoom';
import { RecolhimentoContexto, useMedirRibbon } from './ribbonRecolhimento';

interface RibbonProps {
  tab: string;
  editor: RefObject<EditorApi | null>;
  info: DocumentInfo;
  galeriaFormas: Omit<ShapeGalleryProps, 'carregando'>;
  onOpen(): void;
  onPropriedades(): void;
  onTransformar(): void;
  onEditarCores(): void;
  onFiltro(filtro: IdFiltro): void;
  onRepetirFiltro(): void;
  onConverterAscii(): void;
  onColar(): void;
  onColarDe(): void;
  alternarTelaInteira(): void;
  run: RunAction;
}

export function Ribbon({
  tab,
  editor,
  info,
  galeriaFormas,
  onOpen,
  onPropriedades,
  onTransformar,
  onEditarCores,
  onFiltro,
  onRepetirFiltro,
  onConverterAscii,
  onColar,
  onColarDe,
  alternarTelaInteira,
  run,
}: RibbonProps) {
  const state = useEditor();
  const carregando = info.saving === 'loading';
  const ribbon = useRef<HTMLDivElement>(null);
  const recolhimento = useMedirRibbon(ribbon, tab);
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
    <RecolhimentoContexto.Provider value={recolhimento}>
      <div
        ref={ribbon}
        className="ribbon"
        id="ribbon-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        data-opcoes-texto={tab === 'Texto' ? '' : undefined}
      >
        {tab !== 'Exibir' ? (
          <>
            {tab === 'Texto' ? (
              <TextTools
                estilo={state.estiloTexto}
                definirEstilo={(estiloTexto) => state.set({ estiloTexto })}
              />
            ) : (
              <>
                <RibbonGroup
                  title="Área de transferência"
                  className="clipboard-group"
                  chave="area-transferencia"
                  rotuloRecolhido="Copiar e colar"
                  prioridade={5}
                  icone="clipboard-paste"
                >
                  <button className="ribbon-large" onClick={onColar} title="Colar (Ctrl+V)">
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
                    <button
                      onClick={() => run(() => editor.current?.copy())}
                      disabled={!info.selection}
                    >
                      <Icon name="document-copy" />
                      Copiar
                    </button>
                    <button type="button" onClick={onColarDe}>
                      <Icon name="folder-open" />
                      Colar de…
                    </button>
                  </div>
                </RibbonGroup>
                <RibbonGroup
                  title="Imagem"
                  className="image-group"
                  chave="imagem"
                  prioridade={4}
                  icone="picture"
                >
                  <button
                    className={`ribbon-large ${state.tool === 'select' ? 'selected' : ''}`}
                    onClick={() => state.setTool('select')}
                    aria-label="Selecionar (S)"
                    aria-pressed={state.tool === 'select'}
                  >
                    <Icon name={toolRegistry.select.icone} className="large-icon" />
                    <span>Selecionar</span>
                  </button>
                  <div className="ribbon-stack imagem-principais">
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
                    <FiltrosMenu
                      desabilitado={carregando}
                      podeRepetir={Boolean(editor.current?.temUltimoFiltro())}
                      escolher={onFiltro}
                      repetir={onRepetirFiltro}
                      converterAscii={onConverterAscii}
                    />
                  </div>
                  <div className="ribbon-stack image-actions">
                    <button
                      type="button"
                      disabled={carregando}
                      title="Propriedades da imagem (Ctrl+E)"
                      aria-label="Propriedades da imagem"
                      onClick={onPropriedades}
                    >
                      <Icon name="information" />
                      Propriedades
                    </button>
                    <button
                      type="button"
                      disabled={carregando}
                      title="Redimensionar e inclinar (Ctrl+W)"
                      aria-label="Redimensionar e inclinar"
                      onClick={onTransformar}
                    >
                      <Icon name="application-resize-full" />
                      Redimensionar
                    </button>
                    <OrientationMenu
                      desabilitado={carregando}
                      aplicar={(orientacao) => run(() => editor.current?.girarImagem(orientacao))}
                    />
                    <SelectionMenu editor={editor.current} selecionada={Boolean(info.selection)} />
                  </div>
                </RibbonGroup>
                <RibbonGroup
                  title="Ferramentas"
                  className="tools-group"
                  chave="ferramentas"
                  prioridade={6}
                  icone="pencil"
                >
                  <div className="tools-grid">
                    {botaoFerramenta('pencil')}
                    {botaoFerramenta('fill')}
                    {botaoFerramenta('eyedropper')}
                    {botaoFerramenta('brush')}
                    {botaoFerramenta('eraser')}
                    {botaoFerramenta('text')}
                    {botaoFerramenta('zoom')}
                    {botaoFerramenta('move')}
                    {botaoFerramenta('gradient')}
                    {botaoFerramenta('wand')}
                  </div>
                </RibbonGroup>
                <RibbonGroup
                  title="Pincéis"
                  className="brush-group"
                  chave="pinceis"
                  prioridade={3}
                  icone="paint-brush"
                >
                  <BrushGallery carregando={carregando} />
                  {state.tool === 'brush' && state.pincel === 'spray' && <SprayControls />}
                  {state.tool === 'brush' && state.pincel === 'dedo' && <DedoControles />}
                </RibbonGroup>
                <RibbonGroup
                  title="Formas"
                  className="formas-ribbon"
                  chave="formas"
                  prioridade={2}
                  icone="layer-shape"
                >
                  <ShapeGallery carregando={carregando} {...galeriaFormas} />
                </RibbonGroup>
                <RibbonGroup
                  title={
                    state.tool === 'fill'
                      ? 'Balde'
                      : state.tool === 'wand'
                        ? 'Varinha'
                        : state.tool === 'gradient'
                          ? 'Gradiente'
                          : state.tool === 'eraser'
                            ? 'Borracha'
                            : 'Espessura'
                  }
                  className={`size-group ${state.tool === 'fill' || state.tool === 'gradient' || state.tool === 'wand' ? 'pixel-fill-group' : state.tool === 'eraser' ? 'pixel-eraser-group' : ''}`}
                  chave="espessura"
                  prioridade={1}
                  icone={
                    state.tool === 'fill'
                      ? 'paint-can'
                      : state.tool === 'gradient'
                        ? 'color'
                        : state.tool === 'eraser'
                          ? 'eraser'
                          : 'minus'
                  }
                >
                  {state.tool === 'eraser' ? (
                    <ControlesDeBorracha />
                  ) : state.tool === 'fill' ? (
                    <ControlesDeBalde />
                  ) : state.tool === 'wand' ? (
                    <ControlesDeVarinha />
                  ) : state.tool === 'gradient' ? (
                    <ControlesDeGradiente />
                  ) : (
                    <StrokeThickness />
                  )}
                </RibbonGroup>
              </>
            )}
            <RibbonGroup
              title="Cores"
              className={`colors-group ${recolhimento.compactarCores ? 'cores-compactas' : ''}`}
              chave="cores"
              compacto={recolhimento.compactarCores}
            >
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
              <button
                type="button"
                className="edit-colors"
                aria-label="Editar cores"
                onClick={onEditarCores}
              >
                <span className="color-wheel" />
                <span>
                  Editar
                  <br />
                  cores
                </span>
              </button>
            </RibbonGroup>
          </>
        ) : (
          <>
            <RibbonGroup title="Simetria" chave="simetria" prioridade={4} icone="arrow-switch">
              <SimetriaControles />
            </RibbonGroup>
            <RibbonGroup title="Zoom" chave="zoom" prioridade={3} icone="magnifier">
              <div className="view-buttons">
                <button
                  className="ribbon-large"
                  onClick={() => state.set({ zoom: nivelSeguinte(state.zoom, 1) })}
                >
                  <Icon name="magnifier" className="large-icon" />
                  <span>Ampliar</span>
                </button>
                <button
                  className="ribbon-large"
                  onClick={() => state.set({ zoom: nivelSeguinte(state.zoom, -1) })}
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
            <RibbonGroup title="Mostrar ou ocultar" chave="mostrar" prioridade={5} icone="grid">
              <div className="view-checks">
                {(
                  [
                    ['grid', 'Linhas de grade'],
                    ['ruler', 'Régua'],
                    ['sidebar', 'Painel do ateliê'],
                    ['guiasInteligentes', 'Guias de encaixe'],
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
            <RibbonGroup title="Vista" chave="vista" prioridade={1.2} icone="arrow-curve">
              <VistaControles />
            </RibbonGroup>
            <RibbonGroup title="Pixel art" chave="pixel-art" prioridade={0.5} icone="grid">
              <div className="view-checks pixel-art-controles">
                <label>
                  <input
                    type="checkbox"
                    checked={state.modoPixelArt}
                    onChange={(evento) => {
                      const modoPixelArt = evento.target.checked;
                      state.set({ modoPixelArt });
                      if (modoPixelArt) state.setTool('pencil');
                    }}
                  />
                  Modo pixel art
                </label>
                <label>
                  Grade
                  <select
                    aria-label="Grade de pixel art"
                    disabled={!state.modoPixelArt}
                    value={state.gradePixelArt}
                    onChange={(evento) =>
                      state.set({ gradePixelArt: Number(evento.target.value) as 0 | 8 | 16 | 32 })
                    }
                  >
                    <option value={0}>Oculta</option>
                    <option value={8}>8 px</option>
                    <option value={16}>16 px</option>
                    <option value={32}>32 px</option>
                  </select>
                </label>
              </div>
            </RibbonGroup>
            <RibbonGroup title="Régua e guias" chave="guias" prioridade={1.5} icone="ruler">
              <div className="view-buttons guias-botoes">
                <button
                  type="button"
                  className="ribbon-large"
                  title="Régua de desenho (Shift+R): traços que começam perto dela saem retos"
                  aria-pressed={Boolean(state.guiasDoPapel.regua)}
                  onClick={() => editor.current?.alternarRegua()}
                >
                  <Icon name="ruler" className="large-icon" />
                  <span>Régua de desenho</span>
                </button>
                <div className="ribbon-stack">
                  <label className="guias-mostrar">
                    <input
                      type="checkbox"
                      checked={state.mostrarGuias}
                      onChange={(event) => state.set({ mostrarGuias: event.target.checked })}
                    />
                    Guias
                  </label>
                  <button
                    type="button"
                    title="Remove todas as guias do papel (crie novas arrastando das réguas)"
                    disabled={
                      !state.guiasDoPapel.horizontais.length && !state.guiasDoPapel.verticais.length
                    }
                    onClick={() =>
                      state.set({
                        guiasDoPapel: { ...state.guiasDoPapel, horizontais: [], verticais: [] },
                      })
                    }
                  >
                    <Icon name="cross" />
                    Limpar guias
                  </button>
                </div>
              </div>
            </RibbonGroup>
            <RibbonGroup
              title="Navegação"
              chave="navegacao"
              prioridade={1}
              icone="application-resize-full"
            >
              <div className="view-buttons">
                <button
                  type="button"
                  className="ribbon-large"
                  aria-pressed={state.miniatura}
                  onClick={() => state.set({ miniatura: !state.miniatura })}
                >
                  <Icon name="picture" className="large-icon" />
                  <span>Miniatura</span>
                </button>
                <button
                  type="button"
                  className="ribbon-large"
                  title="Tela inteira (F11)"
                  onClick={alternarTelaInteira}
                >
                  <Icon name="application-resize-full" className="large-icon" />
                  <span>Tela inteira</span>
                </button>
              </div>
            </RibbonGroup>
          </>
        )}
      </div>
    </RecolhimentoContexto.Provider>
  );
}
