import { expect, test as base, type Page } from '@playwright/test';
import { isolarAreaDeTransferencia } from './fixtures/clipboard';

// Erros de execução e recursos quebrados devem falhar mesmo se o fluxo aparente funcionar.
const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await use(errors);
      expect(
        errors,
        'O navegador não deve registrar erros de execução ou recursos ausentes.',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

const BLUE = [48, 131, 197, 255];
const RED = [226, 75, 75, 255];
const WHITE = [255, 255, 255, 255];

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('.drawing-canvas')).toBeVisible();
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
}

async function pixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.locator('.drawing-canvas').evaluate(
    (element, at) => {
      const canvas = element as HTMLCanvasElement;
      return [...canvas.getContext('2d')!.getImageData(at.x, at.y, 1, 1).data];
    },
    { x, y },
  );
}

/** Converte coordenadas do documento para o viewport, respeitando o zoom de ajuste. */
async function canvasPoint(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (element, point) => {
      const canvas = element as HTMLCanvasElement;
      const bounds = canvas.getBoundingClientRect();
      return {
        x: bounds.left + (point.x * bounds.width) / canvas.width,
        y: bounds.top + (point.y * bounds.height) / canvas.height,
      };
    },
    { x, y },
  );
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const start = await canvasPoint(page, ...from);
  const end = await canvasPoint(page, ...to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 16 });
  await page.mouse.up();
}

async function clickCanvas(page: Page, x: number, y: number, button: 'left' | 'right' = 'left') {
  const point = await canvasPoint(page, x, y);
  await page.mouse.click(point.x, point.y, { button });
}

test('desenha e desfaz/refaz uma pincelada como um comando', async ({ page }) => {
  await ready(page);
  expect(await pixel(page, 175, 120)).toEqual(WHITE);
  await page.getByRole('button', { name: 'Pincel (B)', exact: true }).click();
  await drag(page, [100, 120], [250, 120]);
  await expect.poll(() => pixel(page, 175, 120)).toEqual(BLUE);
  await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }).click();
  await expect.poll(() => pixel(page, 175, 120)).toEqual(WHITE);
  await page.getByRole('button', { name: 'Refazer (Ctrl+Y)', exact: true }).click();
  await expect.poll(() => pixel(page, 175, 120)).toEqual(BLUE);
});

test('desenha uma forma e usa Cor 1/Cor 2 no balde sem atravessar o contorno', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Retângulo', exact: true }).click();
  await drag(page, [100, 100], [300, 250]);
  await page.keyboard.press('Enter');
  await expect.poll(() => pixel(page, 100, 175)).toEqual(BLUE);
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  await page.getByRole('button', { name: 'Balde (F)', exact: true }).click();
  await clickCanvas(page, 200, 160);
  await expect.poll(() => pixel(page, 200, 160)).toEqual(RED);
  expect(await pixel(page, 350, 160)).toEqual(WHITE);
  await clickCanvas(page, 200, 160, 'right');
  await expect.poll(() => pixel(page, 200, 160)).toEqual(WHITE);
  expect(await pixel(page, 100, 175)).toEqual(BLUE);
});

test('apaga uma seleção retangular e recupera seus pixels com o atalho', async ({
  page,
}, testInfo) => {
  await ready(page);
  await drag(page, [100, 120], [280, 120]);
  const originalPixel = await pixel(page, 175, 120);
  expect(originalPixel).not.toEqual(WHITE);
  expect(originalPixel[3]).toBe(255);
  await page.getByRole('button', { name: 'Selecionar (S)', exact: true }).click();
  await drag(page, [90, 100], [300, 140]);
  await expect(page.locator('.selection-marquee')).toBeVisible();
  await page.keyboard.press('Delete');
  await expect.poll(() => pixel(page, 175, 120)).toEqual([0, 0, 0, 0]);
  await page.keyboard.press('Control+z');
  const restoredPixel = await pixel(page, 175, 120);
  await testInfo.attach('pixels-antes-de-apagar-e-depois-de-desfazer', {
    body: JSON.stringify({ originalPixel, restoredPixel }),
    contentType: 'application/json',
  });
  expect(restoredPixel).toEqual(originalPixel);
});

test(
  'copia, cola, move e corta uma seleção sem perder os pixels originais',
  { tag: '@colagem' },
  async ({ context, page }) => {
    await isolarAreaDeTransferencia(context);
    await ready(page);
    await page.getByRole('button', { name: 'Retângulo', exact: true }).click();
    await page.getByRole('button', { name: 'Selecionar Cor 2', exact: true }).click();
    await page.getByRole('button', { name: 'Usar cor #3083c5', exact: true }).click();
    await page.getByRole('combobox', { name: 'Preenchimento', exact: true }).selectOption('solid');
    await drag(page, [100, 100], [180, 150]);
    await page.keyboard.press('Enter');
    expect(await pixel(page, 140, 120)).toEqual(BLUE);
    await page.getByRole('button', { name: 'Selecionar (S)', exact: true }).click();
    await drag(page, [90, 90], [190, 160]);
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect(page.getByText('Seleção copiada como PNG.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Colar', exact: true }).click();
    await expect.poll(() => pixel(page, 74, 54)).toEqual(BLUE);
    await drag(page, [60, 50], [260, 240]);
    await expect.poll(() => pixel(page, 274, 244)).toEqual(BLUE);
    expect(await pixel(page, 74, 54)).toEqual([0, 0, 0, 0]);
    expect(await pixel(page, 140, 120)).toEqual(BLUE);
    const dimensions = (await page.locator('.selection-status').innerText()).match(
      /(\d+) × (\d+)/,
    )!;
    await page.getByRole('button', { name: 'Cortar', exact: true }).click();
    await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', dimensions[1]);
    await expect(page.locator('.drawing-canvas')).toHaveAttribute('height', dimensions[2]);
    expect(await pixel(page, 50, 30)).toEqual(BLUE);
    await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }).click();
    await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '1024');
    expect(await pixel(page, 140, 120)).toEqual(BLUE);
  },
);

test('cria documento com dimensões próprias e mantém o diálogo utilizável por teclado', async ({
  page,
}) => {
  await ready(page);
  await page.keyboard.press('Control+n');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Nome do desenho', { exact: true })).toBeFocused();
  await page.getByLabel('Nome do desenho', { exact: true }).fill('Estudo de formas');
  await page.getByLabel('Largura (px)', { exact: true }).fill('320');
  await page.getByLabel('Altura (px)', { exact: true }).fill('240');
  await page.getByRole('button', { name: 'Criar desenho', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '320');
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('height', '240');
  await expect(page).toHaveTitle('Estudo de formas — Rabisco');
  expect(await pixel(page, 160, 120)).toEqual(WHITE);
  await expect(page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true })).toBeDisabled();
});

test('controla zoom, grade, régua e créditos sem alterar o desenho', async ({ page }) => {
  await ready(page);
  await drag(page, [100, 120], [250, 120]);
  const originalPixel = await pixel(page, 175, 120);
  await page.getByRole('tab', { name: 'Exibir', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Linhas de grade', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Régua', exact: true }).check();
  await expect(page.locator('.canvas-grid')).toBeVisible();
  await expect(page.locator('.canvas-ruler-x')).toBeVisible();
  await page.getByRole('button', { name: '100%', exact: false }).click();
  const initialWidth = await page
    .locator('.drawing-canvas')
    .evaluate((element) => element.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Ampliar', exact: true }).click();
  await expect
    .poll(() =>
      page.locator('.drawing-canvas').evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(initialWidth);
  expect(await pixel(page, 175, 120)).toEqual(originalPixel);
  await page.getByRole('button', { name: 'Sobre o Rabisco', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/Ícones: Fugue/)).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Ver licenças e créditos completos' }),
  ).toHaveAttribute('href', '/THIRD_PARTY_NOTICES.txt');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('mantém a janela dentro de uma tela pequena e permite desenhar', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    shell: document.querySelector('.app-shell')!.getBoundingClientRect().width,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.shell).toBeLessThanOrEqual(dimensions.viewport);
  await drag(page, [100, 120], [250, 120]);
  expect(await pixel(page, 175, 120)).not.toEqual(WHITE);
  await page.screenshot({ path: testInfo.outputPath('rabisco-mobile.png'), fullPage: true });
});

test('abre um PNG e exporta arquivo com dimensões e assinatura válidas', async ({ page }) => {
  await ready(page);
  // Fixture gerada pelo próprio navegador; nenhum arquivo ou serviço externo participa.
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 18;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#e24b4b';
    context.fillRect(0, 0, 24, 18);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Arquivo', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /^Abrir imagem/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: 'teste-cor.png',
    mimeType: 'image/png',
    buffer: Buffer.from(encoded, 'base64'),
  });
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('width', '24');
  await expect(page.locator('.drawing-canvas')).toHaveAttribute('height', '18');
  expect(await pixel(page, 12, 9)).toEqual([226, 75, 75, 255]);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PNG', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('teste-cor.png');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(24);
  expect(png.readUInt32BE(20)).toBe(18);
});

test('recupera o desenho salvo no dispositivo após fechar e reabrir a aba', async ({
  page,
  context,
}) => {
  await ready(page);
  await drag(page, [100, 120], [250, 120]);
  await expect.poll(() => pixel(page, 175, 120)).toEqual(BLUE);
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.close();
  const reopened = await context.newPage();
  await ready(reopened);
  await expect.poll(() => pixel(reopened, 175, 120)).toEqual(BLUE);
});
