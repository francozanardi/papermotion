import type { V } from '../core/math';
import { rng } from '../core/random';
import type { Paper } from '../paper/Paper';
import type { World } from '../physics/World';
import { Strand } from './Strand';

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

interface Lock { spec: LockSpec; strand: Strand; color: string; sheen: boolean }

/** Leaf-shaped lock: narrow root tucked into the scalp, belly at a third, pointed tip. */
const lockWidth = (w: number) => (u: number) => (u < 0.3 ? w * (0.55 + 0.45 * (u / 0.3)) : w * (1 - ((u - 0.3) / 0.7) ** 1.25 * 0.94));

/**
 * Hair as individual locks. Each lock is a `Strand` that remembers its styled shape
 * (in head space), resists folding, and lags, flows and whips with motion and wind.
 */
export class Hair {
  private readonly locks: Lock[] = [];

  constructor(
    world: World,
    frame: () => (p: V) => V,
    private readonly radius: number,
    private readonly style: HairStyle,
    private readonly material: HairMaterial,
    private readonly seed: number,
  ) {
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
        const strand = new Strand(world, frame, this.restShape(spec), { hold: material.hold, drag: material.drag, bend: material.bend });
        strand.strength = spec.hold ?? 1;
        this.locks.push({ spec, strand, color: style.palette[tone], sheen: spec.layer === 'over' && tone >= style.palette.length - 2 && r() > 0.35 });
      }
    }
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

  /**
   * How firmly the hair keeps its style and body, 0…1 (default 1). Lower it for wet hair that hangs and
   * clings, or when the head lies down and the hair should fall with gravity instead of standing up.
   */
  set strength(k: number) {
    for (const lock of this.locks) { lock.strand.strength = (lock.spec.hold ?? 1) * k; lock.strand.flex = Math.min(1, k); }
  }

  draw(paper: Paper, layer: 'under' | 'over'): void {
    this.locks.forEach((lock, i) => {
      if (lock.spec.layer !== layer) return;
      const w = lock.spec.width;
      paper.ribbon(lock.strand.pts, lockWidth(w), lock.color, { seed: this.seed + i, tear: 0.7, shadow: layer === 'over' ? 4 : 2, edge: layer === 'over' && i % 4 === 0 });
      if (lock.sheen) {
        const sheenW = (u: number) => (u < 0.12 || u > 0.62 ? 0.3 : w * 0.16 * Math.sin(((u - 0.12) / 0.5) * Math.PI));
        paper.ribbon(lock.strand.pts, sheenW, this.style.sheen, { seed: this.seed + 500 + i, tear: 0.3, shadow: 0, edge: false, texture: 0 });
      }
    });
  }
}
