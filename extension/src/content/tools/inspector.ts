import type { Tool } from '../tool';
import { cssPath, listen, rgbToHex, target } from '../tool';
import { el, highlightBox, isOwn, overlay, toast } from '../ui';
import { runtime } from '../runtime';
import type { InspectorData } from '../../views/types';

const SECTIONS: [string, string[]][] = [
  ['Typography', ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'text-align']],
  ['Layout', ['display', 'position', 'width', 'height', 'margin', 'padding', 'gap']],
  ['Appearance', ['background-color', 'border', 'border-radius', 'box-shadow', 'opacity']],
];
const ALL = SECTIONS.flatMap(([, p]) => p);

let off: (() => void)[] = [];
let boxes: ReturnType<typeof highlightBox>[] = [];
let tip: HTMLElement | null = null;
let current: Element | null = null;
let locked = false;
let frame = 0;
/** Original inline style of every element edited this session, for Reset. */
const edited = new Map<HTMLElement, string>();

const px = (v: string) => parseFloat(v) || 0;
const n = (v: string) => { const x = Math.round(px(v)); return x === 0 ? '–' : String(x); };
const tidy = (v: string) => v.replace(/(\d+\.\d{2,})px/g, (_, x) => `${+(+x).toFixed(1)}px`);
const label = (e: Element) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${[...e.classList].slice(0, 2).map((c) => '.' + c).join('')}`;

function overlays(node: Element) {
  const [mar, pad, box] = boxes;
  if (!box || !tip) return;
  const r = node.getBoundingClientRect();
  const cs = getComputedStyle(node);
  box.set(r);
  // Once locked, show just an outline so live edits stay clearly visible.
  box.node.classList.toggle('lk', locked);
  if (locked) { mar.hide(); pad.hide(); return showTip(node, r); }
  mar.set({ left: r.left - px(cs.marginLeft), top: r.top - px(cs.marginTop), width: r.width + px(cs.marginLeft) + px(cs.marginRight), height: r.height + px(cs.marginTop) + px(cs.marginBottom) });
  pad.set({ left: r.left + px(cs.borderLeftWidth), top: r.top + px(cs.borderTopWidth), width: r.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth), height: r.height - px(cs.borderTopWidth) - px(cs.borderBottomWidth) });
  showTip(node, r);
}

function showTip(node: Element, r: DOMRect) {
  if (!tip) return;
  tip.style.display = 'block';
  tip.textContent = `${label(node)}  ${Math.round(r.width)} × ${Math.round(r.height)}`;
  Object.assign(tip.style, { left: `${Math.max(4, Math.min(r.left, innerWidth - tip.offsetWidth - 4))}px`, top: `${r.top > 30 ? r.top - 28 : r.bottom + 6}px` });
}

function snapshot(node: Element): InspectorData {
  const r = node.getBoundingClientRect();
  const cs = getComputedStyle(node);
  const side = (p: string, s = '') => ['top', 'right', 'bottom', 'left'].map((d) => n(cs.getPropertyValue(`${p}-${d}${s}`)));
  return {
    label: label(node), path: cssPath(node), w: Math.round(r.width), h: Math.round(r.height), locked,
    edited: edited.size > 0,
    box: { margin: side('margin'), border: side('border', '-width'), padding: side('padding') },
    sections: SECTIONS.map(([title, props]) => ({
      title,
      rows: props.map((prop) => {
        const value = tidy(cs.getPropertyValue(prop));
        return { prop, value, hex: prop.includes('color') ? rgbToHex(value) : null };
      }),
    })),
    css: `${cssPath(node)} {\n${ALL.map((p) => `  ${p}: ${tidy(cs.getPropertyValue(p))};`).join('\n')}\n}`,
  };
}

function show(node: Element) {
  current = node;
  overlays(node);
  runtime.publish(snapshot(node));
}

export const inspector: Tool = {
  id: 'inspector',
  activate() {
    locked = false;
    current = null;
    boxes = [highlightBox('m'), highlightBox('p'), highlightBox()];
    tip = el('div', 'pd-tip');
    tip.style.display = 'none';
    overlay().append(tip);
    off = [
      listen('mousemove', (e) => {
        if (locked || isOwn(e)) return;
        const t = target(e);
        if (!t || t === current) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => show(t));
      }),
      listen('click', (e) => {
        if (isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e);
        if (!t) return;
        locked = !(locked && t === current);
        show(t);
      }),
      listen('scroll', () => current && overlays(current), { capture: true, passive: true }),
    ];
  },
  deactivate() {
    off.forEach((f) => f()); off = [];
    cancelAnimationFrame(frame);
    boxes.forEach((b) => b.remove()); boxes = [];
    tip?.remove(); tip = null; current = null;
  },
  onAction(action, payload) {
    if (!current) return;
    if (action === 'lock') locked = true;
    if (action === 'unlock') locked = false;
    if (action === 'set-style') {
      if (!runtime.requirePro('Live CSS editing')) return;
      const { prop, value } = payload as { prop: string; value: string };
      const h = current as HTMLElement;
      if (!edited.has(h)) edited.set(h, h.getAttribute('style') ?? '');
      h.style.setProperty(prop, value, 'important');
      locked = true;
    }
    if (action === 'reset') {
      edited.forEach((orig, node) => (orig ? node.setAttribute('style', orig) : node.removeAttribute('style')));
      edited.clear();
      toast('All edits reset');
    }
    show(current);
  },
};
