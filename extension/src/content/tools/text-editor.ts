import type { Tool } from '../tool';
import { bar } from '../ui';
import { runtime } from '../runtime';

let prev: string | null = null;
let b: HTMLElement | null = null;

export const textEditor: Tool = {
  id: 'text-editor',
  activate() {
    prev = document.designMode;
    document.designMode = 'on';
    b = bar('Live Text Editor — click any text and type', [{ label: 'Done', primary: true, onClick: () => runtime.deactivate() }]);
  },
  deactivate() {
    document.designMode = prev ?? 'off';
    b?.remove();
  },
};
