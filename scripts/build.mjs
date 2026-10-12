import { mkdir, rm, cp, readdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'src', 'public']) {
  if (file === 'public') {
    for (const p of await readdir(new URL('public/', root))) await cp(new URL('public/' + p, root), new URL(p, dist), { recursive: true });
  } else await cp(new URL(file, root), new URL(file, dist), { recursive: true });
}
async function walk(dir, prefix = '') {
  let out = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + item.name;
    out.push(...(item.isDirectory() ? await walk(new URL(item.name + '/', dir), name + '/') : [name]));
  }
  return out;
}
const files = (await walk(dist)).filter(x => !x.endsWith('.md'));
const hash = createHash('sha256');
for (const f of files) hash.update(await readFile(new URL(f, dist)));
const revision = hash.digest('hex').slice(0, 12);
const template = await readFile(new URL('scripts/sw-template.js', root), 'utf8');
await writeFile(new URL('sw.js', dist), template.replace('__REVISION__', revision).replace('__ASSETS__', JSON.stringify(['/', ...files.map(f => '/' + f)])));
console.log(`Built ${files.length} static files; revision ${revision}. No runtime dependencies or secret values bundled.`);
