import { describe, expect, it } from 'vitest';
import { codificarBmp, decodificarBmp } from '../../src/io/bmp';
import { codificarGif } from '../../src/io/gif';
import { abrirImagem, dimensoesImagem, identificarFormatoImagem } from '../../src/io/imagens';

const pixels = {
  width: 3,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0, 255, 0, 255, 0, 0, 0, 128, 255, 255, 0, 255,
  ]),
};
const texto = (valor: string) => Array.from(valor, (letra) => letra.charCodeAt(0));

describe('arquivos de imagem', () => {
  it('identifica BMP pelos bytes e recupera cores, orientação e DPI do BMP de 24 bits', async () => {
    const blob = codificarBmp(pixels, 300);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(blob.type).toBe('image/bmp');
    expect(view.getUint16(28, true)).toBe(24);
    expect(bytes.length).toBe(54 + 12 * 2);
    const arquivo = new File([blob], 'Papel.bmp', { type: 'application/octet-stream' });
    const aberto = await abrirImagem(arquivo);
    expect(aberto).toEqual({
      name: 'Papel',
      formato: 'bmp',
      width: 3,
      height: 2,
      dpi: 300,
      pixels: new Uint8ClampedArray([
        255, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255, 0, 255, 0, 255, 127, 127, 127, 255, 255,
        255, 0, 255,
      ]),
    });

    const primeiraLinha = bytes.slice(54, 66);
    bytes.copyWithin(54, 66, 78);
    bytes.set(primeiraLinha, 66);
    view.setInt32(22, -2, true);
    expect(decodificarBmp(bytes)?.data).toEqual(aberto.pixels);
  });

  it('recusa um BMP truncado e limita o cabeçalho antes de ler seus dados inteiros', async () => {
    const bytes = new Uint8Array(await codificarBmp(pixels).arrayBuffer());
    await expect(abrirImagem(new File([bytes.subarray(0, 60)], 'Truncado.bmp'))).rejects.toThrow(
      'danificado',
    );
    new DataView(bytes.buffer).setInt32(18, 65_535, true);
    const arquivo = new File([bytes], 'Grande.bmp');
    arquivo.arrayBuffer = async () => {
      throw new Error('A leitura dos pixels não pode começar');
    };
    await expect(abrirImagem(arquivo)).rejects.toThrow('8192 px');
  });

  it('emite GIF89a com transparência binária e um quadro de dimensões válidas', async () => {
    const blob = codificarGif(pixels);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe('image/gif');
    expect(bytes.slice(0, 6)).toEqual(new Uint8Array(texto('GIF89a')));
    expect(identificarFormatoImagem(bytes)).toBe('gif');
    expect(dimensoesImagem(bytes, 'gif')).toEqual({ width: 3, height: 2 });
    const extensao = 13 + 3 * (2 << (bytes[10] & 7));
    expect(bytes.slice(extensao, extensao + 4)).toEqual(new Uint8Array([0x21, 0xf9, 4, 1]));
    expect(bytes.at(-1)).toBe(0x3b);

    new DataView(bytes.buffer).setUint16(extensao + 9, 1, true);
    expect(() => dimensoesImagem(bytes, 'gif')).toThrow('danificado');
  });

  it('confere dimensões JPEG e densidade JFIF sem decodificar pixels', () => {
    const bytes = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe0,
      0,
      16,
      ...texto('JFIF\0'),
      1,
      1,
      1,
      1,
      44,
      1,
      44,
      0,
      0,
      0xff,
      0xc0,
      0,
      11,
      8,
      0,
      2,
      0,
      3,
      1,
      1,
      0x11,
      0,
      0xff,
      0xd9,
    ]);
    expect(identificarFormatoImagem(bytes)).toBe('jpeg');
    expect(dimensoesImagem(bytes, 'jpeg')).toEqual({ width: 3, height: 2, dpi: 300 });
    expect(() => dimensoesImagem(bytes.subarray(0, 25), 'jpeg')).toThrow('danificado');
  });

  it('confere os tamanhos do contêiner e do quadro WebP', () => {
    const bytes = new Uint8Array([
      ...texto('RIFF'),
      18,
      0,
      0,
      0,
      ...texto('WEBP'),
      ...texto('VP8L'),
      5,
      0,
      0,
      0,
      0x2f,
      0,
      0,
      0,
      0,
      0,
    ]);
    const view = new DataView(bytes.buffer);
    view.setUint32(21, 2 | (1 << 14), true);
    expect(dimensoesImagem(bytes, 'webp')).toEqual({ width: 3, height: 2 });
    expect(() => dimensoesImagem(bytes.subarray(0, -1), 'webp')).toThrow('danificado');
    view.setUint32(21, 8192 | (1 << 14), true);
    expect(() => dimensoesImagem(bytes, 'webp')).toThrow('8192 px');
  });

  it('abre o quadro DIB de um ICO com transparência pela máscara de 1 bit', async () => {
    const blob = codificarBmp({ ...pixels, height: 1, data: pixels.data.slice(0, 12) });
    const dib = new Uint8Array(await blob.slice(14).arrayBuffer());
    new DataView(dib.buffer).setInt32(8, 2, true);
    const dir = new Uint8Array(22);
    dir.set([0, 0, 1, 0, 1, 0, 3, 1]);
    const view = new DataView(dir.buffer);
    view.setUint16(10, 1, true);
    view.setUint16(12, 24, true);
    view.setUint32(14, dib.length + 4, true);
    view.setUint32(18, dir.length, true);
    const arquivo = new File([dir, dib, new Uint8Array([0x20, 0, 0, 0])], 'Ícone.ico');
    const aberto = await abrirImagem(arquivo);
    expect(aberto).toMatchObject({ formato: 'ico', name: 'Ícone', width: 3, height: 1 });
    expect(aberto.pixels).toEqual(
      new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255, 255, 255, 255, 0]),
    );
  });

  it('recusa SVG e arquivos desconhecidos mesmo com nome e MIME de PNG', async () => {
    await expect(
      abrirImagem(
        new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'Imagem.png', {
          type: 'image/png',
        }),
      ),
    ).rejects.toThrow('Escolha uma imagem');
  });
});
