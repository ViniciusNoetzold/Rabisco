import { describe, expect, it } from 'vitest';
import { gravarDpiPng, lerDpiPng } from '../../src/io/pngResolution';

// Após IHDR, um IDAT de teste marca onde os pixels começariam.
function fixture() {
  const bytes = new Uint8Array(45);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  bytes.set([73, 68, 65, 84], 37);
  return new Blob([bytes], { type: 'image/png' });
}

describe('resolução física no PNG', () => {
  it('usa 96 DPI quando a imagem não informa resolução', async () => {
    expect(await lerDpiPng(fixture())).toBe(96);
  });

  it('grava pixels por metro e substitui o bloco existente', async () => {
    const original = fixture();
    const png = await gravarDpiPng(original, 300);
    expect(png.size).toBe(original.size + 21);
    const dados = new DataView(await png.arrayBuffer());
    expect(dados.getUint32(37)).toBe(0x70485973);
    expect(dados.getUint32(41)).toBe(11811);
    expect(dados.getUint32(45)).toBe(11811);
    expect(await lerDpiPng(png)).toBe(300);
    const atualizado = await gravarDpiPng(png, 144);
    expect(atualizado.size).toBe(png.size);
    expect(await lerDpiPng(atualizado)).toBe(144);
  });

  it('ignora um bloco de resolução cujo CRC está corrompido', async () => {
    const png = await gravarDpiPng(fixture(), 300);
    const bytes = new Uint8Array(await png.arrayBuffer());
    bytes[53] ^= 1;
    expect(await lerDpiPng(new Blob([bytes]))).toBe(96);
  });
});
