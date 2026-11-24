import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// O arquivo acompanha a distribuição e é acessível pela janela Sobre.
const root = process.cwd();
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const sections = [await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8')];
for (const [location, item] of Object.entries(lock.packages)) {
  if (!location || item.dev) continue;
  if (
    !['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD'].includes(item.license)
  ) {
    throw new Error(`Revise a licença de ${location}: ${item.license}`);
  }
  const directory = path.join(root, location);
  const files = await readdir(directory);
  const license = files.find((file) => /^licen[cs]e(\.(txt|md))?$/i.test(file));
  if (!license) throw new Error(`Aviso de licença não encontrado em ${location}.`);
  sections.push(
    `\n\n${'='.repeat(72)}\n${location} ${item.version} — ${item.license}\n${'='.repeat(72)}\n${await readFile(path.join(directory, license), 'utf8')}`,
  );
}
sections.push(
  '\n\nSelawik — OFL 1.1\n',
  await readFile(path.join(root, 'public/fonts/OFL.txt'), 'utf8'),
);
sections.push(
  '\n\nFugue — CC BY 3.0\n',
  await readFile(path.join(root, 'public/icons/FUGUE-LICENSE.txt'), 'utf8'),
);
await writeFile(path.join(root, 'public/THIRD_PARTY_NOTICES.txt'), sections.join('\n'), 'utf8');
console.log('Créditos e licenças da distribuição atualizados.');
