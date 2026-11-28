import type { PixelBuffer } from '../layers/types';
import {
  acumularErro,
  aplicarPaleta,
  corMaisProxima,
  paletaDoDesenho,
  type CorPaleta,
} from './pixelArt';

export const OPCOES_DITHERING = [
  { valor: 'floyd-steinberg', nome: 'Floyd–Steinberg' },
  { valor: 'atkinson', nome: 'Atkinson' },
  { valor: 'bayer-2', nome: 'Bayer 2 × 2' },
  { valor: 'bayer-4', nome: 'Bayer 4 × 4' },
  { valor: 'bayer-8', nome: 'Bayer 8 × 8' },
] as const;

export const OPCOES_PALETA_DITHERING = [
  { valor: 'cinza', nome: 'Tons de cinza' },
  { valor: 'desenho', nome: 'Paleta do desenho' },
] as const;

type SelecaoBayer = Extract<(typeof OPCOES_DITHERING)[number]['valor'], `bayer-${number}`>;

function matrizBayer(tamanho: number): number[] {
  const quadrantes = [0, 2, 3, 1];
  let anterior = [0];
  for (let lado = 1; lado < tamanho; lado *= 2) {
    const ladoExpandido = lado * 2;
    anterior = Array.from({ length: ladoExpandido * ladoExpandido }, (_, i) => {
      const x = i % ladoExpandido;
      const y = Math.floor(i / ladoExpandido);
      const quadrante = Math.floor(y / lado) * 2 + Math.floor(x / lado);
      return anterior[(y % lado) * lado + (x % lado)] * 4 + quadrantes[quadrante];
    });
  }
  return anterior;
}

const MATRIZES_BAYER: Record<SelecaoBayer, { tamanho: number; matriz: number[] }> = {
  'bayer-2': { tamanho: 2, matriz: matrizBayer(2) },
  'bayer-4': { tamanho: 4, matriz: matrizBayer(4) },
  'bayer-8': { tamanho: 8, matriz: matrizBayer(8) },
};

function paletaCinza(total: number): CorPaleta[] {
  return Array.from({ length: total }, (_, i) => {
    const cinza = Math.round((255 * i) / (total - 1));
    return [cinza, cinza, cinza];
  });
}

function atkinson(pixels: PixelBuffer, paleta: readonly CorPaleta[]): PixelBuffer {
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  let erros = new Float32Array((width + 4) * 3);
  let seguintes = new Float32Array(erros.length);
  let posteriores = new Float32Array(erros.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alfa = data[i + 3];
      if (alfa === 0) continue;
      const posicao = (x + 2) * 3;
      const r = Math.max(0, Math.min(255, data[i] + erros[posicao]));
      const g = Math.max(0, Math.min(255, data[i + 1] + erros[posicao + 1]));
      const b = Math.max(0, Math.min(255, data[i + 2] + erros[posicao + 2]));
      const cor = corMaisProxima(r, g, b, paleta);
      saida[i] = cor[0];
      saida[i + 1] = cor[1];
      saida[i + 2] = cor[2];
      const dr = r - cor[0];
      const dg = g - cor[1];
      const db = b - cor[2];
      const peso = alfa / (255 * 8);
      acumularErro(erros, posicao + 3, dr, dg, db, peso);
      acumularErro(erros, posicao + 6, dr, dg, db, peso);
      acumularErro(seguintes, posicao - 3, dr, dg, db, peso);
      acumularErro(seguintes, posicao, dr, dg, db, peso);
      acumularErro(seguintes, posicao + 3, dr, dg, db, peso);
      acumularErro(posteriores, posicao, dr, dg, db, peso);
    }
    erros.fill(0);
    [erros, seguintes, posteriores] = [seguintes, posteriores, erros];
  }
  return { width, height, data: saida };
}

/** Projeta o pixel no segmento entre suas duas cores mais próximas na paleta. */
function corOrdenada(
  r: number,
  g: number,
  b: number,
  paleta: readonly CorPaleta[],
  limiar: number,
): CorPaleta {
  let primeira = 0;
  let segunda = 1;
  let menorDistancia = Infinity;
  let outraDistancia = Infinity;
  for (let i = 0; i < paleta.length; i++) {
    const [vermelho, verde, azul] = paleta[i];
    const dr = r - vermelho;
    const dg = g - verde;
    const db = b - azul;
    const distancia = dr * dr + dg * dg + db * db;
    if (distancia === 0) return paleta[i];
    if (distancia < menorDistancia) {
      outraDistancia = menorDistancia;
      segunda = primeira;
      menorDistancia = distancia;
      primeira = i;
    } else if (distancia < outraDistancia) {
      outraDistancia = distancia;
      segunda = i;
    }
  }

  const partida = paleta[Math.min(primeira, segunda)];
  const chegada = paleta[Math.max(primeira, segunda)];
  const dr = chegada[0] - partida[0];
  const dg = chegada[1] - partida[1];
  const db = chegada[2] - partida[2];
  const projecao = (r - partida[0]) * dr + (g - partida[1]) * dg + (b - partida[2]) * db;
  const limite = limiar * (dr * dr + dg * dg + db * db);
  return projecao > limite ? chegada : partida;
}

function bayer(
  pixels: PixelBuffer,
  paleta: readonly CorPaleta[],
  { matriz, tamanho }: (typeof MATRIZES_BAYER)[SelecaoBayer],
): PixelBuffer {
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    const linha = (y % tamanho) * tamanho;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const limiar = (matriz[linha + (x % tamanho)] + 0.5) / matriz.length;
      const cor = corOrdenada(data[i], data[i + 1], data[i + 2], paleta, limiar);
      saida[i] = cor[0];
      saida[i + 1] = cor[1];
      saida[i + 2] = cor[2];
    }
  }
  return { width, height, data: saida };
}

export function dithering(
  pixels: PixelBuffer,
  parametros: Readonly<Record<string, unknown>>,
): PixelBuffer {
  const total =
    typeof parametros.cores === 'number' && Number.isFinite(parametros.cores)
      ? Math.max(2, Math.min(16, Math.round(parametros.cores)))
      : 2;
  const paleta =
    parametros.paleta === 'desenho' ? paletaDoDesenho(pixels, total) : paletaCinza(total);
  if (paleta.length < 2) return aplicarPaleta(pixels, paleta);
  const { algoritmo } = parametros;
  if (algoritmo === 'atkinson') return atkinson(pixels, paleta);
  if (typeof algoritmo === 'string' && Object.hasOwn(MATRIZES_BAYER, algoritmo)) {
    return bayer(pixels, paleta, MATRIZES_BAYER[algoritmo as SelecaoBayer]);
  }
  return aplicarPaleta(pixels, paleta, true);
}
