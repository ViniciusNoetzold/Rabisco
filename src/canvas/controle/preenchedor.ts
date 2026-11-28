import type { Comando } from '../../commands/comandos';
import type { PixelBuffer, Rect } from '../../layers/types';
import { aplicarPreenchimento, planejarPreenchimento, preservarAlfa } from '../../tools/pixels';
import { medirOperacao } from '../medicao';

type ComandoPreencher = Extract<Comando, { tipo: 'Preencher' }>;
export type PlanoDoBalde = ReturnType<typeof planejarPreenchimento>;

/** A partir daqui (px), o balde calcula a área num worker. */
export const PIXELS_PARA_WORKER = 1_000_000;
const PIXELS_POR_FAIXA = 65_536;
const FAIXAS_POR_QUADRO = 8;
const ORCAMENTO_MS = 5;

function proximoQuadro(sinal?: AbortSignal): Promise<void> {
  if (sinal?.aborted) return Promise.resolve();
  return new Promise((resolver) => {
    const oculto = document.hidden;
    const agendamento = oculto ? window.setTimeout(concluir, 16) : requestAnimationFrame(concluir);
    sinal?.addEventListener('abort', concluir, { once: true });

    function concluir() {
      sinal?.removeEventListener('abort', concluir);
      if (oculto) clearTimeout(agendamento);
      else cancelAnimationFrame(agendamento);
      resolver();
    }
  });
}

/** Prepara a alteração fora do documento. Um cancelamento descarta os dois buffers. */
export async function prepararPreenchimentoEmFaixas(
  plano: NonNullable<PlanoDoBalde>,
  lerFaixa: (area: Rect) => PixelBuffer,
  ativo: () => boolean,
  {
    antesCompleto,
    travarAlfa = false,
    sinal,
    aguardarQuadro = proximoQuadro,
  }: {
    antesCompleto?: PixelBuffer;
    travarAlfa?: boolean;
    sinal?: AbortSignal;
    aguardarQuadro?: (sinal?: AbortSignal) => Promise<void>;
  } = {},
): Promise<{ before: PixelBuffer; after: PixelBuffer } | null> {
  const valido = () => !sinal?.aborted && ativo();
  if (!valido()) return null;
  const { area } = plano;
  const { width, height } = area;
  const criar = () => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });
  const before = antesCompleto ?? criar();
  const after = criar();
  const linhasPorFaixa = Math.max(1, Math.floor(PIXELS_POR_FAIXA / width));
  let houveMudanca = false;
  let linha = 0;

  while (linha < height) {
    await aguardarQuadro(sinal);
    if (!valido()) return null;
    const inicioDoQuadro = performance.now();
    for (let faixa = 0; faixa < FAIXAS_POR_QUADRO && linha < height; faixa++) {
      const linhas = Math.min(linhasPorFaixa, height - linha);
      medirOperacao('balde:faixa', () => {
        const inicio = linha * width * 4;
        const fim = inicio + linhas * width * 4;
        const origem = { ...area, y: area.y + linha, height: linhas };
        const dadosOriginais = antesCompleto
          ? before.data.subarray(inicio, fim)
          : lerFaixa(origem).data;
        if (!antesCompleto) before.data.set(dadosOriginais, inicio);
        const saida = { width, height: linhas, data: after.data.subarray(inicio, fim) };
        saida.data.set(dadosOriginais);
        aplicarPreenchimento(saida, plano, origem);
        if (travarAlfa)
          saida.data.set(preservarAlfa({ ...saida, data: dadosOriginais }, saida).data);
        houveMudanca ||= dadosOriginais.some((byte, i) => byte !== saida.data[i]);
      });
      linha += linhas;
      if (performance.now() - inicioDoQuadro >= ORCAMENTO_MS) break;
    }
  }
  return valido() && houveMudanca ? { before, after } : null;
}

/**
 * Calcula a área do balde num Web Worker. Os pixels vão e voltam transferidos (sem cópia). Sem
 * worker (ou se ele falhar), calcula aqui mesmo.
 */
export function criarPreenchedor() {
  let worker: Worker | null = null;
  let tentouCriar = false;
  let proximo = 0;
  const pendentes = new Map<
    number,
    {
      resolver(resposta: { plano: PlanoDoBalde; referencia: PixelBuffer }): void;
      rejeitar(erro: Error): void;
      largura: number;
      altura: number;
      removerAbort(): void;
    }
  >();
  function desligar(erro: Error) {
    worker?.terminate();
    worker = null;
    for (const pedido of pendentes.values()) {
      pedido.removerAbort();
      pedido.rejeitar(erro);
    }
    pendentes.clear();
  }

  function obterWorker(): Worker | null {
    if (tentouCriar) return worker;
    tentouCriar = true;
    try {
      if (typeof Worker === 'undefined') return null;
      worker = new Worker(new URL('../../tools/preenchimento.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      return null;
    }
    const ligado = worker;
    ligado.onerror = (evento) => {
      if (worker !== ligado) return;
      evento.preventDefault();
      desligar(new Error(evento.message || 'O worker do balde falhou.'));
    };
    ligado.onmessageerror = () => {
      if (worker === ligado) desligar(new Error('Não foi possível receber a área do balde.'));
    };
    ligado.onmessage = ({
      data,
    }: MessageEvent<{
      id: number;
      plano?: PlanoDoBalde;
      dados: Uint8ClampedArray;
      erro?: string;
    }>) => {
      if (worker !== ligado) return;
      const pedido = pendentes.get(data.id);
      if (!pedido) return;
      pendentes.delete(data.id);
      pedido.removerAbort();
      if (data.erro) pedido.rejeitar(new Error(data.erro));
      else
        pedido.resolver({
          plano: data.plano ?? null,
          referencia: { width: pedido.largura, height: pedido.altura, data: data.dados },
        });
    };
    return ligado;
  }

  return {
    get noWorker() {
      return obterWorker() !== null;
    },
    planejar(
      referencia: PixelBuffer,
      comando: ComandoPreencher,
      sinal?: AbortSignal,
    ): Promise<{ plano: PlanoDoBalde; referencia: PixelBuffer }> {
      sinal?.throwIfAborted();
      const { ponto, cor, tolerancia, global = false } = comando;
      const ligado = obterWorker();
      if (!ligado)
        return Promise.resolve({
          plano: planejarPreenchimento(referencia, ponto.x, ponto.y, cor, tolerancia, global),
          referencia,
        });
      const id = ++proximo;
      return new Promise((resolver, rejeitar) => {
        const abortar = () => {
          if (worker !== ligado) return;
          tentouCriar = false;
          desligar(new Error('Preenchimento cancelado.'));
        };
        const removerAbort = () => sinal?.removeEventListener('abort', abortar);
        sinal?.addEventListener('abort', abortar, { once: true });
        pendentes.set(id, {
          resolver,
          rejeitar,
          largura: referencia.width,
          altura: referencia.height,
          removerAbort,
        });
        try {
          ligado.postMessage(
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
        } catch (erro) {
          pendentes.delete(id);
          removerAbort();
          rejeitar(erro);
        }
      });
    },
    encerrar() {
      tentouCriar = true;
      desligar(new Error('Editor encerrado.'));
    },
  };
}
