import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { activate, deactivate, isPro, CONFIG } from '../lib/licence';
import { getSettings, setSettings, type Settings } from '../lib/storage';
import { TOOLS } from '../lib/tools';

const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d={d} /></svg>
);
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
const welcome = new URLSearchParams(location.search).has('welcome');

const applyTheme = (t: Settings['theme']) => {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
};

function App() {
  const [pro, setPro] = useState(false);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setLocal] = useState<Settings | null>(null);
  const [cmds, setCmds] = useState<chrome.commands.Command[]>([]);

  const refresh = async () => setPro(await isPro());
  useEffect(() => {
    void refresh();
    void getSettings().then((s) => { setLocal(s); applyTheme(s.theme); });
    void chrome.commands.getAll().then(setCmds);
  }, []);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    const r = await activate(key);
    setMsg(r.ok ? { ok: true, text: 'Welcome to Pro! Every tool is now unlocked.' } : { ok: false, text: r.error ?? 'Activation failed' });
    if (r.ok) { setKey(''); await refresh(); }
    setBusy(false);
  };

  return (
    <div class="wrap">
      <header class="top">
        <div class="logo lg"><Icon d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" size={20} /></div>
        <div class="brand"><h1>ProDev</h1><span>Settings · v{chrome.runtime.getManifest().version}</span></div>
        <span class={`badge ${pro ? '' : 'free'}`}>{pro ? 'PRO' : 'FREE'}</span>
      </header>

      {welcome && (
        <section class="card hero">
          <h2>Welcome to ProDev 👋</h2>
          <p>Inspect, edit and capture any website in seconds. Here's how to get going:</p>
          <ol class="steps">
            <li><b>Pin ProDev</b><span>Click the puzzle icon in your toolbar and pin ProDev for one-click access.</span></li>
            <li><b>Open any website</b><span>Click the ProDev icon and choose a tool, or press <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>K</kbd> for the command palette.</span></li>
            <li><b>Press Esc to exit</b><span>Every tool closes with Esc and page edits reset when you reload.</span></li>
          </ol>
        </section>
      )}

      <section class={`card ${pro ? '' : 'plan'}`}>
        {pro ? (
          <>
            <div class="row between"><div><h2>ProDev Pro is active</h2><p>Thanks for supporting independent software. Every tool is unlocked on this browser.</p></div>
              <span class="seal"><Icon d={CHECK} size={22} /></span></div>
            <button class="btn ghost" onClick={async () => { await deactivate(); setMsg(null); await refresh(); }}>Deactivate this browser</button>
          </>
        ) : (
          <>
            <div class="row between">
              <div><h2>Upgrade to Pro</h2><p>One payment. Every tool. Free updates, forever.</p></div>
              <a class="btn" href={CONFIG.checkoutUrl} target="_blank" rel="noopener">Buy Pro</a>
            </div>
            <ul class="perks">
              {['Live CSS editing', 'Full-page screenshots', 'Fonts changer', 'Color palette export', 'Move & export elements', 'Bulk image download'].map((p) => (
                <li key={p}><Icon d={CHECK} size={14} />{p}</li>
              ))}
            </ul>
            <form class="row" onSubmit={submit}>
              <input class="input" placeholder="Paste your licence key" value={key} onInput={(e) => setKey((e.target as HTMLInputElement).value)} aria-label="Licence key" spellcheck={false} />
              <button class="btn" disabled={busy || !key.trim()}>{busy ? 'Activating…' : 'Activate'}</button>
            </form>
          </>
        )}
        {msg && <div class={`msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
      </section>

      <section class="card">
        <h2>Appearance</h2>
        <p>Theme for the popup and settings page. In-page tools always use a dark glass style for contrast.</p>
        <div class="seg" role="radiogroup" aria-label="Theme">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} role="radio" aria-checked={settings?.theme === t} class={settings?.theme === t ? 'on' : ''}
              onClick={async () => { setLocal(await setSettings({ theme: t })); applyTheme(t); }}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section class="card">
        <div class="row between">
          <div><h2>Keyboard shortcuts</h2><p>Work faster without touching the mouse.</p></div>
          <button class="btn ghost" onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}>Customise</button>
        </div>
        <div class="kbds">
          {cmds.map((c) => (
            <div class="kbdrow" key={c.name}>
              <span>{c.name === '_execute_action' ? 'Open ProDev' : c.description}</span>
              <span>{c.shortcut ? c.shortcut.split('+').map((k) => <kbd key={k}>{k}</kbd>) : <em>Not set</em>}</span>
            </div>
          ))}
          <div class="kbdrow"><span>Exit the active tool</span><span><kbd>Esc</kbd></span></div>
        </div>
      </section>

      <section class="card">
        <h2>Included tools</h2>
        <div class="tools">
          {TOOLS.map((t) => (
            <div class="tl" key={t.id}>
              <span class="ic"><Icon d={t.icon} size={16} /></span>
              <span>{t.name}</span>
              {t.tier === 'pro' && <span class="badge sm">PRO</span>}
            </div>
          ))}
        </div>
      </section>

      <section class="card">
        <h2>Privacy</h2>
        <p class="last">ProDev runs entirely in your browser. No analytics, no tracking, and page content never leaves your device. The only network request is to the licence server when you activate or re-validate a key.</p>
      </section>
    </div>
  );
}
render(<App />, document.getElementById('app')!);
