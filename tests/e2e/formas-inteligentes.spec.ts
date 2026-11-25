import { expect, test, type Page } from '@playwright/test';

async function pontoNaTela(page: Page, x: number, y: number) {
  const tela = page.locator('.drawing-canvas');
  const caixa = (await tela.boundingBox())!;
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

/** Quantos pontos (px do documento) têm tinta, olhando uma janelinha de 5 × 5 em volta. */
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

/** Desenha passando pelos pontos (com um tremor leve) e segura parado `segurar` ms no fim. */
async function desenhar(page: Page, pontos: { x: number; y: number }[], segurar: number) {
  const inicio = await pontoNaTela(page, pontos[0].x, pontos[0].y);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  for (const [i, ponto] of pontos.entries()) {
    const tremor = i % 2 ? 1.5 : -1.5;
    const tela = await pontoNaTela(page, ponto.x + tremor, ponto.y - tremor);
    await page.mouse.move(tela.x, tela.y);
  }
  await page.waitForTimeout(segurar);
  await page.mouse.up();
}

function circulo(cx: number, cy: number, raio: number) {
  return Array.from({ length: 73 }, (_, i) => {
    const t = (i / 72) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + Math.cos(t) * raio, y: cy + Math.sin(t) * raio };
  });
}

async function abrir(page: Page, atalho: string) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press(atalho);
}

const historico = (page: Page, rotulo: string) =>
  page.locator('.history-list').getByText(rotulo, { exact: true });

test('círculo à mão + segurar vira elipse editável; Enter confirma e volta ao lápis', async ({
  page,
}) => {
  await abrir(page, 'p');
  await desenhar(page, circulo(400, 300, 120), 900);
  await expect(page.getByText('Virou um círculo! Enter confirma, Esc desfaz.')).toBeVisible();
  // A forma está pendente, com as alças: ainda nada no papel nem no histórico.
  await expect(page.getByText('Arraste a forma ou suas alças', { exact: false })).toBeVisible();
  expect(await pintados(page, [{ x: 400, y: 180 }])).toBe(0);
  await page.keyboard.press('Enter');
  await expect(historico(page, 'Elipse')).toHaveCount(1);
  await expect(historico(page, 'Traço de lápis')).toHaveCount(0);
  // Um círculo certinho: os quatro pontos do raio estão pintados, o centro não.
  expect(
    await pintados(page, [
      { x: 400, y: 180 },
      { x: 520, y: 300 },
      { x: 400, y: 420 },
      { x: 280, y: 300 },
    ]),
  ).toBe(4);
  expect(await pintados(page, [{ x: 400, y: 300 }])).toBe(0);
  // De volta ao lápis: o próximo traço é um traço comum.
  await desenhar(
    page,
    [
      { x: 700, y: 100 },
      { x: 760, y: 160 },
      { x: 720, y: 200 },
    ],
    0,
  );
  await expect(historico(page, 'Traço de lápis')).toHaveCount(1);
});

test('retângulo com o pincel: Esc volta ao traço como foi desenhado', async ({ page }) => {
  await abrir(page, 'b');
  const lados = [
    { x: 200, y: 150 },
    { x: 500, y: 150 },
    { x: 500, y: 350 },
    { x: 200, y: 350 },
    { x: 200, y: 155 },
  ];
  const caminho = lados.slice(1).flatMap((fim, i) => {
    const inicio = lados[i];
    return Array.from({ length: 12 }, (_, k) => ({
      x: inicio.x + ((fim.x - inicio.x) * (k + 1)) / 12,
      y: inicio.y + ((fim.y - inicio.y) * (k + 1)) / 12,
    }));
  });
  await desenhar(page, [lados[0], ...caminho], 900);
  await expect(page.getByText('Virou um retângulo! Enter confirma, Esc desfaz.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Voltou ao traço como você desenhou.')).toBeVisible();
  await expect(historico(page, 'Pincelada')).toHaveCount(1);
  await expect(historico(page, 'Retângulo')).toHaveCount(0);
});

test('soltar logo, sem segurar, deixa o traço como está; desligado não reconhece', async ({
  page,
}) => {
  await abrir(page, 'p');
  await desenhar(page, circulo(300, 300, 100), 0);
  await expect(historico(page, 'Traço de lápis')).toHaveCount(1);
  await page.getByRole('button', { name: 'Formas inteligentes', exact: true }).click();
  await page.locator('.drawing-canvas').focus();
  await desenhar(page, circulo(650, 300, 100), 900);
  await expect(historico(page, 'Traço de lápis')).toHaveCount(2);
  await expect(page.getByText(/Virou/)).toHaveCount(0);
});
