/**
 * "Otoño" — the wind frees a leaf; a girl walks up and catches it.
 * Content only: landscape, cast, and the girl's performance as beats.
 */
import {
  type Prop, type RidgeSpec, Beats, Camera, Stage, blink, caption, circlePoly, drawProps, drawRidge, envelope, fbm1,
  fillGradient, flora, lerp, noise1, ramp, ridgeHeight, rng, scatter, smoothstep, vignette,
} from '../../src';
import { Child } from '../cast/Child';
import { GIRL } from './girl';
import { Leaf } from './Leaf';

const W = 1920, H = 1080;
const RELEASE = 0.7;
const GIRL_X = 1330;

/** Breezy day: a steady push to the right, and one big upward gust that frees the leaf. */
function wind(x: number, t: number): { x: number; y: number } {
  const gust = envelope(t, 0.5, 0.9, 1.8, 2.8);
  return {
    x: 70 + fbm1(t * 0.7 + x * 0.001, 4) * 60 + gust * 160,
    y: -gust * 170 + noise1(t * 1.3 + x * 0.003, 6) * 40,
  };
}

// ── Landscape (autumn afternoon) ───────────────────────────
const GROUND: RidgeSpec = {
  seed: 5, base: 890, amp: 30, freq: 0.0011, color: '#7f8a47', tear: 2.5, shadow: 14,
  bands: [{ offset: 70, color: '#717c3f' }, { offset: 150, color: '#646e38', amp: 22 }],
  patches: { color: '#8a9650', size: [60, 150], every: 240 },
  fringe: { color: '#939f55', height: 10, spacing: 8 },
};
const FAR: RidgeSpec = { seed: 11, base: 690, amp: 70, freq: 0.0013, octaves: 4, color: '#b3aac4', tear: 3, shadow: 8 };
const MID: RidgeSpec = { seed: 12, base: 770, amp: 45, freq: 0.002, color: '#d0a46c', tear: 3, shadow: 10 };
const NEAR: RidgeSpec = { seed: 13, base: 830, amp: 35, freq: 0.0024, color: '#b8894f', tear: 3, shadow: 12 };
const groundY = (x: number) => ridgeHeight(GROUND, x);

const orange = { leaves: ['#b44a2a', '#cc6333', '#e07f3f'], light: '#f7c48a' };
const yellow = { leaves: ['#bb8a2c', '#d0a238', '#e3ba52'], light: '#fbe3a0' };
const LAYERS = {
  clouds: scatter({ seed: 51, from: -1200, to: 3200, spacing: [600, 1100], ground: x => 230 + noise1(x * 0.01, 3) * 80,
    makers: [{ make: flora.cloud({ width: [140, 260], color: '#fbf3e6', shade: '#eadbc6' }), weight: 1 }] }),
  midTrees: scatter({ seed: 52, from: -1200, to: 3600, spacing: [150, 420], ground: x => ridgeHeight(MID, x), flex: 0.5,
    makers: [
      { make: flora.tree({ height: [70, 110], canopy: [24, 36], trunk: '#6b4a3a', ...orange, lobes: [4, 5] }), weight: 2 },
      { make: flora.tree({ height: [70, 110], canopy: [24, 36], trunk: '#6b4a3a', ...yellow, lobes: [4, 5] }), weight: 2 },
      { make: flora.pine({ height: [80, 120], width: [30, 42], trunk: '#5a4a3a', leaves: ['#6f7b4a'] }), weight: 1 },
    ] }),
  nearBushes: scatter({ seed: 53, from: -1200, to: 3600, spacing: [260, 620], ground: x => ridgeHeight(NEAR, x), flex: 0.7,
    makers: [
      { make: flora.bush({ size: [22, 36], colors: ['#c2672f', '#d27c3a', '#b3582a'] }), weight: 1 },
      { make: flora.tree({ height: [120, 170], canopy: [36, 50], trunk: '#5e3f31', ...yellow, lobes: [5, 6] }), weight: 1 },
    ] }),
  ground: scatter({ seed: 54, from: -600, to: 3600, spacing: [40, 110], ground: groundY, flex: 1,
    makers: [
      { make: flora.tuft({ blades: [3, 6], height: [20, 44], width: 7, colors: ['#9aa352', '#a8ad5a', '#8b9449'] }), weight: 6 },
      { make: flora.flower({ height: [22, 38], size: [5, 7], stem: '#7f8a47', petals: ['#f3e6c4', '#e9b44c', '#d96d3b'] }), weight: 2 },
      { make: flora.rock({ size: [10, 20], colors: ['#9a8f7c', '#8a806e'] }), weight: 1 },
    ] }),
  foreground: scatter({ seed: 55, from: -600, to: 4200, spacing: [320, 700], ground: x => H - 50 + noise1(x * 0.01, 9) * 20, flex: 1.3,
    makers: [{ make: flora.tuft({ blades: [5, 8], height: [120, 190], width: 22, colors: ['#4d5a2c', '#56642f'] }), weight: 1 }] }),
};

/** The big tree the leaf falls from (a single, placed prop). */
const BIG_TREE: Prop = flora.tree({ height: [460, 460], canopy: [140, 140], trunk: '#5b3d2f', ...orange, lobes: [7, 7] })(rng(7), 420, groundY(420) + 16, 777);

type GirlBeat = 'watch' | 'walk' | 'wait' | 'reach' | 'hold';

export class AutumnScene extends Stage {
  private readonly girl: Child;
  private readonly leaf: Leaf;
  private readonly cam: Camera;
  private readonly beats: Beats<GirlBeat>;
  private released = false;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 8 });
    this.paper.light = { x: 0.7, y: 0.7 }; // high sun, upper left
    this.world.ground = groundY;
    this.world.wind = (x, _y, t) => wind(x, t);
    this.girl = new Child(this.world, GIRL_X, GIRL, 1300);
    this.girl.intent.facing = -1;
    this.leaf = new Leaf(this.world, { x: 520, y: 440 }, 0.6, ['#e07f3f', '#cc6333']);
    this.cam = new Camera(760, { width: W, height: H, stiffness: 5, damping: 4.5, handheld: 5 });
    this.beats = this.perform();
  }

  /** The girl's performance: she spots the falling leaf, walks toward it, reaches when it's low, and keeps it. */
  private perform(): Beats<GirlBeat> {
    const i = this.girl.intent;
    const leafLow = () => this.leaf.center.y > this.girl.skel.point('spine', 0.7).y - 90;
    const handOnLeaf = () => { const h = this.girl.nearHand, c = this.leaf.center; return Math.hypot(h.x - c.x, h.y - c.y) < 36; };
    return new Beats<GirlBeat>('watch', {
      watch: { during: ({ t }) => { i.lookUp = ramp(t, 1.2, 2.2) * 0.7; }, after: 2.4, then: 'walk' },
      walk: { next: ({ since }) => since > 0.6 && leafLow() && 'reach', after: 1.5, then: 'wait' },
      wait: { next: () => leafLow() && 'reach' },
      reach: { during: () => { i.reach = { x: this.leaf.center.x, y: this.leaf.center.y }; }, next: () => handOnLeaf() && 'hold', exit: () => { i.reach = null; } },
      hold: {
        enter: () => this.leaf.pinStem(this.girl.nearHand),
        during: ({ since }) => {
          i.reach = this.holdPoint(since);
          i.happy = ramp(since, 0.3, 1.0);
          i.crouch = envelope(since, 0, 0.25, 0.25, 0.7) * 0.6;
          i.lookUp = lerp(0.3, -0.5, ramp(since, 0.2, 0.9));
          this.leaf.moveStem(this.girl.nearHand);
        },
      },
    });
  }

  /** After the catch the hand comes down to chest height, in front of her. */
  private holdPoint(since: number) {
    const hand = this.girl.skel.point('spine', 0.75);
    const k = ramp(since, 0, 1.1);
    const from = this.leaf.stem;
    return { x: lerp(from.x, hand.x - 58, k), y: lerp(from.y, hand.y - 6, k) };
  }

  private get caughtAt(): number { return this.beats.startOf('hold') ?? Infinity; }

  protected start(): void { this.cam.snap(this.cameraTarget()); }

  protected update(t: number, dt: number): void {
    if (!this.released && t >= RELEASE) { this.released = true; this.leaf.release(); }
    if (!this.settling) this.beats.update(t, dt);
    const walked = t - (this.beats.startOf('walk') ?? Infinity);
    this.girl.intent.speed = 200 * envelope(walked, 0, 0.5, 1.0, 1.5);
    this.girl.intent.blink = blink(t, [1.4, 5.6]);
    this.girl.update(dt);
  }

  protected lateUpdate(t: number, dt: number): void { this.cam.update(this.cameraTarget(), dt, t); }

  private cameraTarget(): number {
    const settle = smoothstep(this.caughtAt, this.caughtAt + 1.5, this.time);
    return lerp(this.leaf.center.x * 0.65 + this.girl.x * 0.35, this.girl.x - 120, settle);
  }

  probe(): Record<string, unknown> {
    const r = Math.round, c = this.leaf.center, h = this.girl.nearHand;
    return { ...super.probe(), beat: this.beats.current, leaf: [r(c.x), r(c.y)], hand: [r(h.x), r(h.y)], handToLeaf: r(Math.hypot(h.x - c.x, h.y - c.y)), beats: this.beats.history };
  }

  protected draw(t: number): void {
    const { ctx, paper, cam } = this;
    cam.zoom = 1.12 + smoothstep(this.caughtAt, this.caughtAt + 2.5, t) * 0.16;
    const windX = (x: number) => wind(x, t).x;

    fillGradient(ctx, [[0, '#86aed3'], [0.55, '#c9d6de'], [1, '#f4dcb2']]);
    cam.layer(ctx, 0.03, () => this.drawSun({ x: 330, y: 170 }));
    cam.layer(ctx, 0.07, v => drawProps(paper, LAYERS.clouds, v.from, v.to, windX, t));
    cam.layer(ctx, 0.12, v => drawRidge(paper, FAR, v.from, v.to, H + 300));
    cam.layer(ctx, 0.3, v => { drawProps(paper, LAYERS.midTrees, v.from, v.to, windX, t); drawRidge(paper, MID, v.from, v.to, H + 300); });
    cam.layer(ctx, 0.55, v => { drawProps(paper, LAYERS.nearBushes, v.from, v.to, windX, t); drawRidge(paper, NEAR, v.from, v.to, H + 300); });
    cam.layer(ctx, 1, v => {
      BIG_TREE.draw(paper, windX(420) * 0.002 + noise1(t * 1.2, 70) * 0.06, t);
      drawRidge(paper, GROUND, v.from, v.to, H + 400);
      drawProps(paper, LAYERS.ground, v.from, v.to, windX, t, [{ x: this.girl.x, y: groundY(this.girl.x) }]);
      this.girl.draw(paper);
      this.leaf.draw(paper);
    });
    cam.layer(ctx, 1.5, v => drawProps(paper, LAYERS.foreground, v.from, v.to, windX, t));
    caption(ctx, 'Y a veces, alguien la atrapa.', { alpha: smoothstep(this.caughtAt + 0.9, this.caughtAt + 1.6, t), color: '#5a3a24', glow: 'rgba(255, 246, 228, 0.7)' });
    vignette(ctx, [60, 35, 15], 0.35, 0.5);
  }

  private drawSun(c: { x: number; y: number }): void {
    const ctx = this.ctx;
    const glow = ctx.createRadialGradient(c.x, c.y, 60, c.x, c.y, 420);
    glow.addColorStop(0, 'rgba(255, 244, 214, 0.55)'); glow.addColorStop(1, 'rgba(255, 244, 214, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - 450, c.y - 450, 900, 900);
    this.paper.piece(circlePoly(c, 70, 36), '#fff7e2', { seed: 520, tear: 2.5, shadow: 0 });
  }
}
