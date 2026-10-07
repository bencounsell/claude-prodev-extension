import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { GROUPS, TOOLS, type ToolMeta } from '../lib/tools';
import { Icon, I } from './Icon';

interface Props {
  pro: boolean;
  onRun(tool: ToolMeta): void;
  onUpgrade(): void;
  /** Tool currently active on the page, highlighted in the grid. */
  active?: string | null;
}

/** Searchable, keyboard-navigable tool grid shared by the popup and the side panel. */
export function Launcher({ pro, onRun, onUpgrade, active }: Props) {
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void chrome.storage.local.get('recent').then((r) => setRecent((r.recent as string[]) ?? []));
  }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return s ? TOOLS.filter((t) => `${t.name} ${t.description} ${t.group}`.toLowerCase().includes(s)) : TOOLS;
  }, [q]);
  // Flat order used for keyboard navigation: recents first (only when not searching), then groups.
  const recents = q ? [] : (recent.map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean) as ToolMeta[]);
  const order = q ? filtered : GROUPS.flatMap((g) => filtered.filter((t) => t.group === g));
  const nav = [...recents, ...order];

  useEffect(() => setSel(0), [q]);
  useEffect(() => { listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const run = (t: ToolMeta) => {
    const next = [t.id, ...recent.filter((x) => x !== t.id)].slice(0, 4);
    setRecent(next);
    void chrome.storage.local.set({ recent: next });
    onRun(t);
  };

  const onKey = (e: KeyboardEvent) => {
    const cols = 2;
    if (e.key === 'ArrowDown') { setSel((s) => Math.min(s + (s < recents.length ? 1 : cols), nav.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setSel((s) => Math.max(s - (s <= recents.length ? 1 : cols), 0)); e.preventDefault(); }
    else if (e.key === 'ArrowRight') setSel((s) => Math.min(s + 1, nav.length - 1));
    else if (e.key === 'ArrowLeft') setSel((s) => Math.max(s - 1, 0));
    else if (e.key === 'Enter' && nav[sel]) run(nav[sel]);
  };

  let idx = 0;
  const card = (t: ToolMeta) => {
    const i = idx++;
    const locked = t.tier === 'pro' && !pro;
    return (
      <button key={t.id} class={`tool${i === sel ? ' sel' : ''}${locked ? ' locked' : ''}${active === t.id ? ' on' : ''}`}
        onClick={() => run(t)} onMouseEnter={() => setSel(i)} title={t.description}>
        <span class="ic"><Icon d={t.icon} /></span>
        <span class="tx"><b>{t.name}</b><small>{t.description}</small></span>
        {locked && <span class="lk" title="Pro"><Icon d={I.lock} size={12} /></span>}
        {active === t.id && <span class="live" title="Active on this page" />}
      </button>
    );
  };

  return (
    <div class="launcher" onKeyDown={onKey}>
      <label class="search">
        <Icon d={I.search} size={16} />
        <input placeholder="Search 14 tools…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} autofocus aria-label="Search tools" spellcheck={false} />
        <kbd>↵</kbd>
      </label>
      <div class="scroll" ref={listRef}>
        {!pro && !q && (
          <div class="cta">
            <div><b>Unlock ProDev Pro</b><span>All 14 tools · one-time payment</span></div>
            <button onClick={onUpgrade}>Upgrade</button>
          </div>
        )}
        {recents.length > 0 && (
          <section>
            <h2>Recent</h2>
            <div class="chips">
              {recents.map((t) => {
                const i = idx++;
                return <button key={t.id} class={`chip${i === sel ? ' sel' : ''}`} onClick={() => run(t)} onMouseEnter={() => setSel(i)}><Icon d={t.icon} size={14} />{t.name}</button>;
              })}
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
    </div>
  );
}
