import { expect, test } from '@playwright/test';

test('réguas criam guias no eixo girado e a miniatura navega em coordenadas do papel', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const tela = page.locator('.drawing-canvas');
  await tela.focus();
  await page.keyboard.press('Control+r');
  for (let i = 0; i < 6; i++) await page.keyboard.press('6');
  await expect(page.getByRole('button', { name: /↻ 90°/ })).toBeVisible();
  const topo = page.locator('.canvas-ruler-x');
  const lateral = page.locator('.canvas-ruler-y');
  await expect(topo).toHaveAttribute('data-eixo', 'y');
  await expect(lateral).toHaveAttribute('data-eixo', 'x');

  const papel = (await tela.boundingBox())!;
  const regua = (await topo.boundingBox())!;
  const largura = Number(await tela.getAttribute('width'));
  const altura = Number(await tela.getAttribute('height'));
  const zoom = papel.width / altura;
  await page.mouse.move(regua.x + regua.width / 2, regua.y + regua.height / 2);
  await page.mouse.down();
  await page.mouse.move(papel.x + papel.width / 2, papel.y + papel.height / 2 + 20 * zoom, {
    steps: 8,
  });
  await page.mouse.up();
  const guia = page.getByTestId('guia-vertical');
  await expect(guia).toHaveCount(1);
  expect(
    Math.abs(Number(await guia.getAttribute('data-valor')) - (largura / 2 + 20)),
  ).toBeLessThanOrEqual(1);

  await page.getByRole('tab', { name: 'Exibir', exact: true }).click();
  await page.getByText('Miniatura', { exact: true }).click();
  await page.getByRole('slider', { name: 'Zoom', exact: true }).fill('6');
  const workspace = page.getByLabel('Área de trabalho', { exact: true });
  await workspace.evaluate((elemento) => elemento.scrollTo(0, 0));
  const miniatura = page.getByLabel('Navegar pela miniatura do desenho', { exact: true });
  const mapa = (await miniatura.boundingBox())!;
  await page.mouse.click(mapa.x + mapa.width * 0.84, mapa.y + mapa.height * 0.16);
  await expect
    .poll(() => workspace.evaluate((elemento) => Math.min(elemento.scrollLeft, elemento.scrollTop)))
    .toBeGreaterThan(100);

  await tela.focus();
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: /espelhada/ })).toBeVisible();
  await expect(topo).toHaveAttribute('data-eixo', 'y');
  await expect(miniatura).toBeVisible();
});
