import type { Msg, PageState } from '../lib/messaging';
import { runtime } from './runtime';
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

declare global { interface Window { __prodev?: boolean } }

if (!window.__prodev) {
  window.__prodev = true;
  [inspector, textEditor, fontsChanger, fontsList, colorPicker, colorPalette, moveElement, deleteElement,
    exportElement, extractImages, ruler, outliner, imageReplacer, screenshot].forEach((t) => runtime.register(t));

  chrome.runtime.onMessage.addListener((msg: Msg, _s, reply) => {
    switch (msg.type) {
      case 'set-pro': runtime.pro = msg.pro; reply(true); break;
      case 'toggle-tool': void runtime.toggle(msg.toolId).then(() => reply(true)); return true;
      case 'deactivate-all': runtime.deactivate(); reply(true); break;
      case 'get-state': reply({ active: runtime.active?.id ?? null, pro: runtime.pro } satisfies PageState); break;
    }
    return false;
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') runtime.deactivate(); }, true);
}
