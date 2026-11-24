import { expect, test } from '@playwright/test';

// A paleta parte de um contexto novo por teste, inclusive sem IndexedDB reaproveitado.
test.use({ storageState: { cookies: [], origins: [] } });

test('edita pelos controles de cor e restaura a paleta personalizada após recarregar', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const editar = page.getByRole('button', { name: 'Editar cores', exact: true });
  const dialogo = page.getByRole('dialog', { name: 'Editar cores', exact: true });
  const campoHex = dialogo.getByRole('textbox', { name: 'Hexadecimal' });
  const canal = (nome: string) => dialogo.getByRole('spinbutton', { name: nome, exact: true });
  const salvar = dialogo.getByRole('button', { name: 'Salvar na vaga 1', exact: true });
  const salva = dialogo.getByRole('button', { name: 'Vaga 1 #00FF00', exact: true });
  await editar.click();
  await expect(dialogo).toBeVisible({ timeout: 15_000 });
  await expect(dialogo.getByRole('button', { name: 'Vaga 1 vazia', exact: true })).toBeEnabled();
  await expect(campoHex).toBeFocused();
  await campoHex.fill('#336699');
  await expect(canal('Vermelho')).toHaveValue('51');
  await expect(canal('Verde')).toHaveValue('102');
  await expect(canal('Azul')).toHaveValue('153');
  await expect(canal('Matiz')).toHaveValue('210');
  await expect(canal('Saturação')).toHaveValue('50');
  await expect(canal('Luminosidade')).toHaveValue('40');

  const espectro = dialogo.getByRole('group', { name: 'Espectro de saturação e luminosidade' });
  await espectro.press('Shift+ArrowUp');
  await expect(canal('Luminosidade')).toHaveValue('50');
  await canal('Matiz').fill('120');
  await canal('Saturação').fill('100');
  await expect(campoHex).toHaveValue('#00FF00');

  await salvar.click();
  await expect(
    dialogo.getByRole('status').filter({ hasText: 'Cor salva na vaga 1.' }),
  ).toBeVisible();
  await expect(salva).toBeEnabled();
  await dialogo.getByRole('button', { name: 'Aplicar cor', exact: true }).click();
  await expect(dialogo).toBeHidden();
  const cor1 = page.getByRole('button', { name: 'Selecionar Cor 1' }).locator('span').first();
  await expect(cor1).toHaveCSS('background-color', 'rgb(0, 255, 0)');

  await page.reload();
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await editar.click();
  await expect(dialogo).toBeVisible({ timeout: 15_000 });
  await expect(salva).toBeEnabled();
  await salva.click();
  await expect(campoHex).toHaveValue('#00FF00');
});
