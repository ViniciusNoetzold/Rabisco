import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CONJUNTOS_ASCII,
  MAX_COLUNAS_ASCII,
  OPCOES_ASCII_PADRAO,
  converterAscii,
  prepararPreviaAscii,
  textoAscii,
  trechosAscii,
  type ArteAscii,
  type ConjuntoAscii,
} from '../../estilos/ascii';
import type { RespostaAscii, SolicitacaoAscii } from '../../estilos/ascii.worker';
import type { PixelBuffer } from '../../layers/types';
import type { RunAction } from './Primitives';
import './ascii-dialog.css';

type FormatoAscii = 'txt' | 'html' | 'png';

interface AsciiDialogProps {
  origem: PixelBuffer;
  fechar(): void;
  aplicar(arte: ArteAscii, rasterizar: boolean): void;
  copiar(arte: ArteAscii): Promise<void>;
  exportar(arte: ArteAscii, formato: FormatoAscii): void | Promise<void>;
  run: RunAction;
}

/** Mantém uma cópia da imagem no worker e guarda apenas o pedido mais recente na fila. */
function criarConversorAscii(origem: PixelBuffer, receber: (resultado: RespostaAscii) => void) {
  let worker: Worker | null = null;
  let ativo: SolicitacaoAscii | null = null;
  let pendente: SolicitacaoAscii | null = null;
  let fechado = false;

  function processar() {
    if (fechado || ativo || !pendente) return;
    const pedido = pendente;
    pendente = null;
    if (worker) {
      ativo = pedido;
      try {
        worker.postMessage(pedido);
      } catch {
        falharWorker();
      }
      return;
    }
    try {
      receber({ chave: pedido.chave, arte: converterAscii(origem, pedido.opcoes) });
    } catch (erro) {
      receber({
        chave: pedido.chave,
        erro:
          erro instanceof Error ? erro.message : 'Não foi possível converter a imagem em ASCII.',
      });
    }
  }

  function falharWorker() {
    worker?.terminate();
    worker = null;
    pendente ??= ativo;
    ativo = null;
    processar();
  }

  if (typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('../../estilos/ascii.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = ({ data }: MessageEvent<RespostaAscii>) => {
        if (fechado) return;
        ativo = null;
        if (!pendente) receber(data);
        processar();
      };
      worker.onerror = (evento) => {
        evento.preventDefault();
        falharWorker();
      };
      worker.onmessageerror = falharWorker;
      // A camada de origem continua disponível para aplicar ou rasterizar a arte.
      worker.postMessage({ tipo: 'origem', origem });
    } catch {
      falharWorker();
    }
  }

  return {
    converter(pedido: SolicitacaoAscii) {
      pendente = pedido;
      processar();
    },
    fechar() {
      fechado = true;
      worker?.terminate();
      worker = null;
      ativo = pendente = null;
    },
  };
}

function PreviaAscii({
  arte,
  ocupada,
  descricao,
}: {
  arte?: ArteAscii;
  ocupada: boolean;
  descricao?: string;
}) {
  return (
    <pre
      className="ascii-previa"
      data-invertido={arte?.inverter ? '' : undefined}
      aria-label="Prévia ASCII"
      aria-describedby={descricao}
      aria-busy={ocupada}
      tabIndex={0}
    >
      {arte?.cores
        ? arte.linhas.map((linha, y) => (
            <Fragment key={y}>
              {y > 0 ? '\n' : ''}
              {trechosAscii(linha, arte.cores?.[y]).map(({ texto, cor }, i) =>
                cor ? (
                  <span key={i} style={{ color: cor }}>
                    {texto}
                  </span>
                ) : (
                  <Fragment key={i}>{texto}</Fragment>
                ),
              )}
            </Fragment>
          ))
        : arte && textoAscii(arte)}
    </pre>
  );
}

export function AsciiDialog({ origem, fechar, aplicar, copiar, exportar, run }: AsciiDialogProps) {
  const titulo = useId();
  const descricaoPrevia = useId();
  const janela = useRef<HTMLDialogElement>(null);
  const conversor = useRef<ReturnType<typeof criarConversorAscii> | null>(null);
  const [largura, definirLargura] = useState(String(OPCOES_ASCII_PADRAO.colunas));
  const [conjunto, definirConjunto] = useState<ConjuntoAscii>(OPCOES_ASCII_PADRAO.conjunto);
  const [inverter, definirInverter] = useState(OPCOES_ASCII_PADRAO.inverter);
  const [colorido, definirColorido] = useState(OPCOES_ASCII_PADRAO.colorido);
  const [ultimo, definirUltimo] = useState<{ origem: PixelBuffer; resultado: RespostaAscii }>();
  const [copiado, definirCopiado] = useState<string>();
  const colunas = Number(largura);
  const colunasValidas = Number.isInteger(colunas) && colunas >= 1 && colunas <= MAX_COLUNAS_ASCII;
  const chave = `${colunas}:${conjunto}:${inverter}:${colorido}`;
  const resultado = ultimo?.origem === origem ? ultimo.resultado : undefined;
  const previa = resultado && 'arte' in resultado ? resultado.arte : undefined;
  const gradePrevia = useMemo(() => previa && prepararPreviaAscii(previa), [previa]);
  const previaReduzida = gradePrevia !== previa;
  const atual = resultado?.chave === chave ? resultado : undefined;
  const arte = atual && 'arte' in atual ? atual.arte : undefined;
  const ocupada = colunasValidas && !atual;

  useLayoutEffect(() => {
    const dialogo = janela.current;
    dialogo?.showModal();
    return () => dialogo?.close();
  }, []);

  useEffect(() => {
    return () => {
      conversor.current?.fechar();
      conversor.current = null;
    };
  }, [origem]);

  useEffect(() => {
    if (!colunasValidas) return;
    const espera = setTimeout(() => {
      conversor.current ??= criarConversorAscii(origem, (resultado) =>
        definirUltimo({ origem, resultado }),
      );
      conversor.current.converter({
        tipo: 'converter',
        chave,
        opcoes: { colunas, conjunto, inverter, colorido },
      });
    }, 70);
    return () => clearTimeout(espera);
  }, [origem, chave, colunasValidas, colunas, conjunto, inverter, colorido]);

  function criarCamada(rasterizar: boolean) {
    if (!arte) return;
    run(() => {
      aplicar(arte, rasterizar);
      fechar();
    });
  }

  return (
    <dialog
      ref={janela}
      className="window glass app-dialog ascii-dialog"
      aria-labelledby={titulo}
      onCancel={(evento) => {
        evento.preventDefault();
        fechar();
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id={titulo}>
          Converter em ASCII
        </div>
        <button type="button" className="dialog-close" aria-label="Fechar janela" onClick={fechar}>
          ×
        </button>
      </div>
      <div className="window-body dialog-body ascii-corpo">
        <div className="ascii-opcoes">
          <label className="ascii-campo">
            Colunas
            <input
              type="number"
              min={1}
              max={MAX_COLUNAS_ASCII}
              value={largura}
              aria-invalid={!colunasValidas}
              onChange={(evento) => definirLargura(evento.target.value)}
            />
          </label>
          <label className="ascii-campo">
            Conjunto de caracteres
            <select
              aria-label="Conjunto de caracteres"
              value={conjunto}
              onChange={(evento) => definirConjunto(evento.target.value as ConjuntoAscii)}
            >
              {Object.entries(CONJUNTOS_ASCII).map(([valor, nome]) => (
                <option key={valor} value={valor}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="ascii-marcacao">
            <input
              type="checkbox"
              checked={inverter}
              onChange={(evento) => definirInverter(evento.target.checked)}
            />
            Inverter
          </label>
          <label className="ascii-marcacao">
            <input
              type="checkbox"
              checked={colorido}
              onChange={(evento) => definirColorido(evento.target.checked)}
            />
            Colorido
          </label>
          <div className="ascii-status" role="status">
            {!colunasValidas
              ? `Use de 1 a ${MAX_COLUNAS_ASCII} colunas.`
              : atual && 'erro' in atual
                ? atual.erro
                : ocupada
                  ? 'Convertendo…'
                  : copiado === chave && 'Texto copiado.'}
          </div>
          {previaReduzida && previa && (
            <div className="ascii-status" id={descricaoPrevia}>
              Prévia reduzida. A arte completa tem {previa.colunas} colunas e {previa.linhas.length}{' '}
              linhas.
            </div>
          )}
        </div>
        <PreviaAscii
          arte={gradePrevia}
          ocupada={ocupada}
          descricao={previaReduzida ? descricaoPrevia : undefined}
        />
        <div className="ascii-acoes">
          <button
            type="button"
            disabled={!arte}
            onClick={() => {
              if (!arte) return;
              run(async () => {
                await copiar(arte);
                definirCopiado(chave);
              });
            }}
          >
            Copiar texto
          </button>
          {(['txt', 'html', 'png'] as const).map((formato) => (
            <button
              key={formato}
              type="button"
              disabled={!arte}
              onClick={() => {
                if (arte) run(() => exportar(arte, formato));
              }}
            >
              Exportar .{formato}
            </button>
          ))}
        </div>
        <div className="ascii-acoes ascii-acoes-camada">
          <button type="button" onClick={fechar}>
            Cancelar
          </button>
          <button type="button" disabled={!arte} onClick={() => criarCamada(true)}>
            Rasterizar em camada
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!arte}
            onClick={() => criarCamada(false)}
          >
            Criar camada de texto
          </button>
        </div>
      </div>
    </dialog>
  );
}
