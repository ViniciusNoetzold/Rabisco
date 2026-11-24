import { expect, test } from '@playwright/test';

/** Lê um pixel da tela de desenho. */
async function pixel(page: import('@playwright/test').Page, x: number, y: number) {
  return page
    .locator('.drawing-canvas')
    .evaluate(
      (tela: HTMLCanvasElement, [px, py]) =>
        Array.from(tela.getContext('2d')!.getImageData(px, py, 1, 1).data),
      [x, y],
    );
}

test('converte o desenho salvo pela versão 0.2 em blocos sem perder os pixels', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();

  // Simula o registro da 0.2: pixels inteiros na tabela antiga e nenhum papel em blocos.
  await page.evaluate(async () => {
    const banco = await new Promise<IDBDatabase>((resolver, rejeitar) => {
      const pedido = indexedDB.open('rabisco-documentos');
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => rejeitar(pedido.error);
    });
    const largura = 300;
    const altura = 200;
    const pixels = new Uint8ClampedArray(largura * altura * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set([255, 255, 255, 255], i);
    // Um quadrado vermelho que atravessa a divisa entre dois blocos (x = 256).
    for (let y = 50; y < 60; y++)
      for (let x = 250; x < 262; x++) pixels.set([200, 30, 40, 255], (y * largura + x) * 4);
    await new Promise<void>((resolver, rejeitar) => {
      const transacao = banco.transaction(['documents', 'papeis', 'blocos'], 'readwrite');
      transacao.objectStore('papeis').clear();
      transacao.objectStore('blocos').clear();
      transacao.objectStore('documents').put({
        id: 'current',
        name: 'Desenho da 0.2',
        width: largura,
        height: altura,
        pixels,
        updatedAt: Date.now(),
      });
      transacao.oncomplete = () => resolver();
      transacao.onerror = () => rejeitar(transacao.error);
    });
    banco.close();
  });

  await page.reload();
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '300');
  await expect(page).toHaveTitle(/Desenho da 0\.2/);
  expect(await pixel(page, 255, 55)).toEqual([200, 30, 40, 255]);
  expect(await pixel(page, 258, 55)).toEqual([200, 30, 40, 255]);
  expect(await pixel(page, 10, 10)).toEqual([255, 255, 255, 255]);

  // O registro antigo some e o papel passa a existir em blocos.
  const estado = await page.evaluate(async () => {
    const banco = await new Promise<IDBDatabase>((resolver) => {
      const pedido = indexedDB.open('rabisco-documentos');
      pedido.onsuccess = () => resolver(pedido.result);
    });
    const contar = (loja: string) =>
      new Promise<number>((resolver) => {
        const pedido = banco.transaction(loja).objectStore(loja).count();
        pedido.onsuccess = () => resolver(pedido.result);
      });
    const resultado = {
      antigos: await contar('documents'),
      papeis: await contar('papeis'),
      blocos: await contar('blocos'),
    };
    banco.close();
    return resultado;
  });
  expect(estado).toEqual({ antigos: 0, papeis: 1, blocos: 2 });

  // E continua recuperando depois de mais uma abertura.
  await page.reload();
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  expect(await pixel(page, 258, 55)).toEqual([200, 30, 40, 255]);
});
