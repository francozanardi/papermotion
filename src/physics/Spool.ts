import type { V } from '../core/math';
import { type Link, type PointOpts, type Pt, World } from './World';

export interface SpoolOpts extends PointOpts {
  /** Length of each new segment (px). */
  segment: number;
}

/**
 * A line that pays out: tied at one end, fed from a moving source at the other (yarn unravelling
 * from a scarf, a kite line off a reel, a fishing line, a hose). As the source moves away, new
 * segments are added right behind it, so the line lies where it was laid and never pulls back.
 * Call `update` every step, before `world.step`.
 */
export class Spool {
  readonly pts: Pt[];
  private readonly feed: Pt;
  private readonly last: Link;
  private laid = 0;

  constructor(private readonly world: World, anchor: V, private readonly source: () => V, private readonly o: SpoolOpts) {
    const s = source();
    const tied = world.point(anchor.x, anchor.y, { mass: Infinity });
    this.feed = world.point(s.x, s.y, { mass: Infinity });
    this.last = world.link(tied, this.feed, 1, true, Math.max(o.segment, Math.hypot(s.x - anchor.x, s.y - anchor.y)));
    this.pts = [tied, this.feed];
  }

  /** Length of line out so far (px). */
  get paid(): number {
    return this.laid * this.o.segment + this.last.len;
  }

  update(): void {
    const s = this.source();
    World.drive(this.feed, s.x, s.y);
    const prev = this.last.a;
    const d = Math.hypot(s.x - prev.x, s.y - prev.y);
    if (d <= this.o.segment * 1.5) { this.last.len = Math.max(this.last.len, Math.min(d, this.o.segment * 1.5)); return; }
    // Lay down new points along the way to the source, each one segment from the last.
    const n = Math.floor(d / this.o.segment) - 1;
    let from = prev;
    for (let i = 1; i <= n; i++) {
      const u = (i * this.o.segment) / d;
      const p = this.world.point(prev.x + (s.x - prev.x) * u, prev.y + (s.y - prev.y) * u, this.o);
      this.world.link(from, p, 1, false, this.o.segment);
      this.pts.splice(this.pts.length - 1, 0, p);
      this.laid++;
      from = p;
    }
    this.last.a = from;
    this.last.len = Math.hypot(s.x - from.x, s.y - from.y);
  }
}
