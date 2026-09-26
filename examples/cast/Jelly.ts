import { type Paper, type Pt, type V, circlePoly, lerp, smoothstep, SoftBody, World } from '../../src';

export const BELL = 80;
const PERIOD = 1.6, SQUEEZE = 0.3, THRUST = 300;
const TENTACLES = 17, TENTACLE_SEGS = 6;

export interface JellyLook { bell: string; inner: string; rim: string; gonads: string; tentacle: string; arms: string }

/** Contraction 0…1 over one pulse (u in 0…1): a quick squeeze, then a slow relax. */
const contraction = (u: number) => (u < SQUEEZE ? smoothstep(0, SQUEEZE, u) : 1 - smoothstep(SQUEEZE, 1, u));

/** Bell outline for a contraction c: a dome that narrows at the margin and deepens when squeezed. */
function bellShape(c: number): V[] {
  const R = BELL, ry = R * 0.78 * (1 + 0.18 * c);
  const dome = Array.from({ length: 15 }, (_, i) => {
    const a = Math.PI + (i / 14) * Math.PI;
    const pinch = 1 - 0.32 * c * (1 - Math.abs(Math.sin(a)));
    return { x: Math.cos(a) * R * pinch * (1 - 0.06 * c), y: Math.sin(a) * ry };
  });
  const lip = R * (1 - 0.34 * c);
  const under = Array.from({ length: 5 }, (_, i) => {
    const x = lip * 0.92 * (1 - ((i + 1) / 6) * 2);
    return { x, y: -R * (0.2 + 0.12 * c) * (1 - (x / R) ** 2) };
  });
  return [...dome, ...under];
}

/**
 * A moon jelly: a soft bell that pulses (animated rest shape + thrust along its axis),
 * trailing tentacles and frilly oral arms as free strands in the water.
 */
export class Jelly {
  readonly body: SoftBody;
  readonly tentacles: Pt[][] = [];
  readonly arms: Pt[][] = [];
  private phase = 0.55;
  private period = PERIOD;
  private quick = 0;
  private squeeze = 0;

  constructor(world: World, at: V, private readonly look: JellyLook) {
    this.body = new SoftBody(world, bellShape(0), at, 0, { mass: 1, drag: 0.07, gravity: 0.03, stiffness: 320, damping: 14, upright: 0.04 });
    const rootOpts = { mass: Infinity };
    for (let i = 0; i < TENTACLES; i++) {
      const root = world.point(at.x, at.y, rootOpts);
      this.tentacles.push(world.chain(root, TENTACLE_SEGS, 9 + (i % 3) * 3, { x: 0, y: 1 }, { mass: 0.05, drag: 0.14, gravity: 0.25 }, 0.9));
    }
    for (let i = 0; i < 4; i++) {
      const root = world.point(at.x, at.y, rootOpts);
      this.arms.push(world.chain(root, 9, 17 + (i % 2) * 4, { x: 0, y: 1 }, { mass: 0.08, drag: 0.12, gravity: 0.3 }, 0.95));
    }
    world.forces.push(dt => this.swim(dt));
  }

  get center(): V { return this.body.center; }

  /** Something touched it: two quick pulses. */
  startle(): void {
    const u = this.phase % 1;
    if (u > SQUEEZE) this.phase = Math.floor(this.phase) + 1 + SQUEEZE * this.squeeze * 0.5;
    this.quick = 2;
  }

  private swim(dt: number): void {
    const before = Math.floor(this.phase);
    this.phase += dt / (this.quick > 0 ? this.period * 0.55 : this.period);
    if (Math.floor(this.phase) > before && this.quick > 0) this.quick--;
    const c = contraction(this.phase % 1);
    const dc = (c - this.squeeze) / dt;
    this.squeeze = c;
    this.body.rest = bellShape(c);

    const up = this.body.axis({ x: 0, y: -1 });
    const a = THRUST * dc * (dc > 0 ? 1 : 0.2);
    for (const p of this.body.pts) { p.ax += up.x * a; p.ay += up.y * a; }

    this.tentacles.forEach((strand, i) => {
      const k = i / (TENTACLES - 1);
      const p = this.body.toWorld({ x: lerp(-0.92, 0.92, k) * BELL * (1 - 0.34 * c), y: -2 });
      World.drive(strand[0], p.x, p.y);
    });
    this.arms.forEach((strand, i) => {
      const p = this.body.toWorld({ x: (i - 1.5) * 12, y: -BELL * 0.22 });
      World.drive(strand[0], p.x, p.y);
    });
  }

  draw(paper: Paper): void {
    const L = this.look, pts = this.body.pts;
    paper.layer(0.8, () => {
      this.tentacles.forEach((s, i) => paper.ribbon(s, u => 2.6 * (1 - u * 0.6), L.tentacle, { seed: 1200 + i, tear: 0.3, shadow: 0, edge: false, texture: 0 }));
      this.arms.forEach((s, i) => paper.ribbon(s, u => 15 * (1 - u * 0.65) * (0.72 + 0.28 * Math.sin(u * 26 + i)), L.arms, { seed: 1220 + i, tear: 0.8, shadow: 3, edge: false }));
      paper.piece(pts, L.bell, { seed: 1230, tear: 1.4, shadow: 8, rim: { color: L.rim, width: 8 } });
      const c = this.center, inner = pts.slice(0, 15).map(p => ({ x: c.x + (p.x - c.x) * 0.74, y: c.y + (p.y - c.y) * 0.74 - 6 }));
      paper.piece(inner, L.inner, { seed: 1231, tear: 1.2, shadow: 0, edge: false });
      const g = [[-26, -30], [-9, -42], [9, -42], [26, -30]].map(([x, y]) => this.body.toWorld({ x, y }));
      g.forEach((p, i) => paper.piece(circlePoly(p, 12, 14, 10), L.gonads, { seed: 1240 + i, tear: 1.5, shadow: 0, edge: false }));
    });
  }
}
