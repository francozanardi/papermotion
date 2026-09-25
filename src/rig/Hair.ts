import type { V } from '../core/math';
import { rng } from '../core/random';
import type { Paper } from '../paper/Paper';
import { type Pt, World } from '../physics/World';

export interface LockSpec {
  /** Root position on the scalp circle, degrees in the head frame (0 = forward, -90 = up). */
  angle: number;
  length: number;
  width: number;
  /** Rest direction relative to the scalp normal, degrees (+ = clockwise). */
  comb: number;
  /** Extra rotation per segment, degrees (curl). */
  curl: number;
  layer: 'under' | 'over';
  /** Palette index: 0 = shadow tone … n = light tone. */
  tone: number;
  /** Scalp radius multiplier for the root. */
  inset?: number;
  /** How firmly the lock keeps its style (1 = default). */
  hold?: number;
}

export interface HairStyle {
  locks: LockSpec[];
  /** Dark → light tones. */
  palette: string[];
  sheen: string;
  /** Each declared lock becomes `density` locks with seeded variation. */
  density: number;
  /** Variation amount: angle (deg), length and width (fractions). */
  jitter: { angle: number; length: number; width: number };
}

export interface HairMaterial {
  /** Pull toward the styled shape at the root; decays toward the tip. */
  hold: number;
  drag: number;
  segments: number;
  /** Resistance to folding (skip-links between every other point). */
  bend: number;
}

interface Lock { spec: LockSpec; pts: Pt[]; rest: V[]; color: string; sheen: boolean }

/** Leaf-shaped lock: narrow root tucked into the scalp, belly at a third, pointed tip. */
const lockWidth = (w: number) => (u: number) => (u < 0.3 ? w * (0.55 + 0.45 * (u / 0.3)) : w * (1 - ((u - 0.3) / 0.7) ** 1.25 * 0.94));

/**
 * Hair as individual locks. Each lock is a short Verlet strand that remembers its styled shape
 * (in head space), resists folding, and lags, flows and whips with motion and wind.
 */
export class Hair {
  private readonly locks: Lock[] = [];

  constructor(
    world: World,
    private readonly frame: () => (p: V) => V,
    private readonly radius: number,
    private readonly style: HairStyle,
    private readonly material: HairMaterial,
    private readonly seed: number,
  ) {
    const f = frame();
    const r = rng(seed);
    const j = style.jitter;
    for (const base of style.locks) {
      for (let d = 0; d < style.density; d++) {
        const spec: LockSpec = {
          ...base,
          angle: base.angle + (r() - 0.5) * 2 * j.angle,
          length: base.length * (1 + (r() - 0.5) * 2 * j.length),
          width: base.width * (1 + (r() - 0.5) * 2 * j.width),
          curl: base.curl * (0.7 + r() * 0.6),
        };
        const tone = Math.min(style.palette.length - 1, Math.max(0, spec.tone + (r() > 0.7 ? 1 : 0) - (r() > 0.8 ? 1 : 0)));
        const rest = this.restShape(spec);
        const pts = rest.map((p, i) => {
          const w = f(p);
          return world.point(w.x, w.y, i === 0 ? { mass: Infinity } : { mass: 0.04, drag: material.drag, gravity: 0.5 });
        });
        for (let i = 1; i < pts.length; i++) world.link(pts[i - 1], pts[i], 0.95);
        for (let i = 2; i < pts.length; i++) world.link(pts[i - 2], pts[i], material.bend);
        this.locks.push({ spec, pts, rest, color: style.palette[tone], sheen: spec.layer === 'over' && tone >= style.palette.length - 2 && r() > 0.35 });
      }
    }
    world.forces.push(dt => this.holdShape(dt));
  }

  private restShape(s: LockSpec): V[] {
    const a = (s.angle * Math.PI) / 180;
    const r = this.radius * (s.inset ?? 0.9);
    let p: V = { x: Math.cos(a) * r, y: Math.sin(a) * r };
    const pts = [p];
    const seg = s.length / this.material.segments;
    let dir = a + (s.comb * Math.PI) / 180;
    for (let i = 0; i < this.material.segments; i++) {
      p = { x: p.x + Math.cos(dir) * seg, y: p.y + Math.sin(dir) * seg };
      pts.push(p);
      dir += (s.curl * Math.PI) / 180;
    }
    return pts;
  }

  /** Pin roots to the scalp and pull each point toward its styled rest position. */
  private holdShape(dt: number): void {
    const f = this.frame();
    const n = this.material.segments;
    for (const lock of this.locks) {
      const root = f(lock.rest[0]);
      World.drive(lock.pts[0], root.x, root.y);
      const hold = this.material.hold * (lock.spec.hold ?? 1);
      for (let i = 1; i <= n; i++) {
        const p = lock.pts[i], target = f(lock.rest[i]);
        const k = hold * (1 - ((i - 1) / n) * 0.6);
        const vx = (p.x - p.px) / dt, vy = (p.y - p.py) / dt;
        p.ax += k * (target.x - p.x) - 6 * vx;
        p.ay += k * (target.y - p.y) - 6 * vy;
      }
    }
  }

  draw(paper: Paper, layer: 'under' | 'over'): void {
    this.locks.forEach((lock, i) => {
      if (lock.spec.layer !== layer) return;
      const w = lock.spec.width;
      paper.ribbon(lock.pts, lockWidth(w), lock.color, { seed: this.seed + i, tear: 0.7, shadow: layer === 'over' ? 4 : 2, edge: layer === 'over' && i % 4 === 0 });
      if (lock.sheen) {
        const sheenW = (u: number) => (u < 0.12 || u > 0.62 ? 0.3 : w * 0.16 * Math.sin(((u - 0.12) / 0.5) * Math.PI));
        paper.ribbon(lock.pts, sheenW, this.style.sheen, { seed: this.seed + 500 + i, tear: 0.3, shadow: 0, edge: false, texture: 0 });
      }
    });
  }
}
