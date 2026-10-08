import { render } from 'preact';
import { toolById } from '../lib/tools';
import type { Env } from '../views/types';
import { ToolView, VIEWS } from '../views/ToolViews';
import { panel } from './ui';

let shell: ReturnType<typeof panel> | null = null;
let shown: string | null = null;

/** Tools that only work on the page (ruler, outliner…) don't need a floating panel. */
export const hasView = (toolId: string) => toolId in VIEWS;

export function showFloating(toolId: string, data: unknown, env: Env, onClose: () => void) {
  if (shown !== toolId) {
    hideFloating();
    shell = panel(toolById(toolId)?.name ?? 'Hairline', onClose);
    shown = toolId;
  }
  render(<ToolView toolId={toolId} data={data} env={env} />, shell!.body);
}

export function hideFloating() {
  if (!shell) return;
  render(null, shell.body);
  shell.root.remove();
  shell = null;
  shown = null;
}
