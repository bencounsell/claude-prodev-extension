# Shared legal documents

Legal pages for every product sold by Ben Counsell Consulting, Sweden (`bencounsell.com`,
support@bencounsell.com).

- `privacy.html`: **one company-wide privacy policy**, written out in full with the company details in it.
  It is fully generic: it names no product. Host it once (e.g. `bencounsell.com/privacy`)
  and link every product, store listing and Creem store to it.
- `terms.html`, `refunds.html`: shared terms and refund policy, with `{{company.x}}` / `{{product.x}}`
  placeholders filled per product.
- `company.json`: seller details used by the terms and refund policy.
- `products/<product>.json`: what is specific to one product for the terms and refund policy.

```bash
node scripts/legal.mjs hairline site            # writes site/terms.html, privacy.html, refunds.html
node scripts/legal.mjs hairline site --strict   # fails while any [TODO …] value remains
```

The target site needs a `_legal-shell.html` with `{{title}}` and `{{content}}` (its header, footer and styles).

## Adding a product
1. Check the new product fits `privacy.html` as written (runs on the device, no analytics or accounts,
   only licence checks to our servers). If it does anything more, such as analytics, accounts or uploads,
   add that to the policy and update the date at the top. App stores and Creem check that it's accurate.
2. Copy `products/hairline.json` to `products/<new>.json` and rewrite it for the new product.
3. Add a `_legal-shell.html` to the new product's site and run `node scripts/legal.mjs <new> <site-dir>`.

These texts are a solid starting point, not legal advice; have them checked before launch.
