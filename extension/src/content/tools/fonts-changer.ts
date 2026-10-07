import type { Tool } from '../tool';
import { bar, el, interactive, overlay } from '../ui';
import { runtime } from '../runtime';

const FONTS = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Playfair Display', 'Merriweather', 'Source Code Pro', 'Georgia', 'Arial', 'Comic Sans MS'];
let styleEl: HTMLStyleElement | null = null;
let link: HTMLLinkElement | null = null;
let b: HTMLElement | null = null;

export const fontsChanger: Tool = {
  id: 'fonts-changer',
  activate() {
    b = bar('Fonts Changer', [{ label: 'Reset', onClick: reset }, { label: 'Done', primary: true, onClick: () => runtime.deactivate() }]);
    const sel = interactive(el('select', 'pd-btn'));
    sel.innerHTML = '<option value="">Choose font…</option>' + FONTS.map((f) => `<option>${f}</option>`).join('');
    sel.onchange = () => sel.value && apply(sel.value);
    b.prepend(sel);
    void overlay;
  },
  deactivate() { b?.remove(); },
};

function apply(font: string) {
  reset();
  if (!['Georgia', 'Arial', 'Comic Sans MS'].includes(font)) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700&display=swap`;
    document.head.append(link);
  }
  styleEl = document.createElement('style');
  styleEl.textContent = `body, body *:not(code):not(pre):not(i){font-family:'${font}',sans-serif!important}`;
  document.head.append(styleEl);
}
function reset() { styleEl?.remove(); link?.remove(); styleEl = link = null; }
