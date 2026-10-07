import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { GROUPS, TOOLS, type ToolMeta } from '../lib/tools';
import { CONFIG, isPro } from '../lib/licence';
import { getSettings } from '../lib/storage';

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d={d} /></svg>
);
const LOCK = 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z';
const isMac = navigator.platform.toUpperCase().includes('MAC');

function App() {
  const [q, setQ] = useState('');
  const [pro, setPro] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void isPro().then(setPro);
    void getSettings().then((s) => s.theme !== 'system' && (document.documentElement.dataset.theme = s.theme));
    void chrome.storage.local.get('recent').then((r) => setRecent((r.recent as string[]) ?? []));
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return s ? TOOLS.filter((t) => `${t.name} ${t.description} ${t.group}`.toLowerCase().includes(s)) : TOOLS;
  }, [q]);
  // Flat order used for keyboard navigation: recents first (only when not searching), then groups.
  const recents = q ? [] : recent.map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean) as ToolMeta[];
  const order = q ? filtered : GROUPS.flatMap((g) => filtered.filter((t) => t.group === g));
  const nav = [...recents, ...order];

  useEffect(() => setSel(0), [q]);
  useEffect(() => { listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const run = async (t: ToolMeta) => {
    const next = [t.id, ...recent.filter((x) => x !== t.id)].slice(0, 4);
    await chrome.storage.local.set({ recent: next });
    await chrome.runtime.sendMessage({ type: 'toggle-tool', toolId: t.id });
    window.close();
  };

  const onKey = (e: KeyboardEvent) => {
    const cols = 2;
    if (e.key === 'ArrowDown') { setSel((s) => Math.min(s + (s < recents.length ? 1 : cols), nav.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setSel((s) => Math.max(s - (s <= recents.length ? 1 : cols), 0)); e.preventDefault(); }
    else if (e.key === 'ArrowRight') setSel((s) => Math.min(s + 1, nav.length - 1));
    else if (e.key === 'ArrowLeft') setSel((s) => Math.max(s - 1, 0));
    else if (e.key === 'Enter' && nav[sel]) void run(nav[sel]);
  };

  let idx = 0;
  const card = (t: ToolMeta) => {
    const i = idx++;
    const locked = t.tier === 'pro' && !pro;
    return (
      <button key={t.id} class={`tool${i === sel ? ' sel' : ''}${locked ? ' locked' : ''}`} onClick={() => run(t)} onMouseEnter={() => setSel(i)} title={t.description}>
        <span class="ic"><Icon d={t.icon} /></span>
        <span class="tx"><b>{t.name}</b><small>{t.description}</small></span>
        {locked && <span class="lk" title="Pro"><Icon d={LOCK} size={12} /></span>}
      </button>
    );
  };

  return (
    <div class="popup-in" onKeyDown={onKey}>
      <header class="head">
        <div class="logo"><Icon d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" size={16} /></div>
        <div class="brand"><h1>ProDev</h1><span>Web developer toolkit</span></div>
        <span class={`badge ${pro ? '' : 'free'}`}>{pro ? 'PRO' : 'FREE'}</span>
        <button class="iconbtn" aria-label="Settings" title="Settings" onClick={() => chrome.runtime.openOptionsPage()}>
          <Icon d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" size={17} />
        </button>
      </header>

      <label class="search">
        <Icon d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4" size={16} />
        <input placeholder="Search 14 tools…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} autofocus aria-label="Search tools" spellcheck={false} />
        <kbd>↵</kbd>
      </label>

      <div class="scroll" ref={listRef}>
        {!pro && !q && (
          <div class="cta">
            <div><b>Unlock ProDev Pro</b><span>All 14 tools · one-time payment</span></div>
            <button onClick={() => chrome.tabs.create({ url: CONFIG.checkoutUrl })}>Upgrade</button>
          </div>
        )}
        {recents.length > 0 && (
          <section>
            <h2>Recent</h2>
            <div class="chips">
              {recents.map((t) => { const i = idx++; return (
                <button key={t.id} class={`chip${i === sel ? ' sel' : ''}`} onClick={() => run(t)} onMouseEnter={() => setSel(i)}><Icon d={t.icon} size={14} />{t.name}</button>
              ); })}
            </div>
          </section>
        )}
        {q ? (
          <section><div class="grid">{filtered.map(card)}</div></section>
        ) : (
          GROUPS.map((g) => (
            <section key={g}>
              <h2>{g}</h2>
              <div class="grid">{filtered.filter((t) => t.group === g).map(card)}</div>
            </section>
          ))
        )}
        {q && filtered.length === 0 && <div class="none">No tools match “{q}”</div>}
      </div>

      <footer class="foot">
        <span><kbd>{isMac ? '⌥' : 'Alt'}</kbd><kbd>⇧</kbd><kbd>K</kbd> command palette</span>
        <span><kbd>Esc</kbd> exit tool</span>
      </footer>
    </div>
  );
}
render(<App />, document.getElementById('app')!);
