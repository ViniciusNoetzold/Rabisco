import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { EditorApi } from '../../canvas/editorTypes';
import {
  ajustePadrao,
  FILTROS_AJUSTE,
  type AjusteCamada,
  type IdAjuste,
} from '../../document/ajustes';
import { novoId } from '../../document/camadas';
import { obterFiltro, type ParametrosFiltro } from '../../filtros/registro';
import { CurvaFiltro } from './CurvaFiltro';
import './filtros.css';

export interface AlvoDialogoAjuste {
  id?: string;
  acimaDe?: string;
  ajuste?: AjusteCamada;
}

export function AjusteCamadaDialog({
  alvo,
  editor,
  fechar,
}: {
  alvo: AlvoDialogoAjuste;
  editor: RefObject<EditorApi | null>;
  fechar(): void;
}) {
  const titulo = useId();
  const janela = useRef<HTMLDialogElement>(null);
  const [ajuste, definirAjuste] = useState(() => alvo.ajuste ?? ajustePadrao(FILTROS_AJUSTE[0]));
  const filtro = obterFiltro(ajuste.filtro);

  useLayoutEffect(() => {
    const dialogo = janela.current;
    dialogo?.showModal();
    return () => dialogo?.close();
  }, []);

  useEffect(() => {
    const api = editor.current;
    return () => api?.mostrarPreviaAjuste();
  }, [editor]);

  useEffect(() => {
    const espera = setTimeout(() => {
      editor.current?.mostrarPreviaAjuste({ id: alvo.id, acimaDe: alvo.acimaDe, ajuste });
    }, 90);
    return () => clearTimeout(espera);
  }, [editor, alvo, ajuste]);

  function confirmar() {
    const api = editor.current;
    if (alvo.id) api?.executarCamada({ tipo: 'EditarCamadaAjuste', id: alvo.id, ajuste });
    else
      api?.executarCamada({
        tipo: 'NovaCamadaAjuste',
        id: novoId('camada'),
        nome: filtro.nome,
        acimaDe: alvo.acimaDe,
        ajuste,
      });
    fechar();
  }

  return (
    <dialog
      ref={janela}
      className="window glass app-dialog filtro-dialog"
      aria-labelledby={titulo}
      onKeyDown={(evento) => evento.stopPropagation()}
      onCancel={(evento) => {
        evento.preventDefault();
        fechar();
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id={titulo}>
          {alvo.id ? 'Editar camada de ajuste' : 'Nova camada de ajuste'}
        </div>
        <button type="button" className="dialog-close" aria-label="Fechar janela" onClick={fechar}>
          ×
        </button>
      </div>
      <div className="window-body dialog-body filtro-corpo">
        <label className="filtro-parametro">
          Filtro de ajuste
          <select
            value={ajuste.filtro}
            onChange={(evento) => definirAjuste(ajustePadrao(evento.target.value as IdAjuste))}
          >
            {FILTROS_AJUSTE.map((id) => (
              <option key={id} value={id}>
                {obterFiltro(id).nome}
              </option>
            ))}
          </select>
        </label>
        {Object.entries(filtro.parametros).map(([id, campo]) => {
          const alterar = (valor: ParametrosFiltro[string]) =>
            definirAjuste((atual) => ({
              ...atual,
              parametros: { ...atual.parametros, [id]: valor },
            }));
          const atual = ajuste.parametros[id];
          if (campo.tipo === 'curva') {
            return (
              <CurvaFiltro
                key={id}
                nome={campo.nome}
                pontos={Array.isArray(atual) ? atual : campo.padrao}
                alterar={alterar}
              />
            );
          }
          if (campo.tipo !== 'numero') return null;
          const valor = typeof atual === 'number' ? atual : campo.padrao;
          return (
            <label className="filtro-parametro" key={id}>
              <span>
                {campo.nome} <output aria-hidden="true">{valor}</output>
              </span>
              <input
                aria-label={campo.nome}
                type="range"
                min={campo.minimo}
                max={campo.maximo}
                step={campo.passo}
                value={valor}
                onChange={(evento) => alterar(evento.target.valueAsNumber)}
              />
            </label>
          );
        })}
        <div className="filtro-acoes">
          <button type="button" onClick={fechar}>
            Cancelar
          </button>
          <button type="button" className="primary-button" onClick={confirmar}>
            Aplicar ajuste
          </button>
        </div>
      </div>
    </dialog>
  );
}
