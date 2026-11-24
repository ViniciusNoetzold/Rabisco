import { expect, test, type Page } from '@playwright/test';

const vermelho = [226, 75, 75];
const azul = [48, 131, 197];

async function abrirEditor(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
}

async function selecionarForma(page: Page, nome: string) {
  await page.getByRole('button', { name: 'Mais formas', exact: true }).click();
  await page.getByRole('menuitemradio', { name: nome, exact: true }).click();
}

async function abrirEditorDeFormas(page: Page) {
  await page.getByRole('button', { name: 'Mais formas', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Criar forma…', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de formas' });
  await expect(editor).toBeVisible();
  return editor;
}

async function posicao(page: Page, [x, y]: number[]) {
  return page.locator('.drawing-canvas').evaluate(
    (elemento, ponto) => {
      const tela = elemento as HTMLCanvasElement;
      const caixa = tela.getBoundingClientRect();
      return {
        x: caixa.x + (ponto.x * caixa.width) / tela.width,
        y: caixa.y + (ponto.y * caixa.height) / tela.height,
      };
    },
    { x, y },
  );
}

async function arrastar(page: Page, de: number[], ate: number[]) {
  const inicio = await posicao(page, de);
  const fim = await posicao(page, ate);
  await page.mouse.move(inicio.x, inicio.y);
  await page.mouse.down();
  await page.mouse.move(fim.x, fim.y, { steps: 12 });
  await page.mouse.up();
}

async function clicar(page: Page, ponto: number[]) {
  const tela = await posicao(page, ponto);
  await page.mouse.click(tela.x, tela.y);
}

/** Ignora a marquise e mede somente pixels da tinta da forma. */
function medirCor(page: Page, seletor: string, cor: number[]) {
  return page.locator(seletor).evaluate((elemento, rgb) => {
    const tela = elemento as HTMLCanvasElement;
    const { width, height } = tela;
    const { data } = tela.getContext('2d')!.getImageData(0, 0, width, height);
    let esquerda = width;
    let direita = -1;
    let topo = height;
    let base = -1;
    let quantidade = 0;
    for (let p = 0; p < width * height; p++) {
      const i = p * 4;
      if (
        data[i] !== rgb[0] ||
        data[i + 1] !== rgb[1] ||
        data[i + 2] !== rgb[2] ||
        data[i + 3] !== 255
      )
        continue;
      const x = p % width;
      const y = Math.floor(p / width);
      esquerda = Math.min(esquerda, x);
      direita = Math.max(direita, x);
      topo = Math.min(topo, y);
      base = Math.max(base, y);
      quantidade++;
    }
    return {
      x: esquerda,
      y: topo,
      largura: direita - esquerda + 1,
      altura: base - topo + 1,
      quantidade,
    };
  }, cor);
}

test('cria uma estrela própria de sete pontas, recupera a predefinição e usa no desenho', async ({
  page,
}) => {
  await abrirEditor(page);
  const nome = 'Estrela da Ana';
  const editor = await abrirEditorDeFormas(page);
  await editor
    .getByRole('combobox', { name: 'Base', exact: true })
    .selectOption({ label: 'Estrela' });
  await editor.getByRole('spinbutton', { name: 'Pontas', exact: true }).fill('7');
  await editor.getByRole('textbox', { name: 'Nome da forma', exact: true }).fill(nome);
  await editor.getByRole('button', { name: 'Salvar forma', exact: true }).click();
  await expect(editor).toBeHidden();

  await page.reload();
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
  await selecionarForma(page, nome);
  await arrastar(page, [160, 150], [320, 320]);
  await expect(page.locator('.workspace[data-forma-pendente]')).toBeVisible();
  expect((await medirCor(page, '.preview-canvas', azul)).quantidade).toBeGreaterThan(300);
  expect((await medirCor(page, '.drawing-canvas', azul)).quantidade).toBe(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('.history-list').getByText(nome, { exact: true })).toBeVisible();
  expect((await medirCor(page, '.drawing-canvas', azul)).quantidade).toBeGreaterThan(300);
  await page.keyboard.press('Control+z');
  expect((await medirCor(page, '.drawing-canvas', azul)).quantidade).toBe(0);
});

test('edita posição, tamanho e rotação de uma estrela antes de confirmar uma única edição', async ({
  page,
}) => {
  await abrirEditor(page);
  await selecionarForma(page, 'Estrela de 5 pontas');
  await page.getByRole('button', { name: 'Selecionar Cor 2', exact: true }).click();
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  await page.getByRole('combobox', { name: 'Preenchimento', exact: true }).selectOption('solid');

  await arrastar(page, [155, 160], [305, 285]);
  const rascunho = page.locator('.workspace[data-forma-pendente]');
  await expect(rascunho).toBeVisible();
  const desenho = '.drawing-canvas';
  const previa = '.preview-canvas';
  const inicial = await medirCor(page, previa, vermelho);
  expect(inicial.quantidade).toBeGreaterThan(1000);
  expect((await medirCor(page, desenho, vermelho)).quantidade).toBe(0);
  const historico = page.locator('.history-list').getByText('Estrela de 5 pontas', { exact: true });
  await expect(historico).toHaveCount(0);

  await arrastar(page, [230, 223], [255, 238]);
  const movida = await medirCor(page, previa, vermelho);
  expect(movida.x - inicial.x).toBeGreaterThan(18);
  expect(movida.y - inicial.y).toBeGreaterThan(10);

  await arrastar(page, [330, 300], [420, 320]);
  const maior = await medirCor(page, previa, vermelho);
  expect(maior.largura - movida.largura).toBeGreaterThan(65);
  const zoom = await page
    .locator(desenho)
    .evaluate(
      (elemento) => elemento.getBoundingClientRect().width / (elemento as HTMLCanvasElement).width,
    );
  const centroX = 300;
  const centroY = 247;
  const yAlca = 175 - 26 / zoom;
  await arrastar(page, [centroX, yAlca], [centroX + centroY - yAlca, centroY]);
  const girada = await medirCor(page, previa, vermelho);
  expect(girada.largura).toBeLessThan(maior.largura - 45);
  expect(girada.altura).toBeGreaterThan(maior.altura + 45);

  await page.keyboard.press('Enter');
  await expect(rascunho).toHaveCount(0);
  await expect(historico).toHaveCount(1);
  const confirmada = await medirCor(page, desenho, vermelho);
  expect(confirmada).toEqual(girada);
  await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true }).click();
  expect((await medirCor(page, desenho, vermelho)).quantidade).toBe(0);
  await page.getByRole('button', { name: 'Refazer (Ctrl+Y)', exact: true }).click();
  expect(await medirCor(page, desenho, vermelho)).toEqual(confirmada);
});

test('atualiza contorno e preenchimento na forma provisória e descarta com Esc', async ({
  page,
}) => {
  await abrirEditor(page);
  await page.getByRole('button', { name: 'Retângulo', exact: true }).click();
  await arrastar(page, [120, 150], [295, 250]);
  const previa = '.preview-canvas';
  const contorno = await medirCor(page, previa, azul);
  await page.getByRole('combobox', { name: 'Contorno', exact: true }).selectOption('dash');
  expect((await medirCor(page, previa, azul)).quantidade).toBeLessThan(contorno.quantidade);
  await page.getByRole('button', { name: 'Selecionar Cor 2', exact: true }).click();
  await page.getByRole('button', { name: 'Usar cor #e24b4b', exact: true }).click();
  await page.getByRole('combobox', { name: 'Preenchimento', exact: true }).selectOption('solid');
  expect((await medirCor(page, previa, vermelho)).quantidade).toBeGreaterThan(1000);
  const centro = await posicao(page, [200, 195]);
  await page.mouse.move(centro.x, centro.y);
  await page.mouse.down();
  await page.mouse.move(centro.x + 20, centro.y + 10);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.workspace[data-forma-pendente]')).toHaveCount(0);
  expect((await medirCor(page, '.drawing-canvas', vermelho)).quantidade).toBe(0);
  await expect(page.getByRole('button', { name: 'Desfazer (Ctrl+Z)', exact: true })).toBeDisabled();
});

test('confirma uma curva com dois controles e fecha o polígono pelo primeiro vértice', async ({
  page,
}) => {
  await abrirEditor(page);
  await selecionarForma(page, 'Curva');
  await arrastar(page, [130, 150], [340, 150]);
  await arrastar(page, [180, 50], [185, 70]);
  await arrastar(page, [265, 215], [280, 230]);
  const previa = await medirCor(page, '.preview-canvas', azul);
  expect(previa.altura).toBeGreaterThan(25);
  await page.keyboard.press('Enter');
  await expect(page.locator('.history-list').getByText('Curva', { exact: true })).toHaveCount(1);

  await selecionarForma(page, 'Polígono livre');
  await clicar(page, [120, 270]);
  await page.keyboard.down('Shift');
  await clicar(page, [250, 282]);
  await page.keyboard.up('Shift');
  await clicar(page, [185, 365]);
  await clicar(page, [120, 270]);
  await expect(page.locator('.workspace[data-forma-pendente]')).toBeVisible();
  await clicar(page, [440, 350]);
  await expect(
    page.locator('.history-list').getByText('Polígono livre', { exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Elipse', exact: true }).click();
  await arrastar(page, [400, 120], [500, 200]);
  await page.getByRole('button', { name: 'Pincel (B)', exact: true }).click();
  await expect(page.locator('.workspace[data-forma-pendente]')).toHaveCount(0);
  await expect(page.locator('.history-list').getByText('Elipse', { exact: true })).toHaveCount(1);
});

test('renderiza todas as miniaturas do catálogo como na referência visual', async ({ page }) => {
  await abrirEditor(page);
  const faltando = await page.evaluate(async () => {
    const caminhoCatalogo = '/src/shapes/catalogo.ts';
    const caminhoRender = '/src/shapes/render.ts';
    const { FORMAS } = await import(caminhoCatalogo);
    const { desenharMiniatura } = await import(caminhoRender);
    // Uma grade pequena e sem texto deixa o snapshot independente de fontes e menus.
    const colunas = 8;
    const celula = 44;
    const tela = document.createElement('canvas');
    tela.id = 'referencia-catalogo';
    tela.width = colunas * celula;
    tela.height = Math.ceil(FORMAS.length / colunas) * celula;
    tela.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:100;display:block';
    document.body.append(tela);
    const grafico = tela.getContext('2d', { willReadFrequently: true })!;
    grafico.fillStyle = '#ffffff';
    grafico.fillRect(0, 0, tela.width, tela.height);
    const semTinta: string[] = [];
    FORMAS.forEach(({ id }: { id: string }, indice: number) => {
      const x = (indice % colunas) * celula;
      const y = Math.floor(indice / colunas) * celula;
      desenharMiniatura(grafico, id, { x: x + 7, y: y + 7, width: 30, height: 30 });
      if (grafico.getImageData(x, y, celula, celula).data.every((byte) => byte === 255))
        semTinta.push(id);
    });
    return semTinta;
  });
  expect(faltando).toEqual([]);
  await expect(page.locator('#referencia-catalogo')).toHaveScreenshot('catalogo.png', {
    scale: 'css',
    maxDiffPixelRatio: 0.015,
  });
});
