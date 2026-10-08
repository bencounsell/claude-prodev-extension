import type { Msg, PageState } from '../lib/messaging';
import { broadcast } from '../lib/messaging';
import { runtime } from './runtime';
import { isOwn } from './ui';
import { inspector } from './tools/inspector';
import { textEditor } from './tools/text-editor';
import { fontsChanger } from './tools/fonts-changer';
import { fontsList } from './tools/fonts-list';
import { colorPicker } from './tools/color-picker';
import { colorPalette } from './tools/color-palette';
import { moveElement } from './tools/move-element';
import { deleteElement } from './tools/delete-element';
import { exportElement } from './tools/export-element';
import { extractImages } from './tools/extract-images';
import { ruler } from './tools/ruler';
import { outliner } from './tools/outliner';
import { imageReplacer } from './tools/image-replacer';
import { screenshot } from './tools/screenshot';
import { sendToAi } from './tools/send-to-ai';

declare global { interface Window { __hairline?: boolean } }

const viewport = () => ({ w: innerWidth, h: innerHeight });

if (!window.__hairline) {
  window.__hairline = true;
  [inspector, textEditor, fontsChanger, fontsList, colorPicker, colorPalette, moveElement, deleteElement,
    exportElement, extractImages, ruler, outliner, imageReplacer, screenshot, sendToAi].forEach((t) => runtime.register(t));

  chrome.runtime.onMessage.addListener((msg: Msg, _s, reply) => {
    switch (msg.type) {
      case 'config': runtime.pro = msg.pro; runtime.setMode(msg.mode); reply(true); break;
      case 'set-mode': runtime.setMode(msg.mode); reply(true); break;
      case 'toggle-tool': void runtime.toggle(msg.toolId).then(() => reply(true)); return true;
      case 'tool-action': void Promise.resolve(runtime.action(msg.action, msg.payload)).then(() => reply(true)); return true;
      case 'open-palette': runtime.openPalette(); reply(true); break;
      case 'deactivate-all': runtime.deactivate(); reply(true); break;
      case 'get-state':
        reply({ active: runtime.active?.id ?? null, pro: runtime.pro, mode: runtime.mode, data: runtime.data, viewport: viewport() } satisfies PageState);
        break;
    }
    return false;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Esc inside one of our inputs cancels the edit, not the tool.
    const t = e.composedPath()[0];
    if (isOwn(e) && t instanceof HTMLInputElement) return;
    runtime.deactivate();
  }, true);

  // Keep the side panel's viewport indicator current (the side panel narrows the page).
  let timer: number | undefined;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { if (runtime.mode === 'sidepanel') broadcast({ type: 'viewport', viewport: viewport() }); }, 120);
  });
}
