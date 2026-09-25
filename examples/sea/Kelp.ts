import { type Paper, type Pt, type V, circlePoly, noise1, rng, World } from '../../src';

export interface KelpLook { stalk: string; blades: string[]; bulb: string; rim: string }

interface Blade { at: number; side: number; length: number; color: string; phase: number }

/** A buoyant kelp stalk: a floating chain anchored to the seabed, with blades that stream in the current. */
export class Kelp {
  readonly stalk: Pt[];
  private readonly blades: Blade[] = [];

  constructor(world: World, base: V, height: number, private readonly look: KelpLook, private readonly seed: number) {
    const r = rng(seed), n = 14;
    const anchor = world.point(base.x, base.y, { mass: Infinity });
    this.stalk = world.chain(anchor, n, height / n, { x: 0, y: -1 }, { mass: 0.2, drag: 0.1, gravity: -0.9 }, 1);
    for (let i = 2; i <= n; i++) world.link(this.stalk[i - 2], this.stalk[i], 0.06);
    for (let i = 2; i <= n; i++) {
      this.blades.push({ at: i, side: i % 2 ? 1 : -1, length: 46 + r() * 44, color: look.blades[Math.floor(r() * look.blades.length)], phase: r() * 6 });
    }
  }

  draw(paper: Paper, t: number, flow: (x: number, y: number) => V): void {
    const s = this.stalk;
    paper.tube(s, 8, 3.5, this.look.stalk, { seed: this.seed, tear: 0.6, shadow: 6 });
    this.blades.forEach((b, i) => {
      const p = s[b.at], prev = s[b.at - 1], next = s[Math.min(s.length - 1, b.at + 1)];
      const tx = next.x - prev.x, ty = next.y - prev.y, tl = Math.hypot(tx, ty) || 1;
      const f = flow(p.x, p.y), fl = Math.hypot(f.x, f.y) || 1;
      const wave = noise1(t * 1.1 + b.phase, this.seed + i) * 0.5;
      let dx = (tx / tl) * 0.8 + (-ty / tl) * b.side * 0.7 + (f.x / fl) * 0.5, dy = (ty / tl) * 0.8 + (tx / tl) * b.side * 0.7 + (f.y / fl) * 0.5;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      const pts: V[] = [p];
      let a = Math.atan2(dy, dx);
      for (let k = 1; k <= 3; k++) {
        a += (b.side * 0.18 + wave * 0.35) * k * 0.5;
        const q = pts[k - 1];
        pts.push({ x: q.x + Math.cos(a) * b.length / 3, y: q.y + Math.sin(a) * b.length / 3 });
      }
      paper.ribbon(pts, u => 2 + 15 * Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.7, b.color, { seed: this.seed + 10 + i, tear: 0.8, shadow: 4, rim: { color: this.look.rim, width: 2.5 } });
      paper.piece(circlePoly(p, 4.5, 10), this.look.bulb, { seed: this.seed + 40 + i, tear: 0.3, shadow: 2, edge: false });
    });
  }
}

