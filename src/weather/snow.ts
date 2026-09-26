import type { View } from '../camera/Camera';
import type { V } from '../core/math';
import { hash } from '../core/random';

/**
 * Snowfall without state: every flake is a pure function of its column, its index and the time, like
 * the rain. It drifts with the wind, sways as it falls and tumbles, and is identical after any cut.
 */

export interface SnowSpec {
  seed: number;
  /** Columns of flakes per 100 px of layer width. */
  density: number;
  /** Seconds between flakes in one column. */
  period: number;
  /** Fall speed range (layer px/s). */
  speed: [number, number];
  /** Horizontal drift (layer px/s): the wind. */
  drift: number;
  /** Side-to-side sway amplitude (px) and frequency (1/s). */
  sway: number;
  swayRate: number;
  /** Flake radius range (layer px). */
  size: [number, number];
  /** Fill color, and each flake's opacity range. */
  color: string;
  alpha: [number, number];
}

/** A flake at time t: where it is, how big, how opaque, how turned (for its tumbling shape). */
export interface Flake extends V { r: number; alpha: number; spin: number; id: number }

/** Height every flake starts from (layer px), far above any frame. */
const SKY = -4000;

/** The flakes visible in `view` at time `t`. Pure: the same inputs always give the same flakes. */
export function snowflakes(s: SnowSpec, view: View, t: number): Flake[] {
  const out: Flake[] = [];
  const spacing = 100 / s.density;
  const maxDrift = Math.abs(s.drift) * ((view.bottom - SKY) / s.speed[0]) + s.sway;
  const c0 = Math.floor((view.from - maxDrift * (s.drift > 0 ? 1 : 0) - s.sway) / spacing);
  const c1 = Math.ceil((view.to + maxDrift * (s.drift < 0 ? 1 : 0) + s.sway) / spacing);
  for (let c = c0; c <= c1; c++) {
    const key = s.seed * 92821 + c * 7919;
    const offset = hash(key) * s.period;
    // Only the flakes whose age can put them inside the view's height.
    const ageMin = (view.top - SKY) / s.speed[1], ageMax = (view.bottom - SKY) / s.speed[0];
    const n0 = Math.floor((t - ageMax - offset) / s.period), n1 = Math.ceil((t - ageMin - offset) / s.period);
    for (let n = n0; n <= n1; n++) {
      const id = key + n * 131;
      const born = offset + n * s.period;
      const speed = s.speed[0] + hash(id + 1) * (s.speed[1] - s.speed[0]);
      const age = t - born;
      if (age < 0) continue;
      const y = SKY + age * speed;
      if (y < view.top || y > view.bottom) continue;
      const phase = hash(id + 2) * Math.PI * 2;
      const x = c * spacing + hash(id + 3) * spacing + age * s.drift + Math.sin(age * s.swayRate * Math.PI * 2 + phase) * s.sway;
      if (x < view.from || x > view.to) continue;
      out.push({
        x, y, id,
        r: s.size[0] + hash(id + 4) * (s.size[1] - s.size[0]),
        alpha: s.alpha[0] + hash(id + 5) * (s.alpha[1] - s.alpha[0]),
        spin: age * (1 + hash(id + 6) * 3) + phase,
      });
    }
  }
  return out;
}

/** Draw one layer of snow over `view` as small tumbling paper flakes (ellipses that turn edge-on). */
export function drawSnow(ctx: CanvasRenderingContext2D, s: SnowSpec, view: View, t: number): void {
  ctx.save();
  ctx.fillStyle = s.color;
  for (const f of snowflakes(s, view, t)) {
    ctx.globalAlpha = f.alpha;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.r, f.r * (0.45 + 0.55 * Math.abs(Math.cos(f.spin))), f.spin * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
