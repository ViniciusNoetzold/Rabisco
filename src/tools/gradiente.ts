import { caminhoDaSelecao, type MascaraSelecao } from '../document/selecao';
import type { Point, Rect } from '../layers/types';

export type FormaGradiente = 'linear' | 'radial';

/** Parâmetros do gradiente, guardados no comando (o JSON refaz o mesmo gradiente). */
export interface ConfigGradiente {
  forma: FormaGradiente;
  inicio: Point;
  fim: Point;
  cor1: string;
  cor2: string;
  /** Vai da Cor 1 até transparente (a Cor 2 não entra). */
  transparente?: boolean;
  /** Só dentro da seleção, quando há uma. */
  recorte?: { area: Rect; mascara?: MascaraSelecao };
}

/**
 * Quanto do caminho Cor 1 → Cor 2 o ponto está, de 0 a 1. Linear: projeção na reta do início ao
 * fim. Radial: distância ao início dividida pelo raio (início → fim).
 */
export function fatorDoGradiente(
  forma: FormaGradiente,
  inicio: Point,
  fim: Point,
  ponto: Point,
): number {
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const quadrado = dx * dx + dy * dy;
  if (!quadrado) return 0;
  const t =
    forma === 'linear'
      ? ((ponto.x - inicio.x) * dx + (ponto.y - inicio.y) * dy) / quadrado
      : Math.hypot(ponto.x - inicio.x, ponto.y - inicio.y) / Math.sqrt(quadrado);
  return Math.max(0, Math.min(1, t));
}

function canais(cor: string): [number, number, number, number] {
  const hex = cor.replace('#', '');
  const valor = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return [valor(0), valor(2), valor(4), hex.length >= 8 ? valor(6) / 255 : 1];
}

/** A cor (r, g, b, alfa 0–1) no fator t, como o canvas mistura as duas paradas. */
export function corNoGradiente(
  cor1: string,
  cor2: string,
  t: number,
  transparente = false,
): [number, number, number, number] {
  const a = canais(cor1);
  const b = transparente ? ([a[0], a[1], a[2], 0] as const) : canais(cor2);
  const misturar = (i: number) => a[i] + (b[i] - a[i]) * t;
  return [
    Math.round(misturar(0)),
    Math.round(misturar(1)),
    Math.round(misturar(2)),
    Math.round(misturar(3) * 1000) / 1000,
  ];
}

/** A área que o gradiente pinta: a seleção, ou o papel inteiro. */
export function areaDoGradiente(config: ConfigGradiente, largura: number, altura: number): Rect {
  return config.recorte?.area ?? { x: 0, y: 0, width: largura, height: altura };
}

/** Pinta o gradiente (na camada, pelo executor, ou na prévia). */
export function desenharGradiente(
  grafico: CanvasRenderingContext2D,
  config: ConfigGradiente,
  area: Rect,
) {
  const { forma, inicio, fim, cor1, cor2, transparente, recorte } = config;
  const gradiente =
    forma === 'linear'
      ? grafico.createLinearGradient(inicio.x, inicio.y, fim.x, fim.y)
      : grafico.createRadialGradient(
          inicio.x,
          inicio.y,
          0,
          inicio.x,
          inicio.y,
          Math.max(0.5, Math.hypot(fim.x - inicio.x, fim.y - inicio.y)),
        );
  const [r, g, b] = canais(cor1);
  gradiente.addColorStop(0, cor1);
  gradiente.addColorStop(1, transparente ? `rgba(${r}, ${g}, ${b}, 0)` : cor2);
  grafico.save();
  try {
    if (recorte) grafico.clip(caminhoDaSelecao(recorte.area, recorte.mascara), 'evenodd');
    grafico.fillStyle = gradiente;
    grafico.fillRect(area.x, area.y, area.width, area.height);
  } finally {
    grafico.restore();
  }
}
