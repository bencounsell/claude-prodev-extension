import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { TOOLS } from '../lib/tools';
import { CONFIG, isPro } from '../lib/licence';
import { getSettings } from '../lib/storage';

function App() {
  const [q, setQ] = useState('');
  const [pro, setPro] = useState(false);
  useEffect(() => {
    void isPro().then(setPro);
    void getSettings().then((s) => s.theme !== 'system' && (document.documentElement.dataset.theme = s.theme));
  }, []);
  const list = useMemo(() => TOOLS.filter((t) => (t.name + t.description).toLowerCase().includes(q.toLowerCase())), [q]);

  const run = async (id: string) => {
    await chrome.runtime.sendMessage({ type: 'toggle-tool', toolId: id });
    window.close();
  };

  return (
    <>
      <div class="head">
        <div class="logo" />
        <h1>ProDev</h1>
        <span class={`badge ${pro ? '' : 'free'}`}>{pro ? 'PRO' : 'FREE'}</span>
      </div>
      <input class="search" placeholder="Search tools…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} autofocus aria-label="Search tools" />
      {!pro && (
        <div class="cta">
          <span>Unlock all 14 tools</span>
          <button onClick={() => chrome.tabs.create({ url: CONFIG.checkoutUrl })}>Upgrade</button>
        </div>
      )}
      <div class="grid">
        {list.map((t) => (
          <button class="tool" key={t.id} onClick={() => run(t.id)} title={t.description}>
            <span class="top">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
              {t.tier === 'pro' && !pro && <span class="badge">PRO</span>}
            </span>
            <b>{t.name}</b>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
      <div class="foot">
        <span>Esc closes the active tool</span>
        <button class="link" onClick={() => chrome.runtime.openOptionsPage()}>Settings</button>
      </div>
    </>
  );
}
render(<App />, document.getElementById('app')!);
