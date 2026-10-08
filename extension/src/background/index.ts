import type { EnsureResult, Mode, Msg } from '../lib/messaging';
import { CONFIG, isPro } from '../lib/licence';
import { getSettings, type Settings } from '../lib/storage';

/** Windows whose side panel is open. The side panel holds a port open while it is visible. */
const panels = new Map<number, chrome.runtime.Port>();
/** Cached so keyboard shortcuts can open the side panel synchronously (it must happen inside the user gesture). */
let panelMode: Settings['panelMode'] = 'sidepanel';

async function applyPanelBehavior() {
  ({ panelMode } = await getSettings());
  const side = panelMode === 'sidepanel';
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: side });
  await chrome.action.setPopup({ popup: side ? '' : 'popup.html' });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  void applyPanelBehavior();
  if (reason === 'install') void chrome.tabs.create({ url: chrome.runtime.getURL('options.html?welcome=1') });
});
chrome.runtime.onStartup.addListener(() => void applyPanelBehavior());
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'sync' && changes.settings) void applyPanelBehavior(); });
void getSettings().then((s) => { panelMode = s.panelMode; });

const modeFor = (windowId?: number): Mode => (windowId !== undefined && panels.has(windowId) ? 'sidepanel' : 'floating');

/** Browser-internal pages can never be scripted; anything else is a missing host permission. */
const RESTRICTED = /chrome:\/\/|chrome-extension:|edge:\/\/|brave:\/\/|about:|devtools:|view-source:|gallery cannot be scripted|webstore/i;

async function inject(tabId: number, mode?: Mode): Promise<EnsureResult> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'get-state' });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch (e) {
      const error = (e as Error).message ?? String(e);
      return { ok: false, error, restricted: RESTRICTED.test(error) };
    }
  }
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.sendMessage(tabId, { type: 'config', pro: await isPro(), mode: mode ?? modeFor(tab.windowId) });
  return { ok: true };
}

async function toggle(tabId: number, toolId: string, mode?: Mode): Promise<EnsureResult> {
  const res = await inject(tabId, mode);
  if (res.ok) await chrome.tabs.sendMessage(tabId, { type: 'toggle-tool', toolId });
  return res;
}

chrome.commands.onCommand.addListener((cmd, tab) => {
  if (!tab?.id || tab.windowId === undefined) return;
  const id = tab.id;
  if (cmd === 'open-palette') {
    void inject(id).then((r) => r.ok && chrome.tabs.sendMessage(id, { type: 'open-palette' }));
    return;
  }
  const toolId = cmd === 'toggle-inspector' ? 'inspector' : cmd === 'toggle-picker' ? 'color-picker' : null;
  if (!toolId) return;
  let mode: Mode | undefined;
  if (panelMode === 'sidepanel') {
    // Must be called synchronously within the shortcut's user gesture.
    if (!panels.has(tab.windowId)) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    mode = 'sidepanel';
  }
  void toggle(id, toolId, mode);
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;
  let windowId: number | undefined;
  port.onMessage.addListener((m: { windowId: number }) => { windowId = m.windowId; panels.set(windowId, port); });
  port.onDisconnect.addListener(async () => {
    if (windowId === undefined || panels.get(windowId) !== port) return;
    panels.delete(windowId);
    // Side panel closed: hand any active tool over to the floating panel so nothing disappears.
    for (const t of await chrome.tabs.query({ windowId })) {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: 'set-mode', mode: 'floating' }).catch(() => {});
    }
  });
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

const activeTabId = async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id;

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  (async () => {
    switch (msg.type) {
      case 'capture-visible':
        return chrome.tabs.captureVisibleTab(sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT, { format: 'png' });
      case 'capture-full-page':
        return stitch(msg);
      case 'download':
        await chrome.downloads.download({ url: msg.url, filename: msg.filename });
        return true;
      case 'open-url': {
        // Web apps open in a new tab. App links (claude://, codex://) are handed to the OS from the
        // current tab: the browser asks "Open Claude?" once and the page itself stays put.
        if (/^https?:/.test(msg.url)) await chrome.tabs.create({ url: msg.url });
        else {
          const id = msg.tabId ?? sender.tab?.id ?? (await activeTabId());
          if (id) await chrome.tabs.update(id, { url: msg.url });
        }
        return true;
      }
      case 'open-upgrade':
        await chrome.tabs.create({ url: CONFIG.checkoutUrl });
        return true;
      case 'ensure':
        return inject(msg.tabId, msg.mode);
      case 'toggle-tool': {
        const id = msg.tabId ?? sender.tab?.id ?? (await activeTabId());
        return id ? toggle(id, msg.toolId, msg.mode) : { ok: false, error: 'No active tab' };
      }
    }
  })().then(reply, (e) => reply({ ok: false, error: String(e) }));
  return true;
});
