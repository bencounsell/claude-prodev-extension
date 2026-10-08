import { describe, it, expect } from 'vitest';
import { rgbToHex } from '../extension/src/content/tool';
import { TOOLS, toolById } from '../extension/src/lib/tools';

describe('rgbToHex', () => {
  it('converts rgb and rgba', () => {
    expect(rgbToHex('rgb(221, 51, 51)')).toBe('#dd3333');
    expect(rgbToHex('rgba(0, 0, 255, 0.5)')).toBe('#0000ff');
  });
  it('ignores fully transparent', () => {
    expect(rgbToHex('rgba(0, 0, 0, 0)')).toBeNull();
  });
});

describe('tool catalogue', () => {
  it('has 15 uniquely-id\'d tools with a free/pro split', () => {
    expect(TOOLS).toHaveLength(15);
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(15);
    expect(TOOLS.filter((t) => t.tier === 'free').length).toBeGreaterThan(5);
    expect(toolById('screenshot')?.name).toBe('Take Screenshot');
  });
});
