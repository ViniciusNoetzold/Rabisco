import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DensidadeSpray, TipoPincel } from '../brushes/catalogo';
import type { ToolId } from '../layers/types';
import { obterForma } from '../shapes/catalogo';
import type { FormaPropria } from '../shapes/presets';
import { ESTILO_TEXTO_PADRAO, type EstiloTexto } from '../tools/texto';
import { limitarZoom } from '../canvas/zoom';
import {
  PARAMETROS_PADRAO,
  type EstiloContorno,
  type EstiloPreenchimento,
  type FormaId,
  type ParametrosForma,
} from '../shapes/tipos';

export const ESPESSURA_MAXIMA = 100;

export const PALETTE = [
  '#252a34',
  '#687586',
  '#b83443',
  '#e24b4b',
  '#ef8536',
  '#f6c94d',
  '#70a54a',
  '#35a99c',
  '#3083c5',
  '#5568b6',
  '#8b5cb2',
  '#cc66a1',
  '#8b604c',
  '#573e51',
  '#ffffff',
  '#c9d0d8',
  '#e5b3bd',
  '#ffb9ad',
  '#ffd1a3',
  '#fff1ae',
  '#c9dfab',
  '#b4e5db',
  '#b4d8ef',
  '#c3c9ee',
  '#dec4ef',
  '#f5c3de',
  '#d9bba8',
  '#b9a7c1',
];

interface EditorState {
  tool: ToolId;
  ultimaFerramenta: ToolId;
  estiloTexto: EstiloTexto;
  pincel: TipoPincel;
  densidadeSpray: DensidadeSpray;
  /** Gotas do aerógrafo: finas (1 px, como no paint clássico) ou médias (2 px). */
  gotasSpray: 1 | 2;
  color1: string;
  color2: string;
  colorTarget: 1 | 2;
  size: number;
  forma: FormaId;
  formaPropria: FormaPropria | null;
  ultimaFormaGeral: FormaId;
  ultimaFormaPropria: FormaPropria | null;
  contornoForma: EstiloContorno;
  preenchimentoForma: EstiloPreenchimento;
  parametrosForma: ParametrosForma;
  zoom: number;
  grid: boolean;
  ruler: boolean;
  miniatura: boolean;
  sidebar: boolean;
  selecaoTransparente: boolean;
  espessuraBorracha: number;
  toleranciaBorracha: number;
  toleranciaBalde: number;
  preenchimentoGlobal: boolean;
  setTool: (tool: ToolId) => void;
  setPincel: (tipo: TipoPincel) => void;
  setForma: (forma: FormaId) => void;
  selecionarFormaPropria: (forma: FormaPropria) => void;
  sincronizarFormaPropria: (formas: readonly FormaPropria[]) => void;
  setParametroForma: (chave: keyof ParametrosForma, valor: number) => void;
  setColor: (color: string) => void;
  capturarCor: (cor: string, alvo: 1 | 2) => void;
  swapColors: () => void;
  set: (
    value: Partial<
      Pick<
        EditorState,
        | 'colorTarget'
        | 'size'
        | 'densidadeSpray'
        | 'gotasSpray'
        | 'contornoForma'
        | 'preenchimentoForma'
        | 'zoom'
        | 'grid'
        | 'ruler'
        | 'miniatura'
        | 'sidebar'
        | 'selecaoTransparente'
        | 'estiloTexto'
        | 'espessuraBorracha'
        | 'toleranciaBorracha'
        | 'toleranciaBalde'
        | 'preenchimentoGlobal'
      >
    >,
  ) => void;
}

function formaRapida(forma: ToolId | FormaId): forma is 'line' | 'rectangle' | 'ellipse' {
  return forma === 'line' || forma === 'rectangle' || forma === 'ellipse';
}

/** Apenas configurações leves no React; pixels e gestos ficam fora do ciclo de renderização. */
export const useEditor = create<EditorState>()(
  immer((set) => ({
    tool: 'brush',
    ultimaFerramenta: 'brush',
    estiloTexto: { ...ESTILO_TEXTO_PADRAO },
    pincel: 'redondo',
    densidadeSpray: 'media',
    gotasSpray: 1,
    color1: '#3083c5',
    color2: '#ffffff',
    colorTarget: 1,
    size: 6,
    forma: 'rectangle',
    formaPropria: null,
    ultimaFormaGeral: 'rectangle',
    ultimaFormaPropria: null,
    contornoForma: 'solid',
    preenchimentoForma: 'none',
    parametrosForma: { ...PARAMETROS_PADRAO },
    zoom: 1,
    grid: false,
    ruler: false,
    miniatura: false,
    sidebar: true,
    selecaoTransparente: false,
    espessuraBorracha: 8,
    toleranciaBorracha: 5,
    toleranciaBalde: 5,
    preenchimentoGlobal: false,
    setTool: (tool) =>
      set((state) => {
        if (tool === 'eyedropper' && state.tool !== tool) state.ultimaFerramenta = state.tool;
        state.tool = tool;
        if (formaRapida(tool)) state.forma = tool;
        if (tool === 'shape') state.forma = state.ultimaFormaGeral;
        state.formaPropria = tool === 'shape' ? state.ultimaFormaPropria : null;
      }),
    setPincel: (tipo) =>
      set((state) => {
        if (tipo === 'spray' && state.pincel !== 'spray' && state.size < 16) state.size = 32;
        state.pincel = tipo;
        state.tool = 'brush';
        state.formaPropria = null;
      }),
    setForma: (forma) =>
      set((estado) => {
        estado.forma = forma;
        estado.formaPropria = null;
        if (formaRapida(forma)) estado.tool = forma;
        else {
          estado.tool = 'shape';
          estado.ultimaFormaGeral = forma;
          estado.ultimaFormaPropria = null;
        }
      }),
    selecionarFormaPropria: (forma) =>
      set((estado) => {
        estado.tool = 'shape';
        estado.forma = estado.ultimaFormaGeral;
        estado.formaPropria = estado.ultimaFormaPropria = forma;
        if (forma.estilo) {
          const { cor1, cor2, espessura, contorno, preenchimento } = forma.estilo;
          estado.color1 = cor1;
          estado.color2 = cor2;
          estado.size = espessura;
          estado.contornoForma = contorno;
          estado.preenchimentoForma = preenchimento;
        }
      }),
    sincronizarFormaPropria: (formas) =>
      set((estado) => {
        const anterior = estado.ultimaFormaPropria;
        if (!anterior) return;
        const atual = formas.find(({ id }) => id === anterior.id) ?? null;
        estado.ultimaFormaPropria = atual;
        if (estado.formaPropria) estado.formaPropria = atual;
      }),
    setParametroForma: (chave, valor) =>
      set((estado) => {
        const limites = estado.formaPropria ? undefined : obterForma(estado.forma).params?.[chave];
        if (!limites || !Number.isFinite(valor)) return;
        estado.parametrosForma[chave] = Math.max(
          limites.min,
          Math.min(limites.max, Math.round(valor)),
        );
      }),
    setColor: (color) =>
      set((state) => {
        if (state.colorTarget === 1) state.color1 = color;
        else state.color2 = color;
      }),
    swapColors: () =>
      set((state) => {
        [state.color1, state.color2] = [state.color2, state.color1];
      }),
    capturarCor: (cor, alvo) =>
      set((state) => {
        if (alvo === 1) state.color1 = cor;
        else state.color2 = cor;
      }),
    set: (value) =>
      set((state) => {
        const {
          size,
          espessuraBorracha,
          toleranciaBorracha,
          toleranciaBalde,
          zoom,
          ...outrasOpcoes
        } = value;
        Object.assign(state, outrasOpcoes);
        if (zoom !== undefined && Number.isFinite(zoom)) state.zoom = limitarZoom(zoom);
        if (size !== undefined && Number.isFinite(size)) {
          state.size = Math.max(1, Math.min(ESPESSURA_MAXIMA, Math.round(size)));
        }
        for (const [chave, numero, minimo] of [
          ['espessuraBorracha', espessuraBorracha, 1],
          ['toleranciaBorracha', toleranciaBorracha, 0],
          ['toleranciaBalde', toleranciaBalde, 0],
        ] as const) {
          if (numero !== undefined && Number.isFinite(numero))
            state[chave] = Math.max(minimo, Math.min(100, Math.round(numero)));
        }
      }),
  })),
);
