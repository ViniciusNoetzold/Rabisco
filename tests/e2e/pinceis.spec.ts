import { expect, test, type Page } from '@playwright/test';

const branco = [255, 255, 255, 255];
const azul = [48, 131, 197, 255];

async function abrirEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
}

async function coordenadas(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (elemento, ponto) => {
      const tela = elemento as HTMLCanvasElement;
      const caixa = tela.getBoundingClientRect();
      return {
        x: caixa.x + (ponto.x * caixa.width) / tela.width,
        y: caixa.y + (ponto.y * caixa.height) / tela.height,
      };
    },
    { x, y },
  );
}

async function quantidadePintada(page: Page, seletor: string, emPrevia = false) {
  return page.locator(seletor).evaluate((elemento, previa) => {
    const tela = elemento as HTMLCanvasElement;
    const dados = tela.getContext('2d')!.getImageData(168, 130, 100, 100).data;
    let quantidade = 0;
    for (let i = 0; i < dados.length; i += 4) {
      if (previa ? dados[i + 3] > 0 : dados[i] < 255) quantidade++;
    }
    return quantidade;
  }, emPrevia);
}

async function lerPixel(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (elemento, ponto) => {
      const tela = elemento as HTMLCanvasElement;
      return [...tela.getContext('2d')!.getImageData(ponto.x, ponto.y, 1, 1).data];
    },
    { x, y },
  );
}

test('o spray continua pintando com o ponteiro parado e confirma um único traço reversível', async ({
  page,
}) => {
  await abrirEditor(page);
  await page.keyboard.press('a');
  await page.getByRole('button', { name: 'Spray grande (64 px)' }).click();
  await page.getByRole('combobox', { name: 'Densidade do spray' }).selectOption('alta');
  const centro = await coordenadas(page, 218, 180);
  await page.mouse.move(centro.x, centro.y);
  await page.mouse.down();
  const contarPrevia = () => quantidadePintada(page, '.preview-canvas', true);
  await expect.poll(contarPrevia).toBeGreaterThan(0);
  const primeiraContagem = await contarPrevia();
  await expect.poll(contarPrevia).toBeGreaterThan(primeiraContagem + 12);
  expect(await quantidadePintada(page, '.drawing-canvas')).toBe(0);
  await page.mouse.up();

  const contagem = await quantidadePintada(page, '.drawing-canvas');
  expect(contagem).toBeGreaterThan(primeiraContagem + 12);
  await expect(page.locator('.history-list').getByText(/Aerógrafo|Spray/)).toHaveCount(1);
  await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }).click();
  expect(await quantidadePintada(page, '.drawing-canvas')).toBe(0);
  await page.getByRole('button', { name: 'Refazer (Ctrl+Y)', exact: true }).click();
  expect(await quantidadePintada(page, '.drawing-canvas')).toBe(contagem);
});

test('a galeria oferece nove pincéis e o marcador só aplica opacidade uma vez por traço', async ({
  page,
}) => {
  await abrirEditor(page);
  await page.getByRole('button', { name: 'Galeria de pincéis' }).click();
  const galeria = page.getByRole('menu', { name: 'Pincéis' });
  await expect(galeria.getByRole('menuitemradio')).toHaveCount(9);
  await galeria.getByRole('menuitemradio', { name: 'Marcador', exact: true }).click();
  const espessura = page.getByRole('spinbutton', { name: 'Espessura do traço', exact: true });
  await espessura.fill('24');
  await espessura.press('Tab');

  const inicio = await coordenadas(page, 100, 120);
  const fim = await coordenadas(page, 270, 120);
  const volta = await coordenadas(page, 165, 120);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fim.x, fim.y, { steps: 15 });
  await page.mouse.move(volta.x, volta.y, { steps: 12 });
  await page.mouse.up();
  const passagemUnica = await lerPixel(page, 130, 120);
  expect(passagemUnica).not.toEqual(branco);
  expect(passagemUnica).not.toEqual(azul);
  expect(await lerPixel(page, 210, 120)).toEqual(passagemUnica);
  await expect(page.locator('.history-list').getByText('Marcador', { exact: true })).toHaveCount(1);
});

test('a pressão da caneta muda a espessura do traço e o campo aceita até 100 px', async ({
  page,
  context,
}) => {
  await abrirEditor(page);
  const espessura = page.getByRole('spinbutton', { name: 'Espessura do traço', exact: true });
  await espessura.fill('100');
  await espessura.press('Tab');
  await expect(espessura).toHaveValue('100');
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press(']');
  await expect(espessura).toHaveValue('100');
  await page.keyboard.press('[');
  await expect(espessura).toHaveValue('99');
  await espessura.fill('28');
  await espessura.press('Tab');

  const caneta = await context.newCDPSession(page);
  async function traco(y: number, force: number) {
    const a = await coordenadas(page, 100, y);
    const b = await coordenadas(page, 230, y);
    await caneta.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...a,
      button: 'left',
      buttons: 1,
      pointerType: 'pen',
      force,
      clickCount: 1,
    });
    await caneta.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...b,
      button: 'left',
      buttons: 1,
      pointerType: 'pen',
      force,
    });
    await caneta.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...b,
      button: 'left',
      pointerType: 'pen',
      clickCount: 1,
    });
  }
  await traco(100, 0.15);
  await traco(180, 0.9);
  expect(await lerPixel(page, 160, 100)).toEqual(azul);
  expect(await lerPixel(page, 160, 109)).toEqual(branco);
  expect(await lerPixel(page, 160, 189)).not.toEqual(branco);
});
