import type { ComandoForma } from '../commands/comandos';
import { desenharForma } from '../commands/desenho';
import { corDoBotao, definirFerramenta, opcaoEspessura } from './tool';

export function definirForma(
  id: ComandoForma['forma'],
  nome: string,
  icone: string,
  atalho: string,
) {
  return definirFerramenta(
    {
      id,
      nome,
      icone,
      atalho,
      opcoes:
        id === 'line'
          ? [opcaoEspessura]
          : [opcaoEspessura, { chave: 'preenchida', tipo: 'booleano', rotulo: 'Preenchimento' }],
    },
    () => {
      let forma: ComandoForma | null = null;
      let mostrouPrevia = false;
      return {
        cursor: () => 'crosshair',
        onPointerDown(ctx, { ponto, botao, shift }) {
          ctx.selecionar(null);
          forma = {
            tipo: 'DesenharForma',
            forma: id,
            inicio: ponto,
            fim: ponto,
            cor: corDoBotao(ctx, botao),
            espessura: ctx.opcoes.espessura,
            preenchida: ctx.opcoes.preenchida,
            restringir: shift,
          };
          mostrouPrevia = false;
        },
        onPointerMove(_ctx, { ponto, shift }) {
          if (!forma) return;
          forma.fim = ponto;
          forma.restringir = shift;
          mostrouPrevia = true;
        },
        onPointerUp(ctx, { ponto, shift }) {
          if (!forma) return;
          const comando = { ...forma, fim: ponto, restringir: shift };
          forma = null;
          ctx.limparPrevia();
          ctx.executar(comando);
        },
        onCancel(ctx) {
          forma = null;
          ctx.limparPrevia();
        },
        overlay(_ctx, grafico) {
          if (forma && mostrouPrevia) desenharForma(grafico, forma);
        },
      };
    },
  );
}
