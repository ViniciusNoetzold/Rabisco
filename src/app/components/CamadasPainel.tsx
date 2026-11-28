import { useEffect, useRef, useState, type RefObject } from 'react';
import type { DocumentInfo, EditorApi } from '../../canvas/CanvasSurface';
import { useEditor } from '../store';
import { AjusteCamadaDialog, type AlvoDialogoAjuste } from './AjusteCamadaDialog';
import {
  MODOS_MESCLAGEM,
  type Grupo,
  type EfeitosCamada,
  novoId,
  type ModoMesclagem,
  type PropriedadesCamada,
} from '../../document/camadas';

interface CamadasPainelProps {
  info: DocumentInfo;
  editor: RefObject<EditorApi | null>;
  onEditarAscii(id: string): void;
}

/** Miniatura que se redesenha no máximo 4 vezes por segundo enquanto se desenha. */
function Miniatura({
  editor,
  id,
  mascara = false,
  revisao,
}: {
  editor: RefObject<EditorApi | null>;
  id: string;
  mascara?: boolean;
  revisao: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ultima = useRef(0);
  useEffect(() => {
    const desenhar = () => {
      ultima.current = performance.now();
      if (canvas.current) editor.current?.miniatura(id, canvas.current, mascara);
    };
    const espera = Math.max(0, 250 - (performance.now() - ultima.current));
    const timer = window.setTimeout(desenhar, espera);
    return () => window.clearTimeout(timer);
  }, [editor, id, mascara, revisao]);
  return (
    <canvas ref={canvas} className="camada-miniatura" width={44} height={30} aria-hidden="true" />
  );
}

/** Painel de camadas: lista (a de cima primeiro), propriedades da ativa e ações. */
export function CamadasPainel({ info, editor, onEditarAscii }: CamadasPainelProps) {
  const { estrutura, revisao } = info;
  const formasEmNovaCamada = useEditor((estado) => estado.formasEmNovaCamada);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [arrastada, setArrastada] = useState<string | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [dialogoAjuste, definirDialogoAjuste] = useState<AlvoDialogoAjuste | null>(null);
  const camadas = [...estrutura.camadas].reverse();
  // Grupos aparecem como cabeçalho acima da camada mais alta deles; recolhidos escondem as camadas.
  const gruposPorId = new Map(estrutura.grupos.map((grupo) => [grupo.id, grupo]));
  const vistos = new Set<string>();
  const linhas = camadas.flatMap((camada) => {
    const grupo = camada.grupo ? gruposPorId.get(camada.grupo) : undefined;
    const itens: (
      | { tipo: 'grupo'; grupo: Grupo }
      | { tipo: 'camada'; camada: PropriedadesCamada }
    )[] = [];
    if (grupo && !vistos.has(grupo.id)) {
      vistos.add(grupo.id);
      itens.push({ tipo: 'grupo', grupo });
    }
    if (!grupo?.recolhido) itens.push({ tipo: 'camada', camada });
    return itens;
  });
  const posicaoAtiva = estrutura.camadas.findIndex((camada) => camada.id === estrutura.ativa);
  const ativa = estrutura.camadas[posicaoAtiva];
  // Ctrl/Shift+clique: outras camadas escolhidas junto com a ativa (para distribuir).
  const escolhidas = [
    ...new Set(
      [estrutura.ativa, ...extras].filter((id) => estrutura.camadas.some((c) => c.id === id)),
    ),
  ];
  function escolher(id: string, evento: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
    if (evento.shiftKey) {
      const ids = estrutura.camadas.map((c) => c.id);
      const de = ids.indexOf(estrutura.ativa);
      const ate = ids.indexOf(id);
      setExtras(ids.slice(Math.min(de, ate), Math.max(de, ate) + 1));
      return;
    }
    if (evento.ctrlKey || evento.metaKey) {
      if (id === estrutura.ativa) return;
      setExtras((atuais) =>
        atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id],
      );
      return;
    }
    setExtras([]);
    api()?.ativarCamada(id);
  }
  const api = () => editor.current;
  const alterar = (id: string, propriedades: Partial<PropriedadesCamada>) =>
    api()?.executarCamada({ tipo: 'AlterarCamada', id, propriedades });

  return (
    <section className="camadas-painel" aria-label="Camadas">
      <div className="section-heading">
        Camadas <span>{estrutura.camadas.length}</span>
      </div>
      <ul className="camadas-lista" role="listbox" aria-label="Lista de camadas">
        {linhas.map((linha) => {
          if (linha.tipo === 'grupo')
            return <CabecalhoGrupo key={linha.grupo.id} grupo={linha.grupo} api={api} />;
          const { camada } = linha;
          const selecionada = camada.id === estrutura.ativa;
          const escolhida = escolhidas.includes(camada.id);
          return (
            <li
              key={camada.id}
              role="option"
              aria-selected={escolhida}
              tabIndex={selecionada ? 0 : -1}
              className={`camada-item ${camada.grupo ? 'no-grupo' : ''} ${selecionada ? 'selecionada' : ''} ${escolhida && !selecionada ? 'escolhida' : ''} ${arrastada === camada.id ? 'arrastando' : ''}`}
              style={camada.etiqueta ? { borderLeftColor: camada.etiqueta } : undefined}
              draggable
              onDragStart={() => setArrastada(camada.id)}
              onDragEnd={() => setArrastada(null)}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={(evento) => {
                evento.preventDefault();
                if (!arrastada || arrastada === camada.id) return;
                const posicao = estrutura.camadas.findIndex((item) => item.id === camada.id);
                api()?.executarCamada({
                  tipo: 'MoverCamada',
                  id: arrastada,
                  posicao,
                  grupo: camada.grupo ?? null,
                });
                setArrastada(null);
              }}
              onClick={(evento) => escolher(camada.id, evento)}
              onKeyDown={(evento) => {
                if (evento.key === 'F2') setRenomeando(camada.id);
                if (evento.key === 'Enter' && camada.ajuste && !camada.locked && evento.currentTarget === evento.target)
                  definirDialogoAjuste({ id: camada.id, ajuste: camada.ajuste });
              }}
            >
              <button
                type="button"
                className="camada-olho"
                aria-label={camada.visible ? `Ocultar ${camada.name}` : `Mostrar ${camada.name}`}
                aria-pressed={camada.visible}
                title={camada.visible ? 'Ocultar (Alt+clique: mostrar só esta)' : 'Mostrar'}
                onClick={(evento) => {
                  evento.stopPropagation();
                  if (evento.altKey) {
                    api()?.executarCamada({
                      tipo: 'Lote',
                      rotulo: 'Mostrar só esta camada',
                      comandos: estrutura.camadas.map((outra) => ({
                        tipo: 'AlterarCamada' as const,
                        id: outra.id,
                        propriedades: { visible: outra.id === camada.id },
                      })),
                    });
                  } else alterar(camada.id, { visible: !camada.visible });
                }}
              >
                {camada.visible ? '👁' : '–'}
              </button>
              {camada.ajuste
                ? <span className="camada-miniatura" aria-hidden="true" title="Camada de ajuste">±</span>
                : <Miniatura editor={editor} id={camada.id} revisao={revisao} />}
              {camada.temMascara && (
                <button
                  type="button"
                  className={`camada-mascara ${selecionada && estrutura.editandoMascara ? 'editando' : ''} ${camada.mascaraAtiva === false ? 'desligada' : ''}`}
                  aria-label={`Máscara de ${camada.name}`}
                  title="Clique: pintar na máscara. Shift+clique: ligar ou desligar."
                  onClick={(evento) => {
                    evento.stopPropagation();
                    if (evento.shiftKey)
                      alterar(camada.id, { mascaraAtiva: camada.mascaraAtiva === false });
                    else api()?.ativarCamada(camada.id, true);
                  }}
                >
                  <Miniatura editor={editor} id={camada.id} mascara revisao={revisao} />
                </button>
              )}
              {renomeando === camada.id ? (
                <input
                  className="camada-nome-campo"
                  aria-label="Nome da camada"
                  defaultValue={camada.name}
                  autoFocus
                  maxLength={60}
                  onClick={(evento) => evento.stopPropagation()}
                  onBlur={(evento) => {
                    const nome = evento.target.value.trim();
                    if (nome && nome !== camada.name) alterar(camada.id, { name: nome });
                    setRenomeando(null);
                  }}
                  onKeyDown={(evento) => {
                    evento.stopPropagation();
                    if (evento.key === 'Enter') evento.currentTarget.blur();
                    if (evento.key === 'Escape') setRenomeando(null);
                  }}
                />
              ) : (
                <span
                  className="camada-nome"
                  onDoubleClick={() => {
                    if (camada.ajuste && !camada.locked) definirDialogoAjuste({ id: camada.id, ajuste: camada.ajuste });
                    else setRenomeando(camada.id);
                  }}
                >
                  {camada.recorte && <span title="Máscara de recorte">↳ </span>}
                  {camada.name}
                  {camada.opacity < 1 && <small> {Math.round(camada.opacity * 100)}%</small>}
                </span>
              )}
              <button
                type="button"
                className="camada-cadeado"
                aria-label={
                  camada.locked ? `Desbloquear ${camada.name}` : `Bloquear ${camada.name}`
                }
                aria-pressed={camada.locked}
                title={camada.locked ? 'Desbloquear' : 'Bloquear'}
                onClick={(evento) => {
                  evento.stopPropagation();
                  alterar(camada.id, { locked: !camada.locked });
                }}
              >
                {camada.locked ? '🔒' : '🔓'}
              </button>
            </li>
          );
        })}
      </ul>

      {ativa && (
        <div className="camada-propriedades">
          <label>
            Opacidade
            <input
              type="range"
              min="0"
              max="100"
              aria-label="Opacidade da camada"
              key={`${ativa.id}-${ativa.opacity}`}
              defaultValue={Math.round(ativa.opacity * 100)}
              onPointerUp={(evento) =>
                alterar(ativa.id, { opacity: Number(evento.currentTarget.value) / 100 })
              }
              onKeyUp={(evento) =>
                alterar(ativa.id, { opacity: Number(evento.currentTarget.value) / 100 })
              }
            />
          </label>
          <label>
            Modo
            <select
              aria-label="Modo de mesclagem"
              value={ativa.modo}
              disabled={Boolean(ativa.ajuste)}
              onChange={(evento) =>
                alterar(ativa.id, { modo: evento.target.value as ModoMesclagem })
              }
            >
              {Object.entries(MODOS_MESCLAGEM).map(([valor, { nome }]) => (
                <option key={valor} value={valor}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <div className="camada-opcoes">
            <label title="Pinta só onde já existe pixel (ótimo para colorir desenhos)">
              <input
                type="checkbox"
                checked={ativa.bloqueioTransparencia}
                disabled={Boolean(ativa.ajuste)}
                onChange={(evento) =>
                  alterar(ativa.id, { bloqueioTransparencia: evento.target.checked })
                }
              />
              Travar transparência
            </label>
            <label title="Só aparece dentro dos pixels da camada de baixo">
              <input
                type="checkbox"
                checked={Boolean(ativa.recorte)}
                disabled={estrutura.camadas[0]?.id === ativa.id}
                onChange={(evento) => alterar(ativa.id, { recorte: evento.target.checked })}
              />
              Recortar pela de baixo
            </label>
            <label title="Cada forma confirmada entra numa camada própria">
              <input
                type="checkbox"
                checked={formasEmNovaCamada}
                onChange={(evento) =>
                  useEditor.getState().set({ formasEmNovaCamada: evento.target.checked })
                }
              />
              Formas em nova camada
            </label>
          </div>
        </div>
      )}

      {ativa && !ativa.ajuste && (
        <label className="camada-alinhar">
          Alinhar ao papel
          <select
            aria-label="Alinhar ao papel"
            value=""
            onChange={(evento) => {
              const lado = evento.target.value as Parameters<EditorApi['alinharAtiva']>[0];
              if (lado) api()?.alinharAtiva(lado);
            }}
          >
            <option value="">Escolha…</option>
            <option value="esquerda">À esquerda</option>
            <option value="centro-h">Ao centro (horizontal)</option>
            <option value="direita">À direita</option>
            <option value="topo">Ao topo</option>
            <option value="centro-v">Ao meio (vertical)</option>
            <option value="base">À base</option>
          </select>
        </label>
      )}
      {escolhidas.length > 1 && (
        <div className="camadas-distribuir" role="group" aria-label="Várias camadas">
          <span>{escolhidas.length} camadas</span>
          <button
            type="button"
            disabled={escolhidas.length < 3}
            title="Espaços iguais na horizontal (as das pontas ficam paradas)"
            onClick={() => api()?.distribuirCamadas(escolhidas, 'horizontal')}
          >
            Distribuir ↔
          </button>
          <button
            type="button"
            disabled={escolhidas.length < 3}
            title="Espaços iguais na vertical (as das pontas ficam paradas)"
            onClick={() => api()?.distribuirCamadas(escolhidas, 'vertical')}
          >
            Distribuir ↕
          </button>
        </div>
      )}
      {ativa && !ativa.ajuste && <EfeitosDaCamada camada={ativa} alterar={alterar} api={api} />}

      <div className="camadas-acoes" role="toolbar" aria-label="Ações de camada">
        {ativa?.ajuste && (
          <>
            <button type="button" disabled={ativa.locked} onClick={() => definirDialogoAjuste({ id: ativa.id, ajuste: ativa.ajuste })}>
              Editar ajuste
            </button>
            {ativa.temMascara && (
              <button type="button" onClick={() => api()?.executarCamada({ tipo: 'ExcluirMascara', id: ativa.id })}>
                Excluir máscara
              </button>
            )}
          </>
        )}
        {ativa?.ascii && (
          <button type="button" disabled={ativa.locked} onClick={() => onEditarAscii(ativa.id)}>
            Editar ASCII
          </button>
        )}
        <button
          type="button"
          title="Nova camada (Ctrl+Shift+N)"
          onClick={() => api()?.novaCamada()}
        >
          ＋ Nova
        </button>
        <button type="button" onClick={() => definirDialogoAjuste({ acimaDe: ativa?.id })}>
          Nova camada de ajuste
        </button>
        <button
          type="button"
          title="Põe a camada ativa num grupo novo (Ctrl+G). Arraste outras camadas para dentro."
          disabled={!ativa || Boolean(ativa.grupo)}
          onClick={() => ativa && api()?.agruparAtiva()}
        >
          Agrupar
        </button>
        <button
          type="button"
          title={
            ativa?.ajuste
              ? 'Transformação livre disponível para camadas com pixels'
              : 'Transformação livre: mover, escalar e girar (Ctrl+T)'
          }
          disabled={!ativa || Boolean(ativa.ajuste)}
          onClick={() => useEditor.getState().setTool('transform')}
        >
          Transformar
        </button>
        <button
          type="button"
          title="Duplicar camada (Ctrl+J)"
          disabled={!ativa}
          onClick={() =>
            ativa &&
            api()?.executarCamada({
              tipo: 'DuplicarCamada',
              id: ativa.id,
              novoId: novoId('camada'),
            })
          }
        >
          Duplicar
        </button>
        <button
          type="button"
          title="Adicionar máscara (com uma seleção, só a área selecionada fica visível)"
          disabled={!ativa || ativa.temMascara}
          onClick={() => ativa && api()?.adicionarMascara(ativa.id)}
        >
          Máscara
        </button>
        <button
          type="button"
          title="Mesclar com a camada de baixo (Ctrl+Shift+M)"
          disabled={posicaoAtiva < 1 || Boolean(ativa?.ajuste || estrutura.camadas[posicaoAtiva - 1]?.ajuste)}
          onClick={() => ativa && api()?.executarCamada({ tipo: 'MesclarAbaixo', id: ativa.id })}
        >
          Mesclar
        </button>
        <button
          type="button"
          title="Excluir camada"
          disabled={!ativa || estrutura.camadas.length < 2}
          onClick={() => {
            if (!ativa) return;
            if (!window.confirm(`Excluir a camada "${ativa.name}"? Você pode desfazer com Ctrl+Z.`))
              return;
            api()?.executarCamada({ tipo: 'ExcluirCamada', id: ativa.id });
          }}
        >
          Excluir
        </button>
      </div>
      {dialogoAjuste && (
        <AjusteCamadaDialog alvo={dialogoAjuste} editor={editor} fechar={() => definirDialogoAjuste(null)} />
      )}
    </section>
  );
}

const ADESIVO: EfeitosCamada = {
  contorno: { cor: '#ffffff', espessura: 8, posicao: 'fora' },
  sombra: { cor: '#000000', distancia: 6, angulo: 45, desfoque: 6, opacidade: 0.35 },
};

/** Contorno, sombra e o atalho "Adesivo" (modo de colagem), mais as ações da máscara. */
function EfeitosDaCamada({
  camada,
  alterar,
  api,
}: {
  camada: PropriedadesCamada;
  alterar: (id: string, propriedades: Partial<PropriedadesCamada>) => unknown;
  api: () => EditorApi | null;
}) {
  const efeitos = camada.efeitos ?? {};
  const mudar = (novos: EfeitosCamada) => {
    const limpos: EfeitosCamada = {};
    if (novos.contorno) limpos.contorno = novos.contorno;
    if (novos.sombra) limpos.sombra = novos.sombra;
    alterar(camada.id, { efeitos: limpos.contorno || limpos.sombra ? limpos : undefined });
  };
  const contorno = efeitos.contorno ?? { cor: '#ffffff', espessura: 6, posicao: 'fora' as const };
  const sombra = efeitos.sombra ?? {
    cor: '#000000',
    distancia: 6,
    angulo: 45,
    desfoque: 6,
    opacidade: 0.35,
  };
  const numero = (evento: { currentTarget: HTMLInputElement }) =>
    Number(evento.currentTarget.value);
  const temEfeito = Boolean(efeitos.contorno || efeitos.sombra);
  return (
    <details className="camada-efeitos">
      <summary>Efeitos e máscara</summary>
      <div className="camada-efeitos-corpo" key={`${camada.id}-${JSON.stringify(efeitos)}`}>
        <button
          type="button"
          className="botao-adesivo"
          title="Contorno branco e sombra suave, como um adesivo recortado"
          onClick={() => mudar(temEfeito ? {} : ADESIVO)}
        >
          {temEfeito ? 'Tirar efeitos' : '✨ Virar adesivo'}
        </button>
        <label>
          <input
            type="checkbox"
            checked={Boolean(efeitos.contorno)}
            onChange={(evento) =>
              mudar({ ...efeitos, contorno: evento.target.checked ? contorno : undefined })
            }
          />
          Contorno
        </label>
        {efeitos.contorno && (
          <div className="efeito-ajustes">
            <input
              type="color"
              aria-label="Cor do contorno"
              defaultValue={contorno.cor}
              onBlur={(evento) =>
                mudar({ ...efeitos, contorno: { ...contorno, cor: evento.target.value } })
              }
            />
            <input
              type="range"
              min="1"
              max="30"
              aria-label="Espessura do contorno"
              defaultValue={contorno.espessura}
              onPointerUp={(evento) =>
                mudar({ ...efeitos, contorno: { ...contorno, espessura: numero(evento) } })
              }
              onKeyUp={(evento) =>
                mudar({ ...efeitos, contorno: { ...contorno, espessura: numero(evento) } })
              }
            />
            <select
              aria-label="Posição do contorno"
              value={contorno.posicao}
              onChange={(evento) =>
                mudar({
                  ...efeitos,
                  contorno: { ...contorno, posicao: evento.target.value as 'fora' | 'dentro' },
                })
              }
            >
              <option value="fora">Fora</option>
              <option value="dentro">Dentro</option>
            </select>
          </div>
        )}
        <label>
          <input
            type="checkbox"
            checked={Boolean(efeitos.sombra)}
            onChange={(evento) =>
              mudar({ ...efeitos, sombra: evento.target.checked ? sombra : undefined })
            }
          />
          Sombra
        </label>
        {efeitos.sombra && (
          <div className="efeito-ajustes">
            <input
              type="color"
              aria-label="Cor da sombra"
              defaultValue={sombra.cor}
              onBlur={(evento) =>
                mudar({ ...efeitos, sombra: { ...sombra, cor: evento.target.value } })
              }
            />
            <input
              type="range"
              min="0"
              max="40"
              aria-label="Distância da sombra"
              title="Distância"
              defaultValue={sombra.distancia}
              onPointerUp={(evento) =>
                mudar({ ...efeitos, sombra: { ...sombra, distancia: numero(evento) } })
              }
              onKeyUp={(evento) =>
                mudar({ ...efeitos, sombra: { ...sombra, distancia: numero(evento) } })
              }
            />
            <input
              type="range"
              min="0"
              max="30"
              aria-label="Desfoque da sombra"
              title="Desfoque"
              defaultValue={sombra.desfoque}
              onPointerUp={(evento) =>
                mudar({ ...efeitos, sombra: { ...sombra, desfoque: numero(evento) } })
              }
              onKeyUp={(evento) =>
                mudar({ ...efeitos, sombra: { ...sombra, desfoque: numero(evento) } })
              }
            />
          </div>
        )}
        {camada.temMascara && (
          <div className="efeito-mascara">
            <button
              type="button"
              title="Junta a máscara aos pixels da camada"
              onClick={() => api()?.executarCamada({ tipo: 'AplicarMascara', id: camada.id })}
            >
              Aplicar máscara
            </button>
            <button
              type="button"
              onClick={() => api()?.executarCamada({ tipo: 'ExcluirMascara', id: camada.id })}
            >
              Excluir máscara
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

/** Cabeçalho de um grupo: recolher, mostrar ou ocultar, renomear e desagrupar. */
function CabecalhoGrupo({ grupo, api }: { grupo: Grupo; api: () => EditorApi | null }) {
  const [renomeando, setRenomeando] = useState(false);
  const alterar = (propriedades: Partial<Omit<Grupo, 'id'>>) =>
    api()?.executarCamada({ tipo: 'AlterarGrupo', id: grupo.id, propriedades });
  return (
    <li className="camada-grupo" role="presentation">
      <button
        type="button"
        className="grupo-seta"
        aria-expanded={!grupo.recolhido}
        aria-label={grupo.recolhido ? `Abrir ${grupo.name}` : `Recolher ${grupo.name}`}
        onClick={() => alterar({ recolhido: !grupo.recolhido })}
      >
        {grupo.recolhido ? '▸' : '▾'}
      </button>
      <button
        type="button"
        className="camada-olho"
        aria-label={grupo.visible ? `Ocultar grupo ${grupo.name}` : `Mostrar grupo ${grupo.name}`}
        aria-pressed={grupo.visible}
        onClick={() => alterar({ visible: !grupo.visible })}
      >
        {grupo.visible ? '👁' : '–'}
      </button>
      <span aria-hidden="true">📁</span>
      {renomeando ? (
        <input
          className="camada-nome-campo"
          aria-label="Nome do grupo"
          defaultValue={grupo.name}
          autoFocus
          maxLength={60}
          onBlur={(evento) => {
            const nome = evento.target.value.trim();
            if (nome && nome !== grupo.name) alterar({ name: nome });
            setRenomeando(false);
          }}
          onKeyDown={(evento) => {
            evento.stopPropagation();
            if (evento.key === 'Enter') evento.currentTarget.blur();
            if (evento.key === 'Escape') setRenomeando(false);
          }}
        />
      ) : (
        <span className="camada-nome" onDoubleClick={() => setRenomeando(true)}>
          {grupo.name}
        </span>
      )}
      <button
        type="button"
        className="grupo-desagrupar"
        title="Desagrupar (as camadas continuam no lugar)"
        aria-label={`Desagrupar ${grupo.name}`}
        onClick={() => api()?.executarCamada({ tipo: 'Desagrupar', grupoId: grupo.id })}
      >
        ⊘
      </button>
    </li>
  );
}
