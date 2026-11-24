import { expect, test, type Page } from '@playwright/test';

const AZUL = [48, 131, 197, 255];
const AZUL_PROXIMO = [54, 144, 190, 255];
const VERMELHO = [226, 75, 75, 255];
const VERDE = [112, 165, 74, 255];
const BRANCO = [255, 255, 255, 255];

async function prepararPapel(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const png = await page.evaluate(() => {
    const tela = document.createElement('canvas');
    tela.width = 340;
    tela.height = 220;
    const ctx = tela.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.fillStyle = '#3083c5';
    ctx.fillRect(44, 50, 67, 45);
    ctx.fillRect(210, 50, 70, 45);
    ctx.fillStyle = '#3690be';
    ctx.fillRect(111, 50, 67, 45);
    ctx.fillStyle = '#e24b4b';
    ctx.fillRect(44, 95, 134, 50);
    return tela.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Abrir arquivo PNG', { exact: true }).setInputFiles({
    name: 'Teste das ferramentas.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '340');
}

async function ponto(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (elemento, ponto) => {
      const tela = elemento as HTMLCanvasElement;
      const caixa = tela.getBoundingClientRect();
      return {
        x: caixa.left + (ponto.x * caixa.width) / tela.width,
        y: caixa.top + (ponto.y * caixa.height) / tela.height,
      };
    },
    { x: x + 0.5, y: y + 0.5 },
  );
}

async function clicar(page: Page, x: number, y: number, botao: 'left' | 'right' = 'left') {
  const cursor = await ponto(page, x, y);
  await page.mouse.click(cursor.x, cursor.y, { button: botao });
}

function pixel(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (elemento, ponto) => {
      const tela = elemento as HTMLCanvasElement;
      return [...tela.getContext('2d')!.getImageData(ponto.x, ponto.y, 1, 1).data];
    },
    { x, y },
  );
}

function temOverlay(page: Page) {
  return page.locator('.preview-canvas').evaluate((elemento) => {
    const tela = elemento as HTMLCanvasElement;
    const { data } = tela.getContext('2d')!.getImageData(0, 0, tela.width, tela.height);
    return data.some((canal, indice) => indice % 4 === 3 && canal > 0);
  });
}

test('mostra a área da borracha e troca só a Cor 1 com o botão direito', async ({ page }) => {
  await prepararPapel(page);
  await page.getByRole('button', { name: 'Selecionar Cor 2', exact: true }).click();
  await page.getByRole('button', { name: 'Usar cor #70a54a', exact: true }).click();
  await page.getByRole('button', { name: 'Selecionar Cor 1', exact: true }).click();
  await page.getByRole('button', { name: 'Borracha (E)', exact: true }).click();
  await page.getByRole('button', { name: 'Borracha de 32 px', exact: true }).click();
  await expect(page.locator('.drawing-canvas')).toHaveCSS('cursor', 'none');

  const cursor = await ponto(page, 100, 97);
  await page.mouse.move(cursor.x, cursor.y);
  await expect.poll(() => temOverlay(page)).toBe(true);
  expect(await pixel(page, 100, 90)).toEqual(AZUL);

  await page.mouse.down({ button: 'right' });
  await expect.poll(() => pixel(page, 100, 90)).toEqual(VERDE);
  expect(await pixel(page, 100, 100)).toEqual(VERMELHO);
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => pixel(page, 100, 90)).toEqual(VERDE);

  await page.keyboard.press('Control+z');
  await expect.poll(() => pixel(page, 100, 90)).toEqual(AZUL);
  await clicar(page, 100, 97);
  await expect.poll(() => pixel(page, 100, 100)).toEqual(VERDE);
  await page.mouse.move(4, 4);
  await expect.poll(() => temOverlay(page)).toBe(false);
});

test('ajusta a tolerância do balde e alcança ilhas de cor quando solicitado', async ({ page }) => {
  await prepararPapel(page);
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  await page.getByRole('button', { name: 'Balde (F)', exact: true }).click();
  const tolerancia = page.getByRole('slider', { name: 'Tolerância do balde', exact: true });
  await tolerancia.press('Home');
  await clicar(page, 60, 65);
  await expect.poll(() => pixel(page, 60, 65)).toEqual(VERMELHO);
  expect(await pixel(page, 140, 65)).toEqual(AZUL_PROXIMO);
  await page.keyboard.press('Control+z');
  await expect.poll(() => pixel(page, 60, 65)).toEqual(AZUL);

  await tolerancia.press('PageUp');
  await expect(tolerancia).toHaveValue('10');
  await clicar(page, 60, 65);
  await expect.poll(() => pixel(page, 140, 65)).toEqual(VERMELHO);
  expect(await pixel(page, 240, 65)).toEqual(AZUL);
  await page.keyboard.press('Control+z');
  await expect.poll(() => pixel(page, 60, 65)).toEqual(AZUL);

  await page.getByRole('checkbox', { name: 'Preencher cor em toda a imagem' }).check();
  await clicar(page, 60, 65);
  await expect.poll(() => pixel(page, 240, 65)).toEqual(VERMELHO);
  expect(await pixel(page, 140, 65)).toEqual(VERMELHO);
  expect(await pixel(page, 195, 65)).toEqual(BRANCO);
});

test('amplia o pixel no conta-gotas e volta à ferramenta anterior nas duas cores', async ({
  page,
}) => {
  await prepararPapel(page);
  const lapis = page.getByRole('button', { name: 'Lápis (P)', exact: true });
  const contaGotas = page.getByRole('button', { name: 'Conta-gotas (I)', exact: true });
  const cor1 = page.getByRole('button', { name: 'Selecionar Cor 1', exact: true });
  const cor2 = page.getByRole('button', { name: 'Selecionar Cor 2', exact: true });
  await lapis.click();
  await cor2.click();
  await contaGotas.click();
  const cursor = await ponto(page, 100, 115);
  await page.mouse.move(cursor.x, cursor.y);
  await expect.poll(() => temOverlay(page)).toBe(true);
  await clicar(page, 100, 115);
  await expect(cor1.locator('span').first()).toHaveCSS('background-color', 'rgb(226, 75, 75)');
  await expect(cor2).toHaveAttribute('aria-pressed', 'true');
  await expect(lapis).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => temOverlay(page)).toBe(false);

  await contaGotas.click();
  await clicar(page, 140, 65, 'right');
  await expect(cor2.locator('span').first()).toHaveCSS('background-color', 'rgb(54, 144, 190)');
  await expect(lapis).toHaveAttribute('aria-pressed', 'true');
});
