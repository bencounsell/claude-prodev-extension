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
            <li><b>Pin ProDev</b><span>Click the puzzle icon in your toolbar and pin ProDev. Clicking it opens ProDev in Chrome's side panel.</span></li>
            <li><b>Open any website</b><span>Pick a tool from the side panel, or press <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>K</kbd> for the command palette.</span></li>
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
        <h2>Where tools appear</h2>
        <p>The side panel keeps the page uncovered and remembers your work as you browse. Floating mode keeps the full page width, which is handy when you need to check desktop breakpoints.</p>
        <div class="modes" role="radiogroup" aria-label="Panel location">
          {([['sidepanel', 'Side panel', 'Recommended · docks beside the page', 'M4 4h16v16H4zM14 4v16'], ['floating', 'Floating', 'Panels float over the page', 'M4 4h16v16H4zM13 7h4v4h-4z']] as const).map(([v, label, sub, d]) => (
            <button key={v} role="radio" aria-checked={settings?.panelMode === v} class={`mode${settings?.panelMode === v ? ' on' : ''}`}
              onClick={async () => setLocal(await setSettings({ panelMode: v }))}>
              <Icon d={d} size={22} /><b>{label}</b><span>{sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section class="card">
        <h2>Send to AI</h2>
        <p>Where Send to AI hands off your prompts. ProDev never sends anything itself: it opens your AI app with the prompt ready, or puts it on your clipboard.</p>
        <div class="seg" role="radiogroup" aria-label="AI app">
          {([['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['gemini', 'Gemini'], ['copy', 'Copy only']] as const).map(([v, label]) => (
            <button key={v} role="radio" aria-checked={settings?.aiDestination === v} class={settings?.aiDestination === v ? 'on' : ''}
              onClick={async () => setLocal(await setSettings({ aiDestination: v }))}>{label}</button>
          ))}
        </div>
        <div class="ai-apps">
          {([['claudeApp', 'Open Claude in'], ['chatgptApp', 'Open ChatGPT in']] as const).map(([key, label]) => (
            <div class="row between" key={key}>
              <span>{label}</span>
              <div class="seg" role="radiogroup" aria-label={label}>
                {([['web', 'Browser'], ['desktop', 'Desktop app']] as const).map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={settings?.[key] === v} class={settings?.[key] === v ? 'on' : ''}
                    onClick={async () => setLocal(await setSettings({ [key]: v }))}>{l}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p class="hint">The Claude desktop app opens with your prompt filled in. The ChatGPT desktop app and Gemini open a new chat, with the prompt on your clipboard to paste.</p>
      </section>

      <section class="card">
        <h2>Appearance</h2>
        <p>Theme for the side panel, popup and settings. In-page tools always use a dark glass style for contrast.</p>
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
        <p class="last">ProDev runs entirely in your browser. No analytics, no tracking, and page content never leaves your device. It only goes online to check a Pro licence key, or to load a Google Font when you preview one with Fonts Changer.</p>
      </section>
    </div>
  );
}
render(<App />, document.getElementById('app')!);
