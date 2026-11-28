export const DESTINO_HORDE = 'https://aihorde.net';
export const CHAVE_ANONIMA_HORDE = '0000000000';

const API = `${DESTINO_HORDE}/api/v2`;
const CLIENTE = 'Rabisco:0.6.0:https://github.com/ViniciusNoetzold/Rabisco';
const MAXIMO_FONTE = 5 * 1024 * 1024;
const MAXIMO_RESULTADO = 10 * 1024 * 1024;

export interface PedidoHorde {
  prompt: string;
  seed?: string;
  width: number;
  height: number;
  source?: { base64: string; denoising: number };
}

export interface ProgressoHorde {
  estado: 'waiting' | 'processing' | 'done' | 'failed';
  queuePosition?: number;
  waitSeconds?: number;
  disponivel?: boolean;
}

export interface ResultadoHorde {
  imagem: Blob;
  seed?: string;
  modelo?: string;
}

export class ErroHorde extends Error {
  constructor(
    mensagem: string,
    readonly status?: number,
    readonly codigo?: string,
    readonly aposSegundos?: number,
  ) {
    super(mensagem);
    this.name = 'ErroHorde';
  }
}

function objeto(valor: unknown): Record<string, unknown> | undefined {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : undefined;
}

function texto(valor: unknown, limite: number): string | undefined {
  if (typeof valor !== 'string') return;
  const limpo = valor
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, limite);
  return limpo || undefined;
}

function natural(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 ? valor : undefined;
}

function depoisDe(valor: string | null): number | undefined {
  if (!valor) return;
  const segundos = /^\d+$/.test(valor) ? Number(valor) : (Date.parse(valor) - Date.now()) / 1000;
  return Number.isFinite(segundos) ? Math.max(0, Math.ceil(segundos)) : undefined;
}

function mensagemDaFalha(status: number, codigo?: string): string {
  if (status === 401) return 'O AI Horde recusou a chave. Confira a chave em Configurar IA.';
  if (status === 429) return 'O AI Horde atingiu o limite de pedidos. Aguarde e tente novamente.';
  if (codigo === 'KudosUpfront' || codigo === 'SharedKeyInsufficientKudos') {
    return 'O AI Horde pediu mais kudos. Tente uma imagem menor ou use outra chave.';
  }
  if (status === 403) return 'O AI Horde não permitiu este pedido.';
  if (status === 404) return 'O pedido não está mais disponível no AI Horde.';
  if (status >= 500) return 'O AI Horde está indisponível no momento. Tente novamente mais tarde.';
  return 'O AI Horde recusou o pedido. Confira o texto, as dimensões e a imagem de referência.';
}

function base64Webp(valor: unknown, maximo: number): string | undefined {
  if (typeof valor !== 'string' || valor.length > Math.ceil(maximo / 3) * 4) return;
  try {
    const assinatura = atob(valor.slice(0, 16));
    if (assinatura.startsWith('RIFF') && assinatura.slice(8, 12) === 'WEBP') return valor;
  } catch {
    return;
  }
}

function prepararPedido({ prompt, seed, width, height, source }: PedidoHorde) {
  const textoDoPedido = prompt.trim();
  if (!textoDoPedido) throw new ErroHorde('Escreva uma descrição para a imagem.');
  if ([width, height].some((lado) => lado < 64 || lado > 3072 || lado % 64 !== 0)) {
    throw new ErroHorde('Use dimensões entre 64 e 3.072 pixels, em múltiplos de 64.');
  }
  const fonte = source && base64Webp(source.base64, MAXIMO_FONTE);
  if (source && (!fonte || !(source.denoising >= 0.01 && source.denoising <= 1))) {
    throw new ErroHorde('Use uma referência WebP de até 5 MiB e uma intensidade entre 1 e 100%.');
  }
  return {
    prompt: textoDoPedido,
    params: {
      width,
      height,
      n: 1,
      steps: 20,
      ...(seed?.trim() ? { seed: seed.trim() } : {}),
      ...(source ? { denoising_strength: source.denoising } : {}),
    },
    ...(fonte ? { source_image: fonte, source_processing: 'img2img' } : {}),
    nsfw: false,
    censor_nsfw: true,
    shared: false,
    // A resposta traz WebP base64 no próprio domínio da API.
    r2: false,
  };
}

export function criarClienteHorde(
  chave?: string,
  requisitar: typeof fetch = (...argumentos) => globalThis.fetch(...argumentos),
) {
  const apikey = chave?.trim() || CHAVE_ANONIMA_HORDE;

  async function chamar(caminho: string, opcoes: RequestInit = {}) {
    let cabecalhos: Headers;
    try {
      cabecalhos = new Headers({ apikey, 'Client-Agent': CLIENTE });
    } catch {
      throw new ErroHorde('A chave do AI Horde contém caracteres inválidos.', 401);
    }
    if (opcoes.body) cabecalhos.set('Content-Type', 'application/json');
    let resposta: Response;
    try {
      resposta = await requisitar(`${API}/${caminho}`, {
        ...opcoes,
        headers: cabecalhos,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
      });
    } catch (erro) {
      if (opcoes.signal?.aborted) throw erro;
      throw new ErroHorde(
        'Não foi possível conectar ao AI Horde. Confira a conexão e tente novamente.',
        undefined,
        'Rede',
      );
    }
    const dados = objeto(await resposta.json().catch(() => undefined));
    opcoes.signal?.throwIfAborted();
    if (!resposta.ok) {
      const codigo = texto(dados?.rc, 80);
      throw new ErroHorde(
        mensagemDaFalha(resposta.status, codigo),
        resposta.status,
        codigo,
        depoisDe(resposta.headers.get('Retry-After')),
      );
    }
    return dados;
  }

  function caminhoDoPedido(acao: 'check' | 'status', id: string) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
      throw new ErroHorde('O AI Horde retornou um identificador inválido.');
    }
    return `generate/${acao}/${id}`;
  }

  return {
    async testarChave(sinal?: AbortSignal): Promise<{ usuario: string; kudos?: number }> {
      const dados = await chamar('find_user', { signal: sinal });
      const usuario = texto(dados?.username, 100);
      if (!usuario) throw new ErroHorde('O AI Horde não confirmou a conta desta chave.');
      const kudos =
        typeof dados?.kudos === 'number' && Number.isFinite(dados.kudos) ? dados.kudos : undefined;
      return { usuario, kudos };
    },

    async enviar(
      pedido: PedidoHorde,
      sinal?: AbortSignal,
    ): Promise<{ id: string; avisos: string[] }> {
      const dados = await chamar('generate/async', {
        method: 'POST',
        body: JSON.stringify(prepararPedido(pedido)),
        signal: sinal,
      });
      const id = dados?.id;
      if (typeof id !== 'string' || !id) {
        throw new ErroHorde('O AI Horde não retornou o identificador do pedido.');
      }
      caminhoDoPedido('check', id);
      const avisos = Array.isArray(dados?.warnings)
        ? dados.warnings.slice(0, 5).flatMap((aviso: unknown) => {
            const mensagem = texto(objeto(aviso)?.message, 200);
            return mensagem ? [mensagem] : [];
          })
        : [];
      return { id, avisos };
    },

    async consultar(id: string, sinal?: AbortSignal): Promise<ProgressoHorde> {
      const dados = await chamar(caminhoDoPedido('check', id), { signal: sinal });
      if (typeof dados?.done !== 'boolean') {
        throw new ErroHorde('O AI Horde retornou um progresso inválido.');
      }
      const processando = (natural(dados.processing) ?? 0) > 0;
      const estado = dados.faulted
        ? 'failed'
        : dados.done
          ? 'done'
          : processando
            ? 'processing'
            : 'waiting';
      return {
        estado,
        queuePosition: natural(dados.queue_position),
        waitSeconds: natural(dados.wait_time),
        disponivel: typeof dados.is_possible === 'boolean' ? dados.is_possible : undefined,
      };
    },

    async obterResultado(id: string, sinal?: AbortSignal): Promise<ResultadoHorde> {
      const dados = await chamar(caminhoDoPedido('status', id), { signal: sinal });
      if (dados?.faulted) throw new ErroHorde('O AI Horde não conseguiu finalizar este pedido.');
      const geracao = Array.isArray(dados?.generations) ? objeto(dados.generations[0]) : undefined;
      if (geracao?.censored || geracao?.state === 'censored' || geracao?.state === 'csam') {
        throw new ErroHorde('O AI Horde bloqueou o resultado desta geração.');
      }
      if (geracao?.state === 'faulted') throw new ErroHorde('O AI Horde não concluiu a imagem.');
      const base64 = base64Webp(geracao?.img, MAXIMO_RESULTADO);
      if (!base64) throw new ErroHorde('O AI Horde não retornou uma imagem WebP válida.');
      let bytes: Uint8Array<ArrayBuffer>;
      try {
        bytes = Uint8Array.from(atob(base64), (byte) => byte.charCodeAt(0));
      } catch {
        throw new ErroHorde('O AI Horde retornou uma imagem incompleta.');
      }
      if (bytes.byteLength > MAXIMO_RESULTADO) {
        throw new ErroHorde('A imagem do AI Horde excede o limite de 10 MiB.');
      }
      const seed = natural(geracao?.seed);
      return {
        imagem: new Blob([bytes], { type: 'image/webp' }),
        seed: seed === undefined ? texto(geracao?.seed, 80) : String(seed),
        modelo: texto(geracao?.model, 160),
      };
    },

    async cancelar(id: string, sinal?: AbortSignal): Promise<void> {
      await chamar(caminhoDoPedido('status', id), { method: 'DELETE', signal: sinal });
    },
  };
}
