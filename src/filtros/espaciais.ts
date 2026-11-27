import { criarAleatorioPincel } from '../brushes/motor';
import type { PixelBuffer } from '../layers/types';

type Parametros = Readonly<Record<string, unknown>>;

function limitarParametro(valor: unknown, padrao: number, minimo: number, maximo: number) {
  return typeof valor === 'number' && Number.isFinite(valor)
    ? Math.min(maximo, Math.max(minimo, valor))
    : padrao;
}

/** Reflexão na borda entre pixels, inclusive quando o raio excede o lado da imagem. */
function refletir(posicao: number, tamanho: number) {
  if (posicao >= 0 && posicao < tamanho) return posicao;
  const periodo = 2 * tamanho;
  const volta = ((posicao % periodo) + periodo) % periodo;
  return volta < tamanho ? volta : periodo - volta - 1;
}

function colunasDosVizinhos(largura: number, deslocamentos: readonly number[]) {
  const colunas = new Int32Array(largura * deslocamentos.length);
  let i = 0;
  for (let x = 0; x < largura; x++) {
    for (const dx of deslocamentos) colunas[i++] = refletir(x + dx, largura) * 4;
  }
  return colunas;
}

function pesosDaGaussiana(raio: number) {
  const sigma = raio / 2;
  const pesos = Array.from({ length: 2 * raio + 1 }, (_, i) =>
    Math.exp(-((i - raio) ** 2) / (2 * sigma * sigma)),
  );
  const soma = pesos.reduce((total, peso) => total + peso, 0);
  return pesos.map((peso) => peso / soma);
}

function gaussiana(pixels: PixelBuffer, raio: number, nitidez?: number): PixelBuffer {
  const { width, height, data } = pixels;
  if (!raio || !width || !height || nitidez === 0) return pixels;

  const pesos = pesosDaGaussiana(raio);
  const colunas = colunasDosVizinhos(
    width,
    pesos.map((_, i) => i - raio),
  );
  const bytesPorLinha = width * 4;
  // Cada faixa horizontal filtrada fica disponível até sair da janela vertical.
  const totalFaixas = Math.min(height, pesos.length);
  const faixas = new Float32Array(totalFaixas * bytesPorLinha);
  const linhasDasFaixas = new Int32Array(totalFaixas).fill(-1);
  const vizinhosVerticais = new Int32Array(pesos.length);
  const saida =
    nitidez === undefined ? new Uint8ClampedArray(data.length) : new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let k = 0; k < pesos.length; k++) {
      const linha = refletir(y + k - raio, height);
      const faixa = linha % totalFaixas;
      const destino = faixa * bytesPorLinha;
      vizinhosVerticais[k] = destino;
      if (linhasDasFaixas[faixa] === linha) continue;

      linhasDasFaixas[faixa] = linha;
      const origem = linha * bytesPorLinha;
      for (let x = 0, coluna = 0; x < bytesPorLinha; x += 4) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let j = 0; j < pesos.length; j++) {
          const i = origem + colunas[coluna++];
          const pesoAlfa = data[i + 3] * pesos[j];
          r += data[i] * pesoAlfa;
          g += data[i + 1] * pesoAlfa;
          b += data[i + 2] * pesoAlfa;
          a += pesoAlfa;
        }
        faixas[destino + x] = r;
        faixas[destino + x + 1] = g;
        faixas[destino + x + 2] = b;
        faixas[destino + x + 3] = a;
      }
    }

    for (let x = 0; x < bytesPorLinha; x += 4) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < pesos.length; k++) {
        const i = vizinhosVerticais[k] + x;
        const peso = pesos[k];
        r += faixas[i] * peso;
        g += faixas[i + 1] * peso;
        b += faixas[i + 2] * peso;
        a += faixas[i + 3] * peso;
      }
      const i = y * bytesPorLinha + x;
      if (nitidez === undefined) {
        saida[i + 3] = a;
        if (!saida[i + 3]) continue;
        saida[i] = r / a;
        saida[i + 1] = g / a;
        saida[i + 2] = b / a;
      } else if (data[i + 3]) {
        saida[i] = data[i] + (data[i] - r / a) * nitidez;
        saida[i + 1] = data[i + 1] + (data[i + 1] - g / a) * nitidez;
        saida[i + 2] = data[i + 2] + (data[i + 2] - b / a) * nitidez;
      }
    }
  }
  return { width, height, data: saida };
}

export function desfoqueGaussiano(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const raio = Math.round(limitarParametro(parametros.raio, 3, 0, 24));
  return gaussiana(pixels, raio);
}

export function mascaraNitidez(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const raio = Math.round(limitarParametro(parametros.raio, 2, 0, 24));
  const intensidade = limitarParametro(parametros.intensidade, 80, 0, 200) / 100;
  return gaussiana(pixels, raio, intensidade);
}

function amostrasDeMovimento(raio: number, angulo: number) {
  const amostras = new Map<string, { x: number; y: number; peso: number }>();
  const cos = Math.cos(angulo);
  const sen = Math.sin(angulo);
  const total = raio * 2 + 1;
  for (let passo = -raio; passo <= raio; passo++) {
    const x = passo * cos;
    const y = passo * sen;
    const esquerda = Math.floor(x);
    const topo = Math.floor(y);
    // Acumula uma vez os pesos da interpolação bilinear de cada ponto da linha.
    for (let yy = topo; yy <= topo + 1; yy++) {
      for (let xx = esquerda; xx <= esquerda + 1; xx++) {
        const peso = ((1 - Math.abs(xx - x)) * (1 - Math.abs(yy - y))) / total;
        if (peso <= 1e-10) continue;
        const chave = `${xx},${yy}`;
        const anterior = amostras.get(chave);
        if (anterior) anterior.peso += peso;
        else amostras.set(chave, { x: xx, y: yy, peso });
      }
    }
  }
  return [...amostras.values()];
}

export function desfoqueMovimento(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const raio = Math.round(limitarParametro(parametros.raio, 6, 0, 24));
  const angulo = (limitarParametro(parametros.angulo, 0, -180, 180) * Math.PI) / 180;
  const { width, height, data } = pixels;
  if (!raio || !width || !height) return pixels;

  const amostras = amostrasDeMovimento(raio, angulo);
  const pesos = amostras.map(({ peso }) => peso);
  const colunas = colunasDosVizinhos(
    width,
    amostras.map(({ x }) => x),
  );
  const linhas = new Int32Array(amostras.length);
  const saida = new Uint8ClampedArray(data.length);
  let destino = 0;
  for (let y = 0; y < height; y++) {
    for (let k = 0; k < amostras.length; k++)
      linhas[k] = refletir(y + amostras[k].y, height) * width * 4;
    for (let x = 0, coluna = 0; x < width; x++, destino += 4) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < amostras.length; k++) {
        const i = linhas[k] + colunas[coluna++];
        const pesoAlfa = data[i + 3] * pesos[k];
        r += data[i] * pesoAlfa;
        g += data[i + 1] * pesoAlfa;
        b += data[i + 2] * pesoAlfa;
        a += pesoAlfa;
      }
      saida[destino + 3] = a;
      if (!saida[destino + 3]) continue;
      saida[destino] = r / a;
      saida[destino + 1] = g / a;
      saida[destino + 2] = b / a;
    }
  }
  return { width, height, data: saida };
}

export function adicionarRuido(
  pixels: PixelBuffer,
  parametros: Parametros,
  semente = 1,
): PixelBuffer {
  const amplitude = (limitarParametro(parametros.intensidade, 15, 0, 100) / 100) * 255;
  if (amplitude === 0) return pixels;
  const monocromatico = parametros.monocromatico !== false;
  const aleatorio = criarAleatorioPincel(semente);
  const deslocamento = () => (2 * aleatorio() - 1) * amplitude;
  const saida = new Uint8ClampedArray(pixels.data);
  for (let i = 0; i < saida.length; i += 4) {
    const r = deslocamento();
    const g = monocromatico ? r : deslocamento();
    const b = monocromatico ? r : deslocamento();
    if (!saida[i + 3]) continue;
    saida[i] += r;
    saida[i + 1] += g;
    saida[i + 2] += b;
  }
  return { ...pixels, data: saida };
}

/** Mediana ponderada pelo alfa, com faixas de 16 valores para localizar a posição. */
function valorMediano(histograma: Int32Array, faixas: Int32Array, canal: number, meio: number) {
  const base = canal * 256;
  const inicioDasFaixas = canal * 16;
  let faixa = 0;
  while (meio > faixas[inicioDasFaixas + faixa]) meio -= faixas[inicioDasFaixas + faixa++];
  let nivel = faixa * 16;
  while (meio > histograma[base + nivel]) meio -= histograma[base + nivel++];
  return nivel;
}

export function reduzirRuidoMediana(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const raio = Math.round(limitarParametro(parametros.raio, 1, 1, 3));
  const { width, height, data } = pixels;
  if (!width || !height) return pixels;
  const saida = new Uint8ClampedArray(data);
  const linhas = new Int32Array(2 * raio + 1);
  const histograma = new Int32Array(3 * 256);
  const faixas = new Int32Array(3 * 16);
  let pesoTotal = 0;

  function atualizarColuna(x: number, direcao: number) {
    const coluna = refletir(x, width) * 4;
    for (const linha of linhas) {
      const i = linha + coluna;
      const peso = data[i + 3] * direcao;
      pesoTotal += peso;
      for (let canal = 0; canal < 3; canal++) {
        const valor = data[i + canal];
        histograma[canal * 256 + valor] += peso;
        faixas[canal * 16 + (valor >> 4)] += peso;
      }
    }
  }

  for (let y = 0; y < height; y++) {
    histograma.fill(0);
    faixas.fill(0);
    pesoTotal = 0;
    for (let k = 0; k < linhas.length; k++) linhas[k] = refletir(y + k - raio, height) * width * 4;
    for (let x = -raio; x <= raio; x++) atualizarColuna(x, 1);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]) {
        const meio = Math.ceil(pesoTotal / 2);
        for (let canal = 0; canal < 3; canal++)
          saida[i + canal] = valorMediano(histograma, faixas, canal, meio);
      }
      atualizarColuna(x - raio, -1);
      atualizarColuna(x + raio + 1, 1);
    }
  }
  return { width, height, data: saida };
}

function luminancia(data: Uint8ClampedArray, i: number) {
  return data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
}

function luminanciaSobreCentro(data: Uint8ClampedArray, i: number, centro: number) {
  // Amostra a cor pré-multiplicada sobre a cor central. Transparência total não cria um degrau.
  return centro + (luminancia(data, i) - centro) * (data[i + 3] / 255);
}

export function detectarBordas(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const intensidade = limitarParametro(parametros.intensidade, 100, 0, 200) / 100;
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  const linha = width * 4;
  for (let y = 0; y < height; y++) {
    const acima = Math.max(0, y - 1) * linha;
    const abaixo = Math.min(height - 1, y + 1) * linha;
    const atual = y * linha;
    for (let x = 0; x < linha; x += 4) {
      const i = atual + x;
      if (!data[i + 3]) continue;
      const esquerda = Math.max(0, x - 4);
      const direita = Math.min(linha - 4, x + 4);
      const centro = luminancia(data, i);
      const supEsq = luminanciaSobreCentro(data, acima + esquerda, centro);
      const supDir = luminanciaSobreCentro(data, acima + direita, centro);
      const infEsq = luminanciaSobreCentro(data, abaixo + esquerda, centro);
      const infDir = luminanciaSobreCentro(data, abaixo + direita, centro);
      const lateral =
        luminanciaSobreCentro(data, atual + direita, centro) -
        luminanciaSobreCentro(data, atual + esquerda, centro);
      const vertical =
        luminanciaSobreCentro(data, abaixo + x, centro) -
        luminanciaSobreCentro(data, acima + x, centro);
      const gx = supDir + infDir - supEsq - infEsq + 2 * lateral;
      const gy = infEsq + infDir - supEsq - supDir + 2 * vertical;
      const valor = Math.sqrt(gx * gx + gy * gy) * intensidade;
      saida[i] = saida[i + 1] = saida[i + 2] = valor;
    }
  }
  return { width, height, data: saida };
}

export function aplicarRelevo(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const intensidade = limitarParametro(parametros.intensidade, 100, 0, 200) / 100;
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  const linha = width * 4;
  for (let y = 0; y < height; y++) {
    const acima = Math.max(0, y - 1) * linha;
    const abaixo = Math.min(height - 1, y + 1) * linha;
    for (let x = 0; x < linha; x += 4) {
      const i = y * linha + x;
      if (!data[i + 3]) continue;
      const centro = luminancia(data, i);
      const escuro = luminanciaSobreCentro(data, acima + Math.max(0, x - 4), centro);
      const claro = luminanciaSobreCentro(data, abaixo + Math.min(linha - 4, x + 4), centro);
      const valor = 128 + (claro - escuro) * intensidade;
      saida[i] = saida[i + 1] = saida[i + 2] = valor;
    }
  }
  return { width, height, data: saida };
}
