import { useRef, type PointerEvent as EventoPonteiro } from 'react';
import { clienteNoPapel } from './vistaAtual';
import { useEditor } from '../app/store';
import { prenderAnguloDaRegua, semGuia, type Regua } from '../document/guias';
import { soltarGuia } from './soltarGuia';
import type { Point } from '../layers/types';
import './guias.css';

interface Props {
  largura: number;
  altura: number;
  zoom: number;
}

type Arrasto =
  | { tipo: 'guia'; eixo: 'horizontal' | 'vertical' }
  | { tipo: 'ponta'; ponta: 'a' | 'b' }
  | { tipo: 'regua'; inicio: Point; original: Regua };

/** Marcas da régua a cada 10 px do papel (ou mais, para ficarem a ≥ 6 px na tela). */
function passoDasMarcas(zoom: number) {
  let passo = 10;
  while (passo * zoom < 6) passo *= 2;
  return passo;
}

/**
 * Guias do papel (ciano), a guia sendo arrastada e a régua de desenho com suas alças. Só as
 * alças recebem o ponteiro: dá para desenhar colado na régua e nas guias. Com a ferramenta
 * Mover (V), as guias também se arrastam (para fora do papel, somem).
 */
export function GuiasPapel({ largura, altura, zoom }: Props) {
  const guias = useEditor((e) => e.guiasDoPapel);
  const mostrar = useEditor((e) => e.mostrarGuias);
  const nova = useEditor((e) => e.guiaNova);
  const moverGuias = useEditor((e) => e.tool === 'move');
  const arrasto = useRef<{ ponteiro: number; caixa: DOMRect; dados: Arrasto } | null>(null);
  const { regua } = guias;
  if (!regua && !nova && (!mostrar || (!guias.horizontais.length && !guias.verticais.length)))
    return null;

  function noPapel(evento: EventoPonteiro, caixa: DOMRect): Point {
    return clienteNoPapel({ x: evento.clientX, y: evento.clientY }, caixa, largura, altura);
  }

  function comecar(evento: EventoPonteiro<SVGElement>, dados: Arrasto) {
    evento.stopPropagation();
    evento.preventDefault();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const caixa = evento.currentTarget.ownerSVGElement!.getBoundingClientRect();
    arrasto.current = { ponteiro: evento.pointerId, caixa, dados };
  }

  function mover(evento: EventoPonteiro<SVGElement>) {
    const atual = arrasto.current;
    if (!atual || atual.ponteiro !== evento.pointerId) return;
    const ponto = noPapel(evento, atual.caixa);
    const estado = useEditor.getState();
    const { dados } = atual;
    if (dados.tipo === 'guia') {
      estado.set({
        guiaNova: {
          eixo: dados.eixo,
          valor: Math.round(dados.eixo === 'horizontal' ? ponto.y : ponto.x),
        },
      });
      return;
    }
    const atualRegua = estado.guiasDoPapel.regua;
    if (!atualRegua) return;
    let novaRegua: Regua;
    if (dados.tipo === 'ponta') {
      const fixa = dados.ponta === 'a' ? atualRegua.b : atualRegua.a;
      const movel = evento.shiftKey ? prenderAnguloDaRegua(fixa, ponto) : ponto;
      novaRegua = { ...atualRegua, [dados.ponta]: movel };
    } else {
      const dx = ponto.x - dados.inicio.x;
      const dy = ponto.y - dados.inicio.y;
      const { a, b } = dados.original;
      novaRegua = { a: { x: a.x + dx, y: a.y + dy }, b: { x: b.x + dx, y: b.y + dy } };
    }
    estado.set({ guiasDoPapel: { ...estado.guiasDoPapel, regua: novaRegua } });
  }

  function terminar(evento: EventoPonteiro<SVGElement>) {
    const atual = arrasto.current;
    if (!atual || atual.ponteiro !== evento.pointerId) return;
    mover(evento);
    arrasto.current = null;
    if (atual.dados.tipo === 'guia') soltarGuia(largura, altura);
  }

  const eventos = { onPointerMove: mover, onPointerUp: terminar, onPointerCancel: terminar };

  function linhaGuia(
    eixo: 'horizontal' | 'vertical',
    valor: number,
    chave: string,
    arrastando = false,
  ) {
    const horizontal = eixo === 'horizontal';
    const linha = {
      x1: horizontal ? 0 : valor * zoom,
      x2: horizontal ? largura * zoom : valor * zoom,
      y1: horizontal ? valor * zoom : 0,
      y2: horizontal ? valor * zoom : altura * zoom,
    };
    return (
      <g key={chave} className={arrastando ? 'guia guia-arrastada' : 'guia'}>
        <line {...linha} data-testid={`guia-${eixo}`} data-valor={valor} />
        {moverGuias && !arrastando && (
          <line
            {...linha}
            className={`guia-alvo guia-alvo-${eixo}`}
            onPointerDown={(evento) => {
              comecar(evento, { tipo: 'guia', eixo });
              const estado = useEditor.getState();
              estado.set({
                guiasDoPapel: semGuia(estado.guiasDoPapel, eixo, valor),
                guiaNova: { eixo, valor },
              });
            }}
            {...eventos}
          >
            <title>Arraste a guia; para fora do papel, ela some</title>
          </line>
        )}
      </g>
    );
  }

  return (
    <svg className="guias-papel" width={largura * zoom} height={altura * zoom} aria-hidden="true">
      {mostrar && guias.horizontais.map((valor) => linhaGuia('horizontal', valor, `h${valor}`))}
      {mostrar && guias.verticais.map((valor) => linhaGuia('vertical', valor, `v${valor}`))}
      {nova && linhaGuia(nova.eixo, nova.valor, 'nova', true)}
      {regua && (
        <DesenhoRegua
          regua={regua}
          zoom={zoom}
          comecar={comecar}
          eventos={eventos}
          noPapelDaCaixa={noPapel}
        />
      )}
    </svg>
  );
}

function DesenhoRegua({
  regua,
  zoom,
  comecar,
  eventos,
  noPapelDaCaixa,
}: {
  regua: Regua;
  zoom: number;
  noPapelDaCaixa: (evento: EventoPonteiro, caixa: DOMRect) => Point;
  comecar: (evento: EventoPonteiro<SVGElement>, dados: Arrasto) => void;
  eventos: Record<string, (evento: EventoPonteiro<SVGElement>) => void>;
}) {
  const a = { x: regua.a.x * zoom, y: regua.a.y * zoom };
  const b = { x: regua.b.x * zoom, y: regua.b.y * zoom };
  const comprimento = Math.hypot(b.x - a.x, b.y - a.y);
  if (comprimento < 1) return null;
  const ux = (b.x - a.x) / comprimento;
  const uy = (b.y - a.y) / comprimento;
  // A faixa da régua fica de um lado da borda; o traço gruda na borda.
  const nx = uy;
  const ny = -ux;
  const largura = 30;
  const faixa = [
    a,
    b,
    { x: b.x + nx * largura, y: b.y + ny * largura },
    { x: a.x + nx * largura, y: a.y + ny * largura },
  ]
    .map(({ x, y }) => `${x},${y}`)
    .join(' ');
  const passo = passoDasMarcas(zoom);
  const comprimentoPapel = comprimento / zoom;
  const marcas: string[] = [];
  for (let i = 0, d = 0; d <= comprimentoPapel && i < 600; i++, d = i * passo) {
    const tamanho = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 4;
    const x = a.x + ux * d * zoom;
    const y = a.y + uy * d * zoom;
    marcas.push(`M${x} ${y}L${x + nx * tamanho} ${y + ny * tamanho}`);
  }
  const centro = {
    x: (a.x + b.x) / 2 + (nx * largura) / 2,
    y: (a.y + b.y) / 2 + (ny * largura) / 2,
  };
  return (
    <g className="regua-desenho" data-testid="regua-desenho">
      <polygon className="regua-faixa" points={faixa} />
      <path className="regua-marcas" d={marcas.join('')} />
      <line className="regua-borda" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <circle
        className="regua-alca regua-mover"
        data-testid="regua-mover"
        cx={centro.x}
        cy={centro.y}
        r={7}
        onPointerDown={(evento) => {
          const caixa = evento.currentTarget.ownerSVGElement!.getBoundingClientRect();
          comecar(evento, {
            tipo: 'regua',
            inicio: noPapelDaCaixa(evento, caixa),
            original: regua,
          });
        }}
        {...eventos}
      >
        <title>Arraste para mover a régua</title>
      </circle>
      {(['a', 'b'] as const).map((ponta) => {
        const p = ponta === 'a' ? a : b;
        return (
          <circle
            key={ponta}
            className="regua-alca"
            data-testid={`regua-ponta-${ponta}`}
            cx={p.x}
            cy={p.y}
            r={6}
            onPointerDown={(evento) => comecar(evento, { tipo: 'ponta', ponta })}
            {...eventos}
          >
            <title>Arraste a ponta para girar ou esticar a régua (Shift: de 15 em 15°)</title>
          </circle>
        );
      })}
    </g>
  );
}
