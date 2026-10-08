// "Send to AI" prompts. Hairline never calls an AI itself: it builds a prompt from what it measured on
// the page, then opens the user's own AI app with it (prefilled where the app supports it) or puts it
// on the clipboard. Everything here is pure so it can be unit-tested.

export type TaskId = 'recreate' | 'edit' | 'ask' | 'a11y' | 'styleguide';
export type FormatId = 'html-tailwind' | 'alpine-tailwind' | 'react-tailwind' | 'html-css' | 'vue' | 'svelte';
export type DestinationId = 'claude' | 'chatgpt' | 'gemini' | 'copy';
export type AppMode = 'desktop' | 'web';

export interface Task { id: TaskId; label: string; pro: boolean; needsInput?: 'instruction' | 'question'; blurb: string }
export const TASKS: Task[] = [
  { id: 'recreate', label: 'Recreate', pro: true, blurb: 'Rebuild it as clean code in your stack.' },
  { id: 'edit', label: 'Edit with words', pro: true, needsInput: 'instruction', blurb: 'Describe a change; paste the CSS back into the inspector.' },
  { id: 'ask', label: 'Ask', pro: false, needsInput: 'question', blurb: 'Ask anything about how it’s built.' },
  { id: 'a11y', label: 'Accessibility', pro: true, blurb: 'A prioritised WCAG review with fixes.' },
  { id: 'styleguide', label: 'Style guide', pro: true, blurb: 'Turn its colors, type and spacing into design tokens.' },
];

export interface Format { id: FormatId; label: string; file: string; rules: string }
export const FORMATS: Format[] = [
  { id: 'html-tailwind', label: 'HTML + Tailwind', file: 'HTML snippet',
    rules: 'Use Tailwind CSS v4 utility classes only, no custom CSS. Prefer the default scale; use arbitrary values such as `w-[372px]` only when nothing on the scale is close.' },
  { id: 'alpine-tailwind', label: 'Alpine + Tailwind', file: 'HTML snippet',
    rules: 'Use Tailwind CSS v4 utility classes for styling and Alpine.js 3 (`x-data`, `x-show`, `x-transition`, `@click`, `:class`) for any interactive state such as menus, tabs, toggles, accordions and modals. No other JavaScript.' },
  { id: 'react-tailwind', label: 'React + Tailwind', file: 'TSX file',
    rules: 'Write one React function component in TypeScript (TSX) styled with Tailwind CSS v4 utility classes. Expose text content and image URLs as typed props with sensible defaults. No external UI libraries.' },
  { id: 'html-css', label: 'HTML + CSS', file: 'HTML file with one <style> block',
    rules: 'Use semantic HTML and one <style> block, no frameworks. Prefix every class with `pd-` to avoid collisions, and put colors, fonts, spacing and radii in CSS custom properties on the outermost class.' },
  { id: 'vue', label: 'Vue', file: 'Vue single-file component',
    rules: 'Write a Vue 3 single-file component with `<script setup lang="ts">`, props for text content and image URLs, and `<style scoped>` for styling.' },
  { id: 'svelte', label: 'Svelte', file: 'Svelte component',
    rules: 'Write a Svelte 5 component using runes (`$props()` for text content and image URLs, `$state()` for any interactive state) with a component-scoped `<style>` block.' },
];

export interface Destination { id: DestinationId; name: string; prefillLimit: number; url(mode: AppMode, prompt?: string): string | null }
/** Characters of prompt we put in a link. Claude's documented `q` parameter keeps about 14,000. */
const CLAUDE_PREFILL = 13000;
export const DESTINATIONS: Destination[] = [
  {
    id: 'claude', name: 'Claude', prefillLimit: CLAUDE_PREFILL,
    // Documented: claude://claude.ai/new?q=… opens Claude Desktop with the prompt filled in, not sent.
    url: (mode, prompt) => `${mode === 'desktop' ? 'claude://claude.ai/new' : 'https://claude.ai/new'}${prompt ? `?q=${encodeURIComponent(prompt)}` : ''}`,
  },
  {
    // The ChatGPT desktop app documents codex://threads/new; no documented prompt parameter yet.
    id: 'chatgpt', name: 'ChatGPT', prefillLimit: 0,
    url: (mode) => (mode === 'desktop' ? 'codex://threads/new' : 'https://chatgpt.com/'),
  },
  { id: 'gemini', name: 'Gemini', prefillLimit: 0, url: () => 'https://gemini.google.com/app' },
  { id: 'copy', name: 'Copy only', prefillLimit: 0, url: () => null },
];
export const destination = (id: DestinationId) => DESTINATIONS.find((d) => d.id === id) ?? DESTINATIONS[0];
export const format = (id: FormatId) => FORMATS.find((f) => f.id === id) ?? FORMATS[0];
export const task = (id: TaskId) => TASKS.find((t) => t.id === id) ?? TASKS[0];

/** Everything Hairline measured, assembled by the content script. */
export interface PromptContext {
  url: string;
  title: string;
  viewport: { w: number; h: number; breakpoint: string };
  target: { kind: 'element' | 'page' | 'viewport'; selector: string; label: string; w: number; h: number };
  markup: { html: string; truncated: boolean; elements: number };
  colors: { hex: string; count: number }[];
  fonts: { family: string; count: number; weights: string[]; sizes: string[] }[];
  spacing: string[];
  radii: string[];
  shadows: string[];
  images: string[];
  a11y?: {
    title: string; lang: string | null; landmarks: string[]; headings: string[]; imagesWithoutAlt: string[];
    unlabeledControls: string[]; unnamedButtonsAndLinks: string[];
    lowContrast: { selector: string; text: string; ratio: number; fg: string; bg: string; large: boolean }[];
  };
}

export interface PromptOptions {
  task: TaskId;
  format: FormatId;
  /** "Edit with words" instruction or "Ask" question. */
  input?: string;
  /** Replace the original copy, brands and images with placeholders (Recreate). */
  placeholders: boolean;
  /** Whether the user will attach a screenshot. */
  screenshot: boolean;
}

export interface BuiltPrompt { instructions: string; context: string; full: string }

const list = (items: string[], empty = 'none found') => (items.length ? items.map((i) => `- ${i}`).join('\n') : `- ${empty}`);

function targetLine(c: PromptContext) {
  if (c.target.kind === 'page') return 'The whole page';
  if (c.target.kind === 'viewport') return `The visible area (${c.viewport.w} × ${c.viewport.h}px)`;
  return `\`${c.target.selector}\` (${c.target.label}), ${c.target.w} × ${c.target.h}px`;
}

function designValues(c: PromptContext) {
  return [
    '## Design values measured on the page',
    `Colors by usage: ${c.colors.slice(0, 16).map((x) => `${x.hex} (×${x.count})`).join(', ') || 'none'}`,
    `Fonts: ${c.fonts.slice(0, 6).map((f) => `${f.family} (weights ${f.weights.join('/')}; sizes ${f.sizes.join(', ')})`).join('; ') || 'none'}`,
    `Spacing (most used): ${c.spacing.join(', ') || 'none'}`,
    `Border radii: ${c.radii.join(', ') || 'none'}`,
    `Shadows: ${c.shadows.length ? c.shadows.map((s) => `\`${s}\``).join(', ') : 'none'}`,
  ].join('\n');
}

function contextBlock(c: PromptContext, o: PromptOptions) {
  const parts = [
    '# Page context (measured by Hairline)',
    `- URL: ${c.url}`,
    `- Title: ${c.title || '(untitled)'}`,
    `- Viewport: ${c.viewport.w} × ${c.viewport.h}px (Tailwind \`${c.viewport.breakpoint}\` breakpoint)`,
    `- Target: ${targetLine(c)}`,
  ];
  if (o.task !== 'styleguide') {
    parts.push('', `## Markup (computed styles inlined, defaults omitted${c.markup.truncated ? '; truncated, so rely on the screenshot for the rest' : ''})`,
      '```html', c.markup.html, '```');
  }
  parts.push('', designValues(c));
  if (o.task === 'recreate' && !o.placeholders && c.images.length) parts.push('', '## Image URLs', list(c.images.slice(0, 20)));
  if (o.task === 'a11y' && c.a11y) {
    const a = c.a11y;
    parts.push('', '## Accessibility facts measured locally',
      `- Page language: ${a.lang ?? 'not set'}`, `- Landmarks present: ${a.landmarks.join(', ') || 'none'}`,
      '', 'Heading outline:', list(a.headings),
      '', 'Text below WCAG AA contrast:', list(a.lowContrast.map((x) => `\`${x.selector}\` "${x.text}": ${x.fg} on ${x.bg} = ${x.ratio}:1 (needs ${x.large ? '3' : '4.5'}:1)`)),
      '', 'Images without alt attribute:', list(a.imagesWithoutAlt),
      '', 'Form controls without a label:', list(a.unlabeledControls),
      '', 'Links and buttons without an accessible name:', list(a.unnamedButtonsAndLinks));
  }
  return parts.join('\n');
}

function instructionsFor(c: PromptContext, o: PromptOptions) {
  const shot = o.screenshot ? ' A screenshot of it is attached; match it visually.' : '';
  switch (o.task) {
    case 'recreate': {
      const f = format(o.format);
      return [
        `You are an expert front-end engineer. Recreate the UI below as ${f.label} (${f.file}).${shot}`,
        '',
        'Requirements:',
        `- ${f.rules}`,
        '- Match the layout, spacing, typography, colors, borders, radii and shadows closely. The measured values in the page context are the source of truth.',
        `- Make it responsive. It was captured at ${c.viewport.w}px wide (the \`${c.viewport.breakpoint}\` breakpoint); reflow sensibly down to 360px.`,
        '- Use semantic, accessible markup: headings in order, alt text, labelled controls, visible focus states, AA contrast.',
        o.placeholders
          ? '- Replace all text, brand names, logos and photos with neutral placeholder content of similar length, and use https://placehold.co/WIDTHxHEIGHT for images.'
          : '- Keep the original text and use the image URLs listed in the context.',
        '- Leave out the page’s scripts, tracking and anything unrelated to this UI.',
        '',
        `Reply with one code block containing the complete ${f.file}, then at most five short notes on anything you approximated.`,
      ].join('\n');
    }
    case 'edit':
      return [
        'You are a senior CSS engineer. Below is an element from a live web page with its current computed styles.',
        `Change it as follows: "${o.input?.trim() || '(describe the change)'}"${shot ? '. A screenshot is attached.' : '.'}`,
        '',
        'Reply with only a CSS declaration block for this element and nothing else, for example:',
        '```css',
        '{ border-radius: 999px; background-color: #0071e3; }',
        '```',
        'Include only the properties that change, and prefer values from the design values listed in the context so the result fits the page.',
      ].join('\n');
    case 'ask':
      return [
        'You are a senior front-end engineer helping me understand a live web page.',
        `My question: ${o.input?.trim() || '(type your question)'}`,
        '',
        `Answer using the markup and computed styles below.${shot} Be concrete: name the elements, properties and values involved, and give exact CSS or HTML fixes where they help.`,
      ].join('\n');
    case 'a11y':
      return [
        `You are an accessibility specialist. Review ${c.target.kind === 'element' ? 'this section of the page' : 'this page'} against WCAG 2.2 AA.${shot}`,
        'Hairline has already measured some facts locally (listed in the context); verify them against the markup and look for anything else.',
        '',
        'List issues by impact (critical, serious, moderate, minor). For each give: what is wrong, who it affects, where (selector), and the exact fix as code.',
        'Finish with a short checklist of things to test by hand: keyboard only, a screen reader, 200% zoom and reduced motion.',
      ].join('\n');
    case 'styleguide':
      return [
        'You are a design-systems engineer. From the design values measured on this page (in the context below), produce:',
        '1. A named token set: semantic colors (for example primary, surface, text, text-muted, border), a type scale, a spacing scale, radii and shadows, as CSS custom properties.',
        '2. The same tokens as a Tailwind CSS v4 `@theme` block.',
        '3. Short usage guidance: which token to use for what.',
        '',
        'Merge near-duplicate values and point out any inconsistencies you notice.',
      ].join('\n');
  }
}

export function buildPrompt(c: PromptContext, o: PromptOptions): BuiltPrompt {
  const instructions = instructionsFor(c, o);
  const context = contextBlock(c, o);
  return { instructions, context, full: `${instructions}\n\n${context}` };
}

export interface Handoff {
  /** URL to open, if the destination has one. */
  url: string | null;
  /** Text to put on the clipboard before opening (what the link couldn't carry). */
  clipboard: string | null;
  /** What to tell the user. */
  message: string;
}

/**
 * Decides how a prompt reaches the destination: fully prefilled in the link when it fits, the
 * instructions in the link and the context on the clipboard when it doesn't, or all on the clipboard
 * for apps without a documented prefill.
 */
export function plan(p: BuiltPrompt, dest: Destination, mode: AppMode): Handoff {
  if (dest.id === 'copy') return { url: null, clipboard: p.full, message: 'Prompt copied. Paste it into any AI app.' };
  if (dest.prefillLimit && p.full.length <= dest.prefillLimit) {
    return { url: dest.url(mode, p.full), clipboard: null, message: `Opening ${dest.name} with your prompt filled in. Review it and send.` };
  }
  if (dest.prefillLimit && p.instructions.length <= dest.prefillLimit) {
    const lead = `${p.instructions}\n\n(Page context follows; I'll paste it below.)`;
    return { url: dest.url(mode, lead), clipboard: p.context, message: `Opening ${dest.name}. The page context is on your clipboard: paste it under the prompt, then send.` };
  }
  return { url: dest.url(mode), clipboard: p.full, message: `Prompt copied. Paste it into ${dest.name} and send.` };
}

/** Parses "{ a: b; c: d }" (with or without braces, selector or a ```css fence) into declarations. */
export function parseDeclarations(text: string): [string, string][] {
  const body = text.replace(/```(?:css)?/g, '').replace(/^[^{]*\{/, '').replace(/\}[^}]*$/, '');
  return body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(':');
    return i > 0 ? [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).replace(/!important/i, '').trim()] as [string, string] : null;
  }).filter((x): x is [string, string] => !!x && /^-?[a-z][a-z-]*$/.test(x[0]) && x[1].length > 0);
}
