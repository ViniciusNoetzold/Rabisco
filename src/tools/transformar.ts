import { desenharDistorcido, type Cantos } from '../document/distorcer';
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
  /** Depois de um Ctrl+arraste num canto: cada canto vai para onde foi levado (distorcer). */
  cantos?: Cantos;
}

type Alca = 'mover' | 'girar' | 'n' | 's' | 'l' | 'o' | 'ne' | 'no' | 'se' | 'so';
type Guias = { x: number[]; y: number[] };

const PASSO_GIRO = Math.PI / 12;
/** Ordem dos cantos: superior esquerdo, superior direito, inferior direito, inferior esquerdo. */
const INDICE_CANTO: Partial<Record<Alca, number>> = { no: 0, ne: 1, se: 2, so: 3 };

/** Matriz afim [a, b, c, d, e, f] que leva a camada original para a posição transformada. */
export function matrizDaTransformacao(estado: Omit<Estado, 'conteudo' | 'cantos'>): DOMMatrix {
  const { limites, dx, dy, sx, sy, angulo } = estado;
  const cx = limites.x + limites.width / 2;
  const cy = limites.y + limites.height / 2;
  return new DOMMatrix()
    .translate(cx + dx, cy + dy)
    .rotate((angulo * 180) / Math.PI)
    .scale(sx, sy)
    .translate(-cx, -cy);
}

/** Cantos atuais da caixa no papel (distorcidos ou pela matriz). */
function cantosAtuais(estado: Estado): Cantos {
  if (estado.cantos) return estado.cantos;
  const m = matrizDaTransformacao(estado);
  const { x, y, width, height } = estado.limites;
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ].map(([px, py]) => {
    const ponto = m.transformPoint(new DOMPoint(px, py));
    return { x: ponto.x, y: ponto.y };
  }) as Cantos;
}

function identidade(estado: Estado) {
  return (
    !estado.cantos &&
    !estado.dx &&
    !estado.dy &&
    estado.sx === 1 &&
    estado.sy === 1 &&
    !estado.angulo
  );
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

/** O ponto está dentro do quadrilátero (convexo ou não)? */
function dentroDe(cantos: Cantos, ponto: Point): boolean {
  let dentro = false;
  for (let i = 0, j = cantos.length - 1; i < cantos.length; j = i++) {
    const a = cantos[i];
    const b = cantos[j];
    if (
      a.y > ponto.y !== b.y > ponto.y &&
      ponto.x < ((b.x - a.x) * (ponto.y - a.y)) / (b.y - a.y) + a.x
    )
      dentro = !dentro;
  }
  return dentro;
}

/**
 * Encaixe: aproxima bordas e centro da caixa das guias (papel e outras camadas). Devolve a
 * correção a somar ao deslocamento e as guias usadas, para desenhar as linhas magenta.
 */
function encaixar(cantos: Cantos, guias: Guias, limiar: number) {
  const xs = cantos.map((c) => c.x);
  const ys = cantos.map((c) => c.y);
  const caixaX = [Math.min(...xs), (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...xs)];
  const caixaY = [Math.min(...ys), (Math.min(...ys) + Math.max(...ys)) / 2, Math.max(...ys)];
  const melhor = (valores: number[], alvos: number[]) => {
    let resultado: { correcao: number; guia: number } | null = null;
    for (const valor of valores)
      for (const alvo of alvos) {
        const correcao = alvo - valor;
        if (
          Math.abs(correcao) <= limiar &&
          (!resultado || Math.abs(correcao) < Math.abs(resultado.correcao))
        )
          resultado = { correcao, guia: alvo };
      }
    return resultado;
  };
  return { x: melhor(caixaX, guias.x), y: melhor(caixaY, guias.y) };
}

/**
 * Transformação livre (Ctrl+T): mover, escalar a partir do centro, girar e distorcer
 * (Ctrl+arraste num canto) a camada ativa. A caixa encaixa nas bordas e no centro do papel e das
 * outras camadas, com linhas magenta. Enquanto ajusta, a camada sai da tela e a prévia aparece
 * por cima; Enter (ou trocar de ferramenta) confirma num único item do histórico, Esc cancela.
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
    let arraste: {
      alca: Alca;
      inicio: Point;
      antes: Estado;
      anguloInicial: number;
      distorcer: boolean;
    } | null = null;
    let descartar = false;
    /** Depois de confirmar ou cancelar, a caixa só volta com um novo clique na camada. */
    let emPausa = false;
    let guias: Guias = { x: [], y: [] };
    let guiasAtivas: { x: number | null; y: number | null } = { x: null, y: null };

    function iniciar(ctx: ToolCtx) {
      if (estado) return estado;
      const base = ctx.camadaParaTransformar();
      if (!base) return null;
      estado = { ...base, dx: 0, dy: 0, sx: 1, sy: 1, angulo: 0 };
      guias = ctx.opcoes.guiasInteligentes ? ctx.guiasDeEncaixe() : { x: [], y: [] };
      ctx.ocultarCamadaAtiva(true);
      return estado;
    }

    function encerrar(ctx: ToolCtx) {
      estado = null;
      arraste = null;
      emPausa = true;
      guiasAtivas = { x: null, y: null };
      ctx.ocultarCamadaAtiva(false);
    }

    function confirmar(ctx: ToolCtx) {
      const atual = estado;
      if (!atual) return;
      encerrar(ctx);
      if (identidade(atual)) return;
      if (atual.cantos) {
        ctx.executar({
          tipo: 'DistorcerCamada',
          id: ctx.camadaAtiva,
          origem: atual.limites,
          cantos: atual.cantos.map(({ x, y }) => ({ x, y })) as Cantos,
        });
        return;
      }
      const m = matrizDaTransformacao(atual);
      ctx.executar({
        tipo: 'TransformarCamada',
        id: ctx.camadaAtiva,
        matriz: [m.a, m.b, m.c, m.d, m.e, m.f],
      });
    }

    function alcaEm(ctx: ToolCtx, atual: Estado, ponto: Point, ctrl: boolean): Alca | null {
      const raio = 8 / ctx.opcoes.zoom;
      if (atual.cantos || ctrl) {
        // Distorcer: só os cantos e o mover valem.
        const cantos = cantosAtuais(atual);
        const nomes: Alca[] = ['no', 'ne', 'se', 'so'];
        for (const [i, canto] of cantos.entries())
          if (Math.hypot(ponto.x - canto.x, ponto.y - canto.y) <= raio) return nomes[i];
        if (atual.cantos) return dentroDe(cantos, ponto) ? 'mover' : null;
      }
      const p = local(atual, ponto);
      const meiaL = (atual.limites.width * atual.sx) / 2;
      const meiaA = (atual.limites.height * atual.sy) / 2;
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
        descartar = true;
      },
      onPointerDown(ctx, { ponto, ctrl }) {
        if (emPausa) {
          emPausa = false;
          iniciar(ctx);
          return;
        }
        const atual = iniciar(ctx);
        if (!atual) return;
        const alca = alcaEm(ctx, atual, ponto, Boolean(ctrl));
        if (!alca) {
          confirmar(ctx);
          return;
        }
        const distorcer =
          INDICE_CANTO[alca] !== undefined && (Boolean(ctrl) || Boolean(atual.cantos));
        // O primeiro Ctrl+arraste num canto troca a matriz pelos quatro cantos livres.
        if (distorcer && !atual.cantos) atual.cantos = cantosAtuais(atual);
        const centro = {
          x: atual.limites.x + atual.limites.width / 2 + atual.dx,
          y: atual.limites.y + atual.limites.height / 2 + atual.dy,
        };
        arraste = {
          alca,
          inicio: ponto,
          antes: { ...atual, cantos: atual.cantos && ([...atual.cantos] as Cantos) },
          anguloInicial: Math.atan2(ponto.y - centro.y, ponto.x - centro.x),
          distorcer,
        };
      },
      onPointerMove(ctx, { ponto, shift }) {
        if (!estado || !arraste) return;
        const { alca, inicio, antes } = arraste;
        const limiar = 6 / ctx.opcoes.zoom;
        if (arraste.distorcer && antes.cantos) {
          const indice = INDICE_CANTO[alca]!;
          const cantos = [...antes.cantos] as Cantos;
          cantos[indice] = {
            x: antes.cantos[indice].x + ponto.x - inicio.x,
            y: antes.cantos[indice].y + ponto.y - inicio.y,
          };
          estado.cantos = cantos;
          return;
        }
        if (alca === 'mover') {
          let dx = ponto.x - inicio.x;
          let dy = ponto.y - inicio.y;
          const movidos = cantosAtuais({
            ...antes,
            dx: antes.dx + dx,
            dy: antes.dy + dy,
            cantos: antes.cantos?.map((c) => ({ x: c.x + dx, y: c.y + dy })) as Cantos | undefined,
          });
          const encaixe = shift ? { x: null, y: null } : encaixar(movidos, guias, limiar);
          dx += encaixe.x?.correcao ?? 0;
          dy += encaixe.y?.correcao ?? 0;
          guiasAtivas = { x: encaixe.x?.guia ?? null, y: encaixe.y?.guia ?? null };
          dx = Math.round(dx);
          dy = Math.round(dy);
          if (antes.cantos) {
            estado.cantos = antes.cantos.map((c) => ({ x: c.x + dx, y: c.y + dy })) as Cantos;
          } else {
            estado.dx = antes.dx + dx;
            estado.dy = antes.dy + dy;
          }
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
      },
      onPointerUp() {
        arraste = null;
        guiasAtivas = { x: null, y: null };
      },
      onCancel() {
        arraste = null;
        guiasAtivas = { x: null, y: null };
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
        const zoom = ctx.opcoes.zoom;
        const cantos = cantosAtuais(atual);

        grafico.save();
        grafico.imageSmoothingQuality = 'high';
        if (atual.cantos) {
          // Prévia mais leve (malha 8 × 8); ao confirmar, a malha é mais fina.
          desenharDistorcido(grafico, atual.conteudo, atual.limites, atual.cantos, 8);
        } else {
          grafico.setTransform(matrizDaTransformacao(atual));
          grafico.drawImage(atual.conteudo, atual.limites.x, atual.limites.y);
        }
        grafico.restore();

        grafico.save();
        if (guiasAtivas.x !== null || guiasAtivas.y !== null) {
          grafico.strokeStyle = '#e0219a';
          grafico.lineWidth = 1 / zoom;
          grafico.beginPath();
          if (guiasAtivas.x !== null) {
            grafico.moveTo(guiasAtivas.x, 0);
            grafico.lineTo(guiasAtivas.x, ctx.altura);
          }
          if (guiasAtivas.y !== null) {
            grafico.moveTo(0, guiasAtivas.y);
            grafico.lineTo(ctx.largura, guiasAtivas.y);
          }
          grafico.stroke();
        }
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
        const meio = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const alcas: Point[] = atual.cantos
          ? cantos
          : [
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
        if (!atual.cantos) {
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
        }
        grafico.restore();
      },
    };
  },
);
