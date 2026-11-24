import type { PixelBuffer } from '../layers/types';
import { parseHexColor } from '../tools/pixels';
import { validarDimensoes } from './dimensoes';
import { comoImageData } from './model';

function criarPixels(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function comoPalavras({ data }: PixelBuffer): Uint32Array {
  const bytes = data.byteOffset % 4 === 0 ? data : new Uint8ClampedArray(data);
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/** A área existente mantém seus canais RGBA, inclusive quando é transparente. */
export function redimensionarPapel(
  imagem: PixelBuffer,
  largura: number,
  altura: number,
  cor: string,
): PixelBuffer {
  validarDimensoes(largura, altura);
  const recorteLargura = Math.min(largura, imagem.width);
  const recorteAltura = Math.min(altura, imagem.height);
  const fundo = new Uint32Array(new Uint8ClampedArray(parseHexColor(cor)).buffer)[0];
  const resultado = criarPixels(largura, altura);
  const origem = comoPalavras(imagem);
  const destino = comoPalavras(resultado);
  for (let y = 0; y < recorteAltura; y++) {
    const inicio = y * largura;
    const inicioOrigem = y * imagem.width;
    destino.set(origem.subarray(inicioOrigem, inicioOrigem + recorteLargura), inicio);
    destino.fill(fundo, inicio + recorteLargura, inicio + largura);
  }
  destino.fill(fundo, recorteAltura * largura);
  return resultado;
}

export function girarPixels(imagem: PixelBuffer, graus: 90 | -90 | 180): PixelBuffer {
  const { width, height } = imagem;
  const origem = comoPalavras(imagem);
  const resultado = graus === 180 ? criarPixels(width, height) : criarPixels(height, width);
  const destino = comoPalavras(resultado);

  if (graus === 180) {
    for (let i = 0; i < origem.length; i++) destino[origem.length - 1 - i] = origem[i];
  } else if (graus === 90) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) destino[x * height + height - 1 - y] = origem[y * width + x];
    }
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) destino[(width - 1 - x) * height + y] = origem[y * width + x];
    }
  }
  return resultado;
}

export function inverterPixels(imagem: PixelBuffer, eixo: 'horizontal' | 'vertical'): PixelBuffer {
  const { width, height } = imagem;
  const origem = comoPalavras(imagem);
  const resultado = criarPixels(width, height);
  const destino = comoPalavras(resultado);
  for (let y = 0; y < height; y++) {
    const inicio = y * width;
    if (eixo === 'vertical') {
      destino.set(origem.subarray(inicio, inicio + width), (height - 1 - y) * width);
    } else {
      for (let x = 0; x < width; x++) destino[inicio + width - 1 - x] = origem[inicio + x];
    }
  }
  return resultado;
}

export function calcularInclinacao(
  largura: number,
  altura: number,
  horizontal: number,
  vertical: number,
) {
  validarDimensoes(largura, altura);
  if (![horizontal, vertical].every((graus) => Number.isFinite(graus) && Math.abs(graus) <= 89)) {
    throw new Error('Use valores de inclinação entre −89° e 89°.');
  }

  // A inclinação vertical acontece depois da horizontal. Assim a matriz não colapsa
  // a imagem quando as duas inclinações são de 45 graus.
  const b = Math.tan((vertical * Math.PI) / 180);
  const c = Math.tan((horizontal * Math.PI) / 180);
  const d = 1 + b * c;
  const x = [0, largura, altura * c, largura + altura * c];
  const y = [0, largura * b, altura * d, largura * b + altura * d];
  const esquerda = Math.min(...x);
  const topo = Math.min(...y);
  const width = Math.ceil(Math.max(...x) - esquerda);
  const height = Math.ceil(Math.max(...y) - topo);
  validarDimensoes(width, height);
  return { width, height, a: 1, b, c, d, e: -esquerda, f: -topo };
}

function criarSuperficie(largura: number, altura: number) {
  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;
  const contexto = tela.getContext('2d');
  if (!contexto) throw new Error('Não foi possível preparar a transformação.');
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  return contexto;
}

function liberarSuperficie(tela: HTMLCanvasElement) {
  tela.width = 1;
  tela.height = 1;
}

export function redimensionarEInclinar(
  imagem: PixelBuffer,
  largura: number,
  altura: number,
  horizontal: number,
  vertical: number,
): PixelBuffer {
  const matriz = calcularInclinacao(largura, altura, horizontal, vertical);
  if (imagem.width === largura && imagem.height === altura && !horizontal && !vertical)
    return imagem;
  let atual = criarSuperficie(imagem.width, imagem.height);
  atual.putImageData(comoImageData(imagem), 0, 0);

  function escalar(proximaLargura: number, proximaAltura: number) {
    const proxima = criarSuperficie(proximaLargura, proximaAltura);
    try {
      proxima.drawImage(atual.canvas, 0, 0, proximaLargura, proximaAltura);
    } catch (erro) {
      liberarSuperficie(proxima.canvas);
      throw erro;
    }
    liberarSuperficie(atual.canvas);
    atual = proxima;
  }

  try {
    while (atual.canvas.width > largura || atual.canvas.height > altura) {
      const { width, height } = atual.canvas;
      // Reduzir antes de ampliar a outra dimensão evita alocar um intermediário enorme.
      const proximaLargura = width > largura ? Math.max(largura, Math.ceil(width / 2)) : width;
      const proximaAltura = height > altura ? Math.max(altura, Math.ceil(height / 2)) : height;
      escalar(proximaLargura, proximaAltura);
    }
    if (atual.canvas.width !== largura || atual.canvas.height !== altura) escalar(largura, altura);
    if (!horizontal && !vertical) return atual.getImageData(0, 0, largura, altura);

    const inclinada = criarSuperficie(matriz.width, matriz.height);
    try {
      inclinada.setTransform(matriz.a, matriz.b, matriz.c, matriz.d, matriz.e, matriz.f);
      inclinada.drawImage(atual.canvas, 0, 0);
      return inclinada.getImageData(0, 0, matriz.width, matriz.height);
    } finally {
      liberarSuperficie(inclinada.canvas);
    }
  } finally {
    liberarSuperficie(atual.canvas);
  }
}

/** Compõe a seleção transformada sobre a área editada sem apagar seu entorno transparente. */
export function sobreporPixels(origem: PixelBuffer, destino: PixelBuffer, x: number, y: number) {
  const largura = Math.min(origem.width, destino.width - x);
  const altura = Math.min(origem.height, destino.height - y);
  const { data } = destino;
  for (let linha = 0; linha < altura; linha++) {
    for (let coluna = 0; coluna < largura; coluna++) {
      const fonte = (linha * origem.width + coluna) * 4;
      const alvo = ((linha + y) * destino.width + x + coluna) * 4;
      const alfa = origem.data[fonte + 3];
      if (!alfa) continue;
      if (alfa === 255 || !data[alvo + 3]) {
        data[alvo] = origem.data[fonte];
        data[alvo + 1] = origem.data[fonte + 1];
        data[alvo + 2] = origem.data[fonte + 2];
        data[alvo + 3] = alfa;
        continue;
      }
      const restante = data[alvo + 3] * (1 - alfa / 255);
      const total = alfa + restante;
      for (let canal = 0; canal < 3; canal++) {
        data[alvo + canal] =
          (origem.data[fonte + canal] * alfa + data[alvo + canal] * restante) / total;
      }
      data[alvo + 3] = total;
    }
  }
}
