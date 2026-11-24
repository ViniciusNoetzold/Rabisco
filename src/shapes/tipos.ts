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

export interface ShapeDef {
  id: FormaId;
  nome: string;
  categoria: CategoriaForma;
  path:
    | string
    | ((
        largura: number,
        altura: number,
        parametros: ParametrosForma,
        pontos?: readonly Point[],
        aberta?: boolean,
      ) => Path2D);
  params?: ParamSchema;
  fechada: boolean;
}

export interface ConfiguracaoForma {
  id: FormaId;
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
