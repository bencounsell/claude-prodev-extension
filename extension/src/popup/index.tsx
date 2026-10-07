import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { CONFIG, isPro } from '../lib/licence';
import { getSettings, setSettings } from '../lib/storage';
import type { Msg } from '../lib/messaging';
import { Launcher } from '../views/Launcher';
import { Icon, I } from '../views/Icon';

const isMac = navigator.platform.toUpperCase().includes('MAC');

/** Popup is used in floating mode; side panel mode opens the side panel from the toolbar icon instead. */
function App() {
  const [pro, setPro] = useState(false);
  const [tabId, setTabId] = useState<number>();

  useEffect(() => {
    void isPro().then(setPro);
    void getSettings().then((s) => s.theme !== 'system' && (document.documentElement.dataset.theme = s.theme));
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => setTabId(t?.id));
  }, []);

  const toSidePanel = () => {
    // sidePanel.open must run synchronously inside the click to count as a user gesture.
    if (tabId) chrome.sidePanel.open({ tabId }).catch(() => {});
    void setSettings({ panelMode: 'sidepanel' }).then(() => window.close());
  };

  return (
    <div class="popup-in">
      <header class="head">
        <div class="logo"><Icon d={I.logo} size={16} /></div>
        <div class="brand"><h1>ProDev</h1><span>Web developer toolkit</span></div>
        <span class={`badge ${pro ? '' : 'free'}`}>{pro ? 'PRO' : 'FREE'}</span>
        <button class="iconbtn" aria-label="Open in side panel" title="Open in side panel" onClick={toSidePanel}><Icon d={I.panel} size={17} /></button>
        <button class="iconbtn" aria-label="Settings" title="Settings" onClick={() => chrome.runtime.openOptionsPage()}><Icon d={I.gear} size={17} /></button>
      </header>
      <Launcher
        pro={pro}
        onUpgrade={() => void chrome.tabs.create({ url: CONFIG.checkoutUrl })}
        onRun={async (t) => {
          await chrome.runtime.sendMessage({ type: 'toggle-tool', toolId: t.id, tabId } satisfies Msg);
          window.close();
        }}
      />
      <footer class="foot">
        <span><kbd>{isMac ? '⌥' : 'Alt'}</kbd><kbd>⇧</kbd><kbd>K</kbd> command palette</span>
        <span><kbd>Esc</kbd> exit tool</span>
      </footer>
    </div>
  );
}
render(<App />, document.getElementById('app')!);
