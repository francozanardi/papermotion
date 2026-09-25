import { type V, rot, smoothstep } from '../core/math';
import { noise1 } from '../core/random';
import { type PointOpts, type Pt, World } from './World';

export interface AerofoilSpec {
  /** Upward acceleration per px/s of horizontal airspeed. */
  lift: number;
  /** Airspeed range over which lift fades in. */
  liftRange: [number, number];
  /** Noise torque/sway when the air is calm (falling leaf). */
  flutter: number;
  /** Turns the plate's axis to face the air, leaning downwind by `lean` rad. */
  weathervane: number;
  lean: number;
  seed: number;
}

/**
 * A rigid flat body made of linked points (kite, card, leaf, sign).
 * Optional aerofoil behaviour: lift with airspeed, weathervaning, flutter in calm air.
 */
export class Plate {
  readonly pts: Pt[];

  constructor(private readonly world: World, local: V[], center: V, angle: number, material: PointOpts) {
    this.pts = local.map(p => {
      const w = rot(p, angle);
      return world.point(center.x + w.x, center.y + w.y, material);
    });
    for (let i = 0; i < this.pts.length; i++) for (let j = i + 1; j < this.pts.length; j++) world.link(this.pts[i], this.pts[j]);
  }

  /** Axis given by two point indices (tail → nose). */
  aerofoil(spec: AerofoilSpec, nose: number, tail: number): this {
    this.world.forces.push((dt, t) => this.fly(spec, this.pts[nose], this.pts[tail], dt, t));
    return this;
  }

  private fly(s: AerofoilSpec, nose: Pt, tail: Pt, dt: number, t: number): void {
    const n = this.pts.length;
    let cx = 0, cy = 0, vx = 0, vy = 0;
    for (const p of this.pts) { cx += p.x; cy += p.y; vx += p.x - p.px; vy += p.y - p.py; }
    cx /= n; cy /= n; vx /= n * dt; vy /= n * dt;
    const w = this.world.wind(cx, cy, t);
    const rel = { x: w.x - vx, y: w.y - vy };
    const air = Math.hypot(rel.x, rel.y);

    const lift = s.lift * Math.abs(rel.x) * smoothstep(s.liftRange[0], s.liftRange[1], air);
    const calm = 1 - smoothstep(s.liftRange[0] * 1.5, s.liftRange[1], air);
    const sway = noise1(t * 1.3, s.seed) * s.flutter * 0.35 * calm * (this.pts.some(p => p.grounded) ? 0 : 1);
    for (const p of this.pts) { p.ay -= lift; p.ax += sway; }

    const landed = this.pts.some(p => p.grounded) ? 0 : 1;
    const flutter = noise1(t * 2.6, s.seed + 1) * s.flutter * calm * landed;
    const axis = Math.atan2(nose.x - tail.x, tail.y - nose.y);
    const align = (Math.sign(rel.x || 1) * s.lean - axis) * s.weathervane * smoothstep(s.liftRange[0], s.liftRange[1], air);
    // Flat things settle lying down: once grounded in calm air, tip toward the nearest side.
    const settle = landed ? 0 : (Math.sign(axis || 1) * Math.PI / 2 - axis) * s.weathervane * 0.25 * calm;
    nose.ax += flutter + align + settle; tail.ax -= flutter + align + settle;
  }
}
