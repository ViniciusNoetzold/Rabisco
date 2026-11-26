/// <reference lib="webworker" />
import type { PixelBuffer, Point } from '../layers/types';
import { planejarPreenchimento } from './pixels';

interface Pedido {
  id: number;
  largura: number;
  altura: number;
  dados: Uint8ClampedArray;
  ponto: Point;
  cor: string;
  tolerancia: number;
  global: boolean;
}

/** Calcula a área do balde fora da thread da tela e devolve a imagem junto (transferida). */
self.onmessage = ({ data }: MessageEvent<Pedido>) => {
  const imagem: PixelBuffer = { width: data.largura, height: data.altura, data: data.dados };
  try {
    const plano = planejarPreenchimento(
      imagem,
      data.ponto.x,
      data.ponto.y,
      data.cor,
      data.tolerancia,
      data.global,
    );
    const transferir: Transferable[] = [data.dados.buffer];
    if (plano) transferir.push(plano.mascara.buffer);
    (self as DedicatedWorkerGlobalScope).postMessage(
      { id: data.id, plano, dados: data.dados },
      transferir,
    );
  } catch (erro) {
    (self as DedicatedWorkerGlobalScope).postMessage(
      { id: data.id, erro: erro instanceof Error ? erro.message : String(erro), dados: data.dados },
      [data.dados.buffer],
    );
  }
};
