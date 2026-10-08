import type { Tool } from '../tool';
import { runtime } from '../runtime';
import { colorsIn } from '../analyze';

export const colorPalette: Tool = {
  id: 'color-palette',
  activate() { runtime.publish({ colors: colorsIn() }); },
  deactivate() {},
};
