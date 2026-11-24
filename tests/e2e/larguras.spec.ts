import { expect, test, type Page } from '@playwright/test';

const LARGURAS = [
  { width: 800, height: 600 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

async function abrir(page: Page, tamanho: { width: number; height: number }) {
  await page.setViewportSize(tamanho);
  await page.goto('/');
  await expect(page.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible();
}

/** Problemas de layout medidos na página: rolagem, botões sobre rótulos, título sob o ⓘ. */
async function problemasDeLayout(page: Page) {
  return page.evaluate(() => {
    const problemas: string[] = [];
    const raiz = document.documentElement;
    if (raiz.scrollWidth > innerWidth) problemas.push(`página rola: ${raiz.scrollWidth}px`);
    const ribbon = document.querySelector<HTMLElement>('.ribbon')!;
    if (ribbon.scrollWidth > ribbon.clientWidth + 1)
      problemas.push(`ribbon transborda: ${ribbon.scrollWidth} > ${ribbon.clientWidth}`);
    const direitaDoRibbon = ribbon.getBoundingClientRect().right;
    for (const grupo of ribbon.querySelectorAll<HTMLElement>(':scope > .ribbon-group')) {
      const nome = grupo.getAttribute('aria-label');
      const caixa = grupo.getBoundingClientRect();
      if (caixa.right > direitaDoRibbon + 1) problemas.push(`${nome} passa da borda`);
      const rotulo = grupo.querySelector(':scope > .ribbon-group-label');
      if (!rotulo) continue;
      const topoDoRotulo = rotulo.getBoundingClientRect().top;
      for (const controle of grupo.querySelectorAll<HTMLElement>(
        ':scope > .ribbon-group-content :is(button, select, input)',
      )) {
        const { bottom, width } = controle.getBoundingClientRect();
        if (width > 0 && bottom > topoDoRotulo + 1)
          problemas.push(
            `${nome}: "${controle.getAttribute('aria-label') ?? controle.textContent?.trim()}" invade o rótulo`,
          );
      }
    }
    const titulo = document.querySelector('.document-title');
    const sobre = document.querySelector('.about-top')!.getBoundingClientRect();
    if (titulo && getComputedStyle(titulo).display !== 'none') {
      const caixa = titulo.getBoundingClientRect();
      if (caixa.right > sobre.left) problemas.push('título passa por baixo do botão Sobre');
    }
    return problemas;
  });
}

for (const tamanho of LARGURAS) {
  test(`interface sem rolagem nem sobreposição em ${tamanho.width} × ${tamanho.height}`, async ({
    page,
  }) => {
    await abrir(page, tamanho);
    expect(await problemasDeLayout(page)).toEqual([]);
    for (const aba of ['Exibir', 'Início']) {
      await page.getByRole('tab', { name: aba, exact: true }).click();
      expect(await problemasDeLayout(page), `aba ${aba}`).toEqual([]);
    }
    // Ferramentas com grupo contextual mais largo (balde e borracha).
    for (const atalho of ['f', 'e', 'a']) {
      await page.locator('.drawing-canvas').focus();
      await page.keyboard.press(atalho);
      expect(await problemasDeLayout(page), `ferramenta ${atalho}`).toEqual([]);
    }
    await page.keyboard.press('b');
    await expect(page.locator('header.app-title-bar, .tab-bar, .ribbon')).toHaveCount(3);
    await expect(page.locator('.app-shell')).toHaveScreenshot(`interface-${tamanho.width}.png`, {
      clip: { x: 0, y: 0, width: tamanho.width, height: 200 },
      mask: [page.locator('.toast')],
      maxDiffPixelRatio: 0.01,
    });
  });
}

test('em 800 px os grupos recolhidos abrem um painel e as ferramentas continuam usáveis', async ({
  page,
}) => {
  await abrir(page, { width: 800, height: 600 });
  const grupo = page.getByRole('button', { name: 'Ferramentas', exact: true });
  await expect(grupo).toBeVisible();
  await grupo.click();
  const painel = page.getByRole('group', { name: 'Ferramentas', exact: true });
  await expect(painel).toBeVisible();
  await painel.getByRole('button', { name: 'Lápis (P)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lápis (P)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden();

  // Ao alargar a janela, os grupos voltam a aparecer abertos.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(page.getByRole('button', { name: 'Ferramentas', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lápis (P)', exact: true })).toBeVisible();
});

test('o painel do ateliê fecha sozinho abaixo de 1100 px e respeita quem reabre', async ({
  page,
}) => {
  await abrir(page, { width: 1366, height: 768 });
  await expect(page.locator('.studio-panel')).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('.studio-panel')).toBeHidden();
  await page.getByRole('tab', { name: 'Exibir', exact: true }).click();
  await page.getByText('Painel do ateliê', { exact: true }).click();
  await expect(page.locator('.studio-panel')).toBeVisible();
  await page.setViewportSize({ width: 1050, height: 768 });
  await expect(page.locator('.studio-panel')).toBeVisible();
});

test('arrastar a alça do papel não seleciona texto da página', async ({ page }) => {
  await abrir(page, { width: 1366, height: 768 });
  const alca = page.getByRole('button', { name: 'Redimensionar papel pelo canto', exact: true });
  const caixa = (await alca.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.mouse.move(caixa.x - 200, caixa.y + 60, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');
});
