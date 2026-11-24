import type { PixelBuffer } from '../layers/types';

export type CodificarPng = (pixels: PixelBuffer) => Promise<Blob>;

/** Codificação na thread principal, para navegadores sem OffscreenCanvas em workers. */
async function codificarAqui({ width, height, data }: PixelBuffer): Promise<Blob> {
  const tela = document.createElement('canvas');
  tela.width = width;
  tela.height = height;
  tela
    .getContext('2d')!
    .putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return new Promise((resolver, rejeitar) =>
    tela.toBlob(
      (blob) => (blob ? resolver(blob) : rejeitar(new Error('Não foi possível gerar o PNG.'))),
      'image/png',
    ),
  );
}

/**
 * Um worker que transforma blocos em PNG. Os pixels são transferidos (não copiados) para o
 * worker. Se o worker não puder ser criado, a codificação acontece na thread principal.
 */
export function criarCodificadorPng(): { codificar: CodificarPng; encerrar(): void } {
  let worker: Worker | null = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined') {
      worker = new Worker(new URL('./codificadorBlocos.worker.ts', import.meta.url), {
        type: 'module',
      });
    }
  } catch {
    worker = null;
  }
  if (!worker) return { codificar: codificarAqui, encerrar() {} };

  const ativo = worker;
  let proximo = 0;
  const pendentes = new Map<number, { resolver(png: Blob): void; rejeitar(erro: Error): void }>();
  ativo.onmessage = ({ data }: MessageEvent<{ id: number; png?: Blob; erro?: string }>) => {
    const pedido = pendentes.get(data.id);
    if (!pedido) return;
    pendentes.delete(data.id);
    if (data.png) pedido.resolver(data.png);
    else pedido.rejeitar(new Error(data.erro ?? 'Não foi possível gerar o PNG.'));
  };
  ativo.onerror = () => {
    for (const { rejeitar } of pendentes.values()) rejeitar(new Error('O codificador parou.'));
    pendentes.clear();
  };
  return {
    codificar({ width, height, data }) {
      const id = ++proximo;
      // Cópia própria: o buffer é transferido e o chamador pode continuar usando o dele.
      const pixels = new Uint8ClampedArray(data).buffer;
      return new Promise((resolver, rejeitar) => {
        pendentes.set(id, { resolver, rejeitar });
        ativo.postMessage({ id, largura: width, altura: height, pixels }, [pixels]);
      });
    },
    encerrar() {
      ativo.terminate();
      for (const { rejeitar } of pendentes.values()) rejeitar(new Error('O editor foi fechado.'));
      pendentes.clear();
    },
  };
}
