import { ErroHorde, type PedidoHorde, type ResultadoHorde, type criarClienteHorde } from './horde';

type Cliente = ReturnType<typeof criarClienteHorde>;

export type AndamentoIA = {
  fase: 'enviando' | 'esperando' | 'processando' | 'recebendo';
  posicao?: number;
  segundos?: number;
  avisos?: string[];
  semComputador?: boolean;
};

type Conclusao =
  | { tipo: 'imagem'; resultado: ResultadoHorde }
  | { tipo: 'cancelado'; confirmado: boolean };

function esperar(ms: number, sinal: AbortSignal): Promise<void> {
  sinal.throwIfAborted();
  return new Promise((resolver, rejeitar) => {
    const cancelar = () => {
      clearTimeout(temporizador);
      rejeitar(sinal.reason);
    };
    const temporizador = setTimeout(() => {
      sinal.removeEventListener('abort', cancelar);
      resolver();
    }, ms);
    sinal.addEventListener('abort', cancelar, { once: true });
  });
}

function erroTemporario(erro: unknown): boolean {
  return (
    erro instanceof TypeError ||
    (erro instanceof DOMException && erro.name === 'TimeoutError') ||
    (erro instanceof ErroHorde &&
      (erro.codigo === 'Rede' || erro.status === 429 || (erro.status ?? 0) >= 500))
  );
}

export async function processarPedidoIA(
  cliente: Cliente,
  pedido: PedidoHorde,
  sinal: AbortSignal,
  publicar: (estado: AndamentoIA) => void,
  aguardar = esperar,
): Promise<Conclusao> {
  if (sinal.aborted) return { tipo: 'cancelado', confirmado: true };
  let id: string | undefined;
  try {
    publicar({ fase: 'enviando' });
    // Aguarde o identificador mesmo se a pessoa cancelar durante o envio. Ele permite cancelar
    // uma requisição que já tenha entrado na fila enquanto a resposta ainda estava a caminho.
    const envio = await cliente.enviar(pedido, AbortSignal.timeout(30_000));
    id = envio.id;
    sinal.throwIfAborted();
    const limite = Date.now() + 30 * 60 * 1000;
    let intervalo = 4000;
    let falhas = 0;
    publicar({ fase: 'esperando', avisos: envio.avisos });
    while (Date.now() < limite) {
      await aguardar(intervalo, sinal);
      const consulta = await cliente
        .consultar(id, AbortSignal.any([sinal, AbortSignal.timeout(20_000)]))
        .catch((erro: unknown) => {
          sinal.throwIfAborted();
          if (!erroTemporario(erro) || ++falhas >= 5) throw erro;
          const espera = erro instanceof ErroHorde ? (erro.aposSegundos ?? 0) * 1000 : 0;
          intervalo = Math.min(60_000, Math.max(intervalo * 2, espera));
          return null;
        });
      if (!consulta) continue;
      sinal.throwIfAborted();
      intervalo = 4000;
      falhas = 0;
      if (consulta.estado === 'failed') throw new Error('O AI Horde não concluiu a imagem.');
      if (consulta.estado === 'done') {
        publicar({ fase: 'recebendo', avisos: envio.avisos });
        const resultado = await cliente.obterResultado(
          id,
          AbortSignal.any([sinal, AbortSignal.timeout(30_000)]),
        );
        sinal.throwIfAborted();
        return { tipo: 'imagem', resultado };
      }
      publicar({
        fase: consulta.estado === 'processing' ? 'processando' : 'esperando',
        posicao: consulta.queuePosition,
        segundos: consulta.waitSeconds,
        semComputador: consulta.disponivel === false,
        avisos: envio.avisos,
      });
    }
    throw new Error('O pedido alcançou o limite de 30 minutos de espera.');
  } catch (erro) {
    let confirmado = false;
    if (id)
      confirmado = await cliente.cancelar(id, AbortSignal.timeout(10_000)).then(
        () => true,
        () => false,
      );
    if (sinal.aborted) return { tipo: 'cancelado', confirmado };
    throw erro;
  }
}
