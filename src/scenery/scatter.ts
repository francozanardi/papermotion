import { type V, smoothstep } from '../core/math';
import { type Range, noise1, rng, within } from '../core/random';
import type { Paper } from '../paper/Paper';

/** A placed piece of scenery; `sway` is its bend from wind and pushes (radians-ish, small). */
export interface Prop {
  x: number;
  y: number;
  draw(paper: Paper, sway: number, t: number): void;
}

/** Builds one prop at (x, y) from a seeded random source: the unit of procedural scenery. */
export type PropMaker = (r: () => number, x: number, y: number, seed: number) => Prop;

/** Props laid along a layer, with how much the wind bends them. */
export interface PropSet { props: Prop[]; flex: number }

export interface ScatterSpec {
  seed: number;
  from: number;
  to: number;
  spacing: Range;
  /** Ground height at x (props are planted there). */
  ground: (x: number) => number;
  makers: { make: PropMaker; weight: number }[];
  /** How much the wind bends this layer's props. */
  flex?: number;
  /** Keep-out ranges (layer x) — clear the background behind key moments. */
  avoid?: Range[];
}

/** Distribute props along a layer. Deterministic for a given seed. */
export function scatter(s: ScatterSpec): PropSet {
  const r = rng(s.seed);
  const total = s.makers.reduce((a, m) => a + m.weight, 0);
  const props: Prop[] = [];
  let i = 0;
  for (let x = s.from; x < s.to; x += within(r, s.spacing)) {
    let pickW = r() * total;
    const m = s.makers.find(mk => (pickW -= mk.weight) <= 0) ?? s.makers[0];
    if (s.avoid?.some(([a, b]) => x >= a && x <= b)) continue;
    props.push(m.make(r, x, s.ground(x) + 3, s.seed * 1000 + i++ * 17));
  }
  return { props, flex: s.flex ?? 1 };
}

/** How far (px) a pusher bends props around it, sideways and above the ground. */
const PUSH_REACH = 90, PUSH_HEIGHT = 140;

/**
 * Bend of something rooted at (x, y) from a body passing through it: zero right on top and far away,
 * strongest just to either side, and fading as the body rises off the ground. Continuous, so nothing
 * snaps.
 */
export function pushBend(x: number, y: number, by: V): number {
  const s = (x - by.x) / PUSH_REACH;
  if (Math.abs(s) >= 1) return 0;
  const lift = 1 - smoothstep(0, PUSH_HEIGHT, y - by.y);
  return s * (1 - s * s) ** 2 * 2.1 * lift;
}

/** Draw props within [from, to], bending with the wind and around anything pushing through them (feet, bodies). */
export function drawProps(paper: Paper, set: PropSet, from: number, to: number, wind: (x: number) => number, t: number, pushers: V[] = []): void {
  for (const p of set.props) {
    if (p.x < from - 200 || p.x > to + 200) continue;
    let bend = 0;
    for (const q of pushers) bend += pushBend(p.x, p.y, q);
    const sway = (wind(p.x) * 0.002 + noise1(t * 1.4 + p.x * 0.013, 13) * 0.1) * set.flex + bend;
    p.draw(paper, sway, t);
  }
}
