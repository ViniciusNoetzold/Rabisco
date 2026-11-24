import type { Point, Rect } from '../layers/types';
import { definirFerramenta } from './tool';

export const FONTES_TEXTO = [
  'Selawik',
  'Arial',
  'Calibri',
  'Georgia',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Verdana',
  'Courier New',
  'sans-serif',
  'serif',
  'monospace',
] as const;

export type FamiliaTexto = (typeof FONTES_TEXTO)[number];

export interface EstiloTexto {
  familia: FamiliaTexto;
  tamanho: number;
  negrito: boolean;
  italico: boolean;
  sublinhado: boolean;
  tachado: boolean;
  fundoOpaco: boolean;
}

export interface ConfiguracaoTexto {
  texto: string;
  origem: Point;
  estilo: EstiloTexto;
  cor1: string;
  cor2: string;
}

export const ESTILO_TEXTO_PADRAO: EstiloTexto = {
  familia: 'Selawik',
  tamanho: 24,
  negrito: false,
  italico: false,
  sublinhado: false,
  tachado: false,
  fundoOpaco: false,
};

export const MINIMO_TEXTO = 8;
export const MAXIMO_TEXTO = 256;
export const LIMITE_TEXTO = 8192;
export const MARGEM_TEXTO = 3;

type Grafico = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function normalizarTexto(texto: string): string {
  return texto.replace(/\r\n?/g, '\n').replaceAll('\t', '    ').slice(0, LIMITE_TEXTO);
}

export function tamanhoTexto(tamanho: number): number {
  if (!Number.isFinite(tamanho)) return ESTILO_TEXTO_PADRAO.tamanho;
  return Math.max(MINIMO_TEXTO, Math.min(MAXIMO_TEXTO, Math.round(tamanho)));
}

export function familiaDoTexto(familia: FamiliaTexto): string {
  if (familia === 'serif' || familia === 'sans-serif' || familia === 'monospace') return familia;
  const fallback =
    familia === 'Georgia' || familia === 'Times New Roman'
      ? 'serif'
      : familia === 'Courier New'
        ? 'monospace'
        : 'sans-serif';
  return `${JSON.stringify(familia)}, ${fallback}`;
}

export function fonteDoTexto(estilo: EstiloTexto): string {
  const { familia, negrito, italico } = estilo;
  return `${italico ? 'italic' : 'normal'} ${negrito ? 700 : 400} ${tamanhoTexto(estilo.tamanho)}px ${familiaDoTexto(familia)}`;
}

export function medirTexto(ctx: Grafico, texto: string, estilo: EstiloTexto) {
  const tamanho = tamanhoTexto(estilo.tamanho);
  ctx.save();
  ctx.font = fonteDoTexto(estilo);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const modelo = ctx.measureText('Mg');
  const ascendente = modelo.fontBoundingBoxAscent ?? tamanho * 0.8;
  const descendente = modelo.fontBoundingBoxDescent ?? tamanho * 0.2;
  const alturaLinha = Math.ceil(Math.max(tamanho * 1.3, ascendente + descendente + 2));
  const linhaDeBase = ascendente + (alturaLinha - ascendente - descendente) / 2;
  let esquerda = 0;
  let direita = 0;
  let topo = 0;
  let base = 0;
  const linhas = normalizarTexto(texto)
    .split('\n')
    .map((linha, indice) => {
      const medidas = ctx.measureText(linha);
      const y = linhaDeBase + indice * alturaLinha;
      esquerda = Math.min(esquerda, -medidas.actualBoundingBoxLeft);
      direita = Math.max(direita, medidas.width, medidas.actualBoundingBoxRight);
      topo = Math.min(topo, y - medidas.actualBoundingBoxAscent);
      base = Math.max(base, y + medidas.actualBoundingBoxDescent);
      return { linha, y, largura: medidas.width };
    });
  ctx.restore();
  esquerda = Math.floor(esquerda);
  topo = Math.floor(topo);
  return {
    linhas,
    alturaLinha,
    deslocamentoX: esquerda,
    deslocamentoY: topo,
    largura: Math.max(28, Math.ceil(direita) - esquerda + 2 * MARGEM_TEXTO),
    altura: Math.ceil(Math.max(linhas.length * alturaLinha, base)) - topo + 2 * MARGEM_TEXTO,
  };
}

export function areaDoTexto(ctx: Grafico, { texto, origem, estilo }: ConfiguracaoTexto): Rect {
  const { deslocamentoX, deslocamentoY, largura, altura } = medirTexto(ctx, texto, estilo);
  return {
    x: Math.floor(origem.x + deslocamentoX),
    y: Math.floor(origem.y + deslocamentoY),
    width: largura,
    height: altura,
  };
}

export function desenharTexto(
  ctx: Grafico,
  { texto, origem, estilo, cor1, cor2 }: ConfiguracaoTexto,
) {
  const medida = medirTexto(ctx, texto, estilo);
  const tamanho = tamanhoTexto(estilo.tamanho);
  ctx.save();
  if (estilo.fundoOpaco) {
    ctx.fillStyle = cor2;
    ctx.fillRect(
      origem.x + medida.deslocamentoX,
      origem.y + medida.deslocamentoY,
      medida.largura,
      medida.altura,
    );
  }
  ctx.font = fonteDoTexto(estilo);
  ctx.fillStyle = cor1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const { linha, y, largura } of medida.linhas) {
    const x = origem.x + MARGEM_TEXTO;
    const base = origem.y + MARGEM_TEXTO + y;
    ctx.fillText(linha, x, base);
    const espessura = Math.max(1, tamanho / 16);
    if (estilo.sublinhado) ctx.fillRect(x, base + tamanho * 0.08, largura, espessura);
    if (estilo.tachado) ctx.fillRect(x, base - tamanho * 0.28, largura, espessura);
  }
  ctx.restore();
}

// A edição ocorre no campo nativo sobre o papel. O canvas só recebe o texto confirmado.
export const ferramentaTexto = definirFerramenta(
  { id: 'text', nome: 'Texto', icone: 'document', atalho: 'T' },
  () => ({
    cursor: () => 'text',
    onPointerDown() {},
    onPointerMove() {},
    onPointerUp() {},
  }),
);
