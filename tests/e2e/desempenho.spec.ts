import { expect, test } from '@playwright/test';

test('mede os eventos e o histórico de uma pincelada em papel de 4000 × 4000 px', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/?medir=1');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  const formulario = page.getByRole('dialog');
  await formulario.getByLabel('Largura (px)', { exact: true }).fill('4000');
  await formulario.getByLabel('Altura (px)', { exact: true }).fill('4000');
  await formulario.getByRole('button', { name: 'Criar desenho', exact: true }).click();
  const tela = page.locator('.drawing-canvas');
  await expect(tela).toHaveAttribute('width', '4000');
  await expect(tela).toHaveAttribute('height', '4000');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  const visivel = await tela.evaluate((canvas) => {
    const papel = canvas.getBoundingClientRect();
    const viewport = canvas.closest('.workspace')!.getBoundingClientRect();
    const x = Math.max(papel.left, viewport.left);
    const y = Math.max(papel.top, viewport.top);
    return {
      x,
      y,
      largura: Math.min(papel.right, viewport.right) - x,
      altura: Math.min(papel.bottom, viewport.bottom) - y,
    };
  });

  const x0 = visivel.x + visivel.largura * 0.15;
  const y0 = visivel.y + visivel.altura * 0.43;
  await page.mouse.move(x0, y0);
  await page.evaluate(() => window.rabiscoMedicao!.iniciar());
  await page.mouse.down();
  const passos = 80;
  for (let i = 1; i <= passos; i++) {
    const x = x0 + visivel.largura * ((0.7 * i) / passos);
    const y = y0 + Math.sin((i * Math.PI) / 18) * visivel.altura * 0.09;
    await page.mouse.move(x, y);
  }
  await page.mouse.up();

  const { medidas } = await page.evaluate(() => window.rabiscoMedicao!.encerrar());
  expect(medidas['pincel:inicio']).toHaveLength(1);
  expect(medidas['pincel:movimento']).toHaveLength(passos);
  expect(medidas['pincel:fim']).toHaveLength(1);
  expect(medidas['historico:pincel']).toHaveLength(1);

  await expect(page.locator('.history-list').getByText('Pincelada', { exact: true })).toHaveCount(
    1,
  );
  const temTinta = await tela.evaluate(
    (elemento, ponto) => {
      const canvas = elemento as HTMLCanvasElement;
      const caixa = canvas.getBoundingClientRect();
      const x = Math.round(((ponto.x - caixa.left) * canvas.width) / caixa.width);
      const y = Math.round(((ponto.y - caixa.top) * canvas.height) / caixa.height);
      const pixels = canvas.getContext('2d')!.getImageData(x - 4, y - 4, 9, 9).data;
      return pixels.some((valor, i) => i % 4 !== 3 && valor < 240);
    },
    { x: x0, y: y0 },
  );
  expect(temTinta).toBe(true);
});
