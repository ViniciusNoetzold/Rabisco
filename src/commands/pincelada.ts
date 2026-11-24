import { PINCEIS } from '../brushes/catalogo';
import {
  criarPintorPincel,
  margemDoPincel,
  mesclagemDoPincel,
  opacidadeDoPincel,
} from '../brushes/motor';
import type { Rect } from '../layers/types';
import type { ComandoPincel } from './comandos';

export function nomeDaPincelada({ configuracao }: ComandoPincel): string {
  if (configuracao.tipo === 'redondo') return 'Pincelada';
  return PINCEIS.find(({ id }) => id === configuracao.tipo)!.nome;
}

export function areaDaPincelada({ configuracao, marcas }: ComandoPincel): Rect | null {
  if (!marcas.length) return null;
  const margem = margemDoPincel(configuracao);
  let esquerda = Infinity;
  let direita = -Infinity;
  let topo = Infinity;
  let base = -Infinity;
  for (const { x, y } of marcas) {
    esquerda = Math.min(esquerda, x);
    direita = Math.max(direita, x);
    topo = Math.min(topo, y);
    base = Math.max(base, y);
  }
  const x = Math.floor(esquerda - margem);
  const y = Math.floor(topo - margem);
  return { x, y, width: Math.ceil(direita + margem) - x, height: Math.ceil(base + margem) - y };
}

/** A máscara contém apenas a área editada. O marcador recebe opacidade uma vez por traço. */
export function desenharPincelada(
  destino: CanvasRenderingContext2D,
  { configuracao, marcas }: ComandoPincel,
  area: Rect,
) {
  const mascara = document.createElement('canvas');
  mascara.width = area.width;
  mascara.height = area.height;
  const grafico = mascara.getContext('2d');
  if (!grafico) throw new Error('Não foi possível aplicar a pincelada.');

  try {
    grafico.translate(-area.x, -area.y);
    criarPintorPincel(grafico, configuracao).pintar(marcas);
    destino.save();
    try {
      destino.globalAlpha = opacidadeDoPincel(configuracao.tipo);
      destino.globalCompositeOperation = mesclagemDoPincel(configuracao.tipo);
      destino.drawImage(mascara, area.x, area.y);
    } finally {
      destino.restore();
    }
  } finally {
    mascara.width = mascara.height = 1;
  }
}
