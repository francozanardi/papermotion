/**
 * Look at a scene without rendering the whole video: grab frames at given times, print the stage's
 * probe at each, and tile them into one contact sheet.
 *
 *   pnpm grab <example> <seconds...>            → out/grab/<example>_<t>.jpg + out/grab/<example>_sheet.jpg
 *   pnpm grab <example> <seconds...> --probe    → only print the probes (fast)
 *
 * Times must increase (the simulation only runs forward). Needs Chromium; the sheet needs ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXAMPLES } from '../examples/catalog.ts';
import { load, open } from './browser.ts';

const args = process.argv.slice(2);
const probeOnly = args.includes('--probe');
const [name, ...rest] = args.filter(a => !a.startsWith('--'));
const times = rest.map(Number);
if (!name || !EXAMPLES[name] || !times.length || times.some(Number.isNaN)) {
  console.error(`usage: pnpm grab <example> <seconds...> [--probe]   examples: ${Object.keys(EXAMPLES).join(', ')}`);
  process.exit(1);
}
if (times.some((t, i) => i && t <= times[i - 1])) throw new Error('Times must be in increasing order.');

const dir = join('out', 'grab');
mkdirSync(dir, { recursive: true });
const session = await open();
try {
  const errors: string[] = [];
  const { fps, frames } = await load(session.page, session.base, name, errors);
  const files: string[] = [];
  for (const t of times) {
    const n = Math.min(frames - 1, Math.round(t * fps));
    if (!probeOnly) {
      const url = await session.page.evaluate(i => (globalThis as unknown as { frame(i: number): string }).frame(i), n);
      const file = join(dir, `${name}_${t}.jpg`);
      writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      files.push(file);
    }
    const probe = await session.page.evaluate(i => (globalThis as unknown as { probe(i: number): unknown }).probe(i), n);
    if (errors.length) throw new Error(`${name} @ ${t}s: ${errors.join('; ')}`);
    console.log(`${t}s`, JSON.stringify(probe));
  }
  if (files.length > 1) {
    const sheet = join(dir, `${name}_sheet.jpg`), cols = Math.min(4, files.length);
    const cells = files.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, (_, k) => `w${k}`).join('+') : 0}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, (_, k) => `h${k * cols}`).join('+') : 0}`);
    const labels = files.map((_, i) => `[${i}]scale=640:-1,drawtext=text='${times[i]}s':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';');
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex',
      `${labels};${files.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${files.length}:layout=${cells.join('|')}:fill=black`, sheet]);
    console.log(`sheet → ${sheet}`);
  }
} finally {
  await session.close();
}
