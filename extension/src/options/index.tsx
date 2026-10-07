import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { activate, deactivate, getRecord, isPro, CONFIG } from '../lib/licence';
import { getSettings, setSettings, type Settings } from '../lib/storage';

function App() {
  const [pro, setPro] = useState(false);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setLocal] = useState<Settings | null>(null);

  const refresh = async () => setPro(await isPro());
  useEffect(() => {
    void refresh();
    void getSettings().then((s) => { setLocal(s); applyTheme(s.theme); });
  }, []);

  const applyTheme = (t: Settings['theme']) => {
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };

  const submit = async () => {
    setBusy(true);
    const r = await activate(key);
    setMsg(r.ok ? { ok: true, text: 'Thank you! Pro is now unlocked.' } : { ok: false, text: r.error ?? 'Activation failed' });
    if (r.ok) { setKey(''); await refresh(); }
    setBusy(false);
  };

  return (
    <div class="wrap">
      <div class="head" style="padding:0"><div class="logo" /><h1 style="font-size:22px">ProDev Settings</h1><span class={`badge ${pro ? '' : 'free'}`}>{pro ? 'PRO' : 'FREE'}</span></div>

      <section class="card">
        <h2>Licence</h2>
        {pro ? (
          <>
            <p>Pro is active on this browser. Thanks for supporting ProDev!</p>
            <button class="btn ghost" onClick={async () => { await deactivate(); setMsg(null); await refresh(); void getRecord(); }}>Deactivate this device</button>
          </>
        ) : (
          <>
            <p>Enter your licence key to unlock every tool. One-time purchase, no subscription.</p>
            <div class="row">
              <input class="input" placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" value={key} onInput={(e) => setKey((e.target as HTMLInputElement).value)} aria-label="Licence key" />
              <button class="btn" disabled={busy || !key.trim()} onClick={submit}>{busy ? 'Checking…' : 'Activate'}</button>
            </div>
            <p style="margin-top:12px"><button class="link" onClick={() => chrome.tabs.create({ url: CONFIG.checkoutUrl })}>Get a licence →</button></p>
          </>
        )}
        {msg && <div class={`msg ${msg.ok ? 'ok' : 'err'}`} role="status">{msg.text}</div>}
      </section>

      <section class="card">
        <h2>Appearance</h2>
        <p>Choose how ProDev's popup and settings look.</p>
        <div class="row">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} class={`btn ${settings?.theme === t ? '' : 'ghost'}`} onClick={async () => { setLocal(await setSettings({ theme: t })); applyTheme(t); }}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section class="card">
        <h2>Keyboard shortcuts</h2>
        <p><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> open ProDev · <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> inspector · <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> color picker</p>
        <button class="btn ghost" onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}>Customise shortcuts</button>
      </section>

      <section class="card">
        <h2>Privacy</h2>
        <p style="margin:0">ProDev runs entirely in your browser. It collects no analytics, never sends page content anywhere, and only contacts the licence server when you activate or re-validate a key.</p>
      </section>
    </div>
  );
}
render(<App />, document.getElementById('app')!);
