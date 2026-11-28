import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { arch, availableParallelism, cpus, release, totalmem, type } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const papeis = [
  { largura: 1024, altura: 640 },
  { largura: 4000, altura: 4000 },
  { largura: 8192, altura: 4096 },
];
const quantidadeMovimentos = 300;
const endereco = 'http://127.0.0.1:5174';
const canal = process.env.PLAYWRIGHT_CHANNEL || 'msedge';
const data = new Date().toISOString();
const corDoBalde = [48, 131, 197, 255];
const branco = [255, 255, 255, 255];
const corDoBaldeInvertida = [207, 124, 58, 255];

function lerRotulo(argumentos) {
  if (!argumentos.length) return data.replace(/[:.]/g, '-');
  const rotulo = argumentos[0]?.match(/^--rotulo=([a-zA-Z0-9_-]{1,64})$/)?.[1];
  if (argumentos.length !== 1 || !rotulo) {
    throw new Error('Uso: npm run perf -- --rotulo=passo-2');
  }
  return rotulo;
}

function resumir(amostras) {
  const ordenadas = [...amostras].sort((a, b) => a - b);
  const posicao = (fracao) => Math.max(0, Math.ceil(ordenadas.length * fracao) - 1);
  return {
    amostras: ordenadas.length,
    p50: ordenadas[posicao(0.5)],
    p95: ordenadas[posicao(0.95)],
    maximo: ordenadas.at(-1),
  };
}

async function aguardarSalvamento(pagina) {
  await expect(pagina.getByText('Salvo neste dispositivo', { exact: true })).toBeVisible({
    timeout: 40_000,
  });
}

async function recolherEstadoDoAutosave(pagina, aguardar = true) {
  const indicador = pagina.locator('.autosave');
  if (aguardar) {
    await indicador
      .filter({ hasText: /Salvo neste dispositivo|Salve uma cópia em PNG/ })
      .waitFor({ timeout: 15_000 })
      .catch(() => {});
  }
  const estado = (await indicador.innerText()).trim();
  if (estado === 'Salvo neste dispositivo') return 'salvo';
  if (estado === 'Salve uma cópia em PNG') return 'erro';
  if (estado === 'Salvando…') return 'pendente';
  throw new Error(`O editor não ficou disponível no ensaio. Estado do autosave: "${estado}".`);
}

/** Liga a simetria radial de PERF_SIMETRIA fatias ou a desliga (o balde clica no meio do papel,
 * onde fica a alça do centro). */
async function definirSimetria(pagina, ligada) {
  await pagina.getByRole('tab', { name: 'Exibir' }).click();
  const modo = pagina.getByRole('combobox', { name: 'Modo de simetria' });
  await modo.selectOption(ligada ? 'radial' : 'nenhuma');
  if (ligada)
    await pagina
      .getByRole('spinbutton', { name: 'Fatias da simetria radial' })
      .fill(String(process.env.PERF_SIMETRIA));
  await pagina.getByRole('tab', { name: 'Início' }).click();
}

async function criarPapel(pagina, { largura, altura }, simetria = true) {
  await pagina.keyboard.press('Control+n');
  const dialogo = pagina.getByRole('dialog');
  await dialogo.getByLabel('Largura (px)', { exact: true }).fill(String(largura));
  await dialogo.getByLabel('Altura (px)', { exact: true }).fill(String(altura));
  await dialogo.getByRole('button', { name: 'Criar desenho', exact: true }).click();
  const tela = pagina.locator('.drawing-canvas');
  await expect(tela).toHaveAttribute('width', String(largura));
  await expect(tela).toHaveAttribute('height', String(altura));
  const estado = await recolherEstadoDoAutosave(pagina);
  const zoom = pagina.getByRole('slider', { name: 'Zoom', exact: true });
  // A escala de ajuste pode cair na mesma posição do controle que 100%.
  await zoom.fill('2');
  await expect(zoom).toHaveAttribute('aria-valuetext', '50%');
  await zoom.fill('3');
  await expect(zoom).toHaveAttribute('aria-valuetext', '100%');
  // PERF_ESTABILIZAR=40 mede o traço com o estabilizador ligado (0.4).
  if (process.env.PERF_ESTABILIZAR)
    await pagina
      .getByRole('slider', { name: 'Estabilizar traço' })
      .fill(String(process.env.PERF_ESTABILIZAR));
  // PERF_SIMETRIA=12 mede os traços com a simetria radial de N fatias ligada (0.4).
  if (process.env.PERF_SIMETRIA) await definirSimetria(pagina, simetria);
  await tela.focus();
  return estado;
}

async function pontoNaAreaVisivel(pagina) {
  return pagina.locator('.drawing-canvas').evaluate((tela) => {
    const papel = tela.getBoundingClientRect();
    const viewport = tela.closest('.workspace').getBoundingClientRect();
    const esquerda = Math.max(papel.left, viewport.left);
    const direita = Math.min(papel.right, viewport.right);
    const topo = Math.max(papel.top, viewport.top);
    const base = Math.min(papel.bottom, viewport.bottom);
    if (direita - esquerda < 400 || base - topo < 300) {
      throw new Error('O papel visível é pequeno demais para o ensaio.');
    }
    return {
      x: Math.round((esquerda + direita) / 2),
      y: Math.round((topo + base) / 2),
    };
  });
}

async function medir(pagina, autosave, operacao) {
  await pagina.evaluate(() => {
    if (!window.rabiscoMedicao) throw new Error('A instrumentação de desempenho não está ligada.');
    window.rabiscoMedicao.iniciar();
  });
  await operacao();
  const estadoDoAutosave = await recolherEstadoDoAutosave(pagina, autosave.estado === 'salvo');
  if (estadoDoAutosave !== 'salvo' && autosave.estado === 'salvo')
    console.warn(`Autosave ${estadoDoAutosave}; a etapa de desenho segue instrumentada.`);
  autosave.estado = estadoDoAutosave;
  // Entrega a última entrada ao PerformanceObserver após a tarefa que alterou a camada.
  await pagina.evaluate(() => new Promise((resolver) => setTimeout(resolver, 0)));
  const { medidas, ...coleta } = await pagina.evaluate(() => window.rabiscoMedicao.encerrar());
  return {
    ...coleta,
    estadoDoAutosave,
    operacoes: Object.fromEntries(
      Object.entries(medidas).map(([nome, amostras]) => [nome, resumir(amostras)]),
    ),
  };
}

async function traco(pagina, autosave, atalho, categoria, rotuloDoHistorico, deslocamento = 0) {
  await pagina.keyboard.press(atalho);
  const centro = await pontoNaAreaVisivel(pagina);
  const x = centro.x;
  const y = centro.y + deslocamento;
  const itens = pagina.locator('.history-list').getByText(rotuloDoHistorico, { exact: true });
  const anteriores = await itens.count();
  await pagina.mouse.move(x - 84, y);
  const resultado = await medir(pagina, autosave, async () => {
    await pagina.mouse.down();
    // A trajetória mede 168 × 40 px no papel em todos os três tamanhos.
    // Cada mouse.move entrega um evento real. O ensaio não espera quadros entre eventos.
    for (let i = 1; i <= quantidadeMovimentos; i++) {
      const progresso = i / quantidadeMovimentos;
      await pagina.mouse.move(x - 84 + 168 * progresso, y + 20 * Math.sin(progresso * 8 * Math.PI));
    }
    await pagina.mouse.up();
    await expect(itens).toHaveCount(anteriores + 1);
  });
  for (const nome of [`${categoria}:inicio`, `${categoria}:fim`, `historico:${categoria}`]) {
    if (resultado.operacoes[nome]?.amostras !== 1)
      throw new Error(`O ensaio não recebeu uma amostra para ${nome}.`);
  }
  const amostras = resultado.operacoes[`${categoria}:movimento`]?.amostras ?? 0;
  if (amostras !== quantidadeMovimentos)
    throw new Error(
      `Esperava ${quantidadeMovimentos} movimentos de ${categoria}. Recebi ${amostras}.`,
    );
  if (categoria === 'spray' && !resultado.operacoes['spray:quadro']?.amostras)
    throw new Error('O aerógrafo deve borrifar durante o arraste.');
  return resultado;
}

async function conferirCantos(pagina, cor) {
  // O balde em papel grande termina num worker: espera os cantos mudarem.
  await expect
    .poll(
      () =>
        pagina.locator('.drawing-canvas').evaluate((tela) => {
          const ctx = tela.getContext('2d');
          return [
            Array.from(ctx.getImageData(0, 0, 1, 1).data),
            Array.from(ctx.getImageData(tela.width - 1, tela.height - 1, 1, 1).data),
          ];
        }),
      { timeout: 15_000 },
    )
    .toEqual([cor, cor]);
}

async function memoriaEmRepouso(pagina, cdp) {
  let dadosDoRuntime = null;
  try {
    await cdp.send('HeapProfiler.collectGarbage');
    dadosDoRuntime = await cdp.send('Runtime.getHeapUsage');
  } catch {
    // A API experimental do protocolo pode não existir em versões antigas do Edge.
  }
  return { ...(await pagina.evaluate(() => window.rabiscoMedicao.memoria())), dadosDoRuntime };
}

async function aplicarFiltroPeloMenu(pagina, nome, conferirPrevia) {
  await pagina.getByRole('button', { name: 'Filtros', exact: true }).click();
  await pagina.getByRole('menuitem', { name: nome, exact: true }).click();
  const dialogo = pagina.getByRole('dialog', { name: nome, exact: true });
  const aplicar = dialogo.getByRole('button', { name: 'Aplicar', exact: true });
  await expect(aplicar).toBeEnabled({ timeout: 30_000 });
  await conferirPrevia();
  await aplicar.click();
  await expect(dialogo).toBeHidden();
  await expect(pagina.locator('.history-list').getByText(nome, { exact: true })).toHaveCount(1);
}

function conferirMedidasDoFiltro(fase, nome) {
  for (const medida of ['filtro:preparo', 'filtro:worker', 'filtro:previa', 'historico:filtro']) {
    if (fase.operacoes[medida]?.amostras !== 1)
      throw new Error(`O ensaio de ${nome} não recebeu uma amostra para ${medida}.`);
  }
}

async function medirFiltroComMarca(pagina, autosave, nome) {
  const tela = pagina.locator('.drawing-canvas');
  await tela.focus();
  await pagina.keyboard.press('p');
  const espessura = pagina.getByRole('spinbutton', { name: 'Espessura do traço', exact: true });
  await espessura.fill('1');
  await espessura.press('Tab');
  await pagina.getByRole('button', { name: 'Usar cor #252a34', exact: true }).click();
  const ponto = await pontoNaAreaVisivel(pagina);
  // Um ponto sobre a área uniforme permite conferir a prévia antes de confirmar o filtro.
  await pagina.mouse.click(ponto.x, ponto.y);
  const ler = () =>
    tela.evaluate((canvas, { x, y }) => {
      const caixa = canvas.getBoundingClientRect();
      const px = Math.floor(((x - caixa.x) / caixa.width) * canvas.width);
      const py = Math.floor(((y - caixa.y) / caixa.height) * canvas.height);
      return Array.from(canvas.getContext('2d').getImageData(px - 1, py - 1, 3, 3).data);
    }, ponto);
  const fundo = Array.from({ length: 9 }, () => corDoBaldeInvertida).flat();
  await expect.poll(ler).not.toEqual(fundo);
  const antes = await ler();
  const fase = await medir(pagina, autosave, () =>
    aplicarFiltroPeloMenu(pagina, nome, () => expect.poll(ler).not.toEqual(antes)),
  );
  conferirMedidasDoFiltro(fase, nome);
  return fase;
}

async function medirPapel(browser, papel) {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const pagina = await contexto.newPage();
    const cdp = await contexto.newCDPSession(pagina);
    await pagina.goto(`${endereco}/?medir=1`);
    await aguardarSalvamento(pagina);
    const estadoInicial = await criarPapel(pagina, papel);
    const autosave = { estado: estadoInicial };
    if (estadoInicial !== 'salvo') {
      console.warn(
        `Papel ${papel.largura} × ${papel.altura}: autosave ${estadoInicial} ao criar. O ensaio vai medir as operações de desenho e informar o estado de gravação.`,
      );
    }
    const semEdicoes = await memoriaEmRepouso(pagina, cdp);
    // A primeira pincelada depois de criar o papel paga uma sincronização única entre a
    // máscara do pincel (GPU) e a camada (memória comum). As seguintes mostram o custo usual.
    const pincel = await traco(pagina, autosave, 'b', 'pincel', 'Pincelada');
    const pincel2 = await traco(pagina, autosave, 'b', 'pincel', 'Pincelada', 60);
    const pincel3 = await traco(pagina, autosave, 'b', 'pincel', 'Pincelada', 120);
    const spray = await traco(pagina, autosave, 'a', 'spray', 'Aerógrafo / Spray', -60);
    const depoisDosTracos = await memoriaEmRepouso(pagina, cdp);

    autosave.estado = await criarPapel(pagina, papel, false);
    await pagina.keyboard.press('f');
    const { x, y } = await pontoNaAreaVisivel(pagina);
    const balde = await medir(pagina, autosave, async () => {
      await pagina.mouse.click(x, y);
      await conferirCantos(pagina, corDoBalde);
    });
    const desfazer = await medir(pagina, autosave, async () => {
      await pagina.keyboard.press('Control+z');
      await conferirCantos(pagina, branco);
    });
    const refazer = await medir(pagina, autosave, async () => {
      await pagina.keyboard.press('Control+y');
      await conferirCantos(pagina, corDoBalde);
    });
    const filtro = await medir(pagina, autosave, () =>
      aplicarFiltroPeloMenu(pagina, 'Inverter cores', () =>
        conferirCantos(pagina, corDoBaldeInvertida),
      ),
    );
    conferirMedidasDoFiltro(filtro, 'Inverter cores');
    const filtrosGrandes = papel.largura === 4000 && papel.altura === 4000;
    const desfoque = filtrosGrandes
      ? await medirFiltroComMarca(pagina, autosave, 'Desfoque gaussiano')
      : null;
    const pixelizar = filtrosGrandes
      ? await medirFiltroComMarca(pagina, autosave, 'Pixelizar')
      : null;
    const dithering = filtrosGrandes
      ? await medirFiltroComMarca(pagina, autosave, 'Dithering')
      : null;
    for (const [nome, fase] of [
      ['balde', balde],
      ['desfazer', desfazer],
      ['refazer', refazer],
    ]) {
      for (const medida of [nome, `historico:${nome}`]) {
        if (fase.operacoes[medida]?.amostras !== 1)
          throw new Error(`O ensaio não recebeu uma amostra para ${medida}.`);
      }
    }
    return {
      ...papel,
      autosaveAoCriar: estadoInicial,
      memoria: { semEdicoes, depoisDosTracos },
      fases: {
        pincel,
        'pincel (2ª)': pincel2,
        'pincel (3ª)': pincel3,
        spray,
        balde,
        desfazer,
        refazer,
        'inverter cores': filtro,
        ...(desfoque ? { 'desfoque gaussiano': desfoque } : {}),
        ...(pixelizar ? { pixelizar } : {}),
        ...(dithering ? { dithering } : {}),
      },
    };
  } finally {
    await contexto.close();
  }
}

/**
 * 20 camadas de 4000 × 4000 (meta da 0.3): um traço em cada, modos variados, depois pincelada
 * na camada 10, ocultar uma camada, subir uma camada e desfazer.
 */
async function medirCamadas(browser) {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const pagina = await contexto.newPage();
    const cdp = await contexto.newCDPSession(pagina);
    await pagina.goto(`${endereco}/?medir=1`);
    await aguardarSalvamento(pagina);
    const papel = { largura: 4000, altura: 4000 };
    const autosave = { estado: await criarPapel(pagina, papel, false) };
    const lista = pagina.getByRole('listbox', { name: 'Lista de camadas' });
    const historico = (rotulo) =>
      pagina.locator('.history-list').getByText(rotulo, { exact: true });
    const modos = ['multiplicar', 'tela', 'sobrepor', 'normal', 'luz-suave'];
    const { x, y } = await pontoNaAreaVisivel(pagina);
    const inicioMontagem = performance.now();
    for (let i = 1; i < 20; i++) {
      await pagina.keyboard.press('Control+Shift+N');
      await expect(lista.getByRole('option')).toHaveCount(i + 1);
      await pagina.keyboard.press('b');
      await pagina.mouse.move(x - 80, y - 60 + i * 6);
      await pagina.mouse.down();
      await pagina.mouse.move(x + 80, y - 60 + i * 6, { steps: 4 });
      await pagina.mouse.up();
      await pagina
        .getByRole('combobox', { name: 'Modo de mesclagem' })
        .selectOption(modos[i % modos.length]);
    }
    const montagemMs = Math.round(performance.now() - inicioMontagem);
    await recolherEstadoDoAutosave(pagina);
    const depoisDaMontagem = await memoriaEmRepouso(pagina, cdp);

    // Camada 10 de baixo para cima (a lista mostra a de cima primeiro).
    await lista.getByRole('option').nth(10).click();
    await pagina.locator('.drawing-canvas').focus();
    const pincel = await traco(pagina, autosave, 'b', 'pincel', 'Pincelada', 120);
    const visibilidade = await medir(pagina, autosave, async () => {
      await lista
        .getByRole('button', { name: /^Ocultar / })
        .nth(5)
        .click();
      await expect(historico('Ocultar camada')).toHaveCount(1);
    });
    // Tempo até a tela atualizar: clique no olho e espera dois quadros (desenho real das camadas).
    const ateQuadro = [];
    for (let i = 0; i < 6; i++) {
      ateQuadro.push(
        await pagina.evaluate(async (indice) => {
          const botoes = document.querySelectorAll('.camadas-lista .camada-olho');
          const inicio = performance.now();
          botoes[indice].click();
          await new Promise((resolver) =>
            requestAnimationFrame(() => requestAnimationFrame(resolver)),
          );
          return performance.now() - inicio;
        }, 5),
      );
    }
    visibilidade.operacoes['ate-o-quadro'] = resumir(ateQuadro);
    const mover = await medir(pagina, autosave, async () => {
      await pagina.locator('.drawing-canvas').focus();
      await pagina.keyboard.press('Control+]');
      await expect(historico('Mover camada')).toHaveCount(1);
    });
    const desfazer = await medir(pagina, autosave, async () => {
      await pagina.keyboard.press('Control+z');
      await expect(historico('Mover camada')).toHaveCount(0);
    });
    return {
      ...papel,
      camadas: 20,
      montagemMs,
      memoria: { depoisDaMontagem, depoisDasOperacoes: await memoriaEmRepouso(pagina, cdp) },
      fases: { pincel, visibilidade, mover, desfazer },
    };
  } finally {
    await contexto.close();
  }
}

const ms = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

function imprimir(resultado) {
  const { largura, altura, fases, memoria } = resultado;
  console.log(`\nPapel ${largura} × ${altura} px (zoom 100%)`);
  console.table(
    Object.entries(fases).flatMap(([fase, { operacoes }]) =>
      Object.entries(operacoes).map(([operacao, resumo]) => ({
        fase,
        operação: operacao,
        amostras: resumo.amostras,
        'p50 (ms)': ms.format(resumo.p50),
        'p95 (ms)': ms.format(resumo.p95),
        'máx. (ms)': ms.format(resumo.maximo),
      })),
    ),
  );
  console.table(
    Object.entries(fases).map(([fase, dados]) => ({
      fase,
      autosave: dados.estadoDoAutosave,
      'tarefas longas (≥ 50 ms)': dados.suportaTarefasLongas ? dados.tarefasLongas.length : 'n/d',
      '> 100 ms': dados.suportaTarefasLongas
        ? dados.tarefasLongas.filter(({ duracao }) => duracao > 100).length
        : 'n/d',
      'maior tarefa (ms)': dados.tarefasLongas.length
        ? ms.format(Math.max(...dados.tarefasLongas.map(({ duracao }) => duracao)))
        : '—',
      'bytes gravados': dados.gravacoes.length
        ? inteiro.format(dados.gravacoes.reduce((total, { bytes }) => total + bytes, 0))
        : 'n/d',
      'blocos gravados': dados.gravacoes.length
        ? inteiro.format(dados.gravacoes.reduce((total, { blocos }) => total + blocos, 0))
        : 'n/d',
    })),
  );
  const mib = (bytes) => (typeof bytes === 'number' ? ms.format(bytes / 1024 ** 2) : 'n/d');
  console.table(
    Object.entries(memoria).map(([fase, dados]) => ({
      fase,
      'heap JS (MiB)': mib(dados.heapUsado),
      'heap CDP (MiB)': mib(dados.dadosDoRuntime?.usedSize),
      'ArrayBuffers e strings externas (MiB)': mib(dados.dadosDoRuntime?.backingStorageSize),
      'espelho do documento (MiB)': mib(dados.bytesEspelho),
    })),
  );
}

const rotulo = lerRotulo(process.argv.slice(2));
const servidor = await createServer({
  root: raiz,
  server: { host: '127.0.0.1', port: 5174, strictPort: true, hmr: false },
});
try {
  await servidor.listen();
  const browser = await chromium.launch({ channel: canal, args: ['--enable-precise-memory-info'] });
  try {
    const relatorio = {
      data,
      maquina: {
        sistema: `${type()} ${release()} ${arch()}`,
        cpu: cpus()[0]?.model,
        nucleosLogicos: availableParallelism(),
        ramBytes: totalmem(),
      },
      navegador: { canal, versao: browser.version() },
      resultados: [],
    };
    console.log('Ensaio do Rabisco', relatorio.data, relatorio.maquina, relatorio.navegador);
    // PERF_SO_CAMADAS=1 pula os três papéis e mede só o cenário de 20 camadas.
    if (!process.env.PERF_SO_CAMADAS)
      for (const papel of papeis) {
        const resultado = await medirPapel(browser, papel);
        relatorio.resultados.push(resultado);
        imprimir(resultado);
      }
    const camadas = await medirCamadas(browser);
    relatorio.resultados.push(camadas);
    console.log(`
20 camadas: montagem em ${camadas.montagemMs} ms`);
    imprimir(camadas);
    const pasta = join(raiz, 'output', 'perf');
    await mkdir(pasta, { recursive: true });
    const arquivo = join(pasta, `${rotulo}.json`);
    await writeFile(arquivo, `${JSON.stringify(relatorio, null, 2)}\n`);
    console.log(`\nRelatório salvo em ${arquivo}`);
  } finally {
    await browser.close();
  }
} finally {
  await servidor.close();
}
