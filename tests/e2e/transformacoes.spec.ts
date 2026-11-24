import { expect, test, type Page } from '@playwright/test';

const branco = [255, 255, 255, 255];
const vermelho = [226, 75, 75, 255];

async function abrirAmostra(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const contexto = canvas.getContext('2d')!;
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, 64, 48);
    contexto.fillStyle = '#e24b4b';
    contexto.fillRect(2, 2, 8, 8);
    contexto.fillStyle = '#3083c5';
    contexto.fillRect(40, 35, 8, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: 'Amostra.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '64');
}

function lerPixel(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (elemento, ponto) => {
      const tela = elemento as HTMLCanvasElement;
      return Array.from(tela.getContext('2d')!.getImageData(ponto.x, ponto.y, 1, 1).data);
    },
    { x, y },
  );
}

test('muda o tamanho e o DPI por propriedades e recupera ambos do autosave e do PNG', async ({
  page,
}) => {
  await abrirAmostra(page);
  await page.keyboard.press('Control+e');
  const propriedades = page.getByRole('dialog', { name: 'Propriedades da imagem' });
  await expect(propriedades).toBeVisible();
  await propriedades.getByLabel('Resolução (DPI)', { exact: true }).fill('100');
  await propriedades.getByRole('combobox', { name: 'Unidades', exact: true }).selectOption('pol');
  await propriedades.getByLabel('Largura', { exact: true }).fill('0.8');
  await propriedades.getByLabel('Altura', { exact: true }).fill('0.5');
  await propriedades.getByLabel('Cor de fundo', { exact: true }).fill('#70a54a');
  await propriedades.getByRole('button', { name: 'Aplicar' }).click();
  await expect(propriedades).not.toBeVisible();
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '80');
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('height', '50');
  expect(await lerPixel(page, 3, 3)).toEqual(vermelho);
  expect(await lerPixel(page, 70, 48)).toEqual([112, 165, 74, 255]);
  await expect(
    page.locator('.history-list').getByText('Redimensionar papel', { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '80');
  await page.getByRole('button', { name: 'Propriedades da imagem', exact: true }).click();
  await expect(propriedades.getByLabel('Resolução (DPI)', { exact: true })).toHaveValue('100');
  await page.keyboard.press('Escape');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Salvar PNG (Ctrl+S)', exact: true }).click();
  const arquivo = await download;
  const partes: Buffer[] = [];
  for await (const parte of (await arquivo.createReadStream())!) partes.push(Buffer.from(parte));
  const png = Buffer.concat(partes);
  const bloco = png.indexOf('pHYs');
  expect(bloco).toBeGreaterThan(32);
  expect(png.readUInt32BE(bloco + 4)).toBe(3937);
  await page
    .getByLabel('Abrir arquivo de imagem', { exact: true })
    .setInputFiles({ name: 'Exportado.png', mimeType: 'image/png', buffer: png });
  await expect(page).toHaveTitle('Exportado — Rabisco');
  await page.getByRole('button', { name: 'Propriedades da imagem', exact: true }).click();
  await expect(propriedades.getByLabel('Resolução (DPI)', { exact: true })).toHaveValue('100');
});

test('gira e inverte a imagem inteira com pixels e dimensões recuperáveis', async ({ page }) => {
  await abrirAmostra(page);
  const tela = page.locator('.drawing-canvas');
  const girar = page.getByRole('button', { name: 'Girar', exact: true });
  await girar.click();
  await page.getByRole('menuitem', { name: 'Girar 90° à direita', exact: true }).click();
  await expect(tela).toHaveAttribute('width', '48');
  await expect(tela).toHaveAttribute('height', '64');
  expect(await lerPixel(page, 44, 3)).toEqual(vermelho);
  await girar.click();
  await page.getByRole('menuitem', { name: 'Inverter horizontalmente', exact: true }).click();
  expect(await lerPixel(page, 3, 3)).toEqual(vermelho);
  await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }).click();
  expect(await lerPixel(page, 3, 3)).toEqual(branco);
  await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }).click();
  await expect(tela).toHaveAttribute('width', '64');
  expect(await lerPixel(page, 3, 3)).toEqual(vermelho);
  await page.getByRole('button', { name: 'Refazer (Ctrl+Y)', exact: true }).click();
  await expect(tela).toHaveAttribute('width', '48');
  expect(await lerPixel(page, 44, 3)).toEqual(vermelho);
});

test('redimensiona e inclina a seleção sem mudar as dimensões do papel', async ({ page }) => {
  await abrirAmostra(page);
  await page.getByRole('button', { name: 'Selecionar (S)', exact: true }).click();
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  await page.mouse.move(caixa.x + 0.5, caixa.y + 0.5);
  await page.mouse.down();
  await page.mouse.move(caixa.x + 16.5, caixa.y + 12.5, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('.selection-marquee')).toBeVisible();
  await page.getByRole('button', { name: 'Redimensionar e inclinar', exact: true }).click();
  const transformar = page.getByRole('dialog', { name: 'Redimensionar e inclinar' });
  await expect(transformar).toBeVisible();
  await transformar.getByLabel('Unidade do redimensionamento').selectOption('px');
  await transformar.getByLabel('Manter proporção').uncheck();
  await transformar.getByLabel('Largura', { exact: true }).fill('24');
  await transformar.getByLabel('Altura', { exact: true }).fill('18');
  await transformar.getByLabel('Horizontal (°)', { exact: true }).fill('30');
  await transformar.getByRole('button', { name: 'Aplicar' }).click();
  await expect(transformar).not.toBeVisible();
  await expect(tela).toHaveAttribute('width', '64');
  await expect(tela).toHaveAttribute('height', '48');
  expect(await lerPixel(page, 43, 38)).toEqual([48, 131, 197, 255]);
  expect(await lerPixel(page, 18, 10)).not.toEqual(branco);
  await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }).click();
  expect(await lerPixel(page, 18, 10)).toEqual(branco);
  expect(await lerPixel(page, 3, 3)).toEqual(vermelho);
});
