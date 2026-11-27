import type { ComandoAplicarFiltro } from '../commands/comandos';
import type { PreparoFiltro } from '../commands/executador';
import type { PixelBuffer } from '../layers/types';
import { processarFiltro } from './processar';

export type PedidoFiltro = Pick<PreparoFiltro, 'antes' | 'cobertura' | 'travarAlfa'> & {
  comando: ComandoAplicarFiltro;
};

interface ResultadoFiltro {
  antes: PixelBuffer;
  depois: PixelBuffer;
}

export type RespostaFiltro = ResultadoFiltro | { erro: string };

/** Transfere a imagem e a cobertura da seleção. O original volta para entrar no histórico. */
export async function calcularFiltro(
  comando: ComandoAplicarFiltro,
  preparo: PreparoFiltro,
  sinal: AbortSignal,
): Promise<ResultadoFiltro> {
  sinal.throwIfAborted();
  const { antes, cobertura, travarAlfa } = preparo;
  if (typeof Worker === 'undefined')
    return { antes, depois: processarFiltro(antes, comando, cobertura, travarAlfa) };

  const worker = new Worker(new URL('./filtros.worker.ts', import.meta.url), { type: 'module' });
  const { filtro, parametros, semente, area } = comando;
  // A cobertura já representa a seleção em pixels. Não copie o contorno ou os intervalos dela.
  const pedido: PedidoFiltro = {
    comando: { tipo: 'AplicarFiltro', filtro, parametros, semente, area },
    antes,
    cobertura,
    travarAlfa,
  };
  const transferir: Transferable[] = [antes.data.buffer];
  if (cobertura) transferir.push(cobertura.buffer);

  return new Promise((resolver, rejeitar) => {
    function encerrar() {
      sinal.removeEventListener('abort', cancelar);
      worker.terminate();
    }

    function cancelar() {
      encerrar();
      rejeitar(new DOMException('Filtro cancelado.', 'AbortError'));
    }

    sinal.addEventListener('abort', cancelar, { once: true });
    worker.onmessage = ({ data }: MessageEvent<RespostaFiltro>) => {
      encerrar();
      if ('erro' in data) rejeitar(new Error(data.erro));
      else resolver(data);
    };
    worker.onerror = (evento) => {
      evento.preventDefault();
      encerrar();
      rejeitar(new Error(evento.message || 'Não foi possível executar o filtro.'));
    };
    worker.onmessageerror = () => {
      encerrar();
      rejeitar(new Error('Não foi possível ler o resultado do filtro.'));
    };

    try {
      worker.postMessage(pedido, transferir);
    } catch (erro) {
      encerrar();
      rejeitar(erro);
    }
  });
}
