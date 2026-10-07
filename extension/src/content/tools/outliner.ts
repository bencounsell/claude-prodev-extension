import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { bar, el, isOwn, overlay } from '../ui';
import { runtime } from '../runtime';

let styleEl: HTMLStyleElement | null = null;
let off: (() => void)[] = [];
let tip: HTMLElement | null = null;
let b: HTMLElement | null = null;

const COLORS: Record<string, string> = { div: '#6d5efc', section: '#a855f7', header: '#ec4899', footer: '#ec4899', nav: '#f59e0b', main: '#10b981', a: '#3b82f6', img: '#ef4444', p: '#14b8a6', span: '#84cc16', button: '#f97316', ul: '#06b6d4', li: '#06b6d4', form: '#8b5cf6', input: '#f43f5e' };

export const outliner: Tool = {
  id: 'outliner',
  activate() {
    styleEl = document.createElement('style');
    styleEl.textContent = '*{outline:1px solid #6d5efc66!important}' +
      Object.entries(COLORS).map(([t, c]) => `${t}{outline-color:${c}aa!important}`).join('');
    document.head.append(styleEl);
    tip = el('div', 'pd-tip');
    tip.style.display = 'none';
    overlay().append(tip);
    b = bar('Page Outliner', [{ label: 'Done', primary: true, onClick: () => runtime.deactivate() }]);
    off = [listen('mousemove', (e) => {
      if (isOwn(e)) return;
      const t = target(e);
      if (!t) return;
      const r = t.getBoundingClientRect();
      tip!.style.display = 'block';
      tip!.textContent = `${t.tagName.toLowerCase()}${t.id ? '#' + t.id : ''}${[...t.classList].slice(0, 2).map((c) => '.' + c).join('')} · ${Math.round(r.width)}×${Math.round(r.height)}`;
      Object.assign(tip!.style, { left: `${Math.min(e.clientX + 12, innerWidth - 220)}px`, top: `${e.clientY + 14}px` });
    })];
  },
  deactivate() { off.forEach((f) => f()); off = []; styleEl?.remove(); tip?.remove(); b?.remove(); },
};
