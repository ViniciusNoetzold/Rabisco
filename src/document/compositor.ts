import type { Rect } from '../layers/types';
import type { RabiscoDocument } from './model';

/** Apresenta as camadas visíveis de baixo para cima. O canvas da tela não guarda o documento. */
export function comporDocumento(doc: RabiscoDocument, tela: HTMLCanvasElement, area?: Rect): void {
  const tamanhoMudou = tela.width !== doc.width || tela.height !== doc.height;
  if (tamanhoMudou) {
    tela.width = doc.width;
    tela.height = doc.height;
  }

  const trecho =
    tamanhoMudou || !area ? { x: 0, y: 0, width: doc.width, height: doc.height } : area;
  const esquerda = Math.max(0, Math.floor(trecho.x));
  const topo = Math.max(0, Math.floor(trecho.y));
  const largura = Math.min(doc.width, Math.ceil(trecho.x + trecho.width)) - esquerda;
  const altura = Math.min(doc.height, Math.ceil(trecho.y + trecho.height)) - topo;
  if (largura <= 0 || altura <= 0) return;

  const contexto = tela.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new Error('Não foi possível mostrar a área de desenho.');

  contexto.save();
  contexto.globalCompositeOperation = 'source-over';
  contexto.clearRect(esquerda, topo, largura, altura);
  for (const camada of doc.layers) {
    if (!camada.visible || camada.opacity <= 0) continue;
    contexto.globalAlpha = camada.opacity;
    contexto.drawImage(
      camada.canvas,
      esquerda,
      topo,
      largura,
      altura,
      esquerda,
      topo,
      largura,
      altura,
    );
  }
  contexto.restore();
}
