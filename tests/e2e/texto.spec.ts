import { expect, test, type Page } from '@playwright/test';

function posicao(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (elemento, ponto) => {
      const tela = elemento as HTMLCanvasElement;
      const caixa = tela.getBoundingClientRect();
      return {
        x: caixa.x + (ponto.x * caixa.width) / tela.width,
        y: caixa.y + (ponto.y * caixa.height) / tela.height,
      };
    },
    { x, y },
  );
}

function medirTinta(page: Page) {
  return page.locator('.drawing-canvas').evaluate((elemento) => {
    const tela = elemento as HTMLCanvasElement;
    const { data } = tela.getContext('2d')!.getImageData(0, 0, tela.width, tela.height);
    let quantidade = 0;
    let esquerda = tela.width;
    let topo = tela.height;
    let base = -1;
    for (let i = 0; i < data.length; i += 4) {
      if (!(data[i] < 195 && data[i + 1] < 235 && data[i + 2] > data[i + 1] + 5)) continue;
      const p = i / 4;
      const x = p % tela.width;
      const y = Math.floor(p / tela.width);
      quantidade++;
      esquerda = Math.min(esquerda, x);
      topo = Math.min(topo, y);
      base = Math.max(base, y);
    }
    return { quantidade, esquerda, topo, base };
  });
}

test('edita, formata e move texto com acentos em várias linhas antes de confirmar', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.keyboard.press('t');
  await expect(page.getByRole('tab', { name: 'Texto', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const inicio = await posicao(page, 180, 180);
  await page.mouse.click(inicio.x, inicio.y);
  const campo = page.getByRole('textbox', { name: 'Texto no desenho' });
  await expect(campo).toBeFocused();
  await campo.fill('Olá, coração!\nÇ, ã e café');
  await expect(campo).toHaveValue('Olá, coração!\nÇ, ã e café');
  await page.getByRole('button', { name: 'Negrito', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Negrito', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(campo).toBeVisible();

  const alca = await page
    .getByRole('button', { name: 'Mover caixa de texto', exact: true })
    .boundingBox();
  if (!alca) throw new Error('Alça de texto indisponível.');
  const destino = await posicao(page, 280, 240);
  await page.mouse.move(alca.x + 10, alca.y + 10);
  await page.mouse.down();
  await page.mouse.move(alca.x + 10 + destino.x - inicio.x, alca.y + 10 + destino.y - inicio.y, {
    steps: 8,
  });
  await page.mouse.up();
  expect((await medirTinta(page)).quantidade).toBe(0);

  const fora = await posicao(page, 640, 380);
  await page.mouse.click(fora.x, fora.y);
  await expect(campo).toHaveCount(0);
  const tinta = await medirTinta(page);
  expect(tinta.quantidade).toBeGreaterThan(50);
  expect(tinta.esquerda).toBeGreaterThan(270);
  expect(tinta.topo).toBeGreaterThan(235);
  expect(tinta.base - tinta.topo).toBeGreaterThan(30);
  await expect(page.locator('.history-list').getByText('Texto', { exact: true })).toBeVisible();

  await page.keyboard.press('Control+z');
  expect((await medirTinta(page)).quantidade).toBe(0);
  await page.keyboard.press('Control+y');
  expect(await medirTinta(page)).toEqual(tinta);
});
