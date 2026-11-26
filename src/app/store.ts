import type { ModoSimetria } from '../brushes/simetria';
import type { FormaGradiente } from '../tools/gradiente';
import { SEM_GUIAS, type GuiasDocumento } from '../document/guias';
import type { CurvaPressao } from '../brushes/pressao';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DensidadeSpray, TipoPincel } from '../brushes/catalogo';
import type { Point, ToolId } from '../layers/types';
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
  /** Balde e conta-gotas olham todas as camadas (o que se vê) em vez só da ativa. */
  amostrarTudo: boolean;
  /** O texto confirmado entra numa camada própria. */
  textoEmNovaCamada: boolean;
  /** Cada forma confirmada entra numa camada própria. */
  formasEmNovaCamada: boolean;
  /** Estabilizador de traço (0 desliga; é o comprimento da corda em px de tela, até 100). */
  estabilizar: number;
  /** Amortecimento extra do estabilizador, 0–100%. */
  suavizar: number;
  /** Ao soltar, o fim do traço alcança onde o ponteiro parou. */
  alcancarFim: boolean;
  /** Como a força da caneta vira espessura e opacidade nos pincéis. */
  curvaPressao: CurvaPressao;
  /** Mouse e toque: rápido afina, devagar engrossa. */
  pressaoVelocidade: boolean;
  /** Pontas finas no começo e no fim da pincelada, 0–100%. */
  afinar: number;
  /** Simetria dos traços de lápis, pincéis e borrachas. */
  simetria: ModoSimetria;
  /** Fatias da simetria radial, 2–24. */
  eixosSimetria: number;
  /** Mandala: espelha dentro de cada fatia do radial. */
  espelharFatias: boolean;
  /** Centro em px do documento; nulo = meio do papel (acompanha o tamanho do papel). */
  centroSimetria: Point | null;
  /** Linhas-guia da simetria sobre o papel. */
  guiasSimetria: boolean;
  /** Segurar parado no fim do traço de lápis ou pincel o transforma em forma certinha. */
  formasInteligentes: boolean;
  /** Quanto tempo segurar parado, em ms. */
  esperaFormaInteligente: number;
  /** Guias do papel e régua de desenho (vão no .rabisco e no salvamento automático). */
  guiasDoPapel: GuiasDocumento;
  /** Mostrar as guias do papel (e encaixar nelas). */
  mostrarGuias: boolean;
  /** Gradiente linear ou radial. */
  formaGradiente: FormaGradiente;
  /** Gradiente da Cor 1 até transparente. */
  gradienteTransparente: boolean;
  /** Dedo (borrar): quanto arrasta a cor, 0–100. */
  forcaDedo: number;
  /** Vista girada (graus, −180…180): só a tela gira, a imagem não. */
  rotacaoVista: number;
  /** Vista espelhada (H), para conferir proporções. */
  espelharVista: boolean;
  /** Guia sendo arrastada da régua lateral ou com a ferramenta Mover. */
  guiaNova: { eixo: 'horizontal' | 'vertical'; valor: number } | null;
  /** Na transformação livre, encaixar nas bordas e no centro do papel e das camadas. */
  guiasInteligentes: boolean;
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
        | 'amostrarTudo'
        | 'textoEmNovaCamada'
        | 'formasEmNovaCamada'
        | 'estabilizar'
        | 'suavizar'
        | 'alcancarFim'
        | 'curvaPressao'
        | 'pressaoVelocidade'
        | 'afinar'
        | 'simetria'
        | 'eixosSimetria'
        | 'espelharFatias'
        | 'centroSimetria'
        | 'guiasSimetria'
        | 'formasInteligentes'
        | 'esperaFormaInteligente'
        | 'guiasDoPapel'
        | 'mostrarGuias'
        | 'guiaNova'
        | 'rotacaoVista'
        | 'formaGradiente'
        | 'gradienteTransparente'
        | 'forcaDedo'
        | 'espelharVista'
        | 'guiasInteligentes'
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
    amostrarTudo: false,
    textoEmNovaCamada: true,
    formasEmNovaCamada: false,
    estabilizar: 0,
    suavizar: 0,
    alcancarFim: true,
    curvaPressao: 'linear',
    pressaoVelocidade: false,
    afinar: 0,
    simetria: 'nenhuma',
    eixosSimetria: 6,
    espelharFatias: false,
    centroSimetria: null,
    guiasSimetria: true,
    formasInteligentes: true,
    esperaFormaInteligente: 500,
    guiasDoPapel: SEM_GUIAS,
    mostrarGuias: true,
    guiaNova: null,
    rotacaoVista: 0,
    formaGradiente: 'linear',
    gradienteTransparente: false,
    forcaDedo: 60,
    espelharVista: false,
    guiasInteligentes: true,
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
