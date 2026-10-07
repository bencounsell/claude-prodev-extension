import type { Msg } from '../lib/messaging';
import { CONFIG, isPro } from '../lib/licence';

async function inject(tabId: number) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'get-state' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }
  await chrome.tabs.sendMessage(tabId, { type: 'set-pro', pro: await isPro() });
}

async function toggle(tabId: number, toolId: string) {
  await inject(tabId);
  await chrome.tabs.sendMessage(tabId, { type: 'toggle-tool', toolId });
}

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (!tab?.id) return;
  if (cmd === 'toggle-inspector') await toggle(tab.id, 'inspector');
  if (cmd === 'toggle-picker') await toggle(tab.id, 'color-picker');
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') void chrome.runtime.openOptionsPage();
});

async function stitch(m: Extract<Msg, { type: 'capture-full-page' }>): Promise<string> {
  const bmps = await Promise.all(m.shots.map(async (s) => createImageBitmap(await (await fetch(s.url)).blob())));
  const scale = bmps[0].width / m.width;
  const canvas = new OffscreenCanvas(bmps[0].width, Math.round(m.height * scale));
  const ctx = canvas.getContext('2d')!;
  const maxY = m.height - m.viewportHeight;
  bmps.forEach((b, i) => ctx.drawImage(b, 0, Math.round(Math.min(m.shots[i].y, maxY) * scale)));
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:image/png;base64,${btoa(bin)}`;
}

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  (async () => {
    switch (msg.type) {
      case 'capture-visible':
        return chrome.tabs.captureVisibleTab({ format: 'png' });
      case 'capture-full-page':
        return stitch(msg);
      case 'download':
        await chrome.downloads?.download({ url: msg.url, filename: msg.filename });
        return true;
      case 'open-upgrade':
        await chrome.tabs.create({ url: CONFIG.checkoutUrl });
        return true;
      case 'toggle-tool': {
        const id = sender.tab?.id ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
        if (id) await toggle(id, msg.toolId);
        return true;
      }
    }
  })().then(reply);
  return true;
});
