import { clamp, easeInOut, smoothstep } from '../core/math';

/**
 * Time-shaped intents: small functions of time for values that follow the clock
 * (a look that rises, a crouch before a jump, blinks). Pair them with `Beats` by passing
 * `since` instead of scene time.
 */

/** 0 before `a`, eases to 1 at `b`. */
export const ramp = (t: number, a: number, b: number): number => smoothstep(a, b, t);

/** Eases in over [a, b], holds 1, eases out over [c, d]. */
export const envelope = (t: number, a: number, b: number, c: number, d: number): number => smoothstep(a, b, t) * (1 - smoothstep(c, d, t));

/** Eyelid openness: 1 open, closing briefly around each time in `at`. */
export const blink = (t: number, at: readonly number[], duration = 0.07): number =>
  at.reduce((open, b) => Math.min(open, clamp(Math.abs(t - b) / duration)), 1);

/**
 * Piecewise curve through `[time, value]` keys, eased between them; holds the ends.
 * @example keys(t, [[0.45, 0], [1, 640], [3.4, 640], [4.2, 0]]) // run up, cruise, slow down
 */
export function keys(t: number, points: readonly [number, number][], ease: (u: number) => number = easeInOut): number {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
    }
  }
  return points[points.length - 1][1];
}

/**
 * A playback rate for `StageOptions.rate`: slow motion over scene-time windows, easing in and out
 * over `ease` seconds at each end so the change of speed is felt, not seen as a jump.
 * @example rate: speedRamp([{ from: 4.9, to: 5.5, rate: 0.35 }])
 */
export function speedRamp(windows: readonly { from: number; to: number; rate: number }[], ease = 0.15): (t: number) => number {
  return t => windows.reduce((r, w) => Math.min(r, 1 - (1 - w.rate) * envelope(t, w.from - ease, w.from, w.to, w.to + ease)), 1);
}
