import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('organiza, importa e exporta as formas na biblioteca', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();

  const mais = page.getByRole('button', { name: 'Mais formas', exact: true });
  await mais.click();
  await page.getByRole('menuitem', { name: 'Gerenciar formas', exact: true }).click();
  const biblioteca = page.getByRole('dialog', { name: 'Gerenciar formas' });
  await expect(biblioteca).toBeVisible();
  await expect(biblioteca.getByRole('button', { name: 'Exportar formas' })).toBeDisabled();

  const [seletor] = await Promise.all([
    page.waitForEvent('filechooser'),
    biblioteca.getByRole('button', { name: 'Importar formas…' }).click(),
  ]);
  const comum = {
    pasta: 'Minhas formas',
    path: 'M 0.5 0 L 1 0.5 L 0.5 1 L 0 0.5 Z',
    fechada: true,
    favorita: false,
  };
  await seletor.setFiles({
    name: 'colecao.rabisco-formas.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        versao: 1,
        formas: [
          { ...comum, nome: 'Losango' },
          { ...comum, nome: 'Insígnia', pasta: 'Festa' },
          { ...comum, nome: 'Emblema', favorita: true },
        ],
      }),
    ),
  });
  const nomes = biblioteca.getByRole('listitem').locator('.shape-library-nomes strong');
  const acoes = (nome: string) =>
    biblioteca.getByRole('group', { name: `Ações para ${nome}`, exact: true });
  await expect(nomes).toHaveText(['Emblema', 'Losango', 'Insígnia']);

  await acoes('Losango').getByRole('button', { name: 'Descer Losango' }).click();
  await expect(nomes).toHaveText(['Emblema', 'Insígnia', 'Losango']);
  const origem = biblioteca.getByRole('listitem').filter({ hasText: 'Losango' });
  const destino = biblioteca.getByRole('listitem').filter({ hasText: 'Insígnia' });
  await origem.locator('[draggable="true"]').dragTo(destino);
  await expect(nomes).toHaveText(['Emblema', 'Losango', 'Insígnia']);

  await acoes('Insígnia').getByRole('button', { name: 'Renomear' }).click();
  await biblioteca.getByRole('textbox', { name: 'Nome da forma' }).fill('Laurel');
  await biblioteca.getByRole('button', { name: 'Salvar nome' }).click();
  await acoes('Laurel').getByRole('button', { name: 'Duplicar' }).click();
  await expect(nomes).toHaveText(['Emblema', 'Losango', 'Laurel', 'Laurel (cópia)']);

  const copia = acoes('Laurel (cópia)');
  await copia.getByRole('button', { name: 'Excluir', exact: true }).click();
  await biblioteca.getByRole('button', { name: 'Cancelar' }).click();
  await expect(nomes).toContainText(['Laurel (cópia)']);
  await copia.getByRole('button', { name: 'Excluir', exact: true }).click();
  await biblioteca.getByRole('button', { name: 'Excluir forma', exact: true }).click();
  await expect(nomes).toHaveText(['Emblema', 'Losango', 'Laurel']);

  await acoes('Losango').getByRole('button', { name: 'Favorita: Losango' }).click();
  await expect(biblioteca.getByRole('region', { name: 'Favoritas' })).toContainText('Losango');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    biblioteca.getByRole('button', { name: 'Exportar formas' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.rabisco-formas\.json$/);
  const { versao, formas } = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(versao).toBe(1);
  expect(formas).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ nome: 'Losango', favorita: true }),
      expect.objectContaining({ nome: 'Laurel', pasta: 'Festa' }),
    ]),
  );

  await biblioteca.getByRole('button', { name: 'Fechar biblioteca' }).click();
  await mais.click();
  await expect(
    page.getByRole('group', { name: 'Favoritas' }).getByRole('menuitemradio'),
  ).toHaveText(['Losango', 'Emblema']);
  await expect(page.getByRole('group', { name: 'Festa' }).getByRole('menuitemradio')).toHaveText(
    'Laurel',
  );
});
