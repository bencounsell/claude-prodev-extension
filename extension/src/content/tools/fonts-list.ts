import type { Tool } from '../tool';
import { runtime } from '../runtime';

export const fontsList: Tool = {
  id: 'fonts-list',
  activate() {
    const map = new Map<string, { count: number; weights: Set<string>; sizes: Set<string> }>();
    for (const n of document.body.querySelectorAll('*')) {
      if (![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent?.trim())) continue;
      const cs = getComputedStyle(n);
      const fam = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '');
      const e = map.get(fam) ?? { count: 0, weights: new Set(), sizes: new Set() };
      e.count++; e.weights.add(cs.fontWeight); e.sizes.add(cs.fontSize);
      map.set(fam, e);
    }
    runtime.publish({
      fonts: [...map.entries()].sort((a, b) => b[1].count - a[1].count).map(([family, v]) => ({
        family, count: v.count,
        weights: [...v.weights].sort(),
        sizes: [...v.sizes].sort((a, b) => parseFloat(a) - parseFloat(b)),
      })),
    });
  },
  deactivate() {},
};
