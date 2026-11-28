import type { PixelBuffer, Point, Rect } from '../layers/types';
import { transformacoes, type ConfigSimetria, type Transformacao } from './simetria';

interface OpcoesBorrao {
  area?: Rect;
  cobertura?: Uint8ClampedArray;
  travarAlfa?: boolean;
  simetria?: ConfigSimetria;
}

/**
 * Dedo (borrar/esfumar): a ponta "carrega" os pixels de onde passou e os arrasta. Cada carimbo
 * mistura a carga nos pixels embaixo (mais no centro, nada na borda) e pega um pouco deles de
 * volta. Força 1 arrasta a cor longe; força 0 não mexe em nada. Tudo em alfa pré-multiplicado,
 * para bordas transparentes não puxarem preto.
 *
 * A imagem pode ser o papel inteiro (prévia) ou um recorte dele (executor): `origem` diz onde o
 * recorte começa. O resultado é o mesmo nos dois, então a prévia é fiel ao que fica no papel.
 */
export class Borrador {
  private readonly raio: number;
  private readonly lado: number;
  private readonly carga: Float32Array;
  private anterior: Point | null = null;

  constructor(
    private readonly imagem: PixelBuffer,
    private readonly origem: Point,
    espessura: number,
    private readonly forca: number,
    private readonly opcoes: OpcoesBorrao = {},
  ) {
    this.raio = Math.max(1, espessura / 2);
    this.lado = 2 * Math.ceil(this.raio) + 1;
    this.carga = new Float32Array(this.lado * this.lado * 4);
  }

  /** Começa no ponto: a carga vira os pixels embaixo da ponta. */
  iniciar(ponto: Point): Rect {
    const centro = { x: Math.round(ponto.x), y: Math.round(ponto.y) };
    const meio = (this.lado - 1) / 2;
    for (let dy = -meio; dy <= meio; dy++)
      for (let dx = -meio; dx <= meio; dx++) {
        const destino = ((dy + meio) * this.lado + dx + meio) * 4;
        const pixel = this.indice(centro.x + dx, centro.y + dy);
        if (pixel < 0) continue;
        const alfa = this.imagem.data[pixel + 3] / 255;
        this.carga[destino] = this.imagem.data[pixel] * alfa;
        this.carga[destino + 1] = this.imagem.data[pixel + 1] * alfa;
        this.carga[destino + 2] = this.imagem.data[pixel + 2] * alfa;
        this.carga[destino + 3] = this.imagem.data[pixel + 3];
      }
    this.anterior = ponto;
    return this.areaDoCarimbo(centro);
  }

  /** Arrasta até o ponto, em carimbos a cada ~¼ do raio. Devolve a área mexida (px do papel). */
  mover(ponto: Point): Rect | null {
    const anterior = this.anterior;
    if (!anterior) return this.iniciar(ponto);
    const distancia = Math.hypot(ponto.x - anterior.x, ponto.y - anterior.y);
    const passo = Math.max(1, this.raio * 0.25);
    const passos = Math.floor(distancia / passo);
    if (!passos) return null;
    let area: Rect | null = null;
    for (let i = 1; i <= passos; i++) {
      const t = (i * passo) / distancia;
      const centro = {
        x: Math.round(anterior.x + (ponto.x - anterior.x) * t),
        y: Math.round(anterior.y + (ponto.y - anterior.y) * t),
      };
      this.carimbar(centro);
      const parte = this.areaDoCarimbo(centro);
      area = area ? unir(area, parte) : parte;
    }
    // Guarda onde o último carimbo caiu: o resto da distância vai para o próximo movimento.
    const t = (passos * passo) / distancia;
    this.anterior = {
      x: anterior.x + (ponto.x - anterior.x) * t,
      y: anterior.y + (ponto.y - anterior.y) * t,
    };
    return area;
  }

  private carimbar(centro: Point) {
    const { data } = this.imagem;
    const meio = (this.lado - 1) / 2;
    const pegar = 1 - this.forca;
    for (let dy = -meio; dy <= meio; dy++)
      for (let dx = -meio; dx <= meio; dx++) {
        const d = Math.hypot(dx, dy) / this.raio;
        if (d > 1) continue;
        const x = centro.x + dx;
        const y = centro.y + dy;
        const pixel = this.indice(x, y);
        if (pixel < 0) continue;
        const cobertura = this.cobertura(x, y);
        const peso = this.forca * (1 - d * d) * cobertura;
        const carga = ((dy + meio) * this.lado + dx + meio) * 4;
        const alfa = data[pixel + 3] / 255;
        const antes = [
          data[pixel] * alfa,
          data[pixel + 1] * alfa,
          data[pixel + 2] * alfa,
          data[pixel + 3],
        ];
        const depois = antes.map((valor, c) => valor + (this.carga[carga + c] - valor) * peso);
        for (let c = 0; c < 4; c++)
          this.carga[carga + c] += (antes[c] - this.carga[carga + c]) * pegar;
        if (!peso || (this.opcoes.travarAlfa && !alfa)) continue;
        const novoAlfa = depois[3];
        if (!this.opcoes.travarAlfa) data[pixel + 3] = Math.round(novoAlfa);
        else if (!novoAlfa) continue;
        const escala = novoAlfa > 0 ? 255 / novoAlfa : 0;
        data[pixel] = Math.round(depois[0] * escala);
        data[pixel + 1] = Math.round(depois[1] * escala);
        data[pixel + 2] = Math.round(depois[2] * escala);
      }
  }

  private cobertura(x: number, y: number): number {
    const { area, cobertura } = this.opcoes;
    if (!area) return 1;
    const coluna = x - area.x;
    const linha = y - area.y;
    if (coluna < 0 || coluna >= area.width || linha < 0 || linha >= area.height) return 0;
    return cobertura ? cobertura[linha * area.width + coluna] / 255 : 1;
  }

  /** Índice do pixel (px do papel) dentro da imagem, ou −1 fora dela. */
  private indice(x: number, y: number): number {
    const lx = x - this.origem.x;
    const ly = y - this.origem.y;
    if (lx < 0 || ly < 0 || lx >= this.imagem.width || ly >= this.imagem.height) return -1;
    return (ly * this.imagem.width + lx) * 4;
  }

  private areaDoCarimbo(centro: Point): Rect {
    const meio = (this.lado - 1) / 2;
    return { x: centro.x - meio, y: centro.y - meio, width: this.lado, height: this.lado };
  }
}

/** Cada cópia tem sua própria carga. Compartilham os pixels e a ordem das amostras. */
export class BorradorSimetrico {
  private readonly copias: { transformar: Transformacao; borrador: Borrador }[];

  constructor(
    imagem: PixelBuffer,
    origem: Point,
    espessura: number,
    forca: number,
    opcoes: OpcoesBorrao = {},
  ) {
    this.copias = transformacoes(opcoes.simetria).map((transformar) => ({
      transformar,
      borrador: new Borrador(imagem, origem, espessura, forca, opcoes),
    }));
  }

  iniciar(ponto: Point) {
    for (const { transformar, borrador } of this.copias) borrador.iniciar(transformar(ponto));
  }

  mover(ponto: Point): Rect[] {
    const areas: Rect[] = [];
    for (const { transformar, borrador } of this.copias) {
      const area = borrador.mover(transformar(ponto));
      if (area) areas.push(area);
    }
    return areas;
  }
}

function unir(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** A área que um traço de dedo pode mexer: os pontos com a margem do raio. */
export function areaDoBorrao(
  pontos: readonly Point[],
  espessura: number,
  transformar?: Transformacao,
): Rect | null {
  if (!pontos.length) return null;
  const margem = Math.ceil(Math.max(1, espessura / 2)) + 1;
  let esquerda = Infinity;
  let topo = Infinity;
  let direita = -Infinity;
  let base = -Infinity;
  for (const original of pontos) {
    const ponto = transformar?.(original) ?? original;
    const x = Math.round(ponto.x);
    const y = Math.round(ponto.y);
    esquerda = Math.min(esquerda, x);
    direita = Math.max(direita, x);
    topo = Math.min(topo, y);
    base = Math.max(base, y);
  }
  return {
    x: esquerda - margem,
    y: topo - margem,
    width: direita - esquerda + 2 * margem + 1,
    height: base - topo + 2 * margem + 1,
  };
}

/** Aplica um traço inteiro, na mesma ordem da prévia. */
export function borrarTraco(
  imagem: PixelBuffer,
  origem: Point,
  pontos: readonly Point[],
  espessura: number,
  forca: number,
  opcoes: OpcoesBorrao = {},
) {
  const [primeiro, ...resto] = pontos;
  if (!primeiro) return;
  const borrador = new BorradorSimetrico(imagem, origem, espessura, forca, opcoes);
  borrador.iniciar(primeiro);
  for (const ponto of resto) borrador.mover(ponto);
}
