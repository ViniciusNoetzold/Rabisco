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
import { OPCOES_PALETA_PIXEL_ART, pixelizar, reduzirPaleta } from './pixelArt';
import { dithering, OPCOES_DITHERING, OPCOES_PALETA_DITHERING } from './dithering';
import { efeitoCrt, meioTom, mosaico, pontilhismo, vitral } from './estilos';

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
  | 'relevo'
  | 'pixelizar'
  | 'reduzir-paleta'
  | 'dithering'
  | 'meio-tom'
  | 'mosaico'
  | 'pontilhismo'
  | 'vitral'
  | 'crt';
export type ParametrosFiltro = Record<string, number | boolean | string | readonly PontoCurva[]>;

type ParametroFiltro = { nome: string; mostrarQuando?(parametros: ParametrosFiltro): boolean } & (
  | { tipo: 'numero'; padrao: number; minimo: number; maximo: number; passo: number }
  | { tipo: 'booleano'; padrao: boolean }
  | { tipo: 'curva'; padrao: readonly PontoCurva[] }
  | { tipo: 'cor'; padrao: string }
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
  {
    id: 'pixelizar',
    nome: 'Pixelizar',
    categoria: 'Pixel art',
    parametros: { tamanho: numero('Tamanho do bloco (px)', 8, 1, 128) },
    porBlocos: false,
    aplicar: pixelizar,
  },
  {
    id: 'reduzir-paleta',
    nome: 'Reduzir paleta',
    categoria: 'Pixel art',
    parametros: {
      paleta: { tipo: 'opcao', nome: 'Paleta', padrao: 'pico-8', opcoes: OPCOES_PALETA_PIXEL_ART },
      cores: {
        ...numero('Cores na paleta do desenho', 16, 2, 64),
        mostrarQuando: (parametros) => parametros.paleta === 'desenho',
      },
      dithering: { tipo: 'booleano', nome: 'Dithering', padrao: false },
    },
    porBlocos: false,
    aplicar: reduzirPaleta,
  },
  {
    id: 'dithering',
    nome: 'Dithering',
    categoria: 'Estilos',
    porBlocos: false,
    aplicar: dithering,
    parametros: {
      algoritmo: {
        tipo: 'opcao',
        nome: 'Algoritmo',
        padrao: 'floyd-steinberg',
        opcoes: OPCOES_DITHERING,
      },
      paleta: { tipo: 'opcao', nome: 'Paleta', padrao: 'cinza', opcoes: OPCOES_PALETA_DITHERING },
      cores: numero('Quantidade de cores', 2, 2, 16),
    },
  },
  {
    id: 'meio-tom',
    nome: 'Meio-tom',
    categoria: 'Estilos',
    porBlocos: false,
    aplicar: meioTom,
    parametros: {
      modo: {
        tipo: 'opcao',
        nome: 'Modo de cor',
        padrao: 'mono',
        opcoes: [
          { valor: 'mono', nome: 'Uma cor' },
          { valor: 'cmyk', nome: 'CMYK' },
        ],
      },
      tamanho: numero('Tamanho do ponto (px)', 9, 3, 64),
      angulo: numero('Ângulo', 45, -180, 180),
      cor: {
        tipo: 'cor',
        nome: 'Cor do ponto',
        padrao: '#000000',
        mostrarQuando: (p) => p.modo === 'mono',
      },
    },
  },
  {
    id: 'mosaico',
    nome: 'Mosaico',
    categoria: 'Estilos',
    porBlocos: false,
    aplicar: mosaico,
    parametros: {
      tamanho: numero('Tamanho da peça (px)', 12, 2, 128),
      junta: numero('Largura das juntas (px)', 1, 0, 8),
      corJuntas: { tipo: 'cor', nome: 'Cor das juntas', padrao: '#28252a' },
    },
  },
  {
    id: 'pontilhismo',
    nome: 'Pontilhismo',
    categoria: 'Estilos',
    porBlocos: false,
    aplicar: pontilhismo,
    parametros: {
      tamanho: numero('Tamanho do ponto (px)', 8, 3, 64),
      densidade: numero('Densidade', 70, 10, 100),
    },
  },
  {
    id: 'vitral',
    nome: 'Vitral',
    categoria: 'Estilos',
    porBlocos: false,
    aplicar: vitral,
    parametros: {
      tamanho: numero('Tamanho do vidro (px)', 18, 3, 128),
      borda: numero('Espessura da borda (px)', 1, 0, 8),
      corBorda: { tipo: 'cor', nome: 'Cor da borda', padrao: '#202126' },
    },
  },
  {
    id: 'crt',
    nome: 'CRT',
    categoria: 'Estilos',
    porBlocos: false,
    aplicar: efeitoCrt,
    parametros: {
      linhas: numero('Intensidade das linhas', 25, 0, 100),
      periodo: numero('Distância entre linhas (px)', 3, 2, 8),
      separacao: numero('Separação de cor (px)', 2, 0, 8),
    },
  },
];

export function obterFiltro(id: IdFiltro): DefinicaoFiltro {
  const filtro = FILTROS.find((item) => item.id === id);
  if (!filtro) throw new Error('Filtro desconhecido.');
  return filtro;
}
