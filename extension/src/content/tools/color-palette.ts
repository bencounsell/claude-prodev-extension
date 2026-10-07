import type { Tool } from '../tool';
import { rgbToHex } from '../tool';
import { runtime } from '../runtime';

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
    runtime.publish({ colors: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex, count]) => ({ hex, count })) });
  },
  deactivate() {},
};
