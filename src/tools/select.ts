import { contornoDaElipse, trechosVisiveis } from '../document/mascaraPixels';
import {
  caminhoDaSelecao,
  pontoNaSelecao,
  projetarMascara,
  type MascaraSelecao,
  type RecorteFlutuante,
} from '../document/selecao';
import type { Point, Rect, ToolId } from '../layers/types';
import {
  alcasDeTamanho,
  distanciaEntre,
  redimensionarForma,
  type AlcaForma,
} from './geometriaForma';
import { normalizeRect } from './pixels';
import { definirFerramenta, type EventoFerramenta, type ToolCtx } from './tool';

interface MoverSelecao {
  tipo: 'mover';
  inicio: Point;
  origem: Rect;
  destino: Rect;
  alca?: AlcaForma;
  mascara?: MascaraSelecao;
  corTransparente?: string;
  duplicar: boolean;
  recorte: RecorteFlutuante | null;
}

type GestoSelecao = { tipo: 'marcar'; pontos: Point[] } | MoverSelecao;
const setas: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

function limites(ctx: ToolCtx) {
  return { width: ctx.largura, height: ctx.altura };
}

function deslocar(origem: Rect, dx: number, dy: number, ctx: ToolCtx): Rect {
  return {
    ...origem,
    x: Math.round(Math.max(0, Math.min(ctx.largura - origem.width, origem.x + dx))),
    y: Math.round(Math.max(0, Math.min(ctx.altura - origem.height, origem.y + dy))),
  };
}

type ModoSelecao = 'retangulo' | 'laco' | 'elipse';

/** Ferramentas que mostram e mexem na seleção (as formigas ficam animadas nelas). */
export const FERRAMENTAS_DE_SELECAO = new Set<ToolId>(['select', 'lasso', 'ellipseSelect', 'wand']);

const IDENTIDADES = {
  retangulo: { id: 'select', nome: 'Seleção', icone: 'selection', atalho: 'S' },
  laco: { id: 'lasso', nome: 'Laço', icone: 'selection-select', atalho: 'L' },
  elipse: { id: 'ellipseSelect', nome: 'Seleção elíptica', icone: 'layer-shape-ellipse' },
} as const;

/** Caminho do tracejado: o contorno sem as pontes que juntam várias regiões (varinha). */
function caminhoDoTracejado(area: Rect, mascara?: MascaraSelecao): Path2D {
  if (!mascara?.contorno.length) return caminhoDaSelecao(area, mascara);
  const caminho = new Path2D();
  if (mascara.inversa) caminho.rect(area.x, area.y, area.width, area.height);
  for (const trecho of trechosVisiveis(mascara.contorno)) {
    const [primeiro, ...resto] = trecho;
    caminho.moveTo(primeiro.x, primeiro.y);
    for (const ponto of resto) caminho.lineTo(ponto.x, ponto.y);
  }
  return caminho;
}

/** As formigas da seleção e as alças, usadas pela seleção e pela varinha mágica. */
export function desenharSelecao(
  ctx: ToolCtx,
  grafico: CanvasRenderingContext2D,
  comAlcas: boolean,
) {
  const area = ctx.selecao;
  if (!area) return;
  const zoom = ctx.opcoes.zoom;
  const caminho = caminhoDoTracejado(area, ctx.mascaraSelecao);
  grafico.save();
  grafico.strokeStyle = '#fff';
  grafico.lineWidth = 2 / zoom;
  grafico.stroke(caminho);
  grafico.lineWidth = 1 / zoom;
  grafico.strokeStyle = '#213e58';
  grafico.setLineDash([4 / zoom, 4 / zoom]);
  grafico.lineDashOffset = -((Math.floor(performance.now() / 90) % 8) / zoom);
  grafico.stroke(caminho);
  grafico.setLineDash([]);
  if (comAlcas) {
    for (const { posicao } of alcasDeTamanho({ id: 'rectangle', caixa: area, rotacao: 0 })) {
      const lado = Math.min(6 / zoom, area.width / 3, area.height / 3);
      const x = posicao.x - lado / 2;
      const y = posicao.y - lado / 2;
      grafico.fillStyle = '#fff';
      grafico.fillRect(x, y, lado, lado);
      grafico.strokeRect(x, y, lado, lado);
    }
  }
  grafico.restore();
}

function definirSelecao(modo: ModoSelecao) {
  const laco = modo === 'laco';
  return definirFerramenta(IDENTIDADES[modo], () => {
    let gesto: GestoSelecao | null = null;

    function publicar(ctx: ToolCtx, ajuste: MoverSelecao) {
      const { origem, destino, duplicar, mascara, corTransparente } = ajuste;
      if (!ajuste.recorte) return;
      if (
        origem.x !== destino.x ||
        origem.y !== destino.y ||
        origem.width !== destino.width ||
        origem.height !== destino.height
      ) {
        ctx.executar({
          tipo: 'MoverSelecao',
          origem,
          destino,
          duplicar,
          mascara,
          corTransparente,
        });
      }
      ctx.selecionar(destino, projetarMascara(mascara, origem, destino));
    }

    function atualizar(ctx: ToolCtx, { ponto, shift }: EventoFerramenta) {
      if (!gesto) return;
      if (gesto.tipo === 'marcar') {
        const { pontos } = gesto;
        if (modo === 'elipse') {
          // Shift: círculo.
          let fim = ponto;
          if (shift) {
            const lado = Math.max(Math.abs(ponto.x - pontos[0].x), Math.abs(ponto.y - pontos[0].y));
            fim = {
              x: pontos[0].x + Math.sign(ponto.x - pontos[0].x || 1) * lado,
              y: pontos[0].y + Math.sign(ponto.y - pontos[0].y || 1) * lado,
            };
          }
          const area = normalizeRect(pontos[0], fim, limites(ctx));
          if (area.width >= 2 && area.height >= 2)
            ctx.selecionar(area, { contorno: contornoDaElipse(area) });
          else ctx.selecionar(null);
          return;
        }
        if (!laco) {
          ctx.selecionar(normalizeRect(pontos[0], ponto, limites(ctx)));
          return;
        }
        if (distanciaEntre(pontos.at(-1)!, ponto) < Math.max(1, 2 / ctx.opcoes.zoom)) return;
        if (pontos.length === 2048) pontos.splice(1, 1);
        pontos.push(ponto);
        const xs = pontos.map(({ x }) => x);
        const ys = pontos.map(({ y }) => y);
        const area = normalizeRect(
          { x: Math.min(...xs), y: Math.min(...ys) },
          { x: Math.max(...xs), y: Math.max(...ys) },
          limites(ctx),
        );
        if (pontos.length >= 3) ctx.selecionar(area, { contorno: pontos.slice() });
        return;
      }
      const { alca, origem, inicio, recorte, duplicar, mascara } = gesto;
      let destino = deslocar(origem, ponto.x - inicio.x, ponto.y - inicio.y, ctx);
      if (alca) {
        const caixa = redimensionarForma(
          { id: 'rectangle', caixa: origem, rotacao: 0 },
          alca,
          inicio,
          ponto,
          shift,
        ).caixa;
        destino = normalizeRect(
          caixa,
          { x: caixa.x + caixa.width, y: caixa.y + caixa.height },
          limites(ctx),
        );
        if (destino.width < 1 || destino.height < 1) return;
      }
      gesto.destino = destino;
      if (recorte) {
        ctx.previsualizarSelecao(duplicar ? null : origem, destino, recorte);
        ctx.selecionar(destino, projetarMascara(mascara, origem, destino));
      } else ctx.reposicionarColagem?.(destino);
    }

    return {
      cursor: () => 'crosshair',
      onPointerDown(ctx, { ponto, ctrl }) {
        const origem = ctx.selecao;
        const mascara = ctx.mascaraSelecao;
        const raio = origem
          ? Math.min(5 / ctx.opcoes.zoom, origem.width / 4, origem.height / 4)
          : 0;
        const alca =
          origem &&
          alcasDeTamanho({ id: 'rectangle', caixa: origem, rotacao: 0 }).find(
            ({ posicao }) => distanciaEntre(posicao, ponto) <= raio,
          );
        if (origem && (alca || pontoNaSelecao(origem, ponto, mascara))) {
          const corTransparente = ctx.opcoes.selecaoTransparente ? ctx.opcoes.cor2 : undefined;
          gesto = {
            tipo: 'mover',
            inicio: ponto,
            origem,
            destino: origem,
            alca: alca || undefined,
            mascara,
            duplicar: Boolean(ctrl),
            corTransparente,
            recorte: ctx.colagemFlutuante
              ? null
              : ctx.prepararRecorte(origem, mascara, corTransparente),
          };
          return;
        }
        if (ctx.colagemFlutuante) ctx.confirmarColagem?.();
        gesto = { tipo: 'marcar', pontos: [ponto] };
        ctx.selecionar(null);
      },
      onPointerMove: atualizar,
      onPointerUp(ctx, evento) {
        if (gesto?.tipo === 'marcar') atualizar(ctx, evento);
        const concluido = gesto;
        gesto = null;
        if (concluido?.tipo !== 'mover') return;
        ctx.limparPrevia();
        publicar(ctx, concluido);
      },
      onCancel(ctx) {
        ctx.limparPrevia();
        if (gesto?.tipo === 'mover') {
          if (gesto.recorte) ctx.selecionar(gesto.origem, gesto.mascara);
          else ctx.reposicionarColagem?.(gesto.origem);
        } else ctx.selecionar(null);
        gesto = null;
      },
      onKeyDown(ctx, evento) {
        const origem = ctx.selecao;
        if (!origem) return false;
        if (evento.key === 'Escape') {
          ctx.selecionar(null);
          return true;
        }
        const direcao = setas[evento.key];
        if (!direcao || evento.ctrlKey || evento.metaKey || evento.altKey) return false;
        const passo = evento.shiftKey ? 10 : 1;
        const destino = deslocar(origem, direcao.x * passo, direcao.y * passo, ctx);
        if (ctx.colagemFlutuante) {
          ctx.reposicionarColagem?.(destino);
          return true;
        }
        const mascara = ctx.mascaraSelecao;
        const corTransparente = ctx.opcoes.selecaoTransparente ? ctx.opcoes.cor2 : undefined;
        if (destino.x !== origem.x || destino.y !== origem.y)
          ctx.executar({ tipo: 'MoverSelecao', origem, destino, mascara, corTransparente });
        ctx.selecionar(destino, projetarMascara(mascara, origem, destino));
        return true;
      },
      limitesOverlay(ctx) {
        if (!ctx.selecao) return null;
        const { x, y, width, height } = ctx.selecao;
        const margem = 7 / ctx.opcoes.zoom;
        return {
          x: x - margem,
          y: y - margem,
          width: width + margem * 2,
          height: height + margem * 2,
        };
      },
      overlay(ctx, grafico) {
        desenharSelecao(ctx, grafico, gesto?.tipo !== 'marcar');
      },
    };
  });
}

export const selecao = definirSelecao('retangulo');
export const selecaoLaco = definirSelecao('laco');
export const selecaoElipse = definirSelecao('elipse');
