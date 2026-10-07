import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { bar, copy, highlightBox, isOwn } from '../ui';
import { runtime } from '../runtime';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;
let b: HTMLElement | null = null;

function inline(src: Element): Element {
  const clone = src.cloneNode(true) as Element;
  const a = [src, ...src.querySelectorAll('*')];
  const c = [clone, ...clone.querySelectorAll('*')];
  a.forEach((n, i) => {
    const cs = getComputedStyle(n);
    let css = '';
    for (const p of cs) css += `${p}:${cs.getPropertyValue(p)};`;
    c[i].setAttribute('style', css);
  });
  clone.querySelectorAll('script').forEach((s) => s.remove());
  return clone;
}

export const exportElement: Tool = {
  id: 'export-element',
  activate() {
    hl = highlightBox();
    b = bar('Export Element — click to copy as HTML + CSS', [{ label: 'Done', primary: true, onClick: () => runtime.deactivate() }]);
    off = [
      listen('mousemove', (e) => { if (isOwn(e)) return; const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }),
      listen('click', (e) => {
        if (isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e);
        if (t) copy(inline(t).outerHTML, 'Element copied as standalone HTML');
      }),
    ];
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); b?.remove(); },
};
