export type Tier = 'free' | 'pro';

export interface ToolMeta {
  id: string;
  name: string;
  description: string;
  tier: Tier;
  group: 'Inspect' | 'Edit' | 'Capture';
  /** Inline SVG path data (24x24, stroke icons). */
  icon: string;
  /** Short how-to shown in the on-page pill and the side panel. */
  hint: string;
}

export const TOOLS: ToolMeta[] = [
  { id: 'inspector', hint: 'Hover to inspect · click to lock', name: 'CSS Inspector', description: 'Hover any element to see its box model and styles. Edit live with Pro.', tier: 'free', group: 'Inspect', icon: 'M3 3l7 17 2.5-7.5L20 10zM13 13l6 6' },
  { id: 'text-editor', hint: 'Click any text on the page and type', name: 'Live Text Editor', description: 'Click and type to edit any text on the page.', tier: 'free', group: 'Edit', icon: 'M4 7V4h16v3M9 20h6M12 4v16' },
  { id: 'fonts-changer', hint: 'Pick a font to preview it on the page', name: 'Fonts Changer', description: 'Swap fonts on the whole page or a single element.', tier: 'pro', group: 'Edit', icon: 'M5 20l7-16 7 16M8 14h8' },
  { id: 'fonts-list', hint: 'Every font used on this page', name: 'List All Fonts', description: 'Every font family, weight and size used on the page.', tier: 'free', group: 'Inspect', icon: 'M4 6h16M4 12h10M4 18h6' },
  { id: 'color-picker', hint: 'Pick any pixel on screen', name: 'Color Picker', description: 'Pick any pixel and copy HEX, RGB or HSL.', tier: 'free', group: 'Inspect', icon: 'M14 4l6 6-9 9H5v-6zM12 6l6 6' },
  { id: 'color-palette', hint: 'Click a swatch to copy it', name: 'Color Palette', description: 'Extract every color a website uses.', tier: 'pro', group: 'Inspect', icon: 'M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-5-4-11-8-11z' },
  { id: 'move-element', hint: 'Drag any element to move it', name: 'Move Element', description: 'Drag elements to try new layouts.', tier: 'pro', group: 'Edit', icon: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3' },
  { id: 'delete-element', hint: 'Click an element to remove it', name: 'Delete Element', description: 'Click to remove or hide anything. Undo any time.', tier: 'free', group: 'Edit', icon: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' },
  { id: 'export-element', hint: 'Click an element to copy its HTML + CSS', name: 'Export Element', description: 'Copy any element as standalone HTML + CSS.', tier: 'pro', group: 'Capture', icon: 'M12 3v12M7 10l5 5 5-5M5 21h14' },
  { id: 'extract-images', hint: 'Click an image to download it', name: 'Extract Images', description: 'Find every image and download them all.', tier: 'pro', group: 'Capture', icon: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8 9h.01' },
  { id: 'ruler', hint: 'Drag on the page to measure', name: 'Page Ruler', description: 'Drag to measure anything in pixels.', tier: 'free', group: 'Inspect', icon: 'M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2' },
  { id: 'outliner', hint: 'Hover to see element names and sizes', name: 'Page Outliner', description: 'Outline every element to see the HTML structure.', tier: 'free', group: 'Inspect', icon: 'M4 4h16v16H4zM8 8h8v8H8z' },
  { id: 'image-replacer', hint: 'Click an image to replace it', name: 'Image Replacer', description: 'Swap any image with a file or URL.', tier: 'pro', group: 'Edit', icon: 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4M9 12h6' },
  { id: 'screenshot', hint: 'Capture the visible area, an element or the full page', name: 'Take Screenshot', description: 'Capture the visible area, an element, or the full page.', tier: 'free', group: 'Capture', icon: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z' },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);

export const GROUPS = ['Inspect', 'Edit', 'Capture'] as const;
