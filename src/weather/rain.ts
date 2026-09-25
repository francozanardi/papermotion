import type { View } from '../camera/Camera';
import type { V } from '../core/math';
import { hash } from '../core/random';

/**
 * Rain, drips and ripples without state: every drop is a pure function of its stream, its index
 * and the time. Nothing to simulate, identical after any cut, deterministic.
 */

export interface SplashSpec {
  color: string;
  /** Crown radius (layer px). */
  size: number;
  /** Seconds a splash lasts. */
  life: number;
}

export interface RainSpec {
  seed: number;
  /** Streams per 100 px of layer width (more = denser). */
  density: number;
  /** Seconds between drops in one stream (less = heavier). */
  period: number;
  /** Fall speed (layer px/s). */
  speed: number;
  /** Horizontal drift per px of fall (wind): 0.15 leans the rain to the right. */
  slant: number;
  /** Streak length and width (layer px). */
  length: number;
  width: number;
  /** An `rgb(…)` triple like '220, 225, 235'; each drop gets its own opacity within `alpha`. */
  rgb: string;
  alpha: [number, number];
  /** Drops that meet the floor end in a splash. */
  splash?: SplashSpec;
}

/** Height every drop starts falling from (layer px), far above any frame. */
const SKY = -6000;
const BUCKETS = 3;

/** One drop now: `base` is its x at layer y = 0 (x drifts with the slant as it falls). */
interface Drop { base: number; y: number; hitX: number; hitY: number; hitAt: number; alpha: number; id: number }

/**
 * Draw one layer of rain over `view`. `floor(x)` is where drops stop (ground, puddles, an umbrella,
 * the top of a shelter); leave it out for rain that falls past everything (a foreground veil).
 */
export function drawRain(ctx: CanvasRenderingContext2D, s: RainSpec, view: View, t: number, floor?: (x: number) => number): void {
  const streaks: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
  const splashes: Drop[] = [];
  for (const d of drops(s, view, t, floor)) {
    const head = Math.min(d.y, d.hitY), tail = d.y - s.length;
    if (tail < head) {
      const p = streaks[Math.min(BUCKETS - 1, Math.floor(d.alpha * BUCKETS))];
      p.moveTo(d.base + tail * s.slant, tail);
      p.lineTo(d.base + head * s.slant, head);
    }
    if (s.splash && t >= d.hitAt && t - d.hitAt < s.splash.life) splashes.push(d);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = s.width;
  streaks.forEach((p, i) => {
    ctx.strokeStyle = `rgba(${s.rgb}, ${s.alpha[0] + ((i + 0.5) / BUCKETS) * (s.alpha[1] - s.alpha[0])})`;
    ctx.stroke(p);
  });
  if (s.splash) drawSplashes(ctx, s.splash, splashes, t);
  ctx.restore();
}

function* drops(s: RainSpec, view: View, t: number, floor?: (x: number) => number): Generator<Drop> {
  const cell = 100 / s.density;
  const life = s.splash?.life ?? 0;
  const lowest = view.bottom + s.speed * life;
  const x0 = Math.min(view.from - view.top * s.slant, view.from - lowest * s.slant) - cell;
  const x1 = Math.max(view.to - view.top * s.slant, view.to - lowest * s.slant) + cell;
  for (let k = Math.floor(x0 / cell); k * cell < x1; k++) {
    const seed = s.seed * 7919 + k * 104729;
    const phase = hash(seed);
    // Start times of the drops of this stream that can be on screen (falling, or splashing) now.
    const early = t - (lowest - SKY) / s.speed - s.period * 0.3, late = t - (view.top - SKY) / s.speed + s.period * 0.3;
    for (let n = Math.ceil(early / s.period - phase); (n + phase) * s.period <= late; n++) {
      const id = seed + n * 31;
      const start = (n + phase + (hash(id) - 0.5) * 0.6) * s.period;
      const base = k * cell + hash(id + 1) * cell;
      const y = SKY + s.speed * (t - start);
      const xAt = (yy: number) => base + yy * s.slant;
      let hitY = Infinity;
      if (floor) {
        hitY = floor(xAt(view.bottom));
        hitY = floor(xAt(Number.isFinite(hitY) ? hitY : view.bottom));
      }
      const hitAt = Number.isFinite(hitY) ? start + (hitY - SKY) / s.speed : Infinity;
      if (y - s.length > view.bottom && !(t - hitAt < life)) continue;
      yield { base, y, hitX: xAt(hitY), hitY, hitAt, alpha: hash(id + 2), id };
    }
  }
}

/** A crown ring that widens and a few droplets that jump up and fall back. */
function drawSplashes(ctx: CanvasRenderingContext2D, sp: SplashSpec, list: Drop[], t: number): void {
  const ring = new Path2D(), beads = new Path2D();
  for (const d of list) {
    const u = (t - d.hitAt) / sp.life, r = sp.size * (0.35 + u * 0.9), fade = (1 - u) ** 1.5;
    if (fade < 0.05) continue;
    ring.ellipse(d.hitX, d.hitY, r, r * 0.28, 0, Math.PI, Math.PI * 2);
    ring.moveTo(d.hitX + r, d.hitY);
    for (let j = 0; j < 3; j++) {
      const side = (hash(d.id + 10 + j) - 0.5) * 2, up = 0.8 + hash(d.id + 20 + j) * 0.8;
      const x = d.hitX + side * sp.size * 1.3 * u, y = d.hitY - sp.size * up * (2.4 * u - 2.4 * u * u);
      beads.moveTo(x + 0.9, y);
      beads.arc(x, y, Math.max(0.4, sp.size * 0.09 * fade), 0, Math.PI * 2);
    }
  }
  ctx.strokeStyle = sp.color;
  ctx.lineWidth = Math.max(0.6, sp.size * 0.08);
  ctx.stroke(ring);
  ctx.fillStyle = sp.color;
  ctx.fill(beads);
}

export interface RippleSpec {
  seed: number;
  /** Rings per second per 10 000 px² of water. */
  rate: number;
  life: number;
  /** Final ring radius (px). */
  size: number;
  /** Vertical squash of the rings (perspective on a flat puddle). */
  squash: number;
  rgb: string;
  alpha: number;
}

/** Rain rings on a puddle: an ellipse centered at `c` with radii `rx`, `ry`. */
export function drawRipples(ctx: CanvasRenderingContext2D, c: V, rx: number, ry: number, s: RippleSpec, t: number): void {
  const slots = Math.ceil(((Math.PI * rx * ry) / 10000) * s.rate * s.life);
  const paths: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
  for (let i = 0; i < slots; i++) {
    const seed = s.seed * 3571 + i * 977, phase = hash(seed);
    const cycle = Math.floor(t / s.life + phase), u = t / s.life + phase - cycle;
    const a = hash(seed + cycle * 13) * Math.PI * 2, d = Math.sqrt(hash(seed + cycle * 13 + 1)) * 0.85;
    const x = c.x + Math.cos(a) * d * rx, y = c.y + Math.sin(a) * d * ry;
    const r = s.size * (0.15 + u * 0.85);
    const p = paths[Math.min(BUCKETS - 1, Math.floor(u * BUCKETS))];
    p.moveTo(x + r, y);
    p.ellipse(x, y, r, r * s.squash, 0, 0, Math.PI * 2);
  }
  ctx.save();
  ctx.lineWidth = Math.max(0.6, s.size * 0.05);
  paths.forEach((p, i) => {
    ctx.strokeStyle = `rgba(${s.rgb}, ${s.alpha * (1 - (i + 0.5) / BUCKETS) ** 1.3})`;
    ctx.stroke(p);
  });
  ctx.restore();
}

export interface DripSpec {
  seed: number;
  /** Seconds between drips from one point. */
  period: number;
  /** Radius of the bead that swells before it lets go. */
  bead: number;
  gravity: number;
  rgb: string;
  alpha: number;
}

/** Water dripping off edges (an umbrella rim, eaves, a chin): a bead swells, lets go, and falls to `floor`. */
export function drawDrips(ctx: CanvasRenderingContext2D, from: readonly V[], floor: number, s: DripSpec, t: number): void {
  ctx.save();
  ctx.fillStyle = `rgba(${s.rgb}, ${s.alpha})`;
  ctx.strokeStyle = `rgba(${s.rgb}, ${s.alpha})`;
  ctx.lineCap = 'round';
  from.forEach((p, i) => {
    const seed = s.seed * 211 + i * 53, period = s.period * (0.7 + hash(seed) * 0.6);
    const u = (t / period + hash(seed + 1)) % 1, swell = 0.55;
    if (u < swell) {
      const r = s.bead * (0.3 + 0.7 * (u / swell));
      ctx.beginPath(); ctx.ellipse(p.x, p.y + r, r * 0.8, r, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const fall = (u - swell) * period, y = p.y + s.bead + 0.5 * s.gravity * fall * fall;
    if (y > floor) return;
    const v = s.gravity * fall, streak = Math.min(v / 30, 40);
    ctx.lineWidth = s.bead * 1.1;
    ctx.beginPath(); ctx.moveTo(p.x, y - streak); ctx.lineTo(p.x, y); ctx.stroke();
  });
  ctx.restore();
}
