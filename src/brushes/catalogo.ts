import type { Point } from '../layers/types';

export const PINCEIS = [
  { id: 'redondo', nome: 'Pincel redondo' },
  { id: 'caligrafia-1', nome: 'Caligrafia 1' },
  { id: 'caligrafia-2', nome: 'Caligrafia 2' },
  { id: 'spray', nome: 'Aerógrafo / Spray' },
  { id: 'oleo', nome: 'Pincel a óleo' },
  { id: 'giz', nome: 'Giz de cera' },
  { id: 'marcador', nome: 'Marcador' },
  { id: 'lapis-natural', nome: 'Lápis natural' },
  { id: 'aquarela', nome: 'Aquarela' },
] as const;

export type TipoPincel = (typeof PINCEIS)[number]['id'];
export type DensidadeSpray = 'baixa' | 'media' | 'alta';

export interface ConfiguracaoPincel {
  tipo: TipoPincel;
  cor: string;
  espessura: number;
  semente: number;
}

export interface MarcaPincel extends Point {
  /** Quantidade de pontos emitidos em uma passagem do aerógrafo. */
  quantidade?: number;
}

export function pressaoDoPonto(ponto: Point): number {
  const pressao = ponto.pressure;
  return typeof pressao === 'number' && Number.isFinite(pressao)
    ? Math.max(0, Math.min(1, pressao))
    : 1;
}

export function fatorDaPressao(pressao: number): number {
  return 0.2 + 0.8 * pressao;
}
