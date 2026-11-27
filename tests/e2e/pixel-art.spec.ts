import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const BRANCO = [255, 255, 255, 255];
const AZUL = [48, 131, 197, 255];

const tela = (page: Page) => page.locator('.drawing-canvas');

async function modoPixelArt(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  const novo = page.getByRole('dialog');
  await novo.getByLabel('Largura (px)', { exact: true }).fill('16');
  await novo.getByLabel('Altura (px)', { exact: true }).fill('16');
  await novo.getByRole('button', { name: 'Criar desenho', exact: true }).click();
  await expect(tela(page)).toHaveAttribute('width', '16');
  await page.getByRole('tab', { name: 'Exibir', exact: true }).click();
  const modo = page.getByRole('checkbox', { name: 'Modo pixel art', exact: true });
  if (!(await modo.isVisible()))
    await page.getByRole('button', { name: 'Pixel art', exact: true }).click();
  await modo.check();
  const zoom = page.getByRole('slider', { name: 'Zoom', exact: true });
  await zoom.press('End');
  await expect(zoom).toHaveAttribute('aria-valuetext', '800%');
}

async function clicarPixel(page: Page, x: number, y: number, modificadores: 'Alt'[] = []) {
  await tela(page).click({
    position: { x: x * 8 + 4, y: y * 8 + 4 },
    modifiers: modificadores,
  });
}

function corNaTela(page: Page, x: number, y: number) {
  return tela(page).evaluate(
    (canvas: HTMLCanvasElement, [px, py]) =>
      Array.from(canvas.getContext('2d')!.getImageData(px, py, 1, 1).data),
    [x, y],
  );
}

test('modo pixel art desenha células exatas, espelha a grade e amostra a cor sem interpolar', async ({
  page,
}) => {
  await modoPixelArt(page);
  const grade = page.getByRole('combobox', { name: 'Grade de pixel art', exact: true });
  await grade.selectOption('16');
  await expect(page.locator('.grade-de-blocos')).toHaveCSS(
    'background-size',
    '128px 128px, 128px 128px',
  );
  await page
    .getByRole('combobox', { name: 'Modo de simetria', exact: true })
    .selectOption('vertical');
  await clicarPixel(page, 3, 4);
  expect(await corNaTela(page, 3, 4)).toEqual(AZUL);
  expect(await corNaTela(page, 12, 4)).toEqual(AZUL);
  expect(await corNaTela(page, 4, 4)).toEqual(BRANCO);
  expect(await corNaTela(page, 13, 4)).toEqual(BRANCO);

  await page.getByRole('tab', { name: 'Início', exact: true }).click();
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  await clicarPixel(page, 3, 4, ['Alt']);
  await expect(page.getByRole('button', { name: 'Usar cor #3083c5', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.keyboard.press('Control+z');
  expect(await corNaTela(page, 3, 4)).toEqual(BRANCO);
  expect(await corNaTela(page, 12, 4)).toEqual(BRANCO);
});

test('pixeliza e exporta PNG 4× com blocos idênticos, sem suavizar as bordas', async ({ page }) => {
  await modoPixelArt(page);
  await clicarPixel(page, 2, 2);
  await page.getByRole('tab', { name: 'Início', exact: true }).click();
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Pixelizar', exact: true }).click();
  const filtro = page.getByRole('dialog', { name: 'Pixelizar', exact: true });
  await filtro.getByRole('button', { name: 'Aplicar', exact: true }).click();
  const pixelizado = [252, 253, 254, 255];
  expect(await corNaTela(page, 0, 0)).toEqual(pixelizado);
  expect(await corNaTela(page, 7, 7)).toEqual(pixelizado);
  expect(await corNaTela(page, 8, 7)).toEqual(BRANCO);

  await page.keyboard.press('Control+Shift+s');
  const salvar = page.getByRole('dialog', { name: 'Salvar como', exact: true });
  await salvar.getByRole('combobox', { name: 'Ampliação', exact: true }).selectOption('4');
  const download = page.waitForEvent('download');
  await salvar.getByRole('button', { name: 'Salvar arquivo', exact: true }).click();
  const arquivo = await download;
  const dados = [...(await readFile(await arquivo.path()))];
  const ampliada = await page.evaluate(async (bytes) => {
    const imagem = await createImageBitmap(
      new Blob([Uint8Array.from(bytes)], { type: 'image/png' }),
    );
    const canvas = document.createElement('canvas');
    canvas.width = imagem.width;
    canvas.height = imagem.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imagem, 0, 0);
    imagem.close();
    return {
      width: canvas.width,
      height: canvas.height,
      ultimoDoBloco: Array.from(ctx.getImageData(31, 31, 1, 1).data),
      primeiroDoVizinho: Array.from(ctx.getImageData(32, 31, 1, 1).data),
    };
  }, dados);
  expect(ampliada).toEqual({
    width: 64,
    height: 64,
    ultimoDoBloco: pixelizado,
    primeiroDoVizinho: BRANCO,
  });
});
