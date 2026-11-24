import type { BrowserContext } from '@playwright/test';

export async function isolarAreaDeTransferencia(contexto: BrowserContext) {
  await contexto.addInitScript(() => {
    let itens: ClipboardItem[] = [];

    // Mantém a codificação e a leitura de ClipboardItem sem acessar a área do sistema.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => [...itens],
        write: async (novos: ClipboardItem[]) => {
          await Promise.all(novos.flatMap((item) => item.types.map((tipo) => item.getType(tipo))));
          itens = [...novos];
        },
      },
    });
  });
}
