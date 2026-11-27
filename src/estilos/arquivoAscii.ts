import { htmlAscii, textoAscii, type ArteAscii } from './ascii';
import { renderizarCamadaAscii } from './camadaAscii';

export type FormatoAscii = 'txt' | 'html' | 'png';

function superficieDoDialogo(): HTMLElement {
  return document.querySelector<HTMLDialogElement>('dialog[open]') ?? document.body;
}

export async function copiarArteAscii(arte: ArteAscii): Promise<void> {
  const texto = textoAscii(arte);
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return;
    } catch {
      // Na prévia HTTP da rede, use a seleção de um campo para copiar.
    }
  }
  const anterior = document.activeElement;
  const campo = document.createElement('textarea');
  campo.value = texto;
  campo.readOnly = true;
  campo.style.cssText = 'position:fixed;left:-10000px;top:0';
  superficieDoDialogo().append(campo);
  campo.focus({ preventScroll: true });
  campo.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Não foi possível copiar a arte ASCII.');
  } finally {
    campo.remove();
    if (anterior instanceof HTMLElement) anterior.focus({ preventScroll: true });
  }
}

async function criarBlob(arte: ArteAscii, formato: FormatoAscii): Promise<Blob> {
  if (formato === 'html') return new Blob([htmlAscii(arte)], { type: 'text/html;charset=utf-8' });
  if (formato === 'txt') return new Blob([textoAscii(arte)], { type: 'text/plain;charset=utf-8' });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, arte.colunas * 8);
  canvas.height = Math.max(1, arte.linhas.length * 14);
  const contexto = canvas.getContext('2d')!;
  renderizarCamadaAscii(contexto, {
    arte,
    area: { x: 0, y: 0, width: canvas.width, height: canvas.height },
  });
  return new Promise((resolver, rejeitar) => {
    canvas.toBlob((blob) => {
      if (blob) resolver(blob);
      else rejeitar(new Error('Não foi possível criar o PNG da arte ASCII.'));
    }, 'image/png');
  });
}

export async function exportarArteAscii(arte: ArteAscii, formato: FormatoAscii): Promise<void> {
  const blob = await criarBlob(arte, formato);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `arte-ascii.${formato}`;
  superficieDoDialogo().append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
