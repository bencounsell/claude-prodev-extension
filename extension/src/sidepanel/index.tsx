import { render } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { EnsureResult, Msg, PageState, Viewport } from '../lib/messaging';
import { CONFIG, isPro } from '../lib/licence';
import { getSettings, setSettings, type Settings } from '../lib/storage';
import { TOOLS, toolById, type ToolMeta } from '../lib/tools';
import { Launcher } from '../views/Launcher';
import { ToolView } from '../views/ToolViews';
import { Icon, I } from '../views/Icon';
import type { Env } from '../views/types';
import viewsCss from '../views/views.css';

document.head.append(Object.assign(document.createElement('style'), { textContent: viewsCss }));

/** `?tab=<id>` pins the panel to one tab (used by tests and screenshot tooling). */
const pinnedTab = Number(new URLSearchParams(location.search).get('tab')) || null;

const applyTheme = (t: Settings['theme']) => {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
};

/** Tailwind's default breakpoints: the most common vocabulary for "which layout am I seeing". */
const breakpoint = (w: number) => (w >= 1536 ? '2xl' : w >= 1280 ? 'xl' : w >= 1024 ? 'lg' : w >= 768 ? 'md' : w >= 640 ? 'sm' : 'xs');

/** Keeps a port open while the panel is visible so the background knows to route tool views here. */
function usePanelPort() {
  useEffect(() => {
    let port: chrome.runtime.Port | null = null;
    let closed = false;
    const connect = () => {
      port = chrome.runtime.connect({ name: 'sidepanel' });
      // A pinned panel (tests, recordings) belongs to its tab's window, like a real side panel does.
      const win = pinnedTab ? chrome.tabs.get(pinnedTab).then((t) => t.windowId) : chrome.windows.getCurrent().then((w) => w.id);
      void win.then((windowId) => port?.postMessage({ windowId }));
      // The service worker may be recycled; reconnect so it keeps knowing the panel is open.
      port.onDisconnect.addListener(() => { if (!closed) setTimeout(connect, 300); });
    };
    connect();
    return () => { closed = true; port?.disconnect(); };
  }, []);
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>();
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  return [msg, show] as const;
}

function Upsell({ feature, onClose }: { feature: string; onClose(): void }) {
  return (
    <div class="sp-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sp-upsell" role="dialog" aria-modal="true" aria-label={`${feature} is a Pro feature`}>
        <div class="lock"><Icon d={I.lock} size={24} /></div>
        <h2>{feature} is a Pro feature</h2>
        <p>Unlock every tool with a one-time purchase. No subscription, free updates.</p>
        <ul>
          {[`All ${TOOLS.length} tools, including full-page capture`, 'Live CSS editing, export, palette & more', 'One payment, use on all your browsers'].map((s) => (
            <li key={s}><Icon d={I.check} size={14} />{s}</li>
          ))}
        </ul>
        <div class="row">
          <button class="v-btn" onClick={onClose}>Maybe later</button>
          <button class="v-btn primary" autofocus onClick={() => { void chrome.tabs.create({ url: CONFIG.checkoutUrl }); onClose(); }}>Unlock Pro</button>
        </div>
      </div>
    </div>
  );
}

function AccessCard({ res, onRetry }: { res: EnsureResult; onRetry(): void }) {
  if (res.restricted) {
    return (
      <div class="sp-access">
        <span class="ic"><Icon d={I.shield} size={24} /></span>
        <h2>Open a website to get started</h2>
        <p>Browsers don't let extensions run on internal pages like this one, the Chrome Web Store, or new tab pages.</p>
      </div>
    );
  }
  const grant = async () => {
    if (await chrome.permissions.request({ origins: ['<all_urls>'] })) onRetry();
  };
  return (
    <div class="sp-access">
      <span class="ic"><Icon d={I.unlock} size={24} /></span>
      <h2>Allow ProDev on this page</h2>
      <p>ProDev only touches pages you choose. To keep working as you browse with the side panel open, allow it on all sites. It still runs nothing until you pick a tool.</p>
      <button class="v-btn primary wide" onClick={grant}>Allow on all sites</button>
      <p class="v-note">Or click the ProDev icon in your toolbar to enable it for just this tab.</p>
      <button class="sp-link" onClick={onRetry}>Try again</button>
    </div>
  );
}

function App() {
  const [pro, setPro] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);
  const [state, setState] = useState<{ active: string | null; data: unknown }>({ active: null, data: null });
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [access, setAccess] = useState<EnsureResult | null>(null);
  const [upsell, setUpsell] = useState<string | null>(null);
  const [toast, showToast] = useToast();
  const tabRef = useRef<number | null>(null);

  usePanelPort();

  const sync = useCallback(async () => {
    const id = pinnedTab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (!id) return;
    tabRef.current = id;
    setTabId(id);
    const res = (await chrome.runtime.sendMessage({ type: 'ensure', tabId: id, mode: 'sidepanel' } satisfies Msg)) as EnsureResult;
    setAccess(res);
    if (!res?.ok) { setState({ active: null, data: null }); setViewport(null); return; }
    const s = (await chrome.tabs.sendMessage(id, { type: 'get-state' } satisfies Msg)) as PageState;
    setState({ active: s.active, data: s.data });
    setViewport(s.viewport);
  }, []);

  useEffect(() => {
    void sync();
    void isPro().then(setPro);
    void getSettings().then((s) => applyTheme(s.theme));

    const onActivated = () => { if (!pinnedTab) void sync(); };
    const onUpdated = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id !== tabRef.current) return;
      if (info.status === 'loading') { setState({ active: null, data: null }); setViewport(null); }
      if (info.status === 'complete') void sync();
    };
    const onMsg = (m: Msg, sender: chrome.runtime.MessageSender) => {
      if (sender.tab?.id !== tabRef.current) return;
      if (m.type === 'tool-state') setState({ active: m.toolId, data: m.data });
      if (m.type === 'viewport') setViewport(m.viewport);
      if (m.type === 'upsell') setUpsell(m.feature);
    };
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.licence) void isPro().then(setPro);
      if (area === 'sync' && changes.settings) applyTheme((changes.settings.newValue as Settings).theme);
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.runtime.onMessage.addListener(onMsg);
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.runtime.onMessage.removeListener(onMsg);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, [sync]);

  const send = (msg: Msg) => (tabId ? chrome.tabs.sendMessage(tabId, msg).catch(() => sync()) : Promise.resolve());

  const run = async (t: ToolMeta) => {
    if (t.tier === 'pro' && !pro) return setUpsell(t.name);
    const res = (await chrome.runtime.sendMessage({ type: 'toggle-tool', toolId: t.id, tabId: tabId ?? undefined, mode: 'sidepanel' } satisfies Msg)) as EnsureResult;
    if (!res?.ok) setAccess(res);
  };

  const copy = async (text: string, message = 'Copied to clipboard') => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = Object.assign(document.createElement('textarea'), { value: text });
      document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    showToast(message);
  };

  const env: Env = {
    pro,
    surface: 'sidepanel',
    act: (action, payload) => void send({ type: 'tool-action', action, payload }),
    copy: (t, m) => copy(t, m),
    toast: showToast,
    upsell: setUpsell,
    download: (url, filename) => void chrome.runtime.sendMessage({ type: 'download', url, filename } satisfies Msg),
    copyImage: (dataUrl, m) => void (async () => {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        showToast(m ?? 'Screenshot copied');
      } catch { showToast('Couldn’t copy the image. Try again.'); }
    })(),
    openUrl: (url) => void chrome.runtime.sendMessage({ type: 'open-url', url, tabId: tabId ?? undefined } satisfies Msg),
  };

  const tool = state.active ? toolById(state.active) : null;

  const floating = async () => {
    await setSettings({ panelMode: 'floating' });
    window.close();
  };

  return (
    <div class="sp">
      <header class="sp-head">
        <div class="logo"><Icon d={I.logo} size={16} /></div>
        <div class="brand"><h1>ProDev</h1><span>Web developer toolkit</span></div>
        {viewport && (
          <span class="vp" title="Page viewport. The side panel narrows the page. Switch to floating mode to inspect at full width.">
            <Icon d={I.monitor} size={13} />{viewport.w}<i>×</i>{viewport.h}<b>{breakpoint(viewport.w)}</b>
          </span>
        )}
        <span class={`badge ${pro ? '' : 'free'}`}>{pro ? 'PRO' : 'FREE'}</span>
        <button class="iconbtn" aria-label="Settings" title="Settings" onClick={() => chrome.runtime.openOptionsPage()}><Icon d={I.gear} size={17} /></button>
      </header>

      {access && !access.ok ? (
        <AccessCard res={access} onRetry={() => void sync()} />
      ) : tool ? (
        <div class="sp-tool" key={tool.id}>
          <div class="sp-toolbar">
            <button class="iconbtn" aria-label="All tools" title="All tools" onClick={() => void send({ type: 'deactivate-all' })}><Icon d={I.back} size={18} /></button>
            <span class="ic"><Icon d={tool.icon} size={16} /></span>
            <div class="tt"><b>{tool.name}</b><small>{tool.hint}</small></div>
            <button class="v-btn primary" onClick={() => void send({ type: 'deactivate-all' })}>Done</button>
          </div>
          <div class="sp-body"><ToolView toolId={tool.id} data={state.data} env={env} /></div>
        </div>
      ) : (
        <Launcher pro={pro} onRun={(t) => void run(t)} onUpgrade={() => void chrome.tabs.create({ url: CONFIG.checkoutUrl })} />
      )}

      <footer class="foot">
        <span><kbd>Alt</kbd><kbd>⇧</kbd><kbd>K</kbd> palette · <kbd>Esc</kbd> exit</span>
        <button class="sp-link" onClick={() => void floating()} title="Show tools floating on the page instead, keeping the full page width">
          <Icon d={I.float} size={13} />Floating mode
        </button>
      </footer>

      {upsell && <Upsell feature={upsell} onClose={() => setUpsell(null)} />}
      <div class={`sp-toast${toast ? ' show' : ''}`} role="status"><Icon d={I.check} size={13} />{toast}</div>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
