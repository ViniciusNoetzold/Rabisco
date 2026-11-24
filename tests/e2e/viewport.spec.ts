import { expect, test } from '@playwright/test';

test('exibe a grade de pixels a 400% e F11 mostra apenas o papel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('slider', { name: 'Zoom', exact: true }).fill('6');
  await expect(page.getByRole('slider', { name: 'Zoom', exact: true })).toHaveAttribute(
    'aria-valuetext',
    '400%',
  );
  await expect(page.locator('.grade-de-pixels')).toBeVisible();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('F11');
  await expect(page.locator('[data-tela-inteira]')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Início', exact: true })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tab', { name: 'Início', exact: true })).toBeVisible();
});

test('as réguas acompanham o papel e a miniatura navega pela área ampliada', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Exibir', exact: true }).click();
  await page.keyboard.press('Control+r');
  const reguaX = page.locator('.canvas-ruler-x');
  const reguaY = page.locator('.canvas-ruler-y');
  await expect(reguaX).toBeVisible();
  await expect(reguaY).toBeVisible();

  const ampliar = page.getByRole('button', { name: 'Ampliar', exact: true });
  await ampliar.click();
  await ampliar.click();
  const workspace = page.getByLabel('Área de trabalho', { exact: true });
  await expect
    .poll(() => workspace.evaluate((elemento) => elemento.scrollWidth - elemento.clientWidth))
    .toBeGreaterThan(300);
  await page.getByText('Miniatura', { exact: true }).click();
  const mapa = page.getByLabel('Navegar pela miniatura do desenho', { exact: true });
  await expect(mapa).toBeVisible();
  await workspace.evaluate(async (elemento) => {
    elemento.scrollTo(0, 0);
    await new Promise<void>((resolver) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolver())),
    );
  });
  await page.mouse.move(1, 1);
  const origemX = (await reguaX.boundingBox())?.x;
  const quadro = await mapa.boundingBox();
  if (!quadro) throw new Error('Miniatura indisponível.');
  const retratoDaRegua = () => reguaX.evaluate((tela) => (tela as HTMLCanvasElement).toDataURL());
  const inicial = await retratoDaRegua();

  await page.mouse.move(quadro.x + quadro.width * 0.18, quadro.y + quadro.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(quadro.x + quadro.width * 0.56, quadro.y + quadro.height * 0.48, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(() => workspace.evaluate((elemento) => elemento.scrollLeft))
    .toBeGreaterThan(100);
  await expect.poll(retratoDaRegua).not.toBe(inicial);
  expect((await reguaX.boundingBox())?.x).toBe(origemX);

  await page.getByRole('button', { name: 'Fechar miniatura', exact: true }).click();
  await expect(mapa).toHaveCount(0);
});
