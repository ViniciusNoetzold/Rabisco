/// <reference lib="webworker" />
import type { PixelBuffer } from '../layers/types';
import { converterAscii, type ArteAscii, type OpcoesAscii } from './ascii';

export interface SolicitacaoAscii {
  tipo: 'converter';
  chave: string;
  opcoes: OpcoesAscii;
}

type PedidoAscii = { tipo: 'origem'; origem: PixelBuffer } | SolicitacaoAscii;

export type RespostaAscii = { chave: string } & ({ arte: ArteAscii } | { erro: string });

const worker = self as DedicatedWorkerGlobalScope;
let origem: PixelBuffer | undefined;

worker.onmessage = ({ data }: MessageEvent<PedidoAscii>) => {
  if (data.tipo === 'origem') {
    origem = data.origem;
    return;
  }
  const { chave, opcoes } = data;
  try {
    if (!origem) throw new Error('A imagem de origem não está disponível.');
    const resposta: RespostaAscii = { chave, arte: converterAscii(origem, opcoes) };
    worker.postMessage(resposta);
  } catch (erro) {
    const resposta: RespostaAscii = {
      chave,
      erro: erro instanceof Error ? erro.message : 'Não foi possível converter a imagem em ASCII.',
    };
    worker.postMessage(resposta);
  }
};
