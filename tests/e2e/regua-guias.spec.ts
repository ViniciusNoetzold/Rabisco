import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function escala(page: Page) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  return { caixa, fator: caixa.width / Number(await tela.getAttribute('width')) };
}

async function pontoNaTela(page: Page, x: number, y: number) {
  const { caixa, fator } = await escala(page);
  return { x: caixa.x + x * fator, y: caixa.y + y * fator };
}

async function noPapel(page: Page, telaX: number, telaY: number) {
  const { caixa, fator } = await escala(page);
  return { x: (telaX - caixa.x) / fator, y: (telaY - caixa.y) / fator };
}

async function centroDe(page: Page, testId: string) {
  const caixa = (await page.getByTestId(testId).boundingBox())!;
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 };
}

/** Linhas (y) com tinta na coluna x, de 0 até a altura do papel. */
async function linhasPintadas(page: Page, x: number) {
  return page.locator('.drawing-canvas').evaluate((tela: HTMLCanvasElement, coluna) => {
    const { data } = tela.getContext('2d')!.getImageData(coluna, 0, 1, tela.height);
    const linhas: number[] = [];
    for (let y = 0; y < tela.height; y++) {
      const i = y * 4;
      if (data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200) linhas.push(y);
    }
    return linhas;
  }, x);
}

async function abrir(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.locator('.drawing-canvas').focus();
}

test('traço torto que começa perto da régua sai reto na borda dela', async ({ page }) => {
  await abrir(page);
  await page.keyboard.press('Shift+R');
  await expect(page.getByTestId('regua-desenho')).toBeVisible();
  const pontaA = await noPapel(
    page,
    ...(Object.values(await centroDe(page, 'regua-ponta-a')) as [number, number]),
  );
  const pontaB = await noPapel(
    page,
    ...(Object.values(await centroDe(page, 'regua-ponta-b')) as [number, number]),
  );
  expect(Math.abs(pontaA.y - pontaB.y)).toBeLessThan(1);
  const borda = pontaA.y;
  await page.keyboard.press('p');
  // Começa 8 px abaixo da borda e treme ±10 px no caminho.
  const inicio = await pontoNaTela(page, pontaA.x + 20, borda + 8);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    const p = await pontoNaTela(page, pontaA.x + 20 + i * 8, borda + (i % 2 ? 10 : -10));
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
  for (const x of [Math.round(pontaA.x + 60), Math.round(pontaA.x + 200)]) {
    const linhas = await linhasPintadas(page, x);
    expect(linhas.length).toBeGreaterThan(0);
    // Tudo numa linha só, colada na borda da régua.
    expect(Math.max(...linhas) - Math.min(...linhas)).toBeLessThanOrEqual(1);
    // A borda pode cair entre dois pixels.
    expect(Math.abs(linhas[0] - borda)).toBeLessThanOrEqual(1.5);
  }
  // Longe da régua, o traço é livre (segue o tremor).
  const longe = await pontoNaTela(page, 100, 60);
  await page.mouse.move(longe.x, longe.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    const p = await pontoNaTela(page, 100 + i * 10, 60 + (i % 2 ? 12 : -12));
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
  const livres: number[] = [];
  for (let x = 101; x <= 199; x++)
    livres.push(...(await linhasPintadas(page, x)).filter((y) => y < 100));
  // O zigue-zague de ±12 px aparece inteiro.
  expect(Math.max(...livres) - Math.min(...livres)).toBeGreaterThan(15);
});

test('guia arrastada da régua lateral aparece, o retângulo encaixa nela e ela vai no .rabisco', async ({
  page,
}) => {
  await abrir(page);
  await page.keyboard.press('Control+r');
  const regua = page.locator('.canvas-ruler-x');
  await expect(regua).toBeVisible();
  const caixaRegua = (await regua.boundingBox())!;
  const destino = await pontoNaTela(page, 300, 200);
  await page.mouse.move(destino.x, caixaRegua.y + caixaRegua.height / 2);
  await page.mouse.down();
  await page.mouse.move(destino.x, destino.y, { steps: 6 });
  await page.mouse.up();
  const guia = page.getByTestId('guia-horizontal');
  await expect(guia).toHaveCount(1);
  const valor = Number(await guia.getAttribute('data-valor'));
  expect(Math.abs(valor - 200)).toBeLessThanOrEqual(1);

  // Retângulo arrastado de y = valor − 4 (perto da guia): o topo encaixa nela.
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('r');
  const a = await pontoNaTela(page, 100, valor - 4);
  const b = await pontoNaTela(page, 260, valor + 120);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('Enter');
  const linhas = await linhasPintadas(page, 180);
  // O contorno (6 px) fica centrado na guia: começa 3 px acima dela. Sem encaixe, sobraria
  // mais 4 px (o arraste começou em valor − 4).
  expect(Math.abs(Math.min(...linhas) - (valor - 3))).toBeLessThanOrEqual(1);

  // Salva .rabisco, abre papel novo (sem guias) e reabre o arquivo: a guia volta.
  await page.keyboard.press('Control+Shift+s');
  const dialogo = page.getByRole('dialog', { name: 'Salvar como', exact: true });
  await dialogo.getByLabel('Nome do arquivo', { exact: true }).fill('com-guia');
  await dialogo.getByRole('combobox', { name: 'Formato', exact: true }).selectOption('rabisco');
  const baixar = page.waitForEvent('download');
  await dialogo.getByRole('button', { name: 'Salvar arquivo', exact: true }).click();
  const arquivo = await baixar;
  const dados = await readFile(await arquivo.path());
  await page.keyboard.press('Control+n');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Criar desenho', exact: true })
    .click();
  await expect(page.getByTestId('guia-horizontal')).toHaveCount(0);
  await page.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: arquivo.suggestedFilename(),
    mimeType: 'application/octet-stream',
    buffer: dados,
  });
  await expect(page.getByTestId('guia-horizontal')).toHaveAttribute('data-valor', String(valor));

  // "Limpar guias" na aba Exibir tira todas.
  await page.getByRole('tab', { name: 'Exibir', exact: true }).click();
  await page.getByRole('button', { name: 'Limpar guias' }).click();
  await expect(page.getByTestId('guia-horizontal')).toHaveCount(0);
});
