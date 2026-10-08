// Renders the Hairline mark (see views/Icon.tsx `Logo`) to the PNG toolbar/store icons, with no dependencies:
// a graphite rounded tile, a bold selection corner and faint hairline guides, 4×4 supersampled.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };

const TILE = [17, 18, 20];
// Segments on the mark's 32-unit grid: [x1, y1, x2, y2, width, alpha].
const BOLD = [[10, 24, 10, 10], [10, 10, 24, 10]];
const FINE = [[24, 10, 24, 24], [24, 24, 10, 24], [10, 5, 10, 10], [5, 10, 10, 10]];
const segs = (size) => size <= 16
  ? BOLD.map((s) => [...s, 3.2, 1]) // favicon: the corner alone, heavier
  : [...BOLD.map((s) => [...s, 2.4, 1]), ...FINE.map((s) => [...s, 1.1, 0.55])];

const dist = (px, py, [x1, y1, x2, y2]) => {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

function png(size) {
  const S = 4, k = 32 / size, r = 8, lines = segs(size);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let cov = 0, ink = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const u = (x + (sx + 0.5) / S) * k, v = (y + (sy + 0.5) / S) * k;
        const ex = Math.max(r - u, u - (32 - r), 0), ey = Math.max(r - v, v - (32 - r), 0);
        if (ex * ex + ey * ey > r * r) continue;
        cov++;
        let a = 0;
        for (const s of lines) if (dist(u, v, s) <= s[4] / 2) a = Math.max(a, s[5]);
        ink += a;
      }
      const i = y * (size * 4 + 1) + 1 + x * 4, m = cov ? ink / cov : 0;
      for (let c = 0; c < 3; c++) raw[i + c] = Math.round(TILE[c] + (255 - TILE[c]) * m);
      raw[i + 3] = Math.round((cov / (S * S)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync('extension/public/icons', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`extension/public/icons/icon${s}.png`, png(s));
