import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const resolver = createRequire(import.meta.url);
const playwright = resolver.resolve('@playwright/test/cli');
const trabalho = fileURLToPath(new URL('..', import.meta.url));
const total = 3;

for (let rodada = 1; rodada <= total; rodada++) {
  console.log(`\nRodada ${rodada} de ${total} da suíte E2E completa\n`);
  const resultado = spawnSync(
    process.execPath,
    [playwright, 'test', '--retries=0', '--forbid-only'],
    { cwd: trabalho, stdio: 'inherit' },
  );

  if (resultado.status === 0) continue;

  if (resultado.error) console.error(resultado.error.message);
  console.error(`Rodada ${rodada} de ${total} falhou.`);
  process.exitCode = resultado.status ?? 1;
  break;
}
