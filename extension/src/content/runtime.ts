import type { Tool } from './tool';
import { palette, setActiveTool, toast, upsell } from './ui';
import { toolById } from '../lib/tools';

class Runtime {
  pro = false;
  active: Tool | null = null;
  tools = new Map<string, Tool>();
  colors: string[] = [];

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
    setActiveTool(id);
    try { await tool.activate(); } catch (e) { console.error('[ProDev]', e); toast('Something went wrong with this tool'); this.deactivate(); }
  }

  deactivate() {
    const t = this.active;
    this.active = null;
    t?.deactivate();
  }

  requirePro(feature: string): boolean {
    if (this.pro) return true;
    upsell(feature);
    return false;
  }

  openPalette() { this.deactivate(); palette(this.pro, (id) => void this.toggle(id)); }

  pushColor(c: string) { this.colors = [c, ...this.colors.filter((x) => x !== c)].slice(0, 20); }
}

export const runtime = new Runtime();
