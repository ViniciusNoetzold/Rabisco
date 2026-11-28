import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const PRETO = [0, 0, 0, 255];
const BRANCO = [255, 255, 255, 255];

function pixel(page: Page) {
  return page.locator('.drawing-canvas').evaluate((tela: HTMLCanvasElement) => {
    const { data } = tela.getContext('2d')!.getImageData(40, 40, 1, 1);
    return Array.from(data);
  });
}

test('cria, edita, oculta e reabre uma camada de ajuste', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('listbox', { name: 'Lista de camadas' }).getByRole('option'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Nova camada de ajuste', exact: true }).click();
  const nova = page.getByRole('dialog', { name: 'Nova camada de ajuste' });
  await nova.getByRole('slider', { name: 'Brilho', exact: true }).press('Home');
  await expect.poll(() => pixel(page)).toEqual(PRETO);
  await nova.getByRole('button', { name: 'Aplicar ajuste' }).click();
  await expect(nova).not.toBeVisible();
  await expect.poll(() => pixel(page)).toEqual(PRETO);

  await page.getByRole('button', { name: 'Ocultar Brilho e contraste' }).click();
  await expect.poll(() => pixel(page)).toEqual(BRANCO);
  await page.getByRole('button', { name: 'Mostrar Brilho e contraste' }).click();
  await expect.poll(() => pixel(page)).toEqual(PRETO);

  await page.locator('.camada-nome').filter({ hasText: 'Brilho e contraste' }).dblclick();
  const edicao = page.getByRole('dialog', { name: 'Editar camada de ajuste' });
  await edicao.getByRole('slider', { name: 'Brilho', exact: true }).press('ArrowRight');
  await edicao.getByRole('button', { name: 'Aplicar ajuste' }).click();
  const ajustado = [3, 3, 3, 255];
  await expect.poll(() => pixel(page)).toEqual(ajustado);

  const aguardando = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await aguardando;
  const dados = await readFile(await download.path());
  await page.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: 'ajuste.rabisco',
    mimeType: 'application/x-rabisco',
    buffer: dados,
  });
  await expect(page.getByRole('status').filter({ hasText: 'aberto com 2 camadas' })).toBeVisible();
  await expect.poll(() => pixel(page)).toEqual(ajustado);
  await page.locator('.camada-nome').filter({ hasText: 'Brilho e contraste' }).dblclick();
  await expect(edicao.getByRole('slider', { name: 'Brilho', exact: true })).toHaveValue('-99');
});
