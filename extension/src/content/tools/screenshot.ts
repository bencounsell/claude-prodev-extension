import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { bar, highlightBox, isOwn, overlay, toast } from '../ui';
import { runtime } from '../runtime';
import { sendToBackground } from '../../lib/messaging';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;
let b: HTMLElement | null = null;
let picking = false;

const save = (dataUrl: string, name: string) => sendToBackground({ type: 'download', url: dataUrl, filename: `prodev/${name}-${Date.now()}.png` });

async function visible() {
  const hide = overlay().host as HTMLElement;
  hide.style.visibility = 'hidden';
  await new Promise((r) => setTimeout(r, 80));
  const url = await sendToBackground<string>({ type: 'capture-visible' });
  hide.style.visibility = '';
  return url;
}

async function fullPage() {
  if (!runtime.requirePro('Full-page screenshots')) return;
  const hide = overlay().host as HTMLElement;
  hide.style.visibility = 'hidden';
  const vh = innerHeight, total = document.documentElement.scrollHeight, startY = scrollY;
  const shots: { y: number; url: string }[] = [];
  for (let y = 0; y < total; y += vh) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 250)); // let lazy content settle & respect capture rate limit
    shots.push({ y: scrollY, url: await sendToBackground<string>({ type: 'capture-visible' }) });
  }
  scrollTo(0, startY);
  hide.style.visibility = '';
  const out = await sendToBackground<string>({ type: 'capture-full-page', width: innerWidth, height: total, dpr: devicePixelRatio, viewportHeight: vh, shots });
  save(out, 'full-page');
  toast('Full-page screenshot saved');
}

export const screenshot: Tool = {
  id: 'screenshot',
  activate() {
    hl = highlightBox();
    b = bar('Screenshot', [
      { label: 'Visible area', primary: true, onClick: async () => { save(await visible(), 'screenshot'); toast('Screenshot saved'); } },
      { label: 'Full page (Pro)', onClick: fullPage },
      { label: 'Element', onClick: () => { picking = true; toast('Click an element to capture it'); } },
      { label: 'Done', onClick: () => runtime.deactivate() },
    ]);
    off = [
      listen('mousemove', (e) => { if (isOwn(e)) return; const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }),
      listen('click', async (e) => {
        if (!picking || isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        picking = false;
        const t = target(e);
        if (!t) return;
        const r = t.getBoundingClientRect();
        hl!.hide();
        const img = new Image();
        img.src = await visible();
        await img.decode();
        const k = img.naturalWidth / innerWidth;
        const c = document.createElement('canvas');
        c.width = Math.max(1, r.width * k); c.height = Math.max(1, r.height * k);
        c.getContext('2d')!.drawImage(img, r.left * k, r.top * k, r.width * k, r.height * k, 0, 0, c.width, c.height);
        save(c.toDataURL('image/png'), 'element');
        toast('Element screenshot saved');
      }),
    ];
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); b?.remove(); },
};
