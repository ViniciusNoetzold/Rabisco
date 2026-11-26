import type { Comando } from '../../commands/comandos';
import type { PixelBuffer } from '../../layers/types';
import { planejarPreenchimento } from '../../tools/pixels';

type ComandoPreencher = Extract<Comando, { tipo: 'Preencher' }>;
export type PlanoDoBalde = ReturnType<typeof planejarPreenchimento>;

/** A partir daqui (px), o balde calcula a área num worker: a tela não trava. */
export const PIXELS_PARA_WORKER = 1_000_000;

/**
 * Calcula a área do balde num Web Worker. Os pixels vão e voltam transferidos (sem cópia). Sem
 * worker (ou se ele falhar), calcula aqui mesmo.
 */
export function criarPreenchedor() {
  let worker: Worker | null = null;
  try {
    if (typeof Worker !== 'undefined')
      worker = new Worker(new URL('../../tools/preenchimento.worker.ts', import.meta.url), {
        type: 'module',
      });
  } catch {
    worker = null;
  }
  let proximo = 0;
  const pendentes = new Map<
    number,
    {
      resolver(resposta: { plano: PlanoDoBalde; referencia: PixelBuffer }): void;
      rejeitar(erro: Error): void;
      largura: number;
      altura: number;
    }
  >();
  if (worker)
    worker.onmessage = ({
      data,
    }: MessageEvent<{
      id: number;
      plano?: PlanoDoBalde;
      dados: Uint8ClampedArray;
      erro?: string;
    }>) => {
      const pedido = pendentes.get(data.id);
      if (!pedido) return;
      pendentes.delete(data.id);
      if (data.erro) pedido.rejeitar(new Error(data.erro));
      else
        pedido.resolver({
          plano: data.plano ?? null,
          referencia: { width: pedido.largura, height: pedido.altura, data: data.dados },
        });
    };

  return {
    get noWorker() {
      return worker !== null;
    },
    planejar(
      referencia: PixelBuffer,
      comando: ComandoPreencher,
    ): Promise<{ plano: PlanoDoBalde; referencia: PixelBuffer }> {
      const { ponto, cor, tolerancia, global = false } = comando;
      if (!worker)
        return Promise.resolve({
          plano: planejarPreenchimento(referencia, ponto.x, ponto.y, cor, tolerancia, global),
          referencia,
        });
      const id = ++proximo;
      return new Promise((resolver, rejeitar) => {
        pendentes.set(id, {
          resolver,
          rejeitar,
          largura: referencia.width,
          altura: referencia.height,
        });
        worker!.postMessage(
          {
            id,
            largura: referencia.width,
            altura: referencia.height,
            dados: referencia.data,
            ponto,
            cor,
            tolerancia,
            global,
          },
          [referencia.data.buffer],
        );
      });
    },
    encerrar() {
      worker?.terminate();
      worker = null;
      for (const pedido of pendentes.values()) pedido.rejeitar(new Error('Editor encerrado.'));
      pendentes.clear();
    },
  };
}
