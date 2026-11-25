import { PINCEIS } from '../brushes/catalogo';
import {
  criarPintorPincel,
  margemDoPincel,
  mesclagemDoPincel,
  opacidadeDoPincel,
} from '../brushes/motor';
import { copiasDosPontos } from '../brushes/simetria';
import type { Rect } from '../layers/types';
import { unirAreas } from './desenho';
import type { ComandoPincel } from './comandos';

export function nomeDaPincelada({ configuracao }: ComandoPincel): string {
  if (configuracao.tipo === 'redondo') return 'Pincelada';
  return PINCEIS.find(({ id }) => id === configuracao.tipo)!.nome;
}

/** A área de cada cópia simétrica (só a original sem simetria). */
export function areasDaPincelada({ configuracao, marcas, simetria }: ComandoPincel): Rect[] {
  if (!marcas.length) return [];
  return copiasDosPontos(marcas, simetria).map((copia) => areaDasMarcas(configuracao, copia));
}

/** União das áreas de todas as cópias simétricas. */
export function areaDaPincelada(comando: ComandoPincel): Rect | null {
  const areas = areasDaPincelada(comando);
  return areas.length ? areas.reduce(unirAreas) : null;
}

function areaDasMarcas(
  configuracao: ComandoPincel['configuracao'],
  marcas: ComandoPincel['marcas'],
): Rect {
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
  { configuracao, marcas, simetria }: ComandoPincel,
  area: Rect,
) {
  const mascara = document.createElement('canvas');
  mascara.width = area.width;
  mascara.height = area.height;
  const grafico = mascara.getContext('2d');
  if (!grafico) throw new Error('Não foi possível aplicar a pincelada.');

  try {
    grafico.translate(-area.x, -area.y);
    // Um pintor por cópia: cada uma tem as mesmas cerdas e o mesmo spray da original. Tudo
    // cai na mesma máscara, então o marcador recebe a opacidade uma vez só, como num traço.
    for (const copia of copiasDosPontos(marcas, simetria))
      criarPintorPincel(grafico, configuracao).pintar(copia);
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
