/** Shared by the render and listen scripts: pull a scene's soundtrack from the page, save it, mux it, inspect it. */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright-core';

export interface SoundCue { name: string; at: number; gain: number }

/** Mix the scene's soundtrack in the page and save out/<name>.wav and out/<name>_cues.json; null if silent. */
export async function pullAudio(page: Page, name: string, out = 'out'): Promise<{ wav: string; cues: SoundCue[] } | null> {
  const result = await page.evaluate(() => (globalThis as unknown as { audio(): { wav: string; cues: SoundCue[] } | null }).audio());
  if (!result) return null;
  const wav = join(out, `${name}.wav`);
  writeFileSync(wav, Buffer.from(result.wav, 'base64'));
  writeFileSync(join(out, `${name}_cues.json`), JSON.stringify(result.cues, null, 1));
  return { wav, cues: result.cues };
}

/** Put `wav` into the video as its sound track (the picture is copied, not re-encoded). */
export function mux(video: string, wav: string): void {
  if (!existsSync(video)) return;
  const tmp = video.replace(/\.mp4$/, '.tmp.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp]);
  renameSync(tmp, video);
}

/** Writes a spectrogram (log frequency up to 16 kHz, time left to right) + waveform picture and returns ffmpeg's loudness log (read it with `loudness`), to check a mix without ears. */
export function inspect(wav: string, png: string): string {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-filter_complex',
    '[0:a]showspectrumpic=s=1800x512:legend=0:scale=log:fscale=log:stop=16000[s];[0:a]showwavespic=s=1800x200:split_channels=0:colors=0x9fc5ff[w];[s][w]vstack', png]);
  return log;
}

/** The summary lines of an ebur128 log. */
export function loudness(log: string): string {
  const stderr = log.slice(log.lastIndexOf('Summary:'));
  const i = /I:\s+(-?[\d.]+) LUFS/.exec(stderr)?.[1], lra = /LRA:\s+([\d.]+) LU/.exec(stderr)?.[1], peak = /Peak:\s+(-?[\d.]+) dBFS/.exec(stderr)?.[1];
  return `integrated ${i} LUFS, range ${lra} LU, true peak ${peak} dBFS`;
}
