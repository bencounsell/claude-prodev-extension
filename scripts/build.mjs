import { build, context } from 'esbuild';
import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const out = 'dist';
const src = 'extension';

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const common = {
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  target: 'chrome110',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  logLevel: 'info',
  loader: { '.css': 'text' },
};

const configs = [
  { ...common, entryPoints: { background: `${src}/src/background/index.ts` }, outdir: out, format: 'esm' },
  { ...common, entryPoints: { content: `${src}/src/content/index.ts` }, outdir: out, format: 'iife' },
  {
    ...common,
    entryPoints: {
      popup: `${src}/src/popup/index.tsx`,
      options: `${src}/src/options/index.tsx`,
      sidepanel: `${src}/src/sidepanel/index.tsx`,
    },
    outdir: out,
    format: 'iife',
  },
];

async function copyStatic() {
  await cp(`${src}/public`, out, { recursive: true });
  // Brand fonts (SIL OFL 1.1), bundled so extension pages never fetch fonts from the network.
  await mkdir(`${out}/fonts`, { recursive: true });
  for (const [pkg, file, name] of [
    ['geist', 'geist-latin-wght-normal.woff2', 'geist'],
    ['jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2', 'jetbrains-mono'],
  ]) {
    const dir = `node_modules/@fontsource-variable/${pkg}`;
    await cp(`${dir}/files/${file}`, `${out}/fonts/${name}.woff2`);
    await cp(`${dir}/LICENSE`, `${out}/fonts/${name}-LICENSE.txt`);
  }
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const manifest = JSON.parse(await readFile(`${src}/manifest.json`, 'utf8'));
  manifest.version = pkg.version;
  if (process.env.E2E) manifest.host_permissions.push('<all_urls>'); // test builds only: lets Playwright inject without a toolbar click
  await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
}

await copyStatic();
if (watch) {
  for (const c of configs) (await context(c)).watch();
} else {
  await Promise.all(configs.map((c) => build(c)));
}
