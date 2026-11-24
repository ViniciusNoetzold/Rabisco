import { DPI_PADRAO, dpiValido } from '../document/dimensoes';

const FIM_IHDR = 33;
const METROS_POR_POLEGADA = 0.0254;
const TIPO_PHYS = 0x70485973;
const TIPO_IDAT = 0x49444154;
const TIPO_IEND = 0x49454e44;

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function encontrarBlocoFisico(png: Blob) {
  // pHYs precede IDAT. Leitura limitada aos cabeçalhos para evitar copiar o PNG inteiro.
  let inicio = FIM_IHDR;
  for (let blocos = 0; blocos < 1024 && inicio + 12 <= png.size; blocos++) {
    const cabecalho = new DataView(await png.slice(inicio, inicio + 8).arrayBuffer());
    const tamanho = cabecalho.getUint32(0);
    const tipo = cabecalho.getUint32(4);
    const fim = inicio + 12 + tamanho;
    if (fim > png.size || tipo === TIPO_IDAT || tipo === TIPO_IEND) break;
    if (tipo === TIPO_PHYS) return { inicio, fim, tamanho };
    inicio = fim;
  }
  return null;
}

/** PNG guarda a resolução física em pixels por metro no bloco pHYs. */
export async function lerDpiPng(png: Blob): Promise<number> {
  const bloco = await encontrarBlocoFisico(png);
  if (!bloco || bloco.tamanho !== 9) return DPI_PADRAO;
  const bytes = new Uint8Array(await png.slice(bloco.inicio, bloco.fim).arrayBuffer());
  const dados = new DataView(bytes.buffer);
  const horizontal = dados.getUint32(8);
  const vertical = dados.getUint32(12);
  if (
    bytes[16] !== 1 ||
    horizontal !== vertical ||
    crc32(bytes.subarray(4, 17)) !== dados.getUint32(17)
  ) {
    return DPI_PADRAO;
  }
  const dpi = Math.round(horizontal * METROS_POR_POLEGADA);
  return dpiValido(dpi) ? dpi : DPI_PADRAO;
}

/** Atualiza a resolução sem recodificar a imagem ou os demais metadados. */
export async function gravarDpiPng(png: Blob, dpi: number): Promise<Blob> {
  if (!dpiValido(dpi)) throw new Error('A resolução da imagem é inválida.');
  const anterior = await encontrarBlocoFisico(png);
  const bloco = new Uint8Array(21);
  const dados = new DataView(bloco.buffer);
  const pixelsPorMetro = Math.round(dpi / METROS_POR_POLEGADA);
  dados.setUint32(0, 9);
  dados.setUint32(4, TIPO_PHYS);
  dados.setUint32(8, pixelsPorMetro);
  dados.setUint32(12, pixelsPorMetro);
  bloco[16] = 1;
  dados.setUint32(17, crc32(bloco.subarray(4, 17)));
  return new Blob(
    [png.slice(0, anterior?.inicio ?? FIM_IHDR), bloco, png.slice(anterior?.fim ?? FIM_IHDR)],
    { type: 'image/png' },
  );
}
