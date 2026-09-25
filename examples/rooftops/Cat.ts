import {
  type BoneDef, type Paper, type V, Gait, Leap, Skeleton, Spring, Strand, World, add, circlePoly, clamp, keys, lerp,
} from '../../src';

/** Everything that makes one cat look different from another. Pure data. */
export interface CatLook {
  fur: string;
  /** Near legs: a touch lighter so they read over the body without a seam. */
  furNear: string;
  /** Far-side legs, in the body's own shadow. */
  furBack: string;
  /** Chest, muzzle and socks. */
  light: string;
  /** Shadow tone on the white parts (under the muzzle, whisker pads). */
  lightShade: string;
  /** Socks on the far legs, in shadow. */
  lightBack: string;
  /** Rim light from the scene light (moon, sun). */
  rim: string;
  eye: string;
  /** Darker outer ring of the iris. */
  eyeDeep: string;
  ink: string;
  nose: string;
  noseDeep: string;
  innerEar: string;
  innerEarDeep: string;
}

export interface CatIntent {
  /** Walking speed along `facing` (px/s). */
  speed: number;
  facing: number;
  /** 0…1: haunches down, weight on the front paws (anticipation, stalking). */
  crouch: number;
  /** 0…1: the hip wiggle before a pounce. */
  wiggle: number;
  sit: number;
  /** World point to look at, or null to look ahead. */
  look: V | null;
  /** 0 low and relaxed … 1 raised like a question mark. */
  tail: number;
  /** Eyelid openness, 1 open. */
  blink: number;
}

export const CAT_REST: Readonly<CatIntent> = { speed: 0, facing: 1, crouch: 0, wiggle: 0, sit: 0, look: null, tail: 0.5, blink: 1 };

const HEAD_R = 27, HIP = 63, JUMP_GRAVITY = 2600;
const soft = (stiffness: number, damping: number, inertia: number, sway: number) => ({ stiffness, damping, inertia, sway });

const BONES: BoneDef[] = [
  { name: 'spine', length: 92, angle: 0 },
  { name: 'neck', parent: 'spine', length: 30, angle: -1.0, spring: soft(220, 18, 0.2, 0.4) },
  { name: 'head', parent: 'neck', length: HEAD_R * 2, angle: -Math.PI / 2 + 1.0, spring: soft(160, 12, 0.4, 0.8) },
  { name: 'thighF', parent: 'spine', at: 0.03, length: 34, angle: Math.PI / 2 },
  { name: 'shinF', parent: 'thighF', length: 38, angle: 0 },
  { name: 'upperF', parent: 'spine', at: 0.88, length: 32, angle: Math.PI / 2 },
  { name: 'foreF', parent: 'upperF', length: 34, angle: 0 },
  { name: 'thighN', parent: 'spine', at: 0.03, length: 34, angle: Math.PI / 2 },
  { name: 'shinN', parent: 'thighN', length: 38, angle: 0 },
  { name: 'upperN', parent: 'spine', at: 0.88, length: 32, angle: Math.PI / 2 },
  { name: 'foreN', parent: 'upperN', length: 34, angle: 0 },
];

/** Legs as [upper, lower], near hind first; hind knees bend forward, front elbows back. */
const LEGS: [string, string][] = [['thighN', 'shinN'], ['thighF', 'shinF'], ['upperN', 'foreN'], ['upperF', 'foreF']];
const BENDS = [-1, -1, 1, 1];

/** Torso outline in the spine's frame (+x from hips to shoulders, +y down): croup, back, withers, deep chest, tucked belly. */
const TORSO: V[] = [
  { x: -22, y: -4 }, { x: -10, y: -22 }, { x: 14, y: -25 }, { x: 48, y: -20 }, { x: 82, y: -24 }, { x: 100, y: -14 },
  { x: 106, y: 6 }, { x: 98, y: 26 }, { x: 72, y: 25 }, { x: 42, y: 18 }, { x: 16, y: 24 }, { x: -10, y: 18 },
];

// Tail rest shapes in the spine's frame (+x toward the head).
const TAIL_UP: V[] = [{ x: 0, y: 0 }, { x: -16, y: -4 }, { x: -30, y: -16 }, { x: -40, y: -34 }, { x: -44, y: -54 }, { x: -40, y: -74 }, { x: -30, y: -86 }];
const TAIL_LOW: V[] = [{ x: 0, y: 0 }, { x: -18, y: 4 }, { x: -36, y: 10 }, { x: -54, y: 12 }, { x: -70, y: 8 }, { x: -84, y: -2 }, { x: -94, y: -16 }];

/**
 * A paper cat: a quadruped skeleton on a four-legged gait, a tail that remembers its shape,
 * ballistic leaps with anticipation and landing squash, and a sit.
 */
export class Cat {
  readonly skel: Skeleton;
  readonly tail: Strand;
  intent: CatIntent = { ...CAT_REST };
  private readonly gait = new Gait({
    pelvis: 'spine', pelvisAngle: 0, legs: LEGS, phases: [0, 0.5, 0.25, 0.75], bends: BENDS,
    hipHeight: HIP, step: 42, runSpeed: 500, bounce: 3, footLift: 13, footReach: 21, lean: 0, stance: 4,
  });
  private readonly squash = new Spring({ x: 0, y: 0 }, 170, 13);
  private leap: Leap | null = null;
  private flight = 0;
  private clock = 0;

  constructor(private readonly world: World, x: number, y: number, private readonly look: CatLook) {
    this.skel = new Skeleton(BONES, { x, y: world.floorBelow(x, y - 40) });
    this.gait.update(this.skel, { speed: 0, ground: () => 0 }, 0);
    for (let i = 0; i < 4; i++) this.skel.step(1 / 60);
    this.tail = new Strand(world, () => this.skel.boneFrame('spine'), TAIL_UP.map(p => ({ ...p })), { hold: 70, drag: 0.08, bend: 0.4, mass: 0.05, gravity: 0.4, falloff: 0.5 });
  }

  /** Point on the floor under the hips. */
  get root(): V { return this.skel.root; }
  get x(): number { return this.skel.root.x; }
  get airborne(): boolean { return this.leap !== null; }

  /** Leap to a floor point, peaking `apex` px above the higher end. */
  jump(to: V, apex: number): void {
    this.leap = new Leap({ ...this.skel.root }, to, apex, JUMP_GRAVITY);
    this.flight = 0;
  }

  update(dt: number): void {
    this.clock += dt;
    this.skel.flip = this.intent.facing;
    this.squash.step({ x: this.intent.crouch, y: 0 }, dt);
    if (this.leap) this.fly(dt);
    else this.walk(dt);
    this.aimHead();
    this.poseTail();
    this.skel.step(dt);
  }

  private walk(dt: number): void {
    const i = this.intent, sk = this.skel, dir = Math.sign(i.facing || 1);
    const x = sk.root.x + i.speed * dt * dir;
    sk.root = { x, y: this.world.floorBelow(x, sk.root.y - 40) };
    const ground = (lx: number) => this.world.floorBelow(sk.root.x + lx * dir, sk.root.y - 40) - sk.root.y;
    const wiggle = Math.sin(this.clock * 15) * 0.06 * i.wiggle;
    const crouch = this.squash.pos.x;
    // Sitting: haunches down, chest up, hind paws forward under the chest, front paws just ahead of the shoulders.
    const footOffset = [{ x: 18 * i.sit, y: 0 }, { x: 13 * i.sit, y: 0 }, { x: 6 * i.sit, y: 0 }, { x: 2 * i.sit, y: 0 }];
    this.gait.update(sk, { speed: i.speed, crouch: crouch * 18 + i.sit * 47, lean: crouch * 0.14 + wiggle - i.sit * 0.56, ground, footOffset }, dt);
  }

  /** In the air: follow the arc, pitch with it, stretch out, tuck, then reach for the landing. */
  private fly(dt: number): void {
    const leap = this.leap!, sk = this.skel;
    this.flight += dt;
    const u = leap.progress(this.flight), v = leap.velocityAt(this.flight);
    sk.root = leap.at(this.flight);
    sk.rootOffset = { x: 0, y: -HIP };
    sk.set('spine', clamp(Math.atan2(v.y, Math.abs(v.x)) * 0.55, -0.45, 0.5));
    const hind = { x: keys(u, [[0, -40], [0.45, -14], [1, 8]]), y: keys(u, [[0, 49], [0.45, 35], [1, 59]]) };
    const front = { x: keys(u, [[0, 34], [0.4, 46], [1, 26]]), y: keys(u, [[0, 42], [0.4, 29], [1, 62]]) };
    LEGS.forEach(([upper, lower], k) => {
      const target = k < 2 ? hind : front, spread = k % 2 ? -6 : 6;
      sk.reach(upper, lower, add(sk.get(upper).start, { x: target.x + spread, y: target.y }), BENDS[k]);
    });
    if (this.flight >= leap.duration) {
      this.leap = null;
      sk.root = { x: leap.to.x, y: this.world.floorBelow(leap.to.x, leap.to.y - 40) };
      this.squash.vel.x += 7;
    }
  }

  private aimHead(): void {
    const i = this.intent, sk = this.skel;
    let tilt = 0;
    if (i.look) {
      const neck = sk.get('head').start, l = sk.toLocal(i.look);
      tilt = clamp(Math.atan2(l.y - neck.y, l.x - neck.x), -0.9, 0.9) * 0.85;
    }
    sk.setWorld('head', -Math.PI / 2 + tilt);
  }

  private poseTail(): void {
    const i = this.intent, n = TAIL_UP.length;
    this.tail.rest = TAIL_UP.map((up, k) => {
      const twitch = Math.sin(this.clock * 9 - k * 0.6) * 7 * i.wiggle * (k / n);
      return { x: lerp(TAIL_LOW[k].x, up.x, i.tail) + twitch, y: lerp(TAIL_LOW[k].y, up.y, i.tail) };
    });
  }

  /**
   * Two sheets of paper: the far legs and ear in the body's shadow, then everything else cut from
   * one piece (tail, torso, near legs, neck, head). Markings (chest, socks, muzzle) and a soft crease
   * that separates the near legs are drawn inside the sheet, so they never change the silhouette.
   */
  draw(paper: Paper): void {
    const L = this.look, sk = this.skel, anchor = sk.root;
    const head = sk.uprightFrame('head', HEAD_R);

    paper.sheet({ shadow: 5, rim: { color: L.rim, width: 2.5 }, anchor }, () => {
      this.drawLegs(paper, 'F', L.furBack);
      const R = HEAD_R;
      paper.piece([{ x: -R * 0.55, y: -R * 0.55 }, { x: -R * 0.05, y: -R * 0.85 }, { x: -R * 0.42, y: -R * 1.42 }].map(head), L.furBack, { seed: 5, tear: 0.8 });
      this.drawSocks(paper, 'F', L.lightBack);
    });

    paper.sheet({ shadow: 9, rim: { color: L.rim, width: 4 }, shade: { color: 'rgba(6, 4, 18, 0.5)', width: 9 }, anchor }, () => {
      const spine = sk.boneFrame('spine');
      paper.ribbon(this.tail.pts, u => 14 * (1 - u * 0.45), L.fur, { seed: 10, tear: 1.2 });
      paper.blob(TORSO.map(spine), L.fur, { seed: 20, tear: 1.6 });
      for (const [x, y] of [[80, 26], [92, 27]] as const) {
        paper.piece([{ x: x - 5, y: y - 3 }, { x: x - 2, y: y + 4 }, { x: x + 4, y: y - 2 }].map(spine), L.fur, { seed: 22 + x, tear: 0.2 });
      }
      paper.tube([sk.get('neck').start, sk.get('neck').end].map(p => sk.map(p)), 34, 30, L.fur, { seed: 40, tear: 1 });
      this.drawLegs(paper, 'N', L.fur);
      this.drawSocks(paper, 'N', L.light);
      this.drawHead(paper, head);
      paper.inside(() => {
        paper.piece([{ x: 112, y: -4 }, { x: 110, y: 20 }, { x: 102, y: 31 }, { x: 99, y: 24 }, { x: 94, y: 27 }, { x: 93, y: 18 }, { x: 88, y: 18 }, { x: 92, y: 8 }, { x: 88, y: 2 }].map(spine), L.light, { seed: 21, tear: 0.8 });
        this.drawCreases(paper, L.furNear);
        this.drawFace(paper, head);
      });
    });
    this.drawWhiskers(paper, head);
  }

  /** Hind leg: a wide haunch that melts into the rump, then shank and paw. Front leg: shoulder blade, forearm, paw. */
  private drawLegs(paper: Paper, side: 'N' | 'F', fur: string): void {
    const sk = this.skel, pt = (bone: string, u: number) => sk.point(bone, u);
    const k = side === 'N' ? 0 : 1;
    paper.tube([sk.point('spine', 0.04, { x: 0, y: -2 }), pt(`thigh${side}`, 0.2), pt(`thigh${side}`, 0.6), pt(`thigh${side}`, 1)], 44 - k * 6, 19, fur, { seed: 30 + k * 10, tear: 1.2 });
    paper.tube([sk.point('spine', 0.86, { x: 0, y: -6 }), pt(`upper${side}`, 0.2), pt(`upper${side}`, 1)], 28 - k * 4, 15, fur, { seed: 32 + k * 10, tear: 1.2 });
    for (const lower of [`shin${side}`, `fore${side}`]) this.drawFoot(paper, lower, fur);
  }

  /** Lower leg tapering to a wrist, and the paw. Seeds depend only on the bone, so a redraw matches exactly. */
  private drawFoot(paper: Paper, lower: string, color: string): void {
    const sk = this.skel, seed = 100 + lower.charCodeAt(0) * 3 + lower.charCodeAt(lower.length - 1);
    paper.tube([sk.point(lower, 0), sk.point(lower, 1)], lower.startsWith('shin') ? 17 : 14, 8, color, { seed, tear: 1 });
    this.paw(paper, lower, color, seed + 1);
  }

  /**
   * A paw: a small mitten lying flat on the floor under the wrist, toes forward — wider than the
   * wrist so the leg ends in a foot, not a post. Always level, whatever the angle of the leg.
   */
  private paw(paper: Paper, lower: string, fur: string, seed: number): void {
    const sk = this.skel, wrist = sk.get(lower).end;
    const shape = [{ x: -5, y: 0 }, { x: -5, y: -5 }, { x: -1, y: -9 }, { x: 6, y: -7 }, { x: 9, y: -3 }, { x: 8, y: 0 }];
    paper.blob(shape.map(p => sk.map({ x: wrist.x + p.x, y: wrist.y + p.y })), fur, { seed, tear: 0.4 });
  }

  /** Socks: the same lower leg and paw redrawn in white, clipped to a disc around the paw — edges match exactly. */
  private drawSocks(paper: Paper, side: 'N' | 'F', color: string): void {
    const sk = this.skel;
    for (const lower of [`shin${side}`, `fore${side}`]) {
      const wrist = sk.get(lower).end;
      paper.clip(circlePoly(sk.map({ x: wrist.x, y: wrist.y - 4 }), 15, 20), () => this.drawFoot(paper, lower, color));
    }
  }

  /** A faint lighter line along the front of the near haunch and behind the near elbow: form without a seam. */
  private drawCreases(paper: Paper, color: string): void {
    const sk = this.skel, thigh = sk.boneFrame('thighN'), upper = sk.boneFrame('upperN');
    paper.line([{ x: -12, y: -20 }, { x: 14, y: -19 }, { x: 34, y: -11 }, { x: 44, y: -4 }].map(thigh), color, 3);
    paper.line([{ x: -8, y: 13 }, { x: 16, y: 10 }, { x: 36, y: 7 }].map(upper), color, 2.5);
  }

  /** Head mass: skull, cheek tufts, near ear, muzzle and nose — part of the body's silhouette. */
  private drawHead(paper: Paper, F: (p: V) => V): void {
    const L = this.look, R = HEAD_R;
    const at = (pts: V[]) => pts.map(F);
    paper.piece(at(circlePoly({ x: 0, y: 0 }, R, 32, R * 1.12)), L.fur, { seed: 51, tear: 1.4 });
    for (const [x, y, a] of [[-R * 0.55, R * 0.72, 2.3], [-R * 0.2, R * 0.9, 1.9], [-R * 0.85, R * 0.42, 2.7]] as const) {
      paper.piece(at([{ x: x - Math.cos(a + 1.2) * 7, y: y - Math.sin(a + 1.2) * 7 }, { x: x + Math.cos(a) * 11, y: y + Math.sin(a) * 11 }, { x: x - Math.cos(a - 1.2) * 7, y: y - Math.sin(a - 1.2) * 7 }]), L.fur, { seed: 58 + x, tear: 0.4 });
    }
    paper.piece(at([{ x: -R * 0.2, y: -R * 0.72 }, { x: R * 0.5, y: -R * 0.78 }, { x: R * 0.08, y: -R * 1.5 }]), L.fur, { seed: 52, tear: 0.8 });
    paper.piece(at(circlePoly({ x: R * 0.62, y: R * 0.38 }, R * 0.34, 16, R * 0.44)), L.light, { seed: 54, tear: 0.8 });
    paper.piece(at([{ x: R * 0.98, y: R * 0.12 }, { x: R * 1.16, y: R * 0.14 }, { x: R * 1.06, y: R * 0.3 }]), L.nose, { seed: 55, tear: 0.3 });
  }

  /**
   * Face details, clipped inside the head: a two-tone inner ear with tufts, an eye built from iris,
   * lit half, slit pupil, catchlights and an upper lid, a nostril and mouth line, whisker pads.
   */
  private drawFace(paper: Paper, F: (p: V) => V): void {
    const L = this.look, i = this.intent, R = HEAD_R;
    const at = (pts: V[]) => pts.map(F);
    const flat = (seed: number) => ({ seed, tear: 0.2 });

    paper.piece(at([{ x: -R * 0.02, y: -R * 0.8 }, { x: R * 0.32, y: -R * 0.82 }, { x: R * 0.08, y: -R * 1.28 }]), L.innerEar, flat(53));
    paper.piece(at([{ x: R * 0.06, y: -R * 0.8 }, { x: R * 0.24, y: -R * 0.81 }, { x: R * 0.1, y: -R * 1.1 }]), L.innerEarDeep, flat(59));
    for (const k of [0, 1, 2]) paper.line(at([{ x: R * (0.04 + k * 0.1), y: -R * 0.82 }, { x: R * (0.0 + k * 0.12), y: -R * (1.0 + k * 0.06) }]), 'rgba(236, 232, 250, 0.5)', 1);

    const eye = { x: R * 0.5, y: -R * 0.12 }, open = Math.max(0.1, i.blink);
    let dx = 1.2, dy = 0;
    if (i.look) {
      const e = F(eye), d = Math.hypot(i.look.x - e.x, i.look.y - e.y) || 1;
      dx = ((i.look.x - e.x) / d) * 2.2 * Math.sign(this.skel.flip || 1); dy = ((i.look.y - e.y) / d) * 2.2;
    }
    paper.piece(at(circlePoly({ x: eye.x, y: eye.y + 0.5 }, 8.6 * open, 18, 7.6)), L.ink, flat(60));
    paper.piece(at(circlePoly(eye, 7.5 * open, 18, 6.5)), L.eyeDeep, flat(56));
    paper.piece(at(circlePoly({ x: eye.x + 1, y: eye.y + 1.6 * open }, 5.6 * open, 16, 5)), L.eye, flat(61));
    paper.piece(at(circlePoly({ x: eye.x + dx, y: eye.y + dy }, 5.8 * open, 12, 1.8)), L.ink, flat(57));
    if (open > 0.5) {
      paper.piece(at(circlePoly({ x: eye.x + 2.6, y: eye.y - 3.6 }, 1.7, 8)), '#fbfaff', flat(62));
      paper.piece(at(circlePoly({ x: eye.x - 2.4, y: eye.y + 3.2 }, 0.8, 6)), 'rgba(251, 250, 255, 0.7)', flat(63));
    }
    paper.line(at([{ x: eye.x - 7, y: eye.y - 3 * open }, { x: eye.x, y: eye.y - 8.4 * open }, { x: eye.x + 7.5, y: eye.y - 4.5 * open }]), L.ink, 2.6);

    paper.piece(at(circlePoly({ x: R * 0.62, y: R * 0.52 }, R * 0.18, 12, R * 0.34)), L.lightShade, flat(64));
    for (const [x, y] of [[0.52, 0.3], [0.64, 0.36], [0.5, 0.44]] as const) paper.piece(at(circlePoly({ x: R * x, y: R * y }, 1.1, 6)), L.lightShade, flat(65 + x));
    paper.line(at([{ x: R * 1.07, y: R * 0.3 }, { x: R * 1.02, y: R * 0.42 }]), L.noseDeep, 1.6);
    paper.line(at([{ x: R * 1.08, y: R * 0.46 }, { x: R * 0.98, y: R * 0.52 }, { x: R * 0.86, y: R * 0.5 }]), L.noseDeep, 1.6);
    paper.piece(at([{ x: R * 1.02, y: R * 0.14 }, { x: R * 1.14, y: R * 0.16 }, { x: R * 1.07, y: R * 0.24 }]), L.noseDeep, flat(66));
  }

  private drawWhiskers(paper: Paper, F: (p: V) => V): void {
    const R = HEAD_R, from = { x: R * 0.8, y: R * 0.42 };
    for (const [a, len] of [[-0.12, 26], [0.1, 28], [0.3, 24]] as const) {
      paper.line([from, { x: from.x + Math.cos(a) * len * 0.55, y: from.y + Math.sin(a) * len * 0.5 - 1 }, { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len }].map(F), 'rgba(230, 228, 245, 0.55)', 1.2);
    }
  }
}
