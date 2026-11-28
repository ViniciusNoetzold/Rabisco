import type { EstiloTraco } from '../commands/comandos';
import type { PixelBuffer, Point, Rect } from '../layers/types';

type CorRgba = [number, number, number, number];

/** Aceita as notações CSS hexadecimais RGB e RGBA, curtas ou completas. */
export function parseHexColor(hex: string): CorRgba {
  let value = hex.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    throw new Error('Cor hexadecimal inválida.');
  }
  if (value.length <= 4) value = [...value].map((digit) => digit + digit).join('');
  if (value.length === 6) value += 'ff';
  return [0, 2, 4, 6].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  ) as CorRgba;
}

function faixaDeTolerancia(valor: number): number {
  return Number.isFinite(valor) ? Math.max(0, Math.min(255, valor)) : 0;
}

export function toleranciaEmCanais(porcentagem: number): number {
  return Math.floor(faixaDeTolerancia((porcentagem * 255) / 100));
}

function corProxima(
  dados: Uint8ClampedArray,
  offset: number,
  alvo: CorRgba,
  limite: number,
): boolean {
  return (
    Math.abs(dados[offset] - alvo[0]) <= limite &&
    Math.abs(dados[offset + 1] - alvo[1]) <= limite &&
    Math.abs(dados[offset + 2] - alvo[2]) <= limite &&
    Math.abs(dados[offset + 3] - alvo[3]) <= limite
  );
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
  cor: CorRgba;
}

/** Encontra os pixels conectados ou da imagem inteira sem modificar a camada. */
export function planejarPreenchimento(
  image: PixelBuffer,
  x: number,
  y: number,
  color: string | null,
  tolerance = 0,
  global = false,
): PlanoPreenchimento | null {
  x = Math.floor(x);
  y = Math.floor(y);
  const { width, height, data } = image;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= width || y >= height) {
    return null;
  }
  // Sem cor (varinha mágica): só a máscara, sem pular os pixels que já têm a cor.
  const replacement = color === null ? null : parseHexColor(color);
  const initial = (y * width + x) * 4;
  const target: CorRgba = [data[initial], data[initial + 1], data[initial + 2], data[initial + 3]];
  const limit = faixaDeTolerancia(tolerance);
  // Um balde da mesma cor é uma operação vazia quando não há tolerância.
  if (replacement && limit === 0 && corProxima(data, initial, replacement, 0)) return null;

  const visited = new Uint8Array(width * height);
  const matches = (pixel: number) => !visited[pixel] && corProxima(data, pixel * 4, target, limit);
  let esquerda = width;
  let direita = -1;
  let topo = height;
  let base = -1;
  function marcar(pixel: number, coluna: number, linha: number) {
    visited[pixel] = 1;
    if (!replacement || !corProxima(data, pixel * 4, replacement, 0)) {
      esquerda = Math.min(esquerda, coluna);
      direita = Math.max(direita, coluna);
      topo = Math.min(topo, linha);
      base = Math.max(base, linha);
    }
  }
  if (global) {
    for (let linha = 0; linha < height; linha++) {
      for (let coluna = 0; coluna < width; coluna++) {
        const pixel = linha * width + coluna;
        if (corProxima(data, pixel * 4, target, limit)) marcar(pixel, coluna, linha);
      }
    }
  } else {
    const stack: number[] = [y * width + x];
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
        marcar(current, column, row);
        const hasAbove = row > 0 && matches(current - width);
        const hasBelow = row + 1 < height && matches(current + width);
        if (hasAbove && !above) stack.push(current - width);
        if (hasBelow && !below) stack.push(current + width);
        above = hasAbove;
        below = hasBelow;
      }
    }
  }
  if (direita < 0) return null;
  return {
    area: { x: esquerda, y: topo, width: direita - esquerda + 1, height: base - topo + 1 },
    largura: width,
    mascara: visited,
    cor: replacement ?? [0, 0, 0, 0],
  };
}

/** Varinha mágica: os pixels da cor clicada (contíguos ou de toda a imagem). */
export function mascaraPorCor(
  image: PixelBuffer,
  x: number,
  y: number,
  tolerance = 0,
  global = false,
): Uint8Array | null {
  return planejarPreenchimento(image, x, y, null, tolerance, global)?.mascara ?? null;
}

/** Aplica a parte do plano que cruza o recorte, em coordenadas do documento. */
export function aplicarPreenchimento(
  image: PixelBuffer,
  plano: PlanoPreenchimento,
  origem: Point,
): void {
  const { area, mascara, largura, cor } = plano;
  const esquerda = Math.max(area.x, origem.x);
  const direita = Math.min(area.x + area.width, origem.x + image.width);
  const topo = Math.max(area.y, origem.y);
  const fundo = Math.min(area.y + area.height, origem.y + image.height);
  for (let y = topo; y < fundo; y++) {
    let destino = ((y - origem.y) * image.width + esquerda - origem.x) * 4;
    const linha = y * largura;
    for (let x = esquerda; x < direita; x++, destino += 4) {
      if (!mascara[linha + x]) continue;
      image.data[destino] = cor[0];
      image.data[destino + 1] = cor[1];
      image.data[destino + 2] = cor[2];
      image.data[destino + 3] = cor[3];
    }
  }
}

/** Bloqueio de transparência: preserva o alfa e os pixels completamente transparentes. */
export function preservarAlfa(antes: PixelBuffer, depois: PixelBuffer): PixelBuffer {
  const resultado = { ...depois, data: new Uint8ClampedArray(depois.data) };
  for (let i = 0; i < resultado.data.length; i += 4) {
    const alfa = antes.data[i + 3];
    if (!alfa) {
      resultado.data[i] = antes.data[i];
      resultado.data[i + 1] = antes.data[i + 1];
      resultado.data[i + 2] = antes.data[i + 2];
    }
    resultado.data[i + 3] = alfa;
  }
  return resultado;
}

/** Preenche por segmentos horizontais sem recursão e sem atravessar diagonais. */
export function floodFill(
  image: PixelBuffer,
  x: number,
  y: number,
  color: string,
  tolerance = 0,
  global = false,
): boolean {
  const plano = planejarPreenchimento(image, x, y, color, tolerance, global);
  if (!plano) return false;
  aplicarPreenchimento(image, plano, { x: 0, y: 0 });
  return true;
}

/** Troca a cor somente dentro do contorno arredondado de cada segmento. */
export function aplicarBorrachaDeCor(
  imagem: PixelBuffer,
  origem: Point,
  pontos: readonly Point[],
  estilo: EstiloTraco,
): void {
  if (!pontos.length || !estilo.substituirCor) return;
  const alvo = parseHexColor(estilo.substituirCor);
  const substituta = parseHexColor(estilo.cor);
  const tolerancia = faixaDeTolerancia(estilo.toleranciaSubstituicao ?? 0);
  const raio = Math.max(1, estilo.espessura) / 2;
  const raioAoQuadrado = raio * raio;
  const { data, width, height } = imagem;
  let anterior = pontos[0];

  for (const ponto of pontos) {
    const dx = ponto.x - anterior.x;
    const dy = ponto.y - anterior.y;
    const comprimento = dx * dx + dy * dy;
    const cima = Math.max(origem.y, Math.floor(Math.min(ponto.y, anterior.y) - raio));
    const base = Math.min(origem.y + height, Math.ceil(Math.max(ponto.y, anterior.y) + raio));
    const esquerda = Math.max(origem.x, Math.floor(Math.min(ponto.x, anterior.x) - raio));
    const direita = Math.min(origem.x + width, Math.ceil(Math.max(ponto.x, anterior.x) + raio));

    for (let y = cima; y < base; y++) {
      const py = y + 0.5 - anterior.y;
      // Limita a busca a uma faixa em torno da linha, inclusive em diagonais longas.
      const tA = dy === 0 ? 0 : (py - raio) / dy;
      const tB = dy === 0 ? 1 : (py + raio) / dy;
      const tMin = Math.max(0, Math.min(1, Math.min(tA, tB)));
      const tMax = Math.max(0, Math.min(1, Math.max(tA, tB)));
      const xA = anterior.x + dx * tMin;
      const xB = anterior.x + dx * tMax;
      const inicio = Math.max(esquerda, Math.floor(Math.min(xA, xB) - raio));
      const fim = Math.min(direita, Math.ceil(Math.max(xA, xB) + raio));
      let offset = ((y - origem.y) * width + inicio - origem.x) * 4;

      for (let x = inicio; x < fim; x++, offset += 4) {
        if (!corProxima(data, offset, alvo, tolerancia)) continue;
        const px = x + 0.5 - anterior.x;
        const t =
          comprimento === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / comprimento));
        const distanciaX = px - dx * t;
        const distanciaY = py - dy * t;
        if (distanciaX * distanciaX + distanciaY * distanciaY <= raioAoQuadrado) {
          data.set(substituta, offset);
        }
      }
    }
    anterior = ponto;
  }
}
