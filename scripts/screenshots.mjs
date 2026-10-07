// Renders marketing/QA screenshots of the popup, settings, side panel and in-page tools.
// Usage: E2E=1 npm run build && CHROMIUM_PATH=... node scripts/screenshots.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = process.cwd();
const out = path.join(root, 'docs/screenshots');
fs.mkdirSync(out, { recursive: true });
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'pd-')), {
  executablePath: process.env.CHROMIUM_PATH, headless: false, deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`, '--headless=new', '--no-sandbox'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const id = new URL(sw.url()).host;
const pro = (p) => sw.evaluate(async (p) => p
  ? chrome.storage.local.set({ licence: { key: 'x', instanceId: 'x', validatedAt: Date.now(), valid: true } })
  : chrome.storage.local.remove('licence'), p);

// Popup + settings in both themes.
for (const scheme of ['light', 'dark']) {
  const p = await ctx.newPage();
  await p.emulateMedia({ colorScheme: scheme });
  await p.setViewportSize({ width: 400, height: 590 });
  await p.goto(`chrome-extension://${id}/popup.html`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/popup-${scheme}.png` });
  await p.setViewportSize({ width: 900, height: 1400 });
  await p.goto(`chrome-extension://${id}/options.html?welcome=1`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/options-${scheme}.png`, fullPage: true });
  await p.close();
}

const PANEL_W = 380, H = 800, PAGE_W = 1280 - PANEL_W;
const page = await ctx.newPage();
await page.goto('file://' + path.join(root, 'tests/fixtures/demo.html'));
const demoTab = () => sw.evaluate(async () => (await chrome.tabs.query({})).find((t) => t.url?.includes('demo.html')).id);
const send = (msg, mode = 'floating') => sw.evaluate(async ([m, mode]) => {
  const tab = (await chrome.tabs.query({})).find((t) => t.url?.includes('demo.html'));
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const licence = (await chrome.storage.local.get('licence')).licence;
  await chrome.tabs.sendMessage(tab.id, { type: 'config', pro: !!licence, mode });
  if (m) await chrome.tabs.sendMessage(tab.id, m);
}, [msg, mode]);

// ---- Floating mode (full-width page)
await page.setViewportSize({ width: 1280, height: H });
const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${name}.png` }); await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
await pro(true);
await send({ type: 'toggle-tool', toolId: 'inspector' });
await page.click('.cta-btn');
await shot('floating-inspector');
await send({ type: 'toggle-tool', toolId: 'color-palette' }); await shot('floating-palette');
await send({ type: 'open-palette' }); await page.keyboard.type('sc'); await shot('command-palette');
await pro(false);
await send({ type: 'toggle-tool', toolId: 'export-element' }); await shot('upsell');
await pro(true);

// ---- Side panel mode: page narrowed by the panel, rendered side by side.
await page.setViewportSize({ width: PAGE_W, height: H });
const panel = await ctx.newPage();
await panel.setViewportSize({ width: PANEL_W, height: H });
await panel.goto(`chrome-extension://${id}/sidepanel.html?tab=${await demoTab()}`);
await send(null, 'sidepanel');

async function composite(name, theme = 'light') {
  await panel.emulateMedia({ colorScheme: theme });
  await page.waitForTimeout(450);
  const [a, b] = await Promise.all([page.screenshot(), panel.screenshot()]);
  const c = await ctx.newPage();
  await c.setViewportSize({ width: 1280, height: H });
  await c.setContent(`<body style="margin:0;display:flex;overflow:hidden;background:#888">
    <img src="data:image/png;base64,${a.toString('base64')}" style="display:block;width:${PAGE_W}px;height:${H}px">
    <img src="data:image/png;base64,${b.toString('base64')}" style="display:block;width:${PANEL_W}px;height:${H}px;box-sizing:border-box;border-left:1px solid #0002">`);
  await c.screenshot({ path: `${out}/${name}.png` });
  await c.close();
}

await panel.bringToFront();
await composite('sidepanel-launcher');
await panel.locator('.tool', { hasText: 'CSS Inspector' }).click();
await page.bringToFront();
await page.click('.cta-btn');
await composite('sidepanel-inspector');
await composite('sidepanel-inspector-dark', 'dark');
await panel.locator('.sp-toolbar button:has-text("Done")').click();
for (const [tool, name] of [['Color Palette', 'sidepanel-palette'], ['List All Fonts', 'sidepanel-fonts'], ['Take Screenshot', 'sidepanel-screenshot']]) {
  await panel.locator('.tool', { hasText: tool }).click();
  await composite(name);
  await panel.locator('.sp-toolbar button:has-text("Done")').click();
}
await panel.locator('.tool', { hasText: 'Color Picker' }).click();
await panel.evaluate(() => chrome.tabs.query({}).then(async (tabs) => {
  const t = tabs.find((x) => x.url?.includes('demo.html'));
  for (const c of ['#7c3aed', '#fef3c7', '#78350f', '#ea580c']) await chrome.tabs.sendMessage(t.id, { type: 'tool-action', action: 'add-color', payload: c });
}));
await composite('sidepanel-color-picker');
await ctx.close();
console.log('Screenshots written to docs/screenshots');
