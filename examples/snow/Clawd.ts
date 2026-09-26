import { Leap, type Paper, Spring, type V, clamp, lerp } from '../../src';

/** What the scene asks Clawd to do this step. Reset every step, then set by the active beat. */
export interface ClawdIntent {
  /** Walking speed (px/s) toward `facing`. */
  speed: number;
  facing: 1 | -1;
  /** A world point to look at (eyes slide toward it), or null to look where it goes. */
  look: V | null;
  /** 0…1: eyes close into happy arcs, arms flap. */
  happy: number;
  /** 0…1: eyes grow tall and wide. */
  surprise: number;
  /** 0…1: squat down (before a hop, pushing hard). */
  crouch: number;
  /** 0…1: the arm on the facing side stretches forward (pushing). */
  reach: number;
  /** 0…1: a fast shake (shaking snow off). */
  shake: number;
  /** Eyelids: 1 open … 0 closed. */
  lids: number;
}

const REST: ClawdIntent = { speed: 0, facing: 1, look: null, happy: 0, surprise: 0, crouch: 0, reach: 0, shake: 0, lids: 1 };

const C = {
  body: '#d97757',
  top: '#e8906e',
  eye: '#231612',
  glint: '#fff4e6',
  blush: 'rgba(255, 150, 140, 0.55)',
};

/** Body size (px) and leg length. */
const W = 104, H = 70, LEG = 22;
const LEGS = [-40, -17, 17, 40];

/**
 * Clawd, a blocky orange critter on four stubby legs, seen from the front. Legs lift by the distance
 * walked, the body squashes on a spring, the arms lag behind accelerations and the eyes do the acting.
 */
export class Clawd {
  root: V;
  mode: 'walk' | 'air' = 'walk';
  readonly intent: ClawdIntent = { ...REST };
  /** The scene decides what is solid: the floor height under x, starting at y. */
  floor: (x: number, y: number) => number = () => 1e9;
  /** Rim and line weights shrink in close-ups (≈ zoom^-0.55). */
  lens = 1;
  rim = '#c9d6ff';

  private phase = 0;
  private t = 0;
  private vx = 0;
  private leap: Leap | null = null;
  private flight = 0;
  private landed = false;
  private readonly squash = new Spring({ x: 0, y: 0 }, 260, 12);
  private readonly arms = new Spring({ x: 0, y: 0 }, 180, 9);
  private readonly eyes = new Spring({ x: 1, y: 0 }, 110, 16);
  private readonly face = new Spring({ x: 0, y: 0 }, 60, 14);
  private readonly crouch = new Spring({ x: 0, y: 0 }, 120, 16);
  private readonly reachS = new Spring({ x: 0, y: 0 }, 90, 14);
  private prevVy = 0;

  constructor(x: number, y: number) {
    this.root = { x, y };
  }

  rest(): void { Object.assign(this.intent, REST, { facing: this.intent.facing }); }

  /** Hop along a planned arc to `to`, peaking `apex` px above the higher end. */
  hop(to: V, apex: number): void {
    this.leap = new Leap({ ...this.root }, to, apex, 2600);
    this.flight = 0;
    this.mode = 'air';
    this.squash.vel.x -= 7;
  }

  /** True once after each landing. */
  consumeLanding(): boolean { const l = this.landed; this.landed = false; return l; }

  /** A jolt: squash and arms fly (a hit, a fright). */
  jolt(amount: number): void { this.squash.vel.x += amount; this.arms.vel.y -= amount * 60; }

  /** World position of each foot and whether it is on the floor now. */
  feet(): { x: number; y: number; down: boolean }[] {
    return LEGS.map((lx, k) => {
      const lift = this.lift(k);
      return { x: this.root.x + lx * this.widthScale, y: this.root.y, down: this.mode === 'walk' && lift < 0.5 };
    });
  }

  /** Top center of the body (where snow lands). */
  get top(): V { return { x: this.root.x + this.jitter, y: this.root.y - this.bodyBottom - H * this.heightScale }; }

  /** The middle of the face. */
  get head(): V { return { x: this.root.x, y: this.top.y + H * 0.4 }; }

  get speed(): number { return this.vx; }

  update(dt: number): void {
    const i = this.intent;
    this.t += dt;
    const lookX = i.look ? clamp((i.look.x - this.root.x) / 160, -1, 1) : i.facing * clamp(Math.abs(this.vx) / 120, 0.35, 1);
    const lookY = i.look ? clamp((i.look.y - this.head.y) / 200, -1, 1) : 0;
    this.eyes.step({ x: lookX, y: lookY }, dt);
    this.face.step({ x: i.happy, y: i.surprise }, dt);
    this.crouch.step({ x: i.crouch, y: 0 }, dt);
    this.reachS.step({ x: i.reach, y: 0 }, dt);

    let vy = 0;
    if (this.leap) {
      this.flight += dt;
      const before = this.root;
      this.root = this.leap.at(this.flight);
      vy = (this.root.y - before.y) / dt;
      this.vx = (this.root.x - before.x) / dt;
      if (this.flight >= this.leap.duration) {
        this.root = { ...this.leap.to };
        this.leap = null;
        this.mode = 'walk';
        this.squash.vel.x += 9;
        this.arms.vel.y += 400;
        this.landed = true;
      }
    } else {
      const target = i.speed * i.facing;
      this.vx += (target - this.vx) * (1 - Math.exp(-7 * dt));
      const x = this.root.x + this.vx * dt;
      this.root = { x, y: this.floor(x, this.root.y - 30) };
      this.phase += Math.abs(this.vx * dt) / 13;
    }
    // Arms lag behind vertical and horizontal accelerations.
    const ay = (vy - this.prevVy) / dt;
    this.prevVy = vy;
    this.arms.vel.y += clamp(ay, -4000, 4000) * 0.02;
    this.arms.step({ x: 0, y: 0 }, dt);
    this.squash.step({ x: 0, y: 0 }, dt);
  }

  private lift(k: number): number {
    if (this.mode === 'air') return 1;
    const move = clamp(Math.abs(this.vx) / 50);
    return Math.max(0, Math.sin(this.phase + (k % 2) * Math.PI + (k > 1 ? 0.4 : 0))) * move;
  }

  private get squashAmount(): number {
    let s = this.squash.pos.x * 0.06 + this.crouch.pos.x * 0.16;
    if (this.leap) {
      const p = this.leap.progress(this.flight);
      s += p < 0.5 ? -0.14 * (1 - p * 2) : 0.08 * (p - 0.5) * 2;
    }
    return clamp(s, -0.3, 0.35);
  }
  private get widthScale(): number { return 1 + this.squashAmount * 0.55; }
  private get heightScale(): number { return 1 - this.squashAmount; }
  private get bodyBottom(): number { return LEG * (1 - this.crouch.pos.x * 0.45) - (this.mode === 'walk' ? Math.abs(Math.sin(this.phase)) * clamp(Math.abs(this.vx) / 200) * 3 : 0); }
  private get jitter(): number { return Math.sin(this.t * 55) * 4 * this.intent.shake; }

  draw(paper: Paper): void {
    const k = this.lens, i = this.intent;
    const sx = this.widthScale, sy = this.heightScale;
    const bx = this.root.x + this.jitter, by = this.root.y - this.bodyBottom;
    const w = W * sx, h = H * sy;

    paper.sheet({ shadow: 8, rim: { color: this.rim, width: 3.2 * k }, shade: { color: 'rgba(90, 30, 40, 0.32)', width: 10 * k }, anchor: this.root }, () => {
      // Legs: stubby blocks, lifted by phase, planted flat on the floor.
      LEGS.forEach((lx, n) => {
        const x = bx + lx * sx, lift = this.lift(n) * 9 + (this.mode === 'air' ? 4 : 0);
        const foot = this.root.y - lift, top = by + 4;
        const lw = 12 * sx;
        paper.piece([{ x: x - lw / 2, y: top }, { x: x + lw / 2, y: top }, { x: x + lw / 2 + 0.5, y: foot }, { x: x - lw / 2 - 0.5, y: foot }], C.body, { seed: 40 + n, tear: 0.7 });
      });
      // Arms: square nubs on both sides; the facing one stretches forward to push.
      for (const side of [-1, 1] as const) {
        const reach = side === i.facing ? this.reachS.pos.x : 0;
        const flap = this.face.pos.x * Math.sin(this.t * 14 + (side > 0 ? 0 : 1.2)) * 9;
        const ay = by - h * 0.52 + this.arms.pos.y * 0.05 - flap - reach * 6;
        const x0 = bx + side * (w / 2 - 4), x1 = bx + side * (w / 2 + 15 + reach * 16);
        const ah = 15 * sy;
        paper.piece([{ x: x0, y: ay - ah / 2 }, { x: x1, y: ay - ah / 2 + side * 0 }, { x: x1, y: ay + ah / 2 }, { x: x0, y: ay + ah / 2 }], C.body, { seed: 50 + side, tear: 0.8 });
      }
      // The body: a block with barely softened corners.
      const c = 7;
      paper.piece([
        { x: bx - w / 2, y: by - c }, { x: bx - w / 2, y: by - h + c }, { x: bx - w / 2 + c, y: by - h },
        { x: bx + w / 2 - c, y: by - h }, { x: bx + w / 2, y: by - h + c }, { x: bx + w / 2, y: by - c },
        { x: bx + w / 2 - c, y: by }, { x: bx - w / 2 + c, y: by },
      ], C.body, { seed: 30, tear: 1.1 });

      paper.inside(() => {
        // A lighter top plane and a faint crease where the legs meet the body give it volume.
        paper.piece([{ x: bx - w / 2 - 4, y: by - h - 4 }, { x: bx + w / 2 + 4, y: by - h - 4 }, { x: bx + w / 2 + 4, y: by - h + 9 * sy }, { x: bx - w / 2 - 4, y: by - h + 11 * sy }], C.top, { seed: 31, tear: 1.2 });
        paper.line([{ x: bx - w / 2 + 6, y: by + 1 }, { x: bx + w / 2 - 6, y: by + 1 }], 'rgba(80, 25, 20, 0.35)', 1.6 * k);
        this.drawFace(paper, bx, by - h, sx, sy);
      });
    });
  }

  private drawFace(paper: Paper, cx: number, top: number, sx: number, sy: number): void {
    const g = paper.context;
    const happy = clamp(this.face.pos.x), surprise = clamp(this.face.pos.y), lids = clamp(this.intent.lids);
    const ex = this.eyes.pos.x * 9, ey = this.eyes.pos.y * 6;
    const k = this.lens;
    for (const side of [-1, 1]) {
      const x = cx + side * 21 * sx + ex, y = top + 27 * sy + ey;
      const ew = 10 * (1 + surprise * 0.25), eh = 20 * (1 + surprise * 0.3) * sy;
      if (happy > 0.5) {
        // Closed, smiling eyes: an upturned arc.
        paper.line([{ x: x - ew * 0.7, y: y + 3 }, { x: x - ew * 0.3, y: y - 4 }, { x: x + ew * 0.3, y: y - 4 }, { x: x + ew * 0.7, y: y + 3 }], C.eye, 4.2);
        g.save();
        g.fillStyle = C.blush;
        g.beginPath();
        g.ellipse(x + side * 9, y + 13, 7, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
        continue;
      }
      const open = lerp(0.08, 1, lids);
      const yTop = y - eh / 2 + eh * (1 - open);
      paper.piece([{ x: x - ew / 2, y: yTop }, { x: x + ew / 2, y: yTop }, { x: x + ew / 2, y: y + eh / 2 }, { x: x - ew / 2, y: y + eh / 2 }], C.eye, { seed: 60 + side, tear: 0.5 });
      if (open > 0.4) {
        g.save();
        g.fillStyle = C.glint;
        g.fillRect(x - ew / 2 + 2, yTop + 2.5, 3.2 * Math.min(1, k * 1.4 + 0.3), 4.2 * Math.min(1, k * 1.4 + 0.3));
        g.globalAlpha = 0.6;
        g.fillRect(x + ew / 2 - 3.6, y + eh / 2 - 5, 1.8, 2.4);
        g.restore();
      }
    }
  }
}
