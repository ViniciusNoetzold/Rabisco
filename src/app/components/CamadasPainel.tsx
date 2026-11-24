import { useEffect, useRef, useState, type RefObject } from 'react';
import type { DocumentInfo, EditorApi } from '../../canvas/CanvasSurface';
import {
  MODOS_MESCLAGEM,
  novoId,
  type ModoMesclagem,
  type PropriedadesCamada,
} from '../../document/camadas';

interface CamadasPainelProps {
  info: DocumentInfo;
  editor: RefObject<EditorApi | null>;
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
export function CamadasPainel({ info, editor }: CamadasPainelProps) {
  const { estrutura, revisao } = info;
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [arrastada, setArrastada] = useState<string | null>(null);
  const camadas = [...estrutura.camadas].reverse();
  const ativa = estrutura.camadas.find((camada) => camada.id === estrutura.ativa);
  const api = () => editor.current;
  const alterar = (id: string, propriedades: Partial<PropriedadesCamada>) =>
    api()?.executarCamada({ tipo: 'AlterarCamada', id, propriedades });

  return (
    <section className="camadas-painel" aria-label="Camadas">
      <div className="section-heading">
        Camadas <span>{estrutura.camadas.length}</span>
      </div>
      <ul className="camadas-lista" role="listbox" aria-label="Lista de camadas">
        {camadas.map((camada) => {
          const selecionada = camada.id === estrutura.ativa;
          return (
            <li
              key={camada.id}
              role="option"
              aria-selected={selecionada}
              tabIndex={selecionada ? 0 : -1}
              className={`camada-item ${selecionada ? 'selecionada' : ''} ${arrastada === camada.id ? 'arrastando' : ''}`}
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
              onClick={() => api()?.ativarCamada(camada.id)}
              onKeyDown={(evento) => {
                if (evento.key === 'F2') setRenomeando(camada.id);
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
              <Miniatura editor={editor} id={camada.id} revisao={revisao} />
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
                <span className="camada-nome" onDoubleClick={() => setRenomeando(camada.id)}>
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
          </div>
        </div>
      )}

      <div className="camadas-acoes" role="toolbar" aria-label="Ações de camada">
        <button
          type="button"
          title="Nova camada (Ctrl+Shift+N)"
          onClick={() => api()?.novaCamada()}
        >
          ＋ Nova
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
          title="Adicionar máscara à camada"
          disabled={!ativa || ativa.temMascara}
          onClick={() => ativa && api()?.executarCamada({ tipo: 'AdicionarMascara', id: ativa.id })}
        >
          Máscara
        </button>
        <button
          type="button"
          title="Mesclar com a camada de baixo (Ctrl+Shift+M)"
          disabled={!ativa || estrutura.camadas[0]?.id === ativa.id}
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
    </section>
  );
}
