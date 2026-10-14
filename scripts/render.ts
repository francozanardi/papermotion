/**
 * Render examples to video, offline: every frame is simulated and drawn in headless Chromium
 * and piped to ffmpeg, so the result is smooth no matter how heavy a frame is. Several pages draw
 * at once, one per core.
 *
 *   pnpm render sea            → out/sea.mp4
 *   pnpm render kite sea
 *   pnpm render all
 *   pnpm render sea --jobs 2  → pages drawing in parallel (default: one per core, up to 8)
 *
 * Scenes with a `soundtrack` get it mixed and muxed in (and out/<name>.wav, out/<name>_audio.png).
 *
 * Needs ffmpeg and a Chromium (`npx playwright install chromium`, or set CHROMIUM_PATH).
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import { EXAMPLES } from '../examples/catalog.ts';
import { inspect, loudness, mux, pullAudio } from './audio.ts';
import { load, open } from './browser.ts';

const OUT = 'out';

/** H.264 settings for the best encoder this ffmpeg has. */
function encoder(): string[] {
  const list = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (list.includes('libx264')) return ['-c:v', 'libx264', '-crf', '17', '-preset', 'slow'];
  if (list.includes('libopenh264')) return ['-c:v', 'libopenh264', '-b:v', '18M'];
  throw new Error('ffmpeg has no H.264 encoder (libx264 or libopenh264).');
}

/**
 * Render with several pages at once, one per core: drawing a frame is single-threaded, and it is
 * nearly all of the cost. The film is cut into one-second blocks dealt out in turn; each page
 * simulates through the blocks of the others without drawing them (cheap), so every frame comes out
 * exactly as a single page would draw it. Frames are written to ffmpeg in order as they arrive.
 */
async function render(base: string, pages: Page[], name: string, codec: string[]): Promise<void> {
  const errors = pages.map((): string[] => []);
  const [{ fps, frames }] = await Promise.all(pages.map((p, i) => load(p, base, name, errors[i])));
  const block = fps, blocks = Math.ceil(frames / block), jobs = Math.min(pages.length, blocks);

  const file = join(OUT, `${name}.mp4`);
  const ffmpeg = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    ...codec, '-g', String(fps), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise<number | null>(resolve => ffmpeg.on('close', resolve));

  const ready = new Map<number, Buffer>();
  let written = 0, failure: unknown = null, wake = () => {};
  const changed = () => new Promise<void>(r => { const prev = wake; wake = () => { prev(); r(); }; });
  const poke = () => { const w = wake; wake = () => {}; w(); };

  const draw = async (w: number) => {
    const page = pages[w];
    for (let b = w; b < blocks && !failure; b += jobs) {
      // Stay at most two rounds ahead of the writer, so finished frames don't pile up in memory.
      while (!failure && (b - 2 * jobs) * block > written) await changed();
      for (let n = b * block; n < Math.min(frames, (b + 1) * block) && !failure; n++) {
        const url = await page.evaluate(i => (globalThis as unknown as { frame(i: number): string }).frame(i), n);
        if (errors[w].length) throw new Error(`${name} @ frame ${n}: ${errors[w].join('; ')}`);
        ready.set(n, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
        poke();
      }
    }
  };
  const write = async () => {
    while (written < frames) {
      if (failure) return;
      const jpeg = ready.get(written);
      if (!jpeg) { await changed(); continue; }
      ready.delete(written++);
      poke();
      if (!ffmpeg.stdin.write(jpeg)) await new Promise(r => ffmpeg.stdin.once('drain', r));
      if (written % fps === 0 || written === frames) process.stdout.write(`\r${name}: ${written}/${frames} frames`);
    }
  };

  const t0 = Date.now();
  try {
    await Promise.all([write(), ...Array.from({ length: jobs }, (_, w) => draw(w).catch(e => { failure ??= e; poke(); }))]);
    if (failure) throw failure;
  } finally {
    ffmpeg.stdin.end();
  }
  if ((await done) !== 0) throw new Error(`${name}: ffmpeg failed`);
  console.log(` → ${file} (${((Date.now() - t0) / 1000).toFixed(1)}s, ${jobs} page${jobs > 1 ? 's' : ''})`);
  const sound = await pullAudio(pages[0], name, OUT);
  if (sound) {
    mux(file, sound.wav);
    const png = join(OUT, `${name}_audio.png`);
    console.log(`${name}: sound muxed (${sound.cues.length} cues), ${loudness(inspect(sound.wav, png))} → ${png}`);
  }
}

const argv = process.argv.slice(2), j = argv.findIndex(a => a === '-j' || a === '--jobs');
const jobs = j >= 0 ? Number(argv[j + 1]) : Math.min(8, availableParallelism());
if (!(jobs >= 1)) throw new Error('--jobs needs a number of pages, e.g. --jobs 4');
const args = argv.filter((_, i) => j < 0 || (i !== j && i !== j + 1));
const names = args.includes('all') || !args.length ? Object.keys(EXAMPLES) : args;
const unknown = names.filter(n => !EXAMPLES[n]);
if (unknown.length) throw new Error(`Unknown example(s): ${unknown.join(', ')}. Try: ${Object.keys(EXAMPLES).join(', ')}, all`);

mkdirSync(OUT, { recursive: true });
const codec = encoder();
const session = await open();
try {
  const pages = [session.page, ...await Promise.all(Array.from({ length: jobs - 1 }, () => session.newPage()))];
  for (const name of names) await render(session.base, pages, name, codec);
} finally {
  await session.close();
}
