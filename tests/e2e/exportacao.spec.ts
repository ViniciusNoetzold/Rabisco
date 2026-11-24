import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('salva em outro formato com avisos e controles correspondentes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+Shift+s');
  const dialogo = page.getByRole('dialog', { name: 'Salvar como', exact: true });
  await expect(dialogo).toBeVisible();
  const formato = dialogo.getByRole('combobox', { name: 'Formato', exact: true });
  await formato.selectOption('jpeg');
  await expect(dialogo.getByRole('slider', { name: 'Qualidade', exact: true })).toBeVisible();
  await expect(dialogo.getByRole('status')).toContainText('transparência');
  await formato.selectOption('gif');
  await expect(dialogo.getByRole('slider')).toHaveCount(0);
  await expect(dialogo.getByRole('status')).toContainText('256 cores');
  await dialogo.getByLabel('Nome do arquivo', { exact: true }).fill('Meu desenho');
  const download = page.waitForEvent('download');
  await dialogo.getByRole('button', { name: 'Salvar arquivo', exact: true }).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toBe('Meu desenho.gif');
  const caminho = await arquivo.path();
  expect((await readFile(caminho)).subarray(0, 6).toString()).toBe('GIF89a');
  await expect(dialogo).toBeHidden();
});

test('prepara impressão em paisagem com somente a imagem', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+p');
  const dialogo = page.getByRole('dialog', { name: 'Imprimir desenho', exact: true });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('combobox', { name: 'Orientação', exact: true }).selectOption('paisagem');
  await expect(dialogo.getByLabel('Ajustar à página', { exact: true })).toBeChecked();
  await dialogo.getByLabel('Centralizar', { exact: true }).uncheck();
  await dialogo.getByRole('button', { name: 'Imprimir', exact: true }).click();

  const folha = page.locator('.rabisco-folha-impressao');
  await expect(folha).toHaveCount(1);
  await page.emulateMedia({ media: 'print' });
  const imagem = folha.locator('img');
  await expect(imagem).toBeVisible();
  await expect(imagem).toHaveCSS('object-fit', 'contain');
  await expect(imagem).toHaveCSS('object-position', '0% 0%');
  await expect(page.locator('#root')).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true });
  const pagina = pdf.toString('latin1').match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
  expect(pagina).not.toBeNull();
  expect(Number(pagina?.[1])).toBeGreaterThan(Number(pagina?.[2]));

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });
  await expect(folha).toHaveCount(0);
  await expect(page.locator('#root')).toBeVisible();
});
