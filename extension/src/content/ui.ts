/** Shadow-DOM overlay host so page CSS never affects ProDev UI (and vice versa). */
const CSS = `
:host{all:initial}
*{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
.pd-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:#16181d;color:#fff;
 padding:10px 16px;border-radius:10px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.35);opacity:0;transition:.25s;z-index:5;pointer-events:none}
.pd-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.pd-bar{position:fixed;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:#16181d;color:#fff;
 padding:8px 10px 8px 14px;border-radius:12px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.35);z-index:5}
.pd-bar b{font-weight:600}
.pd-btn{border:0;background:#2a2e37;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer}
.pd-btn:hover{background:#3a3f4b}.pd-btn.primary{background:#6d5efc}.pd-btn.primary:hover{background:#8174ff}
.pd-panel{position:fixed;top:16px;right:16px;width:340px;max-height:calc(100vh - 32px);overflow:auto;background:#16181d;color:#e8eaf0;
 border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.4);z-index:5;font-size:12px}
.pd-panel h3{margin:0;padding:12px 14px;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #262a33;position:sticky;top:0;background:#16181d}
.pd-panel .body{padding:10px 14px 14px}
.pd-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid #20242c}
.pd-row span:first-child{color:#8d93a3}.pd-row span:last-child{text-align:right;word-break:break-all}
.pd-swatch{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px;border:1px solid #fff3}
.pd-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.pd-grid>*{cursor:pointer}
.pd-tip{position:fixed;background:#16181d;color:#fff;font-size:11px;padding:4px 8px;border-radius:6px;pointer-events:none;z-index:4;white-space:nowrap}
.pd-hl{position:fixed;pointer-events:none;border:1.5px solid #6d5efc;background:rgba(109,94,252,.12);z-index:3;transition:all .06s}
.pd-hl.m{border:0;background:rgba(246,178,107,.35)}.pd-hl.p{border:0;background:rgba(147,196,125,.45)}
`;

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;

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

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let toastEl: HTMLElement | null = null;
let toastTimer: number | undefined;
export function toast(msg: string, ms = 2200) {
  const r = overlay();
  toastEl ??= r.appendChild(el('div', 'pd-toast'));
  if (!toastEl.isConnected) r.append(toastEl);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('show'), ms);
}

/** Pointer-events:auto wrapper for interactive overlay UI. */
export function interactive<T extends HTMLElement>(node: T): T {
  node.style.pointerEvents = 'auto';
  return node;
}

export function bar(title: string, buttons: { label: string; primary?: boolean; onClick: () => void }[]) {
  const b = interactive(el('div', 'pd-bar', `<b>${esc(title)}</b>`));
  for (const btn of buttons) {
    const x = el('button', `pd-btn${btn.primary ? ' primary' : ''}`, esc(btn.label));
    x.onclick = btn.onClick;
    b.append(x);
  }
  overlay().append(b);
  return b;
}

export function panel(title: string, onClose: () => void) {
  const p = interactive(el('div', 'pd-panel'));
  const h = el('h3', '', `<span>${esc(title)}</span>`);
  const close = el('button', 'pd-btn', '✕');
  close.onclick = onClose;
  h.append(close);
  const body = el('div', 'body');
  p.append(h, body);
  overlay().append(p);
  return { root: p, body };
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
