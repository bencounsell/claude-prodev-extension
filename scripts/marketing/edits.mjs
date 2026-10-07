// Edit decision lists for the marketing videos. Change copy, cuts and camera moves here, then re-run
// render.mjs. Shot times use the marks recorded in each take (see takes/<name>/take.json):
//   from/to: 'mark', 'mark+0.5', 'mark-0.3' or seconds.
//   cam: [time, zoom, focus], time in output seconds from the shot start, negative = from its end,
//        or '@mark±x' for a take mark. focus: 'all' | 'page' | 'pageTop' | 'panel' | 'panelTop' | 'panelLow' | [fx, fy].

/** The only place the product name appears (end cards). */
export const BRAND = {
  name: 'ProDev',
  tagline: 'The web developer &amp; designer toolkit for Chrome',
  cta: 'Add to Chrome, it’s free',
  secondary: 'Pro: one-time purchase',
  footnote: 'Works in Chrome, Edge and Brave',
};

export const INTRO = {
  title: 'Inspect, edit and capture <em>any website</em>',
  sub: '14 tools for developers and designers, docked right beside the page.',
};
const SOCIAL_INTRO = { title: 'Your web toolkit,<br><em>in the side panel</em>', sub: '14 tools. Zero tab-switching.' };

const CAP = {
  inspect: { title: 'Inspect <em>any element</em>', sub: 'Box model, typography and colors at a glance.' },
  edit: { title: 'Edit CSS <em>live</em>', sub: 'Change any value and watch the page update.' },
  colors: { title: 'Grab <em>every color</em>', sub: 'Full palettes with one-click copy and Tailwind export.' },
  contrast: { title: 'Check <em>contrast</em> instantly', sub: 'HEX, RGB, HSL and WCAG ratings for every color.' },
  fonts: { title: 'Identify and swap <em>fonts</em>', sub: 'See every family in use, then try alternatives live.' },
  measure: { title: 'Measure <em>to the pixel</em>', sub: 'Rulers and outlines reveal how the layout is built.' },
  rearrange: { title: 'Rearrange <em>anything</em>', sub: 'Delete, move and rewrite elements, with undo.' },
  export: { title: 'Export <em>any element</em>', sub: 'Standalone HTML + CSS, ready to paste anywhere.' },
  capture: { title: 'Capture and <em>collect</em>', sub: 'Screenshots of the page, an element, or every image on it.' },
  keystroke: { title: 'One <em>keystroke</em> away', sub: 'A command palette and floating panels when you need full width.' },
};

export const LAYOUTS = {
  hero: { width: 1920, height: 1080, scale: 1.12, winCenterY: 546, capTop: 0, safeTop: 0 },
  landscape: { width: 1920, height: 1080, scale: 1.0, winCenterY: 616, capTop: 58, safeTop: 186 },
  square: {
    width: 1080, height: 1080, scale: 0.78, winCenterY: 668, capTop: 70, safeTop: 330, introIcons: 8,
    vars: { '--capT': '50px', '--capS': '23px', '--cardT': '60px', '--cardS': '24px', '--cardW': '860px', '--pill': '19px', '--ico': '54px', '--logo': '100px' },
  },
  vertical: {
    width: 1080, height: 1920, scale: 0.8, winCenterY: 1100, capTop: 170, safeTop: 430, introIcons: 8,
    vars: { '--capT': '68px', '--capS': '30px', '--capGap': '18px', '--cardT': '78px', '--cardS': '31px', '--cardW': '860px', '--cardGap': '30px', '--pill': '24px', '--ico': '72px', '--logo': '130px' },
  },
};

/* ------------------------------------------------------------------ shots */

const S = {
  inspect: { take: 'inspector', from: 'open-0.7', to: 'locked+0.7', speed: 1.15, cap: CAP.inspect,
    cam: [[0, 1, 'all'], ['@hovered-2.6', 1, 'all'], ['@hovered-1.4', 1.45, 'pageTop'], [-0.4, 1.45, 'pageTop']] },
  edit: { take: 'inspector', from: 'edit-0.2', to: 'edited+1.1', speed: 1.1, cap: CAP.edit,
    cam: [[0.3, 1.45, 'panelLow'], ['@edited-0.4', 1.45, 'panelLow'], ['@edited+0.5', 1, 'all']] },
  palette: { take: 'colors', from: 'palette-0.4', to: 'copied+1.1', cap: CAP.colors, cam: [[0.3, 1.4, 'panelTop'], [-0.3, 1.4, 'panelTop']] },
  picker: { take: 'colors', from: 'picker-0.3', to: 'picked+0.2', cap: CAP.contrast, cam: [[0.3, 1.4, 'panelTop'], [-0.3, 1.4, 'panelTop']] },
  fonts: { take: 'fonts', from: 'list-0.4', to: 'changed+0.8', speed: 1.15, cap: CAP.fonts,
    cam: [[0.3, 1.4, 'panelTop'], ['@changer-0.2', 1.4, 'panelTop'], ['@changer+0.6', 1, 'all']] },
  measure: { take: 'measure', from: 'outliner-0.3', to: 'measured+1.3', speed: 1.1, cap: CAP.measure, cam: [[0, 1, 'all']] },
  ruler: { take: 'measure', from: 'ruler-0.3', to: 'measured+1.4', cap: CAP.measure, cam: [[0, 1, 'all']] },
  rearrange: { take: 'edit-page', from: 'delete-0.3', to: 'typed+0.8', speed: 1.25, cap: CAP.rearrange, cam: [[0, 1, 'all']] },
  export: { take: 'export', from: 'open-0.3', to: 'exported+3.4', cap: CAP.export,
    cam: [[0, 1, 'all'], ['@exported', 1, 'all'], ['@exported+0.7', 1.4, 'panel'], [-0.3, 1.4, 'panel']] },
  capture: { take: 'capture', from: 'screenshot-0.3', to: 'images+2.8', speed: 1.1, cap: CAP.capture,
    cam: [[0, 1, 'all'], ['@images-0.2', 1, 'all'], ['@images+0.6', 1.4, 'panelTop'], [-0.3, 1.4, 'panelTop']] },
  keystroke: { take: 'floating', from: 'palette-0.5', to: 'end-0.3', speed: 1.1, cap: CAP.keystroke, cam: [[0, 1, 'all']] },
  keystrokeShort: { take: 'floating', from: 'palette-0.5', to: 'locked+0.3', speed: 1.1, cap: CAP.keystroke, cam: [[0, 1, 'all']] },
};

/** Social formats are smaller, so they lean on tighter camera moves. */
const tight = (shot, cam) => ({ ...shot, cam });
const SOCIAL = [
  { kind: 'intro', dur: 2.8 },
  tight(S.edit, [[0.3, 1.6, 'panelLow'], ['@edited-0.4', 1.6, 'panelLow'], ['@edited+0.5', 1.6, 'pageTop']]),
  tight(S.palette, [[0.3, 1.6, 'panelTop'], [-0.3, 1.6, 'panelTop']]),
  tight(S.ruler, [[0, 1.35, 'page']]),
  tight(S.keystrokeShort, [[0, 1.2, [0.42, 0.42]]]),
  { kind: 'end', dur: 3.8 },
];
/** Vertical frames are tall and narrow: push in close enough that the footage fills the frame. */
const SOCIAL_VERTICAL = [
  { kind: 'intro', dur: 2.8 },
  tight(S.edit, [[0.3, 2.25, 'panelLow'], ['@edited-0.4', 2.25, 'panelLow'], ['@edited+0.5', 2.25, [0.2, 0.5]]]),
  tight(S.palette, [[0.3, 2.25, 'panelTop'], [-0.3, 2.25, 'panelTop']]),
  tight(S.ruler, [[0, 2.1, [0.5, 0.45]]]),
  tight(S.keystrokeShort, [[0, 2.1, [0.76, 0.42]]]),
  { kind: 'end', dur: 3.8 },
];

/* ------------------------------------------------------------------ videos */

const loop = (name, shots, extra = {}) => ({ name, layout: 'landscape', loop: true, web: true, crf: 23, shots, ...extra });

export const VIDEOS = [
  {
    name: 'hero-loop', layout: 'hero', captions: false, loop: true, web: true, crf: 22, poster: 2,
    shots: [
      { ...S.inspect, from: 'open-0.5', to: 'locked+0.5', speed: 1.3, cam: [[0, 1, 'all'], ['@hovered-2.6', 1, 'all'], ['@hovered-1.4', 1.4, 'pageTop'], [-0.4, 1.4, 'pageTop']] },
      { ...S.edit, speed: 1.25, cam: [[0.3, 1.4, 'panelLow'], ['@edited-0.4', 1.4, 'panelLow'], ['@edited+0.5', 1, 'all']] },
      { ...S.palette, to: 'copied+0.6', cam: [[0.3, 1.4, 'panelTop'], [-0.3, 1.4, 'panelTop']] },
      { ...S.ruler, to: 'measured+1.0', speed: 1.15 },
      { ...S.keystrokeShort, speed: 1.25 },
    ],
  },
  loop('feature-inspect-edit', [S.inspect, { ...S.edit, cap: CAP.inspect }], { poster: 6 }),
  loop('feature-colors', [S.palette, { ...S.picker, cap: CAP.colors }], { poster: 3 }),
  loop('feature-fonts', [S.fonts], { poster: 2.5 }),
  loop('feature-measure', [S.measure], { poster: 6 }),
  loop('feature-rearrange', [S.rearrange], { poster: 3 }),
  loop('feature-export', [S.export], { poster: 5 }),
  loop('feature-capture', [S.capture], { poster: 2 }),
  loop('feature-command-palette', [S.keystroke], { poster: 1.5 }),
  {
    name: 'product-tour', layout: 'landscape', crf: 20,
    shots: [{ kind: 'intro', dur: 4.2 }, S.inspect, S.edit, S.palette, S.picker, { ...S.fonts, speed: 1.25 }, S.measure, { ...S.rearrange, speed: 1.4 }, S.export, { ...S.capture, speed: 1.25 }, { ...S.keystroke, speed: 1.25 }, { kind: 'end', dur: 5 }],
  },
  { name: 'social-square', layout: 'square', crf: 21, intro: SOCIAL_INTRO, shots: SOCIAL },
  { name: 'social-vertical', layout: 'vertical', crf: 21, intro: SOCIAL_INTRO, shots: SOCIAL_VERTICAL },
];
