import type { Tool } from '../tool';

let prev: string | null = null;

export const textEditor: Tool = {
  id: 'text-editor',
  activate() {
    prev = document.designMode;
    document.designMode = 'on';
  },
  deactivate() {
    document.designMode = prev ?? 'off';
  },
};
