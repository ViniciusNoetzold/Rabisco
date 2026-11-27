import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function abrirConversor(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Usar cor #252a34', exact: true }).click();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('f');
  await page.locator('.drawing-canvas').click({ position: { x: 100, y: 100 } });
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Converter em ASCII', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Converter em ASCII', exact: true });
  await dialogo.getByLabel('Colunas', { exact: true }).fill('16');
  await expect(dialogo.getByRole('button', { name: 'Criar camada de texto' })).toBeEnabled();
  return dialogo;
}

test('converte em ASCII, copia e exporta o texto da prévia e rasteriza em nova camada', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const dialogo = await abrirConversor(page);
  await dialogo.getByLabel('Conjunto de caracteres', { exact: true }).selectOption('braille');
  await dialogo.getByLabel('Colorido', { exact: true }).check();
  const previa = dialogo.getByLabel('Prévia ASCII', { exact: true });
  await expect(previa).toHaveAttribute('aria-busy', 'false');
  const texto = (await previa.textContent())!;
  expect(texto).toMatch(/[\u2801-\u28ff]/);

  await dialogo.getByRole('button', { name: 'Copiar texto' }).click();
  await expect(dialogo.getByText('Texto copiado.', { exact: true })).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado.replace(/\r\n/g, '\n')).toBe(texto);

  const downloads = page.waitForEvent('download');
  await dialogo.getByRole('button', { name: 'Exportar .txt', exact: true }).click();
  const download = await downloads;
  expect(download.suggestedFilename()).toBe('arte-ascii.txt');
  expect(await readFile(await download.path(), 'utf8')).toBe(texto);
  await dialogo.getByRole('button', { name: 'Rasterizar em camada' }).click();
  const camadas = page.getByRole('listbox', { name: 'Lista de camadas' });
  await expect(camadas.getByRole('option', { selected: true })).toContainText('ASCII rasterizado');
  await expect(page.getByRole('button', { name: 'Editar ASCII', exact: true })).toHaveCount(0);
});

test('edita caracteres da camada ASCII e recupera o texto ao reabrir .rabisco', async ({
  page,
}) => {
  const dialogo = await abrirConversor(page);
  await dialogo.getByRole('button', { name: 'Criar camada de texto' }).click();
  const camadas = page.getByRole('listbox', { name: 'Lista de camadas' });
  await expect(camadas.getByRole('option', { selected: true })).toContainText('Texto ASCII');
  const editar = page.getByRole('button', { name: 'Editar ASCII', exact: true });
  await editar.click();
  const texto = page.getByRole('dialog', { name: 'Editar camada ASCII', exact: true });
  await texto.getByLabel('Texto ASCII', { exact: true }).fill('A B C\nD E F');
  await texto.getByRole('button', { name: 'Salvar texto', exact: true }).click();
  await expect(
    page.locator('.history-list').getByText('Editar texto ASCII', { exact: true }),
  ).toHaveCount(1);

  const downloads = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const arquivo = await downloads;
  await page.keyboard.press('Control+n');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Criar desenho', exact: true })
    .click();
  await expect(camadas.getByRole('option')).toHaveCount(1);
  await page.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: arquivo.suggestedFilename(),
    mimeType: 'application/octet-stream',
    buffer: await readFile(await arquivo.path()),
  });
  await expect(camadas.getByRole('option', { selected: true })).toContainText('Texto ASCII');
  await editar.click();
  await expect(texto.getByLabel('Texto ASCII', { exact: true })).toHaveValue('A B C\nD E F');
});
