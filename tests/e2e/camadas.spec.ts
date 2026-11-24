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

test('imagem arrastada flutua e vira camada nova ao confirmar; Mover (V) desloca a camada', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const lista = page.getByRole('listbox', { name: 'Lista de camadas' });
  await page.evaluate(() => {
    const tela = document.createElement('canvas');
    tela.width = 40;
    tela.height = 30;
    const contexto = tela.getContext('2d')!;
    contexto.fillStyle = '#e24b4b';
    contexto.fillRect(0, 0, 40, 30);
    return new Promise<void>((resolver) =>
      tela.toBlob((blob) => {
        const dados = new DataTransfer();
        dados.items.add(new File([blob!], 'Foto da praia.png', { type: 'image/png' }));
        document
          .querySelector('.workspace')!
          .dispatchEvent(
            new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dados }),
          );
        resolver();
      }, 'image/png'),
    );
  });
  await expect(page.locator('[data-colagem-pendente]')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(lista.getByRole('option')).toHaveCount(2);
  await expect(lista.getByRole('option', { selected: true })).toContainText('Foto da praia');
  // A colagem entra a 24 px do canto: o pixel (30, 30) fica vermelho.
  await expect.poll(() => pixel(page, 30, 30)).toEqual([226, 75, 75, 255]);

  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('v');
  const de = await pontoNaTela(page, 30, 30);
  const ate = await pontoNaTela(page, 230, 130);
  await page.mouse.move(de.x, de.y);
  await page.mouse.down();
  await page.mouse.move(ate.x, ate.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => pixel(page, 30, 30)).toEqual(BRANCO);
  await expect.poll(() => pixel(page, 230, 130)).toEqual([226, 75, 75, 255]);
  await page.keyboard.press('Control+z');
  await expect.poll(() => pixel(page, 30, 30)).toEqual([226, 75, 75, 255]);
});

test('virar adesivo dá contorno branco por fora e desfaz em um passo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  // Papel escuro para o contorno branco aparecer.
  await page.locator('.drawing-canvas').focus();
  await page.getByRole('button', { name: 'Usar cor #252a34', exact: true }).click();
  await page.keyboard.press('f');
  const canto = await pontoNaTela(page, 5, 5);
  await page.mouse.click(canto.x, canto.y);
  await expect.poll(() => pixel(page, 5, 5)).toEqual([37, 42, 52, 255]);

  await page.getByRole('button', { name: '＋ Nova' }).click();
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  await page.keyboard.press('r');
  await riscar(page, [200, 200], [300, 280]);
  await page.keyboard.press('Enter');
  await page.getByText('Efeitos e máscara').click();
  await page.getByRole('button', { name: '✨ Virar adesivo' }).click();
  // Logo à esquerda do retângulo: contorno branco por fora.
  await expect.poll(() => pixel(page, 194, 240)).toEqual(BRANCO);
  await page.keyboard.press('Control+z');
  await expect.poll(() => pixel(page, 194, 240)).toEqual([37, 42, 52, 255]);
});

test('transformação livre: escala pela alça, move, confirma com Enter e desfaz', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '＋ Nova' }).click();
  await page.locator('.drawing-canvas').focus();
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  await page.keyboard.press('b');
  // Um bloco de traços (60 × 46 px) para haver "dentro" longe das alças.
  for (const y of [200, 210, 220, 230, 240]) await riscar(page, [200, y], [260, y]);
  const vermelho = await pixel(page, 230, 220);
  expect(vermelho).not.toEqual(BRANCO);
  const caixa = await page.evaluate(() => {
    // Limites reais do traço na tela, para achar a alça do canto.
    const tela = document.querySelector<HTMLCanvasElement>('.drawing-canvas')!;
    const { data, width, height } = tela
      .getContext('2d')!
      .getImageData(0, 0, tela.width, tela.height);
    let direita = 0;
    let base = 0;
    let esquerda = width;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) continue;
        direita = Math.max(direita, x);
        base = Math.max(base, y);
        esquerda = Math.min(esquerda, x);
      }
    return { direita: direita + 1, base: base + 1, esquerda };
  });

  await page.keyboard.press('Control+t');
  // Alça do canto inferior direito: arrastar até dobrar a largura (escala a partir do centro).
  const centro = (caixa.esquerda + caixa.direita) / 2;
  const alca = await pontoNaTela(page, caixa.direita, caixa.base);
  const destino = await pontoNaTela(page, centro + (caixa.direita - centro) * 2, caixa.base);
  await page.mouse.move(alca.x, alca.y);
  await page.mouse.down();
  await page.mouse.move(destino.x, destino.y, { steps: 6 });
  await page.mouse.up();
  // Arrasta por dentro para mover 120 px à direita.
  const dentro = await pontoNaTela(page, 215, 210);
  const fim = await pontoNaTela(page, 335, 210);
  await page.mouse.move(dentro.x, dentro.y);
  await page.mouse.down();
  await page.mouse.move(fim.x, fim.y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('Enter');
  await expect(page.locator('.history-list').getByText('Transformação livre')).toHaveCount(1);
  await page.keyboard.press('b');
  // O traço tinha ~66 px; com o dobro de largura e 120 px adiante, cobre x = 380.
  await expect.poll(() => pixel(page, 380, 220)).not.toEqual(BRANCO);
  await expect.poll(() => pixel(page, 205, 220)).toEqual(BRANCO);
  await page.keyboard.press('Control+z');
  await expect.poll(() => pixel(page, 230, 220)).toEqual(vermelho);
  await expect.poll(() => pixel(page, 380, 220)).toEqual(BRANCO);
});
