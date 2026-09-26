import type { V } from '../core/math';
import { type Range, rng, within } from '../core/random';

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  /** Seconds alive, and lifetime. */
  age: number; life: number;
  size: number;
  /** A stable random number per particle, for per-particle looks. */
  seed: number;
  /** Came to rest on the floor. */
  landed: boolean;
}

export interface ParticleOpts {
  seed: number;
  /** px/s²; negative rises (steam, breath). */
  gravity: number;
  /** Fraction of velocity lost per second to air. */
  drag: number;
  /** Where particles stop (they stick: mud, drops); leave out to fall forever. */
  floor?: (x: number) => number;
  /** Air or water they drift with: drag pulls their velocity toward this (seeds in the wind, bubbles in a current). */
  flow?: (x: number, y: number) => V;
}

export interface Burst {
  /** Mean direction (rad) and spread around it (rad). */
  angle: number;
  spread: number;
  speed: Range;
  life: Range;
  size: Range;
  /** Velocity added to every particle (the emitter's own motion). */
  carry?: V;
}

/**
 * Short-lived specks: splashes of mud or water, spray from a wheel, breath in the cold, sparks.
 * Seeded and stepped with the scene, so every render is the same. Drawing is up to the caller.
 */
export class Particles {
  readonly list: Particle[] = [];
  private readonly r: () => number;

  constructor(private readonly o: ParticleOpts) {
    this.r = rng(o.seed);
  }

  emit(at: V, count: number, b: Burst): void {
    const r = this.r;
    for (let i = 0; i < count; i++) {
      const a = b.angle + (r() - 0.5) * b.spread, v = within(r, b.speed);
      this.list.push({
        x: at.x, y: at.y, vx: Math.cos(a) * v + (b.carry?.x ?? 0), vy: Math.sin(a) * v + (b.carry?.y ?? 0),
        age: 0, life: within(r, b.life), size: within(r, b.size), seed: r(), landed: false,
      });
    }
  }

  update(dt: number): void {
    const k = Math.exp(-this.o.drag * dt);
    for (const p of this.list) {
      p.age += dt;
      if (p.landed) continue;
      const air = this.o.flow?.(p.x, p.y) ?? { x: 0, y: 0 };
      p.vx = air.x + (p.vx - air.x) * k;
      p.vy = air.y + (p.vy - air.y) * k + this.o.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const f = this.o.floor?.(p.x);
      if (f !== undefined && p.y >= f) { p.y = f; p.landed = true; }
    }
    for (let i = this.list.length - 1; i >= 0; i--) if (this.list[i].age >= this.list[i].life) this.list.splice(i, 1);
  }

  /** Visit live particles with their age as 0…1 of their life. */
  draw(each: (p: Particle, u: number) => void): void {
    for (const p of this.list) each(p, p.age / p.life);
  }
}
