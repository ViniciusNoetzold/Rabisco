import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

const CHAVE_ANONIMA = '0000000000';
const ID_PEDIDO = 'pedido-de-teste';
const NOME_DIALOGO = 'Gerar ou transformar com IA';

type Envio = {
  chave: string | undefined;
  corpo: { source_image?: string; [campo: string]: unknown };
};

async function simularHorde(page: Page, pronto = true) {
  const imagem = await page.evaluate(() => {
    const tela = document.createElement('canvas');
    tela.width = tela.height = 64;
    const contexto = tela.getContext('2d')!;
    contexto.fillStyle = '#203d8b';
    contexto.fillRect(0, 0, tela.width, tela.height);
    return tela.toDataURL('image/webp', 0.95).split(',')[1];
  });
  const fila = {
    pronto,
    envios: [] as Envio[],
    chavesTestadas: [] as (string | undefined)[],
    consultados: 0,
    cancelados: 0,
    resultados: 0,
  };
  await page.route('https://aihorde.net/**', async (rota) => {
    const pedido = rota.request();
    const { pathname } = new URL(pedido.url());
    const metodo = pedido.method();
    const chave = pedido.headers().apikey;
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'apikey, client-agent, content-type',
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    };
    if (metodo === 'OPTIONS') return rota.fulfill({ status: 204, headers });

    if (pathname === '/api/v2/find_user' && metodo === 'GET') {
      fila.chavesTestadas.push(chave);
      return rota.fulfill({ headers, json: { username: 'artista#2' } });
    }
    if (pathname === '/api/v2/generate/async' && metodo === 'POST') {
      fila.envios.push({ chave, corpo: pedido.postDataJSON() });
      return rota.fulfill({ status: 202, headers, json: { id: ID_PEDIDO } });
    }
    if (pathname === `/api/v2/generate/check/${ID_PEDIDO}` && metodo === 'GET') {
      fila.consultados += 1;
      return rota.fulfill({
        headers,
        json: { done: fila.pronto, waiting: fila.pronto ? 0 : 1, queue_position: 3, wait_time: 12 },
      });
    }
    if (pathname === `/api/v2/generate/status/${ID_PEDIDO}` && metodo === 'GET') {
      fila.resultados += 1;
      return rota.fulfill({
        headers,
        json: {
          done: true,
          generations: [{ img: imagem, seed: '42', model: 'Modelo de teste' }],
        },
      });
    }
    if (pathname === `/api/v2/generate/status/${ID_PEDIDO}` && metodo === 'DELETE') {
      fila.cancelados += 1;
      return rota.fulfill({ status: 204, headers });
    }
    await rota.abort();
  });
  return fila;
}

function camadas(page: Page) {
  return page.getByRole('listbox', { name: 'Lista de camadas' });
}

function historico(page: Page, acao: string) {
  return page.locator('.history-list').getByText(acao, { exact: true });
}

function centroDoPapel(page: Page) {
  return page
    .locator('.drawing-canvas')
    .evaluate((tela: HTMLCanvasElement) =>
      Array.from(tela.getContext('2d')!.getImageData(tela.width / 2, tela.height / 2, 1, 1).data),
    );
}

async function abrirIA(page: Page) {
  await page.getByRole('tab', { name: 'IA', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar ou transformar imagem', exact: true }).click();
  return page.getByRole('dialog', { name: NOME_DIALOGO });
}

async function iniciarEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await expect(camadas(page).getByRole('option')).toHaveCount(1);
}

test('gera imagem sem conta, registra uma camada reversível e grava origem no .rabisco', async ({
  page,
}) => {
  const fila = await simularHorde(page);
  await iniciarEditor(page);
  const dialogo = await abrirIA(page);
  await expect(dialogo.getByText(/A fila sem conta tem menor prioridade/)).toBeVisible();
  const prompt = 'Uma lua azul no céu';
  await dialogo.getByLabel('Descrição', { exact: true }).fill(prompt);
  expect(fila.envios).toEqual([]);
  await dialogo.getByRole('button', { name: 'Enviar ao AI Horde', exact: true }).click();
  await expect(dialogo.getByText('Imagem pronta para inserir.', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(camadas(page).getByRole('option')).toHaveCount(1);
  await dialogo.getByRole('button', { name: 'Inserir em nova camada', exact: true }).click();
  await expect(dialogo.getByRole('status')).toHaveText('Imagem adicionada em uma nova camada.', {
    timeout: 15_000,
  });
  await dialogo.getByRole('button', { name: 'Fechar', exact: true }).click();

  expect(fila.envios).toHaveLength(1);
  expect(fila.envios[0]).toMatchObject({ chave: CHAVE_ANONIMA, corpo: { prompt, shared: false } });
  expect(fila.envios[0].corpo.source_image).toBeUndefined();
  expect(fila.consultados).toBe(1);
  expect(fila.resultados).toBe(1);
  const camadaGerada = camadas(page).getByRole('option', { selected: true });
  await expect(camadaGerada).toContainText('Imagem gerada por IA');
  await expect(camadas(page).getByRole('option')).toHaveCount(2);
  await expect(historico(page, 'Gerar imagem com IA')).toHaveCount(1);
  const pixel = await centroDoPapel(page);
  expect(pixel[2]).toBeGreaterThan(pixel[0] + 50);

  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(camadas(page).getByRole('option')).toHaveCount(1);
  await expect.poll(() => centroDoPapel(page)).toEqual([255, 255, 255, 255]);
  await page.keyboard.press('Control+y');
  await expect(camadaGerada).toContainText('Imagem gerada por IA');

  const baixa = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const arquivo = await baixa;
  const dados = await readFile(await arquivo.path());
  const manifest = JSON.parse(strFromU8(unzipSync(dados)['manifest.json']));
  expect(manifest).toMatchObject({
    versao: 4,
    estrutura: {
      camadas: expect.arrayContaining([
        expect.objectContaining({
          origemIA: {
            provedor: 'AI Horde',
            operacao: 'gerar',
            prompt,
            semente: 42,
            modelo: 'Modelo de teste',
          },
        }),
      ]),
    },
  });
  await page.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: arquivo.suggestedFilename(),
    mimeType: 'application/octet-stream',
    buffer: dados,
  });
  await expect(page.getByRole('status').filter({ hasText: 'aberto com 2 camadas' })).toBeVisible();
  await expect(camadaGerada).toContainText('Imagem gerada por IA');
});

test('testa chave própria e envia somente o recorte selecionado como WebP ao transformar', async ({
  page,
}) => {
  const fila = await simularHorde(page);
  await iniciarEditor(page);
  const tela = page.locator('.drawing-canvas');
  await tela.focus();
  await page.keyboard.press('s');
  const [inicio, fim] = await tela.evaluate((elemento: HTMLCanvasElement) => {
    const caixa = elemento.getBoundingClientRect();
    return [
      [120, 120],
      [212, 188],
    ].map(([x, y]) => ({
      x: caixa.x + (x * caixa.width) / elemento.width,
      y: caixa.y + (y * caixa.height) / elemento.height,
    }));
  });
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fim.x, fim.y, { steps: 6 });
  await page.mouse.up();

  const dialogo = await abrirIA(page);
  await dialogo.getByText('Configurar AI Horde', { exact: true }).click();
  await dialogo.getByLabel('Chave de API (opcional)', { exact: true }).fill('chave-ficticia');
  await dialogo.getByRole('button', { name: 'Testar chave', exact: true }).click();
  await expect(dialogo.getByText('Chave válida para artista#2.', { exact: true })).toBeVisible();
  expect(fila.chavesTestadas).toEqual(['chave-ficticia']);
  expect(await page.evaluate(() => localStorage.getItem('rabisco.ia.horde.chave'))).toBeNull();
  await dialogo.getByRole('combobox', { name: 'Modo', exact: true }).selectOption('editar');
  await dialogo.getByLabel('Descrição', { exact: true }).fill('Colorir com azul');
  await dialogo.getByRole('button', { name: 'Enviar ao AI Horde', exact: true }).click();
  await expect(dialogo.getByText('Imagem pronta para inserir.', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await dialogo.getByRole('button', { name: 'Inserir em nova camada', exact: true }).click();
  await expect(
    dialogo.getByText('Imagem adicionada em uma nova camada.', { exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  expect(fila.envios).toHaveLength(1);
  const { corpo, chave } = fila.envios[0];
  expect(chave).toBe('chave-ficticia');
  expect(corpo).toMatchObject({
    source_processing: 'img2img',
    params: { denoising_strength: 0.55 },
  });
  expect(corpo.source_image).toMatch(/^UklGR/);
  const dimensoes = await page.evaluate(async (referencia) => {
    const bytes = Uint8Array.from(atob(referencia ?? ''), (letra) => letra.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
    const tamanho = [bitmap.width, bitmap.height];
    bitmap.close();
    return tamanho;
  }, corpo.source_image);
  expect(dimensoes[0]).toBeGreaterThanOrEqual(90);
  expect(dimensoes[0]).toBeLessThanOrEqual(94);
  expect(dimensoes[1]).toBeGreaterThanOrEqual(66);
  expect(dimensoes[1]).toBeLessThanOrEqual(70);
  await dialogo.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(camadas(page).getByRole('option', { selected: true })).toContainText(
    'Imagem editada por IA',
  );
  await expect(historico(page, 'Editar imagem com IA')).toHaveCount(1);
});

test('cancela um pedido confirmado na fila e mantém o documento sem nova camada', async ({
  page,
}) => {
  const fila = await simularHorde(page, false);
  await iniciarEditor(page);
  const dialogo = await abrirIA(page);
  await dialogo.getByLabel('Descrição', { exact: true }).fill('Uma imagem cancelada');
  await dialogo.getByRole('button', { name: 'Enviar ao AI Horde', exact: true }).click();
  await expect(dialogo.getByRole('status')).toContainText('Na fila do AI Horde');
  await dialogo.getByRole('button', { name: 'Cancelar pedido', exact: true }).click();
  await expect(dialogo.getByRole('status')).toHaveText('Pedido cancelado.');
  expect(fila.cancelados).toBe(1);
  expect(fila.resultados).toBe(0);
  await dialogo.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(camadas(page).getByRole('option')).toHaveCount(1);
  await expect(historico(page, 'Gerar imagem com IA')).toHaveCount(0);
});

test('aguarda ação explícita para inserir um resultado que chega em segundo plano', async ({
  page,
}) => {
  const fila = await simularHorde(page, false);
  await iniciarEditor(page);
  const dialogo = await abrirIA(page);
  await dialogo.getByLabel('Descrição', { exact: true }).fill('Uma imagem em segundo plano');
  await dialogo.getByRole('button', { name: 'Enviar ao AI Horde', exact: true }).click();
  await expect(dialogo.getByRole('status')).toContainText('Na fila do AI Horde');
  await dialogo.getByRole('button', { name: 'Continuar desenhando', exact: true }).click();
  await expect(dialogo).toBeHidden();
  fila.pronto = true;
  await expect(page.getByText('A imagem está pronta. Abra a aba IA para inserir.')).toBeVisible({
    timeout: 15_000,
  });
  await expect(camadas(page).getByRole('option')).toHaveCount(1);
  await abrirIA(page);
  await dialogo.getByRole('button', { name: 'Inserir em nova camada', exact: true }).click();
  await expect(historico(page, 'Gerar imagem com IA')).toHaveCount(1);
});

test('descarta o resultado se a pessoa cria outro desenho enquanto o pedido continua em segundo plano', async ({
  page,
}) => {
  const fila = await simularHorde(page, false);
  await iniciarEditor(page);
  const dialogo = await abrirIA(page);
  await dialogo.getByLabel('Descrição', { exact: true }).fill('Uma imagem para o primeiro papel');
  await dialogo.getByRole('button', { name: 'Enviar ao AI Horde', exact: true }).click();
  await expect(dialogo.getByRole('status')).toContainText('Na fila do AI Horde');
  await dialogo.getByRole('button', { name: 'Continuar desenhando', exact: true }).click();
  await expect(dialogo).toBeHidden();

  await page.locator('.drawing-canvas').focus();
  await page.keyboard.press('Control+n');
  await page.getByRole('button', { name: 'Criar desenho', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  fila.pronto = true;
  await expect(
    page.getByRole('status').filter({ hasText: 'O desenho mudou desde o envio.' }),
  ).toBeVisible({ timeout: 15_000 });
  expect(fila.resultados).toBe(1);
  expect(fila.cancelados).toBe(0);
  await expect(camadas(page).getByRole('option')).toHaveCount(1);
  await expect(historico(page, 'Gerar imagem com IA')).toHaveCount(0);
});
