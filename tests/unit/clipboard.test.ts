import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  copiarImagemClipboard,
  imagemDaTransferencia,
  lerImagemClipboard,
} from '../../src/io/clipboard';

afterEach(() => vi.unstubAllGlobals());

describe('imagem na área de transferência', () => {
  it('encontra arquivos de imagem no drop ou na colagem e ignora texto', () => {
    const texto = new File(['abc'], 'notas.txt', { type: 'text/plain' });
    const imagem = new File(['um arquivo'], 'figura.ICO');
    const item = { kind: 'file', getAsFile: () => imagem };
    expect(
      imagemDaTransferencia({ files: [texto, imagem], items: [] } as unknown as DataTransfer),
    ).toBe(imagem);
    expect(
      imagemDaTransferencia({ files: [texto], items: [item] } as unknown as DataTransfer),
    ).toBe(imagem);
    expect(
      imagemDaTransferencia({ files: [texto], items: [] } as unknown as DataTransfer),
    ).toBeNull();
  });

  it('recorre ao fluxo interno quando o navegador não oferece ou nega acesso direto', async () => {
    vi.stubGlobal('navigator', {});
    await expect(lerImagemClipboard()).resolves.toBeNull();
    await expect(copiarImagemClipboard({} as HTMLCanvasElement)).rejects.toThrow('indisponível');
    vi.stubGlobal('navigator', {
      clipboard: { read: vi.fn().mockRejectedValue(new Error('Negado')) },
    });
    await expect(lerImagemClipboard()).resolves.toBeNull();
  });

  it('prefere PNG e tenta outra representação quando a primeira não pode ser lida', async () => {
    const jpeg = new Blob(['imagem'], { type: 'image/jpeg' });
    const getType = vi
      .fn()
      .mockRejectedValueOnce(new Error('Indisponível'))
      .mockResolvedValueOnce(jpeg);
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi
          .fn()
          .mockResolvedValue([{ types: ['text/plain', 'image/jpeg', 'image/png'], getType }]),
      },
    });
    const imagem = await lerImagemClipboard();
    expect(getType.mock.calls).toEqual([['image/png'], ['image/jpeg']]);
    expect(imagem?.name).toBe('Área de transferência.jpg');
    expect(imagem?.type).toBe('image/jpeg');
  });
});
