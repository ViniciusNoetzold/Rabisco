import { expect, test } from '@playwright/test';

type Leitura = { largura: number; altura: number };
type JanelaInstrumentada = Window & { leiturasDaTela: Leitura[] };

test('registra uma pincelada sem ler o papel inteiro', async ({ page }) => {
  await page.addInitScript(() => {
    const lerPixels = CanvasRenderingContext2D.prototype.getImageData;
    const leiturasDaTela: Leitura[] = [];
    Object.assign(window, { leiturasDaTela });
    CanvasRenderingContext2D.prototype.getImageData = function (x, y, largura, altura, opcoes) {
      leiturasDaTela.push({ largura, altura });
      return lerPixels.call(this, x, y, largura, altura, opcoes);
    };
  });
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();

  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const y = caixa.y + caixa.height * 0.2;
  await page.evaluate(() => {
    (window as JanelaInstrumentada).leiturasDaTela.length = 0;
  });
  await page.mouse.move(caixa.x + caixa.width * 0.1, y);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width * 0.25, y, { steps: 16 });
  await page.mouse.up();
  const pinceladas = page.locator('.history-list').getByText('Pincelada', { exact: true });
  await expect(pinceladas).toHaveCount(1);
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();

  const leituras = await page.evaluate(() => (window as JanelaInstrumentada).leiturasDaTela);
  // O comando lê a área do traço antes e depois. O autosave lê só os blocos de 256 × 256 px
  // que o traço tocou. Nenhuma leitura cobre o papel inteiro (1024 × 640 px).
  const doTraco = leituras.filter(({ largura, altura }) => largura * altura < 10_000);
  const blocos = leituras.filter(({ largura, altura }) => largura * altura >= 10_000);
  expect(doTraco.length).toBeLessThanOrEqual(2);
  expect(blocos.length).toBeLessThanOrEqual(2);
  for (const { largura, altura } of blocos) {
    expect(largura).toBeLessThanOrEqual(256);
    expect(altura).toBeLessThanOrEqual(256);
  }

  await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }).click();
  await expect(pinceladas).toHaveCount(0);
  await page.getByRole('button', { name: 'Refazer (Ctrl+Y)', exact: true }).click();
  await expect(pinceladas).toHaveCount(1);
});
