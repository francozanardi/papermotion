/**
 * Render examples to video, offline: every frame is simulated and drawn in headless Chromium
 * and piped to ffmpeg, so the result is smooth no matter how heavy a frame is.
 *
 *   pnpm render sea            → out/sea.mp4
 *   pnpm render kite autumn
 *   pnpm render all
 *
 * Needs ffmpeg and a Chromium (`npx playwright install chromium`, or set CHROMIUM_PATH).
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { createServer } from 'vite';
import { EXAMPLES } from '../examples/catalog.ts';

const OUT = 'out';

function findChromium(): string {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const builds = existsSync(cache) ? readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().reverse() : [];
  for (const b of builds) {
    const bin = join(cache, b, 'chrome-linux64', 'chrome');
    if (existsSync(bin)) return bin;
  }
  throw new Error('No Chromium found: run `npx playwright install chromium` or set CHROMIUM_PATH.');
}

/** H.264 settings for the best encoder this ffmpeg has. */
function encoder(): string[] {
  const list = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (list.includes('libx264')) return ['-c:v', 'libx264', '-crf', '17', '-preset', 'slow'];
  if (list.includes('libopenh264')) return ['-c:v', 'libopenh264', '-b:v', '18M'];
  throw new Error('ffmpeg has no H.264 encoder (libx264 or libopenh264).');
}

async function render(page: Page, base: string, name: string, codec: string[]): Promise<void> {
  const errors: string[] = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?example=${name}&headless`);
  await page.waitForFunction(() => (globalThis as { ready?: boolean }).ready || document.querySelector('p'), null, { timeout: 60_000 });
  if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
  const { fps, frames } = await page.evaluate(() => (globalThis as unknown as { meta: { fps: number; frames: number } }).meta);

  const file = join(OUT, `${name}.mp4`);
  const ffmpeg = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    ...codec, '-g', String(fps), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise<number | null>(resolve => ffmpeg.on('close', resolve));

  const t0 = Date.now();
  for (let n = 0; n < frames; n++) {
    const url = await page.evaluate(i => (globalThis as unknown as { frame(i: number): string }).frame(i), n);
    if (errors.length) throw new Error(`${name} @ frame ${n}: ${errors.join('; ')}`);
    if (!ffmpeg.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ffmpeg.stdin.once('drain', r));
    if ((n + 1) % fps === 0 || n === frames - 1) process.stdout.write(`\r${name}: ${n + 1}/${frames} frames`);
  }
  ffmpeg.stdin.end();
  if ((await done) !== 0) throw new Error(`${name}: ffmpeg failed`);
  console.log(` → ${file} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

const args = process.argv.slice(2);
const names = args.includes('all') || !args.length ? Object.keys(EXAMPLES) : args;
const unknown = names.filter(n => !EXAMPLES[n]);
if (unknown.length) throw new Error(`Unknown example(s): ${unknown.join(', ')}. Try: ${Object.keys(EXAMPLES).join(', ')}, all`);

mkdirSync(OUT, { recursive: true });
const codec = encoder();
// No HMR and no file watching: editing sources while a render runs must not reload the page mid-video.
const server = await createServer({ server: { port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls!.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const name of names) await render(page, base, name, codec);
} finally {
  await browser.close();
  await server.close();
}
