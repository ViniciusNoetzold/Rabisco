import { describe, expect, it, vi } from 'vitest';
import { processarPedidoIA } from '../../src/ia/fila';
import { ErroHorde, type ProgressoHorde } from '../../src/ia/horde';

const pedido = { prompt: 'Montanhas ilustradas', width: 512, height: 384 };

function clienteFalso() {
  return {
    testarChave: vi.fn(),
    enviar: vi.fn(async () => ({ id: 'pedido-1', avisos: [] })),
    consultar: vi.fn(async (): Promise<ProgressoHorde> => ({ estado: 'done' })),
    obterResultado: vi.fn(async () => ({ imagem: new Blob(), seed: '17' })),
    cancelar: vi.fn(async () => {}),
  };
}

describe('fila de IA', () => {
  it('repete uma consulta com falha temporária sem reenviar a geração', async () => {
    const cliente = clienteFalso();
    cliente.consultar
      .mockRejectedValueOnce(new ErroHorde('Limite', 429, undefined, 12))
      .mockResolvedValueOnce({ estado: 'waiting', queuePosition: 3, disponivel: false })
      .mockResolvedValueOnce({ estado: 'processing' });
    const publicar = vi.fn();
    const aguardar = vi.fn(async (_ms: number) => {});
    const conclusao = await processarPedidoIA(
      cliente,
      pedido,
      new AbortController().signal,
      publicar,
      aguardar,
    );
    expect(conclusao).toMatchObject({ tipo: 'imagem', resultado: { seed: '17' } });
    expect(cliente.enviar).toHaveBeenCalledTimes(1);
    expect(cliente.cancelar).not.toHaveBeenCalled();
    expect(aguardar.mock.calls.map(([ms]) => ms)).toEqual([4000, 12000, 4000, 4000]);
    expect(publicar).toHaveBeenCalledWith(
      expect.objectContaining({ fase: 'esperando', posicao: 3, semComputador: true }),
    );
    expect(publicar).toHaveBeenCalledWith(expect.objectContaining({ fase: 'processando' }));
  });

  it('cancela no provedor se a confirmação do envio chega depois do clique', async () => {
    const cliente = clienteFalso();
    const controle = new AbortController();
    let aceitar!: (envio: { id: string; avisos: string[] }) => void;
    cliente.enviar.mockImplementationOnce(() => new Promise((resolver) => (aceitar = resolver)));
    const conclusao = processarPedidoIA(cliente, pedido, controle.signal, vi.fn());
    controle.abort();
    aceitar({ id: 'confirmacao-atrasada', avisos: [] });
    await expect(conclusao).resolves.toEqual({ tipo: 'cancelado', confirmado: true });
    expect(cliente.cancelar).toHaveBeenCalledWith('confirmacao-atrasada', expect.any(AbortSignal));
    expect(cliente.consultar).not.toHaveBeenCalled();
    expect(cliente.obterResultado).not.toHaveBeenCalled();
  });

  it('informa um cancelamento sem confirmação quando a rede cai', async () => {
    const cliente = clienteFalso();
    const controle = new AbortController();
    cliente.cancelar.mockRejectedValueOnce(new ErroHorde('Sem rede', undefined, 'Rede'));
    const conclusao = await processarPedidoIA(
      cliente,
      pedido,
      controle.signal,
      vi.fn(),
      async () => {
        controle.abort();
        controle.signal.throwIfAborted();
      },
    );
    expect(conclusao).toEqual({ tipo: 'cancelado', confirmado: false });
    expect(cliente.obterResultado).not.toHaveBeenCalled();
  });

  it('encerra um pedido em falha sem buscar nem aplicar uma imagem', async () => {
    const cliente = clienteFalso();
    cliente.consultar.mockResolvedValueOnce({ estado: 'failed' });
    await expect(
      processarPedidoIA(cliente, pedido, new AbortController().signal, vi.fn(), async () => {}),
    ).rejects.toThrow('não concluiu');
    expect(cliente.obterResultado).not.toHaveBeenCalled();
    expect(cliente.cancelar).toHaveBeenCalledTimes(1);
  });
});
