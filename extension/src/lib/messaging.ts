export type Msg =
  | { type: 'toggle-tool'; toolId: string }
  | { type: 'deactivate-all' }
  | { type: 'open-palette' }
  | { type: 'get-state' }
  | { type: 'set-pro'; pro: boolean }
  | { type: 'capture-visible' }
  | { type: 'capture-full-page'; width: number; height: number; dpr: number; viewportHeight: number; shots: { y: number; url: string }[] }
  | { type: 'download'; url: string; filename: string }
  | { type: 'open-upgrade' };

export interface PageState {
  active: string | null;
  pro: boolean;
}

export const sendToTab = <T = unknown>(tabId: number, msg: Msg): Promise<T> =>
  chrome.tabs.sendMessage(tabId, msg) as Promise<T>;

export const sendToBackground = <T = unknown>(msg: Msg): Promise<T> =>
  chrome.runtime.sendMessage(msg) as Promise<T>;
