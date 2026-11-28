import { expect, test, type Page } from '@playwright/test';

const BRANCO = [255, 255, 255, 255];
const PRETO = [0, 0, 0, 255];
const AZUL = [48, 131, 197, 255];

test('Dithering Bayer mostra um padrão na prévia e pode ser desfeito', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Usar cor #687586', exact: true }).click();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('f');
  const ponto = await pontoNaTela(page, 400, 240);
  await page.mouse.click(ponto.x, ponto.y);
  await expect.poll(() => pixel(page, 0, 0)).toEqual([104, 117, 134, 255]);

  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Dithering', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Dithering', exact: true });
  await dialogo.getByRole('combobox', { name: 'Algoritmo' }).selectOption('bayer-4');
  const aplicar = dialogo.getByRole('button', { name: 'Aplicar', exact: true });
  await expect(aplicar).toBeEnabled();

  const amostra = () =>
    page.locator('.drawing-canvas').evaluate((tela: HTMLCanvasElement) => {
      const { data } = tela.getContext('2d')!.getImageData(0, 0, 4, 4);
      return Array.from(new Set(Array.from(data).filter((_, i) => i % 4 === 0))).sort(
        (a, b) => a - b,
      );
    });
  await expect.poll(amostra).toEqual([0, 255]);
  await aplicar.click();
  await expect(dialogo).toBeHidden();
  await expect.poll(amostra).toEqual([0, 255]);
  await page.keyboard.press('Control+z');
  await expect.poll(amostra).toEqual([104]);
});

async function pixel(page: Page, x: number, y: number) {
  return page
    .locator('.drawing-canvas')
    .evaluate(
      (tela: HTMLCanvasElement, ponto) =>
        Array.from(tela.getContext('2d')!.getImageData(ponto.x, ponto.y, 1, 1).data),
      { x, y },
    );
}

async function abrirFiltro(page: Page) {
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Inverter cores', exact: true }).click();
  return page.getByRole('dialog', { name: 'Inverter cores', exact: true });
}

function historicoDoFiltro(page: Page) {
  return page.locator('.history-list').getByText('Inverter cores', { exact: true });
}

async function pontoNaTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

test('inverter cores: prévia no papel, antes/depois, aplicar, desfazer e repetir', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Repetir último filtro' })).toBeDisabled();
  await page.keyboard.press('Escape');

  const dialogo = await abrirFiltro(page);
  const aplicar = dialogo.getByRole('button', { name: 'Aplicar', exact: true });
  await expect(aplicar).toBeEnabled();
  await expect.poll(() => pixel(page, 200, 200)).toEqual(PRETO);
  await expect(historicoDoFiltro(page)).toHaveCount(0);

  const comparar = dialogo.getByRole('button', { name: 'Antes/depois', exact: true });
  const botao = (await comparar.boundingBox())!;
  await page.mouse.move(botao.x + botao.width / 2, botao.y + botao.height / 2);
  await page.mouse.down();
  await expect.poll(() => pixel(page, 200, 200)).toEqual(BRANCO);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect.poll(() => pixel(page, 200, 200)).toEqual(PRETO);

  await aplicar.click();
  await expect(dialogo).toBeHidden();
  await expect(historicoDoFiltro(page)).toHaveCount(1);
  expect(await pixel(page, 200, 200)).toEqual(PRETO);
  await page.keyboard.press('Control+z');
  await expect(historicoDoFiltro(page)).toHaveCount(0);
  await expect.poll(() => pixel(page, 200, 200)).toEqual(BRANCO);
  await page.keyboard.press('Control+y');
  await expect(historicoDoFiltro(page)).toHaveCount(1);
  await expect.poll(() => pixel(page, 200, 200)).toEqual(PRETO);
  await page.keyboard.press('Control+f');
  await expect(historicoDoFiltro(page)).toHaveCount(2);
  await expect.poll(() => pixel(page, 200, 200)).toEqual(BRANCO);
});

test('Esc interrompe um filtro em processamento sem gravar alterações', async ({ page }) => {
  await page.addInitScript(() => {
    const NavegadorWorker = window.Worker;
    // Mantém só o worker de filtros ocupado até o cancelamento, sem depender da CPU do ensaio.
    window.Worker = class extends NavegadorWorker {
      private filtro: boolean;

      constructor(script: string | URL, opcoes?: WorkerOptions) {
        const filtro = String(script).includes('filtros.worker');
        const url = filtro
          ? URL.createObjectURL(new Blob([''], { type: 'text/javascript' }))
          : script;
        super(url, opcoes);
        this.filtro = filtro;
      }

      override terminate() {
        super.terminate();
        if (this.filtro) document.documentElement.dataset.filtroInterrompido = '';
      }
    };
  });
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const dialogo = await abrirFiltro(page);
  await expect(dialogo.getByText('Aplicando…', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-filtro-interrompido', '');
  await expect(historicoDoFiltro(page)).toHaveCount(0);
  expect(await pixel(page, 200, 200)).toEqual(BRANCO);
});

test('prévia e aplicação da máscara respeitam o recorte da seleção', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '＋ Nova' }).click();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('f');
  const centro = await pontoNaTela(page, 240, 240);
  await page.mouse.click(centro.x, centro.y);
  await expect.poll(() => pixel(page, 200, 200)).toEqual(AZUL);

  await page.getByRole('button', { name: 'Máscara', exact: true }).click();
  await page.getByRole('button', { name: 'Máscara de Camada 1' }).click();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('s');
  const inicio = await pontoNaTela(page, 150, 150);
  const fim = await pontoNaTela(page, 350, 350);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fim.x, fim.y, { steps: 8 });
  await page.mouse.up();

  const dialogo = await abrirFiltro(page);
  const aplicar = dialogo.getByRole('button', { name: 'Aplicar', exact: true });
  await expect(aplicar).toBeEnabled();
  expect(await pixel(page, 240, 240)).toEqual(BRANCO);
  expect(await pixel(page, 100, 100)).toEqual(AZUL);

  await aplicar.click();
  await expect(historicoDoFiltro(page)).toHaveCount(1);
  expect(await pixel(page, 240, 240)).toEqual(BRANCO);
  expect(await pixel(page, 100, 100)).toEqual(AZUL);
  await page.keyboard.press('Control+z');
  await expect.poll(() => pixel(page, 240, 240)).toEqual(AZUL);
});

test('Curvas edita os pontos, atualiza o papel e registra uma edição', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Curvas', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Curvas', exact: true });
  const aplicar = dialogo.getByRole('button', { name: 'Aplicar', exact: true });
  const curva = dialogo.getByRole('group', { name: 'Curva de tons' });
  await expect(aplicar).toBeEnabled();

  await curva.getByRole('button', { name: 'Adicionar ponto' }).click();
  await expect(curva.getByRole('spinbutton', { name: 'Entrada' })).toHaveValue('128');
  await expect(curva.getByRole('button', { name: 'Ponto 2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await curva.getByRole('button', { name: 'Ponto 3', exact: true }).focus();
  await page.keyboard.press('Shift+ArrowDown');
  await curva.getByRole('spinbutton', { name: 'Saída' }).fill('128');
  await expect(aplicar).toBeEnabled();
  await expect.poll(() => pixel(page, 200, 200)).toEqual([128, 128, 128, 255]);

  await aplicar.click();
  await expect(page.locator('.history-list').getByText('Curvas', { exact: true })).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect.poll(() => pixel(page, 200, 200)).toEqual(BRANCO);
});

test('conta-gotas de Níveis lê o ponto preto e o ponto branco no papel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('f');
  const amostra = await pontoNaTela(page, 520, 340);
  await page.mouse.click(amostra.x, amostra.y);
  await expect.poll(() => pixel(page, 520, 340)).toEqual(AZUL);

  await page.getByRole('button', { name: 'Filtros', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Níveis', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Níveis' });
  await dialogo.getByRole('button', { name: 'Amostrar branco' }).click();
  await page.mouse.click(amostra.x, amostra.y);
  await expect(dialogo.getByRole('slider', { name: 'Ponto branco' })).toHaveValue('114');
  await dialogo.getByRole('button', { name: 'Amostrar preto' }).click();
  await page.mouse.click(amostra.x, amostra.y);
  await expect(dialogo.getByRole('slider', { name: 'Ponto preto' })).toHaveValue('113');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect.poll(() => pixel(page, 520, 340)).toEqual(AZUL);
});
