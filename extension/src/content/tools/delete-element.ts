import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { highlightBox, isOwn, toast } from '../ui';
import { runtime } from '../runtime';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;
const stack: { node: HTMLElement; display: string; priority: string }[] = [];
const publish = () => runtime.publish({ count: stack.length });

function undo() {
  const last = stack.pop();
  if (!last) return toast('Nothing to undo');
  last.node.style.setProperty('display', last.display, last.priority);
}

export const deleteElement: Tool = {
  id: 'delete-element',
  activate() {
    hl = highlightBox();
    publish();
    off = [
      listen('mousemove', (e) => { if (isOwn(e)) return; const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }),
      listen('click', (e) => {
        if (isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e) as HTMLElement | null;
        if (!t || t === document.body || t === document.documentElement) return;
        stack.push({ node: t, display: t.style.getPropertyValue('display'), priority: t.style.getPropertyPriority('display') });
        t.style.setProperty('display', 'none', 'important');
        hl!.hide();
        publish();
      }),
      listen('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); publish(); } }),
    ];
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); },
  onAction(action) {
    if (action === 'undo') undo();
    if (action === 'restore') while (stack.length) undo();
    publish();
  },
};
