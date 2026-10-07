// Shared recording rig: launches Chromium with the built extension, records pages with Chrome's
// screencast, injects a visible cursor and provides eased mouse helpers.
// Used by scripts/record-demo.mjs (review clips) and scripts/marketing/capture.mjs (marketing footage).
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const ff = (...args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
export const now = () => Date.now() / 1000;

/* ------------------------------------------------------------------ cursor */

/** Injected into every page: headless Chrome draws no pointer, so we draw one (plus click ripples). */
export const CURSOR = () => {
  if (window.__pdCursor) return;
  window.__pdCursor = true;
  const layer = (css) => {
    const d = document.createElement('div');
    d.setAttribute('popover', 'manual'); // top layer: above every z-index, including ProDev's own UI
    d.style.cssText = `all:initial;inset:auto;position:fixed;left:0;top:0;margin:0;padding:0;border:0;background:transparent;
      pointer-events:none;overflow:visible;outline:none!important;${css}`;
    document.documentElement.append(d);
    try { d.showPopover(); } catch { /* popover unsupported */ }
    return d;
  };
  let c = null;
  addEventListener('mousemove', (e) => {
    if (!c) {
      c = layer('width:26px;height:26px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))');
      c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M6 3.5v17.2l4.3-4.1 2.9 6.6 2.9-1.3-2.9-6.5h6.1z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    }
    c.style.display = 'block';
    c.style.transform = `translate(${e.clientX - 6}px,${e.clientY - 3}px)`;
  }, true);
  addEventListener('mousedown', (e) => {
    const r = layer(`width:36px;height:36px;border-radius:99px;background:rgba(124,108,255,.28);border:2px solid rgba(124,108,255,.85)!important;
      transform:translate(${e.clientX - 18}px,${e.clientY - 18}px)`);
    r.animate([{ scale: '.3', opacity: 1 }, { scale: '1.35', opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => r.remove();
  }, true);
  window.__cursorHide = () => { if (c) c.style.display = 'none'; };
};

/* ------------------------------------------------------------------ recorder */

/** Records one page via Chrome's screencast; frames carry browser timestamps (epoch seconds). */
export class Stream {
  constructor(page, name, dir) {
    this.page = page; this.name = name; this.dir = dir; this.frames = [];
    fs.mkdirSync(dir, { recursive: true });
    // A closed page (the side panel being closed) shows as an empty area from then on.
    page.once('close', () => { this.closedAt = now(); });
  }
  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    let n = 0;
    this.cdp.on('Page.screencastFrame', (f) => {
      const file = path.join(this.dir, `${this.name}-${String(n++).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      this.frames.push({ file, t: f.metadata.timestamp });
      this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95 });
  }
  async stop() { await this.cdp.send('Page.stopScreencast').catch(() => {}); await this.cdp.detach().catch(() => {}); }
  /** Constant-30fps H.264 of this stream between t0 and t1, scaled to `size`. */
  encode(t0, t1, size, out = path.join(this.dir, `${this.name}.mp4`), crf = 16) {
    const frames = [...this.frames];
    if (this.closedAt) {
      const blank = path.join(this.dir, `blank-${size.width}x${size.height}.jpg`);
      if (!fs.existsSync(blank)) ff('-f', 'lavfi', '-i', `color=c=0x16181f:s=${size.width}x${size.height}`, '-frames:v', '1', blank);
      frames.push({ file: blank, t: this.closedAt });
    }
    const all = frames.filter((f) => f.t < t1).sort((a, b) => a.t - b.t);
    const i = all.findLastIndex((f) => f.t <= t0);
    const seq = all.slice(Math.max(i, 0)).map((f) => ({ ...f }));
    if (!seq.length) throw new Error(`${this.name}: no frames`);
    seq[0].t = t0;
    const list = seq.map((f, k) => `file '${f.file}'\nduration ${((seq[k + 1]?.t ?? t1) - f.t).toFixed(4)}`).join('\n');
    const txt = path.join(this.dir, `${this.name}.txt`);
    fs.writeFileSync(txt, `${list}\nfile '${seq.at(-1).file}'\n`);
    ff('-f', 'concat', '-safe', '0', '-i', txt, '-vf', `scale=${size.width}:${size.height}:flags=lanczos,fps=30,format=yuv420p`,
      '-c:v', 'libx264', '-crf', String(crf), '-preset', 'veryfast', out);
    return out;
  }
}

/* ------------------------------------------------------------------ browser */

/**
 * Launches Chromium with the built extension (E2E build, so tools can be injected without a toolbar click).
 * Returns helpers bound to that browser.
 */
export async function launch({ root = process.cwd(), deviceScaleFactor = 1, viewport = { width: 900, height: 800 } } = {}) {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'pd-rec-')), {
    executablePath: process.env.CHROMIUM_PATH, headless: false, acceptDownloads: true, viewport, deviceScaleFactor,
    args: [`--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`, '--headless=new', '--no-sandbox'],
  });
  await ctx.addInitScript(CURSOR);
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  for (let i = 0; i < 50 && !(await sw.evaluate(() => !!chrome.tabs)); i++) await sleep(100);
  const EXT = `chrome-extension://${new URL(sw.url()).host}`;

  const setPro = (pro) => sw.evaluate((p) => (p
    ? chrome.storage.local.set({ licence: { key: 'demo', instanceId: 'demo', validatedAt: Date.now(), valid: true } })
    : chrome.storage.local.remove('licence')), pro);

  /** Opens `url` in its own (visible) window so it keeps painting while we work in another one. */
  async function openWindow(url, size) {
    const [p] = await Promise.all([ctx.waitForEvent('page'), sw.evaluate((u) => chrome.windows.create({ url: u, focused: false }), url)]);
    await p.waitForLoadState();
    await p.setViewportSize(size);
    return p;
  }

  const tabIdFor = (needle) => sw.evaluate(async (n) => (await chrome.tabs.query({})).find((t) => t.url?.includes(n))?.id, needle);
  const sendToTab = (tabId, msg) => sw.evaluate(([id, m]) => chrome.tabs.sendMessage(id, m), [tabId, msg]);

  return { ctx, sw, EXT, setPro, openWindow, tabIdFor, sendToTab };
}

/* ------------------------------------------------------------------ mouse */

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Mouse helpers that move with ease-in-out paths in real time (so recordings look hand-driven)
 * and hide the cursor in other pages when switching between them.
 */
export function driver(getPages, { speed = 1 } = {}) {
  const pos = new WeakMap();
  async function moveTo(p, x, y) {
    for (const o of getPages()) if (o !== p) await o.evaluate(() => window.__cursorHide?.()).catch(() => {});
    const from = pos.get(p) ?? { x: x + 40, y: y + 60 };
    const dist = Math.hypot(x - from.x, y - from.y);
    const n = Math.max(8, Math.min(48, Math.round(dist / (12 * speed))));
    for (let i = 1; i <= n; i++) {
      const k = ease(i / n);
      await p.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
      await sleep(11);
    }
    pos.set(p, { x, y });
  }
  async function to(p, loc, fx = 0.5, fy = 0.5) {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    await moveTo(p, b.x + b.width * fx, b.y + b.height * fy);
  }
  async function click(p, loc, fx, fy) {
    await to(p, loc, fx, fy);
    await sleep(160);
    await p.mouse.down(); await sleep(80); await p.mouse.up();
    await sleep(240);
  }
  async function drag(p, from, toPt) {
    await moveTo(p, from.x, from.y);
    await sleep(120);
    await p.mouse.down();
    await moveTo(p, toPt.x, toPt.y);
    await sleep(120);
    await p.mouse.up();
  }
  const type = (p, text, delay = 75) => p.keyboard.type(text, { delay });
  /** Parks the cursor out of shot and hides it. */
  async function park(p, x, y) { await p.mouse.move(x, y); pos.set(p, { x, y }); await p.evaluate(() => window.__cursorHide?.()).catch(() => {}); }
  return { moveTo, to, click, drag, type, park };
}
