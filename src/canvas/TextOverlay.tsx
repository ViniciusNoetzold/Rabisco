import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Point } from '../layers/types';
import {
  familiaDoTexto,
  fonteDoTexto,
  LIMITE_TEXTO,
  MARGEM_TEXTO,
  medirTexto,
  normalizarTexto,
  tamanhoTexto,
  type ConfiguracaoTexto,
  type EstiloTexto,
} from '../tools/texto';
import './textOverlay.css';

interface TextOverlayProps {
  ativo: boolean;
  zoom: number;
  largura: number;
  altura: number;
  estilo: EstiloTexto;
  cor1: string;
  cor2: string;
  confirmar(configuracao: ConfiguracaoTexto): void;
}

interface Rascunho {
  origem: Point;
  texto: string;
}

interface Arraste {
  id: number;
  click: Point;
  origem: Point;
}

export function TextOverlay({
  ativo,
  zoom,
  largura,
  altura,
  estilo,
  cor1,
  cor2,
  confirmar,
}: TextOverlayProps) {
  const area = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const arraste = useRef<Arraste | null>(null);
  const rascunhoAtual = useRef<Rascunho | null>(null);
  const [rascunho, definirRascunho] = useState<Rascunho | null>(null);
  const grafico = useMemo(() => document.createElement('canvas').getContext('2d')!, []);
  const [revisaoFonte, definirRevisaoFonte] = useState(0);
  const font = fonteDoTexto(estilo);

  function atualizar(valor: Rascunho | null) {
    rascunhoAtual.current = valor;
    definirRascunho(valor);
  }

  function concluir() {
    const atual = rascunhoAtual.current;
    if (!atual) return;
    atualizar(null);
    arraste.current = null;
    if (atual.texto.trim()) confirmar({ ...atual, estilo: { ...estilo }, cor1, cor2 });
  }

  const acaoAtual = useRef(concluir);
  useLayoutEffect(() => {
    acaoAtual.current = concluir;
  });

  useLayoutEffect(() => {
    if (!ativo) {
      acaoAtual.current();
      return;
    }

    function fora(evento: PointerEvent['nativeEvent']) {
      const alvo = evento.target;
      if (
        alvo instanceof Element &&
        !area.current?.contains(alvo) &&
        !alvo.closest('[data-opcoes-texto]')
      ) {
        acaoAtual.current();
      }
    }

    function teclado(evento: KeyboardEvent) {
      if (!rascunhoAtual.current || evento.isComposing) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        evento.stopPropagation();
        arraste.current = null;
        atualizar(null);
      } else if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        evento.stopPropagation();
        acaoAtual.current();
      } else if (
        (evento.ctrlKey || evento.metaKey) &&
        ['s', 'o', 'n', 'p'].includes(evento.key.toLowerCase())
      ) {
        acaoAtual.current();
      }
    }

    document.addEventListener('pointerdown', fora, true);
    document.addEventListener('keydown', teclado, true);
    return () => {
      document.removeEventListener('pointerdown', fora, true);
      document.removeEventListener('keydown', teclado, true);
    };
  }, [ativo]);

  const aberto = ativo && Boolean(rascunho);
  useLayoutEffect(() => {
    if (aberto) campo.current?.focus({ preventScroll: true });
  }, [aberto]);

  useLayoutEffect(() => {
    if (!aberto || document.fonts.check(font)) return;
    let vigente = true;
    void document.fonts.load(font).then(
      () => {
        if (vigente) definirRevisaoFonte((valor) => valor + 1);
      },
      () => {},
    );
    return () => {
      vigente = false;
    };
  }, [aberto, font]);

  const textoAtual = rascunho?.texto ?? '';
  const medida = useMemo(
    () => medirTexto(grafico, textoAtual, estilo),
    [grafico, textoAtual, estilo, revisaoFonte],
  );

  function noPapel(x: number, y: number): Point {
    return {
      x: Math.max(0, Math.min(largura - 1, Math.round(x))),
      y: Math.max(0, Math.min(altura - 1, Math.round(y))),
    };
  }

  function pressionarPapel(evento: PointerEvent<HTMLDivElement>) {
    if (evento.button !== 0 || evento.altKey || caixa.current?.contains(evento.target as Node))
      return;
    // O foco do novo campo é definido antes da ação padrão do ponteiro no papel.
    evento.preventDefault();
    if (rascunhoAtual.current) {
      concluir();
      return;
    }
    const limites = evento.currentTarget.getBoundingClientRect();
    atualizar({
      texto: '',
      origem: noPapel(
        (evento.clientX - limites.left) / zoom,
        (evento.clientY - limites.top) / zoom,
      ),
    });
  }

  function iniciarArraste(evento: PointerEvent<HTMLButtonElement>) {
    if (evento.button !== 0 || !rascunhoAtual.current) return;
    evento.preventDefault();
    const { origem } = rascunhoAtual.current;
    arraste.current = {
      id: evento.pointerId,
      click: { x: evento.clientX, y: evento.clientY },
      origem,
    };
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function mover(evento: PointerEvent<HTMLButtonElement>) {
    const ativo = arraste.current;
    const atual = rascunhoAtual.current;
    if (!ativo || ativo.id !== evento.pointerId || !atual) return;
    atualizar({
      ...atual,
      origem: noPapel(
        ativo.origem.x + (evento.clientX - ativo.click.x) / zoom,
        ativo.origem.y + (evento.clientY - ativo.click.y) / zoom,
      ),
    });
  }

  function finalizar(evento: PointerEvent<HTMLButtonElement>, cancelar = false) {
    const ativo = arraste.current;
    if (!ativo || ativo.id !== evento.pointerId) return;
    arraste.current = null;
    if (cancelar && rascunhoAtual.current)
      atualizar({ ...rascunhoAtual.current, origem: ativo.origem });
    campo.current?.focus({ preventScroll: true });
  }

  if (!ativo) return null;
  return (
    <div
      ref={area}
      className="text-overlay"
      data-texto-pendente={aberto ? '' : undefined}
      onPointerDown={pressionarPapel}
      onContextMenu={(evento) => {
        if (evento.target === evento.currentTarget) evento.preventDefault();
      }}
    >
      {rascunho && (
        <div
          ref={caixa}
          className="text-overlay-box"
          style={{
            left: (rascunho.origem.x + medida.deslocamentoX) * zoom,
            top: (rascunho.origem.y + medida.deslocamentoY) * zoom,
          }}
        >
          <button
            type="button"
            className="text-overlay-handle"
            aria-label="Mover caixa de texto"
            title="Arraste para mover a caixa de texto"
            onPointerDown={iniciarArraste}
            onPointerMove={mover}
            onPointerUp={(evento) => finalizar(evento)}
            onPointerCancel={(evento) => finalizar(evento, true)}
            onLostPointerCapture={(evento) => finalizar(evento, true)}
            onKeyDown={(evento) => {
              const passo = evento.shiftKey ? 10 : 1;
              const direcoes: Record<string, [number, number]> = {
                ArrowLeft: [-passo, 0],
                ArrowRight: [passo, 0],
                ArrowUp: [0, -passo],
                ArrowDown: [0, passo],
              };
              const direcao = direcoes[evento.key];
              if (!direcao) return;
              evento.preventDefault();
              evento.stopPropagation();
              atualizar({
                ...rascunho,
                origem: noPapel(rascunho.origem.x + direcao[0], rascunho.origem.y + direcao[1]),
              });
            }}
          >
            <span aria-hidden="true">⠶</span>
          </button>
          <textarea
            ref={campo}
            className="text-overlay-input"
            aria-label="Texto no desenho"
            wrap="off"
            spellCheck={false}
            maxLength={LIMITE_TEXTO}
            placeholder="Digite aqui"
            value={rascunho.texto}
            onChange={(evento) =>
              atualizar({ ...rascunho, texto: normalizarTexto(evento.target.value) })
            }
            style={{
              width:
                Math.max(28, Math.min(!rascunho.texto ? 148 : medida.largura + 1, largura)) * zoom,
              height: Math.max(16, Math.min(medida.altura, altura)) * zoom,
              paddingLeft: (MARGEM_TEXTO - medida.deslocamentoX) * zoom,
              paddingTop: (MARGEM_TEXTO - medida.deslocamentoY) * zoom,
              paddingRight: MARGEM_TEXTO * zoom,
              paddingBottom: MARGEM_TEXTO * zoom,
              fontFamily: familiaDoTexto(estilo.familia),
              fontSize: tamanhoTexto(estilo.tamanho) * zoom,
              lineHeight: `${medida.alturaLinha * zoom}px`,
              fontWeight: estilo.negrito ? 700 : 400,
              fontStyle: estilo.italico ? 'italic' : 'normal',
              textDecorationLine:
                [estilo.sublinhado && 'underline', estilo.tachado && 'line-through']
                  .filter(Boolean)
                  .join(' ') || 'none',
              color: cor1,
              backgroundColor: estilo.fundoOpaco ? cor2 : 'transparent',
            }}
          />
        </div>
      )}
    </div>
  );
}
