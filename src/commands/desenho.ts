import type { Point, Rect } from '../layers/types';
import type { ComandoForma, EstiloTraco } from './comandos';

type Contexto2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function larguraDoTraco(estilo: EstiloTraco): number {
  return estilo.ferramenta === 'pencil' ? 1 : estilo.espessura;
}

function areaEntre(a: Point, b: Point, margem: number): Rect {
  const x = Math.floor(Math.min(a.x, b.x) - margem);
  const y = Math.floor(Math.min(a.y, b.y) - margem);
  return {
    x,
    y,
    width: Math.ceil(Math.max(a.x, b.x) + margem) - x,
    height: Math.ceil(Math.max(a.y, b.y) + margem) - y,
  };
}

export function unirAreas(a: Rect | null, b: Rect): Rect {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export function limitarArea(area: Rect, tamanho: Pick<Rect, 'width' | 'height'>): Rect | null {
  const x = Math.max(0, Math.floor(area.x));
  const y = Math.max(0, Math.floor(area.y));
  const direita = Math.min(tamanho.width, Math.ceil(area.x + area.width));
  const base = Math.min(tamanho.height, Math.ceil(area.y + area.height));
  return direita > x && base > y ? { x, y, width: direita - x, height: base - y } : null;
}

export function areaDoSegmento(de: Point, ate: Point, estilo: EstiloTraco): Rect {
  // Um pixel além do raio cobre o antialias da pincelada e o ponto inicial.
  return areaEntre(de, ate, larguraDoTraco(estilo) / 2 + 1);
}

export function desenharSegmento(ctx: Contexto2D, de: Point, ate: Point, estilo: EstiloTraco) {
  ctx.save();
  ctx.lineWidth = larguraDoTraco(estilo);
  ctx.strokeStyle = estilo.cor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(de.x, de.y);
  ctx.lineTo(ate.x + 0.01, ate.y + 0.01);
  ctx.stroke();
  ctx.restore();
}

function dimensoesDaForma({ forma, inicio, fim, restringir }: ComandoForma) {
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  if (!restringir) return { dx, dy };
  if (forma === 'line') {
    const comprimento = Math.hypot(dx, dy);
    const angulo = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
    return { dx: Math.cos(angulo) * comprimento, dy: Math.sin(angulo) * comprimento };
  }
  const lado = Math.max(Math.abs(dx), Math.abs(dy));
  return { dx: Math.sign(dx || 1) * lado, dy: Math.sign(dy || 1) * lado };
}

export function areaDaForma(comando: ComandoForma): Rect {
  const { inicio, espessura } = comando;
  const { dx, dy } = dimensoesDaForma(comando);
  // A elipse mantém raio mínimo de meio pixel quando o arrasto é muito curto.
  return areaEntre(inicio, { x: inicio.x + dx, y: inicio.y + dy }, espessura / 2 + 2);
}

export function desenharForma(ctx: Contexto2D, comando: ComandoForma) {
  const { forma, inicio, cor, espessura, preenchida } = comando;
  const { dx, dy } = dimensoesDaForma(comando);
  ctx.save();
  ctx.lineWidth = espessura;
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (forma === 'line') {
    ctx.moveTo(inicio.x, inicio.y);
    ctx.lineTo(inicio.x + dx, inicio.y + dy);
  }
  if (forma === 'rectangle') ctx.rect(inicio.x, inicio.y, dx, dy);
  if (forma === 'ellipse') {
    ctx.ellipse(
      inicio.x + dx / 2,
      inicio.y + dy / 2,
      Math.max(0.5, Math.abs(dx / 2)),
      Math.max(0.5, Math.abs(dy / 2)),
      0,
      0,
      Math.PI * 2,
    );
  }
  if (preenchida && forma !== 'line') ctx.fill();
  ctx.stroke();
  ctx.restore();
}
