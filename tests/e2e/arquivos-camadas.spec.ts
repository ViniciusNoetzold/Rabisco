import { readFile } from 'node:fs/promises';
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
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}

async function riscar(page: Page, de: [number, number], ate: [number, number]) {
  const inicio = await pontoNaTela(page, ...de);
  const fim = await pontoNaTela(page, ...ate);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fim.x, fim.y, { steps: 8 });
  await page.mouse.up();
}

/** Papel + "Azul" (modo multiplicar, 60%) + "Vermelho" com máscara que esconde a metade de cima. */
async function montarDesenho(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const lista = page.getByRole('listbox', { name: 'Lista de camadas' });
  await page.getByRole('button', { name: '＋ Nova' }).click();
  await lista.getByRole('option', { selected: true }).dblclick();
  await page.getByRole('textbox', { name: 'Nome da camada' }).fill('Azul');
  await page.keyboard.press('Enter');
  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('b');
  await page.getByRole('button', { name: 'Usar cor #3083c5', exact: true }).click();
  for (const y of [100, 110, 120, 130, 140]) await riscar(page, [100, y], [300, y]);
  await page.getByRole('combobox', { name: 'Modo de mesclagem' }).selectOption('multiplicar');

  await page.getByRole('button', { name: '＋ Nova' }).click();
  await lista.getByRole('option', { selected: true }).dblclick();
  await page.getByRole('textbox', { name: 'Nome da camada' }).fill('Vermelho');
  await page.keyboard.press('Enter');
  await page.locator('.drawing-canvas').focus();
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  for (const y of [300, 310, 320, 330, 340]) await riscar(page, [500, y], [700, y]);
  // Seleção da metade de baixo do traço vira a máscara: a metade de cima some.
  await page.keyboard.press('s');
  await riscar(page, [480, 320], [720, 360]);
  await page.getByRole('button', { name: 'Máscara', exact: true }).click();
  await expect.poll(() => pixel(page, 600, 300)).toEqual([255, 255, 255, 255]);
  const amostras = {
    azul: await pixel(page, 200, 120),
    vermelhoVisivel: await pixel(page, 600, 330),
    vermelhoMascarado: await pixel(page, 600, 300),
  };
  expect(amostras.vermelhoVisivel).not.toEqual([255, 255, 255, 255]);
  return amostras;
}

async function salvarComo(page: Page, formato: string, nome: string) {
  await page.keyboard.press('Control+Shift+s');
  const dialogo = page.getByRole('dialog', { name: 'Salvar como', exact: true });
  await dialogo.getByLabel('Nome do arquivo', { exact: true }).fill(nome);
  await dialogo.getByRole('combobox', { name: 'Formato', exact: true }).selectOption(formato);
  const download = page.waitForEvent('download');
  await dialogo.getByRole('button', { name: 'Salvar arquivo', exact: true }).click();
  const arquivo = await download;
  return { nome: arquivo.suggestedFilename(), dados: await readFile(await arquivo.path()) };
}

async function abrir(page: Page, arquivo: { nome: string; dados: Buffer }) {
  // Papel novo antes de abrir, para provar que tudo vem do arquivo.
  await page.keyboard.press('Control+n');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Criar desenho', exact: true })
    .click();
  await expect(
    page.getByRole('listbox', { name: 'Lista de camadas' }).getByRole('option'),
  ).toHaveCount(1);
  await page.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: arquivo.nome,
    mimeType: 'application/octet-stream',
    buffer: arquivo.dados,
  });
}

for (const [formato, extensao, comMascara] of [
  ['rabisco', 'rabisco', true],
  ['psd', 'psd', true],
  ['ora', 'ora', false],
] as const) {
  test(`salva e reabre ${formato.toUpperCase()} com as camadas, nomes, modo e pixels`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const amostras = await montarDesenho(page);
    const arquivo = await salvarComo(page, formato, 'Colagem de teste');
    expect(arquivo.nome).toBe(`Colagem de teste.${extensao}`);
    await abrir(page, arquivo);

    const lista = page.getByRole('listbox', { name: 'Lista de camadas' });
    await expect(lista.getByRole('option')).toHaveCount(3);
    await expect(lista.getByRole('option').nth(0)).toContainText('Vermelho');
    await expect(lista.getByRole('option').nth(1)).toContainText('Azul');
    await lista.getByRole('option').nth(1).click();
    await expect(page.getByRole('combobox', { name: 'Modo de mesclagem' })).toHaveValue(
      'multiplicar',
    );
    // A máscara volta como máscara (.rabisco, PSD) ou aplicada aos pixels (.ora).
    await expect(lista.getByRole('button', { name: 'Máscara de Vermelho' })).toHaveCount(
      comMascara ? 1 : 0,
    );
    await expect.poll(() => pixel(page, 200, 120)).toEqual(amostras.azul);
    await expect.poll(() => pixel(page, 600, 330)).toEqual(amostras.vermelhoVisivel);
    await expect.poll(() => pixel(page, 600, 300)).toEqual(amostras.vermelhoMascarado);
  });
}

test('recusa um .rabisco com manifest quebrado e mantém o desenho atual', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  const zip = await page.evaluate(async () => {
    // ZIP mínimo, sem compressão, com um único arquivo "manifest.json" inválido.
    const nome = new TextEncoder().encode('manifest.json');
    const conteudo = new TextEncoder().encode('{ isto não é json');
    const crc = (() => {
      let c = 0xffffffff;
      for (const byte of conteudo) {
        c ^= byte;
        for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
      }
      return (c ^ 0xffffffff) >>> 0;
    })();
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, conteudo.length, true);
    local.setUint32(22, conteudo.length, true);
    local.setUint16(26, nome.length, true);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, conteudo.length, true);
    central.setUint32(24, conteudo.length, true);
    central.setUint16(28, nome.length, true);
    const tamanhoLocal = 30 + nome.length + conteudo.length;
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true);
    fim.setUint16(8, 1, true);
    fim.setUint16(10, 1, true);
    fim.setUint32(12, 46 + nome.length, true);
    fim.setUint32(16, tamanhoLocal, true);
    const partes = [local.buffer, nome, conteudo, central.buffer, nome, fim.buffer];
    const bytes = new Uint8Array(partes.reduce((t, p) => t + p.byteLength, 0));
    let i = 0;
    for (const parte of partes) {
      bytes.set(new Uint8Array(parte instanceof ArrayBuffer ? parte : parte.buffer), i);
      i += parte.byteLength;
    }
    return Array.from(bytes);
  });
  await page.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: 'quebrado.rabisco',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(zip),
  });
  await expect(page.getByRole('status').filter({ hasText: 'manifest.json' })).toBeVisible();
  await expect(
    page.getByRole('listbox', { name: 'Lista de camadas' }).getByRole('option'),
  ).toHaveCount(1);
});

test('Ctrl+S salva .rabisco e o arquivo aparece em Recentes para reabrir', async ({ page }) => {
  const amostras = await montarDesenho(page);
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await download).suggestedFilename()).toBe('Sem título.rabisco');
  await page.keyboard.press('Control+n');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Criar desenho', exact: true })
    .click();
  await expect.poll(() => pixel(page, 200, 120)).toEqual([255, 255, 255, 255]);

  await page.getByRole('button', { name: 'Arquivo', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Arquivo' });
  await menu.getByRole('menuitem', { name: 'Sem título.rabisco' }).click();
  await expect(
    page.getByRole('listbox', { name: 'Lista de camadas' }).getByRole('option'),
  ).toHaveCount(3);
  await expect.poll(() => pixel(page, 200, 120)).toEqual(amostras.azul);

  await page.getByRole('button', { name: 'Arquivo', exact: true }).click();
  await menu.getByRole('menuitem', { name: 'Limpar recentes' }).click();
  await page.getByRole('button', { name: 'Arquivo', exact: true }).click();
  await expect(menu.getByRole('menuitem', { name: 'Sem título.rabisco' })).toHaveCount(0);
});
