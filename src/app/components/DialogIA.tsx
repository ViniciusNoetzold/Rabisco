import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { EditorApi } from '../../canvas/editorTypes';
import { LIMITE_PROMPT_IA, type MetadadosIA } from '../../document/metadadosIA';
import { processarPedidoIA, type AndamentoIA } from '../../ia/fila';
import { CHAVE_ANONIMA_HORDE, criarClienteHorde, type PedidoHorde } from '../../ia/horde';
import type { PixelBuffer } from '../../layers/types';
import './ia-dialog.css';

const CHAVE_LOCAL = 'rabisco.ia.horde.chave';
const TAMANHOS = {
  quadrado: [512, 512],
  paisagem: [512, 384],
  retrato: [384, 512],
} as const;
const ROTULOS = {
  enviando: 'Enviando ao AI Horde…',
  esperando: 'Na fila do AI Horde…',
  processando: 'Gerando a imagem…',
  recebendo: 'Recebendo a imagem…',
};

function lerChave(): string {
  try {
    return localStorage.getItem(CHAVE_LOCAL) ?? '';
  } catch {
    return '';
  }
}

async function codificarFonte(canvas: HTMLCanvasElement): Promise<string> {
  const imagem = await new Promise<Blob | null>((resolver) =>
    canvas.toBlob(resolver, 'image/webp', 0.9),
  );
  if (!imagem || imagem.type !== 'image/webp')
    throw new Error('Este navegador não conseguiu preparar uma imagem WebP para o AI Horde.');
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result).split(',')[1]);
    leitor.onerror = () => rejeitar(new Error('Não foi possível preparar a imagem de referência.'));
    leitor.readAsDataURL(imagem);
  });
}

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof TypeError) return 'Não foi possível conectar ao AI Horde. Confira a conexão.';
  if (erro instanceof DOMException && erro.name === 'TimeoutError')
    return 'O AI Horde demorou para responder. Tente de novo quando a conexão estiver estável.';
  return erro instanceof Error ? erro.message : 'Não foi possível concluir o pedido.';
}

interface Props {
  aberto: boolean;
  editor: RefObject<EditorApi | null>;
  fechar(): void;
  avisar(mensagem: string): void;
  definirOcupada(ocupada: boolean): void;
}

interface ImagemPronta {
  editor: EditorApi;
  contexto: string;
  pixels: PixelBuffer;
  origem: MetadadosIA;
}

export function DialogIA({ aberto, editor, fechar, avisar, definirOcupada }: Props) {
  const titulo = useId();
  const janela = useRef<HTMLDialogElement>(null);
  const pedidoAtual = useRef<AbortController | null>(null);
  const testeAtual = useRef<AbortController | null>(null);
  const [descricao, definirDescricao] = useState('');
  const [operacao, definirOperacao] = useState<MetadadosIA['operacao']>('gerar');
  const [tamanho, definirTamanho] = useState<keyof typeof TAMANHOS>('quadrado');
  const [forca, definirForca] = useState(55);
  const [semente, definirSemente] = useState('');
  const [chave, definirChave] = useState(lerChave);
  const [guardar, definirGuardar] = useState(() => Boolean(chave));
  const [testando, definirTestando] = useState(false);
  const [mensagemChave, definirMensagemChave] = useState('');
  const [andamento, definirAndamento] = useState<AndamentoIA | 'cancelando' | 'preparando' | null>(
    null,
  );
  const [mensagem, definirMensagem] = useState('');
  const [imagemPronta, definirImagemPronta] = useState<ImagemPronta | null>(null);
  const ocupado = andamento !== null;
  const anonimo = !chave.trim() || chave.trim() === CHAVE_ANONIMA_HORDE;

  useLayoutEffect(() => {
    const dialogo = janela.current;
    if (!aberto || !dialogo) return;
    dialogo.showModal();
    return () => dialogo.close();
  }, [aberto]);

  useEffect(
    () => () => {
      pedidoAtual.current?.abort();
      testeAtual.current?.abort();
    },
    [],
  );

  function atualizarChave(valor: string, lembrar: boolean) {
    definirChave(valor);
    definirGuardar(lembrar);
    definirMensagemChave('');
    try {
      if (lembrar && valor.trim()) localStorage.setItem(CHAVE_LOCAL, valor.trim());
      else localStorage.removeItem(CHAVE_LOCAL);
    } catch {
      definirGuardar(false);
      definirMensagemChave('O navegador deixou a chave disponível só nesta sessão.');
    }
  }

  async function testarChave() {
    if (!chave.trim() || testeAtual.current) return;
    const controle = new AbortController();
    testeAtual.current = controle;
    definirTestando(true);
    definirMensagemChave('Conferindo a chave no AI Horde…');
    try {
      const { usuario, kudos } = await criarClienteHorde(chave).testarChave(
        AbortSignal.any([controle.signal, AbortSignal.timeout(20_000)]),
      );
      const saldo = kudos === undefined ? '' : ` Saldo de ${kudos.toLocaleString('pt-BR')} kudos.`;
      definirMensagemChave(`Chave válida para ${usuario}.${saldo}`);
    } catch (erro) {
      if (!controle.signal.aborted) definirMensagemChave(mensagemDeErro(erro));
    } finally {
      testeAtual.current = null;
      definirTestando(false);
    }
  }

  async function enviar() {
    const destino = editor.current;
    const prompt = descricao.trim();
    if (!destino || !prompt || pedidoAtual.current || imagemPronta) return;
    const controle = new AbortController();
    pedidoAtual.current = controle;
    definirOcupada(true);
    definirMensagem('');
    definirAndamento('preparando');
    try {
      const contexto = destino.contextoIA();
      const [width, height] = TAMANHOS[tamanho];
      const pedido: PedidoHorde = {
        prompt,
        width,
        height,
        seed: semente ? String(Number(semente)) : undefined,
      };
      if (operacao === 'editar') {
        const fonte = destino.prepararFonteIA(512);
        if (!fonte) throw new Error('Não foi possível preparar o papel ou a seleção.');
        pedido.source = { base64: await codificarFonte(fonte), denoising: forca / 100 };
      }
      const conclusao = await processarPedidoIA(
        criarClienteHorde(chave),
        pedido,
        controle.signal,
        definirAndamento,
      );
      if (conclusao.tipo === 'cancelado') {
        definirMensagem(
          conclusao.confirmado
            ? 'Pedido cancelado.'
            : 'Acompanhamento encerrado. O AI Horde pode continuar processando o pedido.',
        );
        return;
      }
      const { resultado } = conclusao;
      const { abrirImagem } = await import('../../io/imagens');
      const {
        width: largura,
        height: altura,
        pixels,
      } = await abrirImagem(
        new File([resultado.imagem], 'imagem-ia.webp', { type: resultado.imagem.type }),
      );
      controle.signal.throwIfAborted();
      if (editor.current !== destino || destino.contextoIA() !== contexto) {
        const aviso = 'O desenho mudou desde o envio. A imagem do pedido ficou fora dele.';
        definirMensagem(aviso);
        avisar(aviso);
        return;
      }
      const sementeGerada = resultado.seed ? Number(resultado.seed) : NaN;
      definirImagemPronta({
        editor: destino,
        contexto,
        pixels: { width: largura, height: altura, data: pixels },
        origem: {
          provedor: 'AI Horde',
          prompt,
          semente: Number.isSafeInteger(sementeGerada) ? sementeGerada : undefined,
          modelo: resultado.modelo,
          operacao,
        },
      });
      definirMensagem('Imagem pronta para inserir.');
      if (!janela.current?.open) avisar('A imagem está pronta. Abra a aba IA para inserir.');
    } catch (erro) {
      definirMensagem(controle.signal.aborted ? 'Pedido cancelado.' : mensagemDeErro(erro));
    } finally {
      pedidoAtual.current = null;
      definirAndamento(null);
      definirOcupada(false);
    }
  }

  function inserir() {
    if (!imagemPronta) return;
    const { editor: destino, contexto, pixels, origem } = imagemPronta;
    if (editor.current !== destino || destino.contextoIA() !== contexto) {
      definirImagemPronta(null);
      definirMensagem('O desenho mudou desde o envio. A imagem do pedido ficou fora dele.');
      return;
    }
    try {
      if (!destino.adicionarImagemIA(pixels, origem, contexto)) {
        definirMensagem('Termine a edição atual e tente inserir a imagem de novo.');
        return;
      }
      definirImagemPronta(null);
      definirMensagem('Imagem adicionada em uma nova camada.');
    } catch (erro) {
      definirMensagem(mensagemDeErro(erro));
    }
  }

  function cancelar() {
    pedidoAtual.current?.abort();
    definirAndamento('cancelando');
  }

  if (!aberto) return null;

  return (
    <dialog
      ref={janela}
      className="window glass app-dialog dialog-ia"
      aria-labelledby={titulo}
      onKeyDown={(evento) => evento.stopPropagation()}
      onCancel={(evento) => {
        evento.preventDefault();
        fechar();
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id={titulo}>
          Gerar ou transformar com IA
        </div>
        <button type="button" className="dialog-close" aria-label="Fechar janela" onClick={fechar}>
          ×
        </button>
      </div>
      <form
        className="window-body dialog-body corpo-ia"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <fieldset className="campos-ia" disabled={ocupado || Boolean(imagemPronta)}>
          <label>
            Modo
            <select
              value={operacao}
              onChange={(evento) => definirOperacao(evento.target.value as MetadadosIA['operacao'])}
            >
              <option value="gerar">Gerar do texto</option>
              <option value="editar">Transformar desenho</option>
            </select>
          </label>
          <label>
            Tamanho da imagem
            <select
              value={tamanho}
              onChange={(evento) => definirTamanho(evento.target.value as keyof typeof TAMANHOS)}
            >
              <option value="quadrado">Quadrado · 512 × 512</option>
              <option value="paisagem">Paisagem · 512 × 384</option>
              <option value="retrato">Retrato · 384 × 512</option>
            </select>
          </label>
          <label className="largura-ia">
            Descrição
            <textarea
              value={descricao}
              onChange={(evento) => definirDescricao(evento.target.value)}
              rows={3}
              maxLength={LIMITE_PROMPT_IA}
              required
            />
          </label>
          {operacao === 'editar' && (
            <label>
              Força da transformação
              <input
                type="range"
                min={10}
                max={90}
                value={forca}
                aria-valuetext={`${forca}%`}
                onChange={(evento) => definirForca(Number(evento.target.value))}
              />
            </label>
          )}
          <label>
            Semente (opcional)
            <input
              type="number"
              min={0}
              max={4294967295}
              step={1}
              value={semente}
              onChange={(evento) => definirSemente(evento.target.value)}
            />
          </label>
        </fieldset>
        <details className="config-ia">
          <summary>Configurar AI Horde</summary>
          <fieldset disabled={testando || ocupado || Boolean(imagemPronta)}>
            <label>
              Chave de API (opcional)
              <input
                type="password"
                autoComplete="off"
                value={chave}
                onChange={(evento) => atualizarChave(evento.target.value, guardar)}
              />
            </label>
            <label className="guardar-chave-ia">
              <input
                type="checkbox"
                checked={guardar}
                onChange={(evento) => atualizarChave(chave, evento.target.checked)}
              />
              Guardar a chave neste navegador
            </label>
            <button type="button" onClick={() => void testarChave()} disabled={!chave.trim()}>
              Testar chave
            </button>
          </fieldset>
          <p>
            <a href="https://aihorde.net/register" target="_blank" rel="noreferrer">
              Obter uma chave no AI Horde
            </a>
          </p>
          {mensagemChave && <p role="status">{mensagemChave}</p>}
        </details>
        <p className="envio-ia">
          {operacao === 'editar'
            ? 'Envia a descrição e uma cópia da seleção ou do papel visível ao AI Horde.'
            : 'Envia a descrição e as opções ao AI Horde.'}{' '}
          O serviço usa computadores voluntários.
          {anonimo && ' A fila sem conta tem menor prioridade.'}
          {anonimo &&
            operacao === 'gerar' &&
            ' O provedor compartilha a imagem e a descrição das gerações anônimas por texto.'}{' '}
          <a href="https://aihorde.net/terms/" target="_blank" rel="noreferrer">
            Termos do AI Horde
          </a>
        </p>
        {(andamento || mensagem) && (
          <div className="andamento-ia" role="status">
            {andamento === 'preparando'
              ? 'Preparando o pedido…'
              : andamento === 'cancelando'
                ? 'Cancelando o pedido…'
                : andamento
                  ? ROTULOS[andamento.fase]
                  : mensagem}
            {typeof andamento === 'object' && andamento && (
              <>
                {andamento.posicao !== undefined && ` Posição aproximada ${andamento.posicao}.`}
                {andamento.segundos !== undefined &&
                  andamento.segundos > 0 &&
                  ` Estimativa de ${Math.ceil(andamento.segundos)} segundos.`}
                {andamento.semComputador && ' Aguardando um computador compatível.'}
                {andamento.avisos?.map((aviso) => <div key={aviso}>{aviso}</div>)}
              </>
            )}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={fechar}>
            {ocupado ? 'Continuar desenhando' : 'Fechar'}
          </button>
          {imagemPronta ? (
            <>
              <button
                type="button"
                onClick={() => {
                  definirImagemPronta(null);
                  definirMensagem('Imagem descartada.');
                }}
              >
                Descartar imagem
              </button>
              <button type="button" className="primary-button" onClick={inserir}>
                Inserir em nova camada
              </button>
            </>
          ) : ocupado ? (
            <button type="button" disabled={andamento === 'cancelando'} onClick={cancelar}>
              Cancelar pedido
            </button>
          ) : (
            <button
              type="submit"
              className="primary-button"
              disabled={!descricao.trim() || testando}
            >
              Enviar ao AI Horde
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
