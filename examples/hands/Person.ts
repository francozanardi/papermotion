import { type BoneDef, Gait, type Paper, Skeleton, Spring, type V, add, clamp, lerp, lerpV, rot, smoothClosed } from '../../src';
import { type HandShape, handOutline, placeHand } from './hand';

export type Outfit = 'hide' | 'jacket';

export interface Palette {
  skin: string; skinFar: string; skinLight: string; skinDark: string;
  hair: string; hairLight: string;
  cloth: string; clothFar: string; clothLight: string; clothDark: string;
  legs: string; legsFar: string; feet: string;
  accent: string; eye: string; rim: string; shade: string;
}

export interface PersonIntent {
  speed: number;
  facing: 1 | -1;
  /** Hips lowered (px): 0 standing, ~70 squatting. */
  crouch: number;
  lean: number;
  /** World point the head turns to. */
  look: V | null;
  /** World point the near hand reaches for, with the hand flat and open. */
  reach: V | null;
  /** Finger spread and curl of the reaching hand. */
  spread: number;
  curl: number;
  /** Angle the open hand's fingers point to (world rad); null follows the forearm. */
  palmAngle: number | null;
  /** World point the far hand holds (e.g. the blowpipe at the mouth). */
  hold: V | null;
  /** 0…1: blowing (cheeks, the pipe at the mouth). */
  blow: number;
  /** Eyelids: 1 open. */
  open: number;
}

const REST: PersonIntent = { speed: 0, facing: 1, crouch: 0, lean: 0, look: null, reach: null, spread: 0.7, curl: 0, palmAngle: null, hold: null, blow: 0, open: 1 };

const soft = (stiffness: number, damping: number, inertia = 0, sway = 0) => ({ stiffness, damping, inertia, sway });
const BONES: BoneDef[] = [
  { name: 'pelvis', length: 16, angle: -Math.PI / 2 },
  { name: 'spine', parent: 'pelvis', length: 66, angle: 0, spring: soft(260, 22, 0.1, 0.2) },
  { name: 'chest', parent: 'spine', length: 40, angle: 0, spring: soft(240, 20, 0.1, 0.2) },
  { name: 'neck', parent: 'chest', length: 18, angle: 0.12, spring: soft(200, 18, 0.2, 0.3) },
  { name: 'head', parent: 'neck', length: 34, angle: 0, spring: soft(150, 15, 0.3, 0.4) },
  { name: 'thighF', parent: 'pelvis', at: 0.2, length: 72, angle: Math.PI },
  { name: 'shinF', parent: 'thighF', length: 70, angle: 0 },
  { name: 'thighN', parent: 'pelvis', at: 0.2, length: 72, angle: Math.PI },
  { name: 'shinN', parent: 'thighN', length: 70, angle: 0 },
  { name: 'upperF', parent: 'chest', at: 0.92, length: 58, angle: Math.PI, spring: soft(90, 12, 0.2, 0.6) },
  { name: 'foreF', parent: 'upperF', length: 52, angle: 0, spring: soft(90, 11, 0.2, 0.6) },
  { name: 'upperN', parent: 'chest', at: 0.92, length: 58, angle: Math.PI, spring: soft(90, 12, 0.2, 0.6) },
  { name: 'foreN', parent: 'upperN', length: 52, angle: 0, spring: soft(90, 11, 0.2, 0.6) },
];

/**
 * A person in profile, built from bones: walks with a gait, squats, turns like paper, looks at
 * things, reaches with an open hand (the hand drawn flat, as on a wall), and holds a pipe to the
 * mouth with the other. Two outfits: a hide wrap with ochre marks, or a hiker's jacket and beanie.
 */
export class Person {
  readonly skel: Skeleton;
  readonly intent: PersonIntent = { ...REST };
  x: number;
  /** Line weights: ~zoom^-0.55, set by the scene per shot. */
  lens = 1;
  private readonly gait: Gait;
  private turn: number;
  private readonly spreadS = new Spring({ x: 0.2, y: 0 }, 60, 14);
  private readonly blowS = new Spring({ x: 0, y: 0 }, 90, 16);
  private readonly lid = new Spring({ x: 1, y: 0 }, 400, 40);
  private readonly palm = new Spring({ x: 0, y: 0 }, 70, 14);
  private reaching = 0;
  private holding = 0;

  private stepCount = 0;
  private stepped = false;

  constructor(x: number, facing: 1 | -1, private readonly ground: number, readonly outfit: Outfit, readonly pal: Palette, private readonly hand: Omit<HandShape, 'spread' | 'side' | 'curl'>) {
    this.x = x;
    this.turn = facing;
    this.intent.facing = facing;
    this.skel = new Skeleton(BONES, { x, y: ground });
    this.skel.flip = facing;
    this.gait = new Gait({
      pelvis: 'pelvis', legs: [['thighN', 'shinN'], ['thighF', 'shinF']], arms: [['upperN', 'foreN'], ['upperF', 'foreF']],
      hipHeight: 136, step: 46, runSpeed: 420, bounce: 5, footLift: 14, footReach: 23, lean: 0.08, stance: 7, armSwing: 1.1, elbow: 0.7,
    });
  }

  /** True once after a foot lands (read-and-clear). */
  consumeStep(): boolean { const s = this.stepped; this.stepped = false; return s; }

  rest(): void { Object.assign(this.intent, REST, { facing: this.intent.facing }); }

  /** Where the head is (world), for framing and look lines. */
  get head(): V { return this.skel.point('head', 0.5); }
  /** Mouth in world coordinates. */
  get mouth(): V { return this.skel.uprightFrame('head', 14)({ x: 25, y: 13 }); }
  /** Near wrist in world coordinates. */
  get wrist(): V { return this.skel.point('foreN', 1); }
  /** How far through a paper turn: 1 or −1 when settled. */
  get facingNow(): number { return this.turn; }

  update(dt: number, t: number): void {
    const i = this.intent, s = this.skel;
    void t;
    // Paper turn: squash through edge-on in about 0.3 s, and only walk once it is done.
    this.turn = clamp(this.turn + Math.sign(i.facing - this.turn) * Math.min(Math.abs(i.facing - this.turn), dt / 0.16), -1, 1);
    const settled = Math.abs(this.turn - i.facing) < 0.05;
    const speed = settled ? i.speed : 0;
    this.x += speed * i.facing * dt;
    s.flip = Math.abs(this.turn) < 0.08 ? 0.08 * Math.sign(this.turn || i.facing) : this.turn;
    s.root = { x: this.x, y: this.ground };
    this.gait.update(s, { speed, crouch: i.crouch, lean: i.lean, ground: () => -9, footOffset: i.crouch > 20 ? [{ x: 16, y: 0 }, { x: -6, y: 0 }] : undefined }, dt);

    const count = Math.floor(this.gait.phase / Math.PI);
    if (count !== this.stepCount && Math.abs(speed) > 1) this.stepped = true;
    this.stepCount = count;
    this.reaching += ((i.reach ? 1 : 0) - this.reaching) * (1 - Math.exp(-dt * 6));
    this.holding += ((i.hold ? 1 : 0) - this.holding) * (1 - Math.exp(-dt * 7));
    this.spreadS.step({ x: i.reach ? i.spread : 0.15, y: 0 }, dt);
    this.blowS.step({ x: i.blow, y: 0 }, dt);
    this.lid.step({ x: i.open, y: 0 }, dt);

    if (i.reach) {
      const target = s.toLocal(i.reach);
      s.reach('upperN', 'foreN', target, 1);
    }
    if (i.hold) s.reach('upperF', 'foreF', s.toLocal(i.hold), 1);
    // Squatting: forearms rest forward over the knees.
    if (i.crouch > 30 && !i.reach) s.reach('upperN', 'foreN', { x: 52, y: -i.crouch * 0.2 - 150 + i.crouch }, 1);
    if (i.crouch > 30 && !i.hold) s.reach('upperF', 'foreF', { x: 46, y: -i.crouch * 0.2 - 146 + i.crouch }, 1);

    if (i.look) {
      const h = s.get('neck').end, q = s.toLocal(i.look);
      const ang = Math.atan2(q.y - h.y, q.x - h.x);
      // The face points along the head bone turned a quarter forward; the neck takes part of the turn.
      const face = clamp(ang, -1.05, 0.75);
      s.setWorld('neck', face * 0.4 - Math.PI / 2 + 0.1);
      s.setWorld('head', face - Math.PI / 2);
    }
    if (i.palmAngle !== null) this.palm.step({ x: i.palmAngle, y: 0 }, dt);
    s.step(dt);
  }

  /** The reaching hand's outline in world coordinates (the stencil mask when it is on a wall). */
  handPoly(): V[] {
    const i = this.intent, s = this.skel, sp = this.spreadS.pos.x;
    const w = this.wrist, fore = s.get('foreN');
    const dir = s.flip >= 0 ? fore.world : Math.PI - fore.world;
    // Open and reaching: the hand turns to face us, fingers toward `palmAngle`.
    const flat = this.reaching;
    const a = i.palmAngle !== null && flat > 0.5 ? this.palm.pos.x : dir;
    const side: 1 | -1 = s.flip >= 0 ? 1 : -1;
    const out = handOutline({ ...this.hand, spread: sp, side, curl: i.curl });
    // Hanging or swinging: the hand is seen edge-on, so squash it across.
    const across = lerp(0.45, 1, flat);
    return placeHand(out.map(p => ({ x: p.x, y: p.y * across })), w, a);
  }

  draw(p: Paper): void {
    const L = this.pal, k = this.lens, anchor = this.skel.root;
    const far = { shadow: 5 * k, rim: { color: L.rim, width: 1.6 * k }, edge: true, anchor };
    p.sheet(far, () => {
      this.leg(p, 'F');
      this.arm(p, 'F');
      if (this.holding > 0.3 && this.outfit === 'hide') this.pipe(p);
    });
    const body = { shadow: 9 * k, rim: { color: L.rim, width: 3 * k }, shade: { color: L.shade, width: 8 * k }, anchor };
    p.sheet(body, () => {
      this.leg(p, 'N');
      this.torso(p);
      this.headPiece(p);
      p.inside(() => { this.clothDetail(p); this.face(p); });
    });
    p.sheet({ ...body, shade: { color: L.shade, width: 5 * k } }, () => {
      this.arm(p, 'N');
      p.inside(() => this.sleeveDetail(p));
    });
  }

  /** The silhouette only (for cast shadows): cheaper, no inside detail. */
  drawSilhouette(p: Paper): void {
    const o = { shadow: 0, edge: false, texture: 0 };
    p.sheet(o, () => { this.leg(p, 'F'); this.arm(p, 'F'); this.leg(p, 'N'); this.torso(p); this.headPiece(p); this.arm(p, 'N'); });
  }

  private M(q: V): V { return this.skel.map(q); }

  private leg(p: Paper, side: 'N' | 'F'): void {
    const s = this.skel, L = this.pal, near = side === 'N';
    const th = s.get('thigh' + side), sh = s.get('shin' + side);
    const hip = this.M(th.start), knee = this.M(th.end), ankle = this.M(sh.end);
    const col = this.outfit === 'hide' ? (near ? L.skin : L.skinFar) : (near ? L.legs : L.legsFar);
    p.tube([hip, knee, ankle], 30, 14, col, { seed: near ? 11 : 12, tear: 0.8 });
    const a = sh.end, f = this.outfit === 'hide' ? 1 : 1.15;
    const foot = [{ x: a.x - 9 * f, y: a.y - 3 }, { x: a.x - 10 * f, y: a.y + 9 }, { x: a.x + 24 * f, y: a.y + 10 }, { x: a.x + 26 * f, y: a.y + 5 }, { x: a.x + 8, y: a.y - 3 }, { x: a.x + 2, y: a.y - 8 }];
    p.blob(foot.map(q => this.M(q)), this.outfit === 'hide' ? col : L.feet, { seed: near ? 13 : 14, tear: 0.6 });
  }

  private arm(p: Paper, side: 'N' | 'F'): void {
    const s = this.skel, L = this.pal, near = side === 'N';
    const up = s.get('upper' + side), fo = s.get('fore' + side);
    const sh = this.M(up.start), el = this.M(up.end), wr = this.M(fo.end);
    const sleeve = this.outfit === 'jacket';
    const skin = near ? L.skin : L.skinFar;
    p.tube([sh, el, wr], sleeve ? 27 : 22, sleeve ? 18 : 13, sleeve ? (near ? L.cloth : L.clothFar) : skin, { seed: near ? 21 : 22, tear: 0.7 });
    if (near) p.piece(smoothClosed(this.handPoly(), 2), skin, { seed: 23, tear: 0.35 });
    else {
      const out = handOutline({ ...this.hand, spread: 0.1, side: 1, curl: this.holding > 0.3 ? 0.9 : 0.35 });
      const dir = s.flip >= 0 ? fo.world : Math.PI - fo.world;
      p.piece(smoothClosed(placeHand(out.map(q => ({ x: q.x, y: q.y * 0.5 })), wr, dir), 2), skin, { seed: 24, tear: 0.35 });
    }
  }

  private pipe(p: Paper): void {
    const m = this.mouth, h = this.skel.uprightFrame('head', 14);
    const tip = h({ x: 25 + 34, y: 13 + 6 });
    p.tube([m, tip], 6.5, 5.5, '#d8c9a8', { seed: 31, tear: 0.3 });
  }

  /** Mouth end of the pipe (where the spray comes out), world. */
  get pipeTip(): V { return this.skel.uprightFrame('head', 14)({ x: 25 + 36, y: 13 + 6.5 }); }

  private torso(p: Paper): void {
    const s = this.skel, L = this.pal;
    const sp = s.boneFrame('spine'), ch = s.boneFrame('chest');
    const bare = this.outfit === 'hide';
    const body = [sp({ x: -6, y: -19 }), sp({ x: 10, y: -21 }), sp({ x: 42, y: -16 }), ch({ x: 18, y: -17 }), ch({ x: 38, y: -12 }), ch({ x: 45, y: 1 }), ch({ x: 30, y: 15 }), sp({ x: 52, y: 15 }), sp({ x: 14, y: 17 }), sp({ x: -8, y: 6 })];
    p.blob(body, bare ? L.skin : L.cloth, { seed: 41, tear: 1 });
    p.tube([ch({ x: 36, y: 0 }), this.M(s.get('neck').end)], 22, 19, L.skin, { seed: 42, tear: 0.6 });
    if (this.outfit === 'hide') {
      // A loin wrap, and a guanaco-fur cape tied at the chest that falls over the back to the knees.
      const kn = s.get('thighN'), kf = s.get('thighF');
      const hemN = this.M({ x: lerp(kn.start.x, kn.end.x, 0.3) + 8, y: lerp(kn.start.y, kn.end.y, 0.4) });
      const hemF = this.M({ x: lerp(kf.start.x, kf.end.x, 0.3) - 10, y: lerp(kf.start.y, kf.end.y, 0.4) });
      p.blob([sp({ x: 12, y: 17 }), hemN, lerpV(hemN, hemF, 0.5), hemF, sp({ x: 12, y: -20 })], L.clothDark, { seed: 43, tear: 1.4 });
      p.blob(this.cape(), L.cloth, { seed: 46, tear: 2.2 });
    } else {
      const jacket = [sp({ x: -12, y: -21 }), sp({ x: 30, y: -22 }), ch({ x: 22, y: -21 }), ch({ x: 42, y: -13 }), ch({ x: 47, y: 3 }), ch({ x: 28, y: 20 }), sp({ x: 40, y: 21 }), sp({ x: -10, y: 20 })];
      p.blob(jacket, L.cloth, { seed: 44, tear: 0.9 });
      // Backpack on the far side of the back.
      p.blob([ch({ x: 36, y: -18 }), ch({ x: 30, y: -38 }), sp({ x: 30, y: -42 }), sp({ x: 6, y: -38 }), sp({ x: 4, y: -20 })], L.clothDark, { seed: 45, tear: 1 });
    }
  }

  /** The cape's outline: from the knot at the chest, over the shoulder, flaring down the back. */
  private cape(): V[] {
    const s = this.skel, sp = s.boneFrame('spine'), ch = s.boneFrame('chest');
    return [ch({ x: 30, y: 16 }), ch({ x: 44, y: 8 }), ch({ x: 47, y: -6 }), ch({ x: 36, y: -24 }), sp({ x: 30, y: -30 }), sp({ x: -18, y: -38 }), sp({ x: -58, y: -40 }), sp({ x: -64, y: -22 }), sp({ x: -60, y: -2 }), sp({ x: 10, y: -6 }), ch({ x: 14, y: 2 })];
  }

  /** Skull and hair (or beanie): the silhouette pieces of the head. */
  private headPiece(p: Paper): void {
    const L = this.pal, h = this.skel.uprightFrame('head', 14), puff = this.blowS.pos.x;
    const strong = this.outfit === 'hide';
    const skull: V[] = strong
      ? [{ x: -21, y: 4 }, { x: -20, y: -15 }, { x: -8, y: -26 }, { x: 8, y: -26 }, { x: 18, y: -18 }, { x: 25, y: -10 }, { x: 22, y: -5 }, { x: 25, y: 0 }, { x: 31, y: 7 }, { x: 25, y: 10 }, { x: 27, y: 13 + puff * 1.5 }, { x: 24 + puff * 3, y: 16 }, { x: 26, y: 18 }, { x: 23, y: 25 }, { x: 10, y: 28 }, { x: -3, y: 24 }, { x: -13, y: 17 }]
      : [{ x: -20, y: 4 }, { x: -19, y: -15 }, { x: -7, y: -26 }, { x: 9, y: -25 }, { x: 19, y: -17 }, { x: 22, y: -8 }, { x: 21, y: -3 }, { x: 28, y: 6 }, { x: 22, y: 9 }, { x: 24, y: 13 }, { x: 22, y: 16 }, { x: 23, y: 18 }, { x: 20, y: 25 }, { x: 8, y: 27 }, { x: -3, y: 23 }, { x: -13, y: 17 }];
    p.piece(smoothClosed(skull.map(h), 4), L.skin, { seed: 51, tear: 0.5 });
    if (strong) {
      const hair: V[] = [{ x: -25, y: 0 }, { x: -23, y: -20 }, { x: -9, y: -31 }, { x: 8, y: -31 }, { x: 20, y: -22 }, { x: 22, y: -14 }, { x: 13, y: -18 }, { x: 4, y: -19 }, { x: -6, y: -12 }, { x: -9, y: 4 }, { x: -12, y: 20 }, { x: -16, y: 36 }, { x: -22, y: 30 }, { x: -27, y: 40 }, { x: -31, y: 22 }];
      p.piece(smoothClosed(hair.map(h), 3), L.hair, { seed: 52, tear: 1.4 });
    } else {
      const hat: V[] = [{ x: -23, y: -2 }, { x: -22, y: -20 }, { x: -9, y: -33 }, { x: 8, y: -33 }, { x: 20, y: -24 }, { x: 23, y: -12 }, { x: 10, y: -12 }, { x: -6, y: -9 }];
      p.piece(smoothClosed(hat.map(h), 3), L.accent, { seed: 53, tear: 0.9 });
      p.blob([{ x: -22, y: -3 }, { x: -12, y: -4 }, { x: -13, y: 8 }, { x: -19, y: 10 }].map(h), L.hair, { seed: 54, tear: 0.8 });
      // The headlamp on its strap.
      p.blob([{ x: 17, y: -18 }, { x: 25, y: -17 }, { x: 26, y: -10 }, { x: 18, y: -10 }].map(h), '#2a2d33', { seed: 55, tear: 0.4 });
    }
  }

  /** The headlamp lens (world), and where it points. */
  get lamp(): { at: V; angle: number } {
    const h = this.skel.uprightFrame('head', 14), a = h({ x: 26, y: -14 }), b = h({ x: 60, y: -10 });
    return { at: a, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  private face(p: Paper): void {
    const L = this.pal, h = this.skel.uprightFrame('head', 14), k = this.lens;
    const strong = this.outfit === 'hide';
    // Ear, in two tones.
    p.blob([{ x: -7, y: -6 }, { x: -1, y: -8 }, { x: 1, y: -2 }, { x: -1, y: 4 }, { x: -6, y: 3 }].map(h), L.skinDark, { seed: 61, tear: 0.4 });
    p.blob([{ x: -5, y: -4 }, { x: -2, y: -5 }, { x: -1, y: 0 }, { x: -4, y: 1 }].map(h), L.skin, { seed: 62, tear: 0.3 });
    if (!strong) { /* the beanie covers the ear's top */ p.blob([{ x: -23, y: -2 }, { x: -6, y: -9 }, { x: 10, y: -12 }, { x: 10, y: -30 }, { x: -22, y: -26 }].map(h), L.accent, { seed: 63, tear: 0.9 }); }
    // Cheek in the light, jaw underside in shade.
    p.blob([{ x: 6, y: 2 }, { x: 16, y: 0 }, { x: 20, y: 8 }, { x: 12, y: 12 }].map(h), L.skinLight, { seed: 64, tear: 0.5 });
    p.blob([{ x: -4, y: 24 }, { x: 10, y: 28 }, { x: 22, y: 25 }, { x: 18, y: 30 }, { x: -4, y: 30 }].map(h), L.skinDark, { seed: 65, tear: 0.5 });
    // Nostril and mouth.
    p.blob([{ x: 24, y: 6 }, { x: 27, y: 7 }, { x: 25, y: 9 }].map(h), L.skinDark, { seed: 66, tear: 0.2 });
    p.line([{ x: 20, y: 15 }, { x: 25, y: 15 + this.blowS.pos.x * 0.5 }].map(h), L.skinDark, 1.6 * k);
    // Eye: white, iris with a lit lower half, pupil, catchlight, lid.
    const open = clamp(this.lid.pos.x, 0.05, 1);
    const e = { x: 14, y: -5 };
    p.blob([{ x: e.x - 5, y: e.y }, { x: e.x, y: e.y - 3 * open }, { x: e.x + 5, y: e.y - 0.5 }, { x: e.x, y: e.y + 2.2 * open }].map(h), '#e9dcc8', { seed: 67, tear: 0.1 });
    if (open > 0.3) {
      const ic = h({ x: e.x + 2, y: e.y - 0.3 });
      p.piece(circle(ic, 2.7), L.eye, { seed: 68, tear: 0 });
      p.piece(circle(h({ x: e.x + 2.2, y: e.y + 0.6 }), 1.6), '#6b4a30', { seed: 69, tear: 0 });
      p.piece(circle(ic, 1.3), '#0c0806', { seed: 70, tear: 0 });
      p.piece(circle(h({ x: e.x + 3, y: e.y - 1.4 }), 0.7), '#fff6e4', { seed: 71, tear: 0 });
    }
    p.line([{ x: e.x - 5.5, y: e.y - 0.3 }, { x: e.x, y: e.y - 3.4 * open }, { x: e.x + 5.5, y: e.y - 0.8 }].map(h), '#1a0f0a', 1.7 * k);
    // Brow (a heavier ridge on the ancient face).
    p.line([{ x: e.x - 5, y: e.y - 6 }, { x: e.x + 1, y: e.y - 7.5 }, { x: e.x + 8, y: e.y - 5.5 }].map(h), strong ? L.hair : L.skinDark, (strong ? 2.6 : 1.8) * k);
    if (strong) {
      // Two ochre stripes on the cheek.
      p.line([{ x: 5, y: 3 }, { x: 13, y: 6 }].map(h), L.accent, 2.4 * k);
      p.line([{ x: 4, y: 8 }, { x: 12, y: 11 }].map(h), L.accent, 2.4 * k);
      // Puffed cheek while blowing.
      if (this.blowS.pos.x > 0.05) p.blob([{ x: 12, y: 6 }, { x: 22, y: 7 }, { x: 22, y: 14 }, { x: 13, y: 14 }].map(h), L.skinLight, { seed: 72, tear: 0.3 });
    }
  }

  private clothDetail(p: Paper): void {
    const s = this.skel, L = this.pal, k = this.lens;
    const sp = s.boneFrame('spine'), ch = s.boneFrame('chest');
    if (this.outfit === 'hide') {
      // Fur: a pale belly band at the hem, darker strokes of guard hair, a thong tie at the chest.
      const hem = this.cape();
      p.clip(hem, () => {
        p.blob([sp({ x: -40, y: -50 }), sp({ x: -40, y: 10 }), sp({ x: -80, y: 10 }), sp({ x: -80, y: -50 })], L.clothLight, { seed: 81, tear: 2 });
        for (let j = 0; j < 7; j++) p.line([sp({ x: 30 - j * 12, y: -32 + (j % 3) * 4 }), sp({ x: 12 - j * 12, y: -26 + (j % 2) * 5 })], L.clothDark, 1.3 * k);
      });
      p.line([ch({ x: 30, y: 16 }), ch({ x: 22, y: 20 }), ch({ x: 14, y: 17 })], L.clothDark, 2 * k);
      for (let j = 0; j < 5; j++) {
        const q = ch({ x: 34 - j * 2.2, y: 2 + j * 3.4 });
        p.piece(circle(q, 2.2), j === 2 ? L.accent : '#e8dcc4', { seed: 83 + j, tear: 0.3 });
      }
    } else {
      p.line([ch({ x: 44, y: 6 }), ch({ x: 20, y: 17 }), sp({ x: 30, y: 19 }), sp({ x: -8, y: 18 })], L.clothDark, 1.6 * k);
      for (let j = 0; j < 4; j++) p.line([sp({ x: 4 + j * 16, y: -21 }), sp({ x: 4 + j * 16, y: 20 })], L.clothDark, 1.2 * k);
      p.line([ch({ x: 42, y: -8 }), ch({ x: 10, y: 4 }), sp({ x: 40, y: 12 })], L.clothDark, 3 * k);
      p.blob([sp({ x: -12, y: -21 }), sp({ x: -12, y: 20 }), sp({ x: -4, y: 20 }), sp({ x: -4, y: -21 })], L.clothLight, { seed: 85, tear: 0.5 });
    }
  }

  private sleeveDetail(p: Paper): void {
    const s = this.skel, L = this.pal, k = this.lens;
    if (this.outfit === 'jacket') {
      const w = this.wrist, el = s.point('upperN', 1), d = { x: el.x - w.x, y: el.y - w.y }, n = Math.hypot(d.x, d.y) || 1;
      const c = add(w, { x: (d.x / n) * 9, y: (d.y / n) * 9 });
      p.line([add(c, rot({ x: 0, y: 11 }, Math.atan2(d.y, d.x))), add(c, rot({ x: 0, y: -11 }, Math.atan2(d.y, d.x)))], L.clothDark, 5 * k);
    } else {
      const el = s.point('upperN', 0.55), sh = s.point('upperN', 0.35);
      p.line([sh, el], L.accent, 2.2 * k);
    }
  }
}

const circle = (c: V, r: number): V[] => Array.from({ length: 12 }, (_, i) => ({ x: c.x + Math.cos(i / 12 * Math.PI * 2) * r, y: c.y + Math.sin(i / 12 * Math.PI * 2) * r }));
