import {
  DPI_PADRAO,
  LIMITE_LADO,
  LIMITE_PIXELS,
  dpiValido,
  validarDimensoes,
} from '../document/dimensoes';
import type { PixelBuffer } from '../layers/types';
import { codificarBmp, decodificarBmp, dimensoesBmp } from './bmp';
import { codificarGif } from './gif';
import { openPng, type OpenedPng } from './png';
import { gravarDpiPng } from './pngResolution';

export type FormatoImagem = 'png' | 'jpeg' | 'bmp' | 'gif' | 'webp' | 'ico';
export type FormatoExportacao = Exclude<FormatoImagem, 'ico'>;
export type EscalaExportacao = 1 | 2 | 4 | 8;
export interface OpcoesExportacao {
  nome: string;
  formato: FormatoExportacao | import('./camadas').FormatoCamadas;
  qualidade: number;
  escala?: EscalaExportacao;
}
export interface ImagemAberta extends OpenedPng {
  formato: FormatoImagem;
}

export { TIPOS_IMAGEM } from './formatosImagem';

const MIMES: Record<FormatoImagem, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  bmp: 'image/bmp',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
};

interface Dimensoes {
  width: number;
  height: number;
  dpi?: number;
}

function textoEm(bytes: Uint8Array, inicio: number, esperado: string): boolean {
  for (let i = 0; i < esperado.length; i++) {
    if (bytes[inicio + i] !== esperado.charCodeAt(i)) return false;
  }
  return true;
}

export function identificarFormatoImagem(bytes: Uint8Array): FormatoImagem | null {
  if (textoEm(bytes, 0, '\x89PNG\r\n\x1a\n')) return 'png';
  if (textoEm(bytes, 0, '\xff\xd8\xff')) return 'jpeg';
  if (textoEm(bytes, 0, 'BM')) return 'bmp';
  if (textoEm(bytes, 0, 'GIF87a') || textoEm(bytes, 0, 'GIF89a')) return 'gif';
  if (textoEm(bytes, 0, 'RIFF') && textoEm(bytes, 8, 'WEBP')) return 'webp';
  if (textoEm(bytes, 0, '\0\0\x01\0')) return 'ico';
  return null;
}

function arquivoDanificado(formato: FormatoImagem): never {
  throw new Error(
    `O arquivo ${formato.toUpperCase()} está danificado ou usa uma variante incompatível.`,
  );
}

function dimensoesJpeg(bytes: Uint8Array, view: DataView): Dimensoes {
  let posicao = 2;
  let dpi = DPI_PADRAO;
  while (posicao < bytes.length) {
    if (bytes[posicao++] !== 0xff) break;
    while (bytes[posicao] === 0xff) posicao++;
    const marcador = bytes[posicao++];
    if (marcador === 0xd9 || marcador === 0xda || posicao + 2 > bytes.length) break;
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) continue;
    const tamanho = view.getUint16(posicao);
    if (tamanho < 2 || posicao + tamanho > bytes.length) break;
    const eQuadro = marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador);
    if (eQuadro && tamanho >= 8) {
      return { width: view.getUint16(posicao + 5), height: view.getUint16(posicao + 3), dpi };
    }
    if (marcador === 0xe0 && tamanho >= 16 && textoEm(bytes, posicao + 2, 'JFIF\0')) {
      const unidade = bytes[posicao + 9];
      const densidade = view.getUint16(posicao + 10);
      const calculado = Math.round(densidade * (unidade === 2 ? 2.54 : 1));
      if (
        unidade &&
        unidade <= 2 &&
        densidade === view.getUint16(posicao + 12) &&
        dpiValido(calculado)
      )
        dpi = calculado;
    }
    posicao += tamanho;
  }
  return arquivoDanificado('jpeg');
}

function dimensoesGif(bytes: Uint8Array, view: DataView): Dimensoes {
  if (bytes.length < 13) return arquivoDanificado('gif');
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  validarDimensoes(width, height);
  const paleta = bytes[10] & 0x80 ? 3 * (2 << (bytes[10] & 7)) : 0;
  let posicao = 13 + paleta;
  while (posicao < bytes.length) {
    const tipo = bytes[posicao++];
    if (tipo === 0x2c && posicao + 9 <= bytes.length) {
      const esquerda = view.getUint16(posicao, true);
      const topo = view.getUint16(posicao + 2, true);
      const w = view.getUint16(posicao + 4, true);
      const h = view.getUint16(posicao + 6, true);
      validarDimensoes(w, h);
      if (esquerda + w > width || topo + h > height) return arquivoDanificado('gif');
      return { width, height };
    }
    if (tipo !== 0x21) break;
    posicao++;
    while (posicao < bytes.length) {
      const tamanho = bytes[posicao++];
      if (tamanho === 0) break;
      posicao += tamanho;
    }
  }
  return arquivoDanificado('gif');
}

function dimensoesWebp(bytes: Uint8Array, view: DataView): Dimensoes {
  if (bytes.length < 20) return arquivoDanificado('webp');
  const fim = view.getUint32(4, true) + 8;
  const ler24 = (p: number) => bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16);
  if (fim > bytes.length || fim < 20) return arquivoDanificado('webp');

  let tela: Dimensoes | undefined;
  let quadro: Dimensoes | undefined;
  for (let p = 12; p + 8 <= fim; ) {
    const tamanho = view.getUint32(p + 4, true);
    const inicio = p + 8;
    const proximo = inicio + tamanho + (tamanho & 1);
    if (proximo > fim) return arquivoDanificado('webp');
    if (textoEm(bytes, p, 'VP8X') && tamanho === 10) {
      tela = { width: ler24(inicio + 4) + 1, height: ler24(inicio + 7) + 1 };
      validarDimensoes(tela.width, tela.height);
    } else if (
      textoEm(bytes, p, 'VP8 ') &&
      tamanho >= 10 &&
      textoEm(bytes, inicio + 3, '\x9d\x01\x2a')
    ) {
      quadro = {
        width: view.getUint16(inicio + 6, true) & 0x3fff,
        height: view.getUint16(inicio + 8, true) & 0x3fff,
      };
    } else if (textoEm(bytes, p, 'VP8L') && tamanho >= 5 && bytes[inicio] === 0x2f) {
      const medidas = view.getUint32(inicio + 1, true);
      quadro = { width: 1 + (medidas & 0x3fff), height: 1 + ((medidas >>> 14) & 0x3fff) };
    } else if (textoEm(bytes, p, 'ANMF') && tamanho >= 16 && tela) {
      const width = ler24(inicio + 6) + 1;
      const height = ler24(inicio + 9) + 1;
      validarDimensoes(width, height);
      if (ler24(inicio) * 2 + width > tela.width || ler24(inicio + 3) * 2 + height > tela.height)
        return arquivoDanificado('webp');
      return tela;
    }
    if (quadro) {
      if (tela && (tela.width !== quadro.width || tela.height !== quadro.height))
        return arquivoDanificado('webp');
      return quadro;
    }
    p = proximo;
  }
  return arquivoDanificado('webp');
}

/** Confere o cabeçalho e os limites do documento antes de decodificar. */
export function dimensoesImagem(
  bytes: Uint8Array,
  formato: Exclude<FormatoImagem, 'ico'>,
): Dimensoes {
  if (identificarFormatoImagem(bytes) !== formato) return arquivoDanificado(formato);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let dimensoes: Dimensoes;
  switch (formato) {
    case 'png':
      if (bytes.length < 33 || view.getUint32(8) !== 13 || !textoEm(bytes, 12, 'IHDR'))
        return arquivoDanificado('png');
      dimensoes = { width: view.getUint32(16), height: view.getUint32(20) };
      break;
    case 'jpeg':
      dimensoes = dimensoesJpeg(bytes, view);
      break;
    case 'gif':
      dimensoes = dimensoesGif(bytes, view);
      break;
    case 'webp':
      dimensoes = dimensoesWebp(bytes, view);
      break;
    case 'bmp':
      dimensoes = dimensoesBmp(bytes);
      break;
  }
  validarDimensoes(dimensoes.width, dimensoes.height);
  return dimensoes;
}

function lerPixels(canvas: HTMLCanvasElement): PixelBuffer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('O navegador não conseguiu acessar os pixels da imagem.');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function pixelsDoQuadro(
  imagem: CanvasImageSource,
  width: number,
  height: number,
  esperado: Dimensoes,
  formato: FormatoImagem,
): PixelBuffer {
  validarDimensoes(width, height);
  const medidasDiretas = width === esperado.width && height === esperado.height;
  const girada = formato === 'jpeg' && width === esperado.height && height === esperado.width;
  if (!medidasDiretas && !girada) return arquivoDanificado(formato);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('O navegador não conseguiu abrir a área de desenho.');
  ctx.drawImage(imagem, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}

async function decodificarNoNavegador(
  blob: Blob,
  dimensoes: Dimensoes,
  formato: FormatoImagem,
): Promise<PixelBuffer> {
  let quadro: ImageBitmap | undefined;
  if (typeof createImageBitmap === 'function') {
    try {
      quadro = await createImageBitmap(blob);
    } catch {
      // Alguns navegadores decodificam mais formatos pelo elemento de imagem.
    }
  }
  if (quadro) {
    try {
      return pixelsDoQuadro(quadro, quadro.width, quadro.height, dimensoes, formato);
    } finally {
      quadro.close();
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const imagem = new Image();
    imagem.src = url;
    try {
      await imagem.decode();
    } catch {
      return arquivoDanificado(formato);
    }
    return pixelsDoQuadro(imagem, imagem.naturalWidth, imagem.naturalHeight, dimensoes, formato);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function abrirIco(arquivo: File, bytes: Uint8Array): Promise<PixelBuffer> {
  if (bytes.length < 6) return arquivoDanificado('ico');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const quantidade = view.getUint16(4, true);
  const inicioDados = 6 + quantidade * 16;
  if (quantidade === 0 || quantidade > 128 || inicioDados > bytes.length)
    return arquivoDanificado('ico');
  const entradas = [];
  for (let i = 0; i < quantidade; i++) {
    const p = 6 + i * 16;
    const width = bytes[p] || 256;
    const height = bytes[p + 1] || 256;
    const bits = view.getUint16(p + 6, true);
    const tamanho = view.getUint32(p + 8, true);
    const inicio = view.getUint32(p + 12, true);
    if (inicio >= inicioDados && tamanho && inicio + tamanho <= bytes.length)
      entradas.push({ width, height, bits, inicio, tamanho });
  }
  entradas.sort((a, b) => b.width * b.height - a.width * a.height || b.bits - a.bits);
  for (const dimensoes of entradas) {
    const { inicio, tamanho } = dimensoes;
    const quadro = bytes.subarray(inicio, inicio + tamanho);
    try {
      if (identificarFormatoImagem(quadro) === 'png') {
        const internas = dimensoesImagem(quadro, 'png');
        if (dimensoes.width !== internas.width || dimensoes.height !== internas.height) continue;
        return await decodificarNoNavegador(
          arquivo.slice(inicio, inicio + tamanho, 'image/png'),
          internas,
          'ico',
        );
      }
      const dib = decodificarBmp(quadro, dimensoes);
      if (dib) return dib;
    } catch {
      // Um arquivo ICO pode conter outras resoluções válidas.
    }
  }
  return arquivoDanificado('ico');
}

export async function abrirImagem(arquivo: File): Promise<ImagemAberta> {
  const inicio = new Uint8Array(await arquivo.slice(0, 70).arrayBuffer());
  const formato = identificarFormatoImagem(inicio);
  if (!formato) throw new Error('Escolha uma imagem PNG, JPEG, BMP, GIF, WebP ou ICO.');
  if (formato === 'png') return { ...(await openPng(arquivo)), formato };
  const maximo = formato === 'bmp' ? LIMITE_PIXELS * 4 + LIMITE_LADO * 3 + 4096 : 64 * 1024 * 1024;
  if (arquivo.size > maximo) throw new Error('O arquivo é grande demais para abrir com segurança.');
  const medidasBmp = formato === 'bmp' ? dimensoesBmp(inicio, arquivo.size) : null;
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const nome = arquivo.name.replace(/\.(png|jpe?g|bmp|gif|webp|ico)$/i, '') || 'Sem título';
  let pixels: PixelBuffer;
  let dpi = DPI_PADRAO;
  if (formato === 'ico') {
    pixels = await abrirIco(arquivo, bytes);
  } else {
    const dimensoes = medidasBmp ?? dimensoesImagem(bytes, formato);
    dpi = dimensoes.dpi ?? DPI_PADRAO;
    const bitmap = formato === 'bmp' ? decodificarBmp(bytes) : null;
    pixels =
      bitmap ??
      (await decodificarNoNavegador(
        arquivo.slice(0, arquivo.size, MIMES[formato]),
        dimensoes,
        formato,
      ));
  }
  return {
    name: nome,
    width: pixels.width,
    height: pixels.height,
    dpi,
    pixels: pixels.data,
    formato,
  };
}

function fundoBranco(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const copia = document.createElement('canvas');
  copia.width = canvas.width;
  copia.height = canvas.height;
  const ctx = copia.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('O navegador não conseguiu preparar a imagem para salvar.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, copia.width, copia.height);
  ctx.drawImage(canvas, 0, 0);
  return copia;
}

function ampliarImagem(
  canvas: HTMLCanvasElement,
  largura: number,
  altura: number,
): HTMLCanvasElement {
  const copia = document.createElement('canvas');
  copia.width = largura;
  copia.height = altura;
  const ctx = copia.getContext('2d');
  if (!ctx) throw new Error('O navegador não conseguiu ampliar a imagem para salvar.');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, largura, altura);
  return copia;
}

export async function exportarImagem(
  canvas: HTMLCanvasElement,
  formato: FormatoExportacao,
  qualidade = 0.92,
  dpi = DPI_PADRAO,
  escala: EscalaExportacao = 1,
): Promise<Blob> {
  const largura = canvas.width * escala;
  const altura = canvas.height * escala;
  validarDimensoes(largura, altura);
  if (escala !== 1) canvas = ampliarImagem(canvas, largura, altura);
  if (formato === 'bmp') return codificarBmp(lerPixels(canvas), dpi);
  if (formato === 'gif') return codificarGif(lerPixels(canvas));
  const origem = formato === 'jpeg' ? fundoBranco(canvas) : canvas;
  const mime = MIMES[formato];
  const blob = await new Promise<Blob>((resolve, reject) => {
    origem.toBlob(
      (resultado) => {
        if (resultado?.type === mime) resolve(resultado);
        else reject(new Error(`O navegador não conseguiu salvar em ${formato.toUpperCase()}.`));
      },
      mime,
      qualidade,
    );
  });
  return formato === 'png' ? gravarDpiPng(blob, dpi) : blob;
}

export function baixarImagem(blob: Blob, nome: string, formato: FormatoExportacao): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const nomeSeguro =
    nome
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .trim()
      .replace(/\.(png|jpe?g|bmp|gif|webp|ico)$/i, '') || 'Meu rabisco';
  const extensao = formato === 'jpeg' ? 'jpg' : formato;
  link.download = `${nomeSeguro}.${extensao}`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
