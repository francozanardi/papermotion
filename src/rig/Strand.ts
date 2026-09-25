import type { V } from '../core/math';
import { type Link, type Pt, World } from '../physics/World';

export interface StrandMaterial {
  /** Pull toward the rest shape at the root (1/s²); fades toward the tip. */
  hold: number;
  drag: number;
  /** Resistance to folding (skip-links between every other point), 0…1. */
  bend: number;
  mass?: number;
  gravity?: number;
  /** How much weaker the hold is at the tip than at the root (0 = even, 1 = none at the tip). */
  falloff?: number;
}

/**
 * A strand that remembers its shape: a Verlet chain whose root rides a moving frame (a head, a hip)
 * and whose points are pulled toward a rest shape in that frame. It lags, flows and whips with
 * motion and wind, then settles back. Locks of hair, tails, antennae, whiskers, feathers.
 */
export class Strand {
  readonly pts: Pt[];
  private readonly bends: Link[] = [];

  /**
   * @param frame returns the current local → world mapping of the frame the strand grows from.
   * @param rest the styled shape in that frame; `rest[0]` is the root. Replace it (same length) to re-pose.
   */
  constructor(world: World, private readonly frame: () => (p: V) => V, public rest: V[], private readonly m: StrandMaterial) {
    const f = frame();
    this.pts = rest.map((p, i) => {
      const w = f(p);
      return world.point(w.x, w.y, i === 0 ? { mass: Infinity } : { mass: m.mass ?? 0.04, drag: m.drag, gravity: m.gravity ?? 0.5 });
    });
    for (let i = 1; i < this.pts.length; i++) world.link(this.pts[i - 1], this.pts[i], 0.95);
    for (let i = 2; i < this.pts.length; i++) this.bends.push(world.link(this.pts[i - 2], this.pts[i], m.bend));
    world.forces.push(dt => this.hold(dt, this.m.hold));
  }

  /** Scale the hold for this strand (e.g. a fringe that keeps its shape better). */
  strength = 1;

  /**
   * Scale the resistance to folding, 0…1 (default 1). With many solver iterations even soft skip-links
   * make a strand springy; lower it for one that should drape, fold and pile up like cloth (a wet
   * scarf end on the ground, soaked hair). Pair it with a lower `strength` so the style lets go too.
   */
  set flex(k: number) {
    for (const l of this.bends) l.stiff = this.m.bend * k;
  }

  private hold(dt: number, hold: number): void {
    const f = this.frame(), n = this.pts.length - 1, falloff = this.m.falloff ?? 0.6;
    const root = f(this.rest[0]);
    World.drive(this.pts[0], root.x, root.y);
    for (let i = 1; i <= n; i++) {
      const p = this.pts[i], target = f(this.rest[i]);
      const k = hold * this.strength * (1 - ((i - 1) / n) * falloff);
      const vx = (p.x - p.px) / dt, vy = (p.y - p.py) / dt;
      p.ax += k * (target.x - p.x) - 6 * vx;
      p.ay += k * (target.y - p.y) - 6 * vy;
    }
  }
}
