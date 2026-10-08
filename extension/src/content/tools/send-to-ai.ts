import type { Tool } from '../tool';
import { cssPath, listen, target } from '../tool';
import { highlightBox, isOwn, toast } from '../ui';
import { runtime } from '../runtime';
import {
  a11yFacts, breakpoint, captureElement, captureVisible, colorsIn, fontsIn, imagesIn, label, radiiIn, shadowsIn, spacingIn, trimmedMarkup,
} from '../analyze';
import type { PromptContext } from '../../lib/ai/prompts';
import type { SendToAiData } from '../../views/types';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;
let state: SendToAiData = { picking: false, ready: false, context: null, screenshot: null };
const publish = (patch: Partial<SendToAiData>) => { state = { ...state, ...patch }; runtime.publish(state); };

/** Measures the target locally. Nothing leaves the page until the user copies or opens the prompt. */
async function gather(kind: PromptContext['target']['kind'], el?: Element) {
  hl?.hide();
  publish({ picking: false, ready: false });
  const root = el ?? document.body;
  const size = el ? el.getBoundingClientRect()
    : kind === 'page' ? { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight } : { width: innerWidth, height: innerHeight };
  const context: PromptContext = {
    url: location.href,
    title: document.title,
    viewport: { w: innerWidth, h: innerHeight, breakpoint: breakpoint(innerWidth) },
    target: {
      kind, selector: el ? cssPath(el) : 'body', label: el ? label(el) : kind === 'page' ? 'whole page' : 'visible area',
      w: Math.round(size.width), h: Math.round(size.height),
    },
    markup: trimmedMarkup(root),
    colors: colorsIn(root).slice(0, 24),
    fonts: fontsIn(root),
    spacing: spacingIn(root),
    radii: radiiIn(root),
    shadows: shadowsIn(root),
    images: imagesIn(root).slice(0, 30),
    a11y: a11yFacts(root),
  };
  let screenshot: string | null = null;
  try { screenshot = el ? await captureElement(el) : await captureVisible(); } catch { /* capture can fail on some pages; the prompt still works */ }
  publish({ context, screenshot, ready: true });
}

function startPicking() {
  publish({ picking: true, ready: false, context: null, screenshot: null });
  toast('Click an element to send it to AI');
}

export const sendToAi: Tool = {
  id: 'send-to-ai',
  activate() {
    state = { picking: false, ready: false, context: null, screenshot: null };
    hl = highlightBox();
    off = [
      listen('mousemove', (e) => { if (!state.picking || isOwn(e)) return; const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }),
      listen('click', (e) => {
        if (!state.picking || isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e);
        if (t) void gather('element', t);
      }),
    ];
    // Handed over from the inspector's locked element.
    const handed = runtime.handoff;
    runtime.handoff = null;
    if (handed?.isConnected) void gather('element', handed);
    else startPicking();
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); hl = null; },
  onAction(action) {
    if (action === 'pick') startPicking();
    if (action === 'page') void gather('page');
    if (action === 'viewport') void gather('viewport');
  },
};
