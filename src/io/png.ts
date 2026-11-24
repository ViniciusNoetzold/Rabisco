import { DPI_PADRAO, MENSAGEM_DIMENSOES, dimensoesValidas } from '../document/dimensoes';
import { gravarDpiPng, lerDpiPng } from './pngResolution';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export interface OpenedPng {
  name: string;
  width: number;
  height: number;
  dpi: number;
  pixels: Uint8ClampedArray;
}

/** Confere o cabeçalho antes de pedir ao navegador uma alocação para decodificar. */
async function readPngDimensions(file: File): Promise<{ width: number; height: number }> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Este PNG é muito grande. Escolha um arquivo de até 20 MB.');
  }
  if (file.size < 33) throw new Error('O arquivo não é um PNG válido.');

  const header = new Uint8Array(await file.slice(0, 33).arrayBuffer());
  if (!PNG_SIGNATURE.every((byte, index) => header[index] === byte)) {
    throw new Error('Escolha uma imagem PNG. Outros formatos chegarão nas próximas etapas.');
  }
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const chunkName = String.fromCharCode(...header.subarray(12, 16));
  if (view.getUint32(8) !== 13 || chunkName !== 'IHDR') {
    throw new Error('O cabeçalho desta imagem PNG está danificado.');
  }
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!dimensoesValidas(width, height)) throw new Error(MENSAGEM_DIMENSOES);
  return { width, height };
}

export async function openPng(file: File): Promise<OpenedPng> {
  const { width, height } = await readPngDimensions(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Não foi possível abrir este PNG. O arquivo pode estar danificado.');
  }
  try {
    if (bitmap.width !== width || bitmap.height !== height) {
      throw new Error('As dimensões deste PNG são inconsistentes.');
    }
    const dpi = await lerDpiPng(file);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Seu navegador não conseguiu abrir a área de desenho.');
    context.drawImage(bitmap, 0, 0);
    return {
      name: file.name.replace(/\.png$/i, '') || 'Sem título',
      width,
      height,
      dpi,
      pixels: context.getImageData(0, 0, width, height).data,
    };
  } finally {
    bitmap.close();
  }
}

/** A exportação usa Blob, evitando o custo de uma segunda cópia em base64. */
export async function exportPng(
  canvas: HTMLCanvasElement,
  name: string,
  dpi = DPI_PADRAO,
): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Não foi possível gerar o PNG. Tente salvar novamente.'));
    }, 'image/png');
  });
  const url = URL.createObjectURL(await gravarDpiPng(blob, dpi));
  const link = document.createElement('a');
  link.href = url;
  const safeName = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim() || 'Meu rabisco';
  link.download = `${safeName.replace(/\.png$/i, '')}.png`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // O download pode iniciar depois do clique; a URL continua válida por um instante.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
