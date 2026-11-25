import type { Point } from '../layers/types';

/**
 * Estabilizador de traço por "corda" (o pincel preguiçoso).
 *
 * A ponta do pincel fica presa ao ponteiro por uma corda de comprimento `raio`. Enquanto o
 * ponteiro se mexe dentro da corda, a ponta não anda — o tremor da mão some. Quando a corda
 * estica, a ponta é puxada na direção do ponteiro, só o que passou do comprimento. Com
 * `suavizacao` > 0, cada passo da ponta ainda é amortecido (média exponencial), o que arredonda
 * curvas feitas com o mouse.
 *
 * Tudo em coordenadas do documento: quem usa converte o raio de pixels de tela pelo zoom.
 */
export class Estabilizador {
  private atual: Point;
  private readonly raio: number;
  private readonly amortecimento: number;

  constructor(inicio: Point, raio: number, suavizacao = 0) {
    this.atual = { ...inicio };
    this.raio = Math.max(0, raio);
    // 0% não amortece; 100% deixa a ponta andar só 15% do caminho a cada evento.
    this.amortecimento = 1 - Math.min(1, Math.max(0, suavizacao)) * 0.85;
  }

  /** Onde a ponta do pincel está agora. */
  get ponta(): Point {
    return { ...this.atual };
  }

  /**
   * Recebe a posição do ponteiro e devolve a nova posição da ponta, ou `null` quando a ponta não
   * se mexeu (ponteiro dentro da corda).
   */
  mover(ponteiro: Point): Point | null {
    const dx = ponteiro.x - this.atual.x;
    const dy = ponteiro.y - this.atual.y;
    const distancia = Math.hypot(dx, dy);
    if (distancia <= this.raio || distancia === 0) return null;
    const puxao = ((distancia - this.raio) / distancia) * this.amortecimento;
    const proxima = {
      x: this.atual.x + dx * puxao,
      y: this.atual.y + dy * puxao,
      ...(ponteiro.pressure !== undefined && { pressure: ponteiro.pressure }),
    };
    // Movimentos abaixo de um centésimo de pixel não valem um ponto novo.
    if (Math.hypot(proxima.x - this.atual.x, proxima.y - this.atual.y) < 0.01) return null;
    this.atual = proxima;
    return this.ponta;
  }

  /**
   * Ao soltar: pontos intermediários da ponta até o ponteiro, para o fim do traço chegar onde a
   * mão parou. O último ponto é exatamente o ponteiro.
   */
  alcancar(ponteiro: Point, passo = Math.max(1, this.raio / 4)): Point[] {
    const dx = ponteiro.x - this.atual.x;
    const dy = ponteiro.y - this.atual.y;
    const distancia = Math.hypot(dx, dy);
    if (distancia === 0) return [];
    const quantidade = Math.max(1, Math.ceil(distancia / passo));
    const pontos: Point[] = [];
    for (let i = 1; i <= quantidade; i++) {
      const t = i / quantidade;
      pontos.push({
        x: this.atual.x + dx * t,
        y: this.atual.y + dy * t,
        ...(ponteiro.pressure !== undefined && { pressure: ponteiro.pressure }),
      });
    }
    this.atual = { ...ponteiro };
    return pontos;
  }
}

/** Ferramentas que passam pelo estabilizador (formas, seleção e balde não). */
export const FERRAMENTAS_ESTABILIZAVEIS = new Set(['pencil', 'brush', 'eraser']);
