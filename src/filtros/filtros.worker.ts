/// <reference lib="webworker" />
import { processarFiltro } from './processar';
import type { PedidoFiltro, RespostaFiltro } from './worker';

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = ({ data }: MessageEvent<PedidoFiltro>) => {
  const { antes, comando, cobertura, travarAlfa } = data;
  try {
    const filtrado = processarFiltro(antes, comando, cobertura, travarAlfa);
    // Uma edição sem efeito devolve só o original. A comparação fica no worker.
    const depois = antes.data.every((byte, i) => byte === filtrado.data[i]) ? antes : filtrado;
    const resultado: RespostaFiltro = { antes, depois };
    const transferir = new Set([antes.data.buffer, depois.data.buffer]);
    worker.postMessage(resultado, [...transferir]);
  } catch (erro) {
    const resposta: RespostaFiltro = { erro: erro instanceof Error ? erro.message : String(erro) };
    worker.postMessage(resposta);
  }
};
