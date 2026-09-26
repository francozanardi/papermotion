import {
  type Collider, type RidgeSpec, type ShaftSpec, type SwimSpec, type V, Beats, Camera, Particles, School, circlePoly, drawProps, drawRidge,
  drawShafts, fbm1, fillGradient, flora, noise1, ridgeHeight, scatter, steer,
} from '../../src';
import { BODY_H, CLAWD_REST, LEG } from '../cast/Clawd';
import { BELL, type JellyLook, Jelly } from '../cast/Jelly';
import { type KelpLook, Kelp } from '../cast/Kelp';
import { type FishLook, drawFish } from '../cast/fish';
import type { Act, Ctx } from './act';

const W = 1920, H = 1080;

type Beat = 'sink' | 'swim' | 'drop' | 'squish' | 'bounce' | 'rise' | 'gone';

const JELLY: JellyLook = { bell: '#f2b9cc', inner: '#f9dbe5', rim: '#fff4f7', gonads: '#e58bab', tentacle: '#f7d3de', arms: '#eea3bb' };
const KELP: KelpLook = { stalk: '#6d6a2a', blades: ['#8b8634', '#9f973f', '#7a792f'], bulb: '#b6a54e', rim: '#d9d27a' };
const SILVER: FishLook = { length: 44, height: 16, body: '#8fb2c4', belly: '#dfeaee', fin: '#6d91a6', rim: '#f2fafa', detail: false };
const SMALL: SwimSpec = { maxSpeed: 480, accel: 900, drag: 4, beat: [3, 0.015], turn: 0.16, maxPitch: 0.5 };

/**
 * Under the pond, which is bigger than it looked: shafts of light, kelp that parts around Clawd,
 * a school of fish that swerves, and a jellyfish to bounce on, back up to the surface.
 */
export class SeaAct implements Act {
  readonly cam: Camera;
  readonly light = { x: -0.25, y: 1 };
  private jelly: Jelly | null = null;
  private readonly kelp: Kelp[];
  private school: School | null = null;
  private readonly bubbles = new Particles({ seed: 21, gravity: -380, drag: 1.4, flow: (x, y) => this.current(x, y) });
  private readonly me: Collider = { x: 0, y: -9999, r: 80, soft: 1200 };
  private beats: Beats<Beat>;
  private t = 0;
  private readonly bed: RidgeSpec;
  private readonly far: RidgeSpec;
  private readonly mid: RidgeSpec;
  private readonly shafts: ShaftSpec = { seed: 31, every: 260, top: -900, length: [2900, 3400], width: [60, 150], angle: 0.22, color: [210, 250, 238], alpha: 0.3 };
  private readonly layers;

  constructor(private readonly c: Ctx, private readonly X: number) {
    this.bed = { seed: 51, base: 1010, amp: 26, freq: 0.0012, color: '#b3a07a', tear: 2.5, shadow: 14, bands: [{ offset: 60, color: '#a4916e' }], patches: { color: '#c1af88', size: [60, 140], every: 260 } };
    this.far = { seed: 52, base: 850, amp: 120, freq: 0.0016, octaves: 4, color: '#2a6a82', tear: 3, shadow: 6 };
    this.mid = { seed: 53, base: 930, amp: 70, freq: 0.002, color: '#225a73', tear: 3, shadow: 8 };
    const at = (d: number) => W / 2 + (X - W / 2) * d;
    this.layers = {
      mid: scatter({ seed: 54, from: at(0.35) - 2500, to: at(0.35) + 3000, spacing: [80, 220], ground: x => ridgeHeight(this.mid, x), flex: 0.8,
        makers: [{ make: flora.coral({ height: [50, 90], colors: ['#3b6a84', '#3f6788'], depth: 2 }), weight: 1 }] }),
      bed: scatter({ seed: 55, from: X - 1500, to: X + 3500, spacing: [60, 170], ground: x => ridgeHeight(this.bed, x), flex: 1,
        makers: [
          { make: flora.coral({ height: [70, 130], colors: ['#dd7660', '#e89a5c', '#9d6fae'], tip: '#f6c89a', light: '#ffe2c4', depth: 3 }), weight: 3 },
          { make: flora.tuft({ blades: [7, 11], height: [22, 40], width: 9, colors: ['#e0806a', '#d8665a', '#c9a0d0'] }), weight: 2 },
          { make: flora.rock({ size: [14, 30], colors: ['#5d6d70', '#4e5d62'] }), weight: 2 },
        ] }),
    };
    this.cam = new Camera(X, { width: W, height: H, stiffness: 3.5, damping: 3.6, handheld: 6 });
    c.world.colliders.push(this.me);
    this.kelp = [260, 420, 760, 1700, 1860, 2300].map((dx, i) => new Kelp(c.world, { x: X + dx, y: ridgeHeight(this.bed, X + dx) + 12 }, 520 + ((i * 97) % 200), KELP, 3500 + i * 50));
    this.beats = this.perform();
  }

  /** The school arrives with Clawd, from the right, and has to swerve around it. */
  private spawnSchool(): School {
    const X = this.X;
    return new School({
      seed: 57, count: 30, spawn: { x: X + 1500, y: 360, w: 500, h: 200 }, heading: { x: -1, y: 0 }, swim: SMALL, cruise: 0.7,
      radius: 110, separation: 1.4, alignment: 1, cohesion: 1.6, goal: () => ({ x: X - 3000, y: 420 }), goalWeight: 1,
      avoid: () => [{ x: this.c.clawd.center.x, y: this.c.clawd.center.y, r: 110 }, { ...this.jelly!.center, r: BELL + 40 }], margin: 90, size: [0.75, 1.2],
    });
  }

  get done(): boolean { return this.beats.current === 'gone'; }

  /** Slow current plus the surge of the waves overhead (only in this act's stretch of the world). */
  current(x: number, y: number): V {
    const t = this.t;
    return { x: 16 + Math.sin(t * 1.3) * 22 + fbm1(t * 0.3 + x * 0.001, 4) * 12, y: noise1(t * 0.5 + x * 0.002 + y * 0.001, 6) * 8 };
  }

  begin(): void {
    this.c.clawd.place({ x: this.X + 620, y: -40 + BODY_H }, 'swim');
    this.c.clawd.swimmer.vel.y = 260;
    this.beats = this.perform();
    this.jelly = new Jelly(this.c.world, { x: this.X + 1150, y: 600 }, JELLY);
    this.school = this.spawnSchool();
    this.cam.cut({ x: this.X + 740, y: 420, zoom: 1.55, handheld: 6 });
  }

  /** The top of the bell right now: where Clawd's feet touch it. */
  private bellTop(): V {
    const j = this.jelly!;
    return { x: j.center.x, y: Math.min(...j.body.pts.map(p => p.y)) };
  }

  private perform(): Beats<Beat> {
    const clawd = this.c.clawd, s = clawd.swimmer;
    const jelly = () => this.jelly!;
    const feet = LEG + BODY_H / 2; // swimmer centre → feet
    const hover = () => { const b = this.bellTop(); return { x: b.x - 10, y: b.y - feet - 110 }; };
    const press = (k: number) => { const j = jelly(); for (const p of j.body.pts) if (p.y < j.center.y) p.ay += k; };
    return new Beats<Beat>('sink', {
      sink: { enter: () => this.c.cue('underwater', clawd.center), during: () => s.steer({ x: 90, y: 160 }), after: 0.9, then: 'swim' },
      swim: {
        during: () => { s.steer(steer.arrive(s.pos, hover(), 300, 120)); clawd.intent.look = jelly().center; },
        next: () => Math.hypot(s.pos.x - hover().x, s.pos.y - hover().y) < 50 && 'drop', after: 3.6, then: 'drop',
      },
      // Tuck the legs and drop onto the bell.
      drop: {
        during: () => { s.steer({ x: (this.bellTop().x - s.pos.x) * 3, y: 340 }); Object.assign(clawd.intent, { look: jelly().center, arms: 0.3, surprise: 0.4 }); },
        next: () => clawd.root.y >= this.bellTop().y - 4 && 'squish', after: 1.4, then: 'squish',
      },
      // Feet on the bell: both give under the weight for a moment.
      squish: {
        enter: () => { jelly().startle(); this.c.cue('jelly', jelly().center); },
        during: () => { s.steer({ x: 0, y: 40 }); press(5000); Object.assign(clawd.intent, { crouch: 1, look: jelly().center }); },
        after: 0.14, then: 'bounce',
      },
      bounce: {
        enter: () => {
          s.kick({ x: 140, y: -620 });
          this.c.cue('boing', clawd.root);
          press(-12000);
          this.puff({ x: clawd.root.x, y: clawd.root.y }, 14);
        },
        during: ({ since }) => { s.steer({ x: 120, y: -260 }); Object.assign(clawd.intent, { happy: since > 0.15 ? 1 : 0, arms: 1 }); },
        after: 0.9, then: 'rise',
        exit: () => this.c.cue('yay', clawd.center),
      },
      rise: { during: () => { s.steer({ x: 110, y: -300 }); Object.assign(clawd.intent, { happy: 1, arms: 0.8 }); }, next: () => s.pos.y < 300 && 'gone' },
      gone: {},
    });
  }

  private puff(at: V, n: number): void {
    this.bubbles.emit(at, n, { angle: -Math.PI / 2, spread: 2, speed: [40, 160], life: [1.5, 3], size: [3, 9] });
  }

  update(t: number, dt: number, active: boolean): void {
    this.t = t;
    this.school?.update(dt, t, (x, y) => this.current(x, y));
    this.bubbles.update(dt);
    if (!active) { this.me.y = -9999; return; }
    const clawd = this.c.clawd;
    Object.assign(clawd.intent, CLAWD_REST, { facing: Math.sign(clawd.swimmer.vel.x) || 1 });
    this.beats.update(t, dt);
    const c = clawd.center;
    this.me.x = c.x; this.me.y = c.y;
    if (Math.floor(t * 30) % 5 === 0 && Math.floor((t - dt) * 30) % 5 !== 0) {
      this.puff({ x: c.x + 30, y: c.y - 30 }, 1);
      this.c.cue('bubble', c, { gain: 0.5 });
    }
  }

  lateUpdate(t: number, dt: number): void {
    const c = this.c.clawd.center;
    this.cam.frame({ x: c.x + 120, y: Math.min(700, Math.max(380, c.y + 60)), zoom: 1.55, handheld: 6 }, dt, t);
  }

  draw(t: number, withClawd: boolean): void {
    const { paper, ctx } = this.c, cam = this.cam, clawd = this.c.clawd;
    const flowX = (x: number) => this.current(x, 600).x;
    fillGradient(ctx, [[0, '#8fd0cc'], [0.4, '#3f93a6'], [0.8, '#1f5f7c'], [1, '#16475f']]);
    cam.layer(paper, 0.08, v => drawShafts(paper, this.shafts, v.from, v.to, t));
    cam.layer(paper, 0.15, v => drawRidge(paper, this.far, v.from, v.to, H + 800));
    cam.layer(paper, 0.35, v => { drawProps(paper, this.layers.mid, v.from, v.to, flowX, t); drawRidge(paper, this.mid, v.from, v.to, H + 800); });
    cam.layer(paper, 1, v => {
      drawRidge(paper, this.bed, v.from, v.to, H + 900);
      drawProps(paper, this.layers.bed, v.from, v.to, flowX, t, withClawd ? [clawd.root] : []);
      this.kelp.forEach((k, i) => i !== 1 && k.draw(paper, t, (x, y) => this.current(x, y)));
      this.school?.members.forEach(m => m.size < 0.95 && drawFish(paper, m.swim.pose, SILVER, 3000 + m.seed, m.size, null, t));
      this.jelly?.draw(paper);
      if (withClawd) clawd.draw(paper);
      this.school?.members.forEach(m => m.size >= 0.95 && drawFish(paper, m.swim.pose, SILVER, 3000 + m.seed, m.size, null, t));
      this.kelp[1].draw(paper, t, (x, y) => this.current(x, y));
      this.bubbles.draw((p, u) => {
        paper.piece(circlePoly(p, p.size * (1 + u * 0.3), 10), 'rgba(222, 248, 250, 0.35)', { seed: 2600 + Math.floor(p.seed * 99), tear: 0.3, shadow: 0, texture: 0 });
        paper.piece(circlePoly({ x: p.x - p.size * 0.35, y: p.y - p.size * 0.35 }, p.size * 0.28, 6), 'rgba(255, 255, 255, 0.85)', { seed: 2700 + Math.floor(p.seed * 99), tear: 0, shadow: 0, edge: false, texture: 0 });
      });
    });
    cam.layer(paper, 1.12, v => drawShafts(paper, { ...this.shafts, seed: 32, every: 900, alpha: 0.12 }, v.from, v.to, t));
  }

  probe(): Record<string, unknown> {
    const c = this.c.clawd.center;
    const j = this.jelly?.center;
    return { sea: this.beats.current, clawd: [Math.round(c.x - this.X), Math.round(c.y)], jelly: j ? [Math.round(j.x - this.X), Math.round(j.y)] : null, beats: this.beats.history.map(b => `${b.beat}@${b.at.toFixed(2)}`) };
  }
}
