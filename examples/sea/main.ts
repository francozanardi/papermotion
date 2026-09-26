/**
 * "Marea" — a moon jelly drifts up toward the light; a curious fish circles it, touches it,
 * and leaves with a passing school. Content only: seascape, cast, and the fish's performance as beats.
 */
import {
  type Collider, type Pt, type RidgeSpec, type ShaftSpec, type SwimSpec, type V, Beats, Camera, School, Stage, Swimmer,
  circlePoly, drawProps, drawRidge, drawShafts, fbm1, fillGradient, flora, lerp, noise1, ramp, ridgeHeight, rng,
  rot, scatter, smoothstep, steer, vignette,
} from '../../src';
import { BELL, type JellyLook, Jelly } from '../cast/Jelly';
import { type KelpLook, Kelp } from '../cast/Kelp';
import { type FishLook, drawFish } from '../cast/fish';

const W = 1920, H = 1080;

/** Slow current plus the back-and-forth surge of the waves overhead. */
function current(x: number, y: number, t: number): V {
  return { x: 16 + Math.sin(t * 1.3) * 24 + fbm1(t * 0.3 + x * 0.001, 4) * 14, y: noise1(t * 0.5 + x * 0.002 + y * 0.001, 6) * 8 };
}

// ── Seascape ───────────────────────────────────────────────
const SEABED: RidgeSpec = {
  seed: 21, base: 1010, amp: 26, freq: 0.0012, color: '#b3a07a', tear: 2.5, shadow: 14,
  bands: [{ offset: 60, color: '#a4916e' }, { offset: 140, color: '#917f60', amp: 20 }],
  patches: { color: '#c1af88', size: [60, 140], every: 260 },
};
const FAR: RidgeSpec = { seed: 22, base: 850, amp: 120, freq: 0.0016, octaves: 4, color: '#2a6a82', tear: 3, shadow: 6 };
const MID: RidgeSpec = { seed: 23, base: 915, amp: 70, freq: 0.002, color: '#225a73', tear: 3, shadow: 8 };
const NEAR: RidgeSpec = { seed: 24, base: 965, amp: 50, freq: 0.0026, color: '#1b4a63', tear: 3, shadow: 10 };
const groundY = (x: number) => ridgeHeight(SEABED, x);

const FAR_SHAFTS: ShaftSpec = { seed: 31, every: 260, top: -700, length: [1500, 2100], width: [60, 150], angle: 0.22, color: [210, 250, 238], alpha: 0.32 };
const NEAR_SHAFTS: ShaftSpec = { seed: 32, every: 900, top: -900, length: [1700, 2300], width: [110, 220], angle: 0.22, color: [225, 255, 244], alpha: 0.13 };

const LAYERS = {
  mid: scatter({ seed: 61, from: -1500, to: 4000, spacing: [70, 200], ground: x => ridgeHeight(MID, x), flex: 0.8,
    makers: [
      { make: flora.tuft({ blades: [3, 6], height: [60, 120], width: 8, colors: ['#2c6a7d', '#306f80'] }), weight: 3 },
      { make: flora.coral({ height: [50, 90], colors: ['#3b6a84', '#3f6788'], depth: 2 }), weight: 2 },
    ] }),
  near: scatter({ seed: 62, from: -1500, to: 4000, spacing: [110, 300], ground: x => ridgeHeight(NEAR, x), flex: 0.9,
    makers: [
      { make: flora.coral({ height: [80, 140], colors: ['#7d5f80', '#86666a'], tip: '#9a7c8e', depth: 3 }), weight: 2 },
      { make: flora.bush({ size: [20, 34], colors: ['#5e5f80', '#56607a'] }), weight: 1 },
      { make: flora.tuft({ blades: [4, 7], height: [70, 130], width: 10, colors: ['#2f6464', '#34696a'] }), weight: 2 },
    ] }),
  bed: scatter({ seed: 63, from: -800, to: 3800, spacing: [60, 170], ground: groundY, flex: 1,
    makers: [
      { make: flora.coral({ height: [70, 130], colors: ['#dd7660', '#e89a5c', '#9d6fae'], tip: '#f6c89a', light: '#ffe2c4', depth: 3 }), weight: 3 },
      { make: flora.tuft({ blades: [7, 11], height: [22, 40], width: 9, colors: ['#e0806a', '#d8665a', '#c9a0d0'] }), weight: 2 },
      { make: flora.tuft({ blades: [3, 5], height: [50, 90], width: 7, colors: ['#78985a', '#6c8d52'] }), weight: 2 },
      { make: flora.rock({ size: [14, 30], colors: ['#5d6d70', '#4e5d62'] }), weight: 2 },
    ] }),
  fore: scatter({ seed: 64, from: -800, to: 4400, spacing: [380, 760], ground: x => H + 190 + noise1(x * 0.01, 9) * 30, flex: 1.4,
    makers: [{ make: flora.tuft({ blades: [5, 8], height: [260, 420], width: 30, colors: ['#163f52', '#1a4658'] }), weight: 1 }] }),
};

// ── Cast ───────────────────────────────────────────────────
const JELLY: JellyLook = { bell: '#f2b9cc', inner: '#f9dbe5', rim: '#fff4f7', gonads: '#e58bab', tentacle: '#f7d3de', arms: '#eea3bb' };
const KELP: KelpLook = { stalk: '#6d6a2a', blades: ['#8b8634', '#9f973f', '#7a792f'], bulb: '#b6a54e', rim: '#d9d27a' };
const CURIOUS: FishLook = { length: 118, height: 58, body: '#f28a3a', belly: '#f9c47e', fin: '#df6a2c', rim: '#ffd9a6', stripes: { at: [0.3, 0.64], color: '#fdf1dc' }, detail: true };
const SILVER: FishLook = { length: 40, height: 14, body: '#7fa2b6', belly: '#d6e4e8', fin: '#5f8399', rim: '#eaf6f6', detail: false };
const HERO: SwimSpec = { maxSpeed: 300, accel: 520, drag: 4, beat: [1.2, 0.012], turn: 0.28, maxPitch: 0.6 };
const SMALL: SwimSpec = { maxSpeed: 520, accel: 700, drag: 4, beat: [3, 0.015], turn: 0.18, maxPitch: 0.5 };
const KELP_X = [420, 560, 1560, 1700, 1850, 2450];
const SCHOOL_AT = 5.1, SCHOOL_SIZE = 34;

type FishBeat = 'arrive' | 'inspect' | 'lineup' | 'approach' | 'retreat' | 'join';

export class SeaScene extends Stage {
  private readonly jelly: Jelly;
  private readonly kelp: Kelp[];
  private readonly fish: Swimmer;
  private readonly beats: Beats<FishBeat>;
  private readonly nose: Collider = { x: 0, y: 0, r: 22, soft: 1500 };
  private readonly body: Collider = { x: 0, y: 0, r: 26, soft: 600 };
  private school: School | null = null;
  private readonly schoolColliders: Collider[] = [];
  private readonly bubbles: { p: Pt; r: number }[] = [];
  private readonly cam: Camera;
  /** Which side of the jelly the fish approaches from (-1 left, 1 right), latched when lining up. */
  private side = 1;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 10, preroll: 0.8 });
    this.paper.light = { x: -0.25, y: 1 }; // sun from above, slightly right
    this.world.gravity = 400;
    this.world.ground = groundY;
    this.world.wind = current;
    this.world.colliders.push(this.nose, this.body);
    this.jelly = new Jelly(this.world, { x: 1000, y: 650 }, JELLY);
    this.kelp = KELP_X.map((x, i) => new Kelp(this.world, { x, y: groundY(x) + 12 }, 560 + ((i * 97) % 180), KELP, 1500 + i * 50));
    this.fish = new Swimmer({ x: 1640, y: 480 }, HERO, -1, 3);
    this.cam = new Camera(1200, { width: W, height: H, stiffness: 3, damping: 3.2, handheld: 7 });
    this.beats = this.perform();
  }

  /** The fish's performance: come closer, circle, line up beside the jelly, nudge it, get startled, join the school. */
  private perform(): Beats<FishBeat> {
    const f = this.fish, jelly = () => this.jelly.center;
    const staging = () => ({ x: jelly().x + this.side * (BELL * 0.9 + CURIOUS.length / 2 + 70), y: jelly().y - 14 });
    const touchSpot = () => ({ x: jelly().x + this.side * (BELL * 0.9 + CURIOUS.length / 2 - 14), y: jelly().y - 14 });
    const near = (p: V, d: number) => Math.hypot(f.pos.x - p.x, f.pos.y - p.y) < d;
    const touching = () => this.jelly.body.pts.some(p => Math.hypot(p.x - this.nose.x, p.y - this.nose.y) < this.nose.r + 3);
    return new Beats<FishBeat>('arrive', {
      arrive: { during: () => f.steer(steer.arrive(f.pos, { x: jelly().x + 250, y: jelly().y - 40 }, 280, 120)), next: () => near(jelly(), 300) && 'inspect' },
      inspect: { during: () => f.steer(steer.orbit(f.pos, jelly(), 240, 200, -1, 0.6)), after: 1.4, then: 'lineup' },
      lineup: {
        enter: () => { this.side = Math.sign(f.vel.x || f.pos.x - jelly().x); },
        during: () => f.steer(steer.arrive(f.pos, staging(), 260, 70)),
        next: () => near(staging(), 45) && f.flip === -this.side && 'approach',
      },
      approach: { during: () => f.steer(steer.arrive(f.pos, touchSpot(), 170, 12)), next: () => touching() && 'retreat', after: 1.6, then: 'retreat' },
      retreat: {
        enter: () => {
          this.jelly.startle();
          f.kick({ x: this.side * 480, y: -90 });
          this.burst({ x: this.nose.x, y: this.nose.y }, 7);
        },
        during: () => f.steer(steer.add(steer.arrive(f.pos, { x: jelly().x + this.side * 400, y: jelly().y - 60 }, 180, 160), steer.flee(f.pos, jelly(), 220, 280))),
        next: () => !!this.school && this.school.center.x > f.pos.x - 450 && 'join',
      },
      join: {
        enter: () => { f.lookAt = null; },
        during: () => {
          const s = this.school!;
          f.steer(steer.add(s.velocity, steer.arrive(f.pos, s.center, 200, 300), steer.flee(f.pos, jelly(), 260, 240)));
        },
      },
    });
  }

  protected start(): void { this.cam.snap(this.camX(), this.camY()); }

  protected update(t: number, dt: number): void {
    if (this.settling) return;
    this.fish.lookAt = t > 0.6 && this.beats.current !== 'join' ? this.jelly.center : null;
    this.beats.update(t, dt);
    const c = current(this.fish.pos.x, this.fish.pos.y, t);
    this.fish.update(dt, { x: c.x * 0.5, y: c.y * 0.5 });
    if (!this.school && t >= SCHOOL_AT) this.spawnSchool();
    this.school?.update(dt, t, (x, y) => current(x, y, t));
    this.placeColliders();
  }

  protected lateUpdate(t: number, dt: number): void { this.cam.update(this.camX(), dt, t, this.camY()); }

  private spawnSchool(): void {
    const j = this.jelly.center;
    this.school = new School({
      seed: 77, count: SCHOOL_SIZE, spawn: { x: this.cam.x - W / 2 / this.cam.zoom - 460, y: j.y - 170, w: 420, h: 300 }, heading: { x: 1, y: 0.05 },
      swim: SMALL, cruise: 0.85, radius: 110, separation: 1.4, alignment: 1, cohesion: 1.6,
      goal: () => ({ x: j.x + 4000, y: j.y + 20 }), goalWeight: 1.2,
      avoid: () => [{ ...this.jelly.center, r: BELL + 40 }, { x: this.fish.pos.x, y: this.fish.pos.y, r: 50 }], margin: 80,
      size: [0.75, 1.15],
    });
    for (let i = 0; i < SCHOOL_SIZE; i++) {
      const c = { x: 0, y: 0, r: 9, soft: 500 };
      this.schoolColliders.push(c);
      this.world.colliders.push(c);
    }
  }

  private placeColliders(): void {
    const p = this.fish.pose;
    const nose = rot({ x: p.flip * (CURIOUS.length / 2 - 18), y: -4 }, p.angle);
    this.nose.x = p.at.x + nose.x; this.nose.y = p.at.y + nose.y;
    this.body.x = p.at.x; this.body.y = p.at.y;
    this.school?.members.forEach((m, i) => { this.schoolColliders[i].x = m.swim.pos.x; this.schoolColliders[i].y = m.swim.pos.y; });
  }

  private burst(at: V, n: number): void {
    const r = rng(Math.round(at.x));
    for (let i = 0; i < n; i++) {
      const p = this.world.point(at.x + (r() - 0.5) * 16, at.y + (r() - 0.5) * 16, { mass: 0.02, drag: 0.08, gravity: -2.2 - r() });
      p.px = p.x - (r() - 0.5) * 3; p.py = p.y + r() * 2;
      this.bubbles.push({ p, r: 3 + r() * 5 });
    }
  }

  // ── Camera ───────────────────────────────────────────────
  private get touchedAt(): number { return this.beats.startOf('retreat') ?? Infinity; }

  private camX(): number {
    const j = this.jelly.center.x, f = this.fish.pos.x;
    const leave = smoothstep(this.touchedAt + 0.4, this.touchedAt + 1.8, this.time);
    return lerp(lerp(j, f, 0.38), j + 60, leave);
  }

  private camY(): number { return this.jelly.center.y + lerp(150, 30, ramp(this.time, 1.5, 6)); }

  probe(): Record<string, unknown> {
    const r = Math.round, j = this.jelly.center, f = this.fish, pts = this.jelly.body.pts;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return {
      ...super.probe(), beat: this.beats.current, jelly: [r(j.x), r(j.y)], bell: [r(Math.max(...xs) - Math.min(...xs)), r(Math.max(...ys) - Math.min(...ys))],
      fish: [r(f.pos.x), r(f.pos.y)], fishV: [r(f.vel.x), r(f.vel.y)], flip: +f.flip.toFixed(2),
      kelp: this.kelp.map(k => k.stalk.map(q => [r(q.x), r(q.y)])), school: this.school ? [r(this.school.center.x), r(this.school.center.y)] : null, beats: this.beats.history.map(b => `${b.beat}@${b.at.toFixed(2)}`),
    };
  }

  // ── Drawing ──────────────────────────────────────────────
  protected draw(t: number): void {
    const { ctx, paper, cam } = this;
    const touch = this.touchedAt;
    cam.zoom = 1.5 + 0.22 * smoothstep(touch - 1.4, touch - 0.1, t) - 0.42 * smoothstep(touch + 0.6, touch + 2.4, t);
    const flowX = (x: number) => current(x, 600, t).x;
    const flow = (x: number, y: number) => current(x, y, t);

    fillGradient(ctx, [[0, '#8fd0cc'], [0.4, '#3f93a6'], [0.8, '#1f5f7c'], [1, '#16475f']]);
    cam.layer(ctx, 0.08, v => drawShafts(paper, FAR_SHAFTS, v.from, v.to, t));
    cam.layer(ctx, 0.15, v => drawRidge(paper, FAR, v.from, v.to, H + 800));
    cam.layer(ctx, 0.3, v => { drawProps(paper, LAYERS.mid, v.from, v.to, flowX, t); drawRidge(paper, MID, v.from, v.to, H + 800); });
    cam.layer(ctx, 0.55, v => { drawProps(paper, LAYERS.near, v.from, v.to, flowX, t); drawRidge(paper, NEAR, v.from, v.to, H + 800); });
    cam.layer(ctx, 1, v => {
      drawRidge(paper, SEABED, v.from, v.to, H + 900);
      drawProps(paper, LAYERS.bed, v.from, v.to, flowX, t, [this.fish.pos]);
      this.kelp.forEach((k, i) => i !== 4 && k.draw(paper, t, flow));
      this.drawSchool(t, m => m.size < 0.95);
      this.jelly.draw(paper);
      drawFish(paper, this.fish.pose, CURIOUS, 1800, 1, this.fish.lookAt, t);
      this.drawSchool(t, m => m.size >= 0.95);
      this.kelp[4].draw(paper, t, flow);
      this.drawBubbles();
    });
    cam.layer(ctx, 1.12, v => drawShafts(paper, NEAR_SHAFTS, v.from, v.to, t));
    cam.layer(ctx, 1.5, v => drawProps(paper, LAYERS.fore, v.from, v.to, flowX, t));
    vignette(ctx, [6, 26, 40], 0.5);
  }

  private drawSchool(t: number, which: (m: School['members'][number]) => boolean): void {
    this.school?.members.forEach(m => which(m) && drawFish(this.paper, m.swim.pose, SILVER, 3000 + m.seed, m.size, null, t));
  }

  private drawBubbles(): void {
    this.bubbles.forEach((b, i) => {
      const { x, y } = b.p;
      this.paper.piece(circlePoly({ x, y }, b.r, 12), 'rgba(222, 248, 250, 0.35)', { seed: 2600 + i, tear: 0.4, shadow: 0, texture: 0 });
      this.paper.piece(circlePoly({ x: x - b.r * 0.35, y: y - b.r * 0.35 }, b.r * 0.28, 8), 'rgba(255, 255, 255, 0.85)', { seed: 2650 + i, tear: 0.1, shadow: 0, edge: false, texture: 0 });
    });
  }
}
