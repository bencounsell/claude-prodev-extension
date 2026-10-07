import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { bar, highlightBox, isOwn, toast } from '../ui';
import { runtime } from '../runtime';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;
let b: HTMLElement | null = null;
const stack: { node: HTMLElement; display: string }[] = [];

export const deleteElement: Tool = {
  id: 'delete-element',
  activate() {
    hl = highlightBox();
    b = bar('Delete Element — click to remove', [
      { label: 'Undo', onClick: undo },
      { label: 'Done', primary: true, onClick: () => runtime.deactivate() },
    ]);
    off = [
      listen('mousemove', (e) => { if (isOwn(e)) return; const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }),
      listen('click', (e) => {
        if (isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e) as HTMLElement | null;
        if (!t || t === document.body || t === document.documentElement) return;
        stack.push({ node: t, display: t.style.display });
        t.style.setProperty('display', 'none', 'important');
        hl!.hide();
      }),
    ];
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); b?.remove(); },
};

function undo() {
  const last = stack.pop();
  if (!last) return toast('Nothing to undo');
  last.node.style.display = last.display;
}
