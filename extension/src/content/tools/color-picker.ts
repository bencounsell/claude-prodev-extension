import type { Tool } from '../tool';
import { copy, toast } from '../ui';
import { runtime } from '../runtime';

const hsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return `hsl(${Math.round((h * 60 + 360) % 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
};

export const colorPicker: Tool = {
  id: 'color-picker',
  async activate() {
    const ED = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!ED) { toast('EyeDropper API is not supported in this browser'); runtime.deactivate(); return; }
    try {
      const { sRGBHex } = await new ED().open();
      const n = parseInt(sRGBHex.slice(1), 16);
      const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
      await copy(sRGBHex.toUpperCase(), `${sRGBHex.toUpperCase()} copied · rgb(${r}, ${g}, ${b}) · ${hsl(r, g, b)}`);
      runtime.pushColor(sRGBHex);
    } catch { /* user cancelled */ }
    runtime.deactivate();
  },
  deactivate() {},
};
