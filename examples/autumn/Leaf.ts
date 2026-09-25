import { type Paper, type Pt, type V, Plate, World } from '../../src';

/** A single autumn leaf: a light plate that floats and flutters, and can be pinned by its stem. */
export class Leaf {
  readonly plate: Plate;
  private pinned: V | null;
  private readonly masses: number[];

  constructor(world: World, at: V, angle: number, private readonly colors: [string, string]) {
    // tip, right edge, stem, left edge, centre — a broad ovate leaf
    const shape = [{ x: 0, y: -40 }, { x: 28, y: -6 }, { x: 0, y: 32 }, { x: -28, y: -6 }, { x: 0, y: -2 }];
    this.plate = new Plate(world, shape, at, angle, { mass: 0.05, drag: 0.07, dragY: 0.2, friction: 0.6 })
      .aerofoil({ lift: 0.6, liftRange: [60, 260], flutter: 2200, weathervane: 0, lean: 0, seed: 17 }, 0, 2);
    this.masses = this.plate.pts.map(p => p.invMass);
    this.pinned = at;
    this.plate.pts.forEach(p => (p.invMass = 0));
    world.forces.push(() => this.hold());
  }

  get stem(): Pt { return this.plate.pts[2]; }
  get center(): Pt { return this.plate.pts[4]; }

  /** Let go (from the branch) or pin the stem to a moving point (a hand). */
  release(): void {
    this.pinned = null;
    this.plate.pts.forEach((p, i) => (p.invMass = this.masses[i]));
  }

  pinStem(to: V): void {
    this.pinned = to;
    this.plate.pts.forEach((p, i) => (p.invMass = i === 2 ? 0 : this.masses[i]));
  }

  moveStem(to: V): void { this.pinned = to; }

  private hold(): void {
    if (!this.pinned || this.stem.invMass !== 0) return;
    const d = { x: this.pinned.x - this.stem.x, y: this.pinned.y - this.stem.y };
    for (const p of this.plate.pts) if (p.invMass === 0) World.drive(p, p.x + d.x, p.y + d.y);
  }

  draw(paper: Paper): void {
    const [tip, right, stem, left, mid] = this.plate.pts;
    const rim = { color: '#ffd9a0', width: 5 };
    // Rounded halves: bulge each edge outward between tip and stem.
    const bulge = (a: V, b: V, side: V, k: number) => ({ x: (a.x + b.x) / 2 + (side.x - (a.x + b.x) / 2) * k, y: (a.y + b.y) / 2 + (side.y - (a.y + b.y) / 2) * k });
    paper.piece([tip, bulge(tip, right, right, 0.9), right, bulge(right, stem, right, 0.7), stem, mid], this.colors[0], { seed: 401, tear: 1, shadow: 5, rim });
    paper.piece([tip, mid, stem, bulge(stem, left, left, 0.7), left, bulge(left, tip, left, 0.9)], this.colors[1], { seed: 402, tear: 1, shadow: 0, rim });
    const tail = { x: stem.x + (stem.x - mid.x) * 0.18, y: stem.y + (stem.y - mid.y) * 0.18 };
    paper.tube([{ x: (tip.x + mid.x) / 2, y: (tip.y + mid.y) / 2 }, mid, stem, tail], 2, 2.6, '#7a3b1c', { seed: 403, tear: 0.2, shadow: 0, texture: 0 });
  }
}
