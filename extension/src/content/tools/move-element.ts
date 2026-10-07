import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { highlightBox, isOwn } from '../ui';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;

export const moveElement: Tool = {
  id: 'move-element',
  activate() {
    hl = highlightBox();
    let drag: { n: HTMLElement; x: number; y: number; ox: number; oy: number } | null = null;
    off = [
      listen('mousemove', (e) => {
        if (drag) {
          const dx = e.clientX - drag.x + drag.ox, dy = e.clientY - drag.y + drag.oy;
          drag.n.style.transform = `translate(${dx}px, ${dy}px)`;
          hl!.set(drag.n.getBoundingClientRect());
        } else if (!isOwn(e)) { const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }
      }),
      listen('mousedown', (e) => {
        if (isOwn(e)) return;
        const t = target(e) as HTMLElement | null;
        if (!t) return;
        e.preventDefault(); e.stopPropagation();
        const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(t.style.transform);
        drag = { n: t, x: e.clientX, y: e.clientY, ox: m ? +m[1] : 0, oy: m ? +m[2] : 0 };
      }),
      listen('mouseup', () => { drag = null; }),
      listen('click', (e) => { if (!isOwn(e)) { e.preventDefault(); e.stopPropagation(); } }),
    ];
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); },
};
