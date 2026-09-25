import {
  type BoneDef, type HairStyle, type Paper, type V, Gait, Hair, Leap, Skeleton, Spring, Strand, World, add, circlePoly, clamp,
  keys, lerp, lerpV, rot, smoothClosed,
} from '../../src';

/** Head radius. The adult figure is about 350 px tall: head 44, torso 100 + neck, legs 170. */
export const HEAD_R = 22;
const HIP = 160;

/** Everything that makes one person look different from another. Pure data. */
export interface PersonLook {
  skin: string; skinShade: string; lip: string; ink: string; iris: string; sclera: string;
  hair: HairStyle;
  /** Hair mass over the skull (under the locks). */
  hairCap: string;
  coat: string; coatBack: string; coatDetail: string;
  /** Coat hem below the hips (px along the thigh, 0…1 of its length). */
  coatLength: number;
  trousers: string; trousersBack: string; boot: string;
  rim: string; shade: string;
  mud: string; mudDeep: string;
  scarf?: { base: string; stripe: string };
  hat?: { crown: string; band: string };
}

export interface PersonIntent {
  speed: number;
  facing: number;
  lean: number;
  crouch: number;
  /** 0…1 favour the near leg (lost shoe, hurt foot). */
  limp: number;
  /** 0 calm … 1 desperate: head pushed forward, wider arms, knitted brows. */
  effort: number;
  /** 0 closed … 1 wide open (panting, a shout). */
  mouth: number;
  blink: number;
  /** -1 knitted (effort, anger) … 1 raised (fear, grief). */
  brow: number;
  look: V | null;
  /** Hands reach for these world points (null: swing with the stride). */
  reachN: V | null;
  reachF: V | null;
  /** Extra head tilt, + = chin down. */
  nod: number;
}

export const PERSON_REST: Readonly<PersonIntent> = {
  speed: 0, facing: 1, lean: 0, crouch: 0, limp: 0, effort: 0, mouth: 0, blink: 1, brow: 0, look: null, reachN: null, reachF: null, nod: 0,
};

type Mode = 'walk' | 'tumble' | 'ground' | 'leap' | 'held';

const soft = (stiffness: number, damping: number, inertia: number, sway: number) => ({ stiffness, damping, inertia, sway });

const BONES: BoneDef[] = [
  { name: 'pelvis', length: 18, angle: -Math.PI / 2, spring: soft(420, 40, 0, 0) },
  { name: 'spine', parent: 'pelvis', length: 100, angle: 0, spring: soft(300, 26, 0.12, 0.2) },
  { name: 'neck', parent: 'spine', length: 24, angle: 0.08, spring: soft(260, 22, 0.15, 0.3) },
  { name: 'head', parent: 'neck', length: HEAD_R * 2, angle: 0, spring: soft(190, 15, 0.35, 0.7), limits: [-1.6, 1.2] },
  { name: 'thighF', parent: 'pelvis', at: 0, length: 86, angle: Math.PI },
  { name: 'shinF', parent: 'thighF', length: 84, angle: 0 },
  { name: 'thighN', parent: 'pelvis', at: 0, length: 86, angle: Math.PI },
  { name: 'shinN', parent: 'thighN', length: 84, angle: 0 },
  { name: 'upperF', parent: 'spine', at: 0.9, length: 60, angle: Math.PI },
  { name: 'foreF', parent: 'upperF', length: 56, angle: 0 },
  { name: 'upperN', parent: 'spine', at: 0.9, length: 60, angle: Math.PI },
  { name: 'foreN', parent: 'upperN', length: 56, angle: 0 },
];

/** Local pose for lying, pushing up, kneeling and standing: `rise` 0 prone … 1 up. */
const RISE = [0, 0.35, 0.7, 1];
const GROUND = {
  hip: [24, 40, 88, HIP - 4],
  spine: [-0.05, -0.42, -1.18, -Math.PI / 2 + 0.14],
  footN: [{ x: -168, y: -12 }, { x: -150, y: -8 }, { x: -78, y: 0 }, { x: -14, y: 0 }],
  footF: [{ x: -160, y: -16 }, { x: -138, y: -10 }, { x: 58, y: 0 }, { x: 16, y: 0 }],
  // Lying, the arms stay stretched out ahead in the mud (toward where she was going).
  handN: [{ x: 214, y: -8 }, { x: 116, y: 0 }, { x: 60, y: -62 }, { x: 18, y: -80 }],
  handF: [{ x: 226, y: -10 }, { x: 128, y: 0 }, { x: 44, y: -8 }, { x: -6, y: -82 }],
};

/** Face profile in head units (+x toward the face, +y down), from the back of the skull around the front. */
const SKULL: V[] = [
  { x: -1.0, y: -0.05 }, { x: -0.92, y: -0.52 }, { x: -0.6, y: -0.9 }, { x: -0.1, y: -1.08 }, { x: 0.45, y: -0.98 },
  { x: 0.82, y: -0.66 }, { x: 0.97, y: -0.32 },
];
const JAW: V[] = [{ x: 1.0, y: 0.66 }, { x: 0.93, y: 0.76 }, { x: 0.96, y: 0.88 }, { x: 0.8, y: 1.02 }, { x: 0.45, y: 1.0 }, { x: 0.02, y: 0.8 }];
const NAPE: V[] = [{ x: -0.26, y: 0.62 }, { x: -0.62, y: 0.46 }];

/**
 * A grown-up in a coat: legged gait (with a limp), a stumble and fall planned as an arc, a pose
 * to get up from the ground, a leap into someone's arms, and a hold. Drawn as three sheets of paper:
 * far limbs, body (coat, near leg, head, hair, scarf) and the near arm, which crosses over the body.
 */
export class Person {
  readonly skel: Skeleton;
  intent: PersonIntent = { ...PERSON_REST };
  mode: Mode = 'walk';
  /** 0…1 prone → standing (mode 'ground'); 0…1 face down → head lifted. */
  rise = 0;
  lift = 0;
  /** Mud on the front of the body, 0…1. */
  mud = 0;
  /** How firmly the hair keeps its style (wet hair hangs). */
  wet = 0.7;
  /**
   * Line weights for the lens: rim light and core shadow are measured in world px, so in a close-up
   * they grow with the zoom. Set this to about zoom^-0.55 to keep them a sheen, not a stripe.
   */
  lens = 1;
  /** Just hit the ground this step (for dust, mud, a cut). */
  landed = false;
  /** Horizontal push from a collision (px/s), dying off as the feet catch it. */
  push = 0;
  /** Horizontal speed at the moment the last leap ended (px/s): what a catch has to absorb. */
  impact = 0;
  private readonly gait: Gait;
  private readonly hair: Hair;
  private readonly flap: Strand;
  private readonly scarfTail: Strand | null = null;
  private leap: Leap | null = null;
  private flight = 0;
  private tripAt: V | null = null;
  private holder: (() => V) | null = null;
  private held = 0;
  private readonly reachN: Spring;
  private readonly reachF: Spring;
  private weightN = 0;
  private weightF = 0;

  constructor(private readonly world: World, x: number, private readonly look: PersonLook, run: boolean, private readonly seed = 1000) {
    this.gait = new Gait({
      pelvis: 'pelvis', legs: [['thighN', 'shinN'], ['thighF', 'shinF']], arms: [['upperN', 'foreN'], ['upperF', 'foreF']],
      hipHeight: HIP, step: run ? 172 : 120, runSpeed: run ? 560 : 400, bounce: run ? 18 : 8, footLift: run ? 60 : 30, footReach: run ? 86 : 56,
      lean: run ? 0.3 : 0.08, stance: 10, armSwing: run ? 1.35 : 0.6, elbow: run ? 1.6 : 0.4,
    });
    this.skel = new Skeleton(BONES, { x, y: world.ground(x) });
    this.gait.update(this.skel, { speed: 0, ground: () => 0 }, 0);
    for (let i = 0; i < 4; i++) this.skel.step(1 / 60);

    this.hair = new Hair(world, () => this.skel.uprightFrame('head', HEAD_R), HEAD_R, look.hair, { hold: 150, drag: 0.05, segments: 4, bend: 0.3 }, seed);
    const coat = () => this.skel.uprightFrame('spine', 0);
    this.flap = new Strand(world, coat, [{ x: -22, y: 14 }, { x: -25, y: 34 }, { x: -28, y: 54 }, { x: -31, y: 74 }], { hold: run ? 60 : 160, drag: run ? 0.05 : 0.02, bend: 0.5, mass: 0.1, gravity: 1 });
    if (look.scarf) {
      const rest = [{ x: -10, y: -96 }, { x: -24, y: -90 }, { x: -38, y: -82 }, { x: -52, y: -74 }, { x: -64, y: -64 }, { x: -74, y: -54 }, { x: -82, y: -44 }];
      this.scarfTail = new Strand(world, coat, rest, { hold: 25, drag: 0.03, bend: 0.3, mass: 0.08, gravity: 1, falloff: 0.9 });
    }
    this.reachN = new Spring(this.skel.point('foreN'), 120, 20);
    this.reachF = new Spring(this.skel.point('foreF'), 120, 20);
  }

  get x(): number { return this.skel.root.x; }
  get root(): V { return this.skel.root; }
  get airborne(): boolean { return this.mode === 'leap'; }
  /** Center of the head (for close-ups). */
  get head(): V { return this.skel.uprightFrame('head', HEAD_R)({ x: 0, y: 0 }); }
  /** A point on the body in world space: `u` up the spine, `side` px toward the front (+) or back (-). */
  body(u: number, side = 0): V { return this.skel.uprightFrame('spine', 0)({ x: side, y: -100 * u }); }

  /** Trip over the near foot and fall flat on the face, `distance` px ahead. */
  trip(distance = 190): void {
    const r = this.skel.root, dir = this.dir;
    this.tripAt = this.skel.point('shinN');
    this.leap = new Leap({ ...r }, { x: r.x + dir * distance, y: this.world.ground(r.x + dir * distance) }, 46, 1900);
    this.flight = 0;
    this.mode = 'tumble';
  }

  /** Throw yourself at someone: a leap to `to` (floor point), then hang on to `anchor()`. */
  embrace(to: V, anchor: () => V): void {
    this.leap = new Leap({ ...this.skel.root }, to, 44, 2300);
    this.flight = 0;
    this.holder = anchor;
    this.mode = 'leap';
  }

  get velocity(): number {
    if (this.leap) return this.leap.velocityAt(this.flight).x;
    return this.intent.speed * this.dir + this.push;
  }

  private get dir(): number { return Math.sign(this.intent.facing || 1); }

  update(dt: number): void {
    this.landed = false;
    this.skel.flip = this.intent.facing;
    if (this.mode === 'walk') this.walk(dt);
    else if (this.mode === 'tumble') this.tumble(dt);
    else if (this.mode === 'ground') this.ground();
    else if (this.mode === 'leap') this.leapTo(dt);
    else this.hold(dt);
    this.aimHead();
    this.reachHands(dt);
    this.poseScarf();
    this.skel.step(dt);
  }

  private walk(dt: number): void {
    const i = this.intent, sk = this.skel, dir = this.dir;
    this.push *= Math.exp(-3.2 * dt);
    const x = sk.root.x + (i.speed * dir + this.push) * dt;
    sk.root = { x, y: this.world.ground(x) };
    const ground = (lx: number) => this.world.ground(sk.root.x + lx * dir) - sk.root.y;
    this.gait.update(sk, { speed: i.speed + this.push * dir, crouch: i.crouch * 30, lean: i.lean + i.effort * 0.12, ground, limp: i.limp }, dt);
  }

  /** The fall: the root follows a short arc while the body pitches forward, hands out, the tripped foot left behind. */
  private tumble(dt: number): void {
    const leap = this.leap!, sk = this.skel;
    this.flight += dt;
    const u = leap.progress(this.flight), e = u * u;
    sk.root = leap.at(this.flight);
    sk.rootOffset = { x: 0, y: -lerp(HIP - 10, GROUND.hip[0], e) };
    sk.set('pelvis', lerp(-Math.PI / 2 + 0.4, GROUND.spine[0], e));
    const caught = this.tripAt && u < 0.35 ? sk.toLocal(this.tripAt) : null;
    sk.reach('thighN', 'shinN', caught ?? lerpV({ x: -60, y: -40 }, GROUND.footN[0], u), -1);
    sk.reach('thighF', 'shinF', lerpV({ x: -30, y: -30 }, GROUND.footF[0], e), -1);
    const hand = (end: V) => ({ x: keys(u, [[0, 60], [0.55, 175], [1, end.x]]), y: keys(u, [[0, -230], [0.55, -90], [1, end.y]]) });
    sk.reach('upperN', 'foreN', hand(GROUND.handN[0]), 1);
    sk.reach('upperF', 'foreF', hand(GROUND.handF[0]), 1);
    if (this.flight >= leap.duration) {
      this.leap = null;
      this.mode = 'ground';
      this.rise = 0;
      this.lift = 0;
      this.landed = true;
      this.mud = 1;
    }
  }

  /** Lying, pushing up, kneeling, standing: one pose blended by `rise`; `lift` raises the head off the ground. */
  private ground(): void {
    const sk = this.skel, r = this.rise;
    const k = (vals: number[]) => keys(r, RISE.map((at, i) => [at, vals[i]] as [number, number]));
    const kv = (vals: V[]) => ({ x: k(vals.map(v => v.x)), y: k(vals.map(v => v.y)) });
    sk.root = { x: sk.root.x, y: this.world.ground(sk.root.x) };
    sk.rootOffset = { x: 0, y: -k(GROUND.hip) };
    sk.set('pelvis', k(GROUND.spine));
    sk.reach('thighN', 'shinN', kv(GROUND.footN), -1);
    sk.reach('thighF', 'shinF', kv(GROUND.footF), -1);
    sk.reach('upperN', 'foreN', kv(GROUND.handN), 1);
    sk.reach('upperF', 'foreF', kv(GROUND.handF), 1);
  }

  /** Mid-air toward someone: leaning in, arms reaching for their shoulders, legs kicked up behind. */
  private leapTo(dt: number): void {
    const leap = this.leap!, sk = this.skel;
    this.flight += dt;
    const u = leap.progress(this.flight);
    sk.root = leap.at(this.flight);
    sk.rootOffset = { x: 0, y: -lerp(HIP - 6, HIP + 6, Math.sin(u * Math.PI)) };
    sk.set('pelvis', -Math.PI / 2 + lerp(0.5, 0.3, u));
    sk.reach('thighN', 'shinN', { x: lerp(-30, -70, u), y: lerp(-10, -70, u) }, -1);
    sk.reach('thighF', 'shinF', { x: lerp(-60, -40, u), y: lerp(-40, -90, u) }, -1);
    if (this.flight >= leap.duration) {
      this.impact = leap.velocityAt(this.flight).x;
      this.leap = null;
      this.mode = 'held';
      this.held = 0;
    }
  }

  /** Hanging on: carried by whoever holds us, feet slowly finding the ground again. */
  private hold(dt: number): void {
    const sk = this.skel;
    this.held += dt;
    const a = this.holder!(), down = clamp(this.held / 1.6);
    sk.root = { x: a.x, y: this.world.ground(a.x) };
    // Her head comes to rest on their shoulder: lower than theirs, leaning in, knees bent.
    sk.rootOffset = { x: 0, y: -lerp(HIP - 26, HIP - 40, down) };
    sk.set('pelvis', -Math.PI / 2 + lerp(0.36, 0.26, down));
    sk.reach('thighN', 'shinN', lerpV({ x: -70, y: -58 }, { x: -30, y: 0 }, down), -1);
    sk.reach('thighF', 'shinF', lerpV({ x: -40, y: -70 }, { x: 6, y: 0 }, down * down), -1);
  }

  private aimHead(): void {
    const i = this.intent, sk = this.skel;
    const spine = sk.get('spine').world;
    let tilt = 0;
    if (i.look) {
      const h = sk.get('head').start, l = sk.toLocal(i.look);
      tilt = clamp(Math.atan2(l.y - h.y, l.x - h.x), -0.8, 0.8) * 0.8;
    }
    let head = -Math.PI / 2 + tilt + i.nod + i.effort * 0.12;
    if (this.mode === 'ground') {
      // Face down in the mud, then the head comes up to look ahead.
      const down = spine + 0.2;
      head = lerp(down, -Math.PI / 2 + tilt * 0.6 + 0.12, Math.max(this.lift, this.rise));
    } else if (this.mode === 'tumble') {
      head = spine + keys(this.leap?.progress(this.flight) ?? 1, [[0, 0.3], [0.7, -0.6], [1, 0.2]]);
    }
    sk.setWorld('neck', lerp(spine, head, 0.45) + i.effort * 0.18);
    sk.setWorld('head', head);
  }

  /** Blend each hand from what the body does toward a lagging IK target. */
  private reachHands(dt: number): void {
    if (this.mode === 'tumble' || this.mode === 'ground') return;
    const i = this.intent, sk = this.skel;
    const blend = (target: V | null, spring: Spring, weight: number, upper: string, fore: string) => {
      const w = weight + ((target ? 1 : 0) - weight) * Math.min(1, dt * 7);
      spring.step(target ?? sk.point(fore), dt);
      if (w > 0.02) {
        const swing = sk.get(fore).end, goal = sk.toLocal(spring.pos);
        sk.reach(upper, fore, { x: lerp(swing.x, goal.x, w), y: lerp(swing.y, goal.y, w) }, 1);
      }
      return w;
    };
    this.weightN = blend(i.reachN, this.reachN, this.weightN, 'upperN', 'foreN');
    this.weightF = blend(i.reachF, this.reachF, this.weightF, 'upperF', 'foreF');
  }

  /** The scarf tail streams behind; once snagged it points back along the yarn. */
  private poseScarf(): void {
    const lying = this.mode === 'ground' ? 1 - this.rise * 0.8 : this.mode === 'tumble' ? 0.6 : 0;
    this.hair.strength = this.wet * (1 - lying * 0.97);
    if (this.scarfTail) {
      // Knitted wool is cloth, not a rod: little resistance to folding, and none once it lies on the ground.
      this.scarfTail.strength = this.mode === 'tumble' ? 0.3 : this.mode === 'ground' ? 0.03 : 1;
      this.scarfTail.flex = this.mode === 'ground' ? 0.02 : 0.35;
    }
    // The coat's back flap too: on the ground it lies flat instead of standing up like a flag.
    this.flap.strength = this.mode === 'tumble' ? 0.3 : this.mode === 'ground' ? 0.05 : 1;
    this.flap.flex = this.mode === 'ground' || this.mode === 'tumble' ? 0.02 : 0.5;
  }

  // ── Drawing ─────────────────────────────────────────────

  /** Far limbs, then body; call `drawNearArm` after anything that should pass behind the near arm. */
  draw(paper: Paper): void {
    const L = this.look, anchor = this.skel.root, k = this.lens;
    const rim = { color: L.rim, width: 3 * k };
    paper.sheet({ shadow: 5, rim: { color: L.rim, width: 2 * k }, anchor }, () => {
      this.drawLeg(paper, 'F', L.trousersBack);
      this.drawArm(paper, 'F', L.coatBack);
    });
    paper.sheet({ shadow: 8, rim, shade: { color: L.shade, width: 10 * k }, anchor }, () => {
      // The near leg first: the coat's skirt hangs over the thigh.
      this.drawLeg(paper, 'N', L.trousers);
      this.drawCoat(paper);
      this.drawHeadMass(paper);
      paper.inside(() => this.drawMarkings(paper));
    });
  }

  drawNearArm(paper: Paper): void {
    const L = this.look, k = this.lens;
    paper.sheet({ shadow: 7, rim: { color: L.rim, width: 3 * k }, shade: { color: L.shade, width: 7 * k }, anchor: this.skel.root }, () => {
      this.drawArm(paper, 'N', L.coat);
      paper.inside(() => {
        if (this.mud > 0) this.splotches(paper, this.skel.boneFrame('foreN'), [[44, 4, 12], [20, 6, 9]], this.mud, 400);
      });
    });
    // Lying down, the hair spills over the shoulder: it goes on top of the arm, in its own sheet.
    if (this.hairOverArm) {
      paper.sheet({ shadow: 5, rim: { color: L.rim, width: 2 * k }, shade: { color: L.shade, width: 5 * k }, anchor: this.skel.root }, () => {
        this.hair.draw(paper, 'under');
        this.hair.draw(paper, 'over');
      });
    }
  }

  private get hairOverArm(): boolean { return this.mode === 'ground' || this.mode === 'tumble'; }

  private drawLeg(paper: Paper, side: 'N' | 'F', cloth: string): void {
    const sk = this.skel, L = this.look, k = side === 'N' ? 0 : 1;
    const hip = sk.point(`thigh${side}`, 0), knee = sk.point(`thigh${side}`, 1), ankle = sk.point(`shin${side}`, 1);
    paper.tube([hip, sk.point(`thigh${side}`, 0.5), knee, sk.point(`shin${side}`, 0.6), ankle], 36, 22, cloth, { seed: this.seed + 10 + k, tear: 1.2 });
    const foot = this.footFrame(side);
    const boot = [{ x: -9, y: -20 }, { x: -12, y: -4 }, { x: -10, y: 1 }, { x: 22, y: 2 }, { x: 31, y: -2 }, { x: 28, y: -10 }, { x: 12, y: -16 }, { x: 8, y: -24 }];
    paper.blob(boot.map(foot), side === 'N' ? L.boot : L.trousersBack, { seed: this.seed + 14 + k, tear: 0.8 });
  }

  /** A frame at the ankle, toes forward: flat on the ground when standing, pointing down as the foot lifts. */
  private footFrame(side: 'N' | 'F'): (p: V) => V {
    const sk = this.skel, shin = sk.get(`shin${side}`), a = shin.end;
    const lying = this.mode === 'tumble' || this.mode === 'ground';
    const angle = lying ? shin.world - Math.PI / 2 + 0.4 : clamp((shin.world - Math.PI / 2) * 0.7, -0.5, 1.1);
    return (p: V) => sk.map(add(a, rot(p, angle)));
  }

  private drawArm(paper: Paper, side: 'N' | 'F', cloth: string): void {
    const sk = this.skel, L = this.look, k = side === 'N' ? 0 : 1;
    const sh = sk.point('spine', 0.9, { x: 0, y: side === 'N' ? 4 : -4 });
    paper.tube([sh, sk.point(`upper${side}`, 0.55), sk.point(`upper${side}`, 1), sk.point(`fore${side}`, 0.6), sk.point(`fore${side}`, 0.95)], 30, 21, cloth, { seed: this.seed + 20 + k, tear: 1.1 });
    this.drawHand(paper, sk.boneFrame(`fore${side}`), side === 'N' ? L.skin : L.skinShade, this.seed + 24 + k);
  }

  /** A hand along the forearm: palm, four fingers and a thumb, fingers curled unless the hand is flat on the ground. */
  private drawHand(paper: Paper, fore: (p: V) => V, skin: string, seed: number): void {
    const flat = this.mode === 'ground' || this.mode === 'tumble';
    const at = (pts: V[]) => pts.map(p => fore({ x: 56 + p.x, y: p.y }));
    paper.blob(at([{ x: -4, y: -6 }, { x: 6, y: -8 }, { x: 14, y: -6 }, { x: 15, y: 5 }, { x: 5, y: 8 }, { x: -4, y: 6 }]), skin, { seed, tear: 0.5 });
    [-5.5, -2, 1.5, 5].forEach((y, j) => {
      const len = [9, 11, 10.5, 8][j], curl = flat ? 0.1 : 1.1;
      const a = { x: 14, y }, b = { x: 14 + len * 0.6, y: y + curl * 2 }, c = { x: 14 + len * (1 - curl * 0.35), y: y + curl * 5 };
      paper.tube(at([a, b, c]), 3.8, 3, skin, { seed: seed + 3 + j, tear: 0.2 });
    });
    paper.tube(at([{ x: 4, y: -6 }, { x: 11, y: -10 }, { x: 16, y: -9 }]), 4.5, 3.4, skin, { seed: seed + 9, tear: 0.2 });
  }

  /** Coat: body, a skirt whose front follows the leading thigh and whose back flap trails in the wind, collar. */
  private drawCoat(paper: Paper): void {
    const sk = this.skel, L = this.look, F = sk.uprightFrame('spine', 0);
    const torso = [
      { x: -12, y: -100 }, { x: -24, y: -90 }, { x: -25, y: -60 }, { x: -20, y: -24 }, { x: -24, y: 14 },
      { x: 22, y: 16 }, { x: 18, y: -22 }, { x: 24, y: -58 }, { x: 16, y: -94 },
    ];
    paper.blob(torso.map(F), L.coat, { seed: this.seed + 30, tear: 1.4 });
    const lead = ['thighN', 'thighF'].map(t => ({ t, x: sk.get(t).end.x })).sort((a, b) => b.x - a.x)[0].t;
    const front = sk.point(lead, this.look.coatLength, { x: 0, y: -19 }), back = sk.point(lead, this.look.coatLength * 0.8, { x: 0, y: 16 });
    const flap = this.flap.pts;
    paper.piece([F({ x: -24, y: 6 }), ...flap, back, front, sk.point(lead, 0.3, { x: 0, y: -22 }), F({ x: 22, y: 10 })], L.coat, { seed: this.seed + 31, tear: 1.4 });
    if (L.scarf && this.scarfTail) {
      paper.ribbon(this.scarfTail.pts, u => 20 * (1 - u * 0.25), L.scarf.base, { seed: this.seed + 40, tear: 1.4 });
      paper.tube([F({ x: -16, y: -98 }), F({ x: 0, y: -104 }), F({ x: 16, y: -100 }), F({ x: 22, y: -92 })], 20, 20, L.scarf.base, { seed: this.seed + 41, tear: 1.2 });
    }
  }

  /** Neck, skull and face (one silhouette, the jaw opens with the mouth), ear, hair and hat. */
  private drawHeadMass(paper: Paper): void {
    const sk = this.skel, L = this.look, R = HEAD_R, H = this.headFrame();
    paper.tube([sk.get('neck').start, sk.get('neck').end].map(p => sk.map(p)), 22, 20, L.skinShade, { seed: this.seed + 50, tear: 0.8 });
    if (!this.hairOverArm) this.hair.draw(paper, 'under');
    paper.piece(this.profile().map(H), L.skin, { seed: this.seed + 51, tear: 0.5 });
    paper.piece(this.hairCap().map(H), L.hairCap, { seed: this.seed + 52, tear: 0.9 });
    if (!this.hairOverArm) this.hair.draw(paper, 'over');
    if (L.hat) {
      // A fedora: pinched crown, a brim all round that dips at the front and back.
      const hat = (pts: V[]) => pts.map(p => H({ x: p.x * R, y: p.y * R }));
      paper.blob(hat([{ x: -0.92, y: -0.6 }, { x: -0.82, y: -1.28 }, { x: -0.3, y: -1.46 }, { x: 0.05, y: -1.36 }, { x: 0.4, y: -1.5 }, { x: 0.82, y: -1.3 }, { x: 0.9, y: -0.62 }]), L.hat.crown, { seed: this.seed + 53, tear: 0.6 });
      paper.inside(() => paper.tube(hat([{ x: -0.9, y: -0.72 }, { x: 0, y: -0.78 }, { x: 0.88, y: -0.72 }]), 4.5, 4.5, L.hat!.band, { seed: this.seed + 55, tear: 0.3 }));
      paper.blob(hat([{ x: -1.5, y: -0.46 }, { x: -0.9, y: -0.66 }, { x: 0, y: -0.7 }, { x: 0.9, y: -0.66 }, { x: 1.56, y: -0.42 }, { x: 1.5, y: -0.34 }, { x: 0.9, y: -0.52 }, { x: 0, y: -0.56 }, { x: -0.9, y: -0.52 }, { x: -1.45, y: -0.36 }]), L.hat.crown, { seed: this.seed + 54, tear: 0.5 });
    }
  }

  /** Head frame: origin at the center of the skull, +x toward the face, +y down; units in px. */
  private headFrame(): (p: V) => V {
    return this.skel.uprightFrame('head', HEAD_R);
  }

  /** The outline of skull and face, in px; the jaw swings open around its hinge. */
  private profile(): V[] {
    const R = HEAD_R, open = this.intent.mouth * 0.32;
    const hinge = { x: -0.05, y: 0.12 };
    const swing = (p: V) => add(hinge, rot({ x: p.x - hinge.x, y: p.y - hinge.y }, open));
    const nose: V[] = [{ x: 0.93, y: -0.12 }, { x: 1.08, y: 0.08 }, { x: 1.2, y: 0.26 }, { x: 1.05, y: 0.34 }, { x: 1.0, y: 0.4 }, { x: 1.04, y: 0.5 }, { x: 0.99, y: 0.57 }];
    const mouth: V[] = open > 0.02 ? [{ x: 0.84, y: 0.6 }, swing({ x: 0.98, y: 0.59 })] : [];
    const pts = [...SKULL, ...nose, ...mouth, ...JAW.map(swing), ...NAPE];
    return smoothClosed(pts, 5).map(p => ({ x: p.x * R, y: p.y * R }));
  }

  /** Hair mass: crown, back of the head down to the nape, a hairline from the forehead to behind the ear. */
  private hairCap(): V[] {
    const R = HEAD_R;
    const cap: V[] = [
      { x: -1.1, y: 0.1 }, { x: -1.02, y: -0.55 }, { x: -0.66, y: -0.98 }, { x: -0.1, y: -1.16 }, { x: 0.5, y: -1.04 }, { x: 0.88, y: -0.7 },
      { x: 0.82, y: -0.58 }, { x: 0.46, y: -0.64 }, { x: 0.2, y: -0.4 }, { x: 0.02, y: -0.1 }, { x: -0.12, y: 0.3 }, { x: -0.5, y: 0.5 }, { x: -0.95, y: 0.48 },
    ];
    return smoothClosed(cap, 5).map(p => ({ x: p.x * R, y: p.y * R }));
  }

  /** Everything drawn inside the body sheet: face, ear, coat seams and buttons, scarf stripes, mud. */
  private drawMarkings(paper: Paper): void {
    const sk = this.skel, L = this.look, F = sk.uprightFrame('spine', 0);
    const flat = (k: number, tear = 0.3) => ({ seed: this.seed + k, tear });
    paper.line([F({ x: 20, y: -86 }), F({ x: 8, y: -60 }), F({ x: 14, y: 10 })], L.coatDetail, 2);
    paper.line([F({ x: -6, y: -30 }), F({ x: 12, y: -30 })], L.coatDetail, 1.6);
    [-50, -26, -2].forEach((y, j) => paper.piece(circlePoly(F({ x: 17, y }), 2.6, 8), L.coatDetail, flat(60 + j)));
    if (L.scarf) {
      for (const u of [0.3, 0.6]) paper.line([F({ x: -18, y: -102 + u * 6 }), F({ x: 20, y: -98 + u * 6 })], L.scarf.stripe, 3);
    }
    if (this.mud > 0) {
      this.splotches(paper, F, [[22, -44, 16], [24, -8, 18], [18, 22, 14], [26, 44, 12]], this.mud, 300, Math.PI / 2);
      for (const leg of ['N', 'F']) this.splotches(paper, sk.boneFrame(`thigh${leg}`), [[80, -12, 16], [60, -14, 10]], this.mud, 320 + leg.charCodeAt(0));
    }
    this.drawFace(paper);
  }

  /**
   * Mud: smears dragged along the body (the way it slid), each a torn, translucent streak with a
   * wetter core, at [x, y, length] in a frame; `angle` is the drag direction in that frame.
   */
  private splotches(paper: Paper, F: (p: V) => V, spots: [number, number, number][], amount: number, seed: number, angle = 0): void {
    const L = this.look;
    paper.layer(0.72, () => spots.forEach(([x, y, len], j) => {
      const l = len * amount, w = l * (0.32 + (j % 3) * 0.08), d = rot({ x: 1, y: 0 }, angle + (j % 2 ? 0.25 : -0.2));
      const at = (u: number, v: number) => F({ x: x + d.x * u - d.y * v, y: y + d.y * u + d.x * v });
      paper.piece([at(-l, 0), at(-l * 0.3, -w), at(l * 0.6, -w * 0.6), at(l, 0), at(l * 0.5, w * 0.7), at(-l * 0.4, w)], L.mud, { seed: seed + j, tear: w * 0.45 });
      paper.piece([at(-l * 0.5, 0), at(0, -w * 0.4), at(l * 0.4, 0), at(0, w * 0.35)], L.mudDeep, { seed: seed + 20 + j, tear: w * 0.25 });
    }));
  }

  /**
   * The face, for close-ups: ear, a profile eye (sclera wedge, iris and pupil, catchlight, heavy upper lid
   * and lashes, lower lid), brow, nostril and nose wing, lips in two tones, the mouth when open, mud and
   * rain on the skin, and wet strands stuck to the forehead and cheek.
   */
  private drawFace(paper: Paper): void {
    const L = this.look, i = this.intent, R = HEAD_R, H = this.headFrame();
    const at = (pts: V[]) => pts.map(p => H({ x: p.x * R, y: p.y * R }));
    const flat = (k: number) => ({ seed: this.seed + k, tear: 0.12 });
    const ink = L.ink;

    // Ear (under the hair for long hair; the hair cap covers most of it).
    paper.piece(at(circlePoly({ x: -0.12, y: 0.12 }, 0.28, 12, 0.19)), L.skinShade, flat(70));
    paper.line(at([{ x: -0.06, y: -0.06 }, { x: -0.2, y: 0.08 }, { x: -0.1, y: 0.28 }]), 'rgba(40, 30, 30, 0.45)', 1.2);

    // Cheek and eye socket shading.
    paper.piece(at(circlePoly({ x: 0.56, y: 0.2 }, 0.22, 12, 0.3)), 'rgba(0, 0, 0, 0.08)', flat(71));
    paper.piece(at(circlePoly({ x: 0.7, y: -0.16 }, 0.14, 10, 0.18)), 'rgba(0, 0, 0, 0.12)', flat(72));

    // Eye: a wedge open toward the front, lids with a little thickness, a lash line.
    const open = clamp(i.blink), c = { x: 0.69, y: -0.15 };
    const lidTop = -0.12 * open, lidBottom = 0.07 * Math.max(open, 0.2);
    const eye: V[] = [{ x: 0.53, y: -0.14 }, { x: 0.62, y: c.y + lidTop * 0.9 }, { x: c.x + 0.06, y: c.y + lidTop }, { x: 0.86, y: -0.16 }, { x: c.x + 0.04, y: c.y + lidBottom }, { x: 0.6, y: c.y + lidBottom * 0.8 }];
    if (open > 0.15) {
      paper.piece(at(eye), L.sclera, flat(73));
      paper.clip(at(eye), () => {
        let dy = 0;
        if (i.look) { const e = H({ x: c.x * R, y: c.y * R }), d = Math.hypot(i.look.x - e.x, i.look.y - e.y) || 1; dy = ((i.look.y - e.y) / d) * 0.04; }
        paper.piece(at(circlePoly({ x: c.x + 0.08, y: c.y + dy }, 0.11, 14, 0.065)), L.iris, flat(74));
        paper.piece(at(circlePoly({ x: c.x + 0.1, y: c.y + dy }, 0.06, 10, 0.035)), ink, flat(75));
        paper.piece(at(circlePoly({ x: c.x + 0.06, y: c.y + dy + 0.05 }, 0.05, 10, 0.05)), 'rgba(255, 255, 255, 0.18)', flat(69));
      });
      paper.piece(at(circlePoly({ x: c.x + 0.11, y: c.y - 0.04 }, 0.022, 6)), '#ffffff', flat(76));
    }
    paper.line(at([{ x: 0.52, y: -0.13 }, { x: 0.62, y: c.y + lidTop * 0.9 - 0.012 }, { x: c.x + 0.06, y: c.y + lidTop - 0.015 }, { x: 0.88, y: -0.17 }]), ink, 2.6 * Math.max(0.6, this.lens * 1.4));
    for (const [x, y] of [[0.76, -0.25], [0.81, -0.23], [0.85, -0.2]] as const) {
      const yy = y + (1 - open) * 0.1;
      paper.line(at([{ x, y: yy }, { x: x + 0.05, y: yy - 0.04 }]), ink, 1.2);
    }
    paper.line(at([{ x: 0.6, y: c.y + lidBottom * 0.8 + 0.01 }, { x: c.x + 0.04, y: c.y + lidBottom + 0.01 }, { x: 0.86, y: -0.14 }]), 'rgba(40, 30, 30, 0.45)', 1);
    paper.line(at([{ x: 0.58, y: -0.3 }, { x: 0.72, y: -0.33 }, { x: 0.84, y: -0.29 }]), 'rgba(40, 30, 30, 0.3)', 1);

    // Brow: the inner end (toward the nose) rises in fear, drops in effort.
    const inner = -0.44 - i.brow * 0.08;
    paper.tube(at([{ x: 0.52, y: -0.42 }, { x: 0.72, y: -0.47 - Math.max(0, i.brow) * 0.03 }, { x: 0.9, y: inner }]), 3.4, 2.4, L.hairCap, flat(77));

    // Nose wing, nostril, the groove to the mouth.
    paper.line(at([{ x: 0.96, y: 0.2 }, { x: 0.9, y: 0.27 }, { x: 0.96, y: 0.33 }]), 'rgba(40, 30, 30, 0.55)', 1.3);
    paper.piece(at(circlePoly({ x: 1.03, y: 0.31 }, 0.03, 8, 0.06)), 'rgba(30, 20, 20, 0.7)', flat(78));
    paper.line(at([{ x: 0.9, y: 0.34 }, { x: 0.86, y: 0.48 }, { x: 0.88, y: 0.58 }]), 'rgba(40, 30, 30, 0.25)', 1.2);

    // Lips, and the mouth when it opens (dark inside, a hint of teeth).
    const jaw = this.intent.mouth * 0.32;
    const low = (p: V) => add({ x: -0.05, y: 0.12 }, rot({ x: p.x + 0.05, y: p.y - 0.12 }, jaw));
    paper.piece(at([{ x: 0.94, y: 0.45 }, { x: 1.06, y: 0.49 }, { x: 1.0, y: 0.57 }, { x: 0.9, y: 0.56 }]), L.lip, flat(79));
    paper.piece(at([low({ x: 0.9, y: 0.6 }), low({ x: 1.02, y: 0.62 }), low({ x: 1.0, y: 0.7 }), low({ x: 0.9, y: 0.68 })]), L.lip, flat(80));
    if (jaw > 0.02) {
      paper.piece(at([{ x: 1.0, y: 0.56 }, { x: 0.78, y: 0.6 }, low({ x: 1.0, y: 0.6 })]), '#1a1414', flat(81));
      paper.line(at([{ x: 0.99, y: 0.565 }, { x: 0.88, y: 0.58 }]), 'rgba(235, 230, 225, 0.8)', 1.4);
    } else {
      paper.line(at([{ x: 1.0, y: 0.575 }, { x: 0.88, y: 0.58 }]), 'rgba(40, 20, 20, 0.7)', 1.3);
    }
    paper.line(at([{ x: 0.9, y: 0.82 }, { x: 0.8, y: 0.78 }]), 'rgba(40, 30, 30, 0.2)', 1.2);

    // Mud smeared across the cheek and jaw, with rain washing thin streaks down through it.
    if (this.mud > 0) {
      const m = this.mud;
      paper.layer(0.55, () => {
        paper.piece(at([{ x: 0.42, y: 0.28 }, { x: 0.7, y: 0.18 }, { x: 0.98, y: 0.3 }, { x: 0.9, y: 0.44 }, { x: 0.6, y: 0.5 }, { x: 0.4, y: 0.44 }].map(p => ({ x: 0.7 + (p.x - 0.7) * m, y: 0.34 + (p.y - 0.34) * m }))), L.mud, { seed: this.seed + 82, tear: 1.4 * m });
        paper.piece(at([{ x: 0.6, y: 0.8 }, { x: 0.92, y: 0.78 }, { x: 0.96, y: 0.92 }, { x: 0.7, y: 0.98 }]), L.mud, { seed: this.seed + 83, tear: 1.2 * m });
        paper.piece(at([{ x: 1.06, y: 0.14 }, { x: 1.18, y: 0.22 }, { x: 1.1, y: 0.28 }]), L.mudDeep, flat(85));
      });
      for (const x of [0.62, 0.8]) paper.line(at([{ x, y: 0.32 }, { x: x + 0.015, y: 0.46 }, { x: x - 0.005, y: 0.58 }]), 'rgba(200, 196, 192, 0.18)', 1);
    }
    for (const [x, y, r] of [[0.6, 0.08, 0.022], [1.13, 0.15, 0.018]] as const) {
      paper.piece(at(circlePoly({ x, y }, r, 8)), 'rgba(255, 255, 255, 0.5)', flat(86 + x * 10));
    }
    paper.line(at([{ x: 1.06, y: 0.07 }, { x: 1.15, y: 0.22 }]), 'rgba(255, 255, 255, 0.35)', 1.2);

    // Wet strands stuck to the forehead and down past the ear.
    if (!L.hat) {
      paper.ribbon(at([{ x: 0.52, y: -0.8 }, { x: 0.5, y: -0.5 }, { x: 0.4, y: -0.2 }, { x: 0.4, y: 0.16 }]), u => 2.6 * (1 - u * 0.8), L.hairCap, flat(90));
    }
  }
}
