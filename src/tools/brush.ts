import { criarGestoDedo } from './dedo';
import { AmostradorPincel } from '../brushes/amostrador';
import type { ConfiguracaoPincel, MarcaPincel } from '../brushes/catalogo';
import { PONTOS_POR_SEGUNDO } from '../brushes/motor';
import { afinarFim, comprimentoDaPonta } from '../brushes/pressao';
import { medicaoAtiva, medirOperacao } from '../canvas/medicao';
import type { Point } from '../layers/types';
import { corDoBotao, definirFerramenta, opcaoEspessura, type ToolCtx } from './tool';

interface Traco {
  configuracao: ConfiguracaoPincel;
  marcas: MarcaPincel[];
  ponto: Point;
}

type GestoPincel = Traco &
  (
    | { modo: 'carimbos'; amostrador: AmostradorPincel }
    | {
        modo: 'spray';
        quadro: number;
        instante: number;
        saldo: number;
        anterior: Point;
        taxa: number;
      }
  );

type GestoSpray = Extract<GestoPincel, { modo: 'spray' }>;

function emitir(ctx: ToolCtx, traco: Traco, marcas: readonly MarcaPincel[]) {
  if (marcas.length === 0) return;
  for (const marca of marcas) traco.marcas.push(marca);
  ctx.previsualizarMarcasPincel(marcas);
}

/** Divide os pontos do quadro ao longo do movimento, inclusive em arrastes rápidos. */
function borrifar(ctx: ToolCtx, gesto: GestoSpray, instante: number) {
  const segundos = Math.max(0, Math.min(100, instante - gesto.instante)) / 1000;
  gesto.instante = Math.max(gesto.instante, instante);
  gesto.saldo += segundos * gesto.taxa;
  const quantidade = Math.floor(gesto.saldo);
  if (quantidade === 0) return;
  gesto.saldo -= quantidade;

  const { anterior, ponto } = gesto;
  const dx = ponto.x - anterior.x;
  const dy = ponto.y - anterior.y;
  const distancia = Math.hypot(dx, dy);
  const intervalo = Math.max(1, gesto.configuracao.espessura * 0.35);
  const lotes = Math.min(quantidade, Math.max(1, Math.ceil(distancia / intervalo)));
  const marcas: MarcaPincel[] = [];
  for (let lote = 1; lote <= lotes; lote++) {
    const proporcao = lote / lotes;
    marcas.push({
      x: anterior.x + dx * proporcao,
      y: anterior.y + dy * proporcao,
      pressure: ponto.pressure,
      quantidade:
        Math.floor(quantidade * proporcao) - Math.floor((quantidade * (lote - 1)) / lotes),
    });
  }
  gesto.anterior = ponto;
  emitir(ctx, gesto, marcas);
}

export const pincel = definirFerramenta(
  { id: 'brush', nome: 'Pincel', icone: 'paint-brush', atalho: 'B', opcoes: [opcaoEspessura] },
  () => {
    let gesto: GestoPincel | null = null;
    let dedo: ReturnType<typeof criarGestoDedo> | null = null;

    function cancelarQuadro(ativo: GestoPincel) {
      if (ativo.modo === 'spray') cancelAnimationFrame(ativo.quadro);
    }

    return {
      cursor: () => 'crosshair',
      onPointerDown(ctx, { ponto, botao }) {
        if (ctx.opcoes.pincel === 'dedo') {
          dedo = criarGestoDedo(ctx, ponto);
          return;
        }
        const configuracao: ConfiguracaoPincel = {
          tipo: ctx.opcoes.pincel,
          cor: corDoBotao(ctx, botao),
          espessura: ctx.opcoes.espessura,
          semente: crypto.getRandomValues(new Uint32Array(1))[0],
          ...(ctx.opcoes.pincel === 'spray' && ctx.opcoes.gotasSpray === 2 ? { gota: 2 } : {}),
        };
        const traco: Traco = { configuracao, marcas: [], ponto };
        ctx.selecionar(null);
        ctx.iniciarPreviaPincel(configuracao);

        if (configuracao.tipo !== 'spray') {
          const amostrador = new AmostradorPincel(configuracao.espessura);
          gesto = { ...traco, modo: 'carimbos', amostrador };
          emitir(ctx, gesto, amostrador.adicionar(ponto));
          return;
        }

        const taxa = PONTOS_POR_SEGUNDO[ctx.opcoes.densidadeSpray];
        const spray: GestoSpray = {
          ...traco,
          modo: 'spray',
          taxa,
          anterior: ponto,
          instante: performance.now(),
          saldo: 0,
          quadro: 0,
        };
        gesto = spray;
        // Um clique breve também deposita tinta, mesmo antes do primeiro quadro.
        emitir(ctx, spray, [{ ...ponto, quantidade: Math.max(1, Math.round(taxa / 60)) }]);
        function animar(instante: number) {
          if (gesto !== spray) return;
          if (medicaoAtiva) medirOperacao('spray:quadro', () => borrifar(ctx, spray, instante));
          else borrifar(ctx, spray, instante);
          spray.quadro = requestAnimationFrame(animar);
        }
        spray.quadro = requestAnimationFrame(animar);
      },
      onPointerMove(ctx, { ponto }) {
        if (dedo) {
          dedo.mover(ponto);
          return;
        }
        if (!gesto) return;
        gesto.ponto = ponto;
        if (gesto.modo === 'carimbos') emitir(ctx, gesto, gesto.amostrador.adicionar(ponto));
      },
      onPointerUp(ctx, { ponto }) {
        if (dedo) {
          const atual = dedo;
          dedo = null;
          atual.terminar(ponto);
          return;
        }
        if (!gesto) return;
        const ativo = gesto;
        gesto = null;
        cancelarQuadro(ativo);
        // Na soltura de uma caneta, a pressão já caiu a zero. Mantemos a última
        // pressão registrada se ainda houver uma coordenada final para incluir.
        if (ponto.x !== ativo.ponto.x || ponto.y !== ativo.ponto.y) {
          ativo.ponto = { ...ponto, pressure: ponto.pressure || ativo.ponto.pressure };
          if (ativo.modo === 'carimbos')
            emitir(ctx, ativo, ativo.amostrador.adicionar(ativo.ponto));
        }
        if (ativo.modo === 'spray') borrifar(ctx, ativo, performance.now());
        else emitir(ctx, ativo, ativo.amostrador.finalizar());

        ctx.limparPrevia();
        // O começo já saiu fino enquanto se desenhava; o fim só dá para afinar agora.
        const marcas =
          ativo.modo === 'carimbos' && ctx.opcoes.afinar > 0
            ? afinarFim(
                ativo.marcas,
                comprimentoDaPonta(ctx.opcoes.afinar, ativo.configuracao.espessura),
              )
            : ativo.marcas;
        ctx.executar({ tipo: 'Pincelar', configuracao: ativo.configuracao, marcas });
      },
      onCancel(ctx) {
        if (dedo) {
          dedo.cancelar();
          dedo = null;
          return;
        }
        if (!gesto) return;
        cancelarQuadro(gesto);
        gesto = null;
        ctx.limparPrevia();
      },
    };
  },
);
