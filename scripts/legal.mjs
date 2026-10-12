// Renders the shared legal documents in legal/ for one product.
//
//   node scripts/legal.mjs <product> <site-dir> [--strict]
//
// legal/company.json holds the details shared by every product (seller, country, support email, refund
// policy); legal/products/<product>.json holds what is specific to one product (what it is, licence seats).
// legal/terms.html and refunds.html use {{company.x}} and {{product.x}}. legal/privacy.html is the single
// company-wide privacy policy, written out in full and naming no product; it is copied as is. <site-dir>/_legal-shell.html wraps each page in the site's
// header and footer ({{title}}, {{content}}).
//
// Values still marked "[TODO …]" render highlighted and print a warning; --strict makes them an error,
// so run with --strict before launch.
import fs from 'node:fs';
import path from 'node:path';

const [product, outDir, ...flags] = process.argv.slice(2);
if (!product || !outDir) { console.error('usage: node scripts/legal.mjs <product> <site-dir> [--strict]'); process.exit(1); }
const strict = flags.includes('--strict');
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'legal');
const data = {
  company: JSON.parse(fs.readFileSync(path.join(root, 'company.json'), 'utf8')),
  product: JSON.parse(fs.readFileSync(path.join(root, 'products', `${product}.json`), 'utf8')),
};
const shell = fs.readFileSync(path.join(outDir, '_legal-shell.html'), 'utf8');

const todos = new Set();
const lookup = (key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);
function fill(text, extra = {}) {
  return text.replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
    if (key in extra) return extra[key]; // already rendered (page content, title)
    let v = lookup(key);
    if (v === undefined) throw new Error(`No value for {{${key}}}`);
    if (Array.isArray(v)) return v.map((item) => `  <li>${item}</li>`).join('\n');
    v = String(v);
    if (/\[TODO/.test(v)) { todos.add(key); return `<span class="todo">${v}</span>`; }
    return v;
  });
}

// The privacy policy is one company-wide document that names no product, so its title
// names the company rather than the product.
const pages = {
  terms: `${data.product.name} terms of service`,
  privacy: `Privacy policy · ${data.company.name}`,
  refunds: `${data.product.name} refund policy`,
};
for (const [name, title] of Object.entries(pages)) {
  const content = fill(fs.readFileSync(path.join(root, `${name}.html`), 'utf8')).trim();
  const html = fill(shell, { title, content });
  if (/\{\{/.test(html)) throw new Error(`${name}.html: unresolved placeholder`);
  fs.writeFileSync(path.join(outDir, `${name}.html`), html);
  console.log(`  → ${path.join(outDir, `${name}.html`)}`);
}
if (todos.size) {
  const msg = `Still to fill in legal/company.json or legal/products/${product}.json: ${[...todos].join(', ')}`;
  if (strict) { console.error(`✗ ${msg}`); process.exit(1); }
  console.warn(`! ${msg}`);
}
