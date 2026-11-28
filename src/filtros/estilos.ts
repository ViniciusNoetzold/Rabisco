import { criarAleatorioPincel } from '../brushes/motor';
import type { PixelBuffer } from '../layers/types';
import { pixelizar, type CorPaleta } from './pixelArt';

type Parametros = Readonly<Record<string, unknown>>;

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor));
}

function inteiroEntre(valor: unknown, padrao: number, minimo: number, maximo: number) {
  return typeof valor === 'number' && Number.isFinite(valor)
    ? limitar(Math.round(valor), minimo, maximo)
    : padrao;
}

function corHex(valor: unknown, padrao: CorPaleta): CorPaleta {
  if (typeof valor !== 'string' || !/^#[\da-f]{6}$/i.test(valor)) return padrao;
  const rgb = Number.parseInt(valor.slice(1), 16);
  return [rgb >> 16, (rgb >> 8) & 255, rgb & 255];
}

/** Raio com área proporcional à tinta. Perto de 100%, os pontos fecham os cantos da célula. */
const RAIOS_DE_TINTA = Array.from({ length: 256 }, (_, nivel) => {
  const proporcao = nivel / 255;
  const areaDoCirculoInscrito = Math.PI / 4;
  if (proporcao <= areaDoCirculoInscrito) return Math.sqrt(proporcao / Math.PI);
  const excesso = (proporcao - areaDoCirculoInscrito) / (1 - areaDoCirculoInscrito);
  return 0.5 + (Math.SQRT1_2 - 0.5) * excesso;
});

function reticula(tamanho: number, angulo: number) {
  const radianos = (angulo * Math.PI) / 180;
  const cos = Math.cos(radianos) / tamanho;
  const sen = Math.sin(radianos) / tamanho;
  return (x: number, y: number, nivel: number) => {
    if (nivel <= 0) return 0;
    if (nivel >= 255) return 1;
    const u = x * cos + y * sen;
    const v = y * cos - x * sen;
    const dx = u - Math.floor(u) - 0.5;
    const dy = v - Math.floor(v) - 0.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return limitar((RAIOS_DE_TINTA[nivel] - dist) * tamanho + 0.5, 0, 1);
  };
}

export function meioTom(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const tamanho = inteiroEntre(parametros.tamanho, 9, 3, 64);
  const angulo = inteiroEntre(parametros.angulo, 45, -180, 180);
  const cmyk = parametros.modo === 'cmyk';
  const [vermelho, verde, azul] = corHex(parametros.cor, [0, 0, 0]);
  const preto = reticula(tamanho, angulo);
  const ciano = reticula(tamanho, angulo - 30);
  const magenta = reticula(tamanho, angulo + 30);
  const amarelo = reticula(tamanho, angulo - 45);
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  let i = 0;
  for (let y = 0.5; y < height; y++) {
    for (let x = 0.5; x < width; x++, i += 4) {
      if (!data[i + 3]) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (cmyk) {
        const maximo = Math.max(r, g, b);
        const luz = 255 * (1 - preto(x, y, 255 - maximo));
        const escala = maximo ? 255 / maximo : 0;
        saida[i] = luz * (1 - ciano(x, y, Math.round((maximo - r) * escala)));
        saida[i + 1] = luz * (1 - magenta(x, y, Math.round((maximo - g) * escala)));
        saida[i + 2] = luz * (1 - amarelo(x, y, Math.round((maximo - b) * escala)));
      } else {
        const cinza = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        const tinta = preto(x, y, 255 - cinza);
        saida[i] = 255 + (vermelho - 255) * tinta;
        saida[i + 1] = 255 + (verde - 255) * tinta;
        saida[i + 2] = 255 + (azul - 255) * tinta;
      }
    }
  }
  return { width, height, data: saida };
}

export function mosaico(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const tamanho = inteiroEntre(parametros.tamanho, 12, 2, 128);
  const junta = Math.min(inteiroEntre(parametros.junta, 1, 0, 8), tamanho - 1);
  const [r, g, b] = corHex(parametros.corJuntas, [40, 37, 42]);
  const { width, height, data } = pixels;
  const resultado = pixelizar(pixels, { tamanho });
  const saida = resultado.data;
  let i = 0;
  for (let y = 0; y < height; y++) {
    const juntaHorizontal = y % tamanho < junta;
    for (let x = 0; x < width; x++, i += 4) {
      const alfa = data[i + 3];
      saida[i + 3] = alfa;
      if (!alfa) {
        saida[i] = data[i];
        saida[i + 1] = data[i + 1];
        saida[i + 2] = data[i + 2];
      } else if (juntaHorizontal || x % tamanho < junta) {
        saida[i] = r;
        saida[i + 1] = g;
        saida[i + 2] = b;
      }
    }
  }
  return resultado;
}

function corMediaDaCelula(
  pixels: PixelBuffer,
  x: number,
  y: number,
  tamanho: number,
): CorPaleta | null {
  const { width, height, data } = pixels;
  const direita = Math.min(width, x + tamanho);
  const fundo = Math.min(height, y + tamanho);
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let linha = y; linha < fundo; linha++) {
    let i = (linha * width + x) * 4;
    for (let coluna = x; coluna < direita; coluna++, i += 4) {
      const peso = data[i + 3];
      r += data[i] * peso;
      g += data[i + 1] * peso;
      b += data[i + 2] * peso;
      a += peso;
    }
  }
  return a ? [r / a, g / a, b / a] : null;
}

export function pontilhismo(pixels: PixelBuffer, parametros: Parametros, semente = 1): PixelBuffer {
  const tamanho = inteiroEntre(parametros.tamanho, 8, 3, 64);
  const densidade = inteiroEntre(parametros.densidade, 70, 10, 100) / 100;
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  const aleatorio = criarAleatorioPincel(semente);

  for (let i = 0; i < saida.length; i += 4) {
    if (!data[i + 3]) continue;
    saida[i] = 250;
    saida[i + 1] = 247;
    saida[i + 2] = 239;
  }

  for (let y = 0; y < height; y += tamanho) {
    for (let x = 0; x < width; x += tamanho) {
      const ocupada = aleatorio() < densidade;
      const cx = x + (0.25 + 0.5 * aleatorio()) * Math.min(tamanho, width - x);
      const cy = y + (0.25 + 0.5 * aleatorio()) * Math.min(tamanho, height - y);
      const raio = (0.22 + 0.2 * aleatorio()) * tamanho;
      if (!ocupada) continue;
      const cor = corMediaDaCelula(pixels, x, y, tamanho);
      if (!cor) continue;

      const esquerda = Math.max(0, Math.floor(cx - raio));
      const direita = Math.min(width, Math.ceil(cx + raio));
      const topo = Math.max(0, Math.floor(cy - raio));
      const fundo = Math.min(height, Math.ceil(cy + raio));
      for (let linha = topo; linha < fundo; linha++) {
        const dy = linha + 0.5 - cy;
        for (let coluna = esquerda; coluna < direita; coluna++) {
          const i = (linha * width + coluna) * 4;
          if (!data[i + 3]) continue;
          const dx = coluna + 0.5 - cx;
          const peso = limitar(raio + 0.5 - Math.sqrt(dx * dx + dy * dy), 0, 1);
          saida[i] += (cor[0] - saida[i]) * peso;
          saida[i + 1] += (cor[1] - saida[i + 1]) * peso;
          saida[i + 2] += (cor[2] - saida[i + 2]) * peso;
        }
      }
    }
  }
  return { width, height, data: saida };
}

function centrosDoVitral(pixels: PixelBuffer, tamanho: number, semente: number) {
  const { width, height, data } = pixels;
  const largura = Math.ceil(width / tamanho);
  const altura = Math.ceil(height / tamanho);
  const centros = new Float32Array(largura * altura * 2);
  const cores = new Uint8ClampedArray(largura * altura * 4);
  const aleatorio = criarAleatorioPincel(semente);
  let i = 0;
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++, i++) {
      // Os centros ficam no meio da própria célula, inclusive junto à borda do papel.
      const cx = (x + 0.25 + aleatorio() * 0.5) * tamanho;
      const cy = (y + 0.25 + aleatorio() * 0.5) * tamanho;
      centros[2 * i] = cx;
      centros[2 * i + 1] = cy;
      const ix = Math.min(width - 1, Math.floor(cx));
      const iy = Math.min(height - 1, Math.floor(cy));
      const posicao = (iy * width + ix) * 4;
      if (data[posicao + 3]) {
        cores[4 * i] = data[posicao];
        cores[4 * i + 1] = data[posicao + 1];
        cores[4 * i + 2] = data[posicao + 2];
        cores[4 * i + 3] = 255;
      } else {
        const cor = corMediaDaCelula(pixels, x * tamanho, y * tamanho, tamanho);
        if (!cor) continue;
        cores[4 * i] = cor[0];
        cores[4 * i + 1] = cor[1];
        cores[4 * i + 2] = cor[2];
        cores[4 * i + 3] = 255;
      }
    }
  }
  return { largura, altura, centros, cores };
}

export function vitral(pixels: PixelBuffer, parametros: Parametros, semente = 1): PixelBuffer {
  const tamanho = inteiroEntre(parametros.tamanho, 18, 3, 128);
  const borda = Math.min(inteiroEntre(parametros.borda, 1, 0, 8), tamanho - 1);
  const corBorda = corHex(parametros.corBorda, [32, 33, 38]);
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  const { largura, altura, centros, cores } = centrosDoVitral(pixels, tamanho, semente);
  const alcanceDaBorda = borda * 0.5 + 0.5;
  let i = 0;

  for (let y = 0.5; y < height; y++) {
    const celulaY = Math.floor(y / tamanho);
    const topo = Math.max(0, celulaY - 1);
    const fundo = Math.min(altura - 1, celulaY + 1);
    const topoDaBorda = Math.max(0, celulaY - 2);
    const fundoDaBorda = Math.min(altura - 1, celulaY + 2);
    for (let x = 0.5; x < width; x++, i += 4) {
      if (!data[i + 3]) continue;
      const celulaX = Math.floor(x / tamanho);
      let menorDistancia = Infinity;
      let maisProximo = 0;
      // Como cada centro está no meio de sua célula, o vencedor fica na janela de 3 × 3.
      const esquerda = Math.max(0, celulaX - 1);
      const direita = Math.min(largura - 1, celulaX + 1);
      for (let yy = topo; yy <= fundo; yy++) {
        const fim = yy * largura + direita;
        for (let atual = yy * largura + esquerda; atual <= fim; atual++) {
          const dx = x - centros[2 * atual];
          const dy = y - centros[2 * atual + 1];
          const distancia = dx * dx + dy * dy;
          if (distancia >= menorDistancia) continue;
          menorDistancia = distancia;
          maisProximo = atual;
        }
      }

      const iCor = maisProximo * 4;
      if (cores[iCor + 3]) {
        saida[i] = cores[iCor];
        saida[i + 1] = cores[iCor + 1];
        saida[i + 2] = cores[iCor + 2];
      }
      if (!borda) continue;

      // A célula pode tocar mais de um vizinho. Use a distância até a mediatriz mais próxima.
      const cx = centros[maisProximo * 2];
      const cy = centros[maisProximo * 2 + 1];
      let distanciaDaBorda = alcanceDaBorda ** 2;
      const esquerdaDaBorda = Math.max(0, celulaX - 2);
      const direitaDaBorda = Math.min(largura - 1, celulaX + 2);
      for (let yy = topoDaBorda; yy <= fundoDaBorda; yy++) {
        const fim = yy * largura + direitaDaBorda;
        for (let atual = yy * largura + esquerdaDaBorda; atual <= fim; atual++) {
          if (atual === maisProximo) continue;
          const outroX = centros[atual * 2];
          const outroY = centros[atual * 2 + 1];
          const dx = x - outroX;
          const dy = y - outroY;
          const diferenca = dx * dx + dy * dy - menorDistancia;
          const divisor = 4 * ((outroX - cx) ** 2 + (outroY - cy) ** 2);
          const numerador = diferenca * diferenca;
          if (numerador < divisor * distanciaDaBorda) distanciaDaBorda = numerador / divisor;
        }
      }
      const peso = limitar(alcanceDaBorda - Math.sqrt(distanciaDaBorda), 0, 1);
      saida[i] += (corBorda[0] - saida[i]) * peso;
      saida[i + 1] += (corBorda[1] - saida[i + 1]) * peso;
      saida[i + 2] += (corBorda[2] - saida[i + 2]) * peso;
    }
  }
  return { width, height, data: saida };
}

function amostrarCanal(data: Uint8ClampedArray, centro: number, vizinho: number, canal: number) {
  return (
    data[centro + canal] +
    (data[vizinho + canal] - data[centro + canal]) * (data[vizinho + 3] / 255)
  );
}

export function efeitoCrt(pixels: PixelBuffer, parametros: Parametros): PixelBuffer {
  const linhas = inteiroEntre(parametros.linhas, 25, 0, 100);
  const periodo = inteiroEntre(parametros.periodo, 3, 2, 8);
  const separacao = inteiroEntre(parametros.separacao, 2, 0, 8);
  if (!linhas && !separacao) return pixels;
  const { width, height, data } = pixels;
  const saida = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    const brilho = y % periodo === periodo - 1 ? 1 - linhas / 100 : 1;
    const inicioDaLinha = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = inicioDaLinha + x * 4;
      if (!data[i + 3]) continue;
      const esquerda = inicioDaLinha + Math.max(0, x - separacao) * 4;
      const direita = inicioDaLinha + Math.min(width - 1, x + separacao) * 4;
      saida[i] = amostrarCanal(data, i, esquerda, 0) * brilho;
      saida[i + 1] = data[i + 1] * brilho;
      saida[i + 2] = amostrarCanal(data, i, direita, 2) * brilho;
    }
  }
  return { width, height, data: saida };
}
