import type { Point, Rect } from '../layers/types';

export type FormaId =
  | 'line'
  | 'curve'
  | 'ellipse'
  | 'rectangle'
  | 'retangulo-arredondado'
  | 'polygon'
  | 'triangulo'
  | 'triangulo-retangulo'
  | 'losango'
  | 'pentagono'
  | 'hexagono'
  | 'octogono'
  | 'trapezio'
  | 'paralelogramo'
  | 'cruz'
  | 'anel'
  | 'meia-lua'
  | 'gota'
  | 'nuvem'
  | 'seta-direita'
  | 'seta-esquerda'
  | 'seta-cima'
  | 'seta-baixo'
  | 'seta-dupla-horizontal'
  | 'seta-dupla-vertical'
  | 'seta-curva'
  | 'estrela-4'
  | 'estrela-5'
  | 'estrela-6'
  | 'estrela-n'
  | 'balao-retangular'
  | 'balao-oval'
  | 'balao-pensamento'
  | 'coracao'
  | 'raio'
  | 'poligono-regular'
  | 'espiral';

export type CategoriaForma = 'basicas' | 'setas' | 'estrelas' | 'baloes' | 'simbolos' | 'minhas';
export type IdForma = FormaId | `propria:${string}`;
export type EstiloPreenchimento = 'none' | 'solid' | 'giz' | 'marcador' | 'aquarela';
export type EstiloContorno = EstiloPreenchimento | 'dash' | 'dot';

export interface ParametrosForma {
  pontas: number;
  raioInterno: number;
  lados: number;
}

export const PARAMETROS_PADRAO: ParametrosForma = { pontas: 5, raioInterno: 45, lados: 6 };

export type ParamSchema = Partial<
  Record<keyof ParametrosForma, { rotulo: string; min: number; max: number }>
>;

export type TracadorForma = Pick<
  Path2D,
  'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath'
>;

export interface ShapeDef {
  id: IdForma;
  nome: string;
  categoria: CategoriaForma;
  path:
    | string
    | ((
        caminho: TracadorForma,
        largura: number,
        altura: number,
        parametros: ParametrosForma,
        pontos?: readonly Point[],
        aberta?: boolean,
      ) => void);
  params?: ParamSchema;
  fechada: boolean;
}

export interface ConfiguracaoForma {
  id: IdForma;
  /** A geometria fica junto do comando, mesmo após editar ou excluir a predefinição. */
  definicao?: { nome: string; path: string; fechada: boolean };
  caixa: Rect;
  /** Ângulo em radianos, em torno do centro da caixa. */
  rotacao: number;
  cor1: string;
  cor2: string;
  espessura: number;
  contorno: EstiloContorno;
  preenchimento: EstiloPreenchimento;
  parametros: ParametrosForma;
  /** Vértices e controles em coordenadas relativas à caixa. */
  pontos?: Point[];
  /** Durante a coleta de vértices, o polígono ainda não fecha nem preenche. */
  aberta?: boolean;
}
