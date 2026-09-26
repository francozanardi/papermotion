import type { V } from '../core/math';
import { type Range, fbm1, noise1, rng, within } from '../core/random';
import type { Paper } from '../paper/Paper';
import { circlePoly } from '../paper/geometry';

/** A band of land (hills, dunes, reef, seabed) as a noise ridge, with optional strata, patches and a grass edge. */
export interface RidgeSpec {
  seed: number;
  base: number;
  amp: number;
  /** Horizontal frequency (1/px). */
  freq: number;
  octaves?: number;
  color: string;
  tear?: number;
  shadow?: number;
  /** Paper strata below the surface: each band follows the ridge, `offset` px lower. */
  bands?: { offset: number; color: string; amp?: number }[];
  /** Flattened tone patches lying on the surface. */
  patches?: { color: string; size: Range; every: number };
  /** Serrated grass edge along the top. */
  fringe?: { color: string; height: number; spacing: number };
}

/** Surface height of a ridge at x. */
export const ridgeHeight = (s: RidgeSpec, x: number): number => s.base + fbm1(x * s.freq, s.seed, s.octaves ?? 3) * s.amp;

/** Draw a ridge between `from` and `to`, filled down to `bottom`. */
export function drawRidge(paper: Paper, s: RidgeSpec, from: number, to: number, bottom: number): void {
  const pts: V[] = [];
  const step = Math.max(12, 0.03 / s.freq);
  // Samples sit on a world grid, so the outline keeps its shape while the camera pans or zooms.
  from = Math.floor(from / step) * step;
  for (let x = from; x <= to + step; x += step) pts.push({ x, y: ridgeHeight(s, x) });
  pts.push({ x: to + step, y: bottom }, { x: from, y: bottom });
  paper.piece(pts, s.color, { seed: 600 + s.seed, tear: s.tear ?? 3, shadow: s.shadow ?? 12 });

  s.bands?.forEach((band, i) => {
    const bp: V[] = [];
    for (let x = from; x <= to + step; x += step) bp.push({ x, y: ridgeHeight(s, x) + band.offset + fbm1(x * s.freq * 2.3, s.seed + 20 + i) * (band.amp ?? 18) });
    bp.push({ x: to + step, y: bottom }, { x: from, y: bottom });
    paper.piece(bp, band.color, { seed: 640 + s.seed * 7 + i, tear: s.tear ?? 3, shadow: 8 });
  });

  if (s.patches) {
    const p = s.patches;
    for (let cell = Math.floor(from / p.every); cell * p.every < to; cell++) {
      const r = rng(s.seed * 7919 + cell);
      const x = cell * p.every + r() * p.every, w = within(r, p.size);
      const y = ridgeHeight(s, x) + 14 + r() * 50;
      paper.piece(circlePoly({ x, y }, w * 0.22, 16, w), p.color, { seed: 700 + cell, tear: 3, shadow: 0, edge: false });
    }
  }

  if (s.fringe) {
    const f = s.fringe, teeth: V[] = [];
    for (let x = from, k = 0; x <= to; x += f.spacing, k++) {
      const y = ridgeHeight(s, x);
      teeth.push({ x, y: y - (k % 2 ? f.height * (0.5 + noise1(x * 0.05, s.seed) * 0.4 + 0.3) : -2) });
    }
    for (let x = to; x >= from; x -= step) teeth.push({ x, y: ridgeHeight(s, x) + f.height * 0.8 });
    paper.piece(teeth, f.color, { seed: 660 + s.seed, tear: 0.6, shadow: 3, edge: false });
  }
}
