export interface Settings {
  theme: 'system' | 'light' | 'dark';
  onboarded: boolean;
  /** Side panel (default) keeps the page uncovered; floating keeps full page width. */
  panelMode: 'sidepanel' | 'floating';
  /** Send to AI: where prompts go, and whether Claude/ChatGPT open in their desktop app or the browser. */
  aiDestination: 'claude' | 'chatgpt' | 'gemini' | 'copy';
  claudeApp: 'desktop' | 'web';
  chatgptApp: 'desktop' | 'web';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system', onboarded: false, panelMode: 'sidepanel', aiDestination: 'claude', claudeApp: 'web', chatgptApp: 'web',
};

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ settings: next });
  return next;
}
