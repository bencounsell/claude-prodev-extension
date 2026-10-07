import type { Tool } from '../tool';
import { runtime } from '../runtime';

function collect(): string[] {
  const urls = new Set<string>();
  const add = (u: string) => { try { if (u) urls.add(new URL(u, location.href).href); } catch { /* invalid URL */ } };
  document.querySelectorAll('img').forEach((i) => add(i.currentSrc || i.src));
  document.querySelectorAll<HTMLSourceElement>('source[srcset]').forEach((s) => s.srcset.split(',').forEach((x) => add(x.trim().split(' ')[0])));
  document.querySelectorAll('*').forEach((n) => {
    for (const m of getComputedStyle(n).backgroundImage.matchAll(/url\(["']?(.*?)["']?\)/g)) if (!m[1].startsWith('data:image/svg')) add(m[1]);
  });
  return [...urls];
}

export const extractImages: Tool = {
  id: 'extract-images',
  activate() { runtime.publish({ images: collect() }); },
  deactivate() {},
};
