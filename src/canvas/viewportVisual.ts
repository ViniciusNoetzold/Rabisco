import type { RefObject } from 'react';
import type { Point } from '../layers/types';
import { deslocamentoNaTela, telaParaPapel, type Vista } from './vista';

export interface PropsViewportVisual {
  viewport: RefObject<HTMLDivElement | null>;
  tela: RefObject<HTMLCanvasElement | null>;
  zoom: number;
  largura: number;
  altura: number;
  vista: Vista;
}

interface QuadroViewport {
  esquerda: number;
  topo: number;
  width: number;
  height: number;
  papel: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
}

export function medirViewport(viewport: HTMLElement, tela: HTMLCanvasElement): QuadroViewport {
  const moldura = viewport.getBoundingClientRect();
  const esquerda = moldura.left + viewport.clientLeft;
  const topo = moldura.top + viewport.clientTop;
  return {
    esquerda,
    topo,
    papel: tela.getBoundingClientRect(),
    width: viewport.clientWidth,
    height: viewport.clientHeight,
  };
}

/** Projeta os eixos do papel, escolhendo o mais próximo de cada régua da tela. */
export function eixosDasReguas(zoom: number, largura: number, altura: number, vista: Vista) {
  const x = deslocamentoNaTela({ x: 1, y: 0 }, zoom, vista);
  const y = deslocamentoNaTela({ x: 0, y: 1 }, zoom, vista);
  const trocar = Math.abs(x.x) < Math.abs(y.x);
  return {
    topo: trocar
      ? { eixo: 'y' as const, total: altura, escala: y.x }
      : { eixo: 'x' as const, total: largura, escala: x.x },
    lateral: trocar
      ? { eixo: 'x' as const, total: largura, escala: x.y }
      : { eixo: 'y' as const, total: altura, escala: y.y },
  };
}

/** Recorta um polígono num semiplano e mantém as interseções na borda exata. */
function recortar(pontos: Point[], eixo: 'x' | 'y', limite: number, lado: 1 | -1): Point[] {
  const recorte: Point[] = [];
  for (let i = 0; i < pontos.length; i++) {
    const atual = pontos[i];
    const anterior = pontos[(i + pontos.length - 1) % pontos.length];
    const dentro = (atual[eixo] - limite) * lado >= 0;
    const anteriorDentro = (anterior[eixo] - limite) * lado >= 0;
    if (dentro !== anteriorDentro) {
      const t = (limite - anterior[eixo]) / (atual[eixo] - anterior[eixo]);
      const corte = {
        x: anterior.x + (atual.x - anterior.x) * t,
        y: anterior.y + (atual.y - anterior.y) * t,
      };
      corte[eixo] = limite;
      recorte.push(corte);
    }
    if (dentro) recorte.push(atual);
  }
  return recorte;
}

/** Quatro cantos da tela no papel, recortados ao desenho para a moldura da miniatura. */
export function poligonoVisivel(
  quadro: QuadroViewport,
  zoom: number,
  largura: number,
  altura: number,
  vista: Vista,
): Point[] {
  const { esquerda, topo, width, height, papel } = quadro;
  if (width <= 0 || height <= 0) return [];
  const direita = esquerda + width;
  const base = topo + height;
  let cantos = [
    { x: esquerda, y: topo },
    { x: direita, y: topo },
    { x: direita, y: base },
    { x: esquerda, y: base },
  ].map((ponto) => telaParaPapel(ponto, papel, largura, altura, zoom, vista));
  cantos = recortar(cantos, 'x', 0, 1);
  cantos = recortar(cantos, 'x', largura, -1);
  cantos = recortar(cantos, 'y', 0, 1);
  return recortar(cantos, 'y', altura, -1);
}

export function prepararTelaPequena(tela: HTMLCanvasElement, largura: number, altura: number) {
  const ctx = tela.getContext('2d');
  if (!ctx || !largura || !altura) return null;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const pixelsX = Math.round(largura * dpr);
  const pixelsY = Math.round(altura * dpr);
  if (tela.width !== pixelsX || tela.height !== pixelsY) {
    tela.width = pixelsX;
    tela.height = pixelsY;
  }
  ctx.setTransform(pixelsX / largura, 0, 0, pixelsY / altura, 0, 0);
  ctx.clearRect(0, 0, largura, altura);
  return ctx;
}
