import { expect, test, type Page } from '@playwright/test';
import { isolarAreaDeTransferencia } from './fixtures/clipboard';

const VERMELHO = [226, 75, 75, 255];
const VERDE = [112, 165, 74, 255];
const BRANCO = [255, 255, 255, 255];
const PREVIA = '.workspace[data-colagem-pendente]';

test.beforeEach(async ({ context }) => {
  await isolarAreaDeTransferencia(context);
});

async function abrirEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  return page.locator('.drawing-canvas');
}

function imagemPng(page: Page, largura: number, altura: number, cor: string, borda?: string) {
  return page.evaluate(
    ({ largura, altura, cor, borda }) => {
      const tela = document.createElement('canvas');
      tela.width = largura;
      tela.height = altura;
      const contexto = tela.getContext('2d')!;
      contexto.fillStyle = cor;
      contexto.fillRect(0, 0, largura, altura);
      if (borda) {
        contexto.fillStyle = borda;
        contexto.fillRect(largura - 10, 0, 10, altura);
      }
      return tela.toDataURL('image/png').split(',')[1];
    },
    { largura, altura, cor, borda },
  );
}

async function transferir(page: Page, png: string, evento: 'paste' | 'drop') {
  await page.evaluate(
    ({ png, evento }) => {
      const dados = new DataTransfer();
      const bytes = Uint8Array.from(atob(png), (byte) => byte.charCodeAt(0));
      dados.items.add(new File([bytes], 'Amostra.png', { type: 'image/png' }));
      const argumentos = { bubbles: true, cancelable: true };
      if (evento === 'paste') {
        document
          .querySelector('.drawing-canvas')!
          .dispatchEvent(new ClipboardEvent('paste', { ...argumentos, clipboardData: dados }));
      } else {
        document
          .querySelector('.workspace')!
          .dispatchEvent(new DragEvent('drop', { ...argumentos, dataTransfer: dados }));
      }
    },
    { png, evento },
  );
}

async function pontoNaSelecao(page: Page) {
  return page.locator('.selection-marquee').evaluate((selecao) => {
    const tela = document.querySelector<HTMLCanvasElement>('.drawing-canvas')!;
    const papel = tela.getBoundingClientRect();
    const area = selecao.getBoundingClientRect();
    return {
      x: Math.round(((area.left - papel.left) * tela.width) / papel.width) + 5,
      y: Math.round(((area.top - papel.top) * tela.height) / papel.height) + 5,
    };
  });
}

function pixel(page: Page, ponto: { x: number; y: number }) {
  return page.locator('.drawing-canvas').evaluate((elemento, { x, y }) => {
    const tela = elemento as HTMLCanvasElement;
    return [...tela.getContext('2d')!.getImageData(x, y, 1, 1).data];
  }, ponto);
}

test(
  'recebe o evento de colagem, permite cancelar a prévia e confirma no histórico',
  { tag: '@colagem' },
  async ({ page }) => {
    const tela = await abrirEditor(page);
    const png = await imagemPng(page, 28, 22, '#e24b4b');
    const previa = page.locator(PREVIA);
    // Desde a 0.3 a imagem de fora vira uma camada nova ao confirmar.
    const historico = page.locator('.history-list').getByText('Nova camada', { exact: true });
    await tela.focus();
    await transferir(page, png, 'paste');
    await expect(previa).toBeVisible();
    const ponto = await pontoNaSelecao(page);
    await expect(historico).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(previa).toHaveCount(0);
    expect(await pixel(page, ponto)).toEqual(BRANCO);

    await transferir(page, png, 'paste');
    await expect(previa).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(historico).toHaveCount(1);
    expect(await pixel(page, ponto)).toEqual(VERMELHO);
    await page.keyboard.press('Control+z');
    await expect.poll(() => pixel(page, ponto)).toEqual(BRANCO);
  },
);

test(
  'pergunta se deve ampliar o papel ao colar uma imagem maior que ele',
  { tag: '@colagem' },
  async ({ page }) => {
    const tela = await abrirEditor(page);
    const png = await imagemPng(page, 1110, 32, '#70a54a', '#e24b4b');
    const abrirArquivo = async () => {
      const [seletor] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: 'Colar de…', exact: true }).click(),
      ]);
      await seletor.setFiles({
        name: 'Imagem larga.png',
        mimeType: 'image/png',
        buffer: Buffer.from(png, 'base64'),
      });
    };
    const dialogo = page.getByRole('dialog', { name: 'Aumentar o papel para caber?' });
    const previa = page.locator(PREVIA);
    const historico = page.locator('.history-list').getByText('Colar seleção', { exact: true });

    await abrirArquivo();
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Não', exact: true }).click();
    await expect(dialogo).toBeHidden();
    await expect(previa).toBeVisible();
    const pontoCortado = await pontoNaSelecao(page);
    await tela.focus();
    await page.keyboard.press('Enter');
    await expect(historico).toHaveCount(1);
    await expect(tela).toHaveAttribute('width', '1024');
    expect(await pixel(page, { x: 1023, y: pontoCortado.y })).toEqual(VERDE);

    await abrirArquivo();
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Sim', exact: true }).click();
    await expect(dialogo).toBeHidden();
    await expect(previa).toBeVisible();
    const ponto = await pontoNaSelecao(page);
    await tela.focus();
    await page.keyboard.press('Enter');
    await expect(historico).toHaveCount(2);
    await expect(tela).toHaveAttribute('width', '1110');
    expect(await pixel(page, { x: 1105, y: ponto.y })).toEqual(VERMELHO);
  },
);

test(
  'solta uma imagem no papel, copia como PNG e lê a imagem do botão Colar',
  { tag: '@colagem' },
  async ({ page }) => {
    const tela = await abrirEditor(page);
    const png = await imagemPng(page, 26, 20, '#e24b4b');
    const previa = page.locator(PREVIA);
    await tela.focus();
    await transferir(page, png, 'drop');
    await expect(previa).toBeVisible();
    const ponto = await pontoNaSelecao(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => pixel(page, ponto)).toEqual(VERMELHO);

    await page.keyboard.press('Control+a');
    await page.getByRole('button', { name: 'Copiar', exact: true }).click();
    await expect(page.getByText('Seleção copiada como PNG.', { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const [item] = await navigator.clipboard.read();
          if (!item) return [];
          const arquivo = await item.getType('image/png');
          return [...new Uint8Array(await arquivo.slice(0, 8).arrayBuffer())];
        }),
      )
      .toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const nova = await imagemPng(page, 15, 13, '#70a54a');
    await page.evaluate(async (png) => {
      const bytes = Uint8Array.from(atob(png), (byte) => byte.charCodeAt(0));
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) }),
      ]);
    }, nova);
    await page.getByRole('button', { name: 'Colar', exact: true }).click();
    await expect(previa).toBeVisible();
    const outroPonto = await pontoNaSelecao(page);
    await tela.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => pixel(page, outroPonto)).toEqual(VERDE);
  },
);
