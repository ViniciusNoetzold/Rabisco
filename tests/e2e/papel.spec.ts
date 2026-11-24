import { expect, test, type Page } from '@playwright/test';

type Borda = 'pela direita' | 'pela base' | 'pelo canto';
type Delta = readonly [number, number];

const larguraInicial = 320;
const alturaInicial = 240;
const branco = [255, 255, 255, 255];
const vermelho = [226, 75, 75, 255];

async function novoPapel(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  const janela = page.getByRole('dialog');
  await janela.getByLabel('Largura (px)', { exact: true }).fill(String(larguraInicial));
  await janela.getByLabel('Altura (px)', { exact: true }).fill(String(alturaInicial));
  await janela.getByRole('button', { name: 'Criar desenho', exact: true }).click();
  await tamanhoPapel(page, larguraInicial, alturaInicial);
}

async function tamanhoPapel(page: Page, largura: number, altura: number) {
  const tela = page.locator('.drawing-canvas');
  await expect(tela).toHaveAttribute('width', String(largura));
  await expect(tela).toHaveAttribute('height', String(altura));
}

async function centroAlca(page: Page, borda: Borda) {
  const alca = page.getByRole('button', { name: `Redimensionar papel ${borda}`, exact: true });
  await expect(alca).toBeVisible();
  const caixa = (await alca.boundingBox())!;
  return { x: Math.round(caixa.x + caixa.width / 2), y: Math.round(caixa.y + caixa.height / 2) };
}

async function previsualizarArraste(page: Page, borda: Borda, delta: Delta) {
  const { x, y } = await centroAlca(page, borda);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta[0], y + delta[1], { steps: 4 });
  await expect(page.locator('.paper-resize-preview')).toBeVisible();
}

async function corPixel(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (elemento, ponto) => {
      const tela = elemento as HTMLCanvasElement;
      return [...tela.getContext('2d')!.getImageData(ponto.x, ponto.y, 1, 1).data];
    },
    { x, y },
  );
}

const cenarios = [
  { borda: 'pela direita', expandir: [48, 0], reduzir: [-70, 0], pixel: [342, 40] },
  { borda: 'pela base', expandir: [0, 32], reduzir: [0, -54], pixel: [40, 253] },
  { borda: 'pelo canto', expandir: [48, 32], reduzir: [-70, -54], pixel: [342, 253] },
] as const;

for (const { borda, expandir, reduzir, pixel } of cenarios) {
  test(`aumenta e diminui o papel ${borda}, com histórico e Cor 2`, async ({ page }) => {
    await novoPapel(page);
    await page.getByRole('button', { name: 'Selecionar Cor 2', exact: true }).click();
    await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();

    const larguraMaior = larguraInicial + expandir[0];
    const alturaMaior = alturaInicial + expandir[1];
    const historico = page
      .locator('.history-list')
      .getByText('Redimensionar papel', { exact: true });

    await previsualizarArraste(page, borda, expandir);
    await tamanhoPapel(page, larguraInicial, alturaInicial);
    await expect(page.locator('.image-dimensions[data-preview]')).toHaveText(
      `${larguraMaior} × ${alturaMaior} px`,
    );
    await expect(historico).toHaveCount(0);
    await page.mouse.up();

    await tamanhoPapel(page, larguraMaior, alturaMaior);
    await expect(page.locator('.paper-resize-preview')).toBeHidden();
    await expect(historico).toHaveCount(1);
    expect(await corPixel(page, 8, 8)).toEqual(branco);
    expect(await corPixel(page, ...pixel)).toEqual(vermelho);

    const larguraMenor = larguraMaior + reduzir[0];
    const alturaMenor = alturaMaior + reduzir[1];
    await previsualizarArraste(page, borda, reduzir);
    await page.mouse.up();
    await tamanhoPapel(page, larguraMenor, alturaMenor);
    await expect(historico).toHaveCount(2);

    const desfazer = page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true });
    const refazer = page.getByRole('button', { name: 'Refazer (Ctrl+Y)', exact: true });
    await desfazer.click();
    await tamanhoPapel(page, larguraMaior, alturaMaior);
    expect(await corPixel(page, ...pixel)).toEqual(vermelho);
    await desfazer.click();
    await tamanhoPapel(page, larguraInicial, alturaInicial);
    await refazer.click();
    await tamanhoPapel(page, larguraMaior, alturaMaior);
    await refazer.click();
    await tamanhoPapel(page, larguraMenor, alturaMenor);

    if (borda === 'pelo canto') {
      await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
      await page.reload();
      await tamanhoPapel(page, larguraMenor, alturaMenor);
      await expect(page.locator('.image-dimensions')).toHaveText(
        `${larguraMenor} × ${alturaMenor} px`,
      );
    }
  });
}

test('aplica zoom e Shift à prévia e cancela a próxima mudança com Esc', async ({ page }) => {
  await novoPapel(page);
  await page.getByRole('slider', { name: 'Zoom', exact: true }).fill('50');
  await expect(page.locator('.zoom-value')).toHaveText('50%');

  await previsualizarArraste(page, 'pela direita', [40, 0]);
  const previa = page.locator('.image-dimensions[data-preview]');
  await expect(previa).toHaveText('400 × 240 px');
  await page.keyboard.down('Shift');
  await expect(previa).toHaveText('400 × 300 px');
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await tamanhoPapel(page, 400, 300);

  await previsualizarArraste(page, 'pela base', [0, 52]);
  await expect(previa).toHaveText('400 × 404 px');
  await page.keyboard.press('Escape');
  await expect(page.locator('.paper-resize-preview')).toBeHidden();
  await page.mouse.up();
  await tamanhoPapel(page, 400, 300);
  await expect(page.locator('.image-dimensions')).toHaveText('400 × 300 px');
  await expect(
    page.locator('.history-list').getByText('Redimensionar papel', { exact: true }),
  ).toHaveCount(1);
});

test('limita a largura mínima sem cobrir os pixels do papel estreito', async ({ page }) => {
  await novoPapel(page);
  await previsualizarArraste(page, 'pela direita', [-larguraInicial - 16, 0]);
  await expect(page.locator('.image-dimensions[data-preview]')).toHaveText('1 × 240 px');
  await page.mouse.up();
  await tamanhoPapel(page, 1, alturaInicial);
  await expect(page.getByRole('status')).toContainText('Tamanho ajustado ao limite');

  // No espaço ocupado pela alça direita de um papel de um pixel, ainda é possível desenhar.
  const tela = page.locator('.drawing-canvas');
  const centroLivre = await tela.evaluate((elemento) => {
    const { x, y, width, height } = elemento.getBoundingClientRect();
    return document.elementFromPoint(x + width / 2, y + height / 2) === elemento;
  });
  expect(centroLivre).toBe(true);

  // Amplia a coluna para que o clique do mouse atinja seu interior em coordenadas inteiras.
  await page.getByRole('slider', { name: 'Zoom', exact: true }).fill('200');
  await expect(page.locator('.zoom-value')).toHaveText('200%');
  const caixa = (await tela.boundingBox())!;
  await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await expect.poll(() => corPixel(page, 0, 120)).not.toEqual(branco);
});

test.describe('alças em tela sensível ao toque', () => {
  test.use({ hasTouch: true });

  test('redimensiona pela base arrastando um dedo', async ({ page, context }) => {
    await novoPapel(page);
    const sessao = await context.newCDPSession(page);
    const { x, y } = await centroAlca(page, 'pela base');
    await sessao.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await sessao.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + 34 }],
    });
    await expect(page.locator('.paper-resize-preview')).toBeVisible();
    await sessao.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await tamanhoPapel(page, larguraInicial, alturaInicial + 34);
  });
});
