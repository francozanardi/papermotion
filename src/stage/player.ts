import type { Stage } from './Stage';

export interface MountOptions {
  /** Don't play; wait for frames to be requested (capture). */
  headless?: boolean;
}

/** What a mounted page exposes on `window` for capture and inspection. */
export interface StageHooks {
  meta: { fps: number; frames: number; width: number; height: number };
  /** Render frame `n` (increasing order) and return it as a JPEG data URL. */
  frame(n: number): string;
  /** Render frame `n` and return the stage's probe. */
  probe(n: number): Record<string, unknown>;
  /** Start over from frame 0. */
  reset(): void;
  ready: true;
}

/**
 * Put a stage on a page. It loops in real time, and always exposes `StageHooks` on `window`
 * so a headless browser can pull frames and probes.
 */
export function mount(canvas: HTMLCanvasElement, make: (canvas: HTMLCanvasElement) => Stage, o: MountOptions = {}): StageHooks {
  let stage = make(canvas);
  const hooks: StageHooks = {
    meta: { fps: stage.fps, frames: stage.frames, width: stage.width, height: stage.height },
    frame: n => { stage.renderFrame(n); return canvas.toDataURL('image/jpeg', 0.95); },
    probe: n => { stage.renderFrame(n); return stage.probe(); },
    reset: () => { stage = make(canvas); },
    ready: true,
  };
  Object.assign(globalThis, hooks);
  if (!o.headless) play(canvas, () => stage, hooks);
  return hooks;
}

function play(canvas: HTMLCanvasElement, current: () => Stage, hooks: StageHooks): void {
  let n = 0;
  const loop = () => {
    if (!canvas.isConnected) return;
    current().renderFrame(n);
    n = (n + 1) % hooks.meta.frames;
    if (n === 0) hooks.reset();
    setTimeout(loop, 1000 / hooks.meta.fps);
  };
  loop();
}
