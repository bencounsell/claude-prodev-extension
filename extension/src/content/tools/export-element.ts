import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { copy, highlightBox, isOwn } from '../ui';
import { runtime } from '../runtime';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;

/** Clone with every computed style inlined, so it renders the same anywhere. */
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
    runtime.publish({ html: null, label: null });
    off = [
      listen('mousemove', (e) => { if (isOwn(e)) return; const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }),
      listen('click', (e) => {
        if (isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e);
        if (!t) return;
        const html = inline(t).outerHTML;
        void copy(html, 'Element copied as standalone HTML');
        runtime.publish({ html, label: `${t.tagName.toLowerCase()}${t.id ? '#' + t.id : ''}${[...t.classList].slice(0, 2).map((c) => '.' + c).join('')}` });
      }),
    ];
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); },
};
