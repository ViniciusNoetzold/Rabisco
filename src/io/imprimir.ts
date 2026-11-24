import { DPI_PADRAO, dpiValido } from '../document/dimensoes';
import { exportarImagem } from './imagens';
import './imprimir.css';

export interface OpcoesImpressao {
  orientacao: 'retrato' | 'paisagem';
  ajustar: boolean;
  centralizar: boolean;
}

let imprimindo = false;

/** Prepara uma cópia sem a interface e deixa o navegador cuidar da impressão. */
export async function imprimirImagem(
  canvas: HTMLCanvasElement,
  dpi: number,
  { orientacao, ajustar, centralizar }: OpcoesImpressao,
): Promise<void> {
  if (imprimindo) throw new Error('Já existe uma impressão em andamento.');
  imprimindo = true;

  const folha = document.createElement('div');
  folha.classList.add('rabisco-folha-impressao');
  if (ajustar) folha.classList.add('folha-ajustada');
  if (centralizar) folha.classList.add('folha-centralizada');

  const layout = document.createElement('style');
  const sentido = orientacao === 'paisagem' ? 'landscape' : 'portrait';
  layout.textContent = `@media print { @page { size: ${sentido}; margin: 0; } }`;
  let url: string | undefined;

  function limpar() {
    window.removeEventListener('afterprint', limpar);
    document.body.classList.remove('rabisco-imprimindo');
    folha.remove();
    layout.remove();
    if (url) URL.revokeObjectURL(url);
    imprimindo = false;
  }

  try {
    const resolucao = dpiValido(dpi) ? dpi : DPI_PADRAO;
    const imagem = new Image();
    url = URL.createObjectURL(await exportarImagem(canvas, 'png', undefined, resolucao));
    imagem.src = url;
    imagem.alt = 'Desenho do Rabisco';
    imagem.style.setProperty('--impressao-largura', `${(canvas.width / resolucao) * 25.4}mm`);
    imagem.style.setProperty('--impressao-altura', `${(canvas.height / resolucao) * 25.4}mm`);
    await imagem.decode();

    folha.append(imagem);
    document.head.append(layout);
    document.body.append(folha);
    document.body.classList.add('rabisco-imprimindo');
    window.addEventListener('afterprint', limpar, { once: true });
    window.print();
  } catch (erro) {
    limpar();
    throw erro;
  }
}
