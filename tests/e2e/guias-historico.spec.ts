import { expect, test, type Page } from '@playwright/test';

async function pontoNaTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const zoom = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * zoom, y: caixa.y + y * zoom };
}

test('guias registram só o fim do arraste, desfazem e são recuperadas sem histórico', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const tela = page.locator('.drawing-canvas');
  await tela.focus();
  await page.keyboard.press('Control+r');
  const regua = (await page.locator('.canvas-ruler-x').boundingBox())!;
  const origem = await pontoNaTela(page, 300, 200);
  await page.mouse.move(origem.x, regua.y + regua.height / 2);
  await page.mouse.down();
  await page.mouse.move(origem.x, origem.y, { steps: 6 });
  await page.mouse.up();
  const guia = page.getByTestId('guia-horizontal');
  const historico = page.locator('.history-list');
  await expect(historico.getByText('Adicionar guia', { exact: true })).toHaveCount(1);
  const valor = Number(await guia.getAttribute('data-valor'));
  const inicio = await pontoNaTela(page, 300, valor);

  await tela.focus();
  await page.keyboard.press('v');
  const destino = await pontoNaTela(page, 300, 270);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(destino.x, destino.y, { steps: 8 });
  await expect(page.locator('.guia-arrastada line')).toHaveAttribute('data-valor', /^(269|270|271)$/);
  await expect(historico.getByText('Mover guia', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(guia).toHaveAttribute('data-valor', String(valor));
  await expect(historico.getByText('Mover guia', { exact: true })).toHaveCount(0);

  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(destino.x, destino.y, { steps: 8 });
  await page.mouse.up();
  await expect(historico.getByText('Mover guia', { exact: true })).toHaveCount(1);
  const movida = Number(await guia.getAttribute('data-valor'));
  expect(Math.abs(movida - 270)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Control+z');
  await expect(guia).toHaveAttribute('data-valor', String(valor));
  await page.keyboard.press('Control+y');
  await expect(guia).toHaveAttribute('data-valor', String(movida));

  const parar = await pontoNaTela(page, 300, movida);
  const fora = await pontoNaTela(page, 300, -16);
  await page.mouse.move(parar.x, parar.y);
  await page.mouse.down();
  await page.mouse.move(fora.x, fora.y, { steps: 8 });
  await page.mouse.up();
  await expect(historico.getByText('Remover guia', { exact: true })).toHaveCount(1);
  await expect(guia).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(guia).toHaveAttribute('data-valor', String(movida));

  await page.getByRole('tab', { name: 'Exibir', exact: true }).click();
  await page.getByRole('button', { name: 'Limpar guias', exact: true }).click();
  await expect(historico.getByText('Limpar guias', { exact: true })).toHaveCount(1);
  await expect(guia).toHaveCount(0);
  await tela.focus();
  await page.keyboard.press('Control+z');
  await expect(guia).toHaveAttribute('data-valor', String(movida));
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.reload();
  await expect(guia).toHaveAttribute('data-valor', String(movida));
  await expect(historico.getByText('Adicionar guia', { exact: true })).toHaveCount(0);
});
