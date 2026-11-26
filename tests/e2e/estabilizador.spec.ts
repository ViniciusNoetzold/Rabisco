import { expect, test, type Page } from '@playwright/test';

async function pontoNaTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

/** Linha de x = 100 a 500 em torno de y, com um tremor fixo de ±10 px (sempre o mesmo). */
async function linhaTremida(page: Page, y: number, verificarCorda = false) {
  let estado = 11;
  const sorteio = () => {
    estado = (estado * 1664525 + 1013904223) % 2 ** 32;
    return estado / 2 ** 32;
  };
  const inicio = await pontoNaTela(page, 100, y);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  let viuCorda = false;
  for (let x = 102; x <= 500; x += 2) {
    const ponto = await pontoNaTela(page, x, y + (sorteio() - 0.5) * 20);
    await page.mouse.move(ponto.x, ponto.y);
    if (verificarCorda && x === 300)
      viuCorda = (await page.locator('.corda-estabilizador').count()) === 1;
  }
  await page.mouse.up();
  return viuCorda;
}

/** Desvio médio (px) do traço em relação à reta y, medido coluna a coluna entre x = 150 e 450. */
async function desvio(page: Page, y: number) {
  return page.locator('.drawing-canvas').evaluate((tela: HTMLCanvasElement, linha) => {
    const { data, width } = tela.getContext('2d')!.getImageData(0, linha - 30, tela.width, 60);
    let soma = 0;
    let colunas = 0;
    for (let x = 150; x <= 450; x++) {
      let ys = 0;
      let n = 0;
      for (let dy = 0; dy < 60; dy++) {
        const i = (dy * width + x) * 4;
        if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) {
          ys += dy;
          n++;
        }
      }
      if (n) {
        soma += Math.abs(ys / n - 30);
        colunas++;
      }
    }
    return colunas ? soma / colunas : Infinity;
  }, y);
}

test('o estabilizador segura o tremor da mão e mostra a corda durante o traço', async ({
  page,
}) => {
  // ~800 movimentos com leitura da tela: leva ~18 s sozinho; com a máquina ocupada, mais.
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('p');

  await linhaTremida(page, 150);
  const semEstabilizar = await desvio(page, 150);

  await page.getByRole('slider', { name: 'Estabilizar traço' }).fill('40');
  await expect(page.getByRole('slider', { name: 'Suavizar traço' })).toBeEnabled();
  const viuCorda = await linhaTremida(page, 400, true);
  const comEstabilizar = await desvio(page, 400);

  console.log(
    `Desvio da reta: ${semEstabilizar.toFixed(2)} px sem estabilizar, ${comEstabilizar.toFixed(2)} px com 40.`,
  );
  expect(viuCorda).toBe(true);
  await expect(page.locator('.corda-estabilizador')).toHaveCount(0);
  expect(semEstabilizar).toBeGreaterThan(3);
  expect(comEstabilizar).toBeLessThan(semEstabilizar / 2);
  // Um traço estabilizado continua sendo um item só no histórico.
  await expect(page.locator('.history-list').getByText('Traço de lápis')).toHaveCount(2);
});

test('Alt+] e Alt+[ ajustam o estabilizador em passos de 10', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.locator('.drawing-canvas').focus();
  const controle = page.getByRole('slider', { name: 'Estabilizar traço' });
  await page.keyboard.press('Alt+]');
  await page.keyboard.press('Alt+]');
  await expect(controle).toHaveValue('20');
  await expect(page.getByRole('status').filter({ hasText: 'Estabilizar: 20' })).toBeVisible();
  await page.keyboard.press('Alt+[');
  await page.keyboard.press('Alt+[');
  await expect(controle).toHaveValue('0');
  await expect(page.getByRole('slider', { name: 'Suavizar traço' })).toBeDisabled();
});
