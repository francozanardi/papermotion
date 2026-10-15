import { encodeWav } from '../audio/Mixer';
import { setPixelScale } from '../paper/resolution';
import type { Stage } from './Stage';

export interface MountOptions {
  /** Don't play; wait for frames to be requested (capture). */
  headless?: boolean;
  /**
   * Draft resolution: canvas pixels per frame pixel. 0.5 draws a quarter of the pixels, about three
   * times faster; the scene is unchanged. Default 1.
   */
  scale?: number;
}

/** What a mounted page exposes on `window` for capture and inspection. */
export interface StageHooks {
  meta: { fps: number; frames: number; width: number; height: number };
  /** Render frame `n` (increasing order) and return it as a JPEG data URL. */
  frame(n: number): string;
  /** Render frame `n` and return the stage's probe. */
  probe(n: number): Record<string, unknown>;
  /**
   * Simulate to the end and mix the scene's soundtrack: a base64 WAV plus the cues at their video
   * times, or null for a silent scene. Call it after the last frame (or instead of rendering frames).
   */
  audio(sampleRate?: number): { wav: string; cues: { name: string; at: number; gain: number }[] } | null;
  /** Start over from frame 0. */
  reset(): void;
  ready: true;
}

/**
 * Put a stage on a page. It loops in real time, dropping frames it can't draw in time, and always
 * exposes `StageHooks` on `window` so a headless browser can pull frames and probes.
 */
export function mount(canvas: HTMLCanvasElement, make: (canvas: HTMLCanvasElement) => Stage, o: MountOptions = {}): StageHooks {
  setPixelScale(canvas, o.scale ?? 1);
  let stage = make(canvas);
  const hooks: StageHooks = {
    meta: { fps: stage.fps, frames: stage.frames, width: stage.width, height: stage.height },
    frame: n => { stage.renderFrame(n); return canvas.toDataURL('image/jpeg', 0.95); },
    probe: n => { stage.renderFrame(n); return stage.probe(); },
    audio: (sampleRate = 48000) => {
      stage.advance(stage.frames - 1);
      const mix = stage.soundtrack(sampleRate);
      if (!mix) return null;
      const cues = stage.sound.cues.map(c => ({ name: c.name, at: +stage.videoTime(c.at).toFixed(3), gain: +c.gain.toFixed(2) }));
      return { wav: base64(encodeWav(mix, sampleRate)), cues };
    },
    reset: () => { stage = make(canvas); },
    ready: true,
  };
  Object.assign(globalThis, hooks);
  if (!o.headless) play(canvas, () => stage, hooks);
  return hooks;
}

/**
 * Real-time playback: show the frame due now. When a frame takes longer to draw than its slot, the
 * frames in between are simulated but not drawn, so the film keeps its pace instead of slowing down.
 */
function play(canvas: HTMLCanvasElement, current: () => Stage, hooks: StageHooks): void {
  const { fps, frames } = hooks.meta;
  let start = performance.now(), shown = -1;
  const loop = (now: number) => {
    if (!canvas.isConnected) return;
    let n = Math.floor(((now - start) / 1000) * fps);
    if (n >= frames) { hooks.reset(); start = now; shown = -1; n = 0; }
    if (n !== shown) { current().renderFrame(n); shown = n; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
