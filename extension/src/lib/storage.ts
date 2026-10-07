export interface Settings {
  theme: 'system' | 'light' | 'dark';
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', onboarded: false };

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ settings: next });
  return next;
}
