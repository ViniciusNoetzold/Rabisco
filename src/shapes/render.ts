import { opacidadeDoPincel } from '../brushes/motor';
import type { Rect } from '../layers/types';
import { obterForma } from './catalogo';
import { pontosDosLimites } from './limites';
import { padraoDeTextura } from './texturas';
import {
  PARAMETROS_PADRAO,
  type ConfiguracaoForma,
  type EstiloContorno,
  type FormaId,
  type ShapeDef,
} from './tipos';

type Grafico = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function obterDefinicaoForma({ id, definicao }: ConfiguracaoForma): ShapeDef {
  return definicao ? { ...definicao, id, categoria: 'minhas' } : obterForma(id);
}

/** As formas prontas, os controles livres e as miniaturas compartilham o catálogo. */
export function caminhoDaForma({
  id,
  definicao,
  caixa,
  parametros,
  pontos,
  aberta,
}: ConfiguracaoForma): Path2D {
  const { path } = definicao ?? obterForma(id);
  const { width, height } = caixa;
  const caminho = new Path2D();
  if (typeof path === 'string') {
    caminho.addPath(new Path2D(path), new DOMMatrix([width, 0, 0, height, 0, 0]));
  } else {
    path(caminho, width, height, parametros, pontos, aberta);
  }
  return caminho;
}

function comEstilo(
  ctx: Grafico,
  estilo: Exclude<EstiloContorno, 'none'>,
  cor: string,
  executar: (pigmento: string | CanvasPattern) => void,
) {
  ctx.save();
  try {
    if (estilo === 'marcador') ctx.globalAlpha *= opacidadeDoPincel('marcador');
    // O padrão da aquarela já tem transparência. A composição normal mantém a prévia fiel.
    const pigmento =
      estilo === 'giz' || estilo === 'aquarela' ? padraoDeTextura(ctx, estilo, cor) : cor;
    executar(pigmento);
  } finally {
    ctx.restore();
  }
}

export function desenharForma(ctx: Grafico, forma: ConfiguracaoForma): void {
  const { caixa, contorno, preenchimento, cor1, cor2, espessura, rotacao, aberta } = forma;
  const { x, y, width, height } = caixa;
  if (width <= 0 || height <= 0) return;
  const caminho = caminhoDaForma(forma);
  ctx.save();
  try {
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(rotacao);
    ctx.translate(-width / 2, -height / 2);

    if (preenchimento !== 'none' && obterDefinicaoForma(forma).fechada && !aberta) {
      comEstilo(ctx, preenchimento, cor2, (pigmento) => {
        ctx.fillStyle = pigmento;
        ctx.fill(caminho, 'evenodd');
      });
    }
    if (contorno !== 'none') {
      comEstilo(ctx, contorno, cor1, (pigmento) => {
        ctx.strokeStyle = pigmento;
        ctx.lineWidth = Math.max(1, espessura);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (contorno === 'dash') ctx.setLineDash([espessura * 3, espessura * 1.8]);
        else if (contorno === 'dot') ctx.setLineDash([0.01, espessura * 2.2]);
        else ctx.setLineDash([]);
        ctx.stroke(caminho);
      });
    }
  } finally {
    ctx.restore();
  }
}

/** A caixa do histórico inclui os controles Bézier externos e o raio do contorno. */
export function areaDaForma(forma: ConfiguracaoForma): Rect {
  const { caixa, rotacao, pontos, contorno, espessura } = forma;
  const centroX = caixa.x + caixa.width / 2;
  const centroY = caixa.y + caixa.height / 2;
  let menorX = -caixa.width / 2;
  let maiorX = caixa.width / 2;
  let menorY = -caixa.height / 2;
  let maiorY = caixa.height / 2;
  const controles = forma.definicao ? pontosDosLimites(forma.definicao.path) : pontos;
  for (const ponto of controles ?? []) {
    const x = (ponto.x - 0.5) * caixa.width;
    const y = (ponto.y - 0.5) * caixa.height;
    menorX = Math.min(menorX, x);
    maiorX = Math.max(maiorX, x);
    menorY = Math.min(menorY, y);
    maiorY = Math.max(maiorY, y);
  }

  const cosseno = Math.cos(rotacao);
  const seno = Math.sin(rotacao);
  const cantos = [
    [menorX, menorY],
    [maiorX, menorY],
    [maiorX, maiorY],
    [menorX, maiorY],
  ];
  const xs = cantos.map(([x, y]) => centroX + x * cosseno - y * seno);
  const ys = cantos.map(([x, y]) => centroY + x * seno + y * cosseno);
  const margem = 1 + (contorno === 'none' ? 0 : Math.max(1, espessura) / 2);
  const x = Math.floor(Math.min(...xs) - margem);
  const y = Math.floor(Math.min(...ys) - margem);
  return {
    x,
    y,
    width: Math.ceil(Math.max(...xs) + margem) - x,
    height: Math.ceil(Math.max(...ys) + margem) - y,
  };
}

export function desenharMiniatura(ctx: Grafico, id: FormaId, caixa: Rect): void {
  desenharForma(ctx, {
    id,
    caixa,
    rotacao: 0,
    cor1: '#273c52',
    cor2: '#fff',
    espessura: 1.3,
    contorno: 'solid',
    preenchimento: 'none',
    parametros: PARAMETROS_PADRAO,
  });
}
