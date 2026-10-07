import type { Tool } from '../tool';
import { copy } from '../ui';
import { runtime } from '../runtime';

type Dropper = new () => { open(): Promise<{ sRGBHex: string }> };
const publish = () => runtime.publish({ colors: runtime.colors });

export const colorPicker: Tool = {
  id: 'color-picker',
  async activate() {
    publish();
    // Launched by keyboard shortcut in floating mode the page has user activation, so open the
    // eyedropper immediately. Otherwise the view's "Pick a color" button provides the gesture.
    const D = (window as unknown as { EyeDropper?: Dropper }).EyeDropper;
    if (runtime.mode !== 'floating' || !D || !navigator.userActivation?.isActive) return;
    try {
      const { sRGBHex } = await new D().open();
      runtime.pushColor(sRGBHex);
      publish();
      await copy(sRGBHex.toUpperCase(), `${sRGBHex.toUpperCase()} copied`);
    } catch { /* cancelled */ }
  },
  deactivate() {},
  onAction(action, payload) {
    if (action === 'add-color') { runtime.pushColor(payload as string); publish(); }
  },
};
