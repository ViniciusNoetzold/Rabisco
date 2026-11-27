/// <reference lib="webworker" />
import { processarFiltro } from './processar';
import type { PedidoFiltro, RespostaFiltro } from './worker';

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = ({ data }: MessageEvent<PedidoFiltro>) => {
  const { antes: entrada, comando, cobertura, travarAlfa, recorte } = data;
  try {
    const { antes, depois: filtrado } = processarFiltro(
      entrada,
      comando,
      cobertura,
      travarAlfa,
      recorte,
    );
    // Uma edição sem efeito devolve só o original. A comparação fica no worker.
    let i = 0;
    if (antes === filtrado) i = antes.data.length;
    while (i < antes.data.length && antes.data[i] === filtrado.data[i]) i++;
    const depois = i === antes.data.length ? antes : filtrado;
    const resultado: RespostaFiltro = { antes, depois };
    const transferir = new Set([antes.data.buffer, depois.data.buffer]);
    worker.postMessage(resultado, [...transferir]);
  } catch (erro) {
    const resposta: RespostaFiltro = { erro: erro instanceof Error ? erro.message : String(erro) };
    worker.postMessage(resposta);
  }
};
