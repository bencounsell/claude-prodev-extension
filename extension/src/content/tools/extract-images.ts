import type { Tool } from '../tool';
import { copy, esc, panel } from '../ui';
import { runtime } from '../runtime';
import { sendToBackground } from '../../lib/messaging';

let p: ReturnType<typeof panel> | null = null;

function collect(): string[] {
  const urls = new Set<string>();
  document.querySelectorAll('img').forEach((i) => (i.currentSrc || i.src) && urls.add(i.currentSrc || i.src));
  document.querySelectorAll('source[srcset]').forEach((s) => (s as HTMLSourceElement).srcset.split(',').forEach((x) => { const u = x.trim().split(' ')[0]; if (u) urls.add(new URL(u, location.href).href); }));
  document.querySelectorAll('*').forEach((n) => {
    const m = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(n).backgroundImage);
    if (m && !m[1].startsWith('data:image/svg')) urls.add(new URL(m[1], location.href).href);
  });
  return [...urls];
}

export const extractImages: Tool = {
  id: 'extract-images',
  activate() {
    const imgs = collect();
    p = panel(`Images (${imgs.length})`, () => runtime.deactivate());
    p.body.innerHTML = `<div style="display:flex;gap:6px;margin-bottom:10px"><button class="pd-btn primary" id="all">Download all</button><button class="pd-btn" id="urls">Copy URLs</button></div>
      <div class="pd-grid" style="grid-template-columns:repeat(3,1fr)">${imgs.map((u) =>
        `<div data-u="${esc(u)}" title="Click to download" style="height:70px;border-radius:8px;background:#0003 center/contain no-repeat url('${esc(u)}');border:1px solid #fff2"></div>`).join('')}</div>`;
    const dl = (u: string) => sendToBackground({ type: 'download', url: u, filename: `prodev/${u.split('/').pop()?.split('?')[0] || 'image'}` });
    p.body.querySelectorAll<HTMLElement>('[data-u]').forEach((d) => (d.onclick = () => dl(d.dataset.u!)));
    (p.body.querySelector('#all') as HTMLElement).onclick = () => imgs.forEach(dl);
    (p.body.querySelector('#urls') as HTMLElement).onclick = () => copy(imgs.join('\n'), 'Image URLs copied');
  },
  deactivate() { p?.root.remove(); },
};
