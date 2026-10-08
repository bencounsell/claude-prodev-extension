import type { Tool } from '../tool';
import { runtime } from '../runtime';
import { imagesIn } from '../analyze';

export const extractImages: Tool = {
  id: 'extract-images',
  activate() { runtime.publish({ images: imagesIn() }); },
  deactivate() {},
};
