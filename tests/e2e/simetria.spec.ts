import { expect, test, type Page } from '@playwright/test';

async function pontoNaTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

/** Quantos dos pontos (px do documento) têm tinta, olhando uma janelinha de 5 × 5 em volta. */
async function pintados(page: Page, pontos: { x: number; y: number }[]) {
  return page.locator('.drawing-canvas').evaluate((tela: HTMLCanvasElement, lista) => {
    const ctx = tela.getContext('2d')!;
    return lista.filter(({ x, y }) => {
      const { data } = ctx.getImageData(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      for (let i = 0; i < data.length; i += 4)
        if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) return true;
      return false;
    }).length;
  }, pontos);
}

/** Pontos a `raio` do centro do papel (512, 320), começando no alto, a cada 360/n graus. */
function emVolta(n: number, raio: number, deslocamento = 0) {
  return Array.from({ length: n }, (_, i) => {
    const angulo = -Math.PI / 2 + deslocamento + (2 * Math.PI * i) / n;
    return { x: 512 + Math.cos(angulo) * raio, y: 320 + Math.sin(angulo) * raio };
  });
}

async function abrir(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Exibir' }).click();
}

async function pincelada(page: Page, de: { x: number; y: number }, ate: { x: number; y: number }) {
  const a = await pontoNaTela(page, de.x, de.y);
  const b = await pontoNaTela(page, ate.x, ate.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

test('radial de 6 eixos: um traço pinta as 6 cópias e um desfazer apaga todas', async ({
  page,
}) => {
  await abrir(page);
  await page.getByRole('combobox', { name: 'Modo de simetria' }).selectOption('radial');
  await page.getByRole('spinbutton', { name: 'Fatias da simetria radial' }).fill('6');
  await expect(page.locator('.guias-simetria line')).toHaveCount(6);
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('b');
  // Um tracinho no alto, a 150 px do centro.
  await pincelada(page, { x: 506, y: 170 }, { x: 518, y: 170 });
  expect(await pintados(page, emVolta(6, 150))).toBe(6);
  // Entre as cópias (a 30° delas) não há tinta.
  expect(await pintados(page, emVolta(6, 150, Math.PI / 6))).toBe(0);
  await page.keyboard.press('Control+z');
  expect(await pintados(page, emVolta(6, 150))).toBe(0);
  await page.keyboard.press('Control+y');
  expect(await pintados(page, emVolta(6, 150))).toBe(6);
});

test('espelho vertical com o lápis e centro arrastado para o lado', async ({ page }) => {
  await abrir(page);
  await page.getByRole('combobox', { name: 'Modo de simetria' }).selectOption('vertical');
  // Arrasta a alça do centro de x = 512 para x = 400.
  const alca = page.getByTestId('centro-simetria');
  const caixa = (await alca.boundingBox())!;
  const destino = await pontoNaTela(page, 400, 320);
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.mouse.move(destino.x, destino.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Centralizar no papel' })).toBeEnabled();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('p');
  await pincelada(page, { x: 300, y: 100 }, { x: 300, y: 200 });
  // O espelho fica em 400 + (400 − 300) = 500. Nada em 724 (o espelho com o centro antigo).
  expect(await pintados(page, [{ x: 300, y: 150 }])).toBe(1);
  expect(await pintados(page, [{ x: 500, y: 150 }])).toBe(1);
  expect(await pintados(page, [{ x: 724, y: 150 }])).toBe(0);
});

test('Shift+S liga e desliga a simetria; S sozinho continua sendo a seleção', async ({ page }) => {
  await abrir(page);
  const modo = page.getByRole('combobox', { name: 'Modo de simetria' });
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('Shift+S');
  await expect(modo).toHaveValue('vertical');
  await expect(page.locator('.guias-simetria')).toBeVisible();
  await page.keyboard.press('Shift+S');
  await expect(modo).toHaveValue('nenhuma');
  await expect(page.locator('.guias-simetria')).toHaveCount(0);
  await page.keyboard.press('s');
  await expect(modo).toHaveValue('nenhuma');
});
