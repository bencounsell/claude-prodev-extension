import { TOOLS, toolById } from '../lib/tools';
import { sendToBackground } from '../lib/messaging';
import viewsCss from '../views/views.css';

/* ------------------------------------------------------------------ *
 * ProDev in-page design system. Everything renders inside a Shadow DOM
 * so host-page CSS can never leak in (or ours out).
 * ------------------------------------------------------------------ */
const CSS = `
:host{all:initial;
 --glass:rgba(16,18,25,.9);--solid:#101219;
 --text:#f2f4fa;--muted:#a1a8bb;--faint:#727a90;--surface:rgba(255,255,255,.04);--surface-2:rgba(255,255,255,.06);--surface-3:rgba(255,255,255,.1);
 --border:rgba(255,255,255,.09);--accent:#9d90ff;--accent-soft:rgba(124,108,255,.2);--grad:linear-gradient(135deg,#7c6cff,#a78bfa);
 --ok:#34d399;--err:#f87171}
/* The host carries an inline all:initial (beats :host), so base type lives on top-level children. */
:host>*{font:13px/1.45 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",system-ui,sans-serif;color:var(--text);
 -webkit-font-smoothing:antialiased;letter-spacing:normal;text-align:left}
*{box-sizing:border-box;margin:0}
:host>* *{font:inherit;color:inherit}
svg{display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
button{cursor:pointer;border:0;background:none;padding:0}
kbd{font-size:10.5px;padding:1px 5px;border-radius:5px;background:var(--surface-3);border:1px solid var(--border);color:var(--muted)}
@keyframes pd-in{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}
@keyframes pd-up{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
@keyframes pd-fade{from{opacity:0}to{opacity:1}}
.glass{background:var(--glass);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5);
 border:1px solid var(--border);box-shadow:0 18px 50px rgba(0,0,0,.42),0 2px 8px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.06)}

/* on-page pill */
.pd-bar{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:6px 6px 6px 7px;
 border-radius:14px;z-index:5;animation:pd-up .28s cubic-bezier(.2,.9,.3,1.2) both;user-select:none;max-width:calc(100vw - 24px)}
.pd-bar.moved{transform:none}
.pd-grip{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;cursor:grab;flex:none;background:var(--grad);box-shadow:0 4px 14px rgba(124,108,255,.45)}
.pd-grip svg{width:16px;height:16px;stroke:#fff}
.pd-bar.dragging .pd-grip{cursor:grabbing}
.pd-tt{display:flex;flex-direction:column;min-width:0;padding-right:8px}
.pd-tt b{font-weight:650;font-size:12.5px;white-space:nowrap}
.pd-tt span{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pd-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:10px;font-size:12px;font-weight:600;
 background:var(--surface-2);border:1px solid var(--border);transition:background .15s,transform .1s}
.pd-btn:hover{background:var(--surface-3)}.pd-btn:active{transform:scale(.97)}
.pd-btn:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.pd-btn.primary{background:var(--grad);border-color:transparent;color:#fff}
.pd-btn.icon{padding:6px;border-radius:9px}.pd-btn.icon svg{width:14px;height:14px}

/* floating panel shell (contents are the shared Preact views) */
.pd-panel{position:fixed;top:16px;right:16px;width:360px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;border-radius:18px;
 z-index:4;animation:pd-in .3s cubic-bezier(.2,.9,.3,1.1) both;overflow:hidden}
.pd-panel>header{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;border-bottom:1px solid var(--border);cursor:grab;user-select:none}
.pd-panel>header .t{font-weight:650;font-size:13px;flex:1;display:flex;align-items:center;gap:8px;min-width:0}
.pd-panel>header .t svg{width:16px;height:16px;stroke:var(--accent);flex:none}
.pd-panel .body{padding:14px 14px 16px;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--surface-3) transparent}

/* highlight + labels */
.pd-hl{position:fixed;pointer-events:none;border:1.5px solid #7c6cff;background:rgba(124,108,255,.13);z-index:3;border-radius:2px;
 box-shadow:0 0 0 1px rgba(255,255,255,.35);transition:left .07s,top .07s,width .07s,height .07s}
.pd-hl.m{border:0;background:rgba(251,146,60,.28);box-shadow:none}.pd-hl.p{border:0;background:rgba(52,211,153,.3);box-shadow:none}
.pd-tip{position:fixed;background:var(--solid);color:var(--text);font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;padding:4px 8px;border-radius:7px;
 pointer-events:none;z-index:4;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.35);border:1px solid var(--border)}

/* toast */
.pd-toast{position:fixed;left:50%;bottom:78px;transform:translate(-50%,24px);display:flex;align-items:center;gap:9px;padding:10px 16px 10px 12px;border-radius:14px;
 font-size:13px;font-weight:550;opacity:0;transition:opacity .25s,transform .3s cubic-bezier(.2,.9,.3,1.2);z-index:6;pointer-events:none;max-width:min(560px,90vw)}
.pd-toast.show{opacity:1;transform:translate(-50%,0)}
.pd-toast i{width:20px;height:20px;border-radius:99px;background:rgba(52,211,153,.2);display:grid;place-items:center;flex:none}
.pd-toast i svg{width:12px;height:12px;stroke:var(--ok);stroke-width:2.6}

/* modal (upsell + palette) */
.pd-back{position:fixed;inset:0;background:rgba(6,8,12,.5);backdrop-filter:blur(4px);z-index:8;display:grid;animation:pd-fade .18s both}
.pd-up{margin:auto;width:380px;max-width:92vw;padding:28px 26px 22px;border-radius:22px;text-align:center;animation:pd-in .3s cubic-bezier(.2,.9,.3,1.1) both}
.pd-up .lock{width:54px;height:54px;border-radius:18px;margin:0 auto 14px;display:grid;place-items:center;background:var(--grad);box-shadow:0 10px 30px rgba(124,108,255,.5)}
.pd-up .lock svg{width:26px;height:26px;stroke:#fff}
.pd-up h2{font-size:18px;font-weight:700;letter-spacing:-.01em}.pd-up p{color:var(--muted);margin:8px 0 18px;font-size:13px;line-height:1.5}
.pd-up .row2{display:flex;gap:8px;justify-content:center}.pd-up .pd-btn{padding:9px 16px;font-size:13px}
.pd-up ul{list-style:none;text-align:left;margin:0 0 18px;display:grid;gap:7px;padding:12px 14px;background:var(--surface-2);border-radius:12px;font-size:12.5px}
.pd-up li{display:flex;gap:8px;align-items:center}.pd-up li svg{width:14px;height:14px;stroke:var(--ok);stroke-width:2.4;flex:none}
.pd-pal{margin:16vh auto auto;width:580px;max-width:92vw;border-radius:20px;overflow:hidden;animation:pd-in .26s cubic-bezier(.2,.9,.3,1.1) both;height:fit-content}
.pd-pal .q{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)}
.pd-pal .q svg{width:18px;height:18px;stroke:var(--muted);flex:none}
.pd-pal input{flex:1;background:none;border:0;outline:0;font-size:15px;color:var(--text)}.pd-pal input::placeholder{color:var(--muted)}
.pd-pal .list{max-height:min(380px,50vh);overflow:auto;padding:6px}
.pd-pal .it{display:flex;align-items:center;gap:12px;width:100%;padding:9px 10px;border-radius:12px;text-align:left}
.pd-pal .it.sel{background:var(--surface-3)}
.pd-pal .ic{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--accent-soft);flex:none}
.pd-pal .ic svg{width:16px;height:16px;stroke:#cfc8ff}
.pd-pal .tx{flex:1;min-width:0}.pd-pal .tx b{display:block;font-weight:600}.pd-pal .tx span{display:block;color:var(--muted);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pd-pal footer{display:flex;gap:14px;padding:9px 16px;border-top:1px solid var(--border);color:var(--muted);font-size:11.5px}
.pd-pal .none{padding:26px;text-align:center;color:var(--muted)}
.pd-pill{font-size:10px;font-weight:700;letter-spacing:.05em;padding:2px 7px;border-radius:99px;background:var(--grad);color:#fff}
` + viewsCss;

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;
let activeToolId: string | null = null;

/** Called by the runtime so toolbars can show the active tool's icon + name. */
export const setActiveTool = (id: string | null) => { activeToolId = id; };

export function overlay(): ShadowRoot {
  if (root && host?.isConnected) return root;
  host = document.createElement('prodev-root');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  root.append(style);
  document.documentElement.append(host);
  return root;
}

/** True when the event originated inside ProDev's own UI. */
export const isOwn = (e: Event) => e.composedPath().some((n) => n === host);

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const icon = (path: string, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="${path}"/></svg>`;
export const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  cursor: 'M5 4l5 15 2.5-6.5L19 10z',
  refresh: 'M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  eyedropper: 'M14 4l6 6-9 9H5v-6zM12 6l6 6',
};

export const interactive = <T extends HTMLElement>(node: T): T => {
  node.style.pointerEvents = 'auto';
  return node;
};

/** Makes `node` draggable by `handle`; position persists for the page session. */
function draggable(node: HTMLElement, handle: HTMLElement, key: string) {
  const saved = positions[key];
  if (saved) place(node, saved.x, saved.y);
  handle.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button,select,input')) return;
    const r = node.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    node.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      const x = Math.min(Math.max(0, m.clientX - dx), innerWidth - 80), y = Math.min(Math.max(0, m.clientY - dy), innerHeight - 40);
      positions[key] = { x, y };
      place(node, x, y);
    };
    const up = () => { node.classList.remove('dragging'); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}
const positions: Record<string, { x: number; y: number }> = {};
function place(n: HTMLElement, x: number, y: number) {
  n.classList.add('moved');
  Object.assign(n.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', marginLeft: '0' });
}

/** Stop page key handlers (shortcuts, hotkeys) from hijacking typing inside our UI. */
const isolateKeys = (n: HTMLElement) => ['keydown', 'keyup', 'keypress'].forEach((t) => n.addEventListener(t, (e) => e.stopPropagation()));

let toastEl: HTMLElement | null = null;
let toastTimer: number | undefined;
export function toast(msg: string, ms = 2400) {
  const r = overlay();
  if (!toastEl?.isConnected) toastEl = r.appendChild(el('div', 'pd-toast glass'));
  toastEl.innerHTML = `<i>${icon(ICONS.check, 12)}</i><span>${esc(msg)}</span>`;
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('show'), ms);
}

export function bar(title: string, buttons: { label: string; primary?: boolean; onClick: () => void }[] = []) {
  const [t, hint] = title.split(' — ');
  const meta = activeToolId ? toolById(activeToolId) : undefined;
  const b = interactive(el('div', 'pd-bar glass'));
  b.innerHTML = `<span class="pd-grip" title="Drag to move">${icon(meta?.icon ?? ICONS.cursor, 16)}</span>
    <div class="pd-tt"><b>${esc(t)}</b>${hint ? `<span>${esc(hint)}</span>` : ''}</div>`;
  for (const btn of buttons) {
    const x = el('button', `pd-btn${btn.primary ? ' primary' : ''}`, esc(btn.label));
    if (btn.label === 'Done') x.innerHTML += ' <kbd>Esc</kbd>';
    x.onclick = btn.onClick;
    b.append(x);
  }
  overlay().append(b);
  draggable(b, b, 'bar');
  isolateKeys(b);
  return b;
}

export function panel(title: string, onClose: () => void) {
  const meta = activeToolId ? toolById(activeToolId) : undefined;
  const p = interactive(el('div', 'pd-panel glass'));
  const h = el('header', '', `<div class="t">${meta ? icon(meta.icon, 16) : ''}<span>${esc(title)}</span></div>`);
  const close = el('button', 'pd-btn icon', icon(ICONS.close, 14));
  close.setAttribute('aria-label', 'Close');
  close.onclick = onClose;
  h.append(close);
  const body = el('div', 'body');
  p.append(h, body);
  overlay().append(p);
  draggable(p, h, 'panel');
  isolateKeys(p);
  return { root: p, body, header: h };
}

export async function copy(text: string, ok = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast(ok);
}

export function highlightBox(cls = '') {
  const d = el('div', `pd-hl ${cls}`);
  d.style.display = 'none';
  overlay().append(d);
  return {
    node: d,
    set(r: { left: number; top: number; width: number; height: number }) {
      d.style.display = 'block';
      Object.assign(d.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    },
    hide() { d.style.display = 'none'; },
    remove() { d.remove(); },
  };
}

/** Modal that closes on Esc / backdrop click. Returns a close function. */
function modal(content: HTMLElement, onClose?: () => void) {
  const back = interactive(el('div', 'pd-back'));
  back.append(content);
  overlay().append(back);
  const close = () => { back.remove(); document.removeEventListener('keydown', key, true); onClose?.(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  isolateKeys(back);
  return { close, back };
}

/** Friendly Pro upsell shown instead of a hard redirect. */
export function upsell(feature: string) {
  const c = el('div', 'pd-up glass');
  c.innerHTML = `<div class="lock">${icon(ICONS.lock, 26)}</div><h2>${esc(feature)} is a Pro feature</h2>
    <p>Unlock every tool with a one-time purchase. No subscription, free updates.</p>
    <ul>${['All 14 tools, including full-page capture', 'Live CSS editing, export, palette & more', 'One payment, use on all your browsers'].map((s) => `<li>${icon(ICONS.check, 14)}${s}</li>`).join('')}</ul>
    <div class="row2"><button class="pd-btn" data-a="later">Maybe later</button><button class="pd-btn primary" data-a="up">Unlock Pro</button></div>`;
  const m = modal(c);
  c.querySelector<HTMLElement>('[data-a=later]')!.onclick = m.close;
  c.querySelector<HTMLElement>('[data-a=up]')!.onclick = () => { void sendToBackground({ type: 'open-upgrade' }); m.close(); };
  c.querySelector<HTMLElement>('[data-a=up]')!.focus();
}

/** Command palette (Alt+Shift+K): fuzzy-search and launch any tool without leaving the page. */
export function palette(pro: boolean, run: (id: string) => void) {
  const c = el('div', 'pd-pal glass');
  c.innerHTML = `<div class="q">${icon(ICONS.search, 18)}<input placeholder="Search tools…" aria-label="Search tools" spellcheck="false"></div>
    <div class="list" role="listbox"></div>
    <footer><span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> run</span><span><kbd>Esc</kbd> close</span></footer>`;
  const input = c.querySelector('input')!;
  const list = c.querySelector<HTMLElement>('.list')!;
  let items = TOOLS, sel = 0;
  const draw = () => {
    list.innerHTML = items.length ? items.map((t, i) => `<button class="it${i === sel ? ' sel' : ''}" data-i="${i}" role="option">
      <span class="ic">${icon(t.icon, 16)}</span><span class="tx"><b>${esc(t.name)}</b><span>${esc(t.description)}</span></span>
      ${t.tier === 'pro' && !pro ? '<span class="pd-pill">PRO</span>' : ''}</button>`).join('') : '<div class="none">No tools match your search</div>';
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };
  const m = modal(c);
  const go = (i: number) => { const t = items[i]; if (!t) return; m.close(); run(t.id); };
  input.oninput = () => {
    const q = input.value.toLowerCase().trim();
    items = TOOLS.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q));
    sel = 0;
    draw();
  };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === 'Enter') go(sel);
  };
  list.onclick = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]'); if (b) go(+b.dataset.i!); };
  draw();
  input.focus();
}
