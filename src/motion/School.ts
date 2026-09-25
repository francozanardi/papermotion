import type { V } from '../core/math';
import { rng } from '../core/random';
import type { Collider } from '../physics/World';
import { type SwimSpec, Swimmer } from './Swimmer';

export interface SchoolSpec {
  seed: number;
  count: number;
  /** Spawn box (world). */
  spawn: { x: number; y: number; w: number; h: number };
  heading: V;
  swim: SwimSpec;
  /** Cruise speed as a fraction of maxSpeed, varied per member. */
  cruise: number;
  /** Neighbour radius (px) and rule weights. */
  radius: number;
  separation: number;
  alignment: number;
  cohesion: number;
  /** Where the school heads, and how strongly. */
  goal: (t: number) => V;
  goalWeight: number;
  /** Things to swim around: circles plus a margin. */
  avoid: () => Collider[];
  margin: number;
  /** Size multiplier range per member (also used as depth: small = farther). */
  size: [number, number];
}

export interface Member { swim: Swimmer; size: number; seed: number; pace: number }

/** A school of swimmers following boids rules: keep apart, match heading, stay together, go somewhere. */
export class School {
  readonly members: Member[] = [];

  constructor(private readonly s: SchoolSpec) {
    const r = rng(s.seed);
    for (let i = 0; i < s.count; i++) {
      const at = { x: s.spawn.x + r() * s.spawn.w, y: s.spawn.y + r() * s.spawn.h };
      const swim = new Swimmer(at, s.swim, Math.sign(s.heading.x) || 1, i);
      const pace = s.cruise * (0.85 + r() * 0.3);
      swim.vel.x = s.heading.x * s.swim.maxSpeed * pace;
      swim.vel.y = s.heading.y * s.swim.maxSpeed * pace;
      this.members.push({ swim, size: s.size[0] + r() * (s.size[1] - s.size[0]), seed: i * 31 + s.seed, pace });
    }
  }

  get center(): V {
    let x = 0, y = 0;
    for (const m of this.members) { x += m.swim.pos.x; y += m.swim.pos.y; }
    return { x: x / this.members.length, y: y / this.members.length };
  }

  get velocity(): V {
    let x = 0, y = 0;
    for (const m of this.members) { x += m.swim.vel.x; y += m.swim.vel.y; }
    return { x: x / this.members.length, y: y / this.members.length };
  }

  update(dt: number, t: number, flow: (x: number, y: number) => V): void {
    const obstacles = this.s.avoid();
    const goal = this.s.goal(t);
    for (const m of this.members) m.swim.steer(this.desire(m, goal, obstacles));
    for (const m of this.members) m.swim.update(dt, flow(m.swim.pos.x, m.swim.pos.y));
  }

  private desire(m: Member, goal: V, obstacles: Collider[]): V {
    const s = this.s, p = m.swim.pos;
    let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
    for (const o of this.members) {
      if (o === m) continue;
      const dx = p.x - o.swim.pos.x, dy = p.y - o.swim.pos.y, d = Math.hypot(dx, dy);
      if (d > s.radius || d === 0) continue;
      n++;
      ax += o.swim.vel.x; ay += o.swim.vel.y;
      cx += o.swim.pos.x; cy += o.swim.pos.y;
      if (d < s.radius * 0.45) { sx += dx / (d * d); sy += dy / (d * d); }
    }
    let x = 0, y = 0;
    if (n) {
      const al = Math.hypot(ax, ay) || 1;
      x += (ax / al) * s.alignment + ((cx / n - p.x) / s.radius) * s.cohesion + sx * s.radius * s.separation;
      y += (ay / al) * s.alignment + ((cy / n - p.y) / s.radius) * s.cohesion + sy * s.radius * s.separation;
    }
    const gx = goal.x - p.x, gy = goal.y - p.y, gl = Math.hypot(gx, gy) || 1;
    x += (gx / gl) * s.goalWeight; y += (gy / gl) * s.goalWeight;
    for (const c of obstacles) {
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 1e-6;
      const k = 1 - (d - c.r) / s.margin;
      if (k > 0) { x += (dx / d) * k * 4; y += (dy / d) * k * 4; }
    }
    const l = Math.hypot(x, y) || 1, speed = s.swim.maxSpeed * m.pace;
    return { x: (x / l) * speed, y: (y / l) * speed };
  }
}
