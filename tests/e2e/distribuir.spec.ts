import { expect, test, type Page } from '@playwright/test';

async function naTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

async function pintado(page: Page, x: number, y: number) {
  const [r, g, b] = await page
    .locator('.drawing-canvas')
    .evaluate(
      (tela: HTMLCanvasElement, [px, py]) =>
        Array.from(tela.getContext('2d')!.getImageData(px, py, 1, 1).data),
      [x, y],
    );
  return r < 200 || g < 200 || b < 200;
}

/** Uma camada nova com um ponto de 20 px em (x, 200). */
async function camadaComPonto(page: Page, x: number) {
  await page.getByRole('button', { name: '＋ Nova' }).click();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('b');
  const a = await naTela(page, x, 200);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 1, a.y);
  await page.mouse.up();
}

test('Ctrl+clique escolhe várias camadas e "Distribuir ↔" iguala os espaços', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const espessura = page.getByRole('spinbutton', { name: 'Espessura do traço', exact: true });
  await espessura.fill('20');
  await espessura.press('Tab');
  await camadaComPonto(page, 100);
  await camadaComPonto(page, 160);
  await camadaComPonto(page, 700);
  const lista = page.getByRole('listbox', { name: 'Lista de camadas' });
  // A lista mostra a de cima primeiro: as três camadas novas são as opções 0, 1 e 2.
  await lista.getByRole('option').nth(0).click();
  await lista
    .getByRole('option')
    .nth(1)
    .click({ modifiers: ['Control'] });
  await lista
    .getByRole('option')
    .nth(2)
    .click({ modifiers: ['Control'] });
  await expect(lista.getByRole('option', { selected: true })).toHaveCount(3);
  await page.getByRole('button', { name: 'Distribuir ↔' }).click();
  await expect(
    page.locator('.history-list').getByText('Distribuir camadas', { exact: true }),
  ).toHaveCount(1);
  // O ponto do meio sai de x = 160 e vai para o meio entre 100 e 700 (x ≈ 400).
  expect(await pintado(page, 160, 200)).toBe(false);
  expect(await pintado(page, 400, 200)).toBe(true);
  expect(await pintado(page, 100, 200)).toBe(true);
  expect(await pintado(page, 700, 200)).toBe(true);
  // Um clique simples volta a escolher só uma.
  await lista.getByRole('option').nth(0).click();
  await expect(lista.getByRole('option', { selected: true })).toHaveCount(1);
});
