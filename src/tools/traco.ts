import type { Point } from '../layers/types';
import { corDoBotao, definirFerramenta, opcaoEspessura, type EstiloTraco } from './tool';

export function definirTraco(
  id: EstiloTraco['ferramenta'],
  nome: string,
  icone: string,
  atalho: string,
) {
  return definirFerramenta(
    { id, nome, icone, atalho, opcoes: id === 'pencil' ? undefined : [opcaoEspessura] },
    () => {
      let gesto: { pontos: Point[]; estilo: EstiloTraco } | null = null;
      return {
        cursor: () => 'crosshair',
        onPointerDown(ctx, { ponto, botao }) {
          const estilo: EstiloTraco = {
            ferramenta: id,
            cor: id === 'eraser' ? '#ffffff' : corDoBotao(ctx, botao),
            espessura: id === 'pencil' ? 1 : ctx.opcoes.espessura,
          };
          gesto = { pontos: [ponto], estilo };
          ctx.selecionar(null);
          ctx.previsualizarTraco(ponto, ponto, estilo);
        },
        onPointerMove(ctx, { ponto }) {
          if (!gesto) return;
          const anterior = gesto.pontos[gesto.pontos.length - 1];
          gesto.pontos.push(ponto);
          ctx.previsualizarTraco(anterior, ponto, gesto.estilo);
        },
        onPointerUp(ctx) {
          if (!gesto) return;
          const { pontos, estilo } = gesto;
          gesto = null;
          ctx.limparPrevia();
          ctx.executar({ tipo: 'TracarPincel', pontos, ...estilo });
        },
        onCancel(ctx) {
          gesto = null;
          ctx.limparPrevia();
        },
      };
    },
  );
}
