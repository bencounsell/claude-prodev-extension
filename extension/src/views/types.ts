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
  copy(text: string, message?: string): void;
  toast(message: string): void;
  upsell(feature: string): void;
  download(url: string, filename: string): void;
}
