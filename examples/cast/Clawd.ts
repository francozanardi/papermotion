import { type Paper, type SwimSpec, type V, Leap, Spring, Swimmer, add, clamp, keys, lerp, rot } from '../../src';

export interface ClawdLook {
  body: string;
  /** Lighter top plane and darker underside: the two extra tones of a pixel sprite. */
  top: string;
  under: string;
  legs: string;
  eye: string;
  rim: string;
  shade: string;
}

export interface ClawdIntent {
  speed: number;
  facing: number;
  look: V | null;
  /** 0 arms at the sides … 1 thrown up (joy, surprise, a catch). */
  arms: number;
  /** 0…1 waving the near arm. */
  wave: number;
  /** Eyes: 0 open, 1 happy (^ ^). */
  happy: number;
  /** Eyes a little taller: surprise. */
  surprise: number;
  blink: number;
  /** 0…1 squat before a jump. */
  crouch: number;
}

export const CLAWD_REST: Readonly<ClawdIntent> = { speed: 0, facing: 1, look: null, arms: 0, wave: 0, happy: 0, surprise: 0, blink: 1, crouch: 0 };

export const BODY_W = 112, BODY_H = 72, LEG = 22;
const LEG_W = 15, LEGS = [-40, -14, 14, 40], NOTCH = 7;
const SWIM: SwimSpec = { maxSpeed: 320, accel: 520, drag: 3, beat: [1.6, 0.01], turn: 0.3, maxPitch: 0.45 };

/** The body outline: a rectangle with stepped corners, the nod to a pixel sprite. */
function outline(w: number, h: number): V[] {
  const x = w / 2, y = h / 2, s = NOTCH;
  return [
    { x: -x + s, y: -y }, { x: x - s, y: -y }, { x: x - s, y: -y + s }, { x, y: -y + s }, { x, y: y - s }, { x: x - s, y: y - s },
    { x: x - s, y }, { x: -x + s, y }, { x: -x + s, y: y - s }, { x: -x, y: y - s }, { x: -x, y: -y + s }, { x: -x + s, y: -y + s },
  ];
}

/**
 * Clawd, the orange Claude Code critter: a blocky body on four stubby legs, two little arms, two tall
 * eyes. It walks on any floor the scene gives it, hops along planned arcs with squash and stretch,
 * and swims (steered like a fish, paddling its legs). Front-on like the sprite: turning just slides
 * the eyes toward where it is going.
 */
export class Clawd {
  root: V;
  intent: ClawdIntent = { ...CLAWD_REST };
  mode: 'walk' | 'air' | 'swim' = 'walk';
  /** The floor under a point (the scene decides: ground, roofs, letters, a sagging wire). */
  floor: (x: number, y: number) => number = () => 1e9;
  /** True on the step it touches down. */
  landed = false;
  readonly swimmer: Swimmer;
  private leap: Leap | null = null;
  private flight = 0;
  private phase = 0;
  private walk = 0;
  private clock = 0;
  private readonly squash = new Spring({ x: 0, y: 0 }, 220, 13);
  private readonly arms = [new Spring({ x: 0, y: 0 }, 160, 11), new Spring({ x: 0, y: 0 }, 160, 11)];
  private readonly eyes = new Spring({ x: 1, y: 0 }, 120, 18);
  private tilt = 0;
  private prevVel = 0;

  constructor(at: V, private readonly look: ClawdLook) {
    this.root = { ...at };
    this.swimmer = new Swimmer(this.center, SWIM, 1, 3);
  }

  get airborne(): boolean { return this.mode === 'air'; }

  /**
   * Whether it touched down since the last call, clearing the flag. Use this in beats: several beats
   * can chain within one step, and a plain flag would let one landing trigger them all.
   */
  consumeLanding(): boolean {
    const l = this.landed;
    this.landed = false;
    return l;
  }
  /** Middle of the body. */
  get center(): V { return { x: this.root.x, y: this.root.y - LEG - BODY_H / 2 }; }
  /** Current velocity (px/s). */
  get velocity(): V {
    if (this.leap) return this.leap.velocityAt(this.flight);
    if (this.mode === 'swim') return this.swimmer.vel;
    return { x: this.intent.speed * Math.sign(this.intent.facing || 1), y: 0 };
  }

  /** Put it somewhere else (between scenes). */
  place(at: V, mode: 'walk' | 'air' | 'swim' = 'walk'): void {
    this.root = { ...at };
    this.leap = null;
    this.mode = mode;
    if (mode === 'swim') { this.swimmer.pos.x = at.x; this.swimmer.pos.y = at.y - LEG - BODY_H / 2; this.swimmer.vel.x = this.swimmer.vel.y = 0; }
  }

  /** Hop to a floor point, peaking `apex` px above the higher end. */
  jump(to: V, apex: number, gravity = 2600): void {
    this.leap = new Leap({ ...this.root }, to, apex, gravity);
    this.flight = 0;
    this.mode = 'air';
    this.squash.vel.x -= 6;
  }

  /** Splash in: from here on it swims. */
  dive(): void {
    const v = this.velocity;
    this.place(this.root, 'swim');
    this.swimmer.vel.x = v.x * 0.5; this.swimmer.vel.y = Math.max(120, v.y * 0.4);
  }

  update(dt: number): void {
    this.clock += dt;
    this.landed = false;
    const i = this.intent;
    this.eyes.step({ x: Math.sign(i.facing || 1), y: 0 }, dt);
    if (this.mode === 'air') this.fly(dt);
    else if (this.mode === 'swim') this.paddle(dt);
    else this.stroll(dt);
    this.squash.step({ x: i.crouch * 0.25, y: 0 }, dt);
    const up = this.mode === 'air' ? 0.9 : i.arms;
    const swing = this.mode === 'swim' ? Math.sin(this.clock * 9) * 0.5 : Math.sin(this.phase) * 0.25 * this.walk;
    const accel = (this.velocity.x - this.prevVel) / dt;
    this.prevVel = this.velocity.x;
    this.arms.forEach((a, k) => {
      const wave = k === 0 ? i.wave * (0.9 + Math.sin(this.clock * 13) * 0.6) : 0;
      a.step({ x: up * 1.3 + wave + (k ? -swing : swing) + clamp(-accel * 0.0004, -0.4, 0.4), y: 0 }, dt);
    });
  }

  private stroll(dt: number): void {
    const i = this.intent, dir = Math.sign(i.facing || 1);
    const x = this.root.x + i.speed * dir * dt;
    const floor = this.floor(x, this.root.y - 30);
    if (floor > this.root.y + 40) {
      // Walked off an edge: fall.
      this.leap = new Leap({ ...this.root }, { x: x + i.speed * dir * 0.3, y: floor }, 1, 2600);
      this.flight = 0;
      this.mode = 'air';
      return;
    }
    this.root = { x, y: floor };
    this.phase += (i.speed * dt) / 26;
    this.walk += (clamp(i.speed / 110) - this.walk) * (1 - Math.exp(-8 * dt));
    this.tilt += (dir * this.walk * 0.05 - this.tilt) * (1 - Math.exp(-6 * dt));
  }

  private fly(dt: number): void {
    const leap = this.leap!;
    this.flight += dt;
    this.root = leap.at(this.flight);
    const v = leap.velocityAt(this.flight);
    this.tilt = clamp(v.x * 0.0004, -0.25, 0.25);
    if (this.flight >= leap.duration) {
      this.leap = null;
      this.mode = 'walk';
      this.root = { x: leap.to.x, y: this.floor(leap.to.x, leap.to.y - 30) };
      this.squash.vel.x += 7;
      this.landed = true;
    }
  }

  private paddle(dt: number): void {
    const s = this.swimmer;
    s.lookAt = this.intent.look;
    s.update(dt);
    this.root = { x: s.pos.x, y: s.pos.y + LEG + BODY_H / 2 };
    this.phase += dt * 10;
    this.walk = 1;
    this.tilt = s.pose.angle * 0.8;
  }

  // ── Drawing ─────────────────────────────────────────────

  /**
   * One sheet: legs, arms and body are cut from the same paper. Inside: the lighter top plane, the
   * darker underside and the eyes, so the sprite's flat orange gets two more tones and a rim of light.
   */
  draw(paper: Paper): void {
    const L = this.look, i = this.intent;
    const sq = this.mode === 'air' ? keys(this.leap?.progress(this.flight) ?? 1, [[0, -0.22], [0.5, -0.05], [1, -0.14]]) + this.squash.pos.x : this.squash.pos.x;
    const w = BODY_W * (1 + sq * 0.55), h = BODY_H * (1 - sq);
    const bob = this.mode === 'walk' ? Math.abs(Math.sin(this.phase)) * 3 * this.walk : Math.sin(this.clock * 2.4) * 1.5;
    const c = { x: this.root.x, y: this.root.y - LEG * (1 - sq * 0.5) - h / 2 - bob };
    const F = (p: V) => add(c, rot(p, this.tilt));

    paper.sheet({ shadow: 8, rim: { color: L.rim, width: 3 }, shade: { color: L.shade, width: 8 }, anchor: this.root }, () => {
      LEGS.forEach((lx, k) => {
        const lift = this.mode === 'walk' ? Math.max(0, Math.sin(this.phase + (k % 2 ? Math.PI : 0))) * 9 * this.walk
          : this.mode === 'swim' ? (Math.sin(this.phase + k * 1.6) + 1) * 5 : 0;
        const dangle = this.mode === 'air' ? 5 : 0;
        const x = lx * (w / BODY_W), top = h / 2 - 4, len = LEG * (1 - sq * 0.5) + dangle - lift;
        paper.piece([{ x: x - LEG_W / 2, y: top }, { x: x + LEG_W / 2, y: top }, { x: x + LEG_W / 2, y: top + len }, { x: x - LEG_W / 2, y: top + len }].map(F), L.legs, { seed: 30 + k, tear: 0.8 });
      });
      this.arms.forEach((a, k) => {
        const side = k === 0 ? Math.sign(i.facing || 1) : -Math.sign(i.facing || 1);
        const base = { x: side * (w / 2 - 3), y: -h * 0.02 };
        const arm = [{ x: 0, y: -8 }, { x: 20, y: -8 }, { x: 20, y: 8 }, { x: 0, y: 8 }].map(p => {
          const q = rot({ x: p.x * side, y: p.y }, -a.pos.x * side);
          return F(add(base, q));
        });
        paper.piece(arm, L.body, { seed: 40 + k, tear: 0.7 });
      });
      paper.piece(outline(w, h).map(F), L.body, { seed: 20, tear: 1.2 });
      paper.inside(() => {
        paper.piece([{ x: -w / 2, y: -h / 2 - 4 }, { x: w / 2, y: -h / 2 - 4 }, { x: w / 2, y: -h * 0.3 }, { x: -w / 2, y: -h * 0.3 }].map(F), L.top, { seed: 21, tear: 0.8 });
        paper.piece([{ x: -w / 2 - 30, y: h * 0.32 }, { x: w / 2 + 30, y: h * 0.32 }, { x: w / 2 + 30, y: h / 2 + LEG + 10 }, { x: -w / 2 - 30, y: h / 2 + LEG + 10 }].map(F), L.under, { seed: 22, tear: 0.8 });
        this.drawEyes(paper, F, w, h);
      });
    });
  }

  /** Two tall eyes that slide toward where it goes or looks; blink, widen, or close into happy arcs. */
  private drawEyes(paper: Paper, F: (p: V) => V, w: number, h: number): void {
    const L = this.look, i = this.intent;
    let lx = this.eyes.pos.x * 10, ly = 0;
    if (i.look) {
      const c = F({ x: 0, y: 0 }), d = Math.hypot(i.look.x - c.x, i.look.y - c.y) || 1;
      lx = lerp(lx, ((i.look.x - c.x) / d) * 14, 0.7); ly = ((i.look.y - c.y) / d) * 7;
    }
    const eh = 20 * (1 + i.surprise * 0.3) * Math.max(0.1, i.blink) * (1 - i.happy), ew = 10;
    for (const ex of [-19, 19]) {
      const x = ex * (w / BODY_W) + lx, y = -h * 0.12 + ly;
      if (i.happy > 0.5) {
        paper.line([{ x: x - 7, y: y + 4 }, { x, y: y - 5 }, { x: x + 7, y: y + 4 }].map(F), L.eye, 4.5);
        continue;
      }
      paper.piece([{ x: x - ew / 2, y: y - eh / 2 }, { x: x + ew / 2, y: y - eh / 2 }, { x: x + ew / 2, y: y + eh / 2 }, { x: x - ew / 2, y: y + eh / 2 }].map(F), L.eye, { seed: 50 + ex, tear: 0.3 });
      if (eh > 8) paper.piece([{ x: x - 3, y: y - eh / 2 + 3 }, { x: x, y: y - eh / 2 + 3 }, { x: x, y: y - eh / 2 + 7 }, { x: x - 3, y: y - eh / 2 + 7 }].map(F), '#fff7ef', { seed: 60 + ex, tear: 0 });
    }
  }
}
