import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { highlightBox, isOwn, toast } from '../ui';
import { captureElement, captureVisible, withoutOverlay } from '../analyze';
import { runtime } from '../runtime';
import { sendToBackground } from '../../lib/messaging';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;
let picking = false;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const save = (dataUrl: string, name: string) => sendToBackground({ type: 'download', url: dataUrl, filename: `hairline/${name}-${Date.now()}.png` });
const publish = () => runtime.publish({ picking });

const visible = captureVisible;

async function fullPage() {
  if (!runtime.requirePro('Full-page screenshots')) return;
  toast('Capturing full page…');
  const out = await withoutOverlay(async () => {
    const vh = innerHeight, total = document.documentElement.scrollHeight, startY = scrollY;
    const shots: { y: number; url: string }[] = [];
    for (let y = 0; y < total; y += vh) {
      scrollTo(0, y);
      await wait(350); // let lazy content settle & respect captureVisibleTab's rate limit
      shots.push({ y: scrollY, url: await sendToBackground<string>({ type: 'capture-visible' }) });
    }
    scrollTo(0, startY);
    return sendToBackground<string>({ type: 'capture-full-page', width: innerWidth, height: total, dpr: devicePixelRatio, viewportHeight: vh, shots });
  });
  await save(out, 'full-page');
  toast('Full-page screenshot saved');
}

async function element(t: Element) {
  hl!.hide();
  await save(await captureElement(t), 'element');
  toast('Element screenshot saved');
}

export const screenshot: Tool = {
  id: 'screenshot',
  activate() {
    picking = false;
    hl = highlightBox();
    publish();
    off = [
      listen('mousemove', (e) => { if (!picking || isOwn(e)) return; const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }),
      listen('click', (e) => {
        if (!picking || isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        picking = false;
        publish();
        const t = target(e);
        if (t) void element(t);
      }),
    ];
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); picking = false; },
  async onAction(action) {
    if (action === 'visible') { await save(await visible(), 'screenshot'); toast('Screenshot saved'); }
    if (action === 'full') await fullPage();
    if (action === 'element') { picking = true; publish(); toast('Click an element to capture it'); }
  },
};
