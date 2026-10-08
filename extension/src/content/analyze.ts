// Read-only page analysis shared by tools (palette, fonts, images, screenshots) and Send to AI.
import { cssPath, rgbToHex } from './tool';
import { overlay } from './ui';
import { sendToBackground } from '../lib/messaging';
import { contrast } from '../views/color';
import type { FontsData } from '../views/types';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const own = (n: Element) => n.closest('prodev-root') !== null;
const elementsIn = (root: Element) => [root, ...root.querySelectorAll('*')].filter((n) => !own(n));

/** Tailwind's default breakpoints, the vocabulary most developers use for "which layout is this". */
export const breakpoint = (w: number) => (w >= 1536 ? '2xl' : w >= 1280 ? 'xl' : w >= 1024 ? 'lg' : w >= 768 ? 'md' : w >= 640 ? 'sm' : 'xs');

export const label = (e: Element) =>
  `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${[...e.classList].slice(0, 2).map((c) => '.' + c).join('')}`;

/* ------------------------------------------------------------------ colors, fonts, images */

export function colorsIn(root: Element = document.body) {
  const counts = new Map<string, number>();
  for (const n of elementsIn(root)) {
    const cs = getComputedStyle(n);
    for (const prop of ['color', 'backgroundColor', 'borderTopColor'] as const) {
      const hex = rgbToHex(cs[prop]);
      if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex, count]) => ({ hex, count }));
}

export function fontsIn(root: Element = document.body): FontsData['fonts'] {
  const map = new Map<string, { count: number; weights: Set<string>; sizes: Set<string> }>();
  for (const n of elementsIn(root)) {
    if (![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent?.trim())) continue;
    const cs = getComputedStyle(n);
    const fam = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '');
    const e = map.get(fam) ?? { count: 0, weights: new Set(), sizes: new Set() };
    e.count++; e.weights.add(cs.fontWeight); e.sizes.add(cs.fontSize);
    map.set(fam, e);
  }
  return [...map.entries()].sort((a, b) => b[1].count - a[1].count).map(([family, v]) => ({
    family, count: v.count, weights: [...v.weights].sort(), sizes: [...v.sizes].sort((a, b) => parseFloat(a) - parseFloat(b)),
  }));
}

export function imagesIn(root: Element = document.body): string[] {
  const urls = new Set<string>();
  const add = (u: string) => { try { if (u) urls.add(new URL(u, location.href).href); } catch { /* invalid URL */ } };
  root.querySelectorAll('img').forEach((i) => add(i.currentSrc || i.src));
  root.querySelectorAll<HTMLSourceElement>('source[srcset]').forEach((s) => s.srcset.split(',').forEach((x) => add(x.trim().split(' ')[0])));
  for (const n of elementsIn(root)) {
    for (const m of getComputedStyle(n).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)) if (!m[1].startsWith('data:image/svg')) add(m[1]);
  }
  return [...urls];
}

/** Most frequent values of a set of length properties, e.g. the page's spacing scale. */
function scale(root: Element, props: string[], limit: number, filter = (v: string) => v !== '0px' && v !== 'none' && v !== 'normal') {
  const counts = new Map<string, number>();
  for (const n of elementsIn(root)) {
    const cs = getComputedStyle(n);
    for (const p of props) {
      for (const v of cs.getPropertyValue(p).split(' ')) if (v && filter(v) && /px$/.test(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([v]) => v).sort((a, b) => parseFloat(a) - parseFloat(b));
}
export const spacingIn = (root: Element = document.body) => scale(root, ['margin-top', 'margin-bottom', 'padding-top', 'padding-left', 'row-gap', 'column-gap'], 14);
export const radiiIn = (root: Element = document.body) => scale(root, ['border-top-left-radius'], 8);
export function shadowsIn(root: Element = document.body) {
  const counts = new Map<string, number>();
  for (const n of elementsIn(root)) {
    const v = getComputedStyle(n).boxShadow;
    if (v && v !== 'none') counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v]) => v);
}

/* ------------------------------------------------------------------ screenshots */

/** Hides ProDev's own UI while capturing so it never appears in screenshots. */
export async function withoutOverlay<T>(fn: () => Promise<T>): Promise<T> {
  const host = overlay().host as HTMLElement;
  host.style.visibility = 'hidden';
  await wait(80);
  try { return await fn(); } finally { host.style.visibility = ''; }
}

export const captureVisible = () => withoutOverlay(() => sendToBackground<string>({ type: 'capture-visible' }));

/** PNG data URL of `el` as it appears in the viewport (scrolled into view first if needed). */
export async function captureElement(el: Element): Promise<string> {
  const before = el.getBoundingClientRect();
  if (before.bottom < 0 || before.top > innerHeight) { el.scrollIntoView({ block: 'center' }); await wait(150); }
  const r = el.getBoundingClientRect();
  const img = new Image();
  img.src = await captureVisible();
  await img.decode();
  const k = img.naturalWidth / innerWidth;
  const left = Math.max(0, r.left), top = Math.max(0, r.top);
  const w = Math.min(innerWidth, r.right) - left, h = Math.min(innerHeight, r.bottom) - top;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w * k); c.height = Math.max(1, h * k);
  c.getContext('2d')!.drawImage(img, left * k, top * k, w * k, h * k, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/* ------------------------------------------------------------------ trimmed markup */

/** Computed properties worth sending, and the values that mean "nothing set". */
const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'box-sizing', 'max-width', 'min-height',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'flex-grow', 'flex-shrink', 'flex-basis',
  'gap', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'overflow',
  'background-color', 'background-image', 'border-radius', 'box-shadow', 'opacity', 'transform', 'object-fit', 'aspect-ratio',
];
const INHERITED = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'color', 'text-align', 'text-transform', 'white-space'];
const EMPTY = new Set(['none', 'normal', 'auto', '0px', 'static', 'visible', 'rgba(0, 0, 0, 0)', 'start', 'nowrap', 'row', 'stretch', 'flex-start',
  '0', '1', 'content-box', 'fill', '0px 0px', 'auto auto', 'normal normal', 'auto / auto', 'border-box']);
const DEFAULT_DISPLAY: Record<string, string> = { span: 'inline', a: 'inline', strong: 'inline', em: 'inline', b: 'inline', i: 'inline', img: 'inline', svg: 'inline',
  button: 'inline-block', input: 'inline-block', li: 'list-item', table: 'table', tr: 'table-row', td: 'table-cell', th: 'table-cell' };
const KEEP_ATTRS = /^(class|id|href|src|alt|title|role|type|name|placeholder|for|value|aria-[\w-]+|width|height|viewBox|d|fill|stroke)$/i;

function sides(cs: CSSStyleDeclaration, prop: string, suffix = '') {
  const v = ['top', 'right', 'bottom', 'left'].map((s) => cs.getPropertyValue(`${prop}-${s}${suffix}`));
  if (v.every((x) => x === '0px')) return null;
  return v[0] === v[2] && v[1] === v[3] ? (v[0] === v[1] ? v[0] : `${v[0]} ${v[1]}`) : v.join(' ');
}

function stylesFor(el: Element, parent: CSSStyleDeclaration | null, isRoot: boolean): string {
  const cs = getComputedStyle(el);
  const out: string[] = [];
  const tag = el.tagName.toLowerCase();
  for (const p of PROPS) {
    const v = cs.getPropertyValue(p);
    if (!v || EMPTY.has(v)) continue;
    if (p === 'display' && v === (DEFAULT_DISPLAY[tag] ?? 'block')) continue;
    if (p === 'z-index' && v === 'auto') continue;
    out.push(`${p}:${v}`);
  }
  for (const p of INHERITED) {
    const v = cs.getPropertyValue(p);
    if (isRoot || !parent || parent.getPropertyValue(p) !== v) out.push(`${p}:${v}`);
  }
  const margin = sides(cs, 'margin'), padding = sides(cs, 'padding');
  if (margin) out.push(`margin:${margin}`);
  if (padding) out.push(`padding:${padding}`);
  const bw = sides(cs, 'border', '-width');
  if (bw) out.push(`border-width:${bw}`, `border-style:${cs.borderTopStyle}`, `border-color:${cs.borderTopColor}`);
  if (['img', 'svg', 'video', 'canvas', 'iframe', 'input', 'select', 'textarea'].includes(tag)) {
    const r = el.getBoundingClientRect();
    out.push(`width:${Math.round(r.width)}px`, `height:${Math.round(r.height)}px`);
  }
  return out.join(';');
}

export interface MarkupOptions { maxChars?: number; maxElements?: number }

/**
 * A clean copy of `root` for an AI: scripts and tracking removed, computed styles inlined but only
 * where they differ from defaults (or from the parent, for inherited text styles), long text and SVG
 * paths shortened, URLs made absolute.
 */
export function trimmedMarkup(root: Element, { maxChars = 60000, maxElements = 700 }: MarkupOptions = {}) {
  let count = 0, omitted = 0;
  const walk = (src: Element, parentCs: CSSStyleDeclaration | null, isRoot: boolean): Node | null => {
    if (own(src)) return null;
    const tag = src.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'template', 'link', 'meta', 'iframe'].includes(tag)) return null;
    if (++count > maxElements) { omitted++; return null; }
    const out = document.createElementNS(src.namespaceURI, tag) as Element;
    for (const a of [...src.attributes]) {
      if (!KEEP_ATTRS.test(a.name)) continue;
      let v = a.value;
      if ((a.name === 'href' || a.name === 'src') && v) {
        v = v.startsWith('data:') ? 'data:…(omitted)' : (() => { try { return new URL(v, location.href).href; } catch { return v; } })();
      }
      if (a.name === 'd' && v.length > 160) v = `${v.slice(0, 160)}…`;
      if (a.name === 'class' && v.length > 120) v = `${v.slice(0, 120)}…`;
      out.setAttribute(a.name, v);
    }
    if (src instanceof HTMLImageElement && src.currentSrc && !src.currentSrc.startsWith('data:')) out.setAttribute('src', src.currentSrc);
    const cs = getComputedStyle(src);
    if (tag !== 'svg' && src.namespaceURI === 'http://www.w3.org/1999/xhtml') {
      const style = stylesFor(src, parentCs, isRoot);
      if (style) out.setAttribute('style', style);
    }
    for (const c of src.childNodes) {
      if (c.nodeType === Node.TEXT_NODE) {
        const t = c.textContent ?? '';
        if (t.trim()) out.append(t.length > 400 ? `${t.slice(0, 400)}…` : t.replace(/\s+/g, ' '));
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        const child = walk(c as Element, cs, false);
        if (child) out.append(child);
      }
    }
    return out;
  };
  const tree = walk(root, null, true) as Element | null;
  let html = tree?.outerHTML ?? '';
  const truncated = html.length > maxChars;
  if (truncated) html = `${html.slice(0, maxChars)}\n<!-- …truncated: the full markup was ${html.length.toLocaleString()} characters -->`;
  if (omitted) html += `\n<!-- ${omitted} more elements omitted -->`;
  return { html, truncated: truncated || omitted > 0, elements: count };
}

/* ------------------------------------------------------------------ accessibility facts */

const parseRgb = (v: string) => {
  const m = v.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/);
  return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null;
};

/** Background color actually behind `el`: the first opaque background walking up the tree. */
function backgroundOf(el: Element): number[] {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = parseRgb(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0.5) return c.rgb;
    if (getComputedStyle(n).backgroundImage !== 'none') return [];
  }
  return [255, 255, 255];
}

export interface A11yFacts {
  title: string; lang: string | null; landmarks: string[];
  headings: string[]; imagesWithoutAlt: string[]; unlabeledControls: string[]; unnamedButtonsAndLinks: string[];
  lowContrast: { selector: string; text: string; ratio: number; fg: string; bg: string; large: boolean }[];
}

export function a11yFacts(root: Element = document.body): A11yFacts {
  const all = elementsIn(root);
  const short = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const nameOf = (e: Element) => (e.getAttribute('aria-label') || e.getAttribute('title') || (e as HTMLElement).innerText || '').trim();
  const lowContrast: A11yFacts['lowContrast'] = [];
  for (const n of all) {
    if (!(n instanceof HTMLElement) || !n.offsetParent) continue;
    const text = [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim();
    if (!text) continue;
    const cs = getComputedStyle(n);
    const fg = parseRgb(cs.color), bg = backgroundOf(n);
    if (!fg || bg.length !== 3) continue;
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const ratio = contrast(fg.rgb, bg);
    if (ratio < (large ? 3 : 4.5)) {
      lowContrast.push({ selector: cssPath(n), text: short(text, 40), ratio: +ratio.toFixed(2), fg: rgbToHex(cs.color) ?? cs.color, bg: `#${bg.map((x) => x.toString(16).padStart(2, '0')).join('')}`, large });
    }
  }
  return {
    title: document.title,
    lang: document.documentElement.getAttribute('lang'),
    landmarks: ['header', 'nav', 'main', 'aside', 'footer'].filter((t) => root.querySelector(`${t}, [role="${t === 'header' ? 'banner' : t === 'footer' ? 'contentinfo' : t === 'aside' ? 'complementary' : t === 'nav' ? 'navigation' : 'main'}"]`)),
    headings: all.filter((n) => /^H[1-6]$/.test(n.tagName)).slice(0, 40).map((h) => `${h.tagName.toLowerCase()}: ${short((h as HTMLElement).innerText.trim())}`),
    imagesWithoutAlt: all.filter((n) => n.tagName === 'IMG' && !n.hasAttribute('alt')).slice(0, 12).map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src),
    unlabeledControls: all.filter((n) => n.matches('input:not([type=hidden]), select, textarea') && !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')
      && !(n.id && root.ownerDocument.querySelector(`label[for="${CSS.escape(n.id)}"]`)) && !n.closest('label')).slice(0, 12).map((n) => cssPath(n)),
    unnamedButtonsAndLinks: all.filter((n) => n.matches('a[href], button') && !nameOf(n) && !n.querySelector('img[alt]:not([alt=""])')).slice(0, 12).map((n) => cssPath(n)),
    lowContrast: lowContrast.sort((a, b) => a.ratio - b.ratio).slice(0, 12),
  };
}

