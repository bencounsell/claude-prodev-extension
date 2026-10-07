import type { Tool } from '../tool';
import { listen } from '../tool';
import { el, highlightBox, isOwn, overlay } from '../ui';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;
let label: HTMLElement | null = null;

export const ruler: Tool = {
  id: 'ruler',
  activate() {
    hl = highlightBox();
    label = el('div', 'pd-tip');
    overlay().append(label);
    let start: { x: number; y: number } | null = null;
    document.documentElement.style.cursor = 'crosshair';
    off = [
      listen('mousedown', (e) => { if (isOwn(e)) return; e.preventDefault(); e.stopPropagation(); start = { x: e.clientX, y: e.clientY }; }),
      listen('mousemove', (e) => {
        if (!start) return;
        const r = { left: Math.min(start.x, e.clientX), top: Math.min(start.y, e.clientY), width: Math.abs(e.clientX - start.x), height: Math.abs(e.clientY - start.y) };
        hl!.set(r);
        label!.textContent = `${Math.round(r.width)} × ${Math.round(r.height)} px`;
        Object.assign(label!.style, { left: `${r.left + r.width + 8}px`, top: `${r.top + r.height + 8}px` });
      }),
      listen('mouseup', () => { start = null; }),
    ];
  },
  deactivate() {
    off.forEach((f) => f()); off = [];
    document.documentElement.style.cursor = '';
    hl?.remove(); label?.remove();
  },
};
