import type { Rect } from '../layers/types';

/** Lado de cada bloco do autosave, em pixels. */
export const LADO_BLOCO = 256;

export interface PosicaoBloco {
  bx: number;
  by: number;
}

/** Chave estável no IndexedDB: documento, camada e posição do bloco na grade. */
export function chaveDoBloco(documento: string, camada: string, { bx, by }: PosicaoBloco): string {
  return `${documento}:${camada}:${bx}:${by}`;
}

export function colunasELinhas(largura: number, altura: number) {
  return { colunas: Math.ceil(largura / LADO_BLOCO), linhas: Math.ceil(altura / LADO_BLOCO) };
}

/** Retângulo do bloco no papel, cortado na borda direita e inferior. */
export function areaDoBloco({ bx, by }: PosicaoBloco, largura: number, altura: number): Rect {
  const x = bx * LADO_BLOCO;
  const y = by * LADO_BLOCO;
  return {
    x,
    y,
    width: Math.min(LADO_BLOCO, largura - x),
    height: Math.min(LADO_BLOCO, altura - y),
  };
}

/** Todos os blocos que uma área alterada toca. Uma área vazia ou fora do papel não toca nenhum. */
export function blocosDaArea(area: Rect, largura: number, altura: number): PosicaoBloco[] {
  const esquerda = Math.max(0, Math.floor(area.x));
  const topo = Math.max(0, Math.floor(area.y));
  const direita = Math.min(largura, Math.ceil(area.x + area.width));
  const base = Math.min(altura, Math.ceil(area.y + area.height));
  if (direita <= esquerda || base <= topo) return [];
  const blocos: PosicaoBloco[] = [];
  for (let by = Math.floor(topo / LADO_BLOCO); by <= Math.floor((base - 1) / LADO_BLOCO); by++) {
    for (
      let bx = Math.floor(esquerda / LADO_BLOCO);
      bx <= Math.floor((direita - 1) / LADO_BLOCO);
      bx++
    ) {
      blocos.push({ bx, by });
    }
  }
  return blocos;
}

/**
 * Cor RGBA empacotada quando todos os pixels do bloco são iguais (papel em branco, fundo
 * liso). Esses blocos são gravados como um número, sem codificar imagem.
 */
export function corUniforme(dados: Uint8ClampedArray): number | null {
  if (dados.length < 4) return null;
  const pixels = new Uint32Array(dados.buffer, dados.byteOffset, dados.length / 4);
  const primeira = pixels[0];
  for (let i = 1; i < pixels.length; i++) if (pixels[i] !== primeira) return null;
  return primeira;
}

/** Converte a cor empacotada (ordem de bytes da plataforma) de volta para RGBA. */
export function rgbaDaCor(cor: number): [number, number, number, number] {
  const bytes = new Uint8ClampedArray(new Uint32Array([cor]).buffer);
  return [bytes[0], bytes[1], bytes[2], bytes[3]];
}

/** Conjunto de blocos sujos de uma camada, sem repetições. */
export class BlocosSujos {
  private readonly chaves = new Set<string>();
  private tudo = false;

  marcar(area: Rect | null, largura: number, altura: number): void {
    if (this.tudo) return;
    if (!area) {
      this.tudo = true;
      this.chaves.clear();
      return;
    }
    for (const { bx, by } of blocosDaArea(area, largura, altura)) this.chaves.add(`${bx}:${by}`);
  }

  get vazio(): boolean {
    return !this.tudo && this.chaves.size === 0;
  }

  /** Esvazia o conjunto e devolve o que estava pendente. `tudo` indica papel inteiro. */
  retirar(largura: number, altura: number): { tudo: boolean; blocos: PosicaoBloco[] } {
    const tudo = this.tudo;
    let blocos: PosicaoBloco[];
    if (tudo) {
      const { colunas, linhas } = colunasELinhas(largura, altura);
      blocos = [];
      for (let by = 0; by < linhas; by++)
        for (let bx = 0; bx < colunas; bx++) blocos.push({ bx, by });
    } else {
      blocos = [...this.chaves].map((chave) => {
        const [bx, by] = chave.split(':').map(Number);
        return { bx, by };
      });
    }
    this.tudo = false;
    this.chaves.clear();
    return { tudo, blocos };
  }
}
