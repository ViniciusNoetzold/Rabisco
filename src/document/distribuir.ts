import type { Rect } from '../layers/types';

export type EixoDistribuicao = 'horizontal' | 'vertical';

/**
 * Distribuir: as camadas da ponta (a primeira e a última na direção escolhida) ficam paradas e
 * as do meio se movem para que os espaços entre elas fiquem iguais (como no Inkscape). Pede ao
 * menos 3 camadas com pixels. Devolve só quem precisa andar.
 */
export function planoDeDistribuicao(
  itens: readonly { id: string; limites: Rect }[],
  eixo: EixoDistribuicao,
): { id: string; dx: number; dy: number }[] {
  if (itens.length < 3) return [];
  const horizontal = eixo === 'horizontal';
  const inicio = (r: Rect) => (horizontal ? r.x : r.y);
  const tamanho = (r: Rect) => (horizontal ? r.width : r.height);
  const ordenados = [...itens].sort(
    (a, b) =>
      inicio(a.limites) + tamanho(a.limites) / 2 - (inicio(b.limites) + tamanho(b.limites) / 2),
  );
  const primeiro = ordenados[0].limites;
  const ultimo = ordenados.at(-1)!.limites;
  const espacoTotal = inicio(ultimo) + tamanho(ultimo) - inicio(primeiro);
  const ocupado = ordenados.reduce((soma, { limites }) => soma + tamanho(limites), 0);
  const vao = (espacoTotal - ocupado) / (ordenados.length - 1);
  const movimentos: { id: string; dx: number; dy: number }[] = [];
  let cursor = inicio(primeiro) + tamanho(primeiro) + vao;
  for (const { id, limites } of ordenados.slice(1, -1)) {
    const delta = Math.round(cursor - inicio(limites));
    cursor += tamanho(limites) + vao;
    if (delta) movimentos.push({ id, dx: horizontal ? delta : 0, dy: horizontal ? 0 : delta });
  }
  return movimentos;
}
