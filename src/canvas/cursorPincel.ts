import { useEditor } from '../app/store';
import type { Point } from '../layers/types';

/** Forma da ponta em px do papel: raios e inclinação (radianos). */
export interface PontaDoCursor {
  rx: number;
  ry: number;
  angulo: number;
}

/**
 * A ponta da ferramenta atual, no tamanho real: pincéis (com a ponta oval da caligrafia e do
 * marcador) e borracha. Lápis e as demais ferramentas não mostram círculo.
 */
export function pontaDaFerramenta(estado = useEditor.getState()): PontaDoCursor | null {
  const { tool, size, pincel, espessuraBorracha } = estado;
  if (tool === 'eraser') return { rx: espessuraBorracha / 2, ry: espessuraBorracha / 2, angulo: 0 };
  if (tool !== 'brush') return null;
  const raio = size / 2;
  switch (pincel) {
    case 'caligrafia-1':
      return { rx: raio, ry: size * 0.16, angulo: Math.PI / 4 };
    case 'caligrafia-2':
      return { rx: raio, ry: size * 0.16, angulo: (3 * Math.PI) / 4 };
    case 'marcador':
      return { rx: size * 0.52, ry: size * 0.38, angulo: -Math.PI / 9 };
    default:
      return { rx: raio, ry: raio, angulo: 0 };
  }
}

/**
 * Mostra (ou esconde, com `ponto` nulo) o contorno da ponta sob o ponteiro. Fica no palco, então
 * gira e espelha junto com a vista. Abaixo de 4 px de tela, o contorno some e vale a mira.
 */
export function atualizarCursorPincel(svg: SVGSVGElement | null, ponto: Point | null) {
  if (!svg) return;
  const estado = useEditor.getState();
  const ponta = ponto && pontaDaFerramenta(estado);
  const { zoom } = estado;
  if (!ponto || !ponta || Math.max(ponta.rx, ponta.ry) * 2 * zoom < 4) {
    svg.style.display = 'none';
    return;
  }
  let elipse = svg.firstElementChild as SVGEllipseElement | null;
  if (!elipse) {
    // Duas linhas (branca por baixo, escura por cima) aparecem sobre qualquer cor.
    svg.innerHTML = '<ellipse class="cursor-claro" /><ellipse class="cursor-escuro" />';
    elipse = svg.firstElementChild as SVGEllipseElement;
  }
  const atributos = {
    cx: String(ponto.x * zoom),
    cy: String(ponto.y * zoom),
    rx: String(Math.max(0.5, ponta.rx * zoom)),
    ry: String(Math.max(0.5, ponta.ry * zoom)),
    transform: `rotate(${(ponta.angulo * 180) / Math.PI} ${ponto.x * zoom} ${ponto.y * zoom})`,
  };
  for (const forma of svg.children)
    for (const [nome, valor] of Object.entries(atributos)) forma.setAttribute(nome, valor);
  svg.style.display = '';
}
