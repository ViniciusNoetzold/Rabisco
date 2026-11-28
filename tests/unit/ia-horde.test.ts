import { describe, expect, it, vi } from 'vitest';
import {
  CHAVE_ANONIMA_HORDE,
  criarClienteHorde,
  DESTINO_HORDE,
  ErroHorde,
  type PedidoHorde,
} from '../../src/ia/horde';

const api = `${DESTINO_HORDE}/api/v2`;
const webp = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEALmk0mk0iIiIiIgBoSygABc6zbAAA';
const pedido: PedidoHorde = { prompt: 'Uma montanha', width: 512, height: 512 };

function resposta(dados: unknown, opcoes?: ResponseInit) {
  return new Response(JSON.stringify(dados), opcoes);
}

describe('cliente do AI Horde', () => {
  it('envia uma geração anônima de uma imagem com cabeçalhos e parâmetros esperados', async () => {
    const requisitar = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        resposta(
          { id: 'job-1', warnings: [{ message: 'A fila\n está cheia' }, false] },
          { status: 202 },
        ),
      );
    const cliente = criarClienteHorde(undefined, requisitar);
    await expect(cliente.enviar(pedido)).resolves.toEqual({
      id: 'job-1',
      avisos: ['A fila  está cheia'],
    });
    const [url, opcoes] = requisitar.mock.calls[0];
    const cabecalhos = new Headers(opcoes?.headers);
    expect(url).toBe(`${api}/generate/async`);
    expect(opcoes).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error' });
    expect(cabecalhos.get('apikey')).toBe(CHAVE_ANONIMA_HORDE);
    expect(cabecalhos.get('Client-Agent')).toMatch(/^Rabisco:0\.6\.0:https:\/\/github\.com\//);
    expect(cabecalhos.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(opcoes?.body))).toEqual({
      prompt: pedido.prompt,
      params: { width: 512, height: 512, n: 1, steps: 20 },
      nsfw: false,
      censor_nsfw: true,
      shared: false,
      r2: false,
    });
  });

  it('testa uma chave própria e inclui a referência só no pedido de edição', async () => {
    const requisitar = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(resposta({ username: 'artista#1', kudos: 12.5 }))
      .mockResolvedValueOnce(resposta({ id: 'job-2' }, { status: 202 }));
    const cliente = criarClienteHorde(' chave-de-teste ', requisitar);
    await expect(cliente.testarChave()).resolves.toEqual({ usuario: 'artista#1', kudos: 12.5 });
    await cliente.enviar({ ...pedido, seed: '0', source: { base64: webp, denoising: 0.4 } });
    expect(requisitar.mock.calls[0][0]).toBe(`${api}/find_user`);
    expect(
      requisitar.mock.calls.map(([, opcoes]) => new Headers(opcoes?.headers).get('apikey')),
    ).toEqual(['chave-de-teste', 'chave-de-teste']);
    expect(JSON.parse(String(requisitar.mock.calls[1][1]?.body))).toMatchObject({
      source_image: webp,
      source_processing: 'img2img',
      params: { seed: '0', denoising_strength: 0.4 },
    });
  });

  it('acompanha a espera, o processamento e o fim antes de obter o WebP', async () => {
    const requisitar = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        resposta({ done: false, queue_position: 7, wait_time: 30, is_possible: false }),
      )
      .mockResolvedValueOnce(resposta({ done: false, processing: 1 }))
      .mockResolvedValueOnce(resposta({ done: true }))
      .mockResolvedValueOnce(resposta({ done: true, faulted: true }))
      .mockResolvedValueOnce(
        resposta({ done: true, generations: [{ img: webp, seed: 0, model: 'Modelo' }] }),
      );
    const cliente = criarClienteHorde(undefined, requisitar);
    await expect(cliente.consultar('job-1')).resolves.toMatchObject({
      estado: 'waiting',
      queuePosition: 7,
      waitSeconds: 30,
      disponivel: false,
    });
    await expect(cliente.consultar('job-1')).resolves.toMatchObject({ estado: 'processing' });
    await expect(cliente.consultar('job-1')).resolves.toMatchObject({ estado: 'done' });
    await expect(cliente.consultar('job-1')).resolves.toMatchObject({ estado: 'failed' });
    const resultado = await cliente.obterResultado('job-1');
    expect(resultado).toMatchObject({ seed: '0', modelo: 'Modelo' });
    expect(resultado.imagem.type).toBe('image/webp');
    expect(resultado.imagem.size).toBe(atob(webp).length);
    expect(requisitar.mock.calls.map(([url]) => url)).toEqual([
      ...Array(4).fill(`${api}/generate/check/job-1`),
      `${api}/generate/status/job-1`,
    ]);
  });

  it('envia cancelamento com DELETE ao mesmo provedor e respeita o sinal', async () => {
    const requisitar = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const sinal = new AbortController().signal;
    await expect(
      criarClienteHorde('chave', requisitar).cancelar('job-1', sinal),
    ).resolves.toBeUndefined();
    expect(requisitar).toHaveBeenCalledWith(
      `${api}/generate/status/job-1`,
      expect.objectContaining({
        method: 'DELETE',
        signal: sinal,
        credentials: 'omit',
      }),
    );
  });

  it('leva à interface o código e a espera de um 429 sem expor a resposta bruta', async () => {
    const requisitar = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        resposta(
          { rc: 'TooManyPrompts', message: 'Resposta bruta com segredo' },
          { status: 429, headers: { 'Retry-After': '11' } },
        ),
      );
    await expect(criarClienteHorde(undefined, requisitar).enviar(pedido)).rejects.toMatchObject({
      name: 'ErroHorde',
      status: 429,
      codigo: 'TooManyPrompts',
      aposSegundos: 11,
      message: 'O AI Horde atingiu o limite de pedidos. Aguarde e tente novamente.',
    });
  });

  it('rejeita imagens censuradas, uma URL inesperada e identificadores fora do padrão', async () => {
    const requisitar = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(resposta({ generations: [{ img: webp, censored: true }] }))
      .mockResolvedValueOnce(
        resposta({ generations: [{ img: 'https://outra-origem.example/img.webp' }] }),
      );
    const cliente = criarClienteHorde('chave', requisitar);
    await expect(cliente.obterResultado('job-1')).rejects.toThrow(/bloqueou/);
    await expect(cliente.obterResultado('job-1')).rejects.toThrow(/WebP/);
    await expect(cliente.consultar('..')).rejects.toBeInstanceOf(ErroHorde);
    expect(requisitar).toHaveBeenCalledTimes(2);
  });

  it('preserva o motivo de cancelamento e valida pedido antes da rede', async () => {
    const aborto = new DOMException('Cancelado', 'AbortError');
    const controlador = new AbortController();
    controlador.abort(aborto);
    const requisitar = vi.fn<typeof fetch>().mockRejectedValue(aborto);
    const cliente = criarClienteHorde(undefined, requisitar);
    await expect(cliente.enviar({ ...pedido, width: 499 })).rejects.toThrow(/múltiplos de 64/);
    await expect(cliente.enviar({ ...pedido, prompt: '  ' })).rejects.toThrow(/descrição/);
    await expect(
      cliente.enviar({ ...pedido, source: { base64: 'inválido', denoising: 0.5 } }),
    ).rejects.toThrow(/WebP/);
    await expect(
      cliente.enviar({ ...pedido, source: { base64: webp, denoising: 0 } }),
    ).rejects.toThrow(/intensidade/);
    expect(requisitar).not.toHaveBeenCalled();
    await expect(cliente.consultar('job-1', controlador.signal)).rejects.toBe(aborto);
  });
});
