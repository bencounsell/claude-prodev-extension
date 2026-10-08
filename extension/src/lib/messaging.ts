/** Where tool panels render: Chrome's side panel, or floating inside the page. */
export type Mode = 'sidepanel' | 'floating';

export interface Viewport { w: number; h: number }

export type Msg =
  | { type: 'toggle-tool'; toolId: string; tabId?: number; mode?: Mode }
  | { type: 'ensure'; tabId: number; mode?: Mode }
  | { type: 'config'; pro: boolean; mode: Mode }
  | { type: 'set-mode'; mode: Mode }
  | { type: 'deactivate-all' }
  | { type: 'open-palette' }
  | { type: 'get-state' }
  | { type: 'tool-state'; toolId: string | null; data: unknown }
  | { type: 'tool-action'; action: string; payload?: unknown }
  | { type: 'viewport'; viewport: Viewport }
  | { type: 'upsell'; feature: string }
  | { type: 'capture-visible' }
  | { type: 'capture-full-page'; width: number; height: number; dpr: number; viewportHeight: number; shots: { y: number; url: string }[] }
  | { type: 'download'; url: string; filename: string }
  | { type: 'open-url'; url: string; tabId?: number }
  | { type: 'open-upgrade' };

export interface PageState {
  active: string | null;
  pro: boolean;
  mode: Mode;
  data: unknown;
  viewport: Viewport;
}

export interface EnsureResult { ok: boolean; error?: string; restricted?: boolean }

export const sendToTab = <T = unknown>(tabId: number, msg: Msg): Promise<T> =>
  chrome.tabs.sendMessage(tabId, msg) as Promise<T>;

export const sendToBackground = <T = unknown>(msg: Msg): Promise<T> =>
  chrome.runtime.sendMessage(msg) as Promise<T>;

/** Fire-and-forget broadcast to extension pages (side panel); no receiver is fine. */
export const broadcast = (msg: Msg) => { chrome.runtime.sendMessage(msg).catch(() => {}); };
