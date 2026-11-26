import { expect, test, type Page } from '@playwright/test';

async function naTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

async function pixel(page: Page, x: number, y: number) {
  return page
    .locator('.drawing-canvas')
    .evaluate(
      (tela: HTMLCanvasElement, [px, py]) =>
        Array.from(tela.getContext('2d')!.getImageData(px, py, 1, 1).data),
      [x, y],
    );
}

/** Apagado: transparente (camada) ou branco. */
function apagado([r, g, b, a]: number[]) {
  return a === 0 || (r > 250 && g > 250 && b > 250);
}

async function arrastar(page: Page, de: [number, number], ate: [number, number], passos = 8) {
  const a = await naTela(page, ...de);
  const b = await naTela(page, ...ate);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: passos });
  await page.mouse.up();
}

async function clicar(page: Page, x: number, y: number, modificador?: 'Shift' | 'Alt') {
  const p = await naTela(page, x, y);
  if (modificador) await page.keyboard.down(modificador);
  await page.mouse.click(p.x, p.y);
  if (modificador) await page.keyboard.up(modificador);
}

async function abrir(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.locator('.drawing-canvas').focus();
}

/** Dois discos escuros (#252a34) de raio 50, centrados em (150, 150) e (350, 150). */
async function doisQuadrados(page: Page) {
  await page.keyboard.press('b');
  const espessura = page.getByRole('spinbutton', { name: 'Espessura do traço', exact: true });
  await espessura.fill('100');
  await espessura.press('Tab');
  await page.getByRole('button', { name: 'Usar cor #252a34' }).click();
  await page.locator('.drawing-canvas').focus();
  await arrastar(page, [150, 150], [151, 150], 1);
  await arrastar(page, [350, 150], [351, 150], 1);
}

const historico = (page: Page, rotulo: string) =>
  page.locator('.history-list').getByText(rotulo, { exact: true });

test('gradiente linear da Cor 1 à Cor 2, um item no histórico; com seleção, só dentro dela', async ({
  page,
}) => {
  await abrir(page);
  await page.keyboard.press('g');
  await expect(page.getByRole('combobox', { name: 'Forma do gradiente' })).toBeVisible();
  await arrastar(page, [100, 300], [900, 300]);
  await expect(historico(page, 'Gradiente')).toHaveCount(1);
  const esquerda = await pixel(page, 50, 300);
  const meio = await pixel(page, 500, 300);
  const direita = await pixel(page, 950, 300);
  // Cor 1 (azul #3083c5) à esquerda, Cor 2 (branco) à direita, mistura no meio.
  expect(esquerda.slice(0, 3)).toEqual([48, 131, 197]);
  expect(direita.slice(0, 3)).toEqual([255, 255, 255]);
  expect(meio[0]).toBeGreaterThan(130);
  expect(meio[0]).toBeLessThan(170);

  // Seleção retangular e gradiente radial: fora da seleção nada muda.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('s');
  await arrastar(page, [200, 200], [400, 400]);
  await page.keyboard.press('g');
  await page.getByRole('combobox', { name: 'Forma do gradiente' }).selectOption('radial');
  await page.locator('.drawing-canvas').focus();
  await arrastar(page, [300, 300], [400, 300]);
  // O centro do radial é a Cor 1 (o pixel fica a meio pixel do início: quase exato).
  const centro = await pixel(page, 300, 300);
  for (const [canal, esperado] of [48, 131, 197].entries())
    expect(Math.abs(centro[canal] - esperado)).toBeLessThanOrEqual(3);
  expect((await pixel(page, 150, 300)).slice(0, 3)).toEqual([255, 255, 255]);
});

test('varinha mágica: contígua, Shift soma, Alt subtrai; excluir apaga só o selecionado', async ({
  page,
}) => {
  await abrir(page);
  await doisQuadrados(page);
  await page.keyboard.press('w');
  await clicar(page, 150, 150);
  // Só o quadrado da esquerda: a caixa da seleção tem o tamanho dele.
  const marquise = page.locator('.selection-marquee');
  await expect(marquise).toBeVisible();
  const caixa1 = (await marquise.boundingBox())!;
  await clicar(page, 350, 150, 'Shift');
  const caixa2 = (await marquise.boundingBox())!;
  expect(caixa2.width).toBeGreaterThan(caixa1.width * 2);
  // Alt no da esquerda: sobra só o da direita.
  await clicar(page, 150, 150, 'Alt');
  await page.keyboard.press('Delete');
  await expect.poll(async () => apagado(await pixel(page, 350, 150))).toBe(true);
  expect((await pixel(page, 150, 150)).slice(0, 3)).toEqual([37, 42, 52]);
});

test('seleção elíptica: excluir apaga dentro da elipse, não a caixa inteira', async ({ page }) => {
  await abrir(page);
  await doisQuadrados(page);
  await page.getByRole('button', { name: 'Opções de seleção' }).click();
  await page.getByRole('button', { name: 'Seleção elíptica' }).click();
  await page.locator('.drawing-canvas').focus();
  // Elipse de (120, 100) a (380, 200): no meio alcança x = 380; perto do topo é bem mais estreita.
  await arrastar(page, [120, 100], [380, 200]);
  await page.keyboard.press('Delete');
  await expect.poll(async () => apagado(await pixel(page, 340, 150))).toBe(true);
  // (335, 108): dentro da caixa e do disco da direita, fora da elipse (lá ela vai até x ≈ 320).
  expect((await pixel(page, 335, 108)).slice(0, 3)).toEqual([37, 42, 52]);
});

test('dedo (borrar): arrasta o escuro para o branco, num item "Dedo"', async ({ page }) => {
  await abrir(page);
  await doisQuadrados(page);
  await page.getByRole('button', { name: 'Galeria de pincéis' }).click();
  await page.getByRole('menuitemradio', { name: 'Dedo (borrar)' }).click();
  // Espessura de 100 px (a dos discos).
  await page.getByRole('slider', { name: 'Força do dedo' }).fill('90');
  expect((await pixel(page, 225, 150)).slice(0, 3)).toEqual([255, 255, 255]);
  await page.locator('.drawing-canvas').focus();
  await arrastar(page, [170, 150], [260, 150], 20);
  await expect(historico(page, 'Dedo')).toHaveCount(1);
  const [r] = await pixel(page, 225, 150);
  expect(r).toBeLessThan(200);
  expect((await pixel(page, 150, 60)).slice(0, 3)).toEqual([255, 255, 255]);
});
