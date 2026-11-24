import type { useEditor } from '../../app/store';
import type { ToolCtx } from '../../tools/tool';

type EstadoEditor = ReturnType<typeof useEditor.getState>;

/** Traduz as opções da interface (ribbon, painel) para o que as ferramentas recebem. */
export function opcoesDaFerramenta(estado: EstadoEditor): ToolCtx['opcoes'] {
  const { formaPropria } = estado;
  return {
    cor1: estado.color1,
    cor2: estado.color2,
    espessura: estado.size,
    espessuraBorracha: estado.espessuraBorracha,
    toleranciaBorracha: estado.toleranciaBorracha,
    toleranciaBalde: estado.toleranciaBalde,
    preenchimentoGlobal: estado.preenchimentoGlobal,
    pincel: estado.pincel,
    densidadeSpray: estado.densidadeSpray,
    forma: formaPropria ? `propria:${formaPropria.id}` : estado.forma,
    definicaoForma: formaPropria
      ? { nome: formaPropria.nome, path: formaPropria.path, fechada: formaPropria.fechada }
      : undefined,
    contornoForma: estado.contornoForma,
    preenchimentoForma: estado.preenchimentoForma,
    parametrosForma: estado.parametrosForma,
    selecaoTransparente: estado.selecaoTransparente,
    zoom: estado.zoom,
  };
}
