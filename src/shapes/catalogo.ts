import type { Point } from '../layers/types';
import type { FormaId, ParametrosForma, ShapeDef } from './tipos';

const ELLIPSE =
  'M.5 0 C.7761 0 1 .2239 1 .5 C1 .7761 .7761 1 .5 1 C.2239 1 0 .7761 0 .5 C0 .2239 .2239 0 .5 0Z';
const NUVEM =
  'M.19 .88 C.06 .88 0 .77 0 .62 C0 .48 .08 .4 .2 .38 C.17 .23 .25 .12 .38 .12 C.44 .02 .56 0 .64 .06 C.75 .07 .8 .18 .79 .28 C.93 .27 1 .38 1 .53 C1 .66 .95 .77 .83 .81 C.76 .94 .6 .99 .49 .89 C.4 1 .24 1 .19 .88Z';

function caminhoDosPontos(
  largura: number,
  altura: number,
  pontos: readonly Point[],
  fechar: boolean,
) {
  const caminho = new Path2D();
  for (const [indice, ponto] of pontos.entries()) {
    const x = ponto.x * largura;
    const y = ponto.y * altura;
    if (indice === 0) caminho.moveTo(x, y);
    else caminho.lineTo(x, y);
  }
  if (fechar && pontos.length >= 3) caminho.closePath();
  return caminho;
}

function ajustarNaCaixa(pontos: readonly Point[]): Point[] {
  const esquerda = Math.min(...pontos.map(({ x }) => x));
  const direita = Math.max(...pontos.map(({ x }) => x));
  const topo = Math.min(...pontos.map(({ y }) => y));
  const base = Math.max(...pontos.map(({ y }) => y));
  return pontos.map(({ x, y }) => ({
    x: (x - esquerda) / (direita - esquerda),
    y: (y - topo) / (base - topo),
  }));
}

function radial(pontas: number, raioInterno?: number, desfase = 0) {
  const vertices = raioInterno === undefined ? pontas : pontas * 2;
  const pontos = Array.from({ length: vertices }, (_, i) => {
    const angulo = (i * 2 * Math.PI) / vertices - Math.PI / 2 + desfase;
    const raio = i % 2 === 1 && raioInterno !== undefined ? raioInterno : 1;
    return { x: Math.cos(angulo) * raio, y: Math.sin(angulo) * raio };
  });
  return ajustarNaCaixa(pontos);
}

function limitar(valor: number, min: number, max: number, padrao: number) {
  return Math.min(max, Math.max(min, Number.isFinite(valor) ? valor : padrao));
}

function estrela(w: number, h: number, parametros: ParametrosForma, pontas?: number) {
  const numeroDePontas = pontas ?? Math.round(limitar(parametros.pontas, 3, 24, 5));
  const raio = limitar(parametros.raioInterno, 10, 90, 45) / 100;
  return caminhoDosPontos(w, h, radial(numeroDePontas, raio), true);
}

const linha = [
  { x: 0, y: 1 },
  { x: 1, y: 0 },
];
const curva = [
  { x: 0, y: 0.8 },
  { x: 1, y: 0.2 },
  { x: 0.18, y: -0.5 },
  { x: 0.82, y: 1.5 },
];
const poligono = [
  { x: 0, y: 0.3 },
  { x: 0.36, y: 0 },
  { x: 0.92, y: 0.15 },
  { x: 1, y: 0.71 },
  { x: 0.56, y: 1 },
  { x: 0.12, y: 0.78 },
];

function caminhoDaCurva(w: number, h: number, pontos: readonly Point[]) {
  const [inicio, fim, primeiro, segundo] = pontos;
  const caminho = new Path2D();
  if (!inicio || !fim) return caminho;
  caminho.moveTo(inicio.x * w, inicio.y * h);
  if (primeiro && segundo) {
    caminho.bezierCurveTo(
      primeiro.x * w,
      primeiro.y * h,
      segundo.x * w,
      segundo.y * h,
      fim.x * w,
      fim.y * h,
    );
  } else if (primeiro) {
    caminho.quadraticCurveTo(primeiro.x * w, primeiro.y * h, fim.x * w, fim.y * h);
  } else caminho.lineTo(fim.x * w, fim.y * h);
  return caminho;
}

function espiral(w: number, h: number) {
  const pontos = Array.from({ length: 160 }, (_, i) => {
    const proporcao = i / 159;
    const angulo = proporcao * Math.PI * 5.5;
    return { x: Math.cos(angulo) * proporcao, y: Math.sin(angulo) * proporcao };
  });
  return caminhoDosPontos(w, h, ajustarNaCaixa(pontos), false);
}

export const FORMAS: readonly ShapeDef[] = [
  {
    id: 'line',
    nome: 'Linha',
    categoria: 'basicas',
    fechada: false,
    path: (w, h, _p, pontos = linha) => caminhoDosPontos(w, h, pontos, false),
  },
  {
    id: 'curve',
    nome: 'Curva',
    categoria: 'basicas',
    fechada: false,
    path: (w, h, _p, pontos = curva) => caminhoDaCurva(w, h, pontos),
  },
  { id: 'ellipse', nome: 'Elipse', categoria: 'basicas', fechada: true, path: ELLIPSE },
  {
    id: 'rectangle',
    nome: 'Retângulo',
    categoria: 'basicas',
    fechada: true,
    path: 'M0 0 H1 V1 H0Z',
  },
  {
    id: 'retangulo-arredondado',
    nome: 'Retângulo arredondado',
    categoria: 'basicas',
    fechada: true,
    path: 'M.19 0 H.81 Q1 0 1 .19 V.81 Q1 1 .81 1 H.19 Q0 1 0 .81 V.19 Q0 0 .19 0Z',
  },
  {
    id: 'polygon',
    nome: 'Polígono livre',
    categoria: 'basicas',
    fechada: true,
    path: (w, h, _p, pontos = poligono, aberta) => caminhoDosPontos(w, h, pontos, !aberta),
  },
  {
    id: 'triangulo',
    nome: 'Triângulo',
    categoria: 'basicas',
    fechada: true,
    path: 'M.5 0 L1 1 H0Z',
  },
  {
    id: 'triangulo-retangulo',
    nome: 'Triângulo retângulo',
    categoria: 'basicas',
    fechada: true,
    path: 'M0 0 L1 1 H0Z',
  },
  {
    id: 'losango',
    nome: 'Losango',
    categoria: 'basicas',
    fechada: true,
    path: 'M.5 0 L1 .5 .5 1 0 .5Z',
  },
  {
    id: 'pentagono',
    nome: 'Pentágono',
    categoria: 'basicas',
    fechada: true,
    path: (w, h) => caminhoDosPontos(w, h, radial(5), true),
  },
  {
    id: 'hexagono',
    nome: 'Hexágono',
    categoria: 'basicas',
    fechada: true,
    path: (w, h) => caminhoDosPontos(w, h, radial(6, undefined, Math.PI / 6), true),
  },
  {
    id: 'octogono',
    nome: 'Octógono',
    categoria: 'basicas',
    fechada: true,
    path: (w, h) => caminhoDosPontos(w, h, radial(8, undefined, Math.PI / 8), true),
  },
  {
    id: 'trapezio',
    nome: 'Trapézio',
    categoria: 'basicas',
    fechada: true,
    path: 'M.24 0 H.76 L1 1 H0Z',
  },
  {
    id: 'paralelogramo',
    nome: 'Paralelogramo',
    categoria: 'basicas',
    fechada: true,
    path: 'M.26 0 H1 L.74 1 H0Z',
  },
  {
    id: 'cruz',
    nome: 'Cruz',
    categoria: 'basicas',
    fechada: true,
    path: 'M.34 0 H.66 V.34 H1 V.66 H.66 V1 H.34 V.66 H0 V.34 H.34Z',
  },
  {
    id: 'anel',
    nome: 'Anel',
    categoria: 'basicas',
    fechada: true,
    path: `${ELLIPSE} M.5 .24 A.26 .26 0 1 1 .5 .76 A.26 .26 0 1 1 .5 .24Z`,
  },
  {
    id: 'meia-lua',
    nome: 'Meia-lua',
    categoria: 'basicas',
    fechada: true,
    path: 'M.87 .03 C.3 0 0 .24 0 .51 C0 .86 .4 1 .92 .96 C.51 .87 .36 .67 .36 .46 C.36 .26 .54 .1 .87 .03Z',
  },
  {
    id: 'gota',
    nome: 'Gota',
    categoria: 'basicas',
    fechada: true,
    path: 'M.5 0 C.58 .26 1 .47 1 .64 C1 .84 .78 1 .5 1 C.22 1 0 .84 0 .64 C0 .47 .42 .26 .5 0Z',
  },
  { id: 'nuvem', nome: 'Nuvem', categoria: 'basicas', fechada: true, path: NUVEM },
  {
    id: 'seta-direita',
    nome: 'Seta à direita',
    categoria: 'setas',
    fechada: true,
    path: 'M0 .32 H.6 V0 L1 .5 .6 1 V.68 H0Z',
  },
  {
    id: 'seta-esquerda',
    nome: 'Seta à esquerda',
    categoria: 'setas',
    fechada: true,
    path: 'M1 .32 H.4 V0 L0 .5 .4 1 V.68 H1Z',
  },
  {
    id: 'seta-cima',
    nome: 'Seta para cima',
    categoria: 'setas',
    fechada: true,
    path: 'M.32 1 V.4 H0 L.5 0 1 .4 H.68 V1Z',
  },
  {
    id: 'seta-baixo',
    nome: 'Seta para baixo',
    categoria: 'setas',
    fechada: true,
    path: 'M.32 0 V.6 H0 L.5 1 1 .6 H.68 V0Z',
  },
  {
    id: 'seta-dupla-horizontal',
    nome: 'Seta dupla horizontal',
    categoria: 'setas',
    fechada: true,
    path: 'M0 .5 L.28 0 V.33 H.72 V0 L1 .5 .72 1 V.67 H.28 V1Z',
  },
  {
    id: 'seta-dupla-vertical',
    nome: 'Seta dupla vertical',
    categoria: 'setas',
    fechada: true,
    path: 'M.5 0 L1 .28 H.67 V.72 H1 L.5 1 0 .72 H.33 V.28 H0Z',
  },
  {
    id: 'seta-curva',
    nome: 'Seta curva',
    categoria: 'setas',
    fechada: true,
    path: 'M0 1 C0 .46 .16 .19 .58 .19 V0 L1 .36 .58 .72 V.52 C.34 .52 .31 .67 .31 1Z',
  },
  {
    id: 'estrela-4',
    nome: 'Estrela de 4 pontas',
    categoria: 'estrelas',
    fechada: true,
    path: (w, h, p) => estrela(w, h, p, 4),
  },
  {
    id: 'estrela-5',
    nome: 'Estrela de 5 pontas',
    categoria: 'estrelas',
    fechada: true,
    path: (w, h, p) => estrela(w, h, p, 5),
  },
  {
    id: 'estrela-6',
    nome: 'Estrela de 6 pontas',
    categoria: 'estrelas',
    fechada: true,
    path: (w, h, p) => estrela(w, h, p, 6),
  },
  {
    id: 'estrela-n',
    nome: 'Estrela de N pontas',
    categoria: 'estrelas',
    fechada: true,
    path: (w, h, p) => estrela(w, h, p),
    params: {
      pontas: { rotulo: 'Pontas', min: 3, max: 24 },
      raioInterno: { rotulo: 'Raio interno (%)', min: 10, max: 90 },
    },
  },
  {
    id: 'balao-retangular',
    nome: 'Balão retangular',
    categoria: 'baloes',
    fechada: true,
    path: 'M.16 0 H.84 Q1 0 1 .17 V.6 Q1 .77 .84 .77 H.48 L.19 1 .25 .77 H.16 Q0 .77 0 .6 V.17 Q0 0 .16 0Z',
  },
  {
    id: 'balao-oval',
    nome: 'Balão oval',
    categoria: 'baloes',
    fechada: true,
    path: 'M.5 0 C.78 0 1 .17 1 .4 C1 .62 .77 .8 .5 .8 L.16 1 .23 .72 C.09 .65 0 .53 0 .4 C0 .17 .22 0 .5 0Z',
  },
  {
    id: 'balao-pensamento',
    nome: 'Balão de pensamento',
    categoria: 'baloes',
    fechada: true,
    path: 'M.17 .67 C.04 .69 0 .58 .02 .46 C.03 .34 .1 .27 .19 .27 C.21 .13 .34 .06 .45 .13 C.55 0 .7 .05 .77 .16 C.94 .15 1 .27 .99 .43 C1 .56 .93 .62 .83 .63 C.76 .81 .61 .85 .5 .72 C.37 .83 .24 .79 .17 .67Z M.25 .76 A.067 .061 0 1 1 .25 .882 A.067 .061 0 1 1 .25 .76Z M.14 .9 A.045 .05 0 1 1 .14 1 A.045 .05 0 1 1 .14 .9Z',
  },
  {
    id: 'coracao',
    nome: 'Coração',
    categoria: 'simbolos',
    fechada: true,
    path: 'M.5 1 C.42 .87 0 .62 0 .31 C0 .04 .29 0 .5 .17 C.71 0 1 .04 1 .31 C1 .62 .58 .87 .5 1Z',
  },
  {
    id: 'raio',
    nome: 'Raio',
    categoria: 'simbolos',
    fechada: true,
    path: 'M.51 0 H.88 L.61 .4 H1 L.28 1 .44 .56 H0Z',
  },
  {
    id: 'poligono-regular',
    nome: 'Polígono regular',
    categoria: 'simbolos',
    fechada: true,
    path: (w, h, p) => caminhoDosPontos(w, h, radial(Math.round(limitar(p.lados, 3, 24, 6))), true),
    params: { lados: { rotulo: 'Lados', min: 3, max: 24 } },
  },
  { id: 'espiral', nome: 'Espiral', categoria: 'simbolos', fechada: false, path: espiral },
];

const indice = new Map<FormaId, ShapeDef>(FORMAS.map((forma) => [forma.id, forma]));

export function obterForma(id: FormaId): ShapeDef {
  const forma = indice.get(id);
  if (!forma) throw new Error(`Forma desconhecida: ${id}`);
  return forma;
}
