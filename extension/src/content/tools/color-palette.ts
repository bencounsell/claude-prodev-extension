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
    p.body.innerHTML = `<div class="pd-grid">${sorted.slice(0, 48).map(([c, n]) =>
      `<div data-c="${c}" title="${c} · ${n} uses" style="height:44px;border-radius:8px;background:${c};border:1px solid #fff2"></div>`).join('')}</div>
      <button class="pd-btn primary" id="all" style="margin-top:12px">Copy all as CSS variables</button>`;
    p.body.querySelectorAll<HTMLElement>('[data-c]').forEach((d) => (d.onclick = () => copy(d.dataset.c!, `${d.dataset.c} copied`)));
    (p.body.querySelector('#all') as HTMLElement).onclick = () =>
      copy(`:root {\n${sorted.slice(0, 24).map(([c], i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}`, 'CSS variables copied');
  },
  deactivate() { p?.root.remove(); },
};
