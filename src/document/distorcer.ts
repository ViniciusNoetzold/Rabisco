import type { Point, Rect } from '../layers/types';

/** Cantos de destino na ordem: superior esquerdo, superior direito, inferior direito, inferior esquerdo. */
export type Cantos = [Point, Point, Point, Point];

type Imagem = CanvasImageSource & { width: number; height: number };

/** Ponto do quadrilátero por interpolação bilinear (u, v de 0 a 1). */
function bilinear([se, sd, id, ie]: Cantos, u: number, v: number): Point {
  const topo = { x: se.x + (sd.x - se.x) * u, y: se.y + (sd.y - se.y) * u };
  const base = { x: ie.x + (id.x - ie.x) * u, y: ie.y + (id.y - ie.y) * u };
  return { x: topo.x + (base.x - topo.x) * v, y: topo.y + (base.y - topo.y) * v };
}

/** Matriz afim que leva três pontos de origem aos três de destino (null se degenerado). */
function afim(
  [a, b, c]: [Point, Point, Point],
  [p, q, r]: [Point, Point, Point],
): [number, number, number, number, number, number] | null {
  const det = a.x * (b.y - c.y) - b.x * (a.y - c.y) + c.x * (a.y - b.y);
  if (Math.abs(det) < 1e-9) return null;
  const resolver = (u0: number, u1: number, u2: number) => [
    (u0 * (b.y - c.y) - u1 * (a.y - c.y) + u2 * (a.y - b.y)) / det,
    (a.x * (u1 - u2) - b.x * (u0 - u2) + c.x * (u0 - u1)) / det,
    (a.x * (b.y * u2 - c.y * u1) - b.x * (a.y * u2 - c.y * u0) + c.x * (a.y * u1 - b.y * u0)) / det,
  ];
  const [m11, m21, dx] = resolver(p.x, q.x, r.x);
  const [m12, m22, dy] = resolver(p.y, q.y, r.y);
  return [m11, m12, m21, m22, dx, dy];
}

/** Triângulo de destino um pouco maior, para não aparecerem frestas entre os triângulos. */
function triangulo(ctx: CanvasRenderingContext2D, [p, q, r]: [Point, Point, Point]) {
  const cx = (p.x + q.x + r.x) / 3;
  const cy = (p.y + q.y + r.y) / 3;
  const abrir = (ponto: Point) => {
    const dx = ponto.x - cx;
    const dy = ponto.y - cy;
    const comprimento = Math.hypot(dx, dy) || 1;
    return { x: ponto.x + (dx / comprimento) * 0.6, y: ponto.y + (dy / comprimento) * 0.6 };
  };
  const [a, b, c] = [abrir(p), abrir(q), abrir(r)];
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.closePath();
}

/**
 * Desenha `fonte` (o recorte da área `origem`) deformada para o quadrilátero `cantos`. O Canvas 2D só faz
 * transformações afins, então a imagem é dividida numa malha de triângulos, cada um com a sua.
 */
export function desenharDistorcido(
  ctx: CanvasRenderingContext2D,
  fonte: Imagem,
  origem: Rect,
  cantos: Cantos,
  divisoes = 16,
) {
  for (let j = 0; j < divisoes; j++) {
    for (let i = 0; i < divisoes; i++) {
      const u0 = i / divisoes;
      const u1 = (i + 1) / divisoes;
      const v0 = j / divisoes;
      const v1 = (j + 1) / divisoes;
      const s = (u: number, v: number) => ({
        x: origem.x + origem.width * u,
        y: origem.y + origem.height * v,
      });
      const d = (u: number, v: number) => bilinear(cantos, u, v);
      const metades: [[Point, Point, Point], [Point, Point, Point]][] = [
        [
          [s(u0, v0), s(u1, v0), s(u1, v1)],
          [d(u0, v0), d(u1, v0), d(u1, v1)],
        ],
        [
          [s(u0, v0), s(u1, v1), s(u0, v1)],
          [d(u0, v0), d(u1, v1), d(u0, v1)],
        ],
      ];
      for (const [de, para] of metades) {
        const matriz = afim(de, para);
        if (!matriz) continue;
        ctx.save();
        triangulo(ctx, para);
        ctx.clip();
        ctx.transform(...matriz);
        ctx.drawImage(fonte, origem.x, origem.y);
        ctx.restore();
      }
    }
  }
}
