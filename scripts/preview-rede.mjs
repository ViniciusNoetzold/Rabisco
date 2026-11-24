import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const projeto = fileURLToPath(new URL('..', import.meta.url));
const compilacao = join(projeto, 'output', 'compilacao-preview-rede');
const publicado = join(projeto, 'dist');
const pastaRecarga = join(publicado, '__rabisco-preview');

const cliente = `
const versao = new URL(import.meta.url).searchParams.get('v');
const indicador = new URL('./versao.json', import.meta.url);
const ponteirosAtivos = new Set();
window.addEventListener('pointerdown', (e) => ponteirosAtivos.add(e.pointerId), true);
for (const evento of ['pointerup', 'pointercancel']) {
  window.addEventListener(evento, (e) => ponteirosAtivos.delete(e.pointerId), true);
}
window.addEventListener('blur', () => ponteirosAtivos.clear());
async function conferirVersao() {
  try {
    const resposta = await fetch(indicador, { cache: 'no-store' });
    const nova = resposta.ok ? (await resposta.json()).versao : null;
    const status = document.querySelector('.autosave')?.textContent ?? '';
    const ocupado = ponteirosAtivos.size || /Salvando|Recuperando/.test(status) || document.querySelector('dialog[open]');
    if (typeof nova === 'string' && nova !== versao && !ocupado) {
      location.reload();
      return;
    }
  } catch { /* A próxima consulta tenta de novo. */ }
  setTimeout(conferirVersao, 1500);
}
setTimeout(conferirVersao, 1500);
`;

async function trocarArquivo(caminho, conteudo) {
  const temporario = `${caminho}.novo`;
  await writeFile(temporario, conteudo, 'utf8');
  await rename(temporario, caminho);
}

async function publicar() {
  const html = await readFile(join(compilacao, 'index.html'), 'utf8');
  const versao = createHash('sha256').update(html).update(cliente).digest('hex').slice(0, 20);
  await mkdir(pastaRecarga, { recursive: true });

  // A rede recebe os arquivos do build concluído. Deixe os bundles antigos disponíveis
  // para abas que ainda estão carregando a página anterior.
  for (const entrada of await readdir(compilacao, { withFileTypes: true })) {
    if (entrada.name === 'index.html') continue;
    const origem = join(compilacao, entrada.name);
    const destino = join(publicado, entrada.name);
    if (entrada.isDirectory()) await cp(origem, destino, { recursive: true });
    else if (entrada.isFile()) await copyFile(origem, destino);
  }
  await trocarArquivo(join(pastaRecarga, 'recarregar.js'), cliente);
  await trocarArquivo(
    join(publicado, 'index.html'),
    html.replace(
      '</body>',
      `<script type="module" src="/__rabisco-preview/recarregar.js?v=${versao}"></script>\n  </body>`,
    ),
  );
  await trocarArquivo(join(pastaRecarga, 'versao.json'), JSON.stringify({ versao }));
  console.log(`Prévia da rede atualizada (${versao}).`);
}

const observador = await build({
  root: projeto,
  build: { outDir: compilacao, emptyOutDir: true, sourcemap: false, watch: {} },
  plugins: [{ name: 'rabisco-preview-rede', writeBundle: publicar }],
});

// O artefato publicado é independente do processo que observa as alterações.
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.once(sinal, () => void observador.close());
}
