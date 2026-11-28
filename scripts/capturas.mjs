// Gera as imagens do README: `node scripts/capturas.mjs` (Edge instalado; sobe um Vite próprio).
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createServer } from 'vite';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const pasta = join(raiz, 'docs', 'imagens');
await mkdir(pasta, { recursive: true });
const servidor = await createServer({
  root: raiz,
  server: { host: '127.0.0.1', port: 5175, strictPort: true, hmr: false },
});
await servidor.listen();
const navegador = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });

async function ponto(pagina, x, y) {
  const tela = pagina.locator('.drawing-canvas');
  const caixa = await tela.boundingBox();
  const escala = caixa.width / Number(await tela.getAttribute('width'));
  return { x: caixa.x + x * escala, y: caixa.y + y * escala };
}
async function riscar(pagina, pontos) {
  const [primeiro, ...resto] = pontos;
  const inicio = await ponto(pagina, ...primeiro);
  await pagina.mouse.move(inicio.x, inicio.y);
  await pagina.mouse.down();
  for (const p of resto) {
    const alvo = await ponto(pagina, ...p);
    await pagina.mouse.move(alvo.x, alvo.y, { steps: 6 });
  }
  await pagina.mouse.up();
}
async function cor(pagina, hex) {
  await pagina.getByRole('button', { name: `Usar cor ${hex}`, exact: true }).click();
}

async function abrirPaisagem(pagina) {
  await pagina.goto('http://127.0.0.1:5175/');
  await pagina.getByText('Salvo neste dispositivo', { exact: true }).waitFor();
  const bytes = await pagina.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    const ceu = ctx.createLinearGradient(0, 0, 0, 420);
    ceu.addColorStop(0, '#211433');
    ceu.addColorStop(0.63, '#9d4f6d');
    ceu.addColorStop(1, '#ffbf88');
    ctx.fillStyle = ceu;
    ctx.fillRect(0, 0, 768, 480);

    ctx.fillStyle = '#fbd9cb';
    for (const [x, y] of [
      [38, 53],
      [87, 105],
      [154, 36],
      [225, 72],
      [334, 39],
      [428, 96],
      [647, 57],
      [716, 102],
    ]) {
      ctx.fillRect(x, y, 4, 4);
    }

    ctx.fillStyle = '#ffd188';
    ctx.beginPath();
    ctx.arc(531, 165, 82, 0, 2 * Math.PI);
    ctx.fill();

    function montanha(cor, pontos) {
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.moveTo(...pontos[0]);
      for (const ponto of pontos.slice(1)) ctx.lineTo(...ponto);
      ctx.closePath();
      ctx.fill();
    }

    montanha('#764666', [
      [0, 340],
      [125, 184],
      [217, 260],
      [318, 156],
      [514, 306],
      [663, 178],
      [768, 257],
      [768, 480],
      [0, 480],
    ]);
    montanha('#b16d77', [
      [217, 260],
      [318, 156],
      [350, 224],
      [318, 211],
      [290, 237],
    ]);
    montanha('#674968', [
      [0, 387],
      [94, 280],
      [175, 321],
      [252, 235],
      [370, 335],
      [479, 252],
      [565, 332],
      [702, 231],
      [768, 300],
      [768, 480],
      [0, 480],
    ]);
    montanha('#3f3658', [
      [0, 334],
      [104, 354],
      [165, 393],
      [333, 405],
      [520, 373],
      [634, 309],
      [768, 310],
      [768, 480],
      [0, 480],
    ]);
    montanha('#292843', [
      [0, 412],
      [171, 428],
      [317, 469],
      [567, 408],
      [768, 392],
      [768, 480],
      [0, 480],
    ]);

    const imagem = await new Promise((resolver) => canvas.toBlob(resolver, 'image/png'));
    return Array.from(new Uint8Array(await imagem.arrayBuffer()));
  });
  await pagina.getByLabel('Abrir arquivo de imagem', { exact: true }).setInputFiles({
    name: 'Vale ao anoitecer.png',
    mimeType: 'image/png',
    buffer: Buffer.from(bytes),
  });
  await expect(pagina.locator('.drawing-canvas')).toHaveAttribute('width', '768');
  await pagina.getByText('Salvo neste dispositivo', { exact: true }).waitFor();
}

async function abrirFiltro(pagina, nome) {
  await pagina.getByRole('tab', { name: 'Início', exact: true }).click();
  await pagina.getByRole('button', { name: 'Filtros', exact: true }).click();
  await pagina.getByRole('menuitem', { name: nome, exact: true }).click();
  return pagina.getByRole('dialog', { name: nome, exact: true });
}

async function capturarAscii() {
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await abrirPaisagem(pagina);
    const dialogo = await abrirFiltro(pagina, 'Converter em ASCII');
    await dialogo.getByRole('spinbutton', { name: 'Colunas', exact: true }).fill('68');
    await dialogo
      .getByRole('combobox', { name: 'Conjunto de caracteres' })
      .selectOption('detalhado');
    await dialogo.getByRole('checkbox', { name: 'Colorido', exact: true }).check();
    await expect(dialogo.getByRole('button', { name: 'Criar camada de texto' })).toBeEnabled();
    await expect(dialogo.getByLabel('Prévia ASCII', { exact: true })).toContainText(/\S/);
    await pagina.screenshot({ path: join(pasta, 'rabisco-ascii.png'), animations: 'disabled' });
  } finally {
    await pagina.close();
  }
}

async function capturarPixelArt() {
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await abrirPaisagem(pagina);
    const pixelizar = await abrirFiltro(pagina, 'Pixelizar');
    await pixelizar.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect(pixelizar).not.toBeVisible();

    const reduzir = await abrirFiltro(pagina, 'Reduzir paleta');
    await reduzir.getByRole('combobox', { name: 'Paleta', exact: true }).selectOption('pico-8');
    await reduzir.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect(reduzir).not.toBeVisible();
    await pagina.getByText('Salvo neste dispositivo', { exact: true }).waitFor();

    await pagina.getByRole('tab', { name: 'Exibir', exact: true }).click();
    const modo = pagina.getByRole('checkbox', { name: 'Modo pixel art', exact: true });
    if (!(await modo.isVisible()))
      await pagina.getByRole('button', { name: 'Pixel art', exact: true }).click();
    await modo.check();
    await pagina
      .getByRole('combobox', { name: 'Grade de pixel art', exact: true })
      .selectOption('32');
    await pagina.screenshot({ path: join(pasta, 'rabisco-pixel-art.png'), animations: 'disabled' });
  } finally {
    await pagina.close();
  }
}

try {
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await pagina.goto('http://127.0.0.1:5175/');
  await pagina.getByText('Salvo neste dispositivo', { exact: true }).waitFor();
  const tela = pagina.locator('.drawing-canvas');

  // Céu, sol e grama na camada Papel.
  await tela.focus();
  await cor(pagina, '#b4d8ef');
  await pagina.keyboard.press('f');
  const ceu = await ponto(pagina, 20, 20);
  await pagina.mouse.click(ceu.x, ceu.y);
  await pagina.keyboard.press('b');
  await pagina
    .getByRole('spinbutton')
    .first()
    .fill('40')
    .catch(() => {});
  await cor(pagina, '#70a54a');
  for (const y of [560, 590, 620])
    await riscar(pagina, [
      [0, y],
      [340, y - 20],
      [700, y + 10],
      [1024, y - 10],
    ]);
  await cor(pagina, '#f6c94d');
  for (const r of [10, 25, 40])
    await riscar(
      pagina,
      Array.from({ length: 13 }, (_, i) => [850 + r * Math.cos(i / 2), 130 + r * Math.sin(i / 2)]),
    );

  // Casa numa camada própria, virada em adesivo.
  await pagina.getByRole('button', { name: '＋ Nova' }).click();
  await cor(pagina, '#e24b4b');
  for (const y of [330, 350, 370, 390, 410, 430, 450, 470, 490, 510])
    await riscar(pagina, [
      [300, y],
      [520, y],
    ]);
  await cor(pagina, '#8b604c');
  for (let i = 0; i < 6; i++)
    await riscar(pagina, [
      [290 + i * 6, 320 - i * 14],
      [410, 220 + i * 4],
      [530 - i * 6, 320 - i * 14],
    ]);
  await pagina.getByText('Efeitos e máscara').click();
  await pagina.getByRole('button', { name: '✨ Virar adesivo' }).click();

  // Texto numa camada própria.
  await cor(pagina, '#252a34');
  await pagina.keyboard.press('t');
  const texto = await ponto(pagina, 600, 380);
  await pagina.mouse.click(texto.x, texto.y);
  await pagina.keyboard.type('Meu rabisco!');
  const fora = await ponto(pagina, 900, 600);
  await pagina.mouse.click(fora.x, fora.y);
  await pagina.keyboard.press('b');
  await pagina.waitForTimeout(800);
  await pagina.screenshot({ path: join(pasta, 'rabisco-camadas.png') });

  await pagina.setViewportSize({ width: 820, height: 620 });
  await pagina.waitForTimeout(600);
  await pagina.screenshot({ path: join(pasta, 'rabisco-janela-estreita.png') });
  await pagina.close();

  await capturarAscii();
  await capturarPixelArt();
  console.log('Capturas salvas em docs/imagens');
} finally {
  await navegador.close();
  await servidor.close();
}
