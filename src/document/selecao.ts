import type { PixelBuffer, Point, Rect } from '../layers/types';
import { recortarPixels } from '../commands/history';
import { parseHexColor } from '../tools/pixels';
import { comoImageData } from './model';

/** O contorno usa coordenadas do papel. A inversão seleciona o exterior. */
export interface MascaraSelecao {
  contorno: Point[];
  inversa?: boolean;
}

export interface RecorteFlutuante {
  imagem: HTMLCanvasElement;
  corte: HTMLCanvasElement | null;
}

function superficie(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently: true })!;
}

export function contornoRetangular({ x, y, width, height }: Rect): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export function caminhoDaSelecao(area: Rect, mascara?: MascaraSelecao): Path2D {
  const caminho = new Path2D();
  if (!mascara || mascara.inversa) caminho.rect(area.x, area.y, area.width, area.height);
  if (mascara?.contorno.length) {
    const [primeiro, ...resto] = mascara.contorno;
    caminho.moveTo(primeiro.x, primeiro.y);
    for (const ponto of resto) caminho.lineTo(ponto.x, ponto.y);
    caminho.closePath();
  }
  return caminho;
}

export function pontoNaSelecao(area: Rect, ponto: Point, mascara?: MascaraSelecao): boolean {
  if (
    ponto.x < area.x ||
    ponto.y < area.y ||
    ponto.x >= area.x + area.width ||
    ponto.y >= area.y + area.height
  )
    return false;
  if (!mascara) return true;
  let dentro = false;
  const vertices = mascara.contorno;
  for (const [i, atual] of vertices.entries()) {
    const anterior = vertices.at(i - 1)!;
    if (atual.y > ponto.y === anterior.y > ponto.y) continue;
    const limite =
      atual.x + ((ponto.y - atual.y) * (anterior.x - atual.x)) / (anterior.y - atual.y);
    if (ponto.x < limite) dentro = !dentro;
  }
  return mascara.inversa ? !dentro : dentro;
}

export function prepararRecorte(
  papel: PixelBuffer,
  area: Rect,
  mascara?: MascaraSelecao,
  corTransparente?: string,
): RecorteFlutuante {
  const recorte = recortarPixels(papel, area);
  const imagem = superficie(area.width, area.height);
  let corte: CanvasRenderingContext2D | null = null;
  if (corTransparente || mascara) {
    corte = superficie(area.width, area.height);
    corte.translate(-area.x, -area.y);
    corte.fill(caminhoDaSelecao(area, mascara), 'evenodd');
    corte.resetTransform();
  }
  if (corTransparente && corte) {
    const [r, g, b] = parseHexColor(corTransparente);
    const cobertura = corte.getImageData(0, 0, area.width, area.height);
    const { data } = recorte;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === r && data[i + 1] === g && data[i + 2] === b) cobertura.data[i + 3] = 0;
    }
    corte.putImageData(cobertura, 0, 0);
  }
  imagem.putImageData(comoImageData(recorte), 0, 0);
  if (corte) {
    imagem.globalCompositeOperation = 'destination-in';
    imagem.drawImage(corte.canvas, 0, 0);
  }
  return { imagem: imagem.canvas, corte: corte?.canvas ?? null };
}

export function pintarRecorte(
  ctx: CanvasRenderingContext2D,
  recorte: RecorteFlutuante,
  origem: Rect | null,
  destino: Rect,
) {
  ctx.save();
  try {
    if (origem && recorte.corte) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(recorte.corte, origem.x, origem.y);
      ctx.globalCompositeOperation = 'source-over';
    } else if (origem) {
      ctx.clearRect(origem.x, origem.y, origem.width, origem.height);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(recorte.imagem, destino.x, destino.y, destino.width, destino.height);
  } finally {
    ctx.restore();
  }
}

export function apagarRecorte(ctx: CanvasRenderingContext2D, area: Rect, mascara?: MascaraSelecao) {
  ctx.save();
  try {
    if (mascara) ctx.clip(caminhoDaSelecao(area, mascara), 'evenodd');
    ctx.clearRect(area.x, area.y, area.width, area.height);
  } finally {
    ctx.restore();
  }
}

export function projetarMascara(
  mascara: MascaraSelecao | undefined,
  origem: Rect,
  destino: Rect,
): MascaraSelecao | undefined {
  if (!mascara) return;
  return {
    inversa: mascara.inversa,
    contorno: mascara.contorno.map(({ x, y }) => ({
      x: destino.x + ((x - origem.x) * destino.width) / origem.width,
      y: destino.y + ((y - origem.y) * destino.height) / origem.height,
    })),
  };
}
