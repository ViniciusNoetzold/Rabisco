import { expect, test, type Page } from '@playwright/test';

async function pontoNaTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

async function arrastar(page: Page, de: [number, number], ate: [number, number], soltar = true) {
  const a = await pontoNaTela(page, ...de);
  const b = await pontoNaTela(page, ...ate);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 20 });
  if (soltar) await page.mouse.up();
}

async function vermelhos(page: Page) {
  return page.locator('.drawing-canvas').evaluate((tela: HTMLCanvasElement) => {
    const ctx = tela.getContext('2d')!;
    return [225, 799].map((x) => ctx.getImageData(x, 300, 1, 1).data[0]);
  });
}

test('dedo espelhado usa a mesma prévia, desfaz junto e respeita a seleção', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Exibir' }).click();
  await page.getByRole('combobox', { name: 'Modo de simetria' }).selectOption('vertical');
  await page.getByRole('tab', { name: 'Início' }).click();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('b');
  const espessura = page.getByRole('spinbutton', { name: 'Espessura do traço', exact: true });
  await espessura.fill('100');
  await espessura.press('Tab');
  await page.getByRole('button', { name: 'Usar cor #252a34' }).click();
  await arrastar(page, [150, 300], [151, 300]);
  await page.getByRole('button', { name: 'Galeria de pincéis' }).click();
  await page.getByRole('menuitemradio', { name: 'Dedo (borrar)' }).click();
  await page.getByRole('slider', { name: 'Força do dedo' }).fill('90');
  expect(await vermelhos(page)).toEqual([255, 255]);

  await arrastar(page, [170, 300], [260, 300], false);
  const previa = await vermelhos(page);
  expect(previa[0]).toBeLessThan(200);
  expect(previa[1]).toBeLessThan(200);
  await page.mouse.up();
  expect(await vermelhos(page)).toEqual(previa);
  await expect(page.locator('.history-list').getByText('Dedo', { exact: true })).toHaveCount(1);
  await page.keyboard.press('Control+z');
  expect(await vermelhos(page)).toEqual([255, 255]);

  await page.keyboard.press('s');
  await arrastar(page, [100, 245], [280, 355]);
  await page.keyboard.press('b');
  await arrastar(page, [170, 300], [260, 300]);
  const [esquerda, direita] = await vermelhos(page);
  expect(esquerda).toBeLessThan(200);
  expect(direita).toBe(255);
});
