import type { Tool } from '../tool';
import { listen, target } from '../tool';
import { highlightBox, isOwn, toast } from '../ui';

let off: (() => void)[] = [];
let hl: ReturnType<typeof highlightBox> | null = null;

function pick(): Promise<string | null> {
  return new Promise((res) => {
    const f = document.createElement('input');
    f.type = 'file'; f.accept = 'image/*';
    f.onchange = () => {
      const file = f.files?.[0];
      if (!file) return res(null);
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(file);
    };
    f.click();
  });
}

export const imageReplacer: Tool = {
  id: 'image-replacer',
  activate() {
    hl = highlightBox();
    off = [
      listen('mousemove', (e) => { if (isOwn(e)) return; const t = target(e); if (t) hl!.set(t.getBoundingClientRect()); }),
      listen('click', async (e) => {
        if (isOwn(e)) return;
        e.preventDefault(); e.stopPropagation();
        const t = target(e);
        const url = await pick();
        if (!t || !url) return;
        if (t instanceof HTMLImageElement) { t.removeAttribute('srcset'); t.src = url; }
        else (t as HTMLElement).style.backgroundImage = `url("${url}")`;
        toast('Image replaced (resets on reload)');
      }),
    ];
  },
  deactivate() { off.forEach((f) => f()); off = []; hl?.remove(); },
};
