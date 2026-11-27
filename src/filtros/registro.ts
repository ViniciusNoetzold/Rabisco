import type { PixelBuffer } from '../layers/types';

export type IdFiltro = 'inverter';
export type ParametrosFiltro = Record<string, number | boolean | string>;

type ParametroFiltro = { nome: string } & (
  | { tipo: 'numero'; padrao: number; minimo: number; maximo: number; passo: number }
  | { tipo: 'booleano'; padrao: boolean }
  | { tipo: 'opcao'; padrao: string; opcoes: readonly { valor: string; nome: string }[] }
);

export interface DefinicaoFiltro {
  id: IdFiltro;
  nome: string;
  categoria: string;
  parametros: Readonly<Record<string, ParametroFiltro>>;
  porBlocos: boolean;
  aplicar(pixels: PixelBuffer, parametros: ParametrosFiltro, semente: number): PixelBuffer;
}

function inverterCores(pixels: PixelBuffer): PixelBuffer {
  const data = new Uint8ClampedArray(pixels.data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  return { width: pixels.width, height: pixels.height, data };
}

export const FILTROS: readonly DefinicaoFiltro[] = [
  {
    id: 'inverter',
    nome: 'Inverter cores',
    categoria: 'Cor',
    parametros: {},
    porBlocos: true,
    aplicar: inverterCores,
  },
];

export function obterFiltro(id: IdFiltro): DefinicaoFiltro {
  const filtro = FILTROS.find((item) => item.id === id);
  if (!filtro) throw new Error('Filtro desconhecido.');
  return filtro;
}
