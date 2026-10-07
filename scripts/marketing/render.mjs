// Stage 2 of the marketing pipeline: frames the captured takes and renders the videos in edits.mjs.
//
//   CHROMIUM_PATH=... TAKES=out/takes OUT=out/videos node scripts/marketing/render.mjs [video ...]
//
// Each frame is rendered deterministically: director.html's render(t) is called, the page awaits its
// images, then a screenshot is taken. ffmpeg encodes MP4 (+ WebM and a poster for web loops).
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BRAND, INTRO, LAYOUTS, VIDEOS } from './edits.mjs';

const root = process.cwd();
const TAKES = path.resolve(process.env.TAKES ?? 'media/takes');
const OUT = path.resolve(process.env.OUT ?? 'media/marketing');
const CACHE = path.join(OUT, '.cache');
const only = process.argv.slice(2);
const FPS = 30;
const XFADE = 0.4;
const FOCUS = { all: [0.5, 0.5], panel: [0.852, 0.56], page: [0.352, 0.5], panelTop: [0.852, 0.38], panelLow: [0.852, 0.72], pageTop: [0.36, 0.33] };
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
fs.mkdirSync(CACHE, { recursive: true });

/** Tool names + icon paths straight from the extension, for the intro card. */
const TOOLS = [...fs.readFileSync(path.join(root, 'extension/src/lib/tools.ts'), 'utf8')
  .matchAll(/name: '([^']+)'[^}]*?icon: '([^']+)'/g)].map(([, name, icon]) => ({ name, icon }));

const takeMeta = (name) => JSON.parse(fs.readFileSync(path.join(TAKES, name, 'take.json'), 'utf8'));

/** "mark", "mark+0.5", "mark-1" or a number → seconds within the take. */
function at(meta, spec) {
  if (typeof spec === 'number') return spec;
  const m = /^([\w-]+?)([+-][\d.]+)?$/.exec(spec);
  if (!m || !(m[1] in meta.marks)) throw new Error(`${meta.name}: unknown mark "${spec}"`);
  return meta.marks[m[1]] + (m[2] ? parseFloat(m[2]) : 0);
}

/** Extracts the frames a shot needs (cached), returns { pg, pn, count } as file URLs. */
function extract(shot, meta, from, dur) {
  const key = `${shot.take}_${from.toFixed(2)}_${dur.toFixed(2)}_${shot.speed ?? 1}`;
  const dir = path.join(CACHE, key);
  const sources = meta.layout === 'full' ? ['page'] : ['page', 'panel'];
  for (const src of sources) {
    const d = path.join(dir, src);
    if (fs.existsSync(path.join(d, '00001.jpg'))) continue;
    fs.mkdirSync(d, { recursive: true });
    ff('-ss', from.toFixed(3), '-i', path.join(TAKES, shot.take, `${src}.mp4`), '-t', (dur * (shot.speed ?? 1) + 0.2).toFixed(3),
      '-vf', `setpts=PTS/${shot.speed ?? 1},fps=${FPS}`, '-q:v', '2', path.join(d, '%05d.jpg'));
  }
  const count = fs.readdirSync(path.join(dir, 'page')).length;
  return { pg: `file://${dir}/page`, pn: `file://${dir}/panel`, count };
}

/** Lays shots end to end with crossfades and resolves frames, cameras and caption spans. */
function timeline(video) {
  const shots = [];
  const cam = [];
  let prevEnd = 0, slot = 0;
  video.shots.forEach((s, i) => {
    const last = i === video.shots.length - 1;
    const card = s.kind === 'intro' || s.kind === 'end';
    let dur, frames, meta, from;
    if (card) dur = s.dur;
    else {
      meta = takeMeta(s.take);
      from = at(meta, s.from);
      const to = at(meta, s.to);
      dur = (to - from) / (s.speed ?? 1);
      frames = extract(s, meta, from, dur);
    }
    const start = i === 0 ? 0 : prevEnd - XFADE;
    const end = start + dur;
    const shot = {
      kind: card ? s.kind : 'take', take: s.take, site: meta?.site, layout: meta?.layout, start, end, frames,
      fadeIn: i === 0 ? (video.loop ? 0 : 0.5) : XFADE, fadeOut: last ? (video.loop ? 0 : 0.6) : XFADE,
      caption: s.cap ?? null, slot: card ? -1 : slot++ % 2,
    };
    shots.push(shot);
    if (!card) {
      for (const [spec, z, f] of s.cam ?? [[0, 1, 'all']]) {
        // '@mark±x' → that take moment; negative → from the shot's end; else seconds from its start.
        const lt = typeof spec === 'string' ? (at(meta, spec.slice(1)) - from) / (s.speed ?? 1) : spec < 0 ? dur + spec : spec;
        cam.push([start + Math.max(0, Math.min(dur, lt)), z, ...(typeof f === 'string' ? FOCUS[f] : f)]);
      }
    }
    prevEnd = end;
  });
  cam.sort((a, b) => a[0] - b[0]);
  // Merge consecutive shots sharing a caption into one span, so captions only animate on change.
  const captionSpans = [];
  for (const s of shots) {
    if (!s.caption) continue;
    const prev = captionSpans.at(-1);
    if (prev && prev.key === s.caption.title && s.start <= prev.end + 0.01) prev.end = s.end;
    else captionSpans.push({ key: s.caption.title, title: s.caption.title, sub: s.caption.sub, start: s.start + 0.15, end: s.end });
  }
  return { shots, cam, captionSpans, duration: prevEnd };
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

for (const video of VIDEOS) {
  if (only.length && !only.includes(video.name)) continue;
  const L = LAYOUTS[video.layout];
  console.log(`● ${video.name} (${L.width}×${L.height})`);
  const tl = timeline(video);
  const page = await browser.newPage({ viewport: { width: L.width, height: L.height } });
  await page.goto('file://' + path.join(root, 'scripts/marketing/director.html'));
  await page.evaluate((cfg) => window.setup(cfg), {
    width: L.width, height: L.height, layout: L, captions: video.captions !== false, brand: BRAND, intro: video.intro ?? INTRO,
    tools: TOOLS, shots: tl.shots, cam: tl.cam, captionSpans: tl.captionSpans,
  });
  const framesDir = path.join(CACHE, `render-${video.name}`);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const n = Math.round(tl.duration * FPS);
  for (let f = 0; f < n; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    fs.writeFileSync(path.join(framesDir, `${String(f).padStart(5, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 94 }));
    if (f % 150 === 0) process.stdout.write(`  ${f}/${n}\r`);
  }
  await page.close();

  fs.mkdirSync(OUT, { recursive: true });
  const base = path.join(OUT, video.name);
  const enc = ['-c:v', 'libx264', '-crf', String(video.crf ?? 20), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  if (video.loop) {
    // Seamless loop: crossfade the tail into the head; output starts and ends on the same frame.
    const D = n / FPS, X = 0.5;
    ff('-framerate', String(FPS), '-i', path.join(framesDir, '%05d.jpg'), '-filter_complex',
      `[0]split[a][b];[a]trim=start=${X},setpts=PTS-STARTPTS[a2];[b]trim=end=${X},setpts=PTS-STARTPTS[b2];` +
      `[a2][b2]xfade=transition=fade:duration=${X}:offset=${(D - 2 * X).toFixed(3)},format=yuv420p`, ...enc, `${base}.mp4`);
  } else {
    ff('-framerate', String(FPS), '-i', path.join(framesDir, '%05d.jpg'), ...enc, `${base}.mp4`);
  }
  if (video.web) {
    ff('-i', `${base}.mp4`, '-c:v', 'libvpx-vp9', '-crf', String(video.webmCrf ?? 36), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an', `${base}.webm`);
    ff('-ss', String(video.poster ?? 1), '-i', `${base}.mp4`, '-frames:v', '1', '-q:v', '2', `${base}.jpg`);
  }
  // Contact sheet for review.
  const step = Math.max(1, Math.round(tl.duration / 12));
  ff('-i', `${base}.mp4`, '-vf', `fps=1/${step},scale=${L.width > L.height ? 480 : 270}:-1,tile=4x3:padding=6:color=white`, '-frames:v', '1', `${base}.sheet.png`);
  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log(`  → ${base}.mp4 (${(fs.statSync(`${base}.mp4`).size / 1e6).toFixed(1)} MB, ${tl.duration.toFixed(1)}s)`);
}
await browser.close();
