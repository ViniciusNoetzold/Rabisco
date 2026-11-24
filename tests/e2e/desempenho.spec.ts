import { expect, test } from '@playwright/test';

test('mede os quadros de uma pincelada em papel de 4000 × 4000 px', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  const formulario = page.getByRole('dialog');
  await formulario.getByLabel('Largura (px)', { exact: true }).fill('4000');
  await formulario.getByLabel('Altura (px)', { exact: true }).fill('4000');
  await formulario.getByRole('button', { name: 'Criar desenho', exact: true }).click();
  const tela = page.locator('.drawing-canvas');
  await expect(tela).toHaveAttribute('width', '4000');
  await expect(tela).toHaveAttribute('height', '4000');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  const visivel = await tela.evaluate((canvas) => {
    const papel = canvas.getBoundingClientRect();
    const viewport = canvas.closest('.workspace')!.getBoundingClientRect();
    const x = Math.max(papel.left, viewport.left);
    const y = Math.max(papel.top, viewport.top);
    return {
      x,
      y,
      largura: Math.min(papel.right, viewport.right) - x,
      altura: Math.min(papel.bottom, viewport.bottom) - y,
    };
  });

  const medicao = page.evaluate(
    () =>
      new Promise<number[]>((resolver) => {
        const canvas = document.querySelector('canvas.drawing-canvas')!;
        canvas.addEventListener(
          'pointerdown',
          () => {
            let anterior: number | undefined;
            let terminou = false;
            const intervalos: number[] = [];
            canvas.addEventListener(
              'pointerup',
              () => {
                terminou = true;
              },
              { once: true, capture: true },
            );
            function quadro(tempo: number) {
              if (anterior !== undefined) intervalos.push(tempo - anterior);
              anterior = tempo;
              if (terminou) resolver(intervalos);
              else requestAnimationFrame(quadro);
            }
            requestAnimationFrame(quadro);
          },
          { once: true, capture: true },
        );
      }),
  );
  // A avaliação anterior instala o medidor antes do primeiro evento de mouse.
  await page.evaluate(() => void 0);

  const x0 = visivel.x + visivel.largura * 0.15;
  const y0 = visivel.y + visivel.altura * 0.43;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const passos = 80;
  for (let i = 1; i <= passos; i++) {
    const x = x0 + visivel.largura * ((0.7 * i) / passos);
    const y = y0 + Math.sin((i * Math.PI) / 18) * visivel.altura * 0.09;
    await page.mouse.move(x, y);
    await page.evaluate(
      () => new Promise<void>((resolver) => requestAnimationFrame(() => resolver())),
    );
  }
  await page.mouse.up();

  const intervalos = (await medicao).filter((tempo) => tempo > 0).sort((a, b) => a - b);
  expect(intervalos.length).toBeGreaterThan(20);
  const media = intervalos.reduce((soma, tempo) => soma + tempo, 0) / intervalos.length;
  const p95 = intervalos[Math.ceil(intervalos.length * 0.95) - 1];
  console.log(
    `Pincel 4000×4000 — ${intervalos.length} quadros, média ${media.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, máximo ${intervalos.at(-1)!.toFixed(2)} ms.`,
  );

  await expect(page.locator('.history-list').getByText('Pincelada', { exact: true })).toHaveCount(
    1,
  );
  const temTinta = await tela.evaluate(
    (elemento, ponto) => {
      const canvas = elemento as HTMLCanvasElement;
      const caixa = canvas.getBoundingClientRect();
      const x = Math.round(((ponto.x - caixa.left) * canvas.width) / caixa.width);
      const y = Math.round(((ponto.y - caixa.top) * canvas.height) / caixa.height);
      const pixels = canvas.getContext('2d')!.getImageData(x - 4, y - 4, 9, 9).data;
      return pixels.some((valor, i) => i % 4 !== 3 && valor < 240);
    },
    { x: x0, y: y0 },
  );
  expect(temTinta).toBe(true);
});
