import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_BYTES, openPng } from '../../src/io/png';

function pngHeader(width = 2, height = 1): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return bytes;
}

function imageFile(header: Uint8Array, name = 'Desenho.png'): File {
  return new File([new Uint8Array(header)], name, { type: 'image/png' });
}

const decode = vi.fn();
beforeEach(() => {
  decode.mockReset();
  vi.stubGlobal('createImageBitmap', decode);
});
afterEach(() => vi.unstubAllGlobals());

describe('validação de PNG antes da decodificação', () => {
  it('rejeita arquivos acima de 20 MB antes de ler o cabeçalho', async () => {
    const slice = vi.fn();
    const oversized = { size: MAX_IMAGE_BYTES + 1, slice } as unknown as File;
    await expect(openPng(oversized)).rejects.toThrow('20 MB');
    expect(slice).not.toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
  });

  it('rejeita cabeçalhos truncados e arquivos renomeados para .png', async () => {
    await expect(openPng(imageFile(new Uint8Array(10)))).rejects.toThrow('PNG válido');
    await expect(openPng(imageFile(new Uint8Array(33)))).rejects.toThrow('Escolha uma imagem PNG');
    expect(decode).not.toHaveBeenCalled();
  });

  it('exige IHDR com tamanho correto como primeiro bloco', async () => {
    const wrongChunk = pngHeader();
    wrongChunk[12] = 70;
    await expect(openPng(imageFile(wrongChunk))).rejects.toThrow('cabeçalho');
    const wrongLength = pngHeader();
    new DataView(wrongLength.buffer).setUint32(8, 12);
    await expect(openPng(imageFile(wrongLength))).rejects.toThrow('cabeçalho');
    expect(decode).not.toHaveBeenCalled();
  });

  it.each([
    [0, 10],
    [10, 0],
    [4097, 2],
    [2, 4097],
    [4001, 4000],
  ])('recusa dimensões %i × %i antes de alocar um bitmap', async (width, height) => {
    await expect(openPng(imageFile(pngHeader(width, height)))).rejects.toThrow('4096 px');
    expect(decode).not.toHaveBeenCalled();
  });

  it('explica o erro quando o decodificador encontra um PNG corrompido', async () => {
    decode.mockRejectedValueOnce(new Error('Falha interna do decodificador'));
    await expect(openPng(imageFile(pngHeader()))).rejects.toThrow(
      'O arquivo pode estar danificado',
    );
    expect(decode).toHaveBeenCalledOnce();
  });

  it('libera o bitmap se as dimensões decodificadas não correspondem ao cabeçalho', async () => {
    const close = vi.fn();
    decode.mockResolvedValueOnce({ width: 3, height: 1, close });
    await expect(openPng(imageFile(pngHeader()))).rejects.toThrow('dimensões');
    expect(close).toHaveBeenCalledOnce();
  });

  it('libera o bitmap mesmo se o navegador não disponibiliza Canvas 2D', async () => {
    const close = vi.fn();
    decode.mockResolvedValueOnce({ width: 2, height: 1, close });
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    await expect(openPng(imageFile(pngHeader()))).rejects.toThrow('área de desenho');
    expect(close).toHaveBeenCalledOnce();
  });
});
