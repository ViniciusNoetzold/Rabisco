import type { RabiscoDocument } from '../../document/model';
import type { OpcoesExportacao } from '../../io/imagens';
import type { OpcoesImpressao } from '../../io/imprimir';
import { exportPng } from '../../io/png';

/** Salvar PNG, salvar em outros formatos e imprimir. Os codificadores carregam sob demanda. */
export async function salvarPng(doc: RabiscoDocument, tela: HTMLCanvasElement) {
  await exportPng(tela, doc.name, doc.dpi);
}

export async function salvarComo(
  doc: RabiscoDocument,
  tela: HTMLCanvasElement,
  { nome, formato, qualidade }: OpcoesExportacao,
) {
  const { exportarImagem, baixarImagem } = await import('../../io/imagens');
  const blob = await exportarImagem(tela, formato, qualidade, doc.dpi);
  baixarImagem(blob, nome, formato);
}

export async function imprimir(
  doc: RabiscoDocument,
  tela: HTMLCanvasElement,
  opcoes: OpcoesImpressao,
) {
  const { imprimirImagem } = await import('../../io/imprimir');
  await imprimirImagem(tela, doc.dpi, opcoes);
}

export async function lerArquivoDeImagem(arquivo: File) {
  const { abrirImagem } = await import('../../io/imagens');
  return abrirImagem(arquivo);
}
