import type { V } from '../core/math';

/**
 * A ballistic hop from one point to another, peaking `apex` px above the higher end.
 * Plans the launch velocity and flight time; `at(t)` gives the position along the arc.
 * Use a snappier `gravity` than the world's for cartoon jumps.
 *
 * @example
 * const leap = new Leap(cat.root, { x: 1620, y: 470 }, 90, 2600);
 * cat.root = leap.at(elapsed); // until elapsed >= leap.duration
 */
export class Leap {
  readonly duration: number;
  /** Launch velocity (px/s). */
  readonly velocity0: V;

  constructor(readonly from: V, readonly to: V, apex: number, readonly gravity: number) {
    const top = Math.min(from.y, to.y) - Math.max(1, apex);
    const up = Math.sqrt((2 * (from.y - top)) / gravity);
    const down = Math.sqrt((2 * (to.y - top)) / gravity);
    this.duration = up + down;
    this.velocity0 = { x: (to.x - from.x) / this.duration, y: -gravity * up };
  }

  /** Position at `t` seconds into the flight (clamped to the arc). */
  at(t: number): V {
    const u = Math.min(Math.max(t, 0), this.duration);
    return { x: this.from.x + this.velocity0.x * u, y: this.from.y + this.velocity0.y * u + 0.5 * this.gravity * u * u };
  }

  /** Velocity at `t` seconds into the flight. */
  velocityAt(t: number): V {
    const u = Math.min(Math.max(t, 0), this.duration);
    return { x: this.velocity0.x, y: this.velocity0.y + this.gravity * u };
  }

  /** 0 at takeoff … 1 at landing. */
  progress(t: number): number {
    return Math.min(Math.max(t / this.duration, 0), 1);
  }
}
