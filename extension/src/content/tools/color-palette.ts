import type { Tool } from '../tool';
import { rgbToHex } from '../tool';
import { copy, panel } from '../ui';
import { runtime } from '../runtime';

let p: ReturnType<typeof panel> | null = null;

export const colorPalette: Tool = {
  id: 'color-palette',
  activate() {
    const counts = new Map<string, number>();
    for (const n of document.querySelectorAll('body, body *')) {
      const cs = getComputedStyle(n);
      for (const prop of ['color', 'backgroundColor', 'borderTopColor'] as const) {
        const hex = rgbToHex(cs[prop]);
        if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    p = panel(`Color palette (${sorted.length})`, () => runtime.deactivate());
    p.body.innerHTML = `<div class="pd-dim" style="margin:0 0 10px">Sorted by usage · click a swatch to copy</div>
      <div class="pd-grid">${sorted.slice(0, 48).map(([c, n]) =>
      `<div class="pd-sw" data-c="${c}" title="${c} · ${n} uses" style="background:${c}"><span>${c}</span></div>`).join('')}</div>
      <div class="pd-actions"><button class="pd-btn primary" id="all">Copy as CSS variables</button><button class="pd-btn" id="tw">Copy as Tailwind</button></div>`;
    p.body.querySelectorAll<HTMLElement>('[data-c]').forEach((d) => (d.onclick = () => copy(d.dataset.c!, `${d.dataset.c} copied`)));
    (p.body.querySelector('#all') as HTMLElement).onclick = () =>
      copy(`:root {\n${sorted.slice(0, 24).map(([c], i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}`, 'CSS variables copied');
    (p.body.querySelector('#tw') as HTMLElement).onclick = () =>
      copy(`colors: {\n${sorted.slice(0, 24).map(([c], i) => `  'brand-${i + 1}': '${c}',`).join('\n')}\n}`, 'Tailwind colors copied');
  },
  deactivate() { p?.root.remove(); },
};
