import { expect, test, type Page } from '@playwright/test';

async function abrirEm100PorCento(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const controle = page.getByRole('slider', { name: 'Zoom', exact: true });
  await controle.press('Home');
  await expect(page.locator('.zoom-value')).toHaveText('12,5%');
  await controle.press('End');
  await expect(page.locator('.zoom-value')).toHaveText('800%');
  await controle.press('Home');
  for (let passo = 0; passo < 3; passo++) await controle.press('ArrowRight');
  await expect(page.locator('.zoom-value')).toHaveText('100%');
}

async function centroDaJanela(page: Page) {
  return page.locator('.workspace').evaluate((area) => {
    const caixa = area.getBoundingClientRect();
    return { x: caixa.left + area.clientWidth / 2, y: caixa.top + area.clientHeight / 2 };
  });
}

function documentoSobCursor(page: Page, cursor: { x: number; y: number }) {
  return page.locator('.drawing-canvas').evaluate((elemento, tela) => {
    const canvas = elemento as HTMLCanvasElement;
    const caixa = canvas.getBoundingClientRect();
    return {
      x: ((tela.x - caixa.left) * canvas.width) / caixa.width,
      y: ((tela.y - caixa.top) * canvas.height) / caixa.height,
    };
  }, cursor);
}

test('amplia sob o cursor e navega com o botão do meio, espaço e lupa', async ({ page }) => {
  await abrirEm100PorCento(page);
  const area = page.locator('.workspace');
  const cursor = await centroDaJanela(page);
  const original = await documentoSobCursor(page, cursor);
  await page.mouse.move(cursor.x, cursor.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await expect(page.locator('.zoom-value')).toHaveText('200%');
  const atual = await documentoSobCursor(page, cursor);
  expect(Math.abs(atual.x - original.x)).toBeLessThan(1);
  expect(Math.abs(atual.y - original.y)).toBeLessThan(1);

  const scrollInicial = await area.evaluate((elemento) => elemento.scrollLeft);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(cursor.x - 55, cursor.y, { steps: 4 });
  await page.mouse.up({ button: 'middle' });
  await expect
    .poll(() => area.evaluate((elemento) => elemento.scrollLeft))
    .toBe(scrollInicial + 55);

  await page.locator('.drawing-canvas').focus();
  await page.keyboard.down('Space');
  await expect(area).toHaveAttribute('data-pan', 'pronto');
  const scrollVertical = await area.evaluate((elemento) => elemento.scrollTop);
  await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.down();
  await page.mouse.move(cursor.x, cursor.y - 35, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect
    .poll(() => area.evaluate((elemento) => elemento.scrollTop))
    .toBe(scrollVertical + 35);

  await page.keyboard.press('z');
  await page.mouse.move(cursor.x + 20, cursor.y + 15);
  await expect(page.locator('.lupa-area')).toBeVisible();
  await page.mouse.click(cursor.x + 20, cursor.y + 15);
  await expect(page.locator('.zoom-value')).toHaveText('300%');
  await page.mouse.click(cursor.x, cursor.y, { button: 'right' });
  await expect(page.locator('.zoom-value')).toHaveText('200%');
});

test('cancela o primeiro traço ao reconhecer a pinça e amplia o papel', async ({ page }) => {
  await abrirEm100PorCento(page);
  const cursor = await centroDaJanela(page);
  const primeiroPonto = { x: cursor.x - 30, y: cursor.y, id: 1 };
  const segundoPonto = { x: cursor.x + 30, y: cursor.y, id: 2 };
  const pontoNoPapel = await documentoSobCursor(page, primeiroPonto);
  const tecladoToque = await page.context().newCDPSession(page);
  await tecladoToque.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [primeiroPonto],
  });
  await tecladoToque.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [primeiroPonto, segundoPonto],
  });
  await tecladoToque.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { ...primeiroPonto, x: primeiroPonto.x - 30 },
      { ...segundoPonto, x: segundoPonto.x + 30 },
    ],
  });
  await tecladoToque.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.zoom-value')).toHaveText('200%');
  const papel = await page.locator('.drawing-canvas').evaluate((elemento, ponto) => {
    const canvas = elemento as HTMLCanvasElement;
    return [
      ...canvas.getContext('2d')!.getImageData(Math.floor(ponto.x), Math.floor(ponto.y), 1, 1).data,
    ];
  }, pontoNoPapel);
  expect(papel).toEqual([255, 255, 255, 255]);
  await tecladoToque.detach();
});
