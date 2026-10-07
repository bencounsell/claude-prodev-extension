import type { ComponentType } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { toolById } from '../lib/tools';
import { contrast, formats } from './color';
import { Icon, I } from './Icon';
import type {
  DeleteData, Env, ExportData, FontsChangerData, FontsData, ImagesData, InspectorData, PaletteData, PickerData, ScreenshotData,
} from './types';

type ViewProps<T> = { data: T | null; env: Env };

const Empty = ({ icon, children }: { icon: string; children: preact.ComponentChildren }) => (
  <div class="v-empty"><span class="v-empty-ic"><Icon d={icon} size={22} /></span><div>{children}</div></div>
);

/* ---------------------------------------------------------------- inspector */

function BoxModel({ box, w, h }: { box: InspectorData['box']; w: number; h: number }) {
  const v = ([t, r, b, l]: string[]) => (
    <><span class="bv t">{t}</span><span class="bv r">{r}</span><span class="bv b">{b}</span><span class="bv l">{l}</span></>
  );
  return (
    <div class="v-bm" aria-label="Box model">
      <div class="lay m"><em>margin</em>{v(box.margin)}
        <div class="lay bo"><em>border</em>{v(box.border)}
          <div class="lay p"><em>padding</em>{v(box.padding)}
            <div class="c">{w} × {h}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InspectorView({ data, env }: ViewProps<InspectorData>) {
  const root = useRef<HTMLDivElement>(null);
  const refocus = useRef<string | null>(null);
  // Re-focus the field the user just applied, so they can keep tweaking with the keyboard.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    const el = root.current?.querySelector<HTMLInputElement>(`input[data-p="${refocus.current}"]`);
    el?.focus();
    el?.select();
    refocus.current = null;
  }, [data]);

  if (!data) {
    return <Empty icon={I.cursor}>Hover any element on the page to inspect it.<br />Click to lock the selection.</Empty>;
  }
  return (
    <div ref={root}>
      <div class="v-head">
        <span class="v-chip" title={data.path}>{data.label}</span>
        <span class="v-dim">{data.w} × {data.h}</span>
        {data.locked && <button class="v-pill ok" title="Click to unlock" onClick={() => env.act('unlock')}>Locked</button>}
      </div>
      <BoxModel box={data.box} w={data.w} h={data.h} />
      {data.sections.map((s) => (
        <div class="v-sec" key={s.title}>
          <h4>{s.title}</h4>
          {s.rows.map((r) => (
            <label class="v-row" key={r.prop}>
              <span class="k">{r.prop}</span>
              <span class="v">
                {r.hex && <i class="v-sw" style={{ background: r.hex }} title={`Copy ${r.hex}`} onClick={(e) => { e.preventDefault(); env.copy(r.hex!, `${r.hex} copied`); }} />}
                <input
                  key={`${r.prop}:${r.hex ?? r.value}`}
                  class={`v-in${env.pro ? '' : ' ro'}`}
                  data-p={r.prop}
                  defaultValue={r.hex ?? r.value}
                  readOnly={!env.pro}
                  spellcheck={false}
                  title={env.pro ? 'Edit, then press Enter' : 'Live editing is a Pro feature'}
                  onFocus={() => env.pro && !data.locked && env.act('lock')}
                  onClick={() => !env.pro && env.upsell('Live CSS editing')}
                  onKeyDown={(e) => {
                    const t = e.currentTarget;
                    if (e.key === 'Enter') { refocus.current = r.prop; env.act('set-style', { prop: r.prop, value: t.value.trim() }); }
                    if (e.key === 'Escape') { e.stopPropagation(); t.value = r.hex ?? r.value; t.blur(); }
                  }}
                />
              </span>
            </label>
          ))}
        </div>
      ))}
      <div class="v-actions">
        <button class="v-btn primary" onClick={() => env.copy(data.css, 'CSS copied')}><Icon d={I.copy} size={14} />Copy CSS</button>
        <button class="v-btn" onClick={() => env.copy(data.path, 'Selector copied')}>Copy selector</button>
        {data.edited && <button class="v-btn" onClick={() => env.act('reset')}><Icon d={I.refresh} size={14} />Reset edits</button>}
        {!env.pro && <button class="v-pill pro" onClick={() => env.upsell('Live CSS editing')}>Edit with Pro</button>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- fonts */

function FontsView({ data, env }: ViewProps<FontsData>) {
  if (!data) return null;
  if (!data.fonts.length) return <Empty icon={I.search}>No text found on this page.</Empty>;
  return (
    <div class="v-list">
      {data.fonts.map((f) => (
        <button class="v-font" key={f.family} onClick={() => env.copy(f.family, `“${f.family}” copied`)} title="Copy font name">
          <div class="n" style={{ fontFamily: `"${f.family}", sans-serif` }}>{f.family}<span class="v-dim">{f.count} elements</span></div>
          <div class="s" style={{ fontFamily: `"${f.family}", sans-serif` }}>The quick brown fox jumps over the lazy dog</div>
          <div class="m">Weights {f.weights.join(' · ')}<br />Sizes {f.sizes.join(' · ')}</div>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- palette */

function PaletteView({ data, env }: ViewProps<PaletteData>) {
  if (!data) return null;
  const top = data.colors.slice(0, 24);
  return (
    <>
      <p class="v-note">{data.colors.length} colors · sorted by usage · click to copy</p>
      <div class="v-swatches">
        {data.colors.slice(0, 48).map((c) => (
          <button key={c.hex} class="v-swatch" style={{ background: c.hex }} title={`${c.hex} · ${c.count} uses`} onClick={() => env.copy(c.hex, `${c.hex} copied`)}>
            <span>{c.hex}</span>
          </button>
        ))}
      </div>
      <div class="v-actions">
        <button class="v-btn primary" onClick={() => env.copy(`:root {\n${top.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n')}\n}`, 'CSS variables copied')}>Copy as CSS variables</button>
        <button class="v-btn" onClick={() => env.copy(`colors: {\n${top.map((c, i) => `  'brand-${i + 1}': '${c.hex}',`).join('\n')}\n}`, 'Tailwind colors copied')}>Copy as Tailwind</button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- images */

const fileName = (u: string) => `prodev/${(u.split('/').pop() ?? 'image').split('?')[0].slice(0, 80) || 'image'}`;

function ImagesView({ data, env }: ViewProps<ImagesData>) {
  if (!data) return null;
  if (!data.images.length) return <Empty icon={I.search}>No images found on this page.</Empty>;
  return (
    <>
      <div class="v-actions top">
        <button class="v-btn primary" onClick={() => data.images.forEach((u) => env.download(u, fileName(u)))}><Icon d={I.download} size={14} />Download all ({data.images.length})</button>
        <button class="v-btn" onClick={() => env.copy(data.images.join('\n'), 'Image URLs copied')}>Copy URLs</button>
      </div>
      <div class="v-images">
        {data.images.map((u) => (
          <button key={u} class="v-img" style={{ backgroundImage: `url("${u.replace(/"/g, '%22')}")` }} title="Download" onClick={() => env.download(u, fileName(u))} />
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- color picker */

type Dropper = new () => { open(): Promise<{ sRGBHex: string }> };

function PickerView({ data, env }: ViewProps<PickerData>) {
  const colors = data?.colors ?? [];
  const cur = colors[0];
  const f = cur ? formats(cur) : null;
  const pick = async () => {
    const D = (window as unknown as { EyeDropper?: Dropper }).EyeDropper;
    if (!D) return env.toast('This browser does not support the EyeDropper API');
    try {
      const { sRGBHex } = await new D().open();
      env.act('add-color', sRGBHex);
      env.copy(sRGBHex.toUpperCase(), `${sRGBHex.toUpperCase()} copied`);
    } catch { /* cancelled */ }
  };
  const ratio = (bg: number[]) => f ? contrast(f.rgb, bg) : 0;
  const grade = (r: number) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'Fail');
  return (
    <>
      {f ? (
        <>
          <div class="v-big" style={{ background: cur, color: f.light ? '#111' : '#fff' }}>{f.HEX}</div>
          {(['HEX', 'RGB', 'HSL'] as const).map((k) => (
            <button key={k} class="v-fmt" onClick={() => env.copy(f[k], `${f[k]} copied`)}><span>{f[k]}</span><em>{k}</em></button>
          ))}
          <div class="v-contrast">
            {([['on white', [255, 255, 255]], ['on black', [0, 0, 0]]] as const).map(([l, bg]) => {
              const r = ratio([...bg]);
              return <div key={l}><span>Contrast {l}</span><b>{r.toFixed(2)}</b><span class={`v-grade ${r >= 4.5 ? 'ok' : r >= 3 ? 'mid' : 'bad'}`}>{grade(r)}</span></div>;
            })}
          </div>
        </>
      ) : (
        <Empty icon={I.eyedropper}>Pick any pixel on screen,<br />even outside the page.</Empty>
      )}
      <div class="v-actions"><button class="v-btn primary wide" onClick={pick}><Icon d={I.eyedropper} size={15} />Pick a color</button></div>
      {colors.length > 1 && (
        <div class="v-sec">
          <h4>History</h4>
          <div class="v-history">
            {colors.map((c) => <button key={c} style={{ background: c }} title={c} onClick={() => { env.act('add-color', c); env.copy(c.toUpperCase(), `${c.toUpperCase()} copied`); }} />)}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- screenshot */

function ScreenshotView({ data, env }: ViewProps<ScreenshotData>) {
  const opt = (id: string, title: string, desc: string, icon: string, pro = false) => (
    <button class="v-opt" onClick={() => (pro && !env.pro ? env.upsell('Full-page screenshots') : env.act(id))}>
      <span class="ic"><Icon d={icon} size={18} /></span>
      <span class="tx"><b>{title}</b><small>{desc}</small></span>
      {pro && !env.pro && <span class="v-pill pro">PRO</span>}
    </button>
  );
  return (
    <>
      {data?.picking && <div class="v-banner">Click any element on the page to capture it…</div>}
      <div class="v-opts">
        {opt('visible', 'Visible area', 'What you can see right now', I.monitor)}
        {opt('element', 'Select an element', 'Click any element to capture just that', I.cursor)}
        {opt('full', 'Full page', 'The entire scrollable page, stitched', 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4', true)}
      </div>
      <p class="v-note">Saved as PNG to your Downloads/prodev folder.</p>
    </>
  );
}

/* ---------------------------------------------------------------- fonts changer */

function FontsChangerView({ data, env }: ViewProps<FontsChangerData>) {
  const [q, setQ] = useState('');
  const fonts = useMemo(() => (data?.fonts ?? []).filter((f) => f.toLowerCase().includes(q.toLowerCase())), [data, q]);
  if (!data) return null;
  return (
    <>
      <input class="v-search" placeholder="Search, or type any Google Font + Enter" value={q} spellcheck={false}
        onInput={(e) => setQ(e.currentTarget.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) env.act('apply', fonts[0] ?? q.trim()); }} />
      <div class="v-fontlist">
        {fonts.map((f) => (
          <button key={f} class={`v-fontopt${data.current === f ? ' on' : ''}`} onClick={() => env.act('apply', f)}>
            <span>{f}</span>{data.current === f && <Icon d={I.check} size={14} />}
          </button>
        ))}
        {!fonts.length && <p class="v-note">Press Enter to load “{q}” from Google Fonts.</p>}
      </div>
      {data.current && <div class="v-actions"><button class="v-btn" onClick={() => env.act('reset')}><Icon d={I.refresh} size={14} />Restore original fonts</button></div>}
    </>
  );
}

/* ---------------------------------------------------------------- delete */

function DeleteView({ data, env }: ViewProps<DeleteData>) {
  const n = data?.count ?? 0;
  return (
    <>
      <div class="v-stat"><b>{n}</b><span>{n === 1 ? 'element removed' : 'elements removed'}</span></div>
      <div class="v-actions">
        <button class="v-btn primary" disabled={!n} onClick={() => env.act('undo')}><Icon d={I.undo} size={14} />Undo last</button>
        <button class="v-btn" disabled={!n} onClick={() => env.act('restore')}>Restore all</button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- export */

function ExportView({ data, env }: ViewProps<ExportData>) {
  if (!data?.html) return <Empty icon={I.cursor}>Click any element on the page to export it as standalone HTML + CSS.</Empty>;
  const kb = (data.html.length / 1024).toFixed(1);
  return (
    <>
      <div class="v-head"><span class="v-chip">{data.label}</span><span class="v-dim">{kb} KB · copied</span></div>
      <pre class="v-code">{data.html.slice(0, 6000)}{data.html.length > 6000 ? '\n…' : ''}</pre>
      <div class="v-actions">
        <button class="v-btn primary" onClick={() => env.copy(data.html!, 'HTML copied')}><Icon d={I.copy} size={14} />Copy HTML</button>
        <button class="v-btn" onClick={() => env.download(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><meta charset="utf-8">\n${data.html}`)}`, `prodev/${data.label?.replace(/[^\w.-]+/g, '-') || 'element'}.html`)}>
          <Icon d={I.download} size={14} />Download .html
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- registry */

export const VIEWS: Record<string, ComponentType<ViewProps<never>>> = {
  inspector: InspectorView,
  'fonts-list': FontsView,
  'color-palette': PaletteView,
  'extract-images': ImagesView,
  'color-picker': PickerView,
  screenshot: ScreenshotView,
  'fonts-changer': FontsChangerView,
  'delete-element': DeleteView,
  'export-element': ExportView,
} as Record<string, ComponentType<ViewProps<never>>>;

/** Shown in the side panel for tools that work purely on the page (ruler, outliner, …). */
export function GenericView({ toolId }: { toolId: string }) {
  const t = toolById(toolId);
  if (!t) return null;
  return (
    <div class="v-generic">
      <span class="v-generic-ic"><Icon d={t.icon} size={26} /></span>
      <b>{t.hint}</b>
      <p>{t.description}</p>
      <p class="v-note">Changes only affect your view and reset when you reload. Press <kbd>Esc</kbd> to finish.</p>
    </div>
  );
}

export function ToolView({ toolId, data, env }: { toolId: string; data: unknown; env: Env }) {
  const V = VIEWS[toolId];
  return V ? <V data={data as never} env={env} /> : <GenericView toolId={toolId} />;
}
