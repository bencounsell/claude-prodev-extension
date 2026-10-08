/** Data each tool publishes for its view. Content scripts produce it; views render it. */
export interface InspectorData {
  label: string; path: string; w: number; h: number; locked: boolean; edited: boolean; css: string;
  box: { margin: string[]; border: string[]; padding: string[] };
  sections: { title: string; rows: { prop: string; value: string; hex: string | null }[] }[];
}
export interface FontsData { fonts: { family: string; count: number; weights: string[]; sizes: string[] }[] }
export interface PaletteData { colors: { hex: string; count: number }[] }
export interface ImagesData { images: string[] }
export interface PickerData { colors: string[] }
export interface ScreenshotData { picking: boolean }
export interface FontsChangerData { current: string | null; fonts: string[] }
export interface DeleteData { count: number }
export interface ExportData { html: string | null; label: string | null }

/** What a view can do, implemented differently by the side panel and the in-page floating panel. */
export interface Env {
  pro: boolean;
  surface: 'sidepanel' | 'floating';
  act(action: string, payload?: unknown): void;
  /** Resolves once the text is on the clipboard (so callers can open another app afterwards). */
  copy(text: string, message?: string): void | Promise<void>;
  toast(message: string): void;
  upsell(feature: string): void;
  download(url: string, filename: string): void;
  /** Puts a PNG (data URL) on the clipboard. */
  copyImage(dataUrl: string, message?: string): void;
  /** Opens a web page in a new tab, or an app link (claude://) via the OS. */
  openUrl(url: string): void;
}

/** Send to AI: what the content script measured for the chosen target. */
export interface SendToAiData {
  picking: boolean;
  /** Element handed over from the inspector, ready to use. */
  ready: boolean;
  context: import('../lib/ai/prompts').PromptContext | null;
  screenshot: string | null;
}
