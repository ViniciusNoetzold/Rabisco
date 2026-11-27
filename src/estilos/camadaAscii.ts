import type { Point, Rect } from '../layers/types';
import { dimensoesValidas } from '../document/dimensoes';
import {
  desenharAscii,
  MAX_CELULAS_ASCII,
  MAX_COLUNAS_ASCII,
  MAX_LINHAS_ASCII,
  type ArteAscii,
} from './ascii';

export interface CamadaAscii {
  arte: ArteAscii;
  area: Rect;
}

/** A camada editável mantém os caracteres e a área em coordenadas de papel. */
export function renderizarCamadaAscii(ctx: CanvasRenderingContext2D, ascii: CamadaAscii): void {
  const { arte, area } = ascii;
  if (arte.inverter) {
    ctx.save();
    ctx.fillStyle = '#111';
    ctx.fillRect(area.x, area.y, area.width, area.height);
    ctx.restore();
  }
  desenharAscii(ctx, arte, area);
}

function inteiro(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor);
}

type DadosAscii = Partial<CamadaAscii>;

export function normalizarCamadaAscii(valor: unknown): CamadaAscii | undefined {
  if (!valor || typeof valor !== 'object') return undefined;
  const { area, arte } = valor as DadosAscii;
  if (
    !area ||
    !inteiro(area.x) ||
    !inteiro(area.y) ||
    !inteiro(area.width) ||
    !inteiro(area.height) ||
    !dimensoesValidas(area.width, area.height) ||
    !arte ||
    !inteiro(arte.colunas) ||
    arte.colunas < 1 ||
    arte.colunas > MAX_COLUNAS_ASCII ||
    !Array.isArray(arte.linhas) ||
    !arte.linhas.length ||
    arte.linhas.length > MAX_LINHAS_ASCII ||
    arte.linhas.length * arte.colunas > MAX_CELULAS_ASCII ||
    !arte.linhas.every(
      (linha) => typeof linha === 'string' && Array.from(linha).length <= arte.colunas,
    )
  )
    return undefined;

  const cores = Array.isArray(arte.cores)
    ? arte.linhas.map((linha, y) => {
        const fonte = arte.cores?.[y];
        return Array.from(linha, (_, x) => {
          const cor = Array.isArray(fonte) ? fonte[x] : undefined;
          return typeof cor === 'string' && /^#[0-9a-f]{6}$/i.test(cor) ? cor : null;
        });
      })
    : undefined;
  return {
    area: { x: area.x, y: area.y, width: area.width, height: area.height },
    arte: {
      colunas: arte.colunas,
      linhas: [...arte.linhas],
      inverter: Boolean(arte.inverter),
      cores,
    },
  };
}

export function moverCamadaAscii(ascii: CamadaAscii, { x, y }: Point): CamadaAscii {
  return { ...ascii, area: { ...ascii.area, x: ascii.area.x + x, y: ascii.area.y + y } };
}

export function atualizarTextoAscii(arte: ArteAscii, texto: string): ArteAscii {
  const linhas = texto
    .split(/\r?\n/)
    .slice(0, Math.min(MAX_LINHAS_ASCII, Math.floor(MAX_CELULAS_ASCII / arte.colunas)))
    .map((linha) => Array.from(linha).slice(0, arte.colunas).join(''));
  return { ...arte, linhas };
}
