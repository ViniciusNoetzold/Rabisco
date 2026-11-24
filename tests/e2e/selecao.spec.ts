import { expect, test, type Page } from '@playwright/test';

async function posicao(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (el, ponto) => {
      const tela = el as HTMLCanvasElement;
      const caixa = tela.getBoundingClientRect();
      return {
        x: caixa.x + (ponto.x * caixa.width) / tela.width,
        y: caixa.y + (ponto.y * caixa.height) / tela.height,
      };
    },
    { x, y },
  );
}

async function arrastar(page: Page, pontos: [number, number][]) {
  const [inicio, ...resto] = pontos;
  const p = await posicao(page, ...inicio);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (const ponto of resto) {
    const destino = await posicao(page, ...ponto);
    await page.mouse.move(destino.x, destino.y, { steps: 6 });
  }
  await page.mouse.up();
}

function pixel(page: Page, x: number, y: number) {
  return page
    .locator('.drawing-canvas')
    .evaluate(
      (el, p) =>
        Array.from((el as HTMLCanvasElement).getContext('2d')!.getImageData(p.x, p.y, 1, 1).data),
      { x, y },
    );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
});

test('o laço exclui a região traçada e preserva pixels fora dela', async ({ page }) => {
  await page.keyboard.press('l');
  await arrastar(page, [
    [180, 160],
    [330, 160],
    [180, 320],
    [180, 160],
  ]);
  await expect(page.locator('.selection-marquee')).toBeVisible();
  await page.keyboard.press('Delete');
  expect((await pixel(page, 200, 180))[3]).toBe(0);
  expect((await pixel(page, 300, 280))[3]).toBe(255);
  await page.keyboard.press('Control+z');
  expect((await pixel(page, 200, 180))[3]).toBe(255);
});

test('ao mover a seleção transparente, a Cor 2 deixa o fundo de destino visível', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Retângulo', exact: true }).click();
  await page.getByRole('button', { name: 'Selecionar Cor 2', exact: true }).click();
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  await page.getByRole('combobox', { name: 'Preenchimento', exact: true }).selectOption('solid');
  await arrastar(page, [
    [420, 160],
    [560, 300],
  ]);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Usar cor #ffffff', exact: true }).click();
  await page.keyboard.press('b');
  await arrastar(page, [
    [175, 200],
    [185, 200],
  ]);
  await page.getByRole('button', { name: 'Opções de seleção' }).click();
  await page.getByRole('checkbox', { name: 'Seleção transparente' }).check();
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await arrastar(page, [
    [155, 160],
    [235, 240],
  ]);
  await arrastar(page, [
    [180, 200],
    [470, 220],
  ]);
  expect((await pixel(page, 470, 220)).slice(0, 3)).toEqual([48, 131, 197]);
  expect((await pixel(page, 500, 220)).slice(0, 3)).toEqual([226, 75, 75]);
  expect((await pixel(page, 200, 200)).slice(0, 3)).toEqual([255, 255, 255]);
  await expect(
    page.locator('.history-list').getByText('Mover seleção', { exact: true }),
  ).toBeVisible();
});
