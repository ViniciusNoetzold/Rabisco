import { expect, test, type Page } from '@playwright/test';

async function cantos(page: Page) {
  return page.locator('.drawing-canvas').evaluate((tela: HTMLCanvasElement) => {
    const ctx = tela.getContext('2d')!;
    return [
      Array.from(ctx.getImageData(0, 0, 1, 1).data),
      Array.from(ctx.getImageData(tela.width - 1, tela.height - 1, 1, 1).data),
    ];
  });
}

test('balde em papel grande: calcula num worker, pinta o papel todo e desfaz', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  // 2000 × 1200 = 2,4 milhões de px: acima do limite em que o balde usa o worker.
  await page.keyboard.press('Control+n');
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Largura (px)', { exact: true }).fill('2000');
  await dialogo.getByLabel('Altura (px)', { exact: true }).fill('1200');
  await dialogo.getByRole('button', { name: 'Criar desenho', exact: true }).click();
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '2000');
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('f');
  const caixa = (await page.locator('.drawing-canvas').boundingBox())!;
  await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  const azul = [48, 131, 197, 255];
  await expect.poll(() => cantos(page), { timeout: 15_000 }).toEqual([azul, azul]);
  await expect(
    page.locator('.history-list').getByText('Preenchimento', { exact: true }),
  ).toHaveCount(1);
  // Depois de pronto, a tela aceita outro gesto e o desfazer volta ao branco.
  await page.keyboard.press('Control+z');
  const branco = [255, 255, 255, 255];
  await expect.poll(() => cantos(page)).toEqual([branco, branco]);
});
