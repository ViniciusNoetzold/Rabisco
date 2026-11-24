import { expect, test, type Page } from '@playwright/test';

async function pixel(page: Page, x: number, y: number) {
  return page
    .locator('.drawing-canvas')
    .evaluate(
      (tela: HTMLCanvasElement, [px, py]) =>
        Array.from(tela.getContext('2d')!.getImageData(px, py, 1, 1).data),
      [x, y],
    );
}

async function pontoNaTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const largura = Number(await tela.getAttribute('width'));
  const escala = caixa.width / largura;
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

async function riscar(page: Page, de: [number, number], ate: [number, number]) {
  const inicio = await pontoNaTela(page, ...de);
  const fim = await pontoNaTela(page, ...ate);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fim.x, fim.y, { steps: 10 });
  await page.mouse.up();
}

const BRANCO = [255, 255, 255, 255];

test('camadas: cria, pinta, oculta, mistura, desfaz e recupera depois de recarregar', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const lista = page.getByRole('listbox', { name: 'Lista de camadas' });
  await expect(lista.getByRole('option')).toHaveCount(1);

  await page.getByRole('button', { name: '＋ Nova' }).click();
  await expect(lista.getByRole('option')).toHaveCount(2);
  await expect(lista.getByRole('option', { selected: true })).toContainText('Camada 1');

  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('b');
  await riscar(page, [100, 120], [300, 120]);
  await expect.poll(() => pixel(page, 200, 120)).not.toEqual(BRANCO);
  const pintado = await pixel(page, 200, 120);

  // Ocultar a camada mostra o papel branco por baixo.
  await lista.getByRole('button', { name: 'Ocultar Camada 1' }).click();
  await expect.poll(() => pixel(page, 200, 120)).toEqual(BRANCO);
  await lista.getByRole('button', { name: 'Mostrar Camada 1' }).click();
  await expect.poll(() => pixel(page, 200, 120)).toEqual(pintado);

  // Pintar numa camada oculta avisa em vez de não fazer nada.
  await lista.getByRole('button', { name: 'Ocultar Camada 1' }).click();
  await riscar(page, [100, 200], [300, 200]);
  await expect(page.getByRole('status').filter({ hasText: 'está oculta' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(lista.getByRole('button', { name: 'Ocultar Camada 1' })).toBeVisible();

  // Modo multiplicar sobre o branco mantém a cor; diferença sobre branco inverte.
  await page.getByRole('combobox', { name: 'Modo de mesclagem' }).selectOption('diferenca');
  await expect.poll(() => pixel(page, 200, 120)).not.toEqual(pintado);
  await page.getByRole('combobox', { name: 'Modo de mesclagem' }).selectOption('normal');
  await expect.poll(() => pixel(page, 200, 120)).toEqual(pintado);

  // Desfazer a camada inteira: volta a uma camada e o traço some.
  for (let i = 0; i < 6; i++) await page.keyboard.press('Control+z');
  await expect(lista.getByRole('option')).toHaveCount(1);
  await expect.poll(() => pixel(page, 200, 120)).toEqual(BRANCO);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Control+y');
  await expect(lista.getByRole('option')).toHaveCount(2);
  await expect.poll(() => pixel(page, 200, 120)).toEqual(pintado);

  // O autosave guarda as duas camadas e a estrutura.
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await expect(page.getByText('Salvando…', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await expect(lista.getByRole('option')).toHaveCount(2);
  await expect.poll(() => pixel(page, 200, 120)).toEqual(pintado);
  expect(await pixel(page, 600, 500)).toEqual(BRANCO);

  // Mesclar abaixo junta as camadas sem mudar o que se vê.
  await page.getByRole('button', { name: 'Mesclar', exact: true }).click();
  await expect(lista.getByRole('option')).toHaveCount(1);
  await expect.poll(() => pixel(page, 200, 120)).toEqual(pintado);
});

test('a borracha apaga para transparência numa camada nova e pinta Cor 2 no papel', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '＋ Nova' }).click();
  await page.keyboard.press('b');
  await riscar(page, [100, 300], [400, 300]);
  const pintado = await pixel(page, 250, 300);
  expect(pintado).not.toEqual(BRANCO);
  await page.keyboard.press('e');
  await riscar(page, [240, 300], [260, 300]);
  // O papel branco de baixo aparece: a camada ficou transparente ali.
  await expect.poll(() => pixel(page, 250, 300)).toEqual(BRANCO);
});
