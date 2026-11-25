import { expect, test, type Page } from '@playwright/test';

async function pontoNaTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

/** Altura do traço pintado (px não brancos) na coluna x, procurando 60 px acima e abaixo de y. */
async function espessuraEm(page: Page, x: number, y: number) {
  return page.locator('.drawing-canvas').evaluate(
    (tela: HTMLCanvasElement, [px, py]) => {
      const { data } = tela.getContext('2d')!.getImageData(px, py - 60, 1, 120);
      let pintados = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i] < 230 || data[i + 1] < 230 || data[i + 2] < 230) pintados++;
      return pintados;
    },
    [x, y],
  );
}

async function abrir(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const espessura = page.getByRole('spinbutton', { name: 'Espessura do traço', exact: true });
  await espessura.fill('24');
  await espessura.press('Tab');
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('b');
}

test('afinar pontas: começo e fim mais finos que o meio da pincelada', async ({ page }) => {
  await abrir(page);
  await page.getByRole('slider', { name: 'Afinar pontas' }).fill('100');
  const inicio = await pontoNaTela(page, 100, 300);
  const fim = await pontoNaTela(page, 600, 300);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fim.x, fim.y, { steps: 60 });
  await page.mouse.up();
  const comeco = await espessuraEm(page, 108, 300);
  const meio = await espessuraEm(page, 350, 300);
  const final = await espessuraEm(page, 592, 300);
  console.log(`Afinar 100%: começo ${comeco} px, meio ${meio} px, fim ${final} px.`);
  expect(meio).toBeGreaterThanOrEqual(20);
  expect(comeco).toBeLessThan(meio * 0.7);
  expect(final).toBeLessThan(meio * 0.7);
});

test('pressão pela velocidade: o traço rápido sai mais fino que o lento', async ({ page }) => {
  await abrir(page);
  await page.getByRole('checkbox', { name: 'Simular pressão pela velocidade' }).check();
  // Lento: passos de 3 px com pausa de um quadro entre eles.
  let ponto = await pontoNaTela(page, 100, 200);
  await page.mouse.move(ponto.x, ponto.y);
  await page.mouse.down();
  for (let x = 103; x <= 400; x += 3) {
    ponto = await pontoNaTela(page, x, 200);
    await page.mouse.move(ponto.x, ponto.y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  // Rápido: o mesmo caminho em poucos saltos grandes, sem pausa.
  ponto = await pontoNaTela(page, 100, 400);
  await page.mouse.move(ponto.x, ponto.y);
  await page.mouse.down();
  for (let x = 160; x <= 400; x += 60) {
    ponto = await pontoNaTela(page, x, 400);
    await page.mouse.move(ponto.x, ponto.y, { steps: 2 });
  }
  await page.mouse.up();
  // A pressão cai amortecida (sem saltos): mede perto do fim, com a velocidade já estável.
  const lento = await espessuraEm(page, 370, 200);
  const rapido = await espessuraEm(page, 370, 400);
  console.log(`Velocidade: lento ${lento} px, rápido ${rapido} px.`);
  // O intervalo entre eventos do Playwright varia, então o valor exato também (16–20 px nas
  // medições). A regra da velocidade tem testes exatos em tests/unit/pressao.test.ts.
  expect(lento).toBeGreaterThanOrEqual(22);
  expect(rapido).toBeLessThan(lento);
});

test('curva da caneta: com a mesma força, "firme" pinta mais fino que "suave"', async ({
  page,
  context,
}) => {
  await abrir(page);
  const caneta = await context.newCDPSession(page);
  async function traco(y: number) {
    const a = await pontoNaTela(page, 150, y);
    const b = await pontoNaTela(page, 450, y);
    const base = { button: 'left' as const, pointerType: 'pen' as const, force: 0.4 };
    await caneta.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...a,
      ...base,
      buttons: 1,
      clickCount: 1,
    });
    await caneta.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...b,
      ...base,
      buttons: 1,
    });
    await caneta.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...b,
      ...base,
      clickCount: 1,
    });
  }
  const curva = page.getByRole('combobox', { name: 'Curva de pressão da caneta' });
  await curva.selectOption('suave');
  await traco(200);
  await curva.selectOption('firme');
  await traco(400);
  const suave = await espessuraEm(page, 300, 200);
  const firme = await espessuraEm(page, 300, 400);
  console.log(`Caneta com força 0,4: suave ${suave} px, firme ${firme} px.`);
  expect(firme).toBeLessThan(suave * 0.75);
});
