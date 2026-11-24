import { DPI_PADRAO, dpiValido, validarDimensoes } from '../document/dimensoes';
import type { PixelBuffer } from '../layers/types';

interface CabecalhoBmp {
  largura: number;
  altura: number;
  invertida: boolean;
  bits: number;
  compressao: number;
  inicioPixels: number;
  inicioPaleta: number;
  tamanhoCor: number;
  cores: number;
  mascaras: number[];
  dpi: number;
}

function bmpInvalido(): never {
  throw new Error('O arquivo BMP ou o quadro do ícone está danificado.');
}

function lerCabecalho(
  arquivo: Uint8Array,
  icone?: { width: number; height: number },
  tamanhoTotal = arquivo.length,
): CabecalhoBmp {
  const view = new DataView(arquivo.buffer, arquivo.byteOffset, arquivo.byteLength);
  const inicio = icone ? 0 : 14;
  if (arquivo.length < inicio + 12) bmpInvalido();
  if (!icone && (arquivo[0] !== 0x42 || arquivo[1] !== 0x4d)) bmpInvalido();
  const tamanho = view.getUint32(inicio, true);
  const antigo = tamanho === 12;
  if (
    (!antigo && (tamanho < 40 || arquivo.length < inicio + 40)) ||
    inicio + tamanho > tamanhoTotal
  )
    bmpInvalido();

  const largura = antigo ? view.getUint16(inicio + 4, true) : view.getInt32(inicio + 4, true);
  const alturaBruta = antigo ? view.getUint16(inicio + 6, true) : view.getInt32(inicio + 8, true);
  const altura = icone?.height ?? Math.abs(alturaBruta);
  validarDimensoes(largura, altura);
  if (icone && (largura !== icone.width || Math.abs(alturaBruta) !== altura * 2)) bmpInvalido();
  const planos = view.getUint16(inicio + (antigo ? 8 : 12), true);
  const bits = view.getUint16(inicio + (antigo ? 10 : 14), true);
  const compressao = antigo ? 0 : view.getUint32(inicio + 16, true);
  if (planos !== 1) bmpInvalido();

  let inicioPaleta = inicio + tamanho;
  const mascaras: number[] = [];
  if (compressao === 3 || compressao === 6) {
    const inicioMascaras = inicio + 40;
    const quantidade = compressao === 6 || tamanho >= 56 ? 4 : 3;
    if (inicioMascaras + quantidade * 4 > arquivo.length) bmpInvalido();
    for (let i = 0; i < quantidade; i++)
      mascaras.push(view.getUint32(inicioMascaras + i * 4, true));
    inicioPaleta = Math.max(inicioPaleta, inicioMascaras + quantidade * 4);
  } else if (bits === 16) {
    mascaras.push(0x7c00, 0x03e0, 0x001f);
  }

  const tamanhoCor = antigo ? 3 : 4;
  const cores =
    bits > 0 && bits <= 8 ? (antigo ? 0 : view.getUint32(inicio + 32, true)) || 2 ** bits : 0;
  const fimPaleta = inicioPaleta + tamanhoCor * cores;
  const inicioPixels = icone ? fimPaleta : view.getUint32(10, true);
  if (inicioPixels < fimPaleta || inicioPixels > tamanhoTotal || cores > 256) bmpInvalido();

  const porMetro = antigo ? 0 : view.getInt32(inicio + 24, true);
  const dpi = Math.round(porMetro * 0.0254);
  return {
    largura,
    altura,
    invertida: alturaBruta < 0,
    bits,
    compressao,
    inicioPixels,
    inicioPaleta,
    tamanhoCor,
    cores,
    mascaras,
    dpi: dpiValido(dpi) ? dpi : DPI_PADRAO,
  };
}

export function dimensoesBmp(
  arquivo: Uint8Array,
  tamanhoTotal?: number,
): { width: number; height: number; dpi: number } {
  const { largura, altura, dpi } = lerCabecalho(arquivo, undefined, tamanhoTotal);
  return { width: largura, height: altura, dpi };
}

function extratorCanal(mascara: number): (pixel: number) => number {
  if (!mascara) return () => 255;
  const deslocamento = 31 - Math.clz32(mascara & -mascara);
  const maximo = mascara >>> deslocamento;
  if ((maximo & (maximo + 1)) !== 0) bmpInvalido();
  return (pixel) => (((pixel & mascara) >>> deslocamento) * 255) / maximo;
}

/** Decodifica BMP sem compressão e bitfields. O navegador cobre variantes comprimidas. */
export function decodificarBmp(
  arquivo: Uint8Array,
  icone?: { width: number; height: number },
): PixelBuffer | null {
  const {
    largura,
    altura,
    invertida,
    bits,
    compressao,
    inicioPixels,
    inicioPaleta,
    tamanhoCor,
    cores,
    mascaras,
  } = lerCabecalho(arquivo, icone);
  if (
    ![1, 4, 8, 16, 24, 32].includes(bits) ||
    (compressao !== 0 && !((compressao === 3 || compressao === 6) && (bits === 16 || bits === 32)))
  )
    return null;

  const passo = Math.ceil((largura * bits) / 32) * 4;
  const inicioMascaraIcone = inicioPixels + passo * altura;
  if (inicioMascaraIcone > arquivo.length) bmpInvalido();
  const passoMascara = Math.ceil(largura / 32) * 4;
  const temMascara = !!icone && arquivo.length >= inicioMascaraIcone + passoMascara * altura;
  const view = new DataView(arquivo.buffer, arquivo.byteOffset, arquivo.byteLength);
  const data = new Uint8ClampedArray(largura * altura * 4);
  const canais = mascaras.map(extratorCanal);
  let iconeUsaAlfa = false;

  for (let y = 0; y < altura; y++) {
    const linha = inicioPixels + (invertida ? y : altura - 1 - y) * passo;
    for (let x = 0; x < largura; x++) {
      const dest = (y * largura + x) * 4;
      data[dest + 3] = 255;
      if (bits <= 8) {
        const deslocamento = x * bits;
        const indice =
          (arquivo[linha + (deslocamento >> 3)] >> (8 - bits - (deslocamento % 8))) &
          ((1 << bits) - 1);
        if (indice >= cores) bmpInvalido();
        const origem = inicioPaleta + indice * tamanhoCor;
        data[dest] = arquivo[origem + 2];
        data[dest + 1] = arquivo[origem + 1];
        data[dest + 2] = arquivo[origem];
      } else if (canais.length) {
        const valor =
          bits === 16 ? view.getUint16(linha + x * 2, true) : view.getUint32(linha + x * 4, true);
        for (let canal = 0; canal < canais.length; canal++)
          data[dest + canal] = canais[canal](valor);
      } else {
        const origem = linha + x * (bits / 8);
        data[dest] = arquivo[origem + 2];
        data[dest + 1] = arquivo[origem + 1];
        data[dest + 2] = arquivo[origem];
        if (icone && bits === 32) data[dest + 3] = arquivo[origem + 3];
      }
      if (data[dest + 3] > 0) iconeUsaAlfa = true;
    }
  }

  if (temMascara) {
    for (let y = 0; y < altura; y++) {
      const linha = inicioMascaraIcone + (invertida ? y : altura - 1 - y) * passoMascara;
      for (let x = 0; x < largura; x++) {
        const alfa = (y * largura + x) * 4 + 3;
        const transparente = arquivo[linha + (x >> 3)] & (0x80 >> x % 8);
        if (transparente) data[alfa] = 0;
        else if (!iconeUsaAlfa) data[alfa] = 255;
      }
    }
  }
  return { width: largura, height: altura, data };
}

/** BMP Windows de 24 bits com linhas alinhadas em quatro bytes e fundo branco. */
export function codificarBmp({ width, height, data }: PixelBuffer, dpi = DPI_PADRAO): Blob {
  validarDimensoes(width, height);
  if (data.length !== width * height * 4) throw new Error('Os pixels deste BMP estão incompletos.');
  const passo = Math.ceil((width * 3) / 4) * 4;
  const inicio = 54;
  const bytes = new Uint8Array(inicio + passo * height);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, inicio, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, passo * height, true);
  const porMetro = Math.round((dpiValido(dpi) ? dpi : DPI_PADRAO) / 0.0254);
  view.setInt32(38, porMetro, true);
  view.setInt32(42, porMetro, true);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const origem = (y * width + x) * 4;
      const dest = inicio + (height - 1 - y) * passo + x * 3;
      const alfa = data[origem + 3] / 255;
      for (let canal = 0; canal < 3; canal++) {
        bytes[dest + canal] = Math.round(255 + (data[origem + 2 - canal] - 255) * alfa);
      }
    }
  }
  return new Blob([bytes], { type: 'image/bmp' });
}
