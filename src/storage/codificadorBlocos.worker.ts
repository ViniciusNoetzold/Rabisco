/// <reference lib="webworker" />
/** Converte blocos RGBA em PNG fora da thread da interface. */

interface Pedido {
  id: number;
  largura: number;
  altura: number;
  pixels: ArrayBuffer;
}

self.onmessage = async ({ data }: MessageEvent<Pedido>) => {
  const { id, largura, altura, pixels } = data;
  try {
    const tela = new OffscreenCanvas(largura, altura);
    const contexto = tela.getContext('2d');
    if (!contexto) throw new Error('Sem contexto 2D no worker.');
    contexto.putImageData(new ImageData(new Uint8ClampedArray(pixels), largura, altura), 0, 0);
    const png = await tela.convertToBlob({ type: 'image/png' });
    self.postMessage({ id, png });
  } catch (erro) {
    self.postMessage({ id, erro: erro instanceof Error ? erro.message : String(erro) });
  }
};
