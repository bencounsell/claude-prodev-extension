import { describe, it, expect } from 'vitest';
import {
  buildPrompt, destination, FORMATS, parseDeclarations, plan, TASKS, type PromptContext,
} from '../extension/src/lib/ai/prompts';
import { trimmedMarkup } from '../extension/src/content/analyze';

const ctx = (html = '<a class="cta" style="padding:14px 24px">Start free trial</a>'): PromptContext => ({
  url: 'https://acme.example/',
  title: 'Acme',
  viewport: { w: 900, h: 800, breakpoint: 'md' },
  target: { kind: 'element', selector: 'section.hero > a.cta', label: 'a.cta', w: 169, h: 49 },
  markup: { html, truncated: false, elements: 1 },
  colors: [{ hex: '#ea580c', count: 12 }, { hex: '#ffffff', count: 40 }],
  fonts: [{ family: 'Inter', count: 20, weights: ['400', '700'], sizes: ['15px', '52px'] }],
  spacing: ['8px', '16px', '24px'],
  radii: ['12px'],
  shadows: ['rgba(0, 0, 0, 0.1) 0px 10px 24px 0px'],
  images: ['https://acme.example/hero.png'],
  a11y: {
    title: 'Acme', lang: 'en', landmarks: ['nav', 'main'], headings: ['h1: Ship faster'], imagesWithoutAlt: [],
    unlabeledControls: [], unnamedButtonsAndLinks: [],
    lowContrast: [{ selector: 'p.lead', text: 'Acme gives…', ratio: 3.1, fg: '#999999', bg: '#ffffff', large: false }],
  },
});

describe('buildPrompt', () => {
  for (const t of TASKS) {
    for (const f of FORMATS) {
      it(`${t.id} × ${f.id} includes the page context`, () => {
        const p = buildPrompt(ctx(), { task: t.id, format: f.id, input: 'make it rounder', placeholders: true, screenshot: true });
        expect(p.full.startsWith(p.instructions)).toBe(true);
        expect(p.context).toContain('https://acme.example/');
        expect(p.context).toContain('900 × 800px');
        expect(p.context).toContain('#ea580c (×12)');
        if (t.id === 'styleguide') expect(p.context).not.toContain('```html');
        else expect(p.context).toContain('Start free trial');
      });
    }
  }

  it('recreate carries the chosen format rules and placeholder choice', () => {
    const p = buildPrompt(ctx(), { task: 'recreate', format: 'alpine-tailwind', placeholders: true, screenshot: true });
    expect(p.instructions).toContain('Alpine.js');
    expect(p.instructions).toContain('placehold.co');
    expect(p.instructions).toContain('screenshot of it is attached');
    const keep = buildPrompt(ctx(), { task: 'recreate', format: 'vue', placeholders: false, screenshot: false });
    expect(keep.instructions).toContain('<script setup lang="ts">');
    expect(keep.instructions).toContain('Keep the original text');
    expect(keep.instructions).not.toContain('screenshot');
    expect(keep.context).toContain('https://acme.example/hero.png');
  });

  it('edit and ask include the user’s words; a11y includes measured facts', () => {
    expect(buildPrompt(ctx(), { task: 'edit', format: 'html-css', input: 'pill shaped', placeholders: false, screenshot: false }).instructions).toContain('"pill shaped"');
    expect(buildPrompt(ctx(), { task: 'ask', format: 'html-css', input: 'Why does it wrap?', placeholders: false, screenshot: false }).instructions).toContain('Why does it wrap?');
    const a = buildPrompt(ctx(), { task: 'a11y', format: 'html-css', placeholders: false, screenshot: false });
    expect(a.context).toContain('3.1:1 (needs 4.5:1)');
    expect(a.context).toContain('Landmarks present: nav, main');
  });
});

describe('plan (handoff)', () => {
  const small = buildPrompt(ctx(), { task: 'ask', format: 'html-css', input: 'Why?', placeholders: false, screenshot: false });
  const big = buildPrompt(ctx(`<div>${'x'.repeat(20000)}</div>`), { task: 'recreate', format: 'react-tailwind', placeholders: true, screenshot: false });

  it('prefills Claude when the prompt fits', () => {
    const h = plan(small, destination('claude'), 'desktop');
    expect(h.url?.startsWith('claude://claude.ai/new?q=')).toBe(true);
    expect(decodeURIComponent(h.url!.split('?q=')[1])).toBe(small.full);
    expect(h.clipboard).toBeNull();
    expect(plan(small, destination('claude'), 'web').url?.startsWith('https://claude.ai/new?q=')).toBe(true);
  });

  it('splits into prefilled instructions + clipboard context when too long', () => {
    const h = plan(big, destination('claude'), 'web');
    expect(decodeURIComponent(h.url!.split('?q=')[1])).toContain(big.instructions);
    expect(h.clipboard).toBe(big.context);
  });

  it('uses the clipboard for apps without documented prefill', () => {
    expect(plan(small, destination('chatgpt'), 'desktop')).toMatchObject({ url: 'codex://threads/new', clipboard: small.full });
    expect(plan(small, destination('gemini'), 'web')).toMatchObject({ url: 'https://gemini.google.com/app', clipboard: small.full });
    expect(plan(small, destination('copy'), 'web')).toMatchObject({ url: null, clipboard: small.full });
  });
});

describe('parseDeclarations', () => {
  it('reads blocks with or without braces, selectors, fences and !important', () => {
    expect(parseDeclarations('```css\n{ border-radius: 999px; background-color: #0071e3 !important; }\n```'))
      .toEqual([['border-radius', '999px'], ['background-color', '#0071e3']]);
    expect(parseDeclarations('.cta { padding: 12px 20px }')).toEqual([['padding', '12px 20px']]);
    expect(parseDeclarations('color: red; nonsense; : x;')).toEqual([['color', 'red']]);
  });
});

describe('trimmedMarkup', () => {
  it('drops scripts, keeps useful attributes, absolutises URLs and shortens data URIs', () => {
    document.body.innerHTML = `<section id="s" data-track="x" onclick="evil()"><script>alert(1)</script>
      <img src="/hero.png" alt="Hero"><a href="/pricing" class="btn">Pricing</a><img src="data:image/png;base64,AAAA" alt=""></section>`;
    const { html } = trimmedMarkup(document.getElementById('s')!);
    expect(html).not.toContain('script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('data-track');
    expect(html).toContain('alt="Hero"');
    expect(html).toContain(`href="${new URL('/pricing', location.href).href}"`);
    expect(html).toContain('data:…(omitted)');
  });

  it('caps size and element count', () => {
    document.body.innerHTML = `<ul id="l">${'<li>item</li>'.repeat(50)}</ul>`;
    const r = trimmedMarkup(document.getElementById('l')!, { maxElements: 10 });
    expect(r.truncated).toBe(true);
    expect(r.html).toContain('more elements omitted');
  });
});
