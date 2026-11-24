const PNG = 'image/png';

const EXTENSOES_POR_TIPO: Readonly<Record<string, string>> = {
  [PNG]: 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

function eImagem(arquivo: File): boolean {
  return (
    arquivo.type.startsWith('image/') || /\.(?:png|jpe?g|gif|bmp|webp|ico)$/i.test(arquivo.name)
  );
}

/** Lê arquivos tanto do evento de colagem quanto do de soltar. A abertura valida o conteúdo. */
export function imagemDaTransferencia(dados: DataTransfer | null): File | null {
  if (!dados) return null;
  for (const arquivo of dados.files) {
    if (eImagem(arquivo)) return arquivo;
  }
  for (const item of dados.items) {
    if (item.kind !== 'file') continue;
    const arquivo = item.getAsFile();
    if (arquivo && eImagem(arquivo)) return arquivo;
  }
  return null;
}

export async function lerImagemClipboard(): Promise<File | null> {
  try {
    const clipboard = globalThis.navigator?.clipboard;
    if (typeof clipboard?.read !== 'function') return null;
    const itens = await clipboard.read();
    for (const item of itens) {
      const tipos = item.types.filter((tipo) => tipo.startsWith('image/'));
      if (tipos.includes(PNG)) tipos.sort((a, b) => Number(b === PNG) - Number(a === PNG));
      for (const tipo of tipos) {
        try {
          const blob = await item.getType(tipo);
          const extensao = EXTENSOES_POR_TIPO[tipo] ?? 'imagem';
          return new File([blob], `Área de transferência.${extensao}`, { type: tipo });
        } catch {
          // Outra representação do mesmo item ainda pode estar disponível.
        }
      }
    }
  } catch {
    // O navegador pode negar o acesso direto à área de transferência.
  }
  return null;
}

export async function copiarImagemClipboard(canvas: HTMLCanvasElement): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard;
  if (typeof clipboard?.write !== 'function' || typeof ClipboardItem !== 'function') {
    throw new Error('A área de transferência do sistema está indisponível neste navegador.');
  }

  // A escrita começa durante o gesto do usuário, enquanto o PNG é codificado.
  const png = new Promise<Blob>((resolver, rejeitar) => {
    canvas.toBlob((blob) => {
      if (blob) resolver(blob);
      else rejeitar(new Error('Não foi possível preparar o PNG para copiar.'));
    }, PNG);
  });
  void png.catch(() => undefined);
  await clipboard.write([new ClipboardItem({ [PNG]: png })]);
}
