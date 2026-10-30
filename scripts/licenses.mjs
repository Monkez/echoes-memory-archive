import { readFile, readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const output = new URL('dist/licenses/', root);
await mkdir(output, { recursive: true });
const index = [];
for (const path of Object.keys(lock.packages).filter(p => p.startsWith('node_modules/'))) {
  const dir = new URL(path + '/', root);
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  for (const entry of entries.filter(e => e.isFile() && /^(licen[sc]e|notice|copying)(\.|$|-)/i.test(e.name))) {
    const name = path.replaceAll('/', '__') + '__' + entry.name;
    await copyFile(new URL(entry.name, dir), new URL(name, output));
    index.push(`${path}: ${name}`);
  }
}
await copyFile(new URL('LICENSE', root), new URL('ECHOES-LICENSE.txt', output));
await copyFile(new URL('THIRD_PARTY.md', root), new URL('THIRD_PARTY.md', output));
await writeFile(new URL('index.txt', output), 'Echoes dependency license files\n\n' + index.sort().join('\n') + '\n');
console.log(`Included ${index.length} dependency license/notice files.`);
