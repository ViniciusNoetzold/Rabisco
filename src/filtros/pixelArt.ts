import type { PixelBuffer } from '../layers/types';

export type CorPaleta = readonly [number, number, number];
type Parametros = Readonly<Record<string, unknown>>;

export const OPCOES_PALETA_PIXEL_ART = [
  { valor: 'game-boy', nome: 'Game Boy' },
  { valor: 'nes', nome: 'NES' },
  { valor: 'pico-8', nome: 'PICO-8' },
  { valor: 'cga', nome: 'CGA' },
  { valor: 'desenho', nome: 'Paleta do desenho' },
] as const;

type PaletaFixa = Exclude<(typeof OPCOES_PALETA_PIXEL_ART)[number]['valor'], 'desenho'>;

function coresHex(valores: string): CorPaleta[] {
  return valores
    .trim()
    .split(/\s+/)
    .map((hexadecimal) => {
      const cor = Number.parseInt(hexadecimal, 16);
      return [cor >> 16, (cor >> 8) & 255, cor & 255];
    });
}

export const PALETAS_PIXEL_ART: Readonly<Record<PaletaFixa, readonly CorPaleta[]>> = {
  // Quatro tons aproximados da tela verde do Game Boy.
  'game-boy': coresHex('0f380f 306230 8bac0f 9bbc0f'),
  // Aproximação RGB do sinal NTSC do PPU 2C02 em quatro níveis de luminância.
  nes: coresHex(`
    7a7a7a 003fb3 1d1ad6 5700d2 8000a8 95005d 920000 782b00 4b4e00 0c6700 007300 006f00 005d6e 000000 000000 000000
    bcbcbc 0777ff 524fff 9229ff c314f3 dc1a99 d9391d ba6100 858800 42a500 00b300 00af39 009aae 000000 000000 000000
    ffffff 66bfff 9e9cff d87dff ff6eff ff72de ff8974 fdab00 ccce00 91ea00 5bf716 3af38a 3fdff1 636363 000000 000000
    ffffff c4e5ff d9d8ff efccff ffc7ff ffc8f2 ffd1c9 fedea5 eaeb90 d4f693 c0fcab b5fad1 b7f2f9 c3c3c3 000000 000000
  `),
  'pico-8': coresHex(
    '000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa',
  ),
  cga: coresHex(
    '000000 0000aa 00aa00 00aaaa aa0000 aa00aa aa5500 aaaaaa 555555 5555ff 55ff55 55ffff ff5555 ff55ff ffff55 ffffff',
  ),
};

function inteiroEntre(valor: unknown, padrao: number, minimo: number, maximo: number): number {
  return typeof valor === 'number' && Number.isFinite(valor)
    ? Math.min(maximo, Math.max(minimo, Math.round(valor)))
    : padrao;
}

/** Cada bloco tem cor média ponderada pelo alfa e opacidade média de todos os seus pixels. */
export function pixelizar(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const { width, height, data } = pixels;
  const tamanho = inteiroEntre(parametros.tamanho, 8, 1, 128);
  if (tamanho === 1) return pixels;
  const saida = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y += tamanho) {
    const fundo = Math.min(y + tamanho, height);
    for (let x = 0; x < width; x += tamanho) {
      const direita = Math.min(x + tamanho, width);
      let vermelho = 0;
      let verde = 0;
      let azul = 0;
      let alfa = 0;
      for (let linha = y; linha < fundo; linha++) {
        let posicao = (linha * width + x) * 4;
        for (let coluna = x; coluna < direita; coluna++, posicao += 4) {
          const peso = data[posicao + 3];
          vermelho += data[posicao] * peso;
          verde += data[posicao + 1] * peso;
          azul += data[posicao + 2] * peso;
          alfa += peso;
        }
      }
      if (alfa === 0) continue;
      const r = Math.round(vermelho / alfa);
      const g = Math.round(verde / alfa);
      const b = Math.round(azul / alfa);
      const a = Math.round(alfa / ((direita - x) * (fundo - y)));
      for (let linha = y; linha < fundo; linha++) {
        let posicao = (linha * width + x) * 4;
        for (let coluna = x; coluna < direita; coluna++, posicao += 4) {
          saida[posicao] = r;
          saida[posicao + 1] = g;
          saida[posicao + 2] = b;
          saida[posicao + 3] = a;
        }
      }
    }
  }
  return { width, height, data: saida };
}

/** Busca em uma paleta com pelo menos uma entrada e conserva a primeira em caso de empate. */
export function corMaisProxima(
  r: number,
  g: number,
  b: number,
  paleta: readonly CorPaleta[],
): CorPaleta {
  let cor = paleta[0];
  let menorDistancia = Infinity;
  for (const candidata of paleta) {
    const dr = r - candidata[0];
    const dg = g - candidata[1];
    const db = b - candidata[2];
    const distancia = dr * dr + dg * dg + db * db;
    if (distancia < menorDistancia) {
      cor = candidata;
      menorDistancia = distancia;
      if (distancia === 0) break;
    }
  }
  return cor;
}

interface Amostra {
  cor: CorPaleta;
  peso: number;
}

interface Caixa {
  amostras: Amostra[];
  eixo: number;
  peso: number;
  prioridade: number;
}

function caixaDeCores(amostras: Amostra[]): Caixa {
  const minimos = [255, 255, 255];
  const maximos = [0, 0, 0];
  let peso = 0;
  for (const amostra of amostras) {
    peso += amostra.peso;
    for (let canal = 0; canal < 3; canal++) {
      minimos[canal] = Math.min(minimos[canal], amostra.cor[canal]);
      maximos[canal] = Math.max(maximos[canal], amostra.cor[canal]);
    }
  }
  const faixas = maximos.map((maximo, canal) => maximo - minimos[canal]);
  const maiorFaixa = Math.max(...faixas);
  return { amostras, eixo: faixas.indexOf(maiorFaixa), peso, prioridade: maiorFaixa * peso };
}

/** Reduz por corte mediano ponderado, com histograma RGB de 5 bits por canal. */
export function paletaDoDesenho(pixels: PixelBuffer, total: unknown = 16): CorPaleta[] {
  const limite = inteiroEntre(total, 16, 2, 64);
  const histograma = new Float64Array(32 * 32 * 32 * 4);
  let exatas: Set<number> | null = new Set();
  const { data } = pixels;

  for (let i = 0; i < data.length; i += 4) {
    const peso = data[i + 3];
    if (peso === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const posicao = (((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) * 4;
    histograma[posicao] += peso;
    histograma[posicao + 1] += r * peso;
    histograma[posicao + 2] += g * peso;
    histograma[posicao + 3] += b * peso;
    if (exatas) {
      exatas.add((r << 16) | (g << 8) | b);
      if (exatas.size > limite) exatas = null;
    }
  }

  if (exatas) return [...exatas].map((cor) => [cor >> 16, (cor >> 8) & 255, cor & 255]);

  const amostras: Amostra[] = [];
  for (let i = 0; i < histograma.length; i += 4) {
    const peso = histograma[i];
    if (peso === 0) continue;
    amostras.push({
      peso,
      cor: [histograma[i + 1] / peso, histograma[i + 2] / peso, histograma[i + 3] / peso],
    });
  }

  const caixas = [caixaDeCores(amostras)];
  while (caixas.length < limite) {
    let indice = -1;
    let prioridade = -1;
    for (let i = 0; i < caixas.length; i++) {
      if (caixas[i].amostras.length > 1 && caixas[i].prioridade > prioridade) {
        indice = i;
        prioridade = caixas[i].prioridade;
      }
    }
    if (indice < 0) break;
    const caixa = caixas[indice];
    caixa.amostras.sort((a, b) => a.cor[caixa.eixo] - b.cor[caixa.eixo]);
    let acumulado = 0;
    let corte = 1;
    while (corte < caixa.amostras.length - 1) {
      acumulado += caixa.amostras[corte - 1].peso;
      if (acumulado >= caixa.peso / 2) break;
      corte++;
    }
    caixas.splice(
      indice,
      1,
      caixaDeCores(caixa.amostras.slice(0, corte)),
      caixaDeCores(caixa.amostras.slice(corte)),
    );
  }

  return caixas.map(({ amostras: itens, peso }) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const amostra of itens) {
      r += amostra.cor[0] * amostra.peso;
      g += amostra.cor[1] * amostra.peso;
      b += amostra.cor[2] * amostra.peso;
    }
    return [Math.round(r / peso), Math.round(g / peso), Math.round(b / peso)];
  });
}

export function acumularErro(
  linha: Float32Array,
  posicao: number,
  r: number,
  g: number,
  b: number,
  fator: number,
) {
  linha[posicao] += r * fator;
  linha[posicao + 1] += g * fator;
  linha[posicao + 2] += b * fator;
}

/** Floyd–Steinberg com duas linhas de erros e peso proporcional à opacidade do pixel. */
function floydSteinberg(pixels: PixelBuffer, paleta: readonly CorPaleta[]): PixelBuffer {
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  let erros = new Float32Array((width + 2) * 3);
  let seguintes = new Float32Array(erros.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alfa = data[i + 3];
      if (alfa === 0) continue;
      const posicao = (x + 1) * 3;
      const r = Math.max(0, Math.min(255, data[i] + erros[posicao]));
      const g = Math.max(0, Math.min(255, data[i + 1] + erros[posicao + 1]));
      const b = Math.max(0, Math.min(255, data[i + 2] + erros[posicao + 2]));
      const cor = corMaisProxima(r, g, b, paleta);
      saida[i] = cor[0];
      saida[i + 1] = cor[1];
      saida[i + 2] = cor[2];
      const dr = r - cor[0];
      const dg = g - cor[1];
      const db = b - cor[2];
      const peso = alfa / (255 * 16);
      acumularErro(erros, posicao + 3, dr, dg, db, 7 * peso);
      acumularErro(seguintes, posicao - 3, dr, dg, db, 3 * peso);
      acumularErro(seguintes, posicao, dr, dg, db, 5 * peso);
      acumularErro(seguintes, posicao + 3, dr, dg, db, peso);
    }
    erros.fill(0);
    [erros, seguintes] = [seguintes, erros];
  }
  return { width, height, data: saida };
}

/** Escolhe apenas cores da paleta e preserva o alfa individual dos pixels. */
export function aplicarPaleta(
  pixels: PixelBuffer,
  paleta: readonly CorPaleta[],
  dithering = false,
): PixelBuffer {
  if (paleta.length === 0) return pixels;
  if (dithering) return floydSteinberg(pixels, paleta);
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const cor = corMaisProxima(data[i], data[i + 1], data[i + 2], paleta);
    saida[i] = cor[0];
    saida[i + 1] = cor[1];
    saida[i + 2] = cor[2];
  }
  return { width, height, data: saida };
}

export function reduzirPaleta(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const escolha = parametros.paleta;
  const paleta =
    escolha === 'desenho'
      ? paletaDoDesenho(pixels, parametros.cores)
      : typeof escolha === 'string' && Object.hasOwn(PALETAS_PIXEL_ART, escolha)
        ? PALETAS_PIXEL_ART[escolha as PaletaFixa]
        : PALETAS_PIXEL_ART['pico-8'];
  return aplicarPaleta(pixels, paleta, parametros.dithering === true);
}
