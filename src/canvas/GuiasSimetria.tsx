import { useRef, type PointerEvent as EventoPonteiro } from 'react';
import { clienteNoPapel } from './vistaAtual';
import { useEditor } from '../app/store';
import { configDaSimetria, linhasGuia } from '../brushes/simetria';
import './simetria.css';

interface Props {
  largura: number;
  altura: number;
  zoom: number;
}

/**
 * Linhas-guia da simetria sobre o papel e a alça do centro, que se arrasta com o ponteiro
 * (Shift prende no centro do papel). As linhas não recebem cliques: o desenho passa por baixo.
 */
export function GuiasSimetria({ largura, altura, zoom }: Props) {
  const simetria = useEditor((e) => e.simetria);
  const eixosSimetria = useEditor((e) => e.eixosSimetria);
  const espelharFatias = useEditor((e) => e.espelharFatias);
  const centroSimetria = useEditor((e) => e.centroSimetria);
  const mostrarLinhas = useEditor((e) => e.guiasSimetria);
  const arrasto = useRef<{ ponteiro: number; caixa: DOMRect } | null>(null);
  const config = configDaSimetria(
    { simetria, eixosSimetria, espelharFatias, centroSimetria },
    largura,
    altura,
  );
  if (!config) return null;
  const { centro } = config;

  function mover(evento: EventoPonteiro<SVGCircleElement>) {
    const atual = arrasto.current;
    if (!atual || atual.ponteiro !== evento.pointerId) return;
    const ponto = clienteNoPapel(
      { x: evento.clientX, y: evento.clientY },
      atual.caixa,
      largura,
      altura,
    );
    const x = Math.max(0, Math.min(largura, ponto.x));
    const y = Math.max(0, Math.min(altura, ponto.y));
    // Shift (ou soltar perto do meio) prende no centro do papel.
    const perto = Math.hypot(x - largura / 2, y - altura / 2) * zoom < 8;
    useEditor.getState().set({
      centroSimetria: evento.shiftKey || perto ? null : { x: Math.round(x), y: Math.round(y) },
    });
  }

  return (
    <svg
      className="guias-simetria"
      width={largura * zoom}
      height={altura * zoom}
      aria-hidden="true"
    >
      {mostrarLinhas &&
        linhasGuia(config, largura, altura).map(({ de, ate }, i) => (
          <line key={i} x1={de.x * zoom} y1={de.y * zoom} x2={ate.x * zoom} y2={ate.y * zoom} />
        ))}
      <circle
        className="centro-simetria"
        data-testid="centro-simetria"
        cx={centro.x * zoom}
        cy={centro.y * zoom}
        r={6}
        onPointerDown={(evento) => {
          evento.stopPropagation();
          evento.preventDefault();
          evento.currentTarget.setPointerCapture(evento.pointerId);
          const caixa = evento.currentTarget.ownerSVGElement!.getBoundingClientRect();
          arrasto.current = { ponteiro: evento.pointerId, caixa };
        }}
        onPointerMove={mover}
        onPointerUp={(evento) => {
          mover(evento);
          arrasto.current = null;
        }}
        onPointerCancel={() => (arrasto.current = null)}
      >
        <title>Centro da simetria: arraste para mudar (Shift prende no meio do papel)</title>
      </circle>
    </svg>
  );
}
