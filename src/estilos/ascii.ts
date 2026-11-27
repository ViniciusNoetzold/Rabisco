import { luminancia } from '../filtros/cores';
import type { PixelBuffer, Rect } from '../layers/types';

export const CONJUNTOS_ASCII = {
  simples: 'Simples',
  detalhado: 'Detalhado',
  blocos: 'Blocos',
  braille: 'Braille',
} as const;

export type ConjuntoAscii = keyof typeof CONJUNTOS_ASCII;

export interface OpcoesAscii {
  colunas: number;
  conjunto: ConjuntoAscii;
  inverter: boolean;
  colorido: boolean;
}

export interface ArteAscii {
  colunas: number;
  linhas: string[];
  inverter: boolean;
  cores?: (string | null)[][];
}

export const MAX_COLUNAS_ASCII = 256;
export const MAX_CELULAS_ASCII = 131_072;
export const MAX_LINHAS_ASCII = 1024;

export const OPCOES_ASCII_PADRAO: Readonly<OpcoesAscii> = {
  colunas: 80,
  conjunto: 'simples',
  inverter: false,
  colorido: false,
};

const RAMPAS = {
  simples: ' .:-=+*#%@',
  detalhado: ' .`^",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocos: ' ░▒▓█',
};

const BITS_BRAILLE = [
  [1, 8],
  [2, 16],
  [4, 32],
  [64, 128],
];

const VAZIO_BRAILLE = '\u2800';
const COR_HEXA = /^#[0-9a-f]{6}$/i;

interface Amostra {
  r: number;
  g: number;
  b: number;
  alfa: number;
}

function amostrar(
  { width, height, data }: PixelBuffer,
  coluna: number,
  linha: number,
  colunas: number,
  linhas: number,
  saida: Amostra,
) {
  const esquerda = (coluna * width) / colunas;
  const topo = (linha * height) / linhas;
  const direita = ((coluna + 1) * width) / colunas;
  const base = ((linha + 1) * height) / linhas;
  const xInicial = Math.floor(esquerda);
  const xFinal = Math.min(width, Math.ceil(direita));
  const yFinal = Math.min(height, Math.ceil(base));
  let r = 0;
  let g = 0;
  let b = 0;
  let alfa = 0;
  for (let y = Math.floor(topo); y < yFinal; y++) {
    const altura = Math.min(y + 1, base) - Math.max(y, topo);
    for (let x = xInicial; x < xFinal; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const largura = Math.min(x + 1, direita) - Math.max(x, esquerda);
      const peso = data[i + 3] * largura * altura;
      r += peso * data[i];
      g += peso * data[i + 1];
      b += peso * data[i + 2];
      alfa += peso;
    }
  }
  saida.r = alfa ? r / alfa : 0;
  saida.g = alfa ? g / alfa : 0;
  saida.b = alfa ? b / alfa : 0;
  saida.alfa = alfa / (255 * (direita - esquerda) * (base - topo));
}

function densidade({ r, g, b, alfa }: Amostra, inverter: boolean): number {
  const cinza = luminancia(r, g, b);
  const densidade = (inverter ? cinza : 255 - cinza) * alfa;
  return Math.max(0, Math.min(1, densidade / 255));
}

function hexa(r: number, g: number, b: number): string {
  const canal = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

function celulaBraille(
  pixels: PixelBuffer,
  amostra: Amostra,
  coluna: number,
  linha: number,
  colunas: number,
  linhas: number,
  inverter: boolean,
  colorido: boolean,
) {
  let pontos = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let alfa = 0;
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      amostrar(pixels, coluna * 2 + dx, linha * 4 + dy, colunas * 2, linhas * 4, amostra);
      if (densidade(amostra, inverter) < 0.5) continue;
      pontos |= BITS_BRAILLE[dy][dx];
      if (colorido) {
        r += amostra.r * amostra.alfa;
        g += amostra.g * amostra.alfa;
        b += amostra.b * amostra.alfa;
        alfa += amostra.alfa;
      }
    }
  }
  return {
    letra: String.fromCharCode(0x2800 + pontos),
    cor: alfa ? hexa(r / alfa, g / alfa, b / alfa) : null,
  };
}

/** Cada célula cobre uma área da imagem, com proporção aproximada de 1:2. */
export function converterAscii(pixels: PixelBuffer, opcoes: Partial<OpcoesAscii> = {}): ArteAscii {
  const conjunto = opcoes.conjunto ?? OPCOES_ASCII_PADRAO.conjunto;
  const inverter = opcoes.inverter ?? OPCOES_ASCII_PADRAO.inverter;
  const colorido = opcoes.colorido ?? OPCOES_ASCII_PADRAO.colorido;
  const largura = opcoes.colunas ?? OPCOES_ASCII_PADRAO.colunas;
  const colunas = Number.isFinite(largura)
    ? Math.max(1, Math.min(MAX_COLUNAS_ASCII, Math.round(largura)))
    : OPCOES_ASCII_PADRAO.colunas;
  const linhas: string[] = [];
  const cores: (string | null)[][] | undefined = colorido ? [] : undefined;
  const { width, height } = pixels;
  if (width > 0 && height > 0) {
    const altura = Math.max(
      1,
      Math.min(
        MAX_LINHAS_ASCII,
        Math.floor(MAX_CELULAS_ASCII / colunas),
        Math.round((height * colunas) / (width * 2)),
      ),
    );
    const rampa =
      conjunto !== 'braille' && typeof RAMPAS[conjunto] === 'string'
        ? RAMPAS[conjunto]
        : RAMPAS.simples;
    const amostra: Amostra = { r: 0, g: 0, b: 0, alfa: 0 };
    for (let y = 0; y < altura; y++) {
      let linha = '';
      const coresDaLinha: (string | null)[] = [];
      for (let x = 0; x < colunas; x++) {
        if (conjunto === 'braille') {
          const { letra, cor } = celulaBraille(
            pixels,
            amostra,
            x,
            y,
            colunas,
            altura,
            inverter,
            colorido,
          );
          linha += letra;
          if (colorido) coresDaLinha.push(cor);
        } else {
          amostrar(pixels, x, y, colunas, altura, amostra);
          const letra = rampa[Math.round(densidade(amostra, inverter) * (rampa.length - 1))];
          linha += letra;
          if (colorido) {
            coresDaLinha.push(letra === ' ' ? null : hexa(amostra.r, amostra.g, amostra.b));
          }
        }
      }
      linhas.push(linha);
      cores?.push(coresDaLinha);
    }
  }
  return { colunas, linhas, inverter, ...(cores ? { cores } : {}) };
}

export function textoAscii(arte: ArteAscii): string {
  return arte.linhas.join('\n');
}

function escaparHtml(texto: string): string {
  const substituicoes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return texto.replace(/[&<>"']/g, (letra) => substituicoes[letra]);
}

function corValida(cor: string | null | undefined): string | null {
  return typeof cor === 'string' && COR_HEXA.test(cor) ? cor : null;
}

export function trechosAscii(linha: string, cores: (string | null)[] | undefined) {
  if (!cores) return [{ texto: linha, cor: null }];
  const letras = Array.from(linha);
  const trechos: { texto: string; cor: string | null }[] = [];
  let inicio = 0;
  let cor = corValida(cores[0]);
  for (let i = 1; i <= letras.length; i++) {
    const proxima = corValida(cores[i]);
    if (cor === proxima && i < letras.length) continue;
    trechos.push({ texto: letras.slice(inicio, i).join(''), cor });
    cor = proxima;
    inicio = i;
  }
  return trechos;
}

function linhaHtml(linha: string, cores: (string | null)[] | undefined): string {
  return trechosAscii(linha, cores)
    .map(({ texto, cor }) => {
      const seguro = escaparHtml(texto);
      return cor ? `<span style="color:${cor}">${seguro}</span>` : seguro;
    })
    .join('');
}

export function htmlAscii(arte: ArteAscii): string {
  const conteudo = arte.linhas.map((linha, y) => linhaHtml(linha, arte.cores?.[y])).join('\n');
  // O parser HTML descarta a primeira quebra logo após a abertura de <pre>.
  const quebraInicial = conteudo.startsWith('\n') ? '\n' : '';
  const cor = arte.inverter ? '#fff' : '#000';
  const fundo = arte.inverter ? '#111' : '#fff';
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Arte ASCII · Rabisco</title>
  <style>
    body { background: ${fundo}; color: ${cor}; margin: 1rem; }
    pre { font: 1rem/1.2 monospace; font-variant-ligatures: none; white-space: pre; }
  </style>
</head>
<body>
<pre>${quebraInicial}${conteudo}</pre>
</body>
</html>\n`;
}

/** Desenha a arte dentro de uma área, com a superfície de fundo a cargo do chamador. */
export function desenharAscii(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  arte: ArteAscii,
  area: Rect,
): void {
  if (arte.colunas <= 0 || !arte.linhas.length || area.width <= 0 || area.height <= 0) return;
  const largura = area.width / arte.colunas;
  const altura = area.height / arte.linhas.length;
  const tamanho = Math.max(1, Math.min(altura * 0.88, largura * 1.9));
  const cor = arte.inverter ? '#fff' : '#000';
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.width, area.height);
  ctx.clip();
  ctx.font = `${tamanho}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [y, linha] of arte.linhas.entries()) {
    const base = area.y + (y + 0.5) * altura;
    const cores = arte.cores?.[y];
    let x = 0;
    for (const letra of linha) {
      if (x >= arte.colunas) break;
      if (letra !== ' ' && letra !== VAZIO_BRAILLE) {
        ctx.fillStyle = corValida(cores?.[x]) ?? cor;
        ctx.fillText(letra, area.x + (x + 0.5) * largura, base, largura);
      }
      x++;
    }
  }
  ctx.restore();
}
