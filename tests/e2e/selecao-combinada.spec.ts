import { expect, test, type Page } from '@playwright/test';

type Ponto = [number, number];

async function posicao(page: Page, [x, y]: Ponto) {
  return page.locator('.drawing-canvas').evaluate(
    (tela: HTMLCanvasElement, ponto) => {
      const caixa = tela.getBoundingClientRect();
      return {
        x: caixa.x + (ponto.x * caixa.width) / tela.width,
        y: caixa.y + (ponto.y * caixa.height) / tela.height,
      };
    },
    { x, y },
  );
}

async function arrastar(page: Page, pontos: Ponto[], modificador?: 'Shift' | 'Alt') {
  const [inicio, ...resto] = pontos;
  const p = await posicao(page, inicio);
  await page.mouse.move(p.x, p.y);
  if (modificador) await page.keyboard.down(modificador);
  await page.mouse.down();
  for (const ponto of resto) {
    const destino = await posicao(page, ponto);
    await page.mouse.move(destino.x, destino.y, { steps: 6 });
  }
  await page.mouse.up();
  if (modificador) await page.keyboard.up(modificador);
}

async function alfa(page: Page, ponto: Ponto) {
  return page
    .locator('.drawing-canvas')
    .evaluate(
      (tela: HTMLCanvasElement, [x, y]) => tela.getContext('2d')!.getImageData(x, y, 1, 1).data[3],
      ponto,
    );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.locator('.drawing-canvas').focus();
});

test('retângulos somam regiões separadas e Alt abre um buraco sem mover o desenho', async ({
  page,
}) => {
  await page.keyboard.press('s');
  await arrastar(page, [
    [120, 120],
    [250, 250],
  ]);
  await arrastar(
    page,
    [
      [360, 120],
      [480, 240],
    ],
    'Shift',
  );
  await arrastar(
    page,
    [
      [160, 160],
      [210, 210],
    ],
    'Alt',
  );
  await page.keyboard.press('Delete');
  await expect.poll(() => alfa(page, [140, 140])).toBe(0);
  expect(await alfa(page, [420, 180])).toBe(0);
  expect(await alfa(page, [180, 180])).toBe(255);
  expect(await alfa(page, [300, 180])).toBe(255);
});

test('Shift durante o gesto faz círculo e Shift no início soma uma elipse livre', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Opções de seleção' }).click();
  await page.getByRole('button', { name: 'Seleção elíptica' }).click();
  const inicio = await posicao(page, [100, 100]);
  const fim = await posicao(page, [150, 250]);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(fim.x, fim.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const caixa = await page.locator('.selection-marquee').boundingBox();
  expect(Math.abs(caixa!.width - caixa!.height)).toBeLessThan(2);

  await arrastar(
    page,
    [
      [380, 100],
      [500, 150],
    ],
    'Shift',
  );
  await page.keyboard.press('Delete');
  await expect.poll(() => alfa(page, [175, 175])).toBe(0);
  expect(await alfa(page, [440, 125])).toBe(0);
  expect(await alfa(page, [440, 185])).toBe(255);
});

test('laço combina contornos e Esc durante o traçado preserva a área anterior', async ({
  page,
}) => {
  await page.keyboard.press('s');
  await arrastar(page, [
    [100, 100],
    [260, 260],
  ]);
  await page.keyboard.press('l');
  await arrastar(
    page,
    [
      [150, 150],
      [220, 150],
      [150, 220],
      [150, 150],
    ],
    'Alt',
  );
  await arrastar(
    page,
    [
      [350, 100],
      [450, 100],
      [350, 200],
      [350, 100],
    ],
    'Shift',
  );

  const inicio = await posicao(page, [510, 100]);
  const meio = await posicao(page, [580, 100]);
  const fim = await posicao(page, [510, 170]);
  await page.mouse.move(inicio.x, inicio.y);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(meio.x, meio.y, { steps: 4 });
  await page.mouse.move(fim.x, fim.y, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.keyboard.press('Delete');
  await expect.poll(() => alfa(page, [135, 135])).toBe(0);
  expect(await alfa(page, [160, 160])).toBe(255);
  expect(await alfa(page, [370, 120])).toBe(0);
  expect(await alfa(page, [430, 170])).toBe(255);
  expect(await alfa(page, [520, 110])).toBe(255);
});
