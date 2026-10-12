# Shared legal documents

One set of terms, privacy policy and refund policy for every product sold by Ben Counsell
(`bencounsell.com`, support@bencounsell.com), rendered into each product's own website.

- `company.json`: details shared by every product. Fill in your legal name and country once.
- `products/<product>.json`: what is specific to one product: what it is, licence seats, how to activate,
  the data it touches and the permissions it asks for.
- `terms.html`, `privacy.html`, `refunds.html`: the master texts, with `{{company.x}}` / `{{product.x}}`
  placeholders. Arrays (privacy `onDevice`, `network`, `permissions`) render as list items.

```bash
node scripts/legal.mjs hairline site            # writes site/terms.html, privacy.html, refunds.html
node scripts/legal.mjs hairline site --strict   # fails while any [TODO …] value remains; use before launch
```

The target site needs a `_legal-shell.html` with `{{title}}` and `{{content}}` (its header, footer and styles).

## Adding a product
1. Copy `products/hairline.json` to `products/<new>.json` and rewrite every field for the new product.
2. **The privacy section must describe that product truthfully**: list everything it stores, every
   network request it makes and every permission it asks for. App stores and Creem's reviewers check it,
   and a generic "we may collect…" statement can get a listing rejected.
3. Add a `_legal-shell.html` to the new product's site and run `node scripts/legal.mjs <new> <site-dir>`.

Each product keeps its own copy of the pages on its own site (Creem reviews each store's website), but the
wording and your company details come from one place, so a change here updates every product on re-render.
These texts are a solid starting point, not legal advice; have them checked for your country before launch.
