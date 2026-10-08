// Records review videos (MP4) + key-frame PNGs of Hairline in action.
//
//   E2E=1 npm run build && CHROMIUM_PATH=/path/to/chrome OUT=media node scripts/record-demo.mjs
//
// The demo site and the side panel run in two headless windows. Each is recorded with Chrome's
// screencast at full resolution, then both streams are aligned by timestamp and stacked side by side
// (900px page + 380px panel = what a 1280px window looks like with the side panel open).
// Headless Chrome has no visible mouse pointer, so a small cursor + click ripple is injected.
// Raw captures for internal review: no captions or framing.
import fs from 'node:fs';
import path from 'node:path';
import { Stream, driver, ff, launch, sleep } from './lib/rig.mjs';

const root = process.cwd();
const OUT = path.resolve(process.env.OUT ?? 'media');
const FRAMES = path.join(OUT, '.frames');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'review'), { recursive: true });

const PAGE = { width: 900, height: 800 };
const PANEL = { width: 380, height: 800 };
const FULL = { width: 1280, height: 800 };

const { ctx, sw, EXT, setPro, openWindow, tabIdFor } = await launch({ root, viewport: PAGE });
await setPro(true);
await sw.evaluate(() => chrome.storage.local.set({ recent: [] }));

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.setViewportSize(PAGE);
await page.goto('file://' + path.join(root, 'tests/fixtures/demo.html'));
const tabId = await tabIdFor('demo.html');
let panel = await openWindow(`${EXT}/sidepanel.html?tab=${tabId}`, PANEL);

/* ------------------------------------------------------------------ helpers */

const pages = () => [page, panel].filter((p) => p && !p.isClosed());
const { moveTo, to, click, type } = driver(pages);
const tool = (name) => panel.locator('.launcher .tool', { hasText: name });
const done = () => click(panel, panel.locator('.sp-toolbar .v-btn', { hasText: 'Done' }));
const own = (sel) => page.locator(`prodev-root ${sel}`);

/** Resets the demo page and puts the side panel back on its tool launcher. */
async function resetStage() {
  await page.reload();
  await panel.waitForSelector('.launcher .tool');
  await sleep(500);
  await page.mouse.move(PAGE.width - 40, PAGE.height - 40);
  await page.evaluate(() => window.__cursorHide?.());
  await panel.mouse.move(PANEL.width - 20, PANEL.height - 60);
  await panel.evaluate(() => window.__cursorHide?.());
}

const clips = [];
async function scene(name, { stacked = true, size = FULL } = {}, body) {
  console.log(`● ${name}`);
  const subjects = stacked ? [new Stream(page, `${name}-page`, FRAMES), new Stream(panel, `${name}-panel`, FRAMES)] : [new Stream(body.page ?? page, `${name}-page`, FRAMES)];
  const marks = [];
  for (const s of subjects) await s.start();
  await sleep(400);
  const now = () => Date.now() / 1000;
  const t0 = now();
  await body.run({ mark: (m) => marks.push({ m, t: now() - t0 }) });
  await sleep(900);
  const t1 = now();
  for (const s of subjects) await s.stop();
  const out = path.join(OUT, `${String(clips.length + 1).padStart(2, '0')}-${name}.mp4`);
  if (stacked) {
    const a = subjects[0].encode(t0, t1, PAGE);
    const b = subjects[1].encode(t0, t1, PANEL);
    ff('-i', a, '-i', b, '-filter_complex', '[0:v][1:v]hstack=inputs=2,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out);
  } else {
    const a = subjects[0].encode(t0, t1, size);
    fs.copyFileSync(a, out);
  }
  for (const { m, t } of marks) ff('-ss', t.toFixed(2), '-i', out, '-frames:v', '1', path.join(OUT, 'stills', `${path.basename(out, '.mp4')}--${m}.png`));
  ff('-i', out, '-vf', `fps=1/${Math.max(1, Math.round((t1 - t0) / 9))},scale=420:-1,tile=3x3`, '-frames:v', '1', path.join(OUT, 'review', `${path.basename(out, '.mp4')}.png`));
  clips.push(out);
}

/* ------------------------------------------------------------------ scenes */

await resetStage();
await scene('side-panel-css-inspector', {}, { async run({ mark }) {
  await sleep(700);
  await click(panel, tool('CSS Inspector'));
  for (const sel of ['h1', '.lead', '.stat div', '.card', '.cta-btn']) { await to(page, page.locator(sel).first(), 0.4, 0.5, 26); await sleep(650); }
  await click(page, page.locator('.cta-btn'));
  mark('locked');
  await sleep(600);
  for (const [prop, value] of [['font-size', '20px'], ['background-color', '#7c3aed'], ['border-radius', '999px']]) {
    const input = panel.locator(`input[data-p="${prop}"]`);
    await click(panel, input, 0.8);
    await panel.keyboard.press('ControlOrMeta+a');
    await type(panel, value);
    await panel.keyboard.press('Enter');
    await sleep(700);
  }
  mark('edited');
  await click(panel, panel.locator('.v-btn', { hasText: 'Copy CSS' }));
  await sleep(800);
  await click(panel, panel.locator('.v-btn', { hasText: 'Reset edits' }));
  await sleep(900);
  await done();
} });

await resetStage();
await scene('palette-fonts-images', {}, { async run({ mark }) {
  await click(panel, tool('Color Palette'));
  await sleep(500);
  for (const k of [0, 3, 5, 9]) { await to(panel, panel.locator('.v-swatch').nth(k)); await sleep(350); }
  await click(panel, panel.locator('.v-swatch').nth(5));
  mark('palette');
  await sleep(600);
  await click(panel, panel.locator('.v-btn', { hasText: 'Copy as Tailwind' }));
  await sleep(700);
  await done();
  await click(panel, tool('List All Fonts'));
  await sleep(500);
  mark('fonts');
  await to(panel, panel.locator('.v-font').nth(1)); await sleep(1200);
  await done();
  await click(panel, tool('Fonts Changer'));
  for (const f of ['Courier New', 'Georgia']) { await click(panel, panel.locator('.v-fontopt', { hasText: f })); await sleep(1000); }
  mark('fonts-changer');
  await click(panel, panel.locator('.v-btn', { hasText: 'Restore original fonts' }));
  await sleep(600);
  await done();
  await click(panel, tool('Extract Images'));
  await sleep(500);
  mark('images');
  for (const k of [0, 2]) { await to(panel, panel.locator('.v-img').nth(k)); await sleep(500); }
  await sleep(600);
  await done();
} });

await resetStage();
await scene('page-tools', {}, { async run({ mark }) {
  await click(panel, tool('Page Outliner'));
  for (const [x, y] of [[180, 260], [420, 460], [700, 380], [300, 820 - 160]]) { await moveTo(page, x, y, 24); await sleep(500); }
  mark('outliner');
  await done();
  await click(panel, tool('Page Ruler'));
  await moveTo(page, 100, 205); await page.mouse.down();
  await moveTo(page, 560, 395, 30); await sleep(300);
  mark('ruler');
  await page.mouse.up(); await sleep(900);
  await done();
  await click(panel, tool('Delete Element'));
  await click(page, page.locator('.feat div').nth(2));
  await click(page, page.locator('.proof'));
  mark('deleted');
  await sleep(500);
  await click(panel, panel.locator('.v-btn', { hasText: 'Undo last' }));
  await sleep(500);
  await click(panel, panel.locator('.v-btn', { hasText: 'Restore all' }));
  await sleep(500);
  await done();
  await click(panel, tool('Move Element'));
  const card = page.locator('.card');
  // Grab the card by its padding so the card itself moves, not a child.
  await to(page, card, 0.03, 0.5); await page.mouse.down();
  const b = await card.boundingBox();
  await moveTo(page, b.x + b.width * 0.03 - 60, b.y + b.height * 0.5 + 150, 30);
  await page.mouse.up(); await sleep(400);
  mark('moved');
  await done();
  await click(panel, tool('Live Text Editor'));
  await click(page, page.locator('h1'), 0.99, 0.85);
  await page.keyboard.press('End');
  await type(page, ' Today.', 90);
  mark('text-edited');
  await sleep(500);
  await done();
} });

await resetStage();
await scene('export-element', {}, { async run({ mark }) {
  await click(panel, tool('Export Element'));
  for (const sel of ['h1', '.cta-btn', '.card']) { await to(page, page.locator(sel), 0.3, 0.4); await sleep(450); }
  await click(page, page.locator('.card'), 0.3, 0.1);
  await sleep(500);
  mark('exported');
  await to(panel, panel.locator('.v-code'), 0.5, 0.5);
  await panel.mouse.wheel(0, 260); await sleep(700);
  await click(panel, panel.locator('.v-btn', { hasText: 'Copy HTML' }));
  await sleep(600);
  await done();
} });

await resetStage();
await scene('screenshot', {}, { async run({ mark }) {
  await click(panel, tool('Take Screenshot'));
  await sleep(500);
  await click(panel, panel.locator('.v-opt', { hasText: 'Visible area' }));
  await sleep(1100);
  mark('saved');
  await click(panel, panel.locator('.v-opt', { hasText: 'Select an element' }));
  await to(page, page.locator('.card'), 0.5, 0.5); await sleep(400);
  await click(page, page.locator('.card'), 0.5, 0.5);
  await sleep(1300);
  await done();
} });

await setPro(false);
await resetStage();
await scene('pro-gating', {}, { async run({ mark }) {
  await sleep(600);
  await click(panel, tool('Color Palette'));
  await sleep(500);
  mark('upsell');
  await sleep(900);
  await click(panel, panel.locator('.sp-upsell .v-btn', { hasText: 'Maybe later' }));
  await click(panel, tool('CSS Inspector'));
  await click(page, page.locator('.cta-btn'));
  await click(panel, panel.locator('input[data-p="font-size"]'), 0.8);
  await sleep(900);
  await click(panel, panel.locator('.sp-upsell .v-btn', { hasText: 'Maybe later' }));
  await done();
} });
await setPro(true);

await resetStage();
await scene('close-panel-handoff', {}, { async run({ mark }) {
  await click(panel, tool('CSS Inspector'));
  await click(page, page.locator('h1'), 0.3, 0.5);
  await sleep(700);
  mark('before-close');
  // Closing the side panel mid-tool: the inspector moves to the floating panel on the page.
  await panel.close();
  await sleep(1400);
  mark('after-close');
} });

// Floating mode at full window width.
await page.setViewportSize(FULL);
await scene('floating-mode', { stacked: false }, { async run({ mark }) {
  await sleep(600);
  mark('floating-inspector');
  await to(page, own('.pd-panel input[data-p="font-size"]'), 0.8); await sleep(400);
  await click(page, own('.pd-panel input[data-p="font-size"]'), 0.8);
  await page.keyboard.press('ControlOrMeta+a'); await type(page, '72px'); await page.keyboard.press('Enter');
  await sleep(800);
  await click(page, own('.pd-panel .v-btn').filter({ hasText: 'Reset edits' }));
  await page.keyboard.press('Escape'); await sleep(500);
  // Command palette (Alt+Shift+K in a real browser; browser shortcuts can't be pressed headlessly, so send the command's message).
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'open-palette' }), tabId);
  await sleep(500);
  await type(page, 'pale', 110);
  mark('command-palette');
  await sleep(600);
  await page.keyboard.press('Enter');
  await sleep(900);
  const head = own('.pd-panel header');
  await to(page, head, 0.4, 0.5); await page.mouse.down();
  await moveTo(page, 520, 140, 30); await page.mouse.up();
  mark('floating-palette');
  await sleep(900);
  await page.keyboard.press('Escape');
} });

// Popup (floating mode's launcher) and settings.
const popup = await openWindow(`${EXT}/popup.html`, { width: 400, height: 590 });
await scene('popup', { stacked: false, size: { width: 400, height: 590 } }, { page: popup, async run({ mark }) {
  await sleep(500);
  for (const k of ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowDown']) { await popup.keyboard.press(k); await sleep(350); }
  await type(popup, 'col', 140);
  mark('search');
  await sleep(900);
} });
await popup.close();
const opts = await openWindow(`${EXT}/options.html?welcome=1`, FULL);
await scene('settings', { stacked: false }, { page: opts, async run({ mark }) {
  await sleep(700);
  mark('welcome');
  for (let i = 0; i < 6; i++) { await opts.mouse.move(640, 400); await opts.mouse.wheel(0, 140); await sleep(220); }
  await click(opts, opts.locator('.mode', { hasText: 'Floating' }));
  await sleep(500);
  await click(opts, opts.locator('.mode', { hasText: 'Side panel' }));
  for (const t of ['Dark', 'Light', 'System']) { await click(opts, opts.locator('.seg button', { hasText: t })); await sleep(650); }
  mark('appearance');
  for (let i = 0; i < 8; i++) { await opts.mouse.wheel(0, 160); await sleep(200); }
  await sleep(600);
} });
await ctx.close();

/* ------------------------------------------------------------------ walkthrough */

const norm = clips.map((c, i) => {
  const o = path.join(FRAMES, `norm-${i}.mp4`);
  ff('-i', c, '-vf', `scale=${FULL.width}:${FULL.height}:force_original_aspect_ratio=decrease,pad=${FULL.width}:${FULL.height}:(ow-iw)/2:(oh-ih)/2:color=0x101219,setsar=1,fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', o);
  return o;
});
const list = path.join(FRAMES, 'all.txt');
fs.writeFileSync(list, norm.map((n) => `file '${n}'`).join('\n'));
ff('-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(OUT, '00-hairline-walkthrough.mp4'));
if (!process.env.KEEP_FRAMES) fs.rmSync(FRAMES, { recursive: true, force: true });
console.log(`Done → ${OUT}`);
