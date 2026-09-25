import { type V, rot } from '../core/math';
import { type PointOpts, type Pt, World } from './World';

export interface SoftOpts extends PointOpts {
  /** Pull toward the best-fit rest shape (1/s²). */
  stiffness: number;
  /** Damping of motion relative to the body (not of the body drifting). */
  damping?: number;
  /** 0 = free to rotate, 1 = always held at `uprightAngle`. */
  upright?: number;
}

const centroid = (pts: V[]): V => {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
};

/**
 * A closed deformable body (jelly bell, balloon, blob) held together by shape matching: every step
 * it finds the best-fit rotation of its rest shape and pulls each point toward it. Animate `rest`
 * to make it pulse, squash or breathe; colliders dent it and it springs back.
 */
export class SoftBody {
  readonly pts: Pt[];
  /** Local rest shape; replace it (same length) to animate the body. */
  rest: V[];
  angle: number;
  uprightAngle = 0;

  constructor(world: World, shape: V[], at: V, angle: number, private readonly o: SoftOpts) {
    this.rest = shape;
    this.angle = angle;
    const c = centroid(shape);
    this.pts = shape.map(p => {
      const w = rot({ x: p.x - c.x, y: p.y - c.y }, angle);
      return world.point(at.x + w.x, at.y + w.y, o);
    });
    world.forces.push(dt => this.match(dt));
  }

  get center(): V { return centroid(this.pts); }

  /** Body-space direction (e.g. {x:0,y:-1} = "up" for the body) in world space. */
  axis(local: V): V { return rot(local, this.angle); }

  /** World position of a point given in rest-shape coordinates, in the current best-fit frame. */
  toWorld(p: V): V {
    const c = this.center, rc = centroid(this.rest);
    const w = rot({ x: p.x - rc.x, y: p.y - rc.y }, this.angle);
    return { x: c.x + w.x, y: c.y + w.y };
  }

  private match(dt: number): void {
    const c = this.center, rc = centroid(this.rest);
    let dot = 0, cross = 0, mvx = 0, mvy = 0;
    this.pts.forEach((p, i) => {
      const qx = p.x - c.x, qy = p.y - c.y, rx = this.rest[i].x - rc.x, ry = this.rest[i].y - rc.y;
      dot += rx * qx + ry * qy;
      cross += rx * qy - ry * qx;
      mvx += p.x - p.px; mvy += p.y - p.py;
    });
    mvx /= this.pts.length; mvy /= this.pts.length;
    let a = Math.atan2(cross, dot);
    if (this.o.upright) a += Math.atan2(Math.sin(this.uprightAngle - a), Math.cos(this.uprightAngle - a)) * this.o.upright;
    this.angle = a;
    const k = this.o.stiffness, d = this.o.damping ?? 10;
    this.pts.forEach((p, i) => {
      const t = rot({ x: this.rest[i].x - rc.x, y: this.rest[i].y - rc.y }, a);
      const vx = (p.x - p.px - mvx) / dt, vy = (p.y - p.py - mvy) / dt;
      p.ax += k * (c.x + t.x - p.x) - d * vx;
      p.ay += k * (c.y + t.y - p.y) - d * vy;
    });
  }
}
