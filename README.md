# ProDev – Web Developer & Designer Toolkit

A Manifest V3 Chromium extension (Chrome, Edge, Brave) with 14 tools to inspect, edit and export any website.
Freemium: core tools are free, Pro tools unlock with a one-time licence key.

| Tool | Tier |
|---|---|
| CSS Inspector (live editing = Pro), Live Text Editor, List All Fonts, Color Picker, Delete Element, Page Ruler, Page Outliner, Screenshot (full page = Pro) | Free |
| Fonts Changer, Color Palette, Move Element, Export Element, Extract Images, Image Replacer | Pro |

## How it's put together
- **Side panel (default)**: clicking the toolbar icon opens Chrome's side panel (`sidepanel.html`): tool launcher plus each tool's view. It persists across tabs and navigation and shows the page's viewport width and breakpoint, since the panel narrows the page.
- **Floating mode** (Settings → *Where tools appear*): the toolbar icon opens the popup and tool views float over the page in a Shadow DOM panel. Closing the side panel while a tool is active hands it over to floating mode automatically.
- **Shared views**: each tool's UI is one Preact component in `extension/src/views/ToolViews.tsx`, rendered in either surface. Content-script tools publish data (`runtime.publish`) and handle actions (`onAction`); the views never touch the page directly.
- **On the page** only what must be there: highlights, box-model shading, ruler, outlines, and a small status pill with *Done/Esc*.
- **Permissions**: `activeTab` by default. The side panel offers an optional "Allow on all sites" (`optional_host_permissions`) so it can keep working as you switch tabs and navigate.

## Screenshots
![Side panel inspector](docs/screenshots/sidepanel-inspector.png)

| Floating mode | Popup |
|---|---|
| ![Floating inspector](docs/screenshots/floating-inspector.png) | ![Popup](docs/screenshots/popup-dark.png) |

Regenerate all screenshots (popup, settings, every tool panel, upsell, command palette) with
`E2E=1 npm run build && CHROMIUM_PATH=/path/to/chromium node scripts/screenshots.mjs`.

## Develop
```bash
npm install
npm run dev        # watch build into dist/
npm run build      # production build
npm run typecheck && npm run lint && npm test
npm run test:e2e   # Playwright (set CHROMIUM_PATH to a Chromium binary)
npm run zip        # prodev-<version>.zip for the Chrome Web Store
```
Load `dist/` via `chrome://extensions` → Developer mode → Load unpacked.

## Before launch (TODO)
- Final name / trademark + domain check, replace placeholder icons (`scripts/icons.mjs` generates temporary ones).
- Set `CONFIG` in `extension/src/lib/licence.ts` (Lemon Squeezy store/product IDs, real checkout URL).
- Marketing site, privacy policy, store screenshots/promo tiles, listing copy.
- Test on complex sites (SPAs, iframes, shadow DOM) in Chrome, Edge and Brave.
