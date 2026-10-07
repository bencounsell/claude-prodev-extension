// Stage 1 of the marketing pipeline: records real footage of the extension as "takes".
//
//   E2E=1 npm run build && CHROMIUM_PATH=... TAKES=out/takes node scripts/marketing/capture.mjs [take ...]
//
// Each take writes page.mp4 (+ panel.mp4 when the side panel is shown) at 2x resolution and a
// take.json with its duration and named marks. scripts/marketing/render.mjs frames and edits them.
import fs from 'node:fs';
import path from 'node:path';
import { Stream, driver, launch, now, sleep } from '../lib/rig.mjs';

const root = process.cwd();
const TAKES = path.resolve(process.env.TAKES ?? 'media/takes');
const only = process.argv.slice(2);
const DPR = 2;
const PAGE = { width: 900, height: 800 };
const PANEL = { width: 380, height: 800 };
const FULL = { width: 1280, height: 800 };
const site = (name) => 'file://' + path.join(root, 'scripts/marketing/sites', `${name}.html`);

const { ctx, sw, EXT, setPro, openWindow, tabIdFor, sendToTab } = await launch({ root, deviceScaleFactor: DPR, viewport: PAGE });
await setPro(true);

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.setViewportSize(PAGE);
await page.goto(site('acme'));
const tabId = await tabIdFor('sites/acme.html');
let panel = await openWindow(`${EXT}/sidepanel.html?tab=${tabId}`, PANEL);

const pages = () => [page, panel].filter((p) => p && !p.isClosed());
const { moveTo, to, click, drag, type, park } = driver(pages);
const tool = (name) => panel.locator('.launcher .tool', { hasText: name });
const done = () => click(panel, panel.locator('.sp-toolbar .v-btn', { hasText: 'Done' }));
const btn = (text) => panel.locator('.v-btn', { hasText: text });
const own = (sel) => page.locator(`prodev-root ${sel}`);

/** Loads `name` in the demo tab and returns the side panel to its launcher, cursors parked. */
async function stage(name) {
  if (!page.url().endsWith(`${name}.html`)) await page.goto(site(name));
  else await page.reload();
  await sw.evaluate(() => chrome.storage.local.set({ recent: [] }));
  await panel.reload();
  await panel.waitForSelector('.launcher .tool');
  await sleep(700);
  await park(page, PAGE.width - 30, PAGE.height - 30);
  await park(panel, PANEL.width - 30, PANEL.height - 90);
}

async function take(name, { siteName, full = false, before }, run) {
  if (only.length && !only.includes(name)) return;
  console.log(`● ${name}`);
  if (siteName) await stage(siteName);
  await before?.();
  const dir = path.join(TAKES, name);
  fs.rmSync(dir, { recursive: true, force: true });
  const streams = [new Stream(page, 'page', path.join(dir, 'frames'))];
  if (!full) streams.push(new Stream(panel, 'panel', path.join(dir, 'frames')));
  for (const s of streams) await s.start();
  await sleep(500);
  const t0 = now();
  const marks = {};
  await run((m) => { marks[m] = +(now() - t0).toFixed(3); });
  await sleep(700);
  const t1 = now();
  for (const s of streams) await s.stop();
  const pageSize = full ? FULL : PAGE;
  streams[0].encode(t0, t1, { width: pageSize.width * DPR, height: pageSize.height * DPR }, path.join(dir, 'page.mp4'), 12);
  if (!full) streams[1].encode(t0, t1, { width: PANEL.width * DPR, height: PANEL.height * DPR }, path.join(dir, 'panel.mp4'), 12);
  fs.rmSync(path.join(dir, 'frames'), { recursive: true, force: true });
  const meta = { name, site: siteName ?? 'acme', layout: full ? 'full' : 'docked', duration: +(t1 - t0).toFixed(3), marks };
  fs.writeFileSync(path.join(dir, 'take.json'), JSON.stringify(meta, null, 2));
}

async function editField(prop, value) {
  const input = panel.locator(`input[data-p="${prop}"]`);
  await click(panel, input, 0.75);
  await panel.keyboard.press('ControlOrMeta+a');
  await type(panel, value, 85);
  await sleep(200);
  await panel.keyboard.press('Enter');
  await sleep(900);
}

/* ------------------------------------------------------------------ takes */

await take('inspector', { siteName: 'acme' }, async (mark) => {
  mark('launcher');
  await sleep(900);
  for (const t of ['Color Picker', 'List All Fonts']) { await to(panel, tool(t)); await sleep(300); }
  await click(panel, tool('CSS Inspector'));
  mark('open');
  for (const [sel, fx] of [['h1', 0.3], ['.lead', 0.4], ['.card', 0.5], ['.btns .ghost', 0.5], ['.cta-btn', 0.5]]) { await to(page, page.locator(sel).first(), fx, 0.5); await sleep(750); }
  mark('hovered');
  await click(page, page.locator('.cta-btn'));
  mark('locked');
  await sleep(1300);
  mark('edit');
  await editField('font-size', '18px');
  await editField('background-color', '#7c3aed');
  await editField('border-radius', '999px');
  mark('edited');
  await sleep(1400);
  await click(panel, btn('Copy CSS'));
  mark('copied');
  await sleep(1300);
  await click(panel, btn('Reset edits'));
  await sleep(1000);
  mark('reset');
  await done();
  await sleep(900);
  mark('end');
});

await take('colors', {
  siteName: 'bloom',
  // Seed the picker's history (the native eyedropper can't run headless).
  before: async () => {
    const id = await tabIdFor('sites/bloom.html');
    await sendToTab(id, { type: 'toggle-tool', toolId: 'color-picker' });
    for (const c of ['#e0a526', '#2f5d50', '#f6efe4', '#5b3a29', '#c8553d']) await sendToTab(id, { type: 'tool-action', action: 'add-color', payload: c });
    await sendToTab(id, { type: 'deactivate-all' });
    await sleep(600);
  },
}, async (mark) => {
  mark('start');
  await sleep(600);
  await click(panel, tool('Color Palette'));
  mark('palette');
  for (const k of [0, 2, 5, 7, 9]) { await to(panel, panel.locator('.v-swatch').nth(k)); await sleep(420); }
  await click(panel, panel.locator('.v-swatch').nth(7));
  mark('copied');
  await sleep(900);
  await click(panel, btn('Copy as Tailwind'));
  await sleep(1100);
  await done();
  mark('picker-open');
  await click(panel, tool('Color Picker'));
  mark('picker');
  await sleep(1200);
  for (const k of [1, 3]) { await to(panel, panel.locator('.v-history button').nth(k)); await sleep(400); }
  await click(panel, panel.locator('.v-history button').nth(1));
  await sleep(1500);
  mark('picked');
  await done();
  await sleep(700);
  mark('end');
});

await take('fonts', { siteName: 'bloom' }, async (mark) => {
  mark('start');
  await sleep(500);
  await click(panel, tool('List All Fonts'));
  mark('list');
  for (const k of [0, 1]) { await to(panel, panel.locator('.v-font').nth(k)); await sleep(900); }
  await done();
  await click(panel, tool('Fonts Changer'));
  mark('changer');
  await sleep(500);
  for (const f of ['Inter', 'Courier New', 'Times New Roman']) { await click(panel, panel.locator('.v-fontopt', { hasText: f })); await sleep(1300); }
  mark('changed');
  await click(panel, btn('Restore original fonts'));
  await sleep(900);
  await done();
  await sleep(600);
  mark('end');
});

await take('measure', { siteName: 'acme' }, async (mark) => {
  mark('start');
  await sleep(500);
  await click(panel, tool('Page Outliner'));
  mark('outliner');
  for (const [x, y] of [[200, 210], [140, 400], [660, 300], [450, 540], [200, 680]]) { await moveTo(page, x, y); await sleep(600); }
  await done();
  await click(panel, tool('Page Ruler'));
  mark('ruler');
  const b = await page.locator('.card').boundingBox();
  await drag(page, { x: b.x, y: b.y }, { x: b.x + b.width, y: b.y + b.height });
  mark('measured');
  await sleep(1400);
  await drag(page, { x: 48, y: 400 }, { x: 345, y: 425 });
  await sleep(1300);
  await done();
  await sleep(600);
  mark('end');
});

await take('edit-page', { siteName: 'acme' }, async (mark) => {
  mark('start');
  await sleep(400);
  await click(panel, tool('Delete Element'));
  mark('delete');
  await click(page, page.locator('.logos'));
  await sleep(500);
  await click(page, page.locator('.feat div').nth(2));
  mark('deleted');
  await sleep(900);
  await click(panel, btn('Restore all'));
  await sleep(800);
  await done();
  await click(panel, tool('Move Element'));
  mark('move');
  const card = page.locator('.card');
  const b = await card.boundingBox();
  await drag(page, { x: b.x + 8, y: b.y + b.height / 2 }, { x: b.x - 30, y: b.y + b.height / 2 + 150 });
  mark('moved');
  await sleep(900);
  await done();
  await click(panel, tool('Live Text Editor'));
  mark('text');
  await click(page, page.locator('h1 em'), 0.98, 0.6);
  await page.keyboard.press('End');
  await type(page, ' Together.', 95);
  mark('typed');
  await sleep(1100);
  await done();
  await sleep(600);
  mark('end');
});

await take('export', { siteName: 'acme' }, async (mark) => {
  mark('start');
  await sleep(400);
  await click(panel, tool('Export Element'));
  mark('open');
  for (const sel of ['h1', '.cta-btn', '.card']) { await to(page, page.locator(sel), 0.4, 0.4); await sleep(600); }
  await click(page, page.locator('.card'), 0.4, 0.06);
  mark('exported');
  await sleep(900);
  await to(panel, panel.locator('.v-code'), 0.5, 0.5);
  for (let i = 0; i < 4; i++) { await panel.mouse.wheel(0, 90); await sleep(160); }
  await sleep(500);
  await click(panel, btn('Copy HTML'));
  await sleep(1200);
  await done();
  await sleep(600);
  mark('end');
});

await take('capture', { siteName: 'bloom' }, async (mark) => {
  mark('start');
  await sleep(400);
  await click(panel, tool('Take Screenshot'));
  mark('screenshot');
  await sleep(500);
  await click(panel, panel.locator('.v-opt', { hasText: 'Visible area' }));
  await sleep(1200);
  mark('saved');
  await click(panel, panel.locator('.v-opt', { hasText: 'Select an element' }));
  await to(page, page.locator('.product').nth(1), 0.5, 0.5); await sleep(500);
  await click(page, page.locator('.product').nth(1), 0.5, 0.5);
  await sleep(1400);
  await done();
  await click(panel, tool('Extract Images'));
  mark('images');
  for (const k of [0, 2, 4]) { await to(panel, panel.locator('.v-img').nth(k)); await sleep(500); }
  await sleep(700);
  await done();
  await sleep(600);
  mark('end');
});

// Floating mode last: closing the side panel switches the page to floating panels.
await take('floating', {
  siteName: 'acme', full: true,
  before: async () => {
    await panel.close();
    panel = null;
    await page.setViewportSize(FULL);
    await sleep(800);
    await park(page, FULL.width - 30, FULL.height - 30);
  },
}, async (mark) => {
  mark('start');
  await sleep(700);
  // Alt+Shift+K in a real browser; browser shortcuts can't be pressed headlessly, so send its message.
  await sendToTab(tabId, { type: 'open-palette' });
  mark('palette');
  await sleep(700);
  await type(page, 'insp', 120);
  await sleep(500);
  await page.keyboard.press('Enter');
  mark('inspector');
  for (const [sel, fx] of [['h1', 0.3], ['.cta-btn', 0.5]]) { await to(page, page.locator(sel), fx, 0.5); await sleep(800); }
  await click(page, page.locator('.cta-btn'));
  await sleep(1500);
  mark('locked');
  await page.keyboard.press('Escape');
  await sleep(600);
  await sendToTab(tabId, { type: 'open-palette' });
  await sleep(500);
  await type(page, 'pale', 120);
  await sleep(400);
  await page.keyboard.press('Enter');
  mark('color-palette');
  await sleep(900);
  await drag(page, await own('.pd-panel header').boundingBox().then((b) => ({ x: b.x + 120, y: b.y + b.height / 2 })), { x: 560, y: 120 });
  await sleep(1400);
  await page.keyboard.press('Escape');
  await sleep(500);
  mark('end');
});

await ctx.close();
console.log(`Takes → ${TAKES}`);
