import { useId, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  LIMITE_ARQUIVO_FORMAS,
  MAX_NOME_FORMA,
  MAX_PASTA_FORMA,
  PASTA_PADRAO,
  type FormaPropria,
} from '../../shapes/presets';
import {
  atualizarForma,
  duplicarForma,
  excluirForma,
  exportarFormas,
  importarFormas,
  reordenarFormas,
} from '../../storage/formas';
import { Icon } from './Primitives';
import { MiniaturaForma } from './ShapeGallery';
import './shape-library.css';

interface ShapeLibraryProps {
  formas: FormaPropria[];
  editar(forma: FormaPropria): void;
  atualizar(): Promise<void>;
  fechar(): void;
}

type AcaoDaForma =
  | { tipo: 'renomear'; id: string; nome: string; pasta: string }
  | { tipo: 'excluir'; id: string };

export function ShapeLibrary({ formas, editar, atualizar, fechar }: ShapeLibraryProps) {
  const idTitulo = useId();
  const idApagar = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const operacaoPendente = useRef(false);
  const arrastada = useRef<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState(false);
  const [acao, setAcao] = useState<AcaoDaForma>();
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  useLayoutEffect(() => {
    const janela = dialogo.current;
    janela?.showModal();
    return () => janela?.close();
  }, []);

  async function executar(operacao: () => Promise<unknown>, mensagem: string) {
    if (operacaoPendente.current) return;
    operacaoPendente.current = true;
    setOcupada(true);
    setErro('');
    setAviso('');
    try {
      await operacao();
      await atualizar();
      setAcao(undefined);
      setAviso(mensagem);
    } catch (motivo) {
      setErro(
        motivo instanceof Error ? motivo.message : 'Não foi possível atualizar a biblioteca.',
      );
    } finally {
      operacaoPendente.current = false;
      setOcupada(false);
    }
  }

  function mover(grupo: FormaPropria[], idOrigem: string, idDestino: string) {
    if (idOrigem === idDestino) return;
    const ordem = grupo.map(({ id }) => id);
    const origem = ordem.indexOf(idOrigem);
    const posicao = ordem.indexOf(idDestino);
    if (origem < 0 || posicao < 0) return;
    ordem.splice(origem, 1);
    ordem.splice(posicao, 0, idOrigem);
    void executar(() => reordenarFormas(ordem), 'Ordem das formas atualizada.');
  }

  function importar(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.currentTarget.files?.[0];
    evento.currentTarget.value = '';
    if (!arquivo) return;
    void executar(async () => {
      if (arquivo.size > LIMITE_ARQUIVO_FORMAS) {
        throw new Error('O arquivo excede o tamanho permitido para uma biblioteca de formas.');
      }
      await importarFormas(await arquivo.text());
    }, 'Formas importadas.');
  }

  function exportar() {
    setErro('');
    setAviso('');
    try {
      const texto = exportarFormas(formas);
      const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'minhas-formas.rabisco-formas.json';
      try {
        link.click();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (motivo) {
      setErro(motivo instanceof Error ? motivo.message : 'Não foi possível exportar as formas.');
    }
  }

  function item(forma: FormaPropria, indice: number, grupo: FormaPropria[]) {
    const { id, nome, pasta, favorita } = forma;
    const antes = grupo[indice - 1];
    const depois = grupo[indice + 1];
    const alteracao = acao?.id === id ? acao : undefined;

    return (
      <li
        key={id}
        className="shape-library-item"
        data-drop={destino === id || undefined}
        onDragOver={(evento) => {
          const origem = arrastada.current;
          if (!origem || origem === id || ocupada || !grupo.some((item) => item.id === origem))
            return;
          evento.preventDefault();
          evento.dataTransfer.dropEffect = 'move';
          setDestino(id);
        }}
        onDragLeave={(evento) => {
          const alvo = evento.relatedTarget;
          if (!(alvo instanceof Node) || !evento.currentTarget.contains(alvo)) {
            setDestino((atual) => (atual === id ? null : atual));
          }
        }}
        onDrop={(evento) => {
          evento.preventDefault();
          const origem = arrastada.current;
          arrastada.current = null;
          setDestino(null);
          if (origem) mover(grupo, origem, id);
        }}
      >
        <div className="shape-library-row">
          <div className="shape-library-identificacao">
            <span
              className="shape-library-grip"
              aria-hidden="true"
              title="Arraste para reordenar"
              draggable={!ocupada && grupo.length > 1}
              onDragStart={(evento) => {
                arrastada.current = id;
                evento.dataTransfer.effectAllowed = 'move';
                evento.dataTransfer.setData('text/plain', id);
              }}
              onDragEnd={() => {
                arrastada.current = null;
                setDestino(null);
              }}
            >
              ⠿
            </span>
            <div className="shape-library-miniatura">
              <MiniaturaForma propria={forma} />
            </div>
            <div className="shape-library-nomes">
              <strong>{nome}</strong>
              {pasta !== PASTA_PADRAO && <small>{pasta}</small>}
            </div>
          </div>
          <div className="shape-library-controls" aria-label={`Ações para ${nome}`} role="group">
            <button
              type="button"
              className="shape-library-favorita"
              disabled={ocupada}
              aria-label={`Favorita: ${nome}`}
              aria-pressed={favorita}
              title={favorita ? 'Remover dos favoritos' : 'Marcar como favorita'}
              onClick={() =>
                void executar(
                  () => atualizarForma(id, { favorita: !favorita }),
                  favorita ? 'Forma removida das favoritas.' : 'Forma adicionada às favoritas.',
                )
              }
            >
              {favorita ? '★' : '☆'}
            </button>
            <button
              type="button"
              className="shape-library-ordem"
              disabled={ocupada || !antes}
              aria-label={`Subir ${nome}`}
              title="Mover para cima"
              onClick={() => antes && mover(grupo, id, antes.id)}
            >
              ↑
            </button>
            <button
              type="button"
              className="shape-library-ordem"
              disabled={ocupada || !depois}
              aria-label={`Descer ${nome}`}
              title="Mover para baixo"
              onClick={() => depois && mover(grupo, id, depois.id)}
            >
              ↓
            </button>
            <button type="button" disabled={ocupada} onClick={() => editar(forma)}>
              Editar
            </button>
            <button
              type="button"
              disabled={ocupada}
              aria-expanded={alteracao?.tipo === 'renomear'}
              onClick={() => setAcao({ tipo: 'renomear', id, nome, pasta })}
            >
              Renomear
            </button>
            <button
              type="button"
              disabled={ocupada}
              onClick={() => void executar(() => duplicarForma(id), 'Forma duplicada.')}
            >
              Duplicar
            </button>
            <button
              type="button"
              disabled={ocupada}
              aria-expanded={alteracao?.tipo === 'excluir'}
              onClick={() => setAcao({ tipo: 'excluir', id })}
            >
              Excluir
            </button>
          </div>
        </div>

        {alteracao?.tipo === 'renomear' && (
          <form
            className="shape-library-rename"
            onSubmit={(evento) => {
              evento.preventDefault();
              void executar(
                () =>
                  atualizarForma(id, {
                    nome: alteracao.nome.trim(),
                    pasta: alteracao.pasta.trim() || PASTA_PADRAO,
                  }),
                'Forma renomeada.',
              );
            }}
          >
            <label className="field">
              Nome da forma
              <input
                autoFocus
                required
                maxLength={MAX_NOME_FORMA}
                value={alteracao.nome}
                onChange={(evento) => setAcao({ ...alteracao, nome: evento.currentTarget.value })}
              />
            </label>
            <label className="field">
              Pasta
              <input
                maxLength={MAX_PASTA_FORMA}
                value={alteracao.pasta}
                onChange={(evento) => setAcao({ ...alteracao, pasta: evento.currentTarget.value })}
              />
            </label>
            <div className="shape-library-inline-actions">
              <button type="button" disabled={ocupada} onClick={() => setAcao(undefined)}>
                Cancelar
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={ocupada || !alteracao.nome.trim()}
              >
                Salvar nome
              </button>
            </div>
          </form>
        )}

        {alteracao?.tipo === 'excluir' && (
          <section className="shape-library-confirmacao" aria-labelledby={idApagar}>
            <strong id={idApagar}>Excluir «{nome}» da biblioteca?</strong>
            <div className="shape-library-inline-actions">
              <button type="button" autoFocus disabled={ocupada} onClick={() => setAcao(undefined)}>
                Cancelar
              </button>
              <button
                type="button"
                className="shape-library-apagar"
                disabled={ocupada}
                onClick={() => void executar(() => excluirForma(id), 'Forma excluída.')}
              >
                Excluir forma
              </button>
            </div>
          </section>
        )}
      </li>
    );
  }

  const favoritas = formas.filter(({ favorita }) => favorita);
  const restantes = formas.filter(({ favorita }) => !favorita);

  return (
    <dialog
      ref={dialogo}
      className="window glass app-dialog shape-library"
      aria-labelledby={idTitulo}
      onCancel={(evento) => {
        evento.preventDefault();
        if (ocupada) return;
        if (acao) setAcao(undefined);
        else fechar();
      }}
      onClick={(evento) => {
        if (evento.target === dialogo.current && !ocupada) fechar();
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id={idTitulo}>
          Gerenciar formas
        </div>
        <button
          type="button"
          className="dialog-close"
          aria-label="Fechar biblioteca"
          disabled={ocupada}
          onClick={fechar}
        >
          ×
        </button>
      </div>
      <div className="window-body dialog-body shape-library-body">
        <div className="shape-library-topo">
          <h2>Minhas formas</h2>
          <div className="shape-library-arquivos">
            <input
              ref={seletor}
              type="file"
              accept=".rabisco-formas.json,application/json"
              hidden
              onChange={importar}
            />
            <button type="button" disabled={ocupada} onClick={() => seletor.current?.click()}>
              <Icon name="folder-open" /> Importar formas…
            </button>
            <button type="button" disabled={ocupada || formas.length === 0} onClick={exportar}>
              <Icon name="disk" /> Exportar formas
            </button>
          </div>
        </div>

        {formas.length === 0 && <p>As formas que você criar ou importar aparecem aqui.</p>}
        {favoritas.length > 0 && (
          <section className="shape-library-group" aria-label="Favoritas">
            <h3>Favoritas</h3>
            <ul>{favoritas.map(item)}</ul>
          </section>
        )}
        {restantes.length > 0 && (
          <section className="shape-library-group" aria-label="Formas salvas">
            {favoritas.length > 0 && <h3>Outras formas</h3>}
            <ul>{restantes.map(item)}</ul>
          </section>
        )}
        {erro && (
          <p role="alert" className="form-error">
            {erro}
          </p>
        )}
        <div className="shape-library-status" role="status">
          {aviso}
        </div>
      </div>
    </dialog>
  );
}
