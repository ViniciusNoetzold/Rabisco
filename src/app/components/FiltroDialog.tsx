import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { EditorApi } from '../../canvas/editorTypes';
import { obterFiltro, type IdFiltro, type ParametrosFiltro } from '../../filtros/registro';
import { CurvaFiltro } from './CurvaFiltro';
import type { RunAction } from './Primitives';
import './filtros.css';

export function FiltroDialog({
  acao,
  editor,
  fechar,
  run,
}: {
  acao: IdFiltro | 'repetir';
  editor: RefObject<EditorApi | null>;
  fechar(): void;
  run: RunAction;
}) {
  const filtro = acao === 'repetir' ? null : obterFiltro(acao);
  const titulo = useId();
  const modal = useRef<HTMLDialogElement>(null);
  const [parametros, definirParametros] = useState<ParametrosFiltro>(() =>
    Object.fromEntries(Object.entries(filtro?.parametros ?? {}).map(([id, p]) => [id, p.padrao])),
  );
  const [parametrosDaPrevia, definirParametrosDaPrevia] = useState<ParametrosFiltro | null>(null);
  const [demorando, definirDemorando] = useState(false);
  const [mostrandoOriginal, definirMostrandoOriginal] = useState(false);
  const [amostrar, definirAmostrar] = useState<'preto' | 'branco' | null>(null);
  const pronto = parametrosDaPrevia === parametros;

  useLayoutEffect(() => {
    const janela = modal.current;
    janela?.showModal();
    return () => janela?.close();
  }, []);

  useEffect(() => {
    const controlador = editor.current;
    return () => controlador?.cancelarFiltro();
  }, [editor]);

  useEffect(() => {
    const controlador = editor.current;
    if (!controlador) return;
    let atual = true;
    definirDemorando(false);
    const aoDemorar = () => {
      if (atual) definirDemorando(true);
    };
    const espera = setTimeout(
      () => {
        run(async () => {
          try {
            if (acao === 'repetir') {
              await controlador.repetirFiltro(aoDemorar);
              if (atual) fechar();
              return;
            }
            const resultado = await controlador.preverFiltro(acao, parametros, aoDemorar);
            if (!atual) return;
            if (resultado) {
              definirDemorando(false);
              definirParametrosDaPrevia(parametros);
            } else {
              fechar();
            }
          } catch (erro) {
            if (!atual) return;
            fechar();
            throw erro;
          }
        });
      },
      filtro?.parametros && Object.keys(filtro.parametros).length ? 60 : 0,
    );
    return () => {
      atual = false;
      clearTimeout(espera);
      controlador.cancelarFiltro(false);
    };
  }, [acao, editor, fechar, filtro, parametros, run]);

  const mostrarOriginal = useCallback(
    (mostrar: boolean) => {
      definirMostrandoOriginal(mostrar);
      editor.current?.exibirPreviaFiltro(!mostrar);
    },
    [editor],
  );

  useEffect(() => {
    if (!mostrandoOriginal) return;
    const soltar = () => mostrarOriginal(false);
    window.addEventListener('blur', soltar);
    return () => window.removeEventListener('blur', soltar);
  }, [mostrarOriginal, mostrandoOriginal]);

  function cancelar() {
    editor.current?.cancelarFiltro();
    fechar();
  }

  return (
    <dialog
      ref={modal}
      className="window glass app-dialog filtro-dialog"
      aria-labelledby={titulo}
      data-amostrando={amostrar ?? undefined}
      onCancel={(evento) => {
        evento.preventDefault();
        if (amostrar) {
          definirAmostrar(null);
          mostrarOriginal(false);
        } else cancelar();
      }}
      onPointerDown={(evento) => {
        if (!amostrar || evento.target !== evento.currentTarget || evento.button !== 0) return;
        const nivel = editor.current?.amostrarNivelFiltro({ x: evento.clientX, y: evento.clientY });
        if (nivel == null) return;
        definirParametros((atuais) => ({
          ...atuais,
          [amostrar]:
            amostrar === 'preto'
              ? Math.min(nivel, Number(atuais.branco) - 1)
              : Math.max(nivel, Number(atuais.preto) + 1),
        }));
        definirAmostrar(null);
        mostrarOriginal(false);
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id={titulo}>
          {filtro?.nome ?? 'Repetir último filtro'}
        </div>
        <button
          type="button"
          className="dialog-close"
          aria-label="Fechar janela"
          onClick={cancelar}
        >
          ×
        </button>
      </div>
      <div className="window-body dialog-body filtro-corpo">
        {filtro &&
          Object.entries(filtro.parametros).map(([id, parametro]) => {
            const alterar = (valor: ParametrosFiltro[string]) =>
              definirParametros((atuais) => ({ ...atuais, [id]: valor }));
            if (parametro.tipo === 'curva') {
              const pontos = parametros[id];
              return (
                <CurvaFiltro
                  key={id}
                  nome={parametro.nome}
                  pontos={Array.isArray(pontos) ? pontos : parametro.padrao}
                  alterar={alterar}
                />
              );
            }
            if (parametro.tipo === 'numero') {
              const valor = Number(parametros[id]);
              return (
                <label key={id} className="filtro-parametro">
                  <span>
                    {parametro.nome} <output aria-hidden="true">{valor}</output>
                  </span>
                  <input
                    type="range"
                    aria-label={parametro.nome}
                    min={parametro.minimo}
                    max={parametro.maximo}
                    step={parametro.passo}
                    value={valor}
                    onChange={(evento) => alterar(evento.target.valueAsNumber)}
                  />
                </label>
              );
            }
            if (parametro.tipo === 'booleano') {
              return (
                <label key={id} className="filtro-parametro filtro-parametro-marcacao">
                  <input
                    type="checkbox"
                    checked={Boolean(parametros[id])}
                    onChange={(evento) => alterar(evento.target.checked)}
                  />
                  {parametro.nome}
                </label>
              );
            }
            return (
              <label key={id} className="filtro-parametro">
                {parametro.nome}
                <select
                  value={String(parametros[id])}
                  onChange={(evento) => alterar(evento.target.value)}
                >
                  {parametro.opcoes.map(({ valor, nome }) => (
                    <option key={valor} value={valor}>
                      {nome}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        {acao === 'niveis' && (
          <div className="filtro-acoes">
            {(['preto', 'branco'] as const).map((ponto) => (
              <button
                key={ponto}
                type="button"
                disabled={!pronto}
                aria-pressed={amostrar === ponto}
                onClick={() => {
                  const proximo = amostrar === ponto ? null : ponto;
                  definirAmostrar(proximo);
                  mostrarOriginal(Boolean(proximo));
                }}
              >
                Amostrar {ponto}
              </button>
            ))}
          </div>
        )}
        <div className="filtro-status" role="status">
          {amostrar ? 'Clique no papel para escolher o ponto.' : demorando ? 'Aplicando…' : ''}
        </div>
        <div className="filtro-acoes">
          {filtro && (
            <button
              type="button"
              disabled={!pronto}
              aria-pressed={mostrandoOriginal}
              title="Segure para ver o original"
              onPointerDown={(evento) => {
                if (evento.button !== 0 || !evento.isPrimary) return;
                evento.currentTarget.setPointerCapture(evento.pointerId);
                mostrarOriginal(true);
              }}
              onPointerUp={() => mostrarOriginal(false)}
              onPointerCancel={() => mostrarOriginal(false)}
              onLostPointerCapture={() => mostrarOriginal(false)}
              onKeyDown={(evento) => {
                if (evento.key !== ' ' && evento.key !== 'Enter') return;
                evento.preventDefault();
                evento.stopPropagation();
                if (!evento.repeat) mostrarOriginal(true);
              }}
              onKeyUp={(evento) => {
                if (evento.key !== ' ' && evento.key !== 'Enter') return;
                evento.preventDefault();
                evento.stopPropagation();
                mostrarOriginal(false);
              }}
              onBlur={() => mostrarOriginal(false)}
              onClick={(evento) => {
                if (evento.detail === 0) mostrarOriginal(!mostrandoOriginal);
              }}
            >
              Antes/depois
            </button>
          )}
          <button type="button" onClick={cancelar}>
            Cancelar
          </button>
          {filtro && (
            <button
              type="button"
              className="primary-button"
              disabled={!pronto}
              onClick={() =>
                run(() => {
                  try {
                    editor.current?.aplicarFiltro();
                  } finally {
                    fechar();
                  }
                })
              }
            >
              Aplicar
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
