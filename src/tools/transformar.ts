import type { Point, Rect } from '../layers/types';
import { definirFerramenta, type ToolCtx } from './tool';

interface Estado {
  /** Conteúdo da camada (recortado aos pixels não transparentes) e onde ele estava. */
  conteudo: HTMLCanvasElement;
  limites: Rect;
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  /** Radianos. */
  angulo: number;
}

type Alca = 'mover' | 'girar' | 'n' | 's' | 'l' | 'o' | 'ne' | 'no' | 'se' | 'so';

const PASSO_GIRO = Math.PI / 12;

/** Matriz afim [a, b, c, d, e, f] que leva a camada original para a posição transformada. */
export function matrizDaTransformacao(estado: Omit<Estado, 'conteudo'>): DOMMatrix {
  const { limites, dx, dy, sx, sy, angulo } = estado;
  const cx = limites.x + limites.width / 2;
  const cy = limites.y + limites.height / 2;
  return new DOMMatrix()
    .translate(cx + dx, cy + dy)
    .rotate((angulo * 180) / Math.PI)
    .scale(sx, sy)
    .translate(-cx, -cy);
}

function identidade(estado: Estado) {
  return !estado.dx && !estado.dy && estado.sx === 1 && estado.sy === 1 && !estado.angulo;
}

/** Ponto em coordenadas locais da caixa (centro na origem, sem giro). */
function local(estado: Estado, ponto: Point): Point {
  const { limites, dx, dy, angulo } = estado;
  const cx = limites.x + limites.width / 2 + dx;
  const cy = limites.y + limites.height / 2 + dy;
  const x = ponto.x - cx;
  const y = ponto.y - cy;
  const cos = Math.cos(-angulo);
  const sin = Math.sin(-angulo);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Transformação livre (Ctrl+T): mover, escalar a partir do centro e girar a camada ativa.
 * Enquanto ajusta, a camada sai da tela e a prévia aparece por cima; Enter (ou trocar de
 * ferramenta) confirma num único item do histórico, Esc cancela.
 */
export const transformar = definirFerramenta(
  {
    id: 'transform',
    nome: 'Transformação livre',
    icone: 'application-resize-full',
    atalho: 'Ctrl+T',
  },
  () => {
    let estado: Estado | null = null;
    let arraste: { alca: Alca; inicio: Point; antes: Estado; anguloInicial: number } | null = null;
    let descartar = false;
    /** Depois de confirmar ou cancelar, a caixa só volta com um novo clique na camada. */
    let emPausa = false;

    function iniciar(ctx: ToolCtx) {
      if (estado) return estado;
      const base = ctx.camadaParaTransformar();
      if (!base) return null;
      estado = { ...base, dx: 0, dy: 0, sx: 1, sy: 1, angulo: 0 };
      ctx.ocultarCamadaAtiva(true);
      return estado;
    }

    function encerrar(ctx: ToolCtx) {
      estado = null;
      arraste = null;
      emPausa = true;
      ctx.ocultarCamadaAtiva(false);
    }

    function confirmar(ctx: ToolCtx) {
      const atual = estado;
      if (!atual) return;
      encerrar(ctx);
      if (identidade(atual)) return;
      const m = matrizDaTransformacao(atual);
      ctx.executar({
        tipo: 'TransformarCamada',
        id: ctx.camadaAtiva,
        matriz: [m.a, m.b, m.c, m.d, m.e, m.f],
      });
    }

    function alcaEm(ctx: ToolCtx, atual: Estado, ponto: Point): Alca | null {
      const p = local(atual, ponto);
      const meiaL = (atual.limites.width * atual.sx) / 2;
      const meiaA = (atual.limites.height * atual.sy) / 2;
      const raio = 8 / ctx.opcoes.zoom;
      const distancia = (x: number, y: number) => Math.hypot(p.x - x, p.y - y) <= raio;
      if (distancia(0, -Math.abs(meiaA) - 28 / ctx.opcoes.zoom)) return 'girar';
      const alcas: [Alca, number, number][] = [
        ['no', -meiaL, -meiaA],
        ['ne', meiaL, -meiaA],
        ['so', -meiaL, meiaA],
        ['se', meiaL, meiaA],
        ['n', 0, -meiaA],
        ['s', 0, meiaA],
        ['o', -meiaL, 0],
        ['l', meiaL, 0],
      ];
      for (const [nome, x, y] of alcas) if (distancia(x, y)) return nome;
      if (Math.abs(p.x) <= Math.abs(meiaL) && Math.abs(p.y) <= Math.abs(meiaA)) return 'mover';
      return null;
    }

    return {
      cursor: () => 'default',
      temPendente: () => Boolean(estado),
      commitPendente: (ctx) => confirmar(ctx),
      descartarPendente: () => {
        // Sem contexto aqui: a camada volta a aparecer no próximo desenho do overlay.
        if (estado) estado = { ...estado, dx: 0, dy: 0, sx: 1, sy: 1, angulo: 0 };
        descartar = true;
      },
      onPointerDown(ctx, { ponto }) {
        if (emPausa) {
          emPausa = false;
          iniciar(ctx);
          return;
        }
        const atual = iniciar(ctx);
        if (!atual) return;
        const alca = alcaEm(ctx, atual, ponto);
        if (!alca) {
          confirmar(ctx);
          return;
        }
        const centro = {
          x: atual.limites.x + atual.limites.width / 2 + atual.dx,
          y: atual.limites.y + atual.limites.height / 2 + atual.dy,
        };
        arraste = {
          alca,
          inicio: ponto,
          antes: { ...atual },
          anguloInicial: Math.atan2(ponto.y - centro.y, ponto.x - centro.x),
        };
      },
      onPointerMove(ctx, { ponto, shift }) {
        if (!estado || !arraste) return;
        const { alca, inicio, antes } = arraste;
        if (alca === 'mover') {
          estado.dx = Math.round(antes.dx + ponto.x - inicio.x);
          estado.dy = Math.round(antes.dy + ponto.y - inicio.y);
          return;
        }
        if (alca === 'girar') {
          const cx = antes.limites.x + antes.limites.width / 2 + antes.dx;
          const cy = antes.limites.y + antes.limites.height / 2 + antes.dy;
          let angulo =
            antes.angulo + Math.atan2(ponto.y - cy, ponto.x - cx) - arraste.anguloInicial;
          if (shift) angulo = Math.round(angulo / PASSO_GIRO) * PASSO_GIRO;
          estado.angulo = angulo;
          return;
        }
        // Escala a partir do centro: a alça vai até onde o ponteiro está.
        const p = local({ ...estado, angulo: antes.angulo }, ponto);
        const meiaL = antes.limites.width / 2;
        const meiaA = antes.limites.height / 2;
        let sx = alca === 'n' || alca === 's' ? antes.sx : Math.max(0.02, Math.abs(p.x) / meiaL);
        let sy = alca === 'l' || alca === 'o' ? antes.sy : Math.max(0.02, Math.abs(p.y) / meiaA);
        if (shift && alca.length === 2) {
          const escala = Math.max(sx / antes.sx, sy / antes.sy);
          sx = antes.sx * escala;
          sy = antes.sy * escala;
        }
        estado.sx = sx;
        estado.sy = sy;
        void ctx;
      },
      onPointerUp() {
        arraste = null;
      },
      onCancel() {
        arraste = null;
      },
      onKeyDown(ctx, evento) {
        if (!estado) return false;
        if (evento.key === 'Enter') {
          confirmar(ctx);
          return true;
        }
        if (evento.key === 'Escape') {
          encerrar(ctx);
          return true;
        }
        return false;
      },
      overlay(ctx, grafico) {
        if (descartar) {
          descartar = false;
          encerrar(ctx);
          return;
        }
        if (emPausa && !estado) return;
        const atual = iniciar(ctx);
        if (!atual) return;
        const m = matrizDaTransformacao(atual);
        grafico.save();
        grafico.imageSmoothingQuality = 'high';
        grafico.setTransform(m);
        grafico.drawImage(atual.conteudo, atual.limites.x, atual.limites.y);
        grafico.restore();

        const zoom = ctx.opcoes.zoom;
        const { x, y, width, height } = atual.limites;
        const cantos = [
          [x, y],
          [x + width, y],
          [x + width, y + height],
          [x, y + height],
        ].map(([px, py]) => m.transformPoint(new DOMPoint(px, py)));
        grafico.save();
        grafico.lineWidth = 1.5 / zoom;
        grafico.strokeStyle = '#2f7fc1';
        grafico.setLineDash([5 / zoom, 3 / zoom]);
        grafico.beginPath();
        cantos.forEach((canto, i) =>
          i ? grafico.lineTo(canto.x, canto.y) : grafico.moveTo(canto.x, canto.y),
        );
        grafico.closePath();
        grafico.stroke();
        grafico.setLineDash([]);
        const meio = (a: DOMPoint, b: DOMPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const alcas = [
          ...cantos,
          meio(cantos[0], cantos[1]),
          meio(cantos[1], cantos[2]),
          meio(cantos[2], cantos[3]),
          meio(cantos[3], cantos[0]),
        ];
        const lado = 8 / zoom;
        grafico.fillStyle = '#ffffff';
        for (const alca of alcas) {
          grafico.fillRect(alca.x - lado / 2, alca.y - lado / 2, lado, lado);
          grafico.strokeRect(alca.x - lado / 2, alca.y - lado / 2, lado, lado);
        }
        // Alça de giro acima do meio do lado de cima.
        const topo = meio(cantos[0], cantos[1]);
        const direcao = { x: Math.sin(atual.angulo), y: -Math.cos(atual.angulo) };
        const distancia = 28 / zoom;
        const giro = { x: topo.x + direcao.x * distancia, y: topo.y + direcao.y * distancia };
        grafico.beginPath();
        grafico.moveTo(topo.x, topo.y);
        grafico.lineTo(giro.x, giro.y);
        grafico.stroke();
        grafico.beginPath();
        grafico.arc(giro.x, giro.y, 5 / zoom, 0, Math.PI * 2);
        grafico.fill();
        grafico.stroke();
        grafico.restore();
      },
    };
  },
);
