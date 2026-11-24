import type { PixelBuffer, Point, Rect } from '../layers/types';

/** Aceita as notações CSS hexadecimais RGB e RGBA, curtas ou completas. */
export function parseHexColor(hex: string): [number, number, number, number] {
  let value = hex.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    throw new Error('Cor hexadecimal inválida.');
  }
  if (value.length <= 4) value = [...value].map((digit) => digit + digit).join('');
  if (value.length === 6) value += 'ff';
  return [0, 2, 4, 6].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
    number,
  ];
}

/** Normaliza a direção do gesto e limita a seleção às dimensões do documento. */
export function normalizeRect(
  start: Point,
  end: Point,
  bounds?: { width: number; height: number },
): Rect {
  const clampX = (value: number) => Math.max(0, Math.min(bounds?.width ?? Infinity, value));
  const clampY = (value: number) => Math.max(0, Math.min(bounds?.height ?? Infinity, value));
  const x = Math.floor(clampX(Math.min(start.x, end.x)));
  const y = Math.floor(clampY(Math.min(start.y, end.y)));
  const right = Math.ceil(clampX(Math.max(start.x, end.x)));
  const bottom = Math.ceil(clampY(Math.max(start.y, end.y)));
  return { x, y, width: right - x, height: bottom - y };
}

/** Apaga RGBA da seleção: transparência real, sem impor uma cor de fundo. */
export function clearRectPixels(image: PixelBuffer, rect: Rect): void {
  const clipped = normalizeRect(
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    image,
  );
  for (let y = clipped.y; y < clipped.y + clipped.height; y++) {
    const start = (y * image.width + clipped.x) * 4;
    image.data.fill(0, start, start + clipped.width * 4);
  }
}

interface PlanoPreenchimento {
  area: Rect;
  largura: number;
  mascara: Uint8Array;
  cor: [number, number, number, number];
}

/** Encontra a região conectada e os limites da alteração sem modificar a imagem. */
export function planejarPreenchimento(
  image: PixelBuffer,
  x: number,
  y: number,
  color: string,
  tolerance = 0,
): PlanoPreenchimento | null {
  x = Math.floor(x);
  y = Math.floor(y);
  const { width, height, data } = image;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= width || y >= height) {
    return null;
  }
  const replacement = parseHexColor(color);
  const initial = (y * width + x) * 4;
  const target = [data[initial], data[initial + 1], data[initial + 2], data[initial + 3]];
  const limit = Number.isFinite(tolerance) ? Math.max(0, Math.min(255, tolerance)) : 0;
  // Um balde da mesma cor é uma operação vazia quando não há tolerância.
  if (limit === 0 && target.every((channel, index) => channel === replacement[index])) return null;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [y * width + x];
  const matches = (pixel: number) => {
    if (visited[pixel]) return false;
    const offset = pixel * 4;
    for (let channel = 0; channel < 4; channel++) {
      if (Math.abs(data[offset + channel] - target[channel]) > limit) return false;
    }
    return true;
  };
  let esquerda = width;
  let direita = -1;
  let topo = height;
  let base = -1;
  while (stack.length) {
    const pixel = stack.pop()!;
    if (!matches(pixel)) continue;
    const row = Math.floor(pixel / width);
    let left = pixel % width;
    while (left > 0 && matches(row * width + left - 1)) left--;
    let above = false;
    let below = false;
    for (let column = left; column < width; column++) {
      const current = row * width + column;
      if (!matches(current)) break;
      visited[current] = 1;
      const offset = current * 4;
      if (
        data[offset] !== replacement[0] ||
        data[offset + 1] !== replacement[1] ||
        data[offset + 2] !== replacement[2] ||
        data[offset + 3] !== replacement[3]
      ) {
        esquerda = Math.min(esquerda, column);
        direita = Math.max(direita, column);
        topo = Math.min(topo, row);
        base = Math.max(base, row);
      }
      const hasAbove = row > 0 && matches(current - width);
      const hasBelow = row + 1 < height && matches(current + width);
      if (hasAbove && !above) stack.push(current - width);
      if (hasBelow && !below) stack.push(current + width);
      above = hasAbove;
      below = hasBelow;
    }
  }
  if (direita < 0) return null;
  return {
    area: { x: esquerda, y: topo, width: direita - esquerda + 1, height: base - topo + 1 },
    largura: width,
    mascara: visited,
    cor: replacement,
  };
}

/** Aplica o plano a um recorte, indicando sua origem em coordenadas do documento. */
export function aplicarPreenchimento(
  image: PixelBuffer,
  plano: PlanoPreenchimento,
  origem: Point,
): void {
  const { area, mascara, largura, cor } = plano;
  for (let y = area.y; y < area.y + area.height; y++) {
    let destino = ((y - origem.y) * image.width + area.x - origem.x) * 4;
    const linha = y * largura;
    for (let x = area.x; x < area.x + area.width; x++, destino += 4) {
      if (!mascara[linha + x]) continue;
      image.data[destino] = cor[0];
      image.data[destino + 1] = cor[1];
      image.data[destino + 2] = cor[2];
      image.data[destino + 3] = cor[3];
    }
  }
}

/** Preenche por segmentos horizontais sem recursão e sem atravessar diagonais. */
export function floodFill(
  image: PixelBuffer,
  x: number,
  y: number,
  color: string,
  tolerance = 0,
): boolean {
  const plano = planejarPreenchimento(image, x, y, color, tolerance);
  if (!plano) return false;
  aplicarPreenchimento(image, plano, { x: 0, y: 0 });
  return true;
}
