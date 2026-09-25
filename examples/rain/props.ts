import { type Paper, type Pt, type V, Plate, World, add, rot } from '../../src';

/** A rigid prop that is carried (glued to a hand) until it is let go, then falls, bounces and settles. */
abstract class Carried {
  protected plate: Plate | null = null;
  private grip: V = { x: 0, y: 0 };
  private angle = 0;

  constructor(protected readonly world: World, private readonly local: V[]) {}

  get held(): boolean { return this.plate === null; }

  /** Glue to a hand: the prop's origin at `grip`, turned by `angle`. */
  hold(grip: V, angle: number): void {
    this.grip = grip;
    this.angle = angle;
  }

  /** Let go with a velocity (px/s) and a spin (rad/s), from the last held pose. */
  drop(vel: V, spin: number, dt: number): void {
    this.plate = new Plate(this.world, this.local, this.grip, this.angle, { mass: 0.5, drag: 0.004, friction: 0.7 });
    for (const p of this.plate.pts) {
      const r = { x: p.x - this.grip.x, y: p.y - this.grip.y };
      p.px = p.x - (vel.x - spin * r.y) * dt;
      p.py = p.y - (vel.y + spin * r.x) * dt;
    }
  }

  /** Local → world for drawing: from the hand while carried, from the simulated points once dropped. */
  protected frame(): (p: V) => V {
    if (!this.plate) return (p: V) => add(this.grip, rot(p, this.angle));
    const [o, a] = this.plate.pts as Pt[], l0 = this.local[1];
    const angle = Math.atan2(a.y - o.y, a.x - o.x) - Math.atan2(l0.y, l0.x);
    return (p: V) => add(o, rot(p, angle));
  }
}

export interface UmbrellaLook { canopy: string; rib: string; shaft: string; rim: string }

const CANOPY_W = 100, RIM_Y = -108, CREST_Y = -142, TOP_Y = -156;
const RIBS = [-1, -0.5, 0, 0.5, 1];

/** A black umbrella: a scalloped canopy on ribs, a shaft and a crook handle. Local origin at the grip, +y down. */
export class Umbrella extends Carried {
  constructor(world: World, private readonly look: UmbrellaLook) {
    super(world, [{ x: 0, y: 0 }, { x: 0, y: TOP_Y }, { x: -CANOPY_W, y: RIM_Y }, { x: CANOPY_W, y: RIM_Y }, { x: 0, y: CREST_Y }]);
  }

  /** The canopy's top edge as a polyline in world space (for rain to land on), left to right. */
  top(): V[] {
    const F = this.frame();
    const pts = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(u => F({ x: u * CANOPY_W, y: RIM_Y + (CREST_Y - RIM_Y) * (1 - u * u) }));
    return pts.sort((a, b) => a.x - b.x);
  }

  /** Rib tips in world space, where drips fall from. */
  tips(): V[] {
    const F = this.frame();
    return RIBS.map(u => F({ x: u * CANOPY_W * 0.98, y: RIM_Y + 4 }));
  }

  draw(paper: Paper): void {
    const F = this.frame(), L = this.look;
    paper.tube([{ x: 0, y: 6 }, { x: 0, y: TOP_Y }].map(F), 4, 4, L.shaft, { seed: 501, tear: 0.3, shadow: 3 });
    paper.tube([{ x: 0, y: 0 }, { x: 0, y: 14 }, { x: -6, y: 22 }, { x: -14, y: 20 }, { x: -16, y: 13 }].map(F), 6, 5, L.shaft, { seed: 502, tear: 0.3, shadow: 3 });
    const rim: V[] = [];
    RIBS.forEach((u, i) => {
      rim.push({ x: u * CANOPY_W, y: RIM_Y });
      const next = RIBS[i + 1];
      if (next !== undefined) rim.push({ x: ((u + next) / 2) * CANOPY_W, y: RIM_Y - 9 });
    });
    const dome = [-0.8, -0.5, -0.2, 0, 0.2, 0.5, 0.8].map(u => ({ x: u * CANOPY_W, y: RIM_Y + (CREST_Y - RIM_Y) * (1 - u * u) - 4 }));
    paper.sheet({ shadow: 6, rim: { color: L.rim, width: 3 }, shade: { color: 'rgba(0, 0, 0, 0.35)', width: 8 } }, () => {
      paper.piece([...rim.reverse(), ...dome, { x: 0, y: TOP_Y + 6 }].map(F).slice(), L.canopy, { seed: 503, tear: 0.8 });
      paper.piece([{ x: -4, y: CREST_Y + 2 }, { x: 0, y: TOP_Y }, { x: 4, y: CREST_Y + 2 }].map(F), L.shaft, { seed: 504, tear: 0.2 });
      paper.inside(() => {
        for (const u of RIBS.slice(1, -1)) paper.line([{ x: 0, y: CREST_Y }, { x: u * CANOPY_W * 0.6, y: RIM_Y + (CREST_Y - RIM_Y) * 0.55 }, { x: u * CANOPY_W, y: RIM_Y }].map(F), L.rib, 1.6);
        paper.line([-0.85, -0.55, -0.25].map(u => F({ x: u * CANOPY_W, y: RIM_Y + (CREST_Y - RIM_Y) * (1 - u * u) - 10 })), 'rgba(255, 255, 255, 0.22)', 3);
      });
    });
  }
}

/** A small suitcase with a handle and two straps. Local origin at the handle. */
export class Suitcase extends Carried {
  constructor(world: World, private readonly color: string, private readonly strap: string) {
    super(world, [{ x: 0, y: 0 }, { x: 0, y: 90 }, { x: -58, y: 12 }, { x: 58, y: 12 }, { x: -58, y: 92 }, { x: 58, y: 92 }]);
  }

  draw(paper: Paper): void {
    const F = this.frame();
    paper.sheet({ shadow: 6, rim: { color: 'rgba(210, 210, 210, 0.6)', width: 2 }, shade: { color: 'rgba(0, 0, 0, 0.3)', width: 6 } }, () => {
      paper.tube([{ x: -12, y: 12 }, { x: -10, y: 2 }, { x: 10, y: 2 }, { x: 12, y: 12 }].map(F), 5, 5, this.strap, { seed: 511, tear: 0.3 });
      paper.blob([{ x: -58, y: 12 }, { x: 58, y: 12 }, { x: 60, y: 90 }, { x: -60, y: 90 }].map(F), this.color, { seed: 512, tear: 1 });
      paper.inside(() => {
        for (const x of [-30, 30]) paper.tube([{ x, y: 10 }, { x, y: 92 }].map(F), 7, 7, this.strap, { seed: 513 + x, tear: 0.3 });
        paper.line([{ x: -56, y: 50 }, { x: 56, y: 50 }].map(F), 'rgba(0, 0, 0, 0.25)', 1.4);
      });
    });
  }
}

