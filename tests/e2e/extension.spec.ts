import { test, expect, chromium, type BrowserContext, type Worker, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = 'file://' + path.join(root, 'tests/fixtures/page.html');

let ctx: BrowserContext, sw: Worker, page: Page;

async function toggle(id: string) {
  await sw.evaluate(async (toolId) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url?.includes('fixtures/page.html'))!;
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id!, { type: 'toggle-tool', toolId });
  }, id);
}
const setPro = (pro: boolean) =>
  sw.evaluate(async (p) => {
    if (p) await chrome.storage.local.set({ licence: { key: 'x', instanceId: 'x', validatedAt: Date.now(), valid: true } });
    else await chrome.storage.local.remove('licence');
    const tab = (await chrome.tabs.query({})).find((t) => t.url?.includes('fixtures/page.html'))!;
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id!, { type: 'set-pro', pro: p });
  }, pro);
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
  await expect(shadow('.pd-panel')).toContainText('32px');
});

test('delete element hides and is undoable', async () => {
  await toggle('delete-element');
  await page.click('#card');
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('card')!).display)).toBe('none');
  await shadow('button:has-text("Undo")').click();
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('card')!).display)).toBe('block');
});

test('fonts list reports page fonts', async () => {
  await toggle('fonts-list');
  await expect(shadow('.pd-panel')).toContainText('Georgia');
});

test('color palette is gated without Pro, works with Pro', async () => {
  await setPro(false);
  await toggle('color-palette');
  await expect(shadow('.pd-toast')).toContainText('Pro feature');
  await expect(page.locator('prodev-root .pd-panel')).toHaveCount(0);
  await setPro(true);
  await toggle('color-palette');
  await expect(shadow('.pd-panel')).toContainText('Color palette');
  await expect(shadow('[data-c="#dd3333"]')).toBeVisible();
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
  await expect(shadow('.pd-panel')).toContainText('Images (');
});
