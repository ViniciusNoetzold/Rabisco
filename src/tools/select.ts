import {
  caminhoDaSelecao,
  pontoNaSelecao,
  projetarMascara,
  type MascaraSelecao,
  type RecorteFlutuante,
} from '../document/selecao';
import type { Point, Rect } from '../layers/types';
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
  recorte: RecorteFlutuante;
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

function definirSelecao(laco: boolean) {
  const id = laco ? 'lasso' : 'select';
  return definirFerramenta(
    {
      id,
      nome: laco ? 'Laço' : 'Seleção',
      icone: laco ? 'selection-select' : 'selection',
      atalho: laco ? 'L' : 'S',
    },
    () => {
      let gesto: GestoSelecao | null = null;

      function publicar(ctx: ToolCtx, ajuste: MoverSelecao) {
        const { origem, destino, duplicar, mascara, corTransparente } = ajuste;
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
        ctx.previsualizarSelecao(duplicar ? null : origem, destino, recorte);
        ctx.selecionar(destino, projetarMascara(mascara, origem, destino));
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
              recorte: ctx.prepararRecorte(origem, mascara, corTransparente),
            };
            return;
          }
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
          if (gesto?.tipo === 'mover') ctx.selecionar(gesto.origem, gesto.mascara);
          else ctx.selecionar(null);
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
          const area = ctx.selecao;
          if (!area) return;
          const zoom = ctx.opcoes.zoom;
          const caminho = caminhoDaSelecao(area, ctx.mascaraSelecao);
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
          if (gesto?.tipo !== 'marcar') {
            for (const { posicao } of alcasDeTamanho({
              id: 'rectangle',
              caixa: area,
              rotacao: 0,
            })) {
              const lado = Math.min(6 / zoom, area.width / 3, area.height / 3);
              const x = posicao.x - lado / 2;
              const y = posicao.y - lado / 2;
              grafico.fillStyle = '#fff';
              grafico.fillRect(x, y, lado, lado);
              grafico.strokeRect(x, y, lado, lado);
            }
          }
          grafico.restore();
        },
      };
    },
  );
}

export const selecao = definirSelecao(false);
export const selecaoLaco = definirSelecao(true);
