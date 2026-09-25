import type { V } from '../core/math';
import type { Surface } from './Surface';

export interface Pt {
  x: number; y: number;
  px: number; py: number;
  /** Extra acceleration for this step (px/s²), cleared after integration. */
  ax: number; ay: number;
  invMass: number;
  /** Per-step blend of velocity toward the local wind velocity (air drag). */
  drag: number;
  /** Vertical drag; paper falls slowly edge-on but slides easily face-on. */
  dragY: number;
  friction: number;
  gravity: number;
  grounded: boolean;
}

/**
 * A kinematic circle that pushes points out (a fish's nose, a hand, a ball).
 * Hard colliders (default) project points out immediately; a `soft` collider pushes with a spring
 * of that stiffness (px/s² per px of overlap), so fast bodies bend strands instead of snapping them.
 */
export interface Collider { x: number; y: number; r: number; soft?: number }

/** A distance constraint. Its ends and length may be changed later (a line paying out, a rope reeled in). */
export interface Link { a: Pt; b: Pt; len: number; stiff: number; rope: boolean }

export interface PointOpts { mass?: number; drag?: number; dragY?: number; friction?: number; gravity?: number }

/**
 * Minimal Verlet world: points, distance links, wind drag, a ground line, one-way surfaces
 * and colliders. Fixed timestep, deterministic.
 */
export class World {
  readonly pts: Pt[] = [];
  readonly links: Link[] = [];
  readonly forces: ((dt: number, t: number) => void)[] = [];
  gravity = 1400;
  iterations = 32;
  wind: (x: number, y: number, t: number) => V = () => ({ x: 0, y: 0 });
  ground: (x: number) => number = () => 1e9;
  /** Platforms above the ground (roofs, branches): landed on from above, passed through from below. */
  readonly surfaces: Surface[] = [];
  readonly colliders: Collider[] = [];

  point(x: number, y: number, o: PointOpts = {}): Pt {
    const p: Pt = {
      x, y, px: x, py: y, ax: 0, ay: 0,
      invMass: o.mass === Infinity ? 0 : 1 / (o.mass ?? 1),
      drag: o.drag ?? 0.01, dragY: o.dragY ?? o.drag ?? 0.01, friction: o.friction ?? 0.5, gravity: o.gravity ?? 1, grounded: false,
    };
    this.pts.push(p);
    return p;
  }

  link(a: Pt, b: Pt, stiff = 1, rope = false, length?: number): Link {
    const l = { a, b, stiff, rope, len: length ?? Math.hypot(b.x - a.x, b.y - a.y) };
    this.links.push(l);
    return l;
  }

  /** A hanging chain starting at `from` (included), extending along `dir`. */
  chain(from: Pt, count: number, seg: number, dir: V, o: PointOpts = {}, stiff = 1, rope = false): Pt[] {
    const pts = [from];
    for (let i = 1; i <= count; i++) {
      const p = this.point(from.x + dir.x * seg * i, from.y + dir.y * seg * i, o);
      this.link(pts[i - 1], p, stiff, rope, seg);
      pts.push(p);
    }
    return pts;
  }

  /**
   * The floor under a point: the highest surface at x that is at or below y (or the ground).
   * Walkers query it slightly above their feet so they can climb gentle slopes.
   */
  floorBelow(x: number, y: number): number {
    let floor = this.ground(x);
    for (const s of this.surfaces) {
      const h = s.heightAt(x);
      if (h !== undefined && h >= y && h < floor) floor = h;
    }
    return floor;
  }

  /** Move a kinematic point (invMass 0), carrying its velocity. */
  static drive(p: Pt, x: number, y: number): void {
    p.px = p.x; p.py = p.y; p.x = x; p.y = y;
  }

  step(dt: number, t: number): void {
    for (const f of this.forces) f(dt, t);
    if (this.colliders.length) this.pushSoft();
    this.integrate(dt, t);
    for (let i = 0; i < this.iterations; i++) {
      this.solveLinks(i % 2 === 1);
      this.collideGround();
      if (this.colliders.length) this.collideCircles();
    }
    this.applyFriction();
  }

  private integrate(dt: number, t: number): void {
    for (const p of this.pts) {
      if (p.invMass === 0) { p.ax = p.ay = 0; continue; }
      let vx = p.x - p.px, vy = p.y - p.py;
      const w = this.wind(p.x, p.y, t);
      vx += (w.x * dt - vx) * p.drag;
      vy += (w.y * dt - vy) * p.dragY;
      p.px = p.x; p.py = p.y;
      p.x += vx + p.ax * dt * dt;
      p.y += vy + (this.gravity * p.gravity + p.ay) * dt * dt;
      p.ax = p.ay = 0;
    }
  }

  /** Alternating sweep direction converges long chains much faster under load. */
  private solveLinks(reverse: boolean): void {
    const n = this.links.length;
    for (let i = 0; i < n; i++) {
      const l = this.links[reverse ? n - 1 - i : i];
      const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      if (l.rope && d < l.len) continue;
      const w = l.a.invMass + l.b.invMass;
      if (w === 0) continue;
      const k = (l.stiff * (d - l.len)) / d / w;
      l.a.x += dx * k * l.a.invMass; l.a.y += dy * k * l.a.invMass;
      l.b.x -= dx * k * l.b.invMass; l.b.y -= dy * k * l.b.invMass;
    }
  }

  private collideGround(): void {
    for (const p of this.pts) {
      if (p.invMass === 0) continue;
      let floor = this.ground(p.x);
      for (const s of this.surfaces) {
        const h = s.heightAt(p.x);
        // One-way: only catch points that were on or above the surface when the step began.
        if (h !== undefined && h < floor && p.py <= (s.heightAt(p.px) ?? h) + 0.5) floor = h;
      }
      p.grounded = p.y >= floor;
      if (p.grounded) p.y = floor;
    }
  }

  private pushSoft(): void {
    for (const c of this.colliders) {
      if (!c.soft) continue;
      for (const p of this.pts) {
        if (p.invMass === 0) continue;
        const dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy;
        if (d2 >= c.r * c.r || d2 === 0) continue;
        const d = Math.sqrt(d2), k = (c.soft * (c.r - d)) / d;
        p.ax += dx * k; p.ay += dy * k;
      }
    }
  }

  private collideCircles(): void {
    for (const c of this.colliders) {
      if (c.soft) continue;
      for (const p of this.pts) {
        if (p.invMass === 0) continue;
        const dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy;
        if (d2 >= c.r * c.r || d2 === 0) continue;
        const k = c.r / Math.sqrt(d2);
        p.x = c.x + dx * k; p.y = c.y + dy * k;
      }
    }
  }

  private applyFriction(): void {
    for (const p of this.pts) {
      if (!p.grounded) continue;
      p.px = p.x - (p.x - p.px) * (1 - p.friction);
    }
  }
}
