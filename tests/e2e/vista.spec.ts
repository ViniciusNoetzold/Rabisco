import { expect, test, type Page } from '@playwright/test';

/**
 * Onde um ponto do papel aparece na tela com a vista girada `graus` (e espelhada ou não). A
 * caixa do canvas que o navegador devolve é a caixa girada; o centro é o mesmo do papel.
 */
async function naTela(page: Page, x: number, y: number, graus = 0, espelhar = false) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const largura = Number(await tela.getAttribute('width'));
  const altura = Number(await tela.getAttribute('height'));
  const angulo = (graus * Math.PI) / 180;
  // Tamanho de tela da caixa girada: |cos|·L + |sen|·A (em px do papel) vezes o zoom.
  const zoom =
    caixa.width / (Math.abs(Math.cos(angulo)) * largura + Math.abs(Math.sin(angulo)) * altura);
  let dx = (x - largura / 2) * zoom;
  const dy = (y - altura / 2) * zoom;
  if (espelhar) dx = -dx;
  return {
    x: caixa.x + caixa.width / 2 + dx * Math.cos(angulo) - dy * Math.sin(angulo),
    y: caixa.y + caixa.height / 2 + dx * Math.sin(angulo) + dy * Math.cos(angulo),
  };
}

async function pixel(page: Page, x: number, y: number) {
  return page
    .locator('.drawing-canvas')
    .evaluate(
      (tela: HTMLCanvasElement, [px, py]) =>
        Array.from(tela.getContext('2d')!.getImageData(px, py, 1, 1).data),
      [x, y],
    );
}

async function pintado(page: Page, x: number, y: number) {
  const [r, g, b] = await pixel(page, x, y);
  return r < 200 || g < 200 || b < 200;
}

async function abrir(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.locator('.drawing-canvas').focus();
}

async function girar90(page: Page) {
  for (let i = 0; i < 6; i++) await page.keyboard.press('6');
  await expect(page.getByRole('button', { name: /↻ 90°/ })).toBeVisible();
}

async function arrastar(page: Page, de: { x: number; y: number }, ate: { x: number; y: number }) {
  await page.mouse.move(de.x, de.y);
  await page.mouse.down();
  await page.mouse.move(ate.x, ate.y, { steps: 8 });
  await page.mouse.up();
}

test('vista girada 90°: traço horizontal na tela vira vertical no papel', async ({ page }) => {
  await abrir(page);
  await girar90(page);
  await page.keyboard.press('p');
  // Na vista a 90°, (300, 200) → (300, 400) no papel é um segmento horizontal na tela.
  const a = await naTela(page, 300, 200, 90);
  const b = await naTela(page, 300, 400, 90);
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);
  // Arrasta na horizontal da tela, de a até b.
  await arrastar(page, a, { x: b.x, y: a.y });
  for (const y of [220, 300, 380]) expect(await pintado(page, 300, y)).toBe(true);
  expect(await pintado(page, 400, 300)).toBe(false);
  // 5 volta a 0°.
  await page.keyboard.press('5');
  await expect(page.getByRole('button', { name: /↻/ })).toHaveCount(0);
});

test('com a vista girada, o conta-gotas e as alças das formas acertam o ponto', async ({
  page,
}) => {
  await abrir(page);
  // Um quadrado vermelho cheio em (100..160, 100..160), desenhado com a vista normal.
  await page.getByRole('button', { name: 'Selecionar Cor 1' }).click();
  await page.locator('.palette .swatch').nth(3).click();
  const cor = await page
    .locator('.color-target')
    .first()
    .locator('span')
    .first()
    .evaluate((elemento) => getComputedStyle(elemento).backgroundColor);
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('b');
  const espessura = page.getByRole('spinbutton', { name: 'Espessura do traço', exact: true });
  await espessura.fill('60');
  await espessura.press('Tab');
  await page.locator('.drawing-canvas').focus();
  await arrastar(page, await naTela(page, 120, 130), await naTela(page, 140, 130));
  // Volta a Cor 1 para azul e gira a vista.
  await page.locator('.palette .swatch').nth(0).click();
  await page.locator('.drawing-canvas').focus();
  await girar90(page);
  // Conta-gotas no centro do quadrado: a Cor 1 vira o vermelho.
  await page.keyboard.press('i');
  const alvo = await naTela(page, 130, 130, 90);
  await page.mouse.click(alvo.x, alvo.y);
  await expect(page.locator('.color-target').first().locator('span').first()).toHaveCSS(
    'background-color',
    cor,
  );

  // Retângulo criado com a vista girada e aumentado pela alça do canto (300, 500)→(360, 560).
  await page.keyboard.press('Escape');
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('r');
  await arrastar(page, await naTela(page, 300, 300, 90), await naTela(page, 500, 400, 90));
  await arrastar(page, await naTela(page, 500, 400, 90), await naTela(page, 560, 460, 90));
  await page.keyboard.press('Enter');
  expect(await pintado(page, 430, 460)).toBe(true);
  expect(await pintado(page, 560, 380)).toBe(true);
  expect(await pintado(page, 430, 400)).toBe(false);
});

test('a prévia do pincel fica atrás da camada de cima e a vista espelha com H', async ({
  page,
}) => {
  await abrir(page);
  await page.getByRole('button', { name: '＋ Nova' }).click();
  const lista = page.getByRole('listbox', { name: 'Lista de camadas' });
  await expect(lista.getByRole('option')).toHaveCount(2);
  // Volta para o Papel (a de baixo) e começa uma pincelada: as camadas de cima aparecem
  // por cima da prévia; ao soltar, somem (o resultado já está composto).
  await lista.getByRole('option').nth(1).click();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('b');
  const inicio = await naTela(page, 200, 200);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(inicio.x + 80, inicio.y, { steps: 4 });
  await expect(page.locator('.acima-canvas')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.acima-canvas')).toBeHidden();

  // H espelha a vista: arrastar para a direita na tela desenha para a esquerda no papel.
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: /espelhada/ })).toBeVisible();
  await page.keyboard.press('p');
  await arrastar(
    page,
    await naTela(page, 700, 500, 0, true),
    await naTela(page, 600, 500, 0, true),
  );
  expect(await pintado(page, 650, 500)).toBe(true);
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: /espelhada/ })).toHaveCount(0);
});

test('R segurada + arrastar gira a vista; R sozinho escolhe o retângulo', async ({ page }) => {
  await abrir(page);
  const centro = await naTela(page, 512, 320);
  await page.keyboard.down('r');
  // Arrasta em volta do centro: de 200 px à direita para 200 px abaixo (um quarto de volta).
  await arrastar(page, { x: centro.x + 200, y: centro.y }, { x: centro.x, y: centro.y + 200 });
  await page.keyboard.up('r');
  await expect(page.getByRole('button', { name: /↻ 90°/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Retângulo/, pressed: true })).toHaveCount(0);
  await page.keyboard.press('r');
  await expect(
    page.getByRole('button', { name: /Retângulo/, pressed: true }).first(),
  ).toBeVisible();
});
