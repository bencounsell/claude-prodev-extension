// Renders marketing/QA screenshots of the popup, settings and in-page tools.
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

const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto('file://' + path.join(root, 'tests/fixtures/demo.html'));
const send = (msg) => sw.evaluate(async (m) => {
  const tab = (await chrome.tabs.query({})).find((t) => t.url?.includes('demo.html'));
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const licence = (await chrome.storage.local.get('licence')).licence;
  await chrome.tabs.sendMessage(tab.id, { type: 'set-pro', pro: !!licence });
  await chrome.tabs.sendMessage(tab.id, m);
}, msg);
const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${name}.png` }); await page.keyboard.press('Escape'); await page.waitForTimeout(150); };

await pro(true);
await send({ type: 'toggle-tool', toolId: 'inspector' });
await page.click('.cta-btn');
await shot('inspector');
await send({ type: 'toggle-tool', toolId: 'color-palette' }); await shot('palette');
await send({ type: 'toggle-tool', toolId: 'fonts-list' }); await shot('fonts');
await send({ type: 'toggle-tool', toolId: 'outliner' }); await page.mouse.move(400, 300); await shot('outliner');
await send({ type: 'toggle-tool', toolId: 'color-picker' }); await shot('color-picker');
await send({ type: 'open-palette' }); await page.keyboard.type('sc'); await shot('command-palette');
await pro(false);
await send({ type: 'toggle-tool', toolId: 'export-element' }); await shot('upsell');
await ctx.close();
console.log('Screenshots written to docs/screenshots');
