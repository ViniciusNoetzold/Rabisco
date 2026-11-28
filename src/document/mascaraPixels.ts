import type { Point, Rect } from '../layers/types';

/**
 * Máscara de pixels (1 = selecionado), do tamanho do papel. A varinha mágica produz uma; a
 * seleção do Rabisco é um contorno, então a máscara vira contornos pelas bordas dos pixels.
 */
export type MascaraPixels = Uint8Array;

/** Limite de vértices: uma varinha global numa foto ruidosa não pode travar a tela. */
export const LIMITE_VERTICES = 400_000;

export function limitesDaMascara(
  mascara: MascaraPixels,
  largura: number,
  altura: number,
): Rect | null {
  let esquerda = largura;
  let topo = altura;
  let direita = -1;
  let base = -1;
  for (let y = 0; y < altura; y++) {
    const linha = y * largura;
    for (let x = 0; x < largura; x++) {
      if (!mascara[linha + x]) continue;
      if (x < esquerda) esquerda = x;
      if (x > direita) direita = x;
      if (y < topo) topo = y;
      base = y;
    }
  }
  if (direita < 0) return null;
  return { x: esquerda, y: topo, width: direita - esquerda + 1, height: base - topo + 1 };
}

/** Somar (Shift) ou subtrair (Alt) uma máscara de outra. Devolve uma nova. */
export function combinarMascaras(
  atual: MascaraPixels | null,
  nova: MascaraPixels,
  modo: 'substituir' | 'somar' | 'subtrair',
): MascaraPixels {
  if (modo === 'substituir' || !atual)
    return modo === 'subtrair' ? new Uint8Array(nova.length) : nova.slice();
  const resultado = new Uint8Array(nova.length);
  for (let i = 0; i < nova.length; i++)
    resultado[i] = modo === 'somar' ? atual[i] | nova[i] : atual[i] && !nova[i] ? 1 : 0;
  return resultado;
}

/**
 * Contornos das regiões, pelas bordas dos pixels, com o selecionado sempre à direita de quem
 * anda. Pontos no meio de lados retos são removidos. Devolve null se passar do limite.
 */
export function contornosDaMascara(
  mascara: MascaraPixels,
  largura: number,
  altura: number,
  area: Rect = { x: 0, y: 0, width: largura, height: altura },
): Point[][] | null {
  const colunas = largura + 1;
  const dentro = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < largura && y < altura && mascara[y * largura + x] === 1;
  // Arestas por vértice de saída (um vértice pode ter duas, nos cantos que se tocam).
  const saidas = new Map<number, number[]>();
  let total = 0;
  const aresta = (x1: number, y1: number, x2: number, y2: number) => {
    const de = y1 * colunas + x1;
    const lista = saidas.get(de);
    const para = y2 * colunas + x2;
    if (lista) lista.push(para);
    else saidas.set(de, [para]);
    total++;
  };
  for (let y = area.y; y < area.y + area.height; y++)
    for (let x = area.x; x < area.x + area.width; x++) {
      if (!dentro(x, y)) continue;
      if (!dentro(x, y - 1)) aresta(x, y, x + 1, y);
      if (!dentro(x + 1, y)) aresta(x + 1, y, x + 1, y + 1);
      if (!dentro(x, y + 1)) aresta(x + 1, y + 1, x, y + 1);
      if (!dentro(x - 1, y)) aresta(x, y + 1, x, y);
      if (total > LIMITE_VERTICES) return null;
    }
  const contornos: Point[][] = [];
  for (const [inicio, lista] of saidas) {
    while (lista.length) {
      const laco: Point[] = [];
      let atual = inicio;
      do {
        laco.push({ x: atual % colunas, y: Math.floor(atual / colunas) });
        const opcoes = saidas.get(atual)!;
        atual = opcoes.pop()!;
      } while (atual !== inicio && saidas.get(atual)?.length);
      contornos.push(semPontosRetos(laco));
    }
  }
  return contornos;
}

/** Tira os vértices no meio de lados retos (o contorno fica do tamanho dos cantos). */
function semPontosRetos(laco: Point[]): Point[] {
  return laco.filter((ponto, i) => {
    const antes = laco[(i - 1 + laco.length) % laco.length];
    const depois = laco[(i + 1) % laco.length];
    return (
      (ponto.x - antes.x) * (depois.y - ponto.y) - (ponto.y - antes.y) * (depois.x - ponto.x) !== 0
    );
  });
}

/**
 * Junta vários contornos num só, ligando o começo de cada um por "pontes" de ida e volta. As
 * pontes passam duas vezes pelo mesmo lugar, em sentidos opostos: no preenchimento evenodd e
 * no teste de ponto dentro elas se anulam.
 */
export function juntarContornos(contornos: readonly Point[][]): Point[] {
  const lacos = contornos.filter((laco) => laco.length >= 3);
  if (lacos.length <= 1) return lacos[0]?.slice() ?? [];
  const resultado: Point[] = [];
  for (const laco of lacos) {
    for (const ponto of laco) resultado.push(ponto);
    resultado.push(laco[0]);
  }
  for (let i = lacos.length - 2; i >= 0; i--) resultado.push(lacos[i][0]);
  return resultado;
}

/**
 * Trechos do contorno para desenhar o tracejado da seleção, sem as pontes (os segmentos que
 * aparecem também no sentido contrário).
 */
export function trechosVisiveis(contorno: readonly Point[]): Point[][] {
  const chave = (a: Point, b: Point) => `${a.x},${a.y},${b.x},${b.y}`;
  const segmentos = new Set<string>();
  for (let i = 0; i < contorno.length; i++)
    segmentos.add(chave(contorno[i], contorno[(i + 1) % contorno.length]));
  const trechos: Point[][] = [];
  let atual: Point[] = [];
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i];
    const b = contorno[(i + 1) % contorno.length];
    const ponte = (a.x === b.x && a.y === b.y) || segmentos.has(chave(b, a));
    if (ponte) {
      if (atual.length > 1) trechos.push(atual);
      atual = [];
      continue;
    }
    if (!atual.length) atual.push(a);
    atual.push(b);
  }
  if (atual.length > 1) trechos.push(atual);
  return trechos;
}

/** Contorno de uma elipse dentro da caixa (seleção elíptica), com pontos suficientes. */
export function contornoDaElipse(caixa: Rect, pontos = 72): Point[] {
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  return Array.from({ length: pontos }, (_, i) => {
    const angulo = (2 * Math.PI * i) / pontos;
    return {
      x: cx + (Math.cos(angulo) * caixa.width) / 2,
      y: cy + (Math.sin(angulo) * caixa.height) / 2,
    };
  });
}
