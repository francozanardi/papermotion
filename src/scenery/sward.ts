import type { V } from '../core/math';
import { type Range, fbm1, hash, noise1 } from '../core/random';
import type { Paper, SheetOpts } from '../paper/Paper';
import { pushBend } from './scatter';

export interface SwardSpec {
  seed: number;
  /** Ground height at x (layer coords); `null` leaves a gap (water, a path). */
  ground: (x: number) => number | null;
  /** Blades per 100 px of ground. Dense enough that blades overlap and hide the ground. */
  density: number;
  height: Range;
  /** Blade width at the root (px); blades taper to a point. */
  width: Range;
  /**
   * Tones from shade to light, each `[root, tip]`: every blade is dark at its root and light at its
   * tip, so each row stands out against the dark roots of the row behind it.
   */
  tones: [string, string][];
  /** Size (px) of the patches of light and shade across the field. Default 420. */
  patches?: number;
  /**
   * Blades are planted from the ground line down to `depth` px below it (nearer the camera) and grow
   * by up to `grow` (×) at the front, so a band reads as a field receding from the lens. Default 0.
   */
  depth?: number;
  grow?: number;
  /** Plant a blade at (x, y) only if this says so (e.g. on land, not over water). */
  keep?: (x: number, y: number) => boolean;
  /** Clumping: how much slow noise along x raises and thins the grass (0 = an even lawn). Default 0.35. */
  clump?: number;
  /** 0…1: leave blades out where that noise is low, so they gather in clumps with bare lawn between. Default 0. */
  patchy?: number;
  /** The way the whole field leans (rad, + is right), each blade's spread around it, and how much tips curl further that way. */
  lean?: number;
  jitter?: number;
  curl?: number;
  /** How much the wind bends the blades. Default 1. */
  flex?: number;
  /** Rows, drawn back to front, each one sheet of paper. Default 6. */
  rows?: number;
  /** A share of blades drawn as thin dark strokes in this color: the hairline accents of a lawn. */
  accent?: { color: string; share: number };
  /** Paper treatment of each row. Default: a soft shadow, light texture, no edge line. */
  sheet?: SheetOpts;
}

/**
 * A lawn as one living mass: many overlapping tapered blades in rows, each dark at the root and light
 * at the tip, leaning one way together, with broad patches of light and shade. Blades come from a hash
 * of their cell, so they stay put while the camera pans; gusts travel across the field as a wave, and
 * blades part around `pushers` (feet, bodies). Each row is cut as one sheet of paper.
 */
export function drawSward(paper: Paper, s: SwardSpec, from: number, to: number, wind: (x: number) => number, t: number, pushers: V[] = []): void {
  const step = 100 / s.density, n = s.rows ?? 6, depth = s.depth ?? 0, grow = s.grow ?? 0, T = s.tones.length;
  const clump = s.clump ?? 0.35, lean = s.lean ?? 0.2, jitter = s.jitter ?? 0.15, curl = s.curl ?? 0.35, flex = s.flex ?? 1;
  const patches = s.patches ?? 420;
  const rows = Array.from({ length: n }, () => ({ tones: s.tones.map(() => new Path2D()), accent: new Path2D(), top: Infinity, bottom: -Infinity, len: 0, count: 0 }));
  const k0 = Math.floor((from - 200) / step), k1 = Math.ceil((to + 200) / step);
  for (let k = k0; k <= k1; k++) {
    const h = (i: number) => hash(k * 7919 + s.seed * 104729 + i * 15485863);
    const x = (k + h(0)) * step, g = s.ground(x);
    if (g === null) continue;
    const u = h(1), y = g + u * depth, near = 1 + u * grow;
    if (s.keep && !s.keep(x, y)) continue;
    const tuft = 1 + clump * noise1(x * 0.015, s.seed);
    if (s.patchy && h(8) < s.patchy * (0.5 - 0.5 * noise1(x * 0.02 + u * 3, s.seed + 4))) continue;
    const len = (s.height[0] + h(2) * (s.height[1] - s.height[0])) * near * Math.max(0.3, tuft);
    const w = (s.width[0] + h(3) * (s.width[1] - s.width[0])) * near;
    let bend = 0;
    for (const q of pushers) bend += pushBend(x, g, q);
    const gust = noise1(x * 0.003 - t * 0.8, s.seed + 1) * 0.22 + noise1(t * 1.7 + x * 0.03, s.seed + 2) * 0.05;
    const a = lean + (h(4) - 0.5) * 2 * jitter + (wind(x) * 0.002 + gust) * flex + bend;
    const c = Math.sign(a || 1) * curl * (0.4 + h(5));
    // Walk up the blade: the lean grows from the root and the curl takes over near the tip.
    const pts: V[] = [{ x, y }];
    let px = x, py = y;
    for (let j = 1; j <= 3; j++) {
      const v = j / 3, ang = a * (0.35 + 0.65 * v) + c * v * v;
      px += Math.sin(ang) * len / 3; py -= Math.cos(ang) * len / 3;
      pts.push({ x: px, y: py });
    }
    const row = rows[Math.min(n - 1, Math.floor(u * n))];
    if (s.accent && h(6) < s.accent.share) blade(row.accent, pts, Math.max(1, w * 0.3));
    else {
      // Light and shade come in broad patches, dithered so the tones melt into each other.
      const light = fbm1(x / patches + u * 0.6, s.seed + 3) * 0.5 + 0.5 + (h(7) - 0.5) * 0.45;
      blade(row.tones[Math.max(0, Math.min(T - 1, Math.floor(light * T)))], pts, w);
    }
    row.top = Math.min(row.top, py - 10); row.bottom = Math.max(row.bottom, y + 4);
    row.len += len; row.count++;
  }
  for (const row of rows) {
    if (!row.count) continue;
    const bounds = [{ x: from - 250, y: row.top }, { x: to + 250, y: row.top }, { x: to + 250, y: row.bottom }, { x: from - 250, y: row.bottom }];
    const reach = row.len / row.count;
    paper.sheet(s.sheet ?? { shadow: 3, edge: false, texture: 0.18 }, () => {
      s.tones.forEach(([root, tip], i) => {
        const g = paper.context.createLinearGradient(0, row.bottom - 4, 0, row.bottom - 4 - reach * 1.1);
        g.addColorStop(0, root); g.addColorStop(1, tip);
        paper.fill(row.tones[i], g, bounds);
      });
      if (s.accent) paper.fill(row.accent, s.accent.color, bounds);
    });
  }
}

/** A tapered blade along a 4-point spine: out one side to the tip, back down the other. */
function blade(path: Path2D, p: V[], w: number): void {
  const side = (i: number, k: number): V => {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const half = (w / 2) * [1, 0.8, 0.45, 0][i] * k;
    return { x: p[i].x - (dy / l) * half, y: p[i].y + (dx / l) * half };
  };
  const l1 = side(1, 1), l2 = side(2, 1), r1 = side(1, -1), r2 = side(2, -1), base = side(0, 1), end = side(0, -1), tip = p[3];
  path.moveTo(base.x, base.y);
  path.quadraticCurveTo(l1.x, l1.y, (l1.x + l2.x) / 2, (l1.y + l2.y) / 2);
  path.quadraticCurveTo(l2.x, l2.y, tip.x, tip.y);
  path.quadraticCurveTo(r2.x, r2.y, (r1.x + r2.x) / 2, (r1.y + r2.y) / 2);
  path.quadraticCurveTo(r1.x, r1.y, end.x, end.y);
  path.closePath();
}
