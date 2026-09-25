import { type BoneDef, type HairStyle, type Paper, type Pt, type V, add, circlePoly, Gait, Hair, Skeleton, Spring, World } from '../../src';

const R = 46;

/** Everything that makes one child look different from another. Pure data. */
export interface ChildLook {
  skin: string; skinShade: string; cheek: string; ink: string; mouth: string;
  /** Coat or dress colour (near / far side). */
  top: string; topBack: string;
  outfit: 'coat' | 'dress';
  legs: string; legsBack: string; shoe: string;
  buttons?: string;
  scarf?: { band: string; tail: string };
  hair: HairStyle;
  /** Palette index of the hair base under the locks. */
  capTone: number;
}

export interface ChildIntent {
  speed: number;
  facing: number;
  /** 0 far hand down … 1 far hand raised back (holding a string). */
  pull: number;
  crouch: number;
  sad: number;
  happy: number;
  blink: number;
  lookUp: number;
  /** World point the near hand reaches for, or null to let it swing. */
  reach: V | null;
}

const soft = (stiffness: number, damping: number, inertia: number, sway: number) => ({ stiffness, damping, inertia, sway });

const BONES: BoneDef[] = [
  { name: 'pelvis', length: 14, angle: -Math.PI / 2 },
  { name: 'spine', parent: 'pelvis', length: 86, angle: 0, spring: soft(260, 22, 0.15, 0.25) },
  { name: 'neck', parent: 'spine', length: 16, angle: 0.08, spring: soft(240, 20, 0.2, 0.35) },
  { name: 'head', parent: 'neck', length: R * 2, angle: 0, spring: soft(170, 13, 0.45, 0.9), limits: [-0.6, 0.6] },
  { name: 'thighF', parent: 'pelvis', at: 0, length: 64, angle: Math.PI },
  { name: 'shinF', parent: 'thighF', length: 62, angle: 0 },
  { name: 'thighN', parent: 'pelvis', at: 0, length: 64, angle: Math.PI },
  { name: 'shinN', parent: 'thighN', length: 62, angle: 0 },
  { name: 'upperF', parent: 'spine', at: 0.9, length: 50, angle: Math.PI },
  { name: 'foreF', parent: 'upperF', length: 48, angle: 0 },
  { name: 'upperN', parent: 'spine', at: 0.9, length: 50, angle: Math.PI },
  { name: 'foreN', parent: 'upperN', length: 48, angle: 0 },
];

/**
 * A rubber-hose paper child: skeleton + gait + hair + optional scarf,
 * a far hand that can hold things and a near hand that can reach for things.
 */
export class Child {
  readonly skel: Skeleton;
  /** Far hand (simulated point, e.g. the end of a kite string). */
  readonly hand: Pt;
  intent: ChildIntent = { speed: 0, facing: 1, pull: 0, crouch: 0, sad: 0, happy: 0, blink: 1, lookUp: 0, reach: null };
  private readonly gait = new Gait({
    pelvis: 'pelvis', legs: [['thighN', 'shinN'], ['thighF', 'shinF']], arms: [['upperN', 'foreN']],
    hipHeight: 118, step: 105, runSpeed: 600, bounce: 16, footLift: 48, footReach: 56, lean: 0.24, stance: 10,
  });
  private readonly hair: Hair;
  private readonly scarf: Pt[] | null = null;
  private readonly reachAt: Spring;
  private reachWeight = 0;

  constructor(private readonly world: World, x: number, private readonly look: ChildLook, seed = 900) {
    this.skel = new Skeleton(BONES, { x, y: world.ground(x) });
    this.gait.update(this.skel, { speed: 0, ground: () => 0 }, 0);
    for (let i = 0; i < 4; i++) this.skel.step(1 / 60);

    this.hair = new Hair(world, () => this.skel.uprightFrame('head', R), R, look.hair, { hold: 340, drag: 0.09, segments: 4, bend: 0.35 }, seed);

    if (look.scarf) {
      const s = this.scarfRoot();
      this.scarf = world.chain(world.point(s.x, s.y, { mass: Infinity }), 6, 15, { x: -1, y: 0.3 }, { mass: 0.06, drag: 0.1, gravity: 0.8 }, 0.95);
    }

    const h = this.holdGoal();
    this.hand = world.point(h.x, h.y, { mass: 1, drag: 0, gravity: 0 });
    world.forces.push(dt => this.driveHand(dt));
    this.reachAt = new Spring(this.skel.point('foreN'), 90, 16);
  }

  get x(): number { return this.skel.root.x; }

  /** Near hand in world space. */
  get nearHand(): V { return this.skel.point('foreN'); }

  update(dt: number): void {
    const i = this.intent, sk = this.skel;
    sk.root = { x: sk.root.x + i.speed * dt * Math.sign(i.facing || 1), y: this.world.ground(sk.root.x) };
    sk.flip = i.facing;
    const ground = (lx: number) => this.world.ground(sk.root.x + lx * Math.sign(i.facing || 1)) - sk.root.y;
    this.gait.update(sk, { speed: i.speed, crouch: i.crouch * 20, lean: i.sad * 0.18, ground }, dt);
    sk.set('head', i.sad * 0.35 - i.lookUp * 0.3);
    sk.reach('upperF', 'foreF', sk.toLocal(this.hand), 1);
    this.reachFor(dt);
    sk.step(dt);

    if (this.scarf) { const s = this.scarfRoot(); World.drive(this.scarf[0], s.x, s.y); }
  }

  /** Blend the near arm from its gait swing toward an IK reach, with a lagging target. */
  private reachFor(dt: number): void {
    const target = this.intent.reach;
    this.reachWeight += ((target ? 1 : 0) - this.reachWeight) * Math.min(1, dt * 6);
    this.reachAt.step(target ?? this.nearHand, dt);
    if (this.reachWeight < 0.02) return;
    const swingEnd = this.skel.get('foreN').end;
    const goal = this.skel.toLocal(this.reachAt.pos);
    const w = this.reachWeight;
    this.skel.reach('upperN', 'foreN', { x: swingEnd.x + (goal.x - swingEnd.x) * w, y: swingEnd.y + (goal.y - swingEnd.y) * w }, 1);
  }

  private scarfRoot(): V {
    return this.skel.point('spine', 0.96, { x: 0, y: 14 });
  }

  private holdGoal(): V {
    const sh = this.skel.get('upperF').start, p = this.intent.pull;
    const down = { x: 6, y: 92 }, raised = { x: -40, y: -78 };
    return this.skel.map(add(sh, { x: down.x + (raised.x - down.x) * p, y: down.y + (raised.y - down.y) * p }));
  }

  private driveHand(dt: number): void {
    const h = this.hand, t = this.holdGoal();
    const vx = (h.x - h.px) / dt, vy = (h.y - h.py) / dt;
    h.ax += 700 * (t.x - h.x) - 50 * vx;
    h.ay += 700 * (t.y - h.y) - 50 * vy;
  }

  draw(paper: Paper): void {
    const L = this.look, sk = this.skel, b = (n: string) => sk.get(n);
    const limb = (upper: string, lower: string) => [b(upper).start, b(upper).end, b(lower).end].map(p => sk.map(p));
    const dress = L.outfit === 'dress';

    paper.tube([sk.map(b('upperF').start), sk.map(b('upperF').end), this.hand], 16, 13, L.topBack, { seed: 1 });
    paper.piece(circlePoly(this.hand, 8.5), L.skinShade, { seed: 2, tear: 0.8, shadow: 4 });
    (['F', 'N'] as const).forEach((s, k) => {
      paper.tube(limb(`thigh${s}`, `shin${s}`), dress ? 15 : 21, dress ? 12 : 16, s === 'F' ? L.legsBack : L.legs, { seed: 10 + k });
      const shoe = sk.point(`shin${s}`, 1, { x: 3, y: -8 });
      paper.piece(circlePoly(shoe, 9, 16, 17 * Math.abs(sk.flip) + 1), L.shoe, { seed: 12 + k, tear: 1.2, shadow: 5 });
    });

    if (this.scarf && L.scarf) paper.tube(this.scarf, 16, 10, L.scarf.tail, { seed: 20 });

    const torso = sk.uprightFrame('spine', 0);
    const flare = (dress ? 14 : 8) * this.gait.amount + (dress ? 10 : 0);
    const hem = dress ? 48 : 36;
    paper.piece([{ x: -15, y: -84 }, { x: 16, y: -84 }, { x: 34 + (dress ? 8 : 0), y: hem - 2 }, { x: 0, y: hem + 3 }, { x: -36 - flare, y: hem }].map(torso), L.top, { seed: 30, tear: 2.4 });
    if (L.buttons) [0.2, 0.47, 0.74].forEach((k, n) => paper.piece(circlePoly({ x: 18 + k * 12, y: -84 + k * 118 }, 3.2, 10).map(torso), L.buttons!, { seed: 31 + n, tear: 0.4, shadow: 0, edge: false }));

    paper.tube([b('neck').start, b('neck').end].map(p => sk.map(p)), 17, 16, L.skinShade, { seed: 35, shadow: 0 });

    this.hair.draw(paper, 'under');
    this.drawHead(paper, sk.uprightFrame('head', R));
    this.hair.draw(paper, 'over');

    if (L.scarf) paper.tube([{ x: -17, y: -76 }, { x: 0, y: -73 }, { x: 16, y: -79 }].map(torso), 15, 14, L.scarf.band, { seed: 50 });

    paper.tube(limb('upperN', 'foreN'), 17, 14, L.top, { seed: 60 });
    paper.piece(circlePoly(this.nearHand, 9.5), L.skin, { seed: 61, tear: 0.8, shadow: 5 });
  }

  private drawHead(paper: Paper, F: (p: V) => V): void {
    const i = this.intent, L = this.look;
    const at = (pts: V[]) => pts.map(F);
    paper.piece(at(circlePoly({ x: 0, y: 0 }, R, 36)), L.skin, { seed: 70, tear: 1.6 });
    paper.piece(at(circlePoly({ x: R * 0.94, y: R * 0.1 }, R * 0.2, 14)), L.skin, { seed: 71, tear: 0.8, shadow: 3 });
    paper.piece(at(circlePoly({ x: R * 0.42, y: R * 0.3 }, R * 0.17, 14)), L.cheek, { seed: 72, tear: 0.6, shadow: 0, edge: false, texture: 0 });

    const cap: V[] = [];
    for (let a = -40; a >= -196; a -= 8) cap.push({ x: Math.cos((a * Math.PI) / 180) * R, y: Math.sin((a * Math.PI) / 180) * R });
    cap.push({ x: -R * 0.8, y: R * 0.5 }, { x: -R * 0.42, y: R * 0.05 }, { x: -R * 0.2, y: -R * 0.25 }, { x: R * 0.15, y: -R * 0.45 }, { x: R * 0.5, y: -R * 0.55 });
    paper.piece(at(cap), L.hair.palette[L.capTone], { seed: 73, tear: 1.5, shadow: 3, edge: false });
    paper.piece(at(circlePoly({ x: -R * 0.12, y: R * 0.12 }, R * 0.2, 14, R * 0.15)), L.skinShade, { seed: 74, tear: 0.8, shadow: 3 });

    const eye = { x: R * 0.5, y: -R * 0.05 };
    const squint = 1 - i.happy * 0.35;
    paper.piece(at(circlePoly(eye, 7 * Math.max(i.blink * squint, 0.12), 14, 4.8)), L.ink, { seed: 75, tear: 0.3, shadow: 0, edge: false, texture: 0 });
    if (i.blink > 0.5) paper.piece(at(circlePoly({ x: eye.x + 1.5, y: eye.y - 3 }, 1.6, 8)), '#ffffff', { seed: 76, tear: 0, shadow: 0, edge: false, texture: 0 });

    const raise = i.sad * 6 + i.lookUp * 3 + i.happy * 3;
    paper.tube(at([{ x: R * 0.3, y: -R * 0.3 - raise }, { x: R * 0.5, y: -R * 0.36 - raise * 0.8 }, { x: R * 0.68, y: -R * 0.3 - raise * 0.3 }]), 5, 4, L.ink, { seed: 77, tear: 0.3, shadow: 0, texture: 0 });
    const smile = 0.6 - i.sad * 1.6 + i.happy * 1.2;
    paper.tube(at([{ x: R * 0.5, y: R * 0.49 }, { x: R * 0.62, y: R * 0.5 + smile * 5 }, { x: R * 0.74, y: R * 0.45 - i.happy * 3 }]), 3.2, 3, L.mouth, { seed: 78, tear: 0.2, shadow: 0, texture: 0 });
  }
}
