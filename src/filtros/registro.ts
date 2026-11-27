import type { PixelBuffer } from '../layers/types';
import {
  brilhoContraste,
  curvas,
  limiar,
  matizSaturacao,
  niveis,
  PONTOS_CURVA_PADRAO,
  posterizar,
  pretoEBranco,
  sepia,
  type PontoCurva,
} from './cores';
import {
  adicionarRuido,
  aplicarRelevo,
  desfoqueGaussiano,
  desfoqueMovimento,
  detectarBordas,
  mascaraNitidez,
  reduzirRuidoMediana,
} from './espaciais';

export type IdFiltro =
  | 'inverter'
  | 'brilho-contraste'
  | 'matiz-saturacao'
  | 'niveis'
  | 'curvas'
  | 'preto-e-branco'
  | 'sepia'
  | 'limiar'
  | 'posterizar'
  | 'desfoque-gaussiano'
  | 'desfoque-movimento'
  | 'nitidez'
  | 'ruido'
  | 'mediana'
  | 'bordas'
  | 'relevo';
export type ParametrosFiltro = Record<string, number | boolean | string | readonly PontoCurva[]>;

type ParametroFiltro = { nome: string } & (
  | { tipo: 'numero'; padrao: number; minimo: number; maximo: number; passo: number }
  | { tipo: 'booleano'; padrao: boolean }
  | { tipo: 'curva'; padrao: readonly PontoCurva[] }
  | { tipo: 'opcao'; padrao: string; opcoes: readonly { valor: string; nome: string }[] }
);

export interface DefinicaoFiltro {
  id: IdFiltro;
  nome: string;
  categoria: string;
  parametros: Readonly<Record<string, ParametroFiltro>>;
  porBlocos: boolean;
  margem?(parametros: ParametrosFiltro): number;
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

function numero(nome: string, padrao: number, minimo: number, maximo: number, passo = 1) {
  return { tipo: 'numero' as const, nome, padrao, minimo, maximo, passo };
}

function margemDoRaio(padrao: number, maximo: number) {
  return ({ raio }: ParametrosFiltro) =>
    typeof raio === 'number' && Number.isFinite(raio)
      ? Math.round(Math.min(maximo, Math.max(0, raio)))
      : padrao;
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
  {
    id: 'brilho-contraste',
    nome: 'Brilho e contraste',
    categoria: 'Cor',
    parametros: {
      brilho: numero('Brilho', 0, -100, 100),
      contraste: numero('Contraste', 0, -100, 100),
    },
    porBlocos: true,
    aplicar: brilhoContraste,
  },
  {
    id: 'matiz-saturacao',
    nome: 'Matiz, saturação e luminosidade',
    categoria: 'Cor',
    parametros: {
      matiz: numero('Matiz', 0, -180, 180),
      saturacao: numero('Saturação', 100, 0, 200),
      luminosidade: numero('Luminosidade', 0, -100, 100),
    },
    porBlocos: true,
    aplicar: matizSaturacao,
  },
  {
    id: 'niveis',
    nome: 'Níveis',
    categoria: 'Cor',
    parametros: {
      preto: numero('Ponto preto', 0, 0, 254),
      branco: numero('Ponto branco', 255, 1, 255),
      gama: numero('Gama', 1, 0.1, 5, 0.01),
    },
    porBlocos: true,
    aplicar: niveis,
  },
  {
    id: 'curvas',
    nome: 'Curvas',
    categoria: 'Cor',
    parametros: {
      pontos: { tipo: 'curva', nome: 'Curva de tons', padrao: PONTOS_CURVA_PADRAO },
    },
    porBlocos: true,
    aplicar: curvas,
  },
  {
    id: 'preto-e-branco',
    nome: 'Preto e branco',
    categoria: 'Cor',
    parametros: {
      vermelho: numero('Vermelho', 29.9, 0, 100, 0.1),
      verde: numero('Verde', 58.7, 0, 100, 0.1),
      azul: numero('Azul', 11.4, 0, 100, 0.1),
    },
    porBlocos: true,
    aplicar: pretoEBranco,
  },
  {
    id: 'sepia',
    nome: 'Sépia',
    categoria: 'Cor',
    parametros: { intensidade: numero('Intensidade', 100, 0, 100) },
    porBlocos: true,
    aplicar: sepia,
  },
  {
    id: 'limiar',
    nome: 'Limiar',
    categoria: 'Cor',
    parametros: { limite: numero('Limite', 128, 0, 255) },
    porBlocos: true,
    aplicar: limiar,
  },
  {
    id: 'posterizar',
    nome: 'Posterizar',
    categoria: 'Cor',
    parametros: { niveis: numero('Níveis por canal', 4, 2, 32) },
    porBlocos: true,
    aplicar: posterizar,
  },
  {
    id: 'desfoque-gaussiano',
    nome: 'Desfoque gaussiano',
    categoria: 'Desfoque',
    parametros: { raio: numero('Raio (px)', 3, 0, 24) },
    porBlocos: true,
    margem: margemDoRaio(3, 24),
    aplicar: desfoqueGaussiano,
  },
  {
    id: 'desfoque-movimento',
    nome: 'Desfoque de movimento',
    categoria: 'Desfoque',
    parametros: { raio: numero('Raio (px)', 6, 0, 24), angulo: numero('Ângulo', 0, -180, 180) },
    porBlocos: true,
    margem: margemDoRaio(6, 24),
    aplicar: desfoqueMovimento,
  },
  {
    id: 'nitidez',
    nome: 'Nitidez',
    categoria: 'Detalhes',
    parametros: {
      raio: numero('Raio (px)', 2, 0, 24),
      intensidade: numero('Intensidade', 80, 0, 200),
    },
    porBlocos: true,
    margem: margemDoRaio(2, 24),
    aplicar: mascaraNitidez,
  },
  {
    id: 'ruido',
    nome: 'Adicionar ruído',
    categoria: 'Detalhes',
    parametros: {
      intensidade: numero('Intensidade', 15, 0, 100),
      monocromatico: { tipo: 'booleano', nome: 'Monocromático', padrao: true },
    },
    porBlocos: false,
    aplicar: adicionarRuido,
  },
  {
    id: 'mediana',
    nome: 'Reduzir ruído (mediana)',
    categoria: 'Detalhes',
    parametros: { raio: numero('Raio (px)', 1, 1, 3) },
    porBlocos: true,
    margem: (parametros) => Math.max(1, margemDoRaio(1, 3)(parametros)),
    aplicar: reduzirRuidoMediana,
  },
  {
    id: 'bordas',
    nome: 'Detectar bordas (Sobel)',
    categoria: 'Detalhes',
    parametros: { intensidade: numero('Intensidade', 100, 0, 200) },
    porBlocos: true,
    margem: () => 1,
    aplicar: detectarBordas,
  },
  {
    id: 'relevo',
    nome: 'Relevo',
    categoria: 'Detalhes',
    parametros: { intensidade: numero('Intensidade', 100, 0, 200) },
    porBlocos: true,
    margem: () => 1,
    aplicar: aplicarRelevo,
  },
];

export function obterFiltro(id: IdFiltro): DefinicaoFiltro {
  const filtro = FILTROS.find((item) => item.id === id);
  if (!filtro) throw new Error('Filtro desconhecido.');
  return filtro;
}
