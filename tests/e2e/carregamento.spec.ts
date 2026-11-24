import { expect, test } from '@playwright/test';

test('mostra um aviso discreto enquanto um diálogo carregado sob demanda chega', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();

  // Segura o módulo dos diálogos por 1,2 s, como numa conexão lenta.
  let liberar: () => void = () => {};
  const segurado = new Promise<void>((resolver) => (liberar = resolver));
  await page.route(/EditorDialogs/, async (rota) => {
    await segurado;
    await rota.continue();
  });

  await page.keyboard.press('Control+n');
  await expect(page.getByRole('status').filter({ hasText: 'Carregando…' })).toBeVisible();
  liberar();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Carregando…', { exact: true })).toHaveCount(0);
});
