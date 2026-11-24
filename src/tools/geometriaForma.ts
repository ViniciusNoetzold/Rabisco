import type { Point, Rect } from '../layers/types';
import type { FormaId } from '../shapes/tipos';

export interface GeometriaForma {
  id: FormaId;
  caixa: Rect;
  rotacao: number;
  pontos?: Point[];
}

type Lado = -1 | 0 | 1;
export interface AlcaForma {
  x: Lado;
  y: Lado;
  posicao: Point;
}

const eixosAlcas = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
] as const;

export function centroDaCaixa(caixa: Rect): Point {
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 };
}

export function rotacionarPonto(ponto: Point, centro: Point, angulo: number): Point {
  const x = ponto.x - centro.x;
  const y = ponto.y - centro.y;
  const cos = Math.cos(angulo);
  const sin = Math.sin(angulo);
  return { x: centro.x + x * cos - y * sin, y: centro.y + x * sin + y * cos };
}

export function distanciaEntre(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function prenderEm45(origem: Point, ponto: Point): Point {
  const angulo = Math.atan2(ponto.y - origem.y, ponto.x - origem.x);
  const preso = (Math.round(angulo / (Math.PI / 4)) * Math.PI) / 4;
  const distancia = distanciaEntre(origem, ponto);
  return { x: origem.x + Math.cos(preso) * distancia, y: origem.y + Math.sin(preso) * distancia };
}

export function caixaDosPontos(pontos: readonly Point[]): Rect {
  let x = pontos[0].x;
  let y = pontos[0].y;
  let direita = x;
  let base = y;
  for (const ponto of pontos) {
    x = Math.min(x, ponto.x);
    y = Math.min(y, ponto.y);
    direita = Math.max(direita, ponto.x);
    base = Math.max(base, ponto.y);
  }
  return { x, y, width: Math.max(1, direita - x), height: Math.max(1, base - y) };
}

export function geometriaPorPontos(id: FormaId, pontos: readonly Point[]): GeometriaForma {
  const caixa = caixaDosPontos(pontos);
  return {
    id,
    caixa,
    rotacao: 0,
    pontos: pontos.map(({ x, y }) => ({
      x: (x - caixa.x) / caixa.width,
      y: (y - caixa.y) / caixa.height,
    })),
  };
}

export function geometriaDoArraste(
  id: FormaId,
  inicio: Point,
  fim: Point,
  restringir: boolean,
): GeometriaForma {
  if (id === 'line' || id === 'curve') {
    return geometriaPorPontos(id, [inicio, restringir ? prenderEm45(inicio, fim) : fim]);
  }
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const lado = Math.max(Math.abs(dx), Math.abs(dy));
  const extremo = restringir
    ? { x: inicio.x + Math.sign(dx || 1) * lado, y: inicio.y + Math.sign(dy || 1) * lado }
    : fim;
  return { id, caixa: caixaDosPontos([inicio, extremo]), rotacao: 0 };
}

export function pontosAbsolutos(forma: GeometriaForma): Point[] {
  const { caixa } = forma;
  return (forma.pontos ?? []).map(({ x, y }) => ({
    x: caixa.x + x * caixa.width,
    y: caixa.y + y * caixa.height,
  }));
}

export function alcasDeTamanho(forma: GeometriaForma): AlcaForma[] {
  const { caixa, rotacao } = forma;
  const centro = centroDaCaixa(caixa);
  return eixosAlcas.map(([x, y]) => ({
    x,
    y,
    posicao: rotacionarPonto(
      { x: centro.x + (x * caixa.width) / 2, y: centro.y + (y * caixa.height) / 2 },
      centro,
      rotacao,
    ),
  }));
}

export function alcaDeRotacao(
  forma: GeometriaForma,
  zoom: number,
  largura: number,
  altura: number,
): { base: Point; posicao: Point } {
  const centro = centroDaCaixa(forma.caixa);
  const alcas = alcasDeTamanho(forma);
  const afastamento = 26 / zoom;
  const raio = 7 / zoom;
  for (const indice of [1, 5, 3, 7]) {
    const { x, y, posicao: base } = alcas[indice];
    const posicao = rotacionarPonto(
      {
        x: centro.x + x * (forma.caixa.width / 2 + afastamento),
        y: centro.y + y * (forma.caixa.height / 2 + afastamento),
      },
      centro,
      forma.rotacao,
    );
    if (
      posicao.x >= raio &&
      posicao.x <= largura - raio &&
      posicao.y >= raio &&
      posicao.y <= altura - raio
    )
      return { base, posicao };
  }

  const base = alcas[1].posicao;
  // Em papéis ocupados por inteiro, deixa a rotação acessível por dentro da caixa.
  const interno = rotacionarPonto(
    { x: centro.x, y: forma.caixa.y + Math.min(afastamento, forma.caixa.height / 2) },
    centro,
    forma.rotacao,
  );
  return {
    base,
    posicao: {
      x: Math.max(0, Math.min(largura - 1, interno.x)),
      y: Math.max(0, Math.min(altura - 1, interno.y)),
    },
  };
}

export function dentroDaForma(forma: GeometriaForma, ponto: Point, tolerancia: number): boolean {
  const { caixa, rotacao } = forma;
  const local = rotacionarPonto(ponto, centroDaCaixa(caixa), -rotacao);
  return (
    local.x >= caixa.x - tolerancia &&
    local.x <= caixa.x + caixa.width + tolerancia &&
    local.y >= caixa.y - tolerancia &&
    local.y <= caixa.y + caixa.height + tolerancia
  );
}

export function moverForma(forma: GeometriaForma, inicio: Point, ponto: Point): GeometriaForma {
  return {
    ...forma,
    caixa: {
      ...forma.caixa,
      x: forma.caixa.x + ponto.x - inicio.x,
      y: forma.caixa.y + ponto.y - inicio.y,
    },
  };
}

export function girarForma(
  forma: GeometriaForma,
  inicio: Point,
  ponto: Point,
  prender: boolean,
): GeometriaForma {
  const centro = centroDaCaixa(forma.caixa);
  const angulo = ({ x, y }: Point) => Math.atan2(y - centro.y, x - centro.x);
  const delta = angulo(ponto) - angulo(inicio);
  let rotacao = forma.rotacao + delta;
  if (prender) rotacao = Math.round(rotacao / (Math.PI / 12)) * (Math.PI / 12);
  return { ...forma, rotacao: Math.atan2(Math.sin(rotacao), Math.cos(rotacao)) };
}

export function redimensionarForma(
  forma: GeometriaForma,
  alca: AlcaForma,
  inicio: Point,
  ponto: Point,
  manterProporcao: boolean,
): GeometriaForma {
  const { caixa, rotacao } = forma;
  const centro = centroDaCaixa(caixa);
  const primeiro = rotacionarPonto(inicio, centro, -rotacao);
  const ultimo = rotacionarPonto(ponto, centro, -rotacao);
  let largura = Math.max(1, caixa.width + alca.x * (ultimo.x - primeiro.x));
  let altura = Math.max(1, caixa.height + alca.y * (ultimo.y - primeiro.y));
  if (manterProporcao) {
    const fatorX = largura / caixa.width;
    const fatorY = altura / caixa.height;
    const dominante = Math.abs(fatorX - 1) >= Math.abs(fatorY - 1) ? fatorX : fatorY;
    const fator = Math.max(1 / caixa.width, 1 / caixa.height, dominante);
    largura = caixa.width * fator;
    altura = caixa.height * fator;
  }

  // Reposiciona o centro no espaço do documento para manter a alça oposta parada.
  const novoCentro = rotacionarPonto(
    {
      x: centro.x + (alca.x * (largura - caixa.width)) / 2,
      y: centro.y + (alca.y * (altura - caixa.height)) / 2,
    },
    centro,
    rotacao,
  );
  return {
    ...forma,
    caixa: {
      x: novoCentro.x - largura / 2,
      y: novoCentro.y - altura / 2,
      width: largura,
      height: altura,
    },
  };
}
