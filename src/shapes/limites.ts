import type { Point } from '../layers/types';
import { lerCaminho } from './presets';

function extremosDoArco(inicio: Point, valores: number[]): Point[] {
  const [rx, ry, graus, longo, horario, x, y] = valores;
  const fim = { x, y };
  if (!rx || !ry || (inicio.x === x && inicio.y === y)) return [fim];
  const angulo = (graus * Math.PI) / 180;
  const cos = Math.cos(angulo);
  const sin = Math.sin(angulo);
  const dx = (inicio.x - x) / 2;
  const dy = (inicio.y - y) / 2;
  const localX = cos * dx + sin * dy;
  const localY = -sin * dx + cos * dy;
  const escala = Math.max(1, Math.hypot(localX / rx, localY / ry));
  const a = rx * escala;
  const b = ry * escala;
  const u = localX / a;
  const v = localY / b;
  const distancia = Math.hypot(u, v);
  if (!distancia) return [fim];
  // Quando os raios originais não alcançam os extremos, SVG os amplia até a meia elipse.
  const sinal = longo === horario ? -1 : 1;
  const perpendicular = sinal * Math.sqrt(Math.max(0, 1 - distancia ** 2));
  const centroX = (perpendicular * v) / distancia;
  const centroY = (-perpendicular * u) / distancia;
  const origemX = (inicio.x + x) / 2 + cos * a * centroX - sin * b * centroY;
  const origemY = (inicio.y + y) / 2 + sin * a * centroX + cos * b * centroY;
  const inicial = Math.atan2(v - centroY, u - centroX);
  const final = Math.atan2(-v - centroY, -u - centroX);
  const volta = Math.PI * 2;
  const modular = (n: number) => (n + volta) % volta;
  const percorrido = (t: number) => modular(horario ? t - inicial : inicial - t);
  const duracao = percorrido(final);
  const horizontal = Math.atan2(-b * sin, a * cos);
  const vertical = Math.atan2(b * cos, a * sin);
  return [
    fim,
    ...[horizontal, horizontal + Math.PI, vertical, vertical + Math.PI]
      .filter((t) => percorrido(t) <= duracao)
      .map((t) => ({
        x: origemX + a * cos * Math.cos(t) - b * sin * Math.sin(t),
        y: origemY + a * sin * Math.cos(t) + b * cos * Math.sin(t),
      })),
  ];
}

/** O casco dos controles e os extremos dos arcos incluem os pixels que podem mudar. */
export function pontosDosLimites(path: string): Point[] {
  const pontos: Point[] = [];
  let atual = { x: 0, y: 0 };
  let inicio = atual;
  for (const { tipo, valores } of lerCaminho(path) ?? []) {
    if (tipo === 'Z') {
      atual = inicio;
      continue;
    }
    if (tipo === 'A') {
      const extremos = extremosDoArco(atual, valores);
      pontos.push(...extremos);
      atual = extremos[0];
      continue;
    }
    const pares =
      tipo === 'H' ? [valores[0], atual.y] : tipo === 'V' ? [atual.x, valores[0]] : valores;
    for (let i = 0; i < pares.length; i += 2) {
      atual = { x: pares[i], y: pares[i + 1] };
      pontos.push(atual);
    }
    if (tipo === 'M') inicio = atual;
  }
  return pontos;
}
