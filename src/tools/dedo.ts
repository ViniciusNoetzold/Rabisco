import { BorradorSimetrico } from '../brushes/borrar';
import { limitarArea } from '../commands/desenho';
import { coberturaDaSelecao } from '../filtros/cobertura';
import type { Point } from '../layers/types';
import type { ToolCtx } from './tool';

/**
 * O gesto do dedo dentro da ferramenta Pincel: borra uma cópia do papel enquanto arrasta (a
 * prévia) e, ao soltar, manda o comando Borrar com os pontos (o executor refaz igual).
 */
export function criarGestoDedo(ctx: ToolCtx, ponto: Point) {
  const { largura, altura } = ctx;
  const espessura = ctx.opcoes.espessura;
  const forca = Math.max(0, Math.min(100, ctx.opcoes.forcaDedo)) / 100;
  const copia = ctx.lerPixels({ x: 0, y: 0, width: largura, height: altura });
  const tela = document.createElement('canvas');
  tela.width = largura;
  tela.height = altura;
  const grafico = tela.getContext('2d')!;
  grafico.putImageData(copia, 0, 0);
  const area = ctx.selecao ?? undefined;
  const mascara = ctx.mascaraSelecao;
  const simetria = ctx.simetria;
  const borrador = new BorradorSimetrico(copia, { x: 0, y: 0 }, espessura, forca, {
    simetria,
    area,
    cobertura: area && mascara ? coberturaDaSelecao(area, mascara) : undefined,
    travarAlfa: ctx.travarAlfa,
  });
  const pontos: Point[] = [{ x: ponto.x, y: ponto.y }];
  borrador.iniciar(ponto);

  return {
    mover(proximo: Point) {
      pontos.push({ x: proximo.x, y: proximo.y });
      const recortes = borrador.mover(proximo).flatMap((parte) => limitarArea(parte, tela) ?? []);
      for (const { x, y, width, height } of recortes)
        grafico.putImageData(copia, 0, 0, x, y, width, height);
      for (const parte of recortes) ctx.previsualizarTrecho?.(tela, parte);
    },
    terminar(ultimo: Point) {
      const fim = pontos.at(-1)!;
      if (ultimo.x !== fim.x || ultimo.y !== fim.y) pontos.push({ x: ultimo.x, y: ultimo.y });
      tela.width = tela.height = 1;
      ctx.limparPrevia();
      if (pontos.length > 1)
        ctx.executar({ tipo: 'Borrar', pontos, espessura, forca, simetria, area, mascara });
    },
    cancelar() {
      tela.width = tela.height = 1;
      ctx.limparPrevia();
    },
  };
}
