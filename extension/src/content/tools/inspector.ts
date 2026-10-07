import type { Tool } from '../tool';
import { cssPath, listen, rgbToHex, target } from '../tool';
import { bar, copy, el, esc, highlightBox, icon, ICONS, isOwn, overlay, panel, toast } from '../ui';
import { runtime } from '../runtime';

const SECTIONS: [string, string[]][] = [
  ['Typography', ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'text-align']],
  ['Layout', ['display', 'position', 'width', 'height', 'margin', 'padding', 'gap']],
  ['Appearance', ['background-color', 'border', 'border-radius', 'box-shadow', 'opacity']],
];
const ALL = SECTIONS.flatMap(([, p]) => p);

type Ui = {
  b: HTMLElement; p: ReturnType<typeof panel>; tip: HTMLElement;
  box: ReturnType<typeof highlightBox>; mar: ReturnType<typeof highlightBox>; pad: ReturnType<typeof highlightBox>;
};
let off: (() => void)[] = [];
let ui: Ui | null = null;
let current: Element | null = null;
let locked = false;
/** Original inline style of every element edited this session, for Reset. */
const edited = new Map<HTMLElement, string>();

const px = (v: string) => parseFloat(v) || 0;
const n = (v: string) => { const x = Math.round(px(v)); return x === 0 ? '–' : String(x); };
const label = (e: Element) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${[...e.classList].slice(0, 2).map((c) => '.' + c).join('')}`;

function overlays(node: Element) {
  if (!ui) return;
  const r = node.getBoundingClientRect();
  const cs = getComputedStyle(node);
  ui.box.set(r);
  ui.mar.set({ left: r.left - px(cs.marginLeft), top: r.top - px(cs.marginTop), width: r.width + px(cs.marginLeft) + px(cs.marginRight), height: r.height + px(cs.marginTop) + px(cs.marginBottom) });
  ui.pad.set({ left: r.left + px(cs.borderLeftWidth), top: r.top + px(cs.borderTopWidth), width: r.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth), height: r.height - px(cs.borderTopWidth) - px(cs.borderBottomWidth) });
  ui.tip.style.display = 'block';
  ui.tip.textContent = `${label(node)}  ${Math.round(r.width)} × ${Math.round(r.height)}`;
  const top = r.top > 30 ? r.top - 28 : r.bottom + 6;
  Object.assign(ui.tip.style, { left: `${Math.max(4, Math.min(r.left, innerWidth - ui.tip.offsetWidth - 4))}px`, top: `${top}px` });
}

function boxModel(cs: CSSStyleDeclaration, r: DOMRect) {
  const side = (p: string, s = '') => ['Top', 'Right', 'Bottom', 'Left'].map((d) => n(cs.getPropertyValue(`${p}-${d.toLowerCase()}${s}`)));
  const [mt, mr, mb, ml] = side('margin'), [bt, br, bb, bl] = side('border', '-width'), [pt, pr, pb, pl] = side('padding');
  const v = (t: string, rt: string, b: string, l: string) =>
    `<span class="v t">${t}</span><span class="v rt">${rt}</span><span class="v bt">${b}</span><span class="v lf">${l}</span>`;
  return `<div class="pd-bm"><div class="l m"><em>margin</em>${v(mt, mr, mb, ml)}
    <div class="l b"><em>border</em>${v(bt, br, bb, bl)}<div class="l p"><em>padding</em>${v(pt, pr, pb, pl)}
    <div class="c">${Math.round(r.width)} × ${Math.round(r.height)}</div></div></div></div></div>`;
}

function render(node: Element) {
  if (!ui) return;
  current = node;
  const r = node.getBoundingClientRect();
  const cs = getComputedStyle(node);
  const editable = runtime.pro;
  const val = (p: string) => {
    const v = cs.getPropertyValue(p).replace(/(\d+\.\d{2,})px/g, (_, x) => `${+(+x).toFixed(1)}px`);
    const hex = p.includes('color') ? rgbToHex(v) : null;
    const sw = hex ? `<i class="pd-swatch" data-hex="${hex}" style="background:${hex}" title="Copy ${hex}"></i>` : '';
    const shown = hex ?? v;
    return `<div class="pd-row"><span>${p}</span><span>${sw}<span class="pd-val ${editable ? 'edit' : 'locked'}" data-p="${p}" ${editable ? 'contenteditable="plaintext-only" spellcheck="false"' : ''} title="${editable ? 'Click to edit · Enter to apply' : 'Live editing is a Pro feature'}">${esc(shown)}</span></span></div>`;
  };
  ui.p.header.querySelector('.t span')!.innerHTML = `Inspector ${locked ? '<span class="pd-pill ok">LOCKED</span>' : ''}`;
  ui.p.body.innerHTML = `<div><span class="pd-chip" title="${esc(cssPath(node))}">${esc(label(node))}</span><span class="pd-dim">${Math.round(r.width)} × ${Math.round(r.height)}</span></div>
    ${boxModel(cs, r)}
    ${SECTIONS.map(([h, props]) => `<div class="pd-sec"><h4>${h}</h4>${props.map(val).join('')}</div>`).join('')}
    <div class="pd-actions">
      <button class="pd-btn primary sm" data-a="copy">${icon(ICONS.copy, 13)} Copy CSS</button>
      <button class="pd-btn sm" data-a="sel">Copy selector</button>
      ${edited.size ? `<button class="pd-btn sm" data-a="reset">${icon(ICONS.refresh, 13)} Reset edits</button>` : ''}
      ${editable ? '' : '<span class="pd-pill pro" style="align-self:center">EDIT WITH PRO</span>'}
    </div>`;
  overlays(node);
}

function wire(p: ReturnType<typeof panel>) {
  p.body.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const sw = t.closest<HTMLElement>('[data-hex]');
    if (sw) return void copy(sw.dataset.hex!, `${sw.dataset.hex} copied`);
    if (t.closest('.pd-val.locked')) return void runtime.requirePro('Live CSS editing');
    const a = t.closest<HTMLElement>('[data-a]')?.dataset.a;
    if (!current) return;
    if (a === 'copy') {
      const cs = getComputedStyle(current);
      copy(`${cssPath(current)} {\n${ALL.map((x) => `  ${x}: ${cs.getPropertyValue(x)};`).join('\n')}\n}`, 'CSS copied');
    } else if (a === 'sel') copy(cssPath(current), 'Selector copied');
    else if (a === 'reset') {
      edited.forEach((orig, node) => node.setAttribute('style', orig));
      edited.clear();
      render(current);
      toast('All edits reset');
    }
  });
  p.body.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (!t.matches('.pd-val.edit') || !current) return;
    if (e.key === 'Escape') { e.preventDefault(); render(current); t.blur(); }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const h = current as HTMLElement;
    if (!edited.has(h)) edited.set(h, h.getAttribute('style') ?? '');
    h.style.setProperty(t.dataset.p!, t.textContent!.trim(), 'important');
    const prop = t.dataset.p;
    render(current);
    // Keep focus on the edited field so users can keep tweaking with the keyboard.
    p.body.querySelector<HTMLElement>(`[data-p="${prop}"]`)?.focus();
  });
  // Pause hover tracking while the user is working in the panel.
  p.root.addEventListener('focusin', () => { locked = true; });
}

export const inspector: Tool = {
  id: 'inspector',
  activate() {
    locked = false;
    current = null;
    const p = panel('Inspector', () => runtime.deactivate());
    const tip = el('div', 'pd-tip');
    tip.style.display = 'none';
    ui = {
      b: bar('CSS Inspector — Hover to inspect · click to lock', [{ label: 'Done', primary: true, onClick: () => runtime.deactivate() }]),
      p, tip,
      mar: highlightBox('m'), pad: highlightBox('p'), box: highlightBox(),
    };
    overlay().append(tip);
    p.body.innerHTML = `<div class="pd-empty">${icon(ICONS.cursor, 28)}<div>Hover any element to inspect it.<br>Click to lock the selection.</div></div>`;
    wire(p);
    off = [
      listen('mousemove', (e) => { if (!locked && !isOwn(e)) { const t = target(e); if (t && t !== current) render(t); } }),
      listen('click', (e) => {
        if (isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e);
        if (!t) return;
        locked = !(locked && t === current);
        render(t);
      }),
      listen('scroll', () => current && overlays(current), { capture: true, passive: true }),
    ];
  },
  deactivate() {
    off.forEach((f) => f()); off = [];
    if (ui) { ui.b.remove(); ui.p.root.remove(); ui.box.remove(); ui.mar.remove(); ui.pad.remove(); ui.tip.remove(); }
    ui = null; current = null;
  },
};
