import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const file = `prodev-${version}.zip`;
const output = createWriteStream(file);
const zip = archiver('zip', { zlib: { level: 9 } });
zip.pipe(output);
zip.directory('dist/', false);
await zip.finalize();
console.log(`Wrote ${file}`);
