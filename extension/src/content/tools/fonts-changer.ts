import type { Tool } from '../tool';
import { runtime } from '../runtime';

const SYSTEM = ['Georgia', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'system-ui'];
const FONTS = ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Raleway', 'Work Sans', 'DM Sans',
  'Manrope', 'Space Grotesk', 'Playfair Display', 'Merriweather', 'Lora', 'Libre Baskerville', 'Source Code Pro', 'JetBrains Mono', ...SYSTEM];

let styleEl: HTMLStyleElement | null = null;
let link: HTMLLinkElement | null = null;
let current: string | null = null;

const publish = () => runtime.publish({ current, fonts: FONTS });

function reset() { styleEl?.remove(); link?.remove(); styleEl = link = null; current = null; }

function apply(font: string) {
  reset();
  if (!SYSTEM.includes(font)) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700&display=swap`;
    document.head.append(link);
  }
  styleEl = document.createElement('style');
  styleEl.textContent = `body, body *:not(code):not(pre):not(kbd):not(i):not([class*=icon]){font-family:'${font.replace(/'/g, '')}',sans-serif!important}`;
  document.head.append(styleEl);
  current = font;
}

export const fontsChanger: Tool = {
  id: 'fonts-changer',
  activate() { publish(); },
  // Keep the preview applied after the tool closes, like other page edits; reload restores it.
  deactivate() {},
  onAction(action, payload) {
    if (action === 'apply') apply(payload as string);
    if (action === 'reset') reset();
    publish();
  },
};
