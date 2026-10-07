export interface Tool {
  id: string;
  activate(): void | Promise<void>;
  deactivate(): void;
}

/** Registers a capture-phase listener and returns a disposer. */
export function listen<K extends keyof DocumentEventMap>(
  type: K,
  fn: (e: DocumentEventMap[K]) => void,
  opts: AddEventListenerOptions = { capture: true },
): () => void {
  document.addEventListener(type, fn as EventListener, opts);
  return () => document.removeEventListener(type, fn as EventListener, opts);
}

/** Element under the pointer, ignoring ProDev's own overlay. */
export function target(e: Event): Element | null {
  const t = e.composedPath()[0];
  return t instanceof Element && t.tagName !== 'PRODEV-ROOT' ? t : null;
}

export function cssPath(e: Element): string {
  const parts: string[] = [];
  let n: Element | null = e;
  while (n && n.nodeType === 1 && parts.length < 4) {
    let s = n.tagName.toLowerCase();
    if (n.id) { parts.unshift(`${s}#${n.id}`); break; }
    const c = [...n.classList].slice(0, 2).join('.');
    if (c) s += `.${c}`;
    parts.unshift(s);
    n = n.parentElement;
  }
  return parts.join(' > ');
}

export function rgbToHex(rgb: string): string | null {
  const m = rgb.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/);
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) === 0) return null;
  return '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
}
