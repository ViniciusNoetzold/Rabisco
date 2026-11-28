import type { Point } from '../layers/types';

/** Régua de desenho: um segmento posicionável no papel. Traços perto dela saem retos. */
export interface Regua {
  a: Point;
  b: Point;
}

/** Guias do papel (em px do documento) e a régua de desenho. Vão junto no .rabisco (v2). */
export interface GuiasDocumento {
  horizontais: number[];
  verticais: number[];
  regua: Regua | null;
}

export type EixoGuia = 'horizontal' | 'vertical';
export type PosicoesGuias = Pick<GuiasDocumento, 'horizontais' | 'verticais'>;

export const SEM_GUIAS: GuiasDocumento = { horizontais: [], verticais: [], regua: null };

/** Limite de guias por direção (um arquivo não pode pedir milhões). */
export const LIMITE_GUIAS = 100;

/** Distância (px de tela) em que o traço gruda na régua e as formas encaixam nas guias. */
export const RAIO_REGUA = 28;
export const RAIO_GUIAS = 6;

function numero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function pontoSeguro(valor: unknown, largura: number, altura: number): Point | null {
  if (typeof valor !== 'object' || !valor) return null;
  const { x, y } = valor as { x?: unknown; y?: unknown };
  if (!numero(x) || !numero(y)) return null;
  // A régua pode passar um pouco da borda, mas não ir para o infinito.
  const folga = Math.max(largura, altura);
  return {
    x: Math.max(-folga, Math.min(largura + folga, x)),
    y: Math.max(-folga, Math.min(altura + folga, y)),
  };
}

function listaSegura(valor: unknown, limite: number): number[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<number>();
  for (const item of valor) {
    if (!numero(item) || item < 0 || item > limite) continue;
    vistos.add(Math.round(item));
    if (vistos.size >= LIMITE_GUIAS) break;
  }
  return [...vistos].sort((a, b) => a - b);
}

/** Lê guias de um arquivo ou do salvamento automático, descartando o que não faz sentido. */
export function guiasSeguras(bruto: unknown, largura: number, altura: number): GuiasDocumento {
  if (typeof bruto !== 'object' || !bruto) return SEM_GUIAS;
  const { horizontais, verticais, regua } = bruto as Record<string, unknown>;
  let reguaSegura: Regua | null = null;
  if (typeof regua === 'object' && regua) {
    const a = pontoSeguro((regua as { a?: unknown }).a, largura, altura);
    const b = pontoSeguro((regua as { b?: unknown }).b, largura, altura);
    if (a && b && Math.hypot(b.x - a.x, b.y - a.y) >= 1) reguaSegura = { a, b };
  }
  return {
    horizontais: listaSegura(horizontais, altura),
    verticais: listaSegura(verticais, largura),
    regua: reguaSegura,
  };
}

/** Régua nova: deitada no meio da área visível do papel, com 60% da largura dele. */
export function reguaPadrao(centro: Point, largura: number): Regua {
  const meia = Math.max(40, largura * 0.3);
  return { a: { x: centro.x - meia, y: centro.y }, b: { x: centro.x + meia, y: centro.y } };
}

/** Parâmetro t (0 em a, 1 em b) do ponto da reta a–b mais perto de `ponto`. */
function parametro(ponto: Point, { a, b }: Regua): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const quadrado = dx * dx + dy * dy;
  return quadrado ? ((ponto.x - a.x) * dx + (ponto.y - a.y) * dy) / quadrado : 0;
}

/** O ponto na borda da régua mais perto de `ponto` (preso entre as pontas). */
export function projetarNaRegua(ponto: Point, regua: Regua): Point {
  const t = Math.max(0, Math.min(1, parametro(ponto, regua)));
  const { a, b } = regua;
  return { ...ponto, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function distanciaDaRegua(ponto: Point, regua: Regua): number {
  const projetado = projetarNaRegua(ponto, regua);
  return Math.hypot(ponto.x - projetado.x, ponto.y - projetado.y);
}

/** Prende x na guia vertical e y na guia horizontal mais perto, dentro do raio (px do papel). */
export function encaixarNasGuias(ponto: Point, guias: GuiasDocumento, raio: number): Point {
  const maisPerto = (valor: number, lista: readonly number[]) => {
    let melhor = valor;
    let distancia = raio;
    for (const guia of lista) {
      const d = Math.abs(guia - valor);
      if (d <= distancia) {
        distancia = d;
        melhor = guia;
      }
    }
    return melhor;
  };
  const x = maisPerto(ponto.x, guias.verticais);
  const y = maisPerto(ponto.y, guias.horizontais);
  return x === ponto.x && y === ponto.y ? ponto : { ...ponto, x, y };
}

/** Prende o ângulo da régua em passos de 15° (Shift), girando em torno da ponta fixa. */
export function prenderAnguloDaRegua(fixa: Point, movel: Point): Point {
  const angulo = Math.atan2(movel.y - fixa.y, movel.x - fixa.x);
  const passo = Math.PI / 12;
  const preso = Math.round(angulo / passo) * passo;
  const comprimento = Math.hypot(movel.x - fixa.x, movel.y - fixa.y);
  return { x: fixa.x + Math.cos(preso) * comprimento, y: fixa.y + Math.sin(preso) * comprimento };
}

/** Acrescenta uma guia (sem repetir), arredondada no pixel. */
export function comGuia(guias: GuiasDocumento, eixo: EixoGuia, valor: number): GuiasDocumento {
  const chave = eixo === 'horizontal' ? 'horizontais' : 'verticais';
  const lista = guias[chave];
  const arredondado = Math.round(valor);
  if (lista.includes(arredondado) || lista.length >= LIMITE_GUIAS) return guias;
  return { ...guias, [chave]: [...lista, arredondado].sort((a, b) => a - b) };
}

export function semGuia(guias: GuiasDocumento, eixo: EixoGuia, valor: number): GuiasDocumento {
  const chave = eixo === 'horizontal' ? 'horizontais' : 'verticais';
  return { ...guias, [chave]: guias[chave].filter((guia) => guia !== valor) };
}
