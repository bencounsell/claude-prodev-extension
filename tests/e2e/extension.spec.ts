import { test, expect, chromium, type BrowserContext, type Worker, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = 'file://' + path.join(root, 'tests/fixtures/page.html');

let ctx: BrowserContext, sw: Worker, page: Page;

const FIXTURE = (t: chrome.tabs.Tab) => !!t.url?.includes('fixtures/page.html');

/** Injects the content script and runs a tool in floating mode (as the popup / shortcuts do). */
async function toggle(id: string) {
  await sw.evaluate(async (toolId) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url?.includes('fixtures/page.html'))!;
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'] });
    const pro = !!(await chrome.storage.local.get('licence')).licence;
    await chrome.tabs.sendMessage(tab.id!, { type: 'config', pro, mode: 'floating' });
    await chrome.tabs.sendMessage(tab.id!, { type: 'toggle-tool', toolId });
  }, id);
}
const setPro = (pro: boolean) =>
  sw.evaluate(async (p) => {
    if (p) await chrome.storage.local.set({ licence: { key: 'x', instanceId: 'x', validatedAt: Date.now(), valid: true } });
    else await chrome.storage.local.remove('licence');
    const tab = (await chrome.tabs.query({})).find((t) => t.url?.includes('fixtures/page.html'))!;
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id!, { type: 'config', pro: p, mode: 'floating' });
  }, pro);
const fixtureTabId = () => sw.evaluate(async () => (await chrome.tabs.query({})).find((t) => t.url?.includes('fixtures/page.html'))!.id!);
void FIXTURE;
const shadow = (sel: string) => page.locator(`prodev-root >> ${sel}`);

test.beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-'));
  ctx = await chromium.launchPersistentContext(dir, {
    executablePath: process.env.CHROMIUM_PATH,
    headless: false,
    args: [`--disable-extensions-except=${path.join(root, 'dist')}`, `--load-extension=${path.join(root, 'dist')}`, '--headless=new', '--no-sandbox'],
  });
  sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  page = await ctx.newPage();
  await page.goto(fixture);
});
test.afterAll(async () => ctx.close());
test.afterEach(async () => { await page.keyboard.press('Escape'); });

test('manifest is MV3 with minimal permissions', async () => {
  const m = await sw.evaluate(() => chrome.runtime.getManifest());
  expect(m.manifest_version).toBe(3);
  expect(m.permissions).toEqual(expect.arrayContaining(['activeTab', 'scripting', 'storage']));
});

test('outliner adds outlines then cleans up', async () => {
  await toggle('outliner');
  await expect(shadow('.pd-bar')).toContainText('Page Outliner');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('para')!).outlineStyle)).toBe('solid');
  await page.keyboard.press('Escape');
  await expect(page.locator('prodev-root .pd-bar')).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('para')!).outlineStyle)).toBe('none');
});

test('inspector shows computed styles on hover', async () => {
  await toggle('inspector');
  await page.hover('#title', { position: { x: 20, y: 10 } });
  await expect(shadow('.pd-panel')).toContainText('font-size');
  await expect(shadow('input[data-p="font-size"]')).toHaveValue('32px');
  await expect(shadow('.v-bm')).toBeVisible();
});

test('inspector live-edits styles inline with Pro, and resets', async () => {
  await setPro(true);
  await toggle('inspector');
  await page.click('#title', { position: { x: 20, y: 10 } });
  const v = shadow('input[data-p="font-size"]');
  await v.fill('48px');
  await v.press('Enter');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('title')!).fontSize)).toBe('48px');
  await shadow('button:has-text("Reset edits")').click();
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('title')!).fontSize)).toBe('32px');
});

test('command palette launches a tool', async () => {
  await sw.evaluate(async () => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url?.includes('fixtures/page.html'))!;
    await chrome.tabs.sendMessage(tab.id!, { type: 'open-palette' });
  });
  await expect(shadow('.pd-pal')).toBeVisible();
  await page.keyboard.type('ruler');
  await page.keyboard.press('Enter');
  await expect(shadow('.pd-bar')).toContainText('Page Ruler');
});

test('delete element hides and is undoable', async () => {
  await toggle('delete-element');
  await page.click('#card');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('card')!).display)).toBe('none');
  await expect(shadow('.v-stat')).toContainText('1');
  await shadow('button:has-text("Undo last")').click();
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('card')!).display)).toBe('block');
});

test('fonts list reports page fonts', async () => {
  await toggle('fonts-list');
  await expect(shadow('.pd-panel')).toContainText('Georgia');
});

test('color palette is gated without Pro, works with Pro', async () => {
  await setPro(false);
  await toggle('color-palette');
  await expect(shadow('.pd-up')).toContainText('Pro feature');
  await expect(page.locator('prodev-root .pd-panel')).toHaveCount(0);
  await shadow('button:has-text("Maybe later")').click();
  await expect(page.locator('prodev-root .pd-up')).toHaveCount(0);
  await setPro(true);
  await toggle('color-palette');
  await expect(shadow('.pd-panel')).toContainText('Color Palette');
  await expect(shadow('.v-swatch[title^="#dd3333"]')).toBeVisible();
});

test('text editor toggles designMode', async () => {
  await toggle('text-editor');
  expect(await page.evaluate(() => document.designMode)).toBe('on');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.designMode)).toBe('off');
});

test('extract images lists page images (Pro)', async () => {
  await setPro(true);
  await toggle('extract-images');
  await expect(shadow('.pd-panel')).toContainText('Download all (1)');
});

/* ------------------------------------------------------------------ side panel */

test.describe('side panel', () => {
  let panel: Page;
  const open = async () => {
    panel = await ctx.newPage();
    await panel.setViewportSize({ width: 380, height: 800 });
    await panel.goto(`chrome-extension://${new URL(sw.url()).host}/sidepanel.html?tab=${await fixtureTabId()}`);
  };
  test.afterEach(async () => { await panel?.close().catch(() => {}); });

  test('shows the launcher and the page viewport', async () => {
    await open();
    await expect(panel.locator('.launcher .tool')).toHaveCount(15);
    await expect(panel.locator('.vp')).toContainText('×');
    await expect(panel.locator('.vp b')).toHaveText(/xs|sm|md|lg|xl/);
  });

  test('runs the inspector with its view in the side panel, not on the page', async () => {
    await setPro(true);
    await open();
    await panel.locator('.tool', { hasText: 'CSS Inspector' }).click();
    await expect(panel.locator('.sp-toolbar')).toContainText('CSS Inspector');
    await expect(page.locator('prodev-root .pd-bar')).toContainText('CSS Inspector');
    await expect(page.locator('prodev-root .pd-panel')).toHaveCount(0);
    await page.bringToFront();
    await page.click('#title', { position: { x: 20, y: 10 } });
    await expect(panel.locator('input[data-p="font-size"]')).toHaveValue('32px');
    // Live edit from the side panel applies to the page.
    await panel.locator('input[data-p="font-size"]').fill('40px');
    await panel.locator('input[data-p="font-size"]').press('Enter');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('title')!).fontSize)).toBe('40px');
    await panel.locator('button:has-text("Reset edits")').click();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('title')!).fontSize)).toBe('32px');
    await panel.locator('.sp-toolbar button:has-text("Done")').click();
    await expect(page.locator('prodev-root .pd-bar')).toHaveCount(0);
    await expect(panel.locator('.launcher')).toBeVisible();
  });

  test('Pro tools show an upsell inside the side panel', async () => {
    await setPro(false);
    await open();
    await panel.locator('.tool', { hasText: 'Color Palette' }).click();
    await expect(panel.locator('.sp-upsell')).toContainText('Color Palette is a Pro feature');
    await panel.locator('button:has-text("Maybe later")').click();
    await expect(panel.locator('.sp-upsell')).toHaveCount(0);
  });

  test('closing the side panel hands the active tool to the floating panel', async () => {
    await setPro(true);
    await open();
    await panel.locator('.tool', { hasText: 'List All Fonts' }).click();
    await expect(panel.locator('.v-font').first()).toBeVisible();
    await expect(page.locator('prodev-root .pd-panel')).toHaveCount(0);
    await panel.close();
    await expect(shadow('.pd-panel')).toContainText('Georgia');
  });
});

/* ------------------------------------------------------------------ Send to AI */

test.describe('send to AI', () => {
  test('builds a Recreate prompt for a picked element and opens Claude prefilled', async () => {
    await setPro(true);
    await toggle('send-to-ai');
    await expect(shadow('.pd-panel')).toContainText('An element');
    await page.click('#card', { position: { x: 10, y: 10 } });
    await expect(shadow('.v-ai-meta')).toContainText('div#card');
    await expect(shadow('.v-ai-shot')).toBeVisible();
    await shadow('.v-format:has-text("React + Tailwind")').click();
    await shadow('.v-preview summary').click();
    const preview = shadow('.v-preview pre');
    await expect(preview).toContainText('React function component');
    await expect(preview).toContainText('Some paragraph text');
    await expect(preview).toContainText('#card');
    const [tab] = await Promise.all([ctx.waitForEvent('page'), shadow('button:has-text("Open in Claude")').click()]);
    await expect.poll(() => tab.url()).toMatch(/^https:\/\/claude\.ai\/new\?q=/);
    expect(decodeURIComponent(tab.url().split('?q=')[1])).toContain('Recreate the UI below as React + Tailwind');
    await tab.close();
  });

  test('free users can Ask; Recreate shows the upsell', async () => {
    await setPro(false);
    await toggle('send-to-ai');
    await page.click('#title', { position: { x: 20, y: 10 } });
    await expect(shadow('.v-ai-meta')).toContainText('h1#title');
    await shadow('button:has-text("Open in Claude")').click();
    await expect(shadow('.pd-up')).toContainText('Recreate with AI is a Pro feature');
    await shadow('button:has-text("Maybe later")').click();
    await shadow('.v-seg button:has-text("Ask")').click();
    await shadow('#pd-ai-input').fill('Why is this heading red?');
    const [tab] = await Promise.all([ctx.waitForEvent('page'), shadow('button:has-text("Open in Claude")').click()]);
    await expect.poll(() => tab.url()).toMatch(/^https:\/\/claude\.ai\/new\?q=/);
    expect(decodeURIComponent(tab.url())).toContain('Why is this heading red?');
    await tab.close();
  });

  test('inspector hands its element to Send to AI and applies pasted CSS', async () => {
    await setPro(true);
    await toggle('inspector');
    await page.click('#title', { position: { x: 20, y: 10 } });
    await shadow('summary:has-text("Apply CSS from your AI app")').click();
    await shadow('#pd-apply-css').fill('```css\n{ font-size: 50px; color: rgb(1, 2, 3); }\n```');
    await shadow('button:has-text("Apply to element")').click();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('title')!).fontSize)).toBe('50px');
    await shadow('button:has-text("Reset edits")').click();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById('title')!).fontSize)).toBe('32px');
    await shadow('.pd-panel button:has-text("Send to AI")').click();
    await expect(shadow('.pd-bar')).toContainText('Send to AI');
    await expect(shadow('.v-ai-meta')).toContainText('h1#title');
  });

  test('works from the side panel', async () => {
    await setPro(true);
    const panel = await ctx.newPage();
    await panel.setViewportSize({ width: 380, height: 800 });
    await panel.goto(`chrome-extension://${new URL(sw.url()).host}/sidepanel.html?tab=${await fixtureTabId()}`);
    await panel.locator('.tool', { hasText: 'Send to AI' }).click();
    await expect(panel.locator('.sp-toolbar')).toContainText('Send to AI');
    await page.bringToFront();
    await page.click('#card', { position: { x: 10, y: 10 } });
    await expect(panel.locator('.v-ai-meta')).toContainText('div#card');
    await panel.locator('.v-seg button:has-text("Style guide")').click();
    await panel.locator('.v-preview summary').click();
    await expect(panel.locator('.v-preview pre')).toContainText('@theme');
    await panel.close();
  });
});
