import type { RabiscoDocument } from '../../document/model';
import { useEditor } from '../../app/store';
import { identificarArquivoDeCamadas } from '../../io/formatosImagem';
import type { FormatoExportacao, OpcoesExportacao } from '../../io/imagens';
import type { OpcoesImpressao } from '../../io/imprimir';
import { exportPng } from '../../io/png';

/** Salvar PNG, salvar em outros formatos e imprimir. Os codificadores carregam sob demanda. */
export async function salvarPng(doc: RabiscoDocument, tela: HTMLCanvasElement) {
  await exportPng(tela, doc.name, doc.dpi);
}

export async function salvarComo(
  doc: RabiscoDocument,
  tela: HTMLCanvasElement,
  { nome, formato, qualidade, escala }: OpcoesExportacao & { formato: FormatoExportacao },
) {
  const { exportarImagem, baixarImagem } = await import('../../io/imagens');
  const blob = await exportarImagem(tela, formato, qualidade, doc.dpi, escala);
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

/** Gera e baixa um arquivo com camadas (.rabisco, .ora, .psd ou as camadas em PNG). */
export async function salvarCamadas(
  doc: RabiscoDocument,
  formato: import('../../io/camadas').FormatoCamadas,
  nome = doc.name,
) {
  const { exportarCamadas, EXTENSOES_CAMADAS } = await import('../../io/camadas');
  const blob = await exportarCamadas(doc, formato, useEditor.getState().guiasDoPapel);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const nomeSeguro =
    nome
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .trim()
      .replace(/\.(rabisco|ora|psd|zip|png)$/i, '') || 'Meu rabisco';
  link.href = url;
  link.download = `${nomeSeguro}.${EXTENSOES_CAMADAS[formato]}`;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return blob;
}

/** O arquivo guarda camadas? (pela extensão ou pelo começo do conteúdo: ZIP ou PSD). */
export async function temCamadas(arquivo: File) {
  if (/\.(rabisco|ora|psd)$/i.test(arquivo.name)) return true;
  const inicio = new Uint8Array(await arquivo.slice(0, 4).arrayBuffer());
  return identificarArquivoDeCamadas(inicio) !== null;
}

export async function lerArquivoComCamadas(arquivo: File) {
  const { importarCamadas } = await import('../../io/camadas');
  return importarCamadas(arquivo);
}

export async function lerArquivoDeImagem(arquivo: File) {
  const { abrirImagem } = await import('../../io/imagens');
  return abrirImagem(arquivo);
}
