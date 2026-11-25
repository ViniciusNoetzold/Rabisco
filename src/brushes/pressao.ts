import type { Point } from '../layers/types';
import { pressaoDoPonto, type MarcaPincel } from './catalogo';

/** Como a força da caneta vira espessura e opacidade. */
export type CurvaPressao = 'suave' | 'linear' | 'firme';

const EXPOENTES: Record<CurvaPressao, number> = {
  // Suave: um toque leve já dá um traço cheio. Firme: precisa apertar para engrossar.
  suave: 0.55,
  linear: 1,
  firme: 1.8,
};

export function aplicarCurva(pressao: number, curva: CurvaPressao): number {
  const p = Math.max(0, Math.min(1, pressao));
  return p ** EXPOENTES[curva];
}

/** Pontos da curva (0–1 em x e y) para a prévia no painel. */
export function pontosDaCurva(curva: CurvaPressao, passos = 16): Point[] {
  return Array.from({ length: passos + 1 }, (_, i) => {
    const x = i / passos;
    return { x, y: aplicarCurva(x, curva) };
  });
}

/**
 * Pressão simulada para mouse e toque: rápido = fino, devagar = cheio, como uma caneta de
 * verdade. A velocidade é medida em px de tela por milissegundo e amortecida entre eventos.
 */
export class PressaoPorVelocidade {
  private anterior: { ponto: Point; instante: number } | null = null;
  private pressao = 1;

  constructor(private readonly zoom: number) {}

  proxima(ponto: Point, instante: number): number {
    const anterior = this.anterior;
    this.anterior = { ponto, instante };
    if (!anterior) return this.pressao;
    const tempo = Math.max(1, instante - anterior.instante);
    const velocidade =
      (Math.hypot(ponto.x - anterior.ponto.x, ponto.y - anterior.ponto.y) * this.zoom) / tempo;
    // Parado ou devagar (≤ 0,2 px/ms): cheio. A partir de ~2,2 px/ms: 30%.
    const alvo = Math.max(0.3, Math.min(1, 1.1 - velocidade / 2.2));
    this.pressao += (alvo - this.pressao) * 0.35;
    return this.pressao;
  }
}

/** Comprimento da ponta afinada, em px do documento, para `afinar` de 0 a 100%. */
export function comprimentoDaPonta(afinar: number, espessura: number): number {
  return (Math.max(0, Math.min(100, afinar)) / 100) * Math.min(240, Math.max(30, espessura * 6));
}

/** Multiplicador da ponta: começa em 15% e cresce suave (smoothstep) até 100% no comprimento. */
export function fatorDaPonta(distancia: number, comprimento: number): number {
  if (comprimento <= 0 || distancia >= comprimento) return 1;
  const t = Math.max(0, distancia / comprimento);
  return 0.15 + 0.85 * t * t * (3 - 2 * t);
}

/**
 * Afina o fim do traço depois de solto (o começo já sai afinado enquanto se desenha). Devolve
 * marcas novas; as originais não mudam.
 */
export function afinarFim(marcas: readonly MarcaPincel[], comprimento: number): MarcaPincel[] {
  if (comprimento <= 0 || marcas.length < 2) return [...marcas];
  const restante = new Array<number>(marcas.length).fill(0);
  for (let i = marcas.length - 2; i >= 0; i--) {
    const a = marcas[i];
    const b = marcas[i + 1];
    restante[i] = restante[i + 1] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  return marcas.map((marca, i) => {
    const fator = fatorDaPonta(restante[i], comprimento);
    return fator === 1 ? marca : { ...marca, pressure: pressaoDoPonto(marca) * fator };
  });
}
