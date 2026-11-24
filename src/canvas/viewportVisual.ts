import type { RefObject } from 'react';
import type { Rect } from '../layers/types';

export interface PropsViewportVisual {
  viewport: RefObject<HTMLDivElement | null>;
  tela: RefObject<HTMLCanvasElement | null>;
  zoom: number;
  largura: number;
  altura: number;
}

export function medirViewport(viewport: HTMLElement, tela: HTMLCanvasElement) {
  const moldura = viewport.getBoundingClientRect();
  const papel = tela.getBoundingClientRect();
  const esquerda = moldura.left + viewport.clientLeft;
  const topo = moldura.top + viewport.clientTop;
  return {
    esquerda,
    topo,
    papelX: papel.left - esquerda,
    papelY: papel.top - topo,
    width: viewport.clientWidth,
    height: viewport.clientHeight,
  };
}

export function areaVisivel(
  quadro: ReturnType<typeof medirViewport>,
  zoom: number,
  largura: number,
  altura: number,
): Rect {
  const limitar = (n: number, max: number) => Math.min(max, Math.max(0, n));
  const x = limitar(-quadro.papelX / zoom, largura);
  const y = limitar(-quadro.papelY / zoom, altura);
  return {
    x,
    y,
    width: limitar((quadro.width - quadro.papelX) / zoom, largura) - x,
    height: limitar((quadro.height - quadro.papelY) / zoom, altura) - y,
  };
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
