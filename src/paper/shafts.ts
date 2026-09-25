import { noise1, rng } from '../core/random';
import type { Paper } from './Paper';

export interface ShaftSpec {
  seed: number;
  /** One shaft per `every` px of layer x (randomly placed inside its cell). */
  every: number;
  /** Layer y where shafts start (above the frame) and their length range. */
  top: number;
  length: [number, number];
  width: [number, number];
  /** Tilt (rad), following the scene light. */
  angle: number;
  /** RGB of the light, e.g. [210, 250, 238]. */
  color: [number, number, number];
  /** Peak opacity at the top; shafts fade out along their length and shimmer over time. */
  alpha: number;
}

/**
 * Light shafts (sun through water, a window, a forest canopy) as strips of tracing paper,
 * screened over whatever is behind. Deterministic per cell, so they don't pop while panning.
 */
export function drawShafts(paper: Paper, s: ShaftSpec, from: number, to: number, t: number): void {
  paper.layer(1, () => {
    const ctx = paper.context;
    for (let cell = Math.floor(from / s.every) - 2; cell * s.every < to + s.every; cell++) {
      const r = rng(s.seed * 7717 + cell);
      const x = cell * s.every + r() * s.every;
      const len = s.length[0] + r() * (s.length[1] - s.length[0]);
      const w = s.width[0] + r() * (s.width[1] - s.width[0]);
      const a = s.angle + noise1(t * 0.25 + cell, s.seed) * 0.03;
      const shimmer = 0.55 + 0.45 * noise1(t * 0.6 + cell * 3.1, s.seed + 1);
      const dx = Math.sin(a), dy = Math.cos(a);
      const end = { x: x - dx * len, y: s.top + dy * len };
      const g = ctx.createLinearGradient(x, s.top, end.x, end.y);
      const rgba = (a: number) => `rgba(${s.color.join(', ')}, ${a})`;
      g.addColorStop(0, rgba(s.alpha * shimmer));
      g.addColorStop(0.55, rgba(s.alpha * shimmer * 0.35));
      g.addColorStop(1, rgba(0));
      const w0 = w * 0.55, w1 = w * 1.35;
      paper.piece([
        { x: x - w0 / 2, y: s.top }, { x: x + w0 / 2, y: s.top },
        { x: end.x + (w1 / 2) * dy, y: end.y }, { x: end.x - (w1 / 2) * dy, y: end.y },
      ], g, { seed: s.seed + cell, tear: 3, shadow: 0, edge: false, texture: 0.2 });
    }
  }, 'screen');
}
