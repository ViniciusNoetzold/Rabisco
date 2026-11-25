import type { Point } from '../layers/types';

/** Vertical: espelho esquerda/direita. Horizontal: cima/baixo. Quatro: os dois. Radial: N eixos. */
export type ModoSimetria = 'nenhuma' | 'vertical' | 'horizontal' | 'quatro' | 'radial';

export const EIXOS_MINIMOS = 2;
export const EIXOS_MAXIMOS = 24;

/** Parâmetros guardados no próprio comando: o JSON refaz o mesmo traço simétrico. */
export interface ConfigSimetria {
  modo: ModoSimetria;
  /** Só no radial: número de fatias, 2–24. */
  eixos: number;
  /** Só no radial: espelha dentro de cada fatia (mandala caleidoscópio). */
  espelhar: boolean;
  /** Centro, em px do documento. */
  centro: Point;
}

export type Transformacao = (ponto: Point) => Point;

/** Rotação por `angulo` em torno do centro e, antes, espelho no eixo vertical (se pedido). */
function transformacao(centro: Point, angulo: number, espelhar: boolean): Transformacao {
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  return (ponto) => {
    const dx = (espelhar ? -1 : 1) * (ponto.x - centro.x);
    const dy = ponto.y - centro.y;
    return { ...ponto, x: centro.x + dx * cos - dy * sen, y: centro.y + dx * sen + dy * cos };
  };
}

export function limitarEixos(eixos: number): number {
  if (!Number.isFinite(eixos)) return 6;
  return Math.max(EIXOS_MINIMOS, Math.min(EIXOS_MAXIMOS, Math.round(eixos)));
}

export function simetriaAtiva(config: ConfigSimetria | null | undefined): config is ConfigSimetria {
  return Boolean(config && config.modo !== 'nenhuma');
}

/**
 * Todas as cópias do traço, a original primeiro (identidade). Espelhos preservam a pressão e os
 * outros campos de cada ponto.
 */
export function transformacoes(config: ConfigSimetria | null | undefined): Transformacao[] {
  const identidade: Transformacao = (ponto) => ponto;
  if (!simetriaAtiva(config)) return [identidade];
  const { centro } = config;
  const espelho =
    (x: boolean, y: boolean): Transformacao =>
    (ponto) => ({
      ...ponto,
      x: x ? 2 * centro.x - ponto.x : ponto.x,
      y: y ? 2 * centro.y - ponto.y : ponto.y,
    });
  switch (config.modo) {
    case 'vertical':
      return [identidade, espelho(true, false)];
    case 'horizontal':
      return [identidade, espelho(false, true)];
    case 'quatro':
      return [identidade, espelho(true, false), espelho(false, true), espelho(true, true)];
    case 'radial': {
      const eixos = limitarEixos(config.eixos);
      const lista: Transformacao[] = [identidade];
      for (let i = 1; i < eixos; i++)
        lista.push(transformacao(centro, (2 * Math.PI * i) / eixos, false));
      if (config.espelhar)
        for (let i = 0; i < eixos; i++)
          lista.push(transformacao(centro, (2 * Math.PI * i) / eixos, true));
      return lista;
    }
    default:
      return [identidade];
  }
}

/** As cópias de uma lista de pontos (ou marcas de pincel), a original primeiro. */
export function copiasDosPontos<T extends Point>(
  pontos: readonly T[],
  config: ConfigSimetria | null | undefined,
): T[][] {
  return transformacoes(config).map((transformar, i) =>
    i === 0 ? [...pontos] : pontos.map((ponto) => transformar(ponto) as T),
  );
}

/**
 * Linhas-guia, em px do documento, cortadas no papel: uma por eixo de espelho (o radial mostra a
 * divisa de cada fatia).
 */
export function linhasGuia(
  config: ConfigSimetria,
  largura: number,
  altura: number,
): { de: Point; ate: Point }[] {
  const { x, y } = config.centro;
  const vertical = { de: { x, y: 0 }, ate: { x, y: altura } };
  const horizontal = { de: { x: 0, y }, ate: { x: largura, y } };
  switch (config.modo) {
    case 'nenhuma':
      return [];
    case 'vertical':
      return [vertical];
    case 'horizontal':
      return [horizontal];
    case 'quatro':
      return [vertical, horizontal];
    case 'radial': {
      const eixos = limitarEixos(config.eixos);
      const raio = Math.hypot(Math.max(x, largura - x), Math.max(y, altura - y));
      // A fatia começa para cima (−90°), onde quem desenha costuma começar.
      return Array.from({ length: eixos }, (_, i) => {
        const angulo = -Math.PI / 2 + (2 * Math.PI * i) / eixos;
        return {
          de: { x, y },
          ate: { x: x + Math.cos(angulo) * raio, y: y + Math.sin(angulo) * raio },
        };
      });
    }
  }
}

/** Campos do editor que descrevem a simetria (o centro nulo segue o meio do papel). */
export interface EstadoSimetria {
  simetria: ModoSimetria;
  eixosSimetria: number;
  espelharFatias: boolean;
  centroSimetria: Point | null;
}

/** A configuração para o próximo traço, ou nula com a simetria desligada. */
export function configDaSimetria(
  estado: EstadoSimetria,
  largura: number,
  altura: number,
): ConfigSimetria | null {
  if (estado.simetria === 'nenhuma') return null;
  const centro = estado.centroSimetria ?? { x: largura / 2, y: altura / 2 };
  return {
    modo: estado.simetria,
    eixos: limitarEixos(estado.eixosSimetria),
    espelhar: estado.espelharFatias,
    centro: {
      x: Math.max(0, Math.min(largura, centro.x)),
      y: Math.max(0, Math.min(altura, centro.y)),
    },
  };
}
