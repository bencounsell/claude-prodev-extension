import type { Tool } from '../tool';
import { bar, copy, esc, icon, ICONS, panel, toast } from '../ui';
import { runtime } from '../runtime';

type ED = new () => { open(): Promise<{ sRGBHex: string }> };

export function formats(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [v >> 16, (v >> 8) & 255, v & 255];
  const [rf, gf, bf] = [r / 255, g / 255, b / 255];
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === rf ? ((gf - bf) / d) % 6 : max === gf ? (bf - rf) / d + 2 : (rf - gf) / d + 4;
  return {
    HEX: hex.toUpperCase(),
    RGB: `rgb(${r}, ${g}, ${b})`,
    HSL: `hsl(${Math.round((h * 60 + 360) % 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
    light: 0.299 * r + 0.587 * g + 0.114 * b > 160,
  };
}

let b: HTMLElement | null = null;
let p: ReturnType<typeof panel> | null = null;

function draw() {
  if (!p) return;
  const cur = runtime.colors[0];
  const f = cur ? formats(cur) : null;
  p.body.innerHTML = `
    ${f ? `<div class="pd-big" style="background:${cur};color:${f.light ? '#111' : '#fff'}">${f.HEX}</div>
      ${(['HEX', 'RGB', 'HSL'] as const).map((k) => `<button class="pd-fmt" data-copy="${esc(f[k])}"><span>${esc(f[k])}</span><em>${k}</em></button>`).join('')}`
    : `<div class="pd-empty">${icon(ICONS.eyedropper, 28)}<div>Pick any pixel on screen —<br>even outside the page.</div></div>`}
    <div class="pd-actions"><button class="pd-btn primary" data-a="pick">${icon(ICONS.eyedropper, 14)} Pick a color</button></div>
    ${runtime.colors.length > 1 ? `<div class="pd-sec"><h4>History</h4><div class="pd-grid" style="grid-template-columns:repeat(8,1fr);gap:6px">
      ${runtime.colors.map((c) => `<div class="pd-sw" data-c="${c}" title="${c}" style="background:${c};border-radius:8px"></div>`).join('')}</div></div>` : ''}`;
}

async function pick() {
  const Dropper = (window as unknown as { EyeDropper?: ED }).EyeDropper;
  if (!Dropper) return toast('Your browser does not support the EyeDropper API');
  try {
    const { sRGBHex } = await new Dropper().open();
    runtime.pushColor(sRGBHex);
    draw();
    await copy(sRGBHex.toUpperCase(), `${sRGBHex.toUpperCase()} copied`);
  } catch { /* cancelled, or no user gesture yet: the panel's button provides one */ }
}

export const colorPicker: Tool = {
  id: 'color-picker',
  activate() {
    b = bar('Color Picker — Click “Pick a color”, then any pixel', [{ label: 'Done', primary: true, onClick: () => runtime.deactivate() }]);
    p = panel('Color Picker', () => runtime.deactivate());
    p.body.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-a=pick]')) return void pick();
      const c = t.closest<HTMLElement>('[data-copy]')?.dataset.copy;
      if (c) return void copy(c, `${c} copied`);
      const h = t.closest<HTMLElement>('[data-c]')?.dataset.c;
      if (h) { runtime.pushColor(h); draw(); void copy(h.toUpperCase(), `${h.toUpperCase()} copied`); }
    });
    draw();
    void pick(); // succeeds when launched via keyboard shortcut (user activation present)
  },
  deactivate() { b?.remove(); p?.root.remove(); b = p = null; },
};
