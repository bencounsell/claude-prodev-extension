import type { Tool } from '../tool';
import { cssPath, listen, rgbToHex, target } from '../tool';
import { bar, copy, el, esc, highlightBox, isOwn, panel, toast } from '../ui';
import { runtime } from '../runtime';

const PROPS = ['display', 'position', 'width', 'height', 'margin', 'padding', 'font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'border', 'border-radius', 'opacity'];

let off: (() => void)[] = [];
let ui: { b: HTMLElement; p: ReturnType<typeof panel>; box: ReturnType<typeof highlightBox>; mar: ReturnType<typeof highlightBox>; pad: ReturnType<typeof highlightBox> } | null = null;
let locked: Element | null = null;

const px = (v: string) => parseFloat(v) || 0;

function show(node: Element) {
  if (!ui) return;
  const r = node.getBoundingClientRect();
  const cs = getComputedStyle(node);
  ui.box.set(r);
  ui.mar.set({ left: r.left - px(cs.marginLeft), top: r.top - px(cs.marginTop), width: r.width + px(cs.marginLeft) + px(cs.marginRight), height: r.height + px(cs.marginTop) + px(cs.marginBottom) });
  ui.pad.set({ left: r.left + px(cs.borderLeftWidth), top: r.top + px(cs.borderTopWidth), width: r.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth), height: r.height - px(cs.borderTopWidth) - px(cs.borderBottomWidth) });

  const rows = PROPS.map((p) => {
    const v = cs.getPropertyValue(p);
    const hex = p.includes('color') ? rgbToHex(v) : null;
    const sw = hex ? `<i class="pd-swatch" style="background:${hex}"></i>` : '';
    return `<div class="pd-row"><span>${p}</span><span data-prop="${p}">${sw}${esc(v)}</span></div>`;
  }).join('');
  ui.p.body.innerHTML = `<div class="pd-row"><span>selector</span><span>${esc(cssPath(node))}</span></div>
    <div class="pd-row"><span>size</span><span>${Math.round(r.width)} × ${Math.round(r.height)}</span></div>${rows}
    <div style="margin-top:10px;display:flex;gap:6px"><button class="pd-btn" id="cp">Copy CSS</button>
    <button class="pd-btn primary" id="ed">Edit styles${runtime.pro ? '' : ' (Pro)'}</button></div>`;
  (ui.p.body.querySelector('#cp') as HTMLElement).onclick = () => {
    copy(`${cssPath(node)} {\n${PROPS.map((p) => `  ${p}: ${cs.getPropertyValue(p)};`).join('\n')}\n}`, 'CSS copied');
  };
  (ui.p.body.querySelector('#ed') as HTMLElement).onclick = () => edit(node);
}

function edit(node: Element) {
  if (!runtime.requirePro('Live CSS editing')) return;
  const input = prompt('Enter CSS declarations to apply, e.g. color: red; padding: 8px', '');
  if (!input) return;
  (node as HTMLElement).style.cssText += `;${input}`;
  show(node);
  toast('Style applied (resets on reload)');
}

export const inspector: Tool = {
  id: 'inspector',
  activate() {
    locked = null;
    ui = {
      b: bar('CSS Inspector — click to lock an element', [{ label: 'Done', primary: true, onClick: () => runtime.deactivate() }]),
      p: panel('Element', () => runtime.deactivate()),
      mar: highlightBox('m'), pad: highlightBox('p'), box: highlightBox(),
    };
    ui.p.body.innerHTML = '<div style="color:#8d93a3">Hover an element to inspect it.</div>';
    off = [
      listen('mousemove', (e) => { if (!locked && !isOwn(e)) { const t = target(e); if (t) show(t); } }),
      listen('click', (e) => {
        if (isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e);
        if (!t) return;
        locked = locked === t ? null : t;
        if (locked) show(locked);
      }),
    ];
  },
  deactivate() {
    off.forEach((f) => f()); off = [];
    ui?.b.remove(); ui?.p.root.remove(); ui?.box.remove(); ui?.mar.remove(); ui?.pad.remove();
    ui = null; locked = null;
  },
};
void el;
