import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { FORMAS, obterForma } from '../../shapes/catalogo';
import { desenharMiniatura } from '../../shapes/render';
import type {
  EstiloContorno,
  EstiloPreenchimento,
  FormaId,
  ParametrosForma,
} from '../../shapes/tipos';
import { useEditor } from '../store';
import './shape-gallery.css';

const FORMAS_DIRETAS = ['line', 'rectangle', 'ellipse'] as const;
const formaDireta = (id: FormaId) => (FORMAS_DIRETAS as readonly FormaId[]).includes(id);
const TRILHO = [
  ...FORMAS_DIRETAS.map(obterForma),
  ...FORMAS.filter(({ id }) => !formaDireta(id)).slice(0, 8),
];
const CATEGORIAS = [
  { id: 'basicas', nome: 'Básicas' },
  { id: 'setas', nome: 'Setas' },
  { id: 'estrelas', nome: 'Estrelas' },
  { id: 'baloes', nome: 'Balões de fala' },
  { id: 'simbolos', nome: 'Símbolos' },
  { id: 'minhas', nome: 'Minhas formas' },
]
  .map((categoria) => ({
    ...categoria,
    formas: FORMAS.filter(({ categoria: grupo }) => grupo === categoria.id),
  }))
  .filter(({ formas }) => formas.length > 0);

const ESTILOS_COMUNS = [
  ['none', 'Nenhum'],
  ['solid', 'Sólido'],
  ['giz', 'Giz de cera'],
  ['marcador', 'Marcador'],
  ['aquarela', 'Aquarela'],
] as const;
const ESTILOS_CONTORNO = [
  ...ESTILOS_COMUNS.slice(0, 2),
  ['dash', 'Tracejado'],
  ['dot', 'Pontilhado'],
  ...ESTILOS_COMUNS.slice(2),
] as const;
const LIMITE_DA_TELA = 8;
const ITEM_FORMA = '[role="menuitemradio"]';

function MiniaturaForma({ id }: { id: FormaId }) {
  const superficie = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const contexto = superficie.current?.getContext('2d');
    if (!contexto) return;
    contexto.clearRect(0, 0, 48, 40);
    desenharMiniatura(contexto, id, { x: 6, y: 5, width: 36, height: 30 });
  }, [id]);

  return (
    <canvas
      ref={superficie}
      className="shape-thumbnail"
      width={48}
      height={40}
      aria-hidden="true"
    />
  );
}

function CampoParametro({
  chave,
  rotulo,
  min,
  max,
}: {
  chave: keyof ParametrosForma;
  rotulo: string;
  min: number;
  max: number;
}) {
  const valor = useEditor((estado) => estado.parametrosForma[chave]);
  const atualizar = useEditor((estado) => estado.setParametroForma);
  const [rascunho, setRascunho] = useState<string | null>(null);

  return (
    <label title={rotulo}>
      <span>{rotulo.replace('Número de ', '').replace('Raio interno', 'Raio')}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={rascunho ?? valor}
        aria-label={rotulo}
        onFocus={(evento) => evento.currentTarget.select()}
        onChange={(evento) => {
          const texto = evento.currentTarget.value;
          const numero = Number(texto);
          setRascunho(texto);
          if (Number.isInteger(numero) && numero >= min && numero <= max) {
            atualizar(chave, numero);
          }
        }}
        onBlur={() => {
          if (rascunho) atualizar(chave, Number(rascunho));
          setRascunho(null);
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') evento.currentTarget.blur();
        }}
      />
    </label>
  );
}

function EstilosDaForma({ id }: { id: FormaId }) {
  const estado = useEditor();
  const definicao = obterForma(id);
  const parametros = Object.entries(definicao.params ?? {}).flatMap(([chave, parametro]) =>
    parametro ? [{ chave: chave as keyof ParametrosForma, ...parametro }] : [],
  );

  return (
    <>
      <div className="shape-styles">
        <label title="O contorno usa a Cor 1">
          <span
            className="shape-style-dot"
            style={{ background: estado.color1 }}
            aria-hidden="true"
          />
          <span>Contorno</span>
          <select
            aria-label="Contorno"
            value={estado.contornoForma}
            onChange={(evento) =>
              estado.set({ contornoForma: evento.currentTarget.value as EstiloContorno })
            }
          >
            {ESTILOS_CONTORNO.map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <label title="O preenchimento usa a Cor 2">
          <span
            className="shape-style-dot"
            style={{ background: estado.color2 }}
            aria-hidden="true"
          />
          <span>Preenchimento</span>
          <select
            aria-label="Preenchimento"
            value={definicao.fechada ? estado.preenchimentoForma : 'none'}
            disabled={!definicao.fechada}
            onChange={(evento) =>
              estado.set({ preenchimentoForma: evento.currentTarget.value as EstiloPreenchimento })
            }
          >
            {ESTILOS_COMUNS.map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </label>
      </div>
      {parametros.length > 0 && (
        <div className="shape-parameters" role="group" aria-label="Parâmetros da forma">
          {parametros.map((parametro) => (
            <CampoParametro key={parametro.chave} {...parametro} />
          ))}
        </div>
      )}
    </>
  );
}

function focar(item: HTMLButtonElement | undefined, painel: HTMLDivElement) {
  if (!item) return;
  item.focus({ preventScroll: true });
  const caixa = item.getBoundingClientRect();
  const visivel = painel.getBoundingClientRect();
  if (caixa.top < visivel.top) painel.scrollTop -= visivel.top - caixa.top + 4;
  else if (caixa.bottom > visivel.bottom) painel.scrollTop += caixa.bottom - visivel.bottom + 4;
}

export function ShapeGallery({ carregando }: { carregando: boolean }) {
  const { forma, tool, setForma } = useEditor();
  const ativa = tool === 'shape' || tool === 'line' || tool === 'rectangle' || tool === 'ellipse';
  const formasDoTrilho =
    ativa && !formaDireta(forma)
      ? [obterForma(forma), ...TRILHO.filter(({ id }) => id !== forma)]
      : TRILHO;
  const [aberto, setAberto] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const focoInicial = useRef<'atual' | 'inicio' | 'fim'>('atual');
  const menuId = useId();

  useLayoutEffect(() => {
    if (!aberto || !painel.current || !gatilho.current) return;
    const menu = painel.current;
    const botao = gatilho.current;

    function posicionar(evento?: Event) {
      if (evento?.type === 'scroll' && evento.target === menu) return;
      const ancora = botao.getBoundingClientRect();
      const espacoInferior = window.innerHeight - ancora.bottom - LIMITE_DA_TELA;
      const espacoSuperior = ancora.top - LIMITE_DA_TELA;
      const abaixo = espacoInferior >= Math.min(menu.scrollHeight, espacoSuperior);
      menu.style.maxHeight = `${Math.max(0, abaixo ? espacoInferior : espacoSuperior)}px`;
      const caixa = menu.getBoundingClientRect();
      menu.style.top = `${abaixo ? ancora.bottom : ancora.top - caixa.height}px`;
      menu.style.left = `${Math.max(LIMITE_DA_TELA, Math.min(ancora.left, window.innerWidth - caixa.width - LIMITE_DA_TELA))}px`;
    }

    function fecharAoClicarFora(evento: PointerEvent) {
      const alvo = evento.target;
      if (alvo instanceof Node && !menu.contains(alvo) && !botao.contains(alvo)) setAberto(false);
    }

    posicionar();
    const itens = Array.from(menu.querySelectorAll<HTMLButtonElement>(ITEM_FORMA));
    const atual = itens.findIndex((item) => item.getAttribute('aria-checked') === 'true');
    const indice =
      focoInicial.current === 'fim'
        ? itens.length - 1
        : focoInicial.current === 'inicio'
          ? 0
          : Math.max(0, atual);
    focar(itens[indice], menu);
    document.addEventListener('pointerdown', fecharAoClicarFora);
    window.addEventListener('scroll', posicionar, true);
    window.addEventListener('resize', posicionar);
    return () => {
      document.removeEventListener('pointerdown', fecharAoClicarFora);
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [aberto]);

  function fechar() {
    setAberto(false);
    gatilho.current?.focus({ preventScroll: true });
  }

  function abrir(destino: typeof focoInicial.current = 'atual') {
    focoInicial.current = destino;
    setAberto(true);
  }

  function navegar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === 'Escape' || evento.key === 'Tab') {
      if (evento.key === 'Escape') evento.preventDefault();
      fechar();
      return;
    }

    const menu = evento.currentTarget;
    const itens = Array.from(menu.querySelectorAll<HTMLButtonElement>(ITEM_FORMA));
    const atual = itens.findIndex((item) => item === document.activeElement);
    let proximo: number;
    switch (evento.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        proximo = atual + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        proximo = atual - 1;
        break;
      case 'Home':
        proximo = 0;
        break;
      case 'End':
        proximo = itens.length - 1;
        break;
      default:
        return;
    }
    evento.preventDefault();
    focar(itens[(proximo + itens.length) % itens.length], menu);
  }

  return (
    <div className="shape-gallery">
      <div className="shape-gallery-top">
        <div className="shape-strip" role="group" aria-label="Formas rápidas">
          {formasDoTrilho.map(({ id, nome }) => (
            <button
              key={id}
              type="button"
              className={ativa && forma === id ? 'selected' : undefined}
              aria-label={nome}
              title={nome}
              aria-pressed={ativa && forma === id}
              onClick={() => setForma(id)}
            >
              <MiniaturaForma id={id} />
            </button>
          ))}
        </div>
        <button
          ref={gatilho}
          type="button"
          className="shape-gallery-trigger"
          aria-label="Mais formas"
          aria-haspopup="menu"
          aria-expanded={aberto}
          aria-controls={aberto ? menuId : undefined}
          title={ativa ? `Mais formas. Atual: ${obterForma(forma).nome}` : 'Mais formas'}
          disabled={carregando}
          onClick={() => (aberto ? fechar() : abrir())}
          onKeyDown={(evento) => {
            if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
            evento.preventDefault();
            abrir(evento.key === 'ArrowDown' ? 'inicio' : 'fim');
          }}
        >
          Mais <span className="chevron" aria-hidden="true" />
        </button>
      </div>

      {ativa && <EstilosDaForma key={forma} id={forma} />}

      {aberto &&
        createPortal(
          <div
            ref={painel}
            id={menuId}
            className="shape-gallery-menu"
            role="menu"
            aria-label="Formas"
            onKeyDown={navegar}
          >
            {CATEGORIAS.map(({ id, nome, formas }) => (
              <div className="shape-menu-section" key={id} role="group" aria-label={nome}>
                <div className="shape-menu-heading" aria-hidden="true">
                  {nome}
                </div>
                <div className="shape-menu-items" role="presentation">
                  {formas.map(({ id: formaId, nome: nomeForma }) => (
                    <button
                      key={formaId}
                      type="button"
                      role="menuitemradio"
                      aria-checked={ativa && forma === formaId}
                      tabIndex={-1}
                      onClick={() => {
                        setForma(formaId);
                        fechar();
                      }}
                    >
                      <MiniaturaForma id={formaId} />
                      <span>{nomeForma}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
