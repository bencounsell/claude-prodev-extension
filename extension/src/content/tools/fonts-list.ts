import type { Tool } from '../tool';
import { esc, panel } from '../ui';
import { runtime } from '../runtime';

let p: ReturnType<typeof panel> | null = null;

export const fontsList: Tool = {
  id: 'fonts-list',
  activate() {
    const map = new Map<string, { count: number; weights: Set<string>; sizes: Set<string> }>();
    for (const n of document.body.querySelectorAll('*')) {
      if (!n.childNodes.length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent?.trim())) continue;
      const cs = getComputedStyle(n);
      const fam = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '');
      const e = map.get(fam) ?? { count: 0, weights: new Set(), sizes: new Set() };
      e.count++; e.weights.add(cs.fontWeight); e.sizes.add(cs.fontSize);
      map.set(fam, e);
    }
    p = panel(`Fonts on this page (${map.size})`, () => runtime.deactivate());
    p.body.innerHTML = [...map.entries()].sort((a, b) => b[1].count - a[1].count).map(([f, v]) => `
      <div style="padding:10px 0;border-bottom:1px solid #20242c">
        <div style="font-family:'${esc(f)}',sans-serif;font-size:18px;color:#fff">${esc(f)}</div>
        <div style="color:#8d93a3;margin-top:4px">${v.count} elements · weights ${[...v.weights].sort().join(', ')}<br>sizes ${[...v.sizes].sort((a, b) => parseFloat(a) - parseFloat(b)).join(', ')}</div>
      </div>`).join('') || 'No text found.';
  },
  deactivate() { p?.root.remove(); },
};
