import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  caminhoDosContornos,
  caminhoParametrico,
  contornosDoCaminho,
  PARAMETROS_EDITOR,
  type BaseForma,
  type ParametrosEditorForma,
} from '../../shapes/editorForma';
import {
  MAX_NOME_FORMA,
  MAX_PASTA_FORMA,
  PASTA_PADRAO,
  validarCaminho,
  type DadosFormaPropria,
  type EstiloFormaSalvo,
  type FormaPropria,
} from '../../shapes/presets';
import type { EstiloContorno, EstiloPreenchimento } from '../../shapes/tipos';
import { ESPESSURA_MAXIMA, useEditor } from '../store';
import { FreeShapeControls, useEdicaoPontos } from './FreeShapeControls';
import { ShapeEditorPreview } from './ShapeEditorPreview';
import './custom-shape-editor.css';

export interface ReferenciaEditorForma {
  nome: string;
  path: string;
  fechada: boolean;
  estilo?: EstiloFormaSalvo;
}

interface CustomShapeEditorProps {
  editar: FormaPropria | null;
  referencia: ReferenciaEditorForma | null;
  aoSalvar(dados: DadosFormaPropria): Promise<void>;
  fechar(): void;
}

type Modo = 'parametrica' | 'desenhar' | 'origem';
const MODOS: { id: Modo; rotulo: string }[] = [
  { id: 'parametrica', rotulo: 'Paramétrica' },
  { id: 'desenhar', rotulo: 'Desenhar' },
  { id: 'origem', rotulo: 'A partir da seleção ou da última forma' },
];

const BASES: Record<BaseForma, string> = {
  poligono: 'Polígono regular',
  estrela: 'Estrela',
  retangulo: 'Retângulo arredondado',
  seta: 'Seta',
  balao: 'Balão',
};

interface ControleParametro {
  chave: keyof ParametrosEditorForma;
  rotulo: string;
  minimo: number;
  maximo: number;
  unidade?: string;
}

const CONTROLES: Record<BaseForma, ControleParametro[]> = {
  poligono: [{ chave: 'lados', rotulo: 'Lados', minimo: 3, maximo: 24 }],
  estrela: [
    { chave: 'pontas', rotulo: 'Pontas', minimo: 3, maximo: 24 },
    { chave: 'raioInterno', rotulo: 'Raio interno (%)', minimo: 10, maximo: 95, unidade: '%' },
  ],
  retangulo: [
    {
      chave: 'canto',
      rotulo: 'Arredondamento dos cantos (%)',
      minimo: 0,
      maximo: 37,
      unidade: '%',
    },
  ],
  seta: [
    { chave: 'haste', rotulo: 'Largura da haste (%)', minimo: 8, maximo: 90, unidade: '%' },
    {
      chave: 'pontaSeta',
      rotulo: 'Comprimento da ponta (%)',
      minimo: 12,
      maximo: 75,
      unidade: '%',
    },
  ],
  balao: [
    {
      chave: 'canto',
      rotulo: 'Arredondamento dos cantos (%)',
      minimo: 0,
      maximo: 37,
      unidade: '%',
    },
    { chave: 'cauda', rotulo: 'Posição da cauda (%)', minimo: 28, maximo: 70, unidade: '%' },
  ],
};
const ROTACAO: ControleParametro = {
  chave: 'rotacao',
  rotulo: 'Rotação (°)',
  minimo: -180,
  maximo: 180,
  unidade: '°',
};

const ESTILOS_PREENCHIMENTO: Record<EstiloPreenchimento, string> = {
  none: 'Nenhum',
  solid: 'Sólido',
  giz: 'Giz de cera',
  marcador: 'Marcador',
  aquarela: 'Aquarela',
};
const ESTILOS_CONTORNO: Record<EstiloContorno, string> = {
  ...ESTILOS_PREENCHIMENTO,
  dash: 'Tracejado',
  dot: 'Pontilhado',
};

function ParametricControls({
  base,
  definirBase,
  parametros,
  definirParametros,
}: {
  base: BaseForma;
  definirBase(base: BaseForma): void;
  parametros: ParametrosEditorForma;
  definirParametros(parametros: ParametrosEditorForma): void;
}) {
  return (
    <div className="shape-editor-controls">
      <label className="shape-editor-field">
        Base
        <select value={base} onChange={(evento) => definirBase(evento.target.value as BaseForma)}>
          {Object.entries(BASES).map(([id, nome]) => (
            <option value={id} key={id}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      {[...CONTROLES[base], ROTACAO].map(({ chave, rotulo, minimo, maximo, unidade }) => (
        <label className="shape-editor-field shape-editor-param" key={chave}>
          <span>{rotulo}</span>
          {unidade ? (
            <span className="shape-editor-range">
              <input
                type="range"
                min={minimo}
                max={maximo}
                value={parametros[chave]}
                onChange={(evento) =>
                  definirParametros({ ...parametros, [chave]: Number(evento.target.value) })
                }
              />
              <span aria-hidden="true">
                {parametros[chave]}
                {unidade}
              </span>
            </span>
          ) : (
            <input
              type="number"
              min={minimo}
              max={maximo}
              step={1}
              value={parametros[chave]}
              onChange={(evento) => {
                const valor = evento.target.valueAsNumber;
                if (Number.isInteger(valor) && valor >= minimo && valor <= maximo) {
                  definirParametros({ ...parametros, [chave]: valor });
                }
              }}
            />
          )}
        </label>
      ))}
    </div>
  );
}

function ShapeStyleFields({
  gravar,
  estilo,
  definirEstilo,
  definirGravacao,
}: {
  gravar: boolean;
  estilo: EstiloFormaSalvo;
  definirEstilo(estilo: EstiloFormaSalvo): void;
  definirGravacao(gravar: boolean): void;
}) {
  return (
    <fieldset className="shape-editor-style">
      <legend>
        <label>
          <input
            type="checkbox"
            checked={gravar}
            onChange={(evento) => definirGravacao(evento.target.checked)}
          />{' '}
          Salvar estilo padrão
        </label>
      </legend>
      {gravar && (
        <div className="shape-editor-style-fields">
          <label className="shape-editor-field">
            Contorno
            <select
              value={estilo.contorno}
              onChange={(evento) =>
                definirEstilo({ ...estilo, contorno: evento.target.value as EstiloContorno })
              }
            >
              {Object.entries(ESTILOS_CONTORNO).map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="shape-editor-field">
            Preenchimento
            <select
              value={estilo.preenchimento}
              onChange={(evento) =>
                definirEstilo({
                  ...estilo,
                  preenchimento: evento.target.value as EstiloPreenchimento,
                })
              }
            >
              {Object.entries(ESTILOS_PREENCHIMENTO).map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label className="shape-editor-field">
            Espessura (px)
            <input
              type="number"
              min={1}
              max={ESPESSURA_MAXIMA}
              value={estilo.espessura}
              onChange={(evento) => {
                const espessura = evento.target.valueAsNumber;
                if (espessura >= 1 && espessura <= ESPESSURA_MAXIMA)
                  definirEstilo({ ...estilo, espessura });
              }}
            />
          </label>
          <label className="shape-editor-field">
            Cor 1
            <input
              type="color"
              value={estilo.cor1}
              onChange={(evento) => definirEstilo({ ...estilo, cor1: evento.target.value })}
            />
          </label>
          <label className="shape-editor-field">
            Cor 2
            <input
              type="color"
              value={estilo.cor2}
              onChange={(evento) => definirEstilo({ ...estilo, cor2: evento.target.value })}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}

export function CustomShapeEditor({
  editar,
  referencia,
  aoSalvar,
  fechar,
}: CustomShapeEditorProps) {
  const modal = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [modo, definirModo] = useState<Modo>(editar ? 'desenhar' : 'parametrica');
  const [base, definirBase] = useState<BaseForma>('poligono');
  const [parametros, definirParametros] = useState(PARAMETROS_EDITOR);
  const [nome, definirNome] = useState(editar?.nome ?? '');
  const [pasta, definirPasta] = useState(editar?.pasta ?? '');
  const [gravarEstilo, definirGravacao] = useState(Boolean(editar?.estilo));
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState('');
  const edicao = useEdicaoPontos(
    () => (editar ? contornosDoCaminho(editar.path) : []),
    Boolean(editar),
  );
  const [estilo, definirEstilo] = useState<EstiloFormaSalvo>(() => {
    if (editar?.estilo) return editar.estilo;
    const { color1, color2, size, contornoForma, preenchimentoForma } = useEditor.getState();
    return {
      cor1: color1,
      cor2: color2,
      espessura: size,
      contorno: contornoForma,
      preenchimento: preenchimentoForma,
    };
  });
  const [contornosIniciais] = useState(edicao.contornos);

  useLayoutEffect(() => {
    modal.current?.showModal();
    modal.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, []);

  const desenhoOriginal = editar && edicao.contornos === contornosIniciais;
  const caminhoLivre = desenhoOriginal ? editar.path : caminhoDosContornos(edicao.contornos);
  const path = {
    parametrica: () => caminhoParametrico(base, parametros),
    desenhar: () => caminhoLivre,
    origem: () => referencia?.path ?? '',
  }[modo]();
  const fechada =
    modo === 'parametrica' ||
    (modo === 'origem'
      ? Boolean(referencia?.fechada)
      : desenhoOriginal
        ? editar.fechada
        : edicao.contornos.some((contorno) => contorno.fechado && contorno.nos.length >= 3));
  const caminhoValido = validarCaminho(path);

  function mudarModo(novoModo: Modo) {
    definirModo(novoModo);
    definirErro('');
    if (novoModo === 'origem' && referencia && !nome.trim())
      definirNome(referencia.nome.slice(0, MAX_NOME_FORMA));
  }

  function navegarAbas(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const atalhos: Record<string, number> = {
      ArrowLeft: (indice + MODOS.length - 1) % MODOS.length,
      ArrowRight: (indice + 1) % MODOS.length,
      Home: 0,
      End: MODOS.length - 1,
    };
    const destino = atalhos[evento.key];
    if (destino === undefined) return;
    evento.preventDefault();
    mudarModo(MODOS[destino].id);
    modal.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[destino]?.focus();
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (salvando) return;
    if (!nome.trim() || !caminhoValido) {
      definirErro(
        !nome.trim() ? 'Informe o nome da forma.' : 'Defina um traçado para salvar a forma.',
      );
      return;
    }
    definirSalvando(true);
    definirErro('');
    try {
      await aoSalvar({
        nome: nome.trim(),
        pasta: pasta.trim(),
        path,
        fechada,
        estilo: gravarEstilo ? estilo : undefined,
      });
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível salvar a forma.');
      definirSalvando(false);
    }
  }

  return (
    <dialog
      ref={modal}
      className="window glass app-dialog shape-editor-dialog"
      aria-labelledby={`${id}-titulo`}
      onKeyDown={(evento) => evento.stopPropagation()}
      onCancel={(evento) => {
        evento.preventDefault();
        if (!salvando) fechar();
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text" id={`${id}-titulo`}>
          Editor de formas
        </div>
        <button
          type="button"
          className="dialog-close"
          aria-label="Fechar editor de formas"
          disabled={salvando}
          onClick={fechar}
        >
          ×
        </button>
      </div>
      <form className="window-body dialog-body shape-editor-body" noValidate onSubmit={salvar}>
        <div className="shape-editor-modes" role="tablist" aria-label="Modo de criação">
          {MODOS.map(({ id: aba, rotulo }, indice) => (
            <button
              type="button"
              key={aba}
              role="tab"
              id={`${id}-${aba}`}
              aria-selected={modo === aba}
              aria-controls={`${id}-painel-${aba}`}
              tabIndex={modo === aba ? 0 : -1}
              onClick={() => mudarModo(aba)}
              onKeyDown={(evento) => navegarAbas(evento, indice)}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <div className="shape-editor-workspace">
          <ShapeEditorPreview
            path={path}
            fechada={fechada}
            estilo={estilo}
            edicao={modo === 'desenhar' ? edicao : undefined}
          />
          {MODOS.map(({ id: aba }) => (
            <div
              key={aba}
              role="tabpanel"
              id={`${id}-painel-${aba}`}
              aria-labelledby={`${id}-${aba}`}
              hidden={modo !== aba}
            >
              {aba === 'parametrica' && (
                <ParametricControls {...{ base, definirBase, parametros, definirParametros }} />
              )}
              {aba === 'desenhar' && <FreeShapeControls edicao={edicao} />}
              {aba === 'origem' && (
                <div className="shape-editor-controls">
                  {referencia ? (
                    <>
                      <p className="shape-editor-hint">
                        Origem <strong>{referencia.nome}</strong>
                      </p>
                      {referencia.estilo && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!referencia.estilo) return;
                            definirEstilo(referencia.estilo);
                            definirGravacao(true);
                          }}
                        >
                          Usar estilo da origem
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="shape-editor-hint">
                      Selecione parte do desenho ou coloque uma forma no canvas e volte ao editor.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="shape-editor-metadata">
          <label className="shape-editor-field">
            Nome da forma
            <input
              value={nome}
              maxLength={MAX_NOME_FORMA}
              onChange={(evento) => definirNome(evento.target.value)}
              required
            />
          </label>
          <label className="shape-editor-field">
            Pasta
            <input
              value={pasta}
              maxLength={MAX_PASTA_FORMA}
              placeholder={PASTA_PADRAO}
              onChange={(evento) => definirPasta(evento.target.value)}
            />
          </label>
        </div>
        <ShapeStyleFields gravar={gravarEstilo} {...{ estilo, definirEstilo, definirGravacao }} />
        {erro && (
          <p className="form-error" role="alert">
            {erro}
          </p>
        )}
        <div className="dialog-actions shape-editor-actions">
          <button type="button" onClick={fechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={salvando || !caminhoValido}>
            {salvando ? 'Salvando…' : 'Salvar forma'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
