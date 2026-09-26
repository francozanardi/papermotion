/**
 * Work on a scene's sound without rendering the picture: simulate the story (no drawing), mix the
 * soundtrack, and check it without ears.
 *
 *   pnpm listen <example>   → out/<example>.wav, out/<example>_cues.json, out/<example>_audio.png
 *                             (spectrogram + waveform), loudness numbers, and the cue list;
 *                             if out/<example>.mp4 exists its sound track is replaced.
 */
import { join } from 'node:path';
import { EXAMPLES } from '../examples/catalog.ts';
import { inspect, loudness, mux, pullAudio } from './audio.ts';
import { load, open } from './browser.ts';

const [name] = process.argv.slice(2);
if (!name || !EXAMPLES[name]) {
  console.error(`usage: pnpm listen <example>   examples: ${Object.keys(EXAMPLES).join(', ')}`);
  process.exit(1);
}
const session = await open();
try {
  const errors: string[] = [];
  await load(session.page, session.base, name, errors);
  const t0 = Date.now();
  const sound = await pullAudio(session.page, name);
  if (errors.length) throw new Error(errors.join('; '));
  if (!sound) { console.log(`${name} has no soundtrack.`); process.exit(0); }
  const counts = new Map<string, number[]>();
  for (const c of sound.cues) counts.set(c.name, [...(counts.get(c.name) ?? []), c.at]);
  for (const [cue, times] of counts) console.log(`${cue.padEnd(12)} ×${String(times.length).padStart(3)}  ${times.slice(0, 12).map(t => t.toFixed(2)).join(' ')}${times.length > 12 ? ' …' : ''}`);
  const png = join('out', `${name}_audio.png`);
  console.log(`${loudness(inspect(sound.wav, png))} → ${sound.wav}, ${png} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  mux(join('out', `${name}.mp4`), sound.wav);
} finally {
  await session.close();
}
