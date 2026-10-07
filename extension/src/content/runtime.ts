import type { Tool } from './tool';
import { bar, copy, palette, setActiveTool, toast, upsell } from './ui';
import { hideFloating, hasView, showFloating } from './floating';
import { broadcast, sendToBackground, type Mode } from '../lib/messaging';
import { toolById } from '../lib/tools';
import type { Env } from '../views/types';

class Runtime {
  pro = false;
  mode: Mode = 'floating';
  active: Tool | null = null;
  tools = new Map<string, Tool>();
  colors: string[] = [];
  /** Latest data published by the active tool, rendered by its view. */
  data: unknown = null;
  private pill: HTMLElement | null = null;

  register(t: Tool) { this.tools.set(t.id, t); }

  async toggle(id: string) {
    const meta = toolById(id);
    const tool = this.tools.get(id);
    if (!meta || !tool) return;
    const wasActive = this.active?.id === id;
    this.deactivate();
    if (wasActive) return;
    if (meta.tier === 'pro' && !this.pro) { this.requirePro(meta.name); return; }
    this.active = tool;
    this.data = null;
    setActiveTool(id);
    this.pill = bar(`${meta.name} — ${meta.hint}`, [{ label: 'Done', primary: true, onClick: () => this.deactivate() }]);
    this.render();
    try { await tool.activate(); } catch (e) { console.error('[ProDev]', e); toast('Something went wrong with this tool'); this.deactivate(); }
  }

  deactivate() {
    const t = this.active;
    if (!t) return;
    this.active = null;
    this.data = null;
    t.deactivate();
    this.pill?.remove();
    this.pill = null;
    setActiveTool(null);
    this.render();
  }

  /** Called by tools whenever their view data changes. */
  publish(data: unknown) {
    this.data = data;
    this.render();
  }

  setMode(mode: Mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.render();
  }

  private render() {
    const id = this.active?.id ?? null;
    if (this.mode === 'floating' && id && hasView(id)) showFloating(id, this.data, this.env(), () => this.deactivate());
    else hideFloating();
    // The side panel mirrors the active tool. Skip the chatter when it isn't listening.
    if (this.mode === 'sidepanel' || !id) broadcast({ type: 'tool-state', toolId: id, data: this.data });
  }

  action(action: string, payload: unknown) {
    return this.active?.onAction?.(action, payload);
  }

  env(): Env {
    return {
      pro: this.pro,
      surface: 'floating',
      act: (a, p) => void this.action(a, p),
      copy: (t, m) => void copy(t, m),
      toast,
      upsell: (f) => void this.requirePro(f),
      download: (url, filename) => void sendToBackground({ type: 'download', url, filename }),
    };
  }

  requirePro(feature: string): boolean {
    if (this.pro) return true;
    if (this.mode === 'sidepanel') broadcast({ type: 'upsell', feature });
    else upsell(feature);
    return false;
  }

  openPalette() { this.deactivate(); palette(this.pro, (id) => void this.toggle(id)); }

  pushColor(c: string) { this.colors = [c, ...this.colors.filter((x) => x !== c)].slice(0, 20); }
}

export const runtime = new Runtime();
