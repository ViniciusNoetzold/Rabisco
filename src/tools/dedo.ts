import { Borrador } from '../brushes/borrar';
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
  const borrador = new Borrador(copia, { x: 0, y: 0 }, espessura, forca);
  const pontos: Point[] = [{ x: ponto.x, y: ponto.y }];
  borrador.iniciar(ponto);

  return {
    mover(proximo: Point) {
      pontos.push({ x: proximo.x, y: proximo.y });
      const area = borrador.mover(proximo);
      if (!area) return;
      const x = Math.max(0, area.x);
      const y = Math.max(0, area.y);
      const largura = Math.min(tela.width, area.x + area.width) - x;
      const altura = Math.min(tela.height, area.y + area.height) - y;
      if (largura <= 0 || altura <= 0) return;
      grafico.putImageData(copia, 0, 0, x, y, largura, altura);
      ctx.previsualizarTrecho?.(tela, { x, y, width: largura, height: altura });
    },
    terminar(ultimo: Point) {
      const fim = pontos.at(-1)!;
      if (ultimo.x !== fim.x || ultimo.y !== fim.y) pontos.push({ x: ultimo.x, y: ultimo.y });
      tela.width = tela.height = 1;
      ctx.limparPrevia();
      if (pontos.length > 1) ctx.executar({ tipo: 'Borrar', pontos, espessura, forca });
    },
    cancelar() {
      tela.width = tela.height = 1;
      ctx.limparPrevia();
    },
  };
}
