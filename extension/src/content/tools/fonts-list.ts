import type { Tool } from '../tool';
import { runtime } from '../runtime';
import { fontsIn } from '../analyze';

export const fontsList: Tool = {
  id: 'fonts-list',
  activate() { runtime.publish({ fonts: fontsIn() }); },
  deactivate() {},
};
