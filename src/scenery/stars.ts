import { type V, clamp, smoothstep } from '../core/math';
import { noise1, rng } from '../core/random';

/**
 * A night sky that wheels around its pole: stars and a Milky Way band, stateless given how far the
 * sky has turned. With a `trail` the stars draw as arcs, like a long exposure, so a time-lapse reads
 * as hours or ages passing.
 */

export interface SkySpec {
  seed: number;
  /** The point the sky turns around (layer coords): the celestial pole, usually above the horizon. */
  pole: V;
  /** Stars fill a disc of this radius around the pole; make it reach every corner the camera sees. */
  radius: number;
  /** Stars scattered evenly over the disc. */
  count: number;
  /** A Milky Way: a band of extra stars and glow along a line `offset` px from the pole, at `angle` (rad). */
  band?: { angle: number; offset: number; width: number; stars: number; clouds: number; color?: string };
  /** Star colors as 'r, g, b' strings (cool to warm); picked at random. */
  tints?: string[];
}

/** A star in polar coordinates around the pole. `mag` 0…1: 1 is the brightest. */
export interface Star { r: number; a: number; mag: number; tint: string; phase: number }

/** A patch of Milky Way glow, in polar coordinates around the pole. */
export interface SkyCloud { r: number; a: number; size: number; alpha: number }

export interface Sky { spec: SkySpec; stars: Star[]; clouds: SkyCloud[] }

/** How the sky looks at one moment. */
export interface SkyFrame {
  /** How far the sky has turned (rad, positive = clockwise on screen). */
  turn: number;
  /** Arc each star leaves behind (rad): 0 for points, larger for time-lapse trails. */
  trail?: number;
  /** Scene time, for twinkling. */
  t?: number;
  /** Twinkle depth 0…1. Default 0.3. */
  twinkle?: number;
  /** Overall opacity. */
  alpha?: number;
  /** 0…1: hides the faintest stars first (haze, moonlight, a lit city). */
  wash?: number;
}

/** Build the stars and glow of a sky from its spec (deterministic for a seed). */
export function starSky(spec: SkySpec): Sky {
  const r = rng(spec.seed), tints = spec.tints ?? ['215, 228, 255', '255, 250, 240', '255, 226, 190'];
  const polar = (p: V) => ({ r: Math.hypot(p.x, p.y), a: Math.atan2(p.y, p.x) });
  const stars: Star[] = [];
  const add = (p: V, mag: number) => stars.push({ ...polar(p), mag, tint: tints[Math.floor(r() * tints.length)], phase: r() * 100 });
  for (let i = 0; i < spec.count; i++) {
    const d = spec.radius * Math.sqrt(r()), a = r() * Math.PI * 2;
    add({ x: Math.cos(a) * d, y: Math.sin(a) * d }, r() ** 3.2);
  }
  const clouds: SkyCloud[] = [];
  const b = spec.band;
  if (b) {
    const dir = { x: Math.cos(b.angle), y: Math.sin(b.angle) }, nrm = { x: -dir.y, y: dir.x };
    const along = (s: number, off: number): V => ({ x: nrm.x * b.offset + dir.x * s + nrm.x * off, y: nrm.y * b.offset + dir.y * s + nrm.y * off });
    // The band wanders and swells along its length, so it reads as a river rather than a ruler line.
    const wander = (s: number) => noise1(s * 0.0022, spec.seed + 5) * b.width * 0.9;
    const swell = (s: number) => 0.55 + 0.45 * (noise1(s * 0.003, spec.seed + 9) * 0.5 + 0.5);
    for (let i = 0; i < b.stars; i++) {
      const s = (r() * 2 - 1) * spec.radius, g = (r() + r() + r() - 1.5) / 1.5;
      add(along(s, wander(s) + g * b.width * swell(s)), r() ** 4.5 * 0.8);
    }
    for (let i = 0; i < b.clouds; i++) {
      const s = (r() * 2 - 1) * spec.radius, g = (r() + r() - 1) * 0.8;
      clouds.push({ ...polar(along(s, wander(s) + g * b.width * swell(s))), size: b.width * (0.5 + r() * 1.1) * swell(s), alpha: 0.05 + r() * 0.08 });
    }
  }
  return { spec, stars, clouds };
}

/** Where a star (or cloud) is once the sky has turned by `turn` (layer coords). */
export function skyPoint(sky: Sky, p: { r: number; a: number }, turn: number): V {
  const pole = sky.spec.pole;
  return { x: pole.x + Math.cos(p.a + turn) * p.r, y: pole.y + Math.sin(p.a + turn) * p.r };
}

/** Draw the sky into the current transform (a camera layer): glow first, then stars or star trails. */
export function drawSky(ctx: CanvasRenderingContext2D, sky: Sky, f: SkyFrame): void {
  const { pole } = sky.spec, alpha = f.alpha ?? 1, trail = f.trail ?? 0, t = f.t ?? 0, tw = f.twinkle ?? 0.3, wash = f.wash ?? 0;
  if (alpha <= 0) return;
  const m = ctx.getTransform(), px = 1 / (Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = sky.spec.band?.color ?? '190, 200, 235';
  for (const c of sky.clouds) {
    const p = skyPoint(sky, c, f.turn), a = c.alpha * alpha * (1 - wash * 0.9);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, c.size);
    g.addColorStop(0, `rgba(${glow}, ${a})`);
    g.addColorStop(1, `rgba(${glow}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(p.x - c.size, p.y - c.size, c.size * 2, c.size * 2);
  }
  ctx.lineCap = 'round';
  for (const s of sky.stars) {
    const seen = smoothstep(wash - 0.12, wash + 0.04, s.mag);
    if (seen <= 0) continue;
    const a = clamp((0.3 + 0.7 * s.mag) * alpha * seen * (1 - tw * 0.5 + tw * 0.5 * noise1(t * 2.3 + s.phase, 7)));
    const size = (0.7 + s.mag * 2.6) * Math.max(px, 0.35);
    const arc = trail * s.r;
    if (arc < size) {
      const p = skyPoint(sky, s, f.turn);
      ctx.fillStyle = `rgba(${s.tint}, ${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.6, 0, Math.PI * 2); ctx.fill();
      if (s.mag > 0.72) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 5);
        g.addColorStop(0, `rgba(${s.tint}, ${a * 0.35})`);
        g.addColorStop(1, `rgba(${s.tint}, 0)`);
        ctx.fillStyle = g; ctx.fillRect(p.x - size * 5, p.y - size * 5, size * 10, size * 10);
      }
      continue;
    }
    // A trail fades toward where the star was: three arcs, dimmer as they get older.
    ctx.lineWidth = size * 0.9;
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(${s.tint}, ${a * [0.22, 0.5, 1][k]})`;
      ctx.beginPath();
      ctx.arc(pole.x, pole.y, s.r, s.a + f.turn - trail * (1 - k / 3), s.a + f.turn - trail * (1 - (k + 1) / 3));
      ctx.stroke();
    }
  }
  ctx.restore();
}
