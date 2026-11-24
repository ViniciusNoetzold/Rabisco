// Gera as imagens do README: `node scripts/capturas.mjs` (Edge instalado; sobe um Vite próprio).
import { chromium } from '@playwright/test';
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
  console.log('Capturas salvas em docs/imagens');
} finally {
  await navegador.close();
  await servidor.close();
}
