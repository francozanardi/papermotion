/**
 * "A veces, cae." — a kid runs with a kite at dusk; the wind drops and the kite falls.
 * Content only: landscape, cast and time-shaped intents. Behaviour comes from the engine.
 */
import {
  type RidgeSpec, Camera, Stage, blink, caption, circlePoly, clamp, drawProps, drawRidge, envelope, fbm1,
  fillGradient, flora, keys, noise1, ramp, ridgeHeight, rng, scatter, smoothstep, vignette,
} from '../../src';
import { Child } from '../cast/Child';
import { KID } from './kid';
import { Kite } from './Kite';

const W = 1920, H = 1080;

// ── Intents ────────────────────────────────────────────────
const MAX_SPEED = 640, TURN = 4.9, TURN_LEN = 0.22;
const speedAt = (t: number) => keys(t, [[0.45, 0], [1.0, MAX_SPEED], [3.4, MAX_SPEED], [4.2, 0]]);

/** Headwind that dies down as the kid slows. */
const windX = (x: number, t: number) => (-90 + fbm1(t * 0.8 + x * 0.001, 4) * 70) * (1 - smoothstep(3.2, 3.9, t) * 0.55);

// ── Landscape (dusk, rolling hills) ────────────────────────
/** Layer-space x that sits behind world x `wx` on screen when the camera is at `camX`. */
const behind = (wx: number, camX: number, depth: number) => wx - camX * (1 - depth);
const STOP_X = 2588, STOP_CAM = 2560;
const GROUND: RidgeSpec = {
  seed: 3, base: 880, amp: 38, freq: 0.0012, color: '#2c4a59', tear: 2.5, shadow: 16,
  bands: [{ offset: 70, color: '#274350' }, { offset: 150, color: '#213a47', amp: 25 }],
  patches: { color: '#335460', size: [60, 140], every: 260 },
  fringe: { color: '#3b6661', height: 11, spacing: 8 },
};
const MOUNTAINS: RidgeSpec = { seed: 1, base: 670, amp: 95, freq: 0.0011, octaves: 4, color: '#8d6c9e', tear: 3, shadow: 10 };
const FAR_HILLS: RidgeSpec = { seed: 7, base: 720, amp: 55, freq: 0.0018, color: '#6d5590', tear: 3, shadow: 12 };
const MID_HILLS: RidgeSpec = { seed: 2, base: 800, amp: 45, freq: 0.0022, color: '#463f72', tear: 3, shadow: 14 };
const groundY = (x: number) => ridgeHeight(GROUND, x);

const LAYERS = {
  clouds: scatter({ seed: 41, from: -1500, to: 3500, spacing: [700, 1300], ground: x => 430 + noise1(x * 0.01, 3) * 70,
    makers: [{ make: flora.cloud({ width: [90, 170], color: '#8a73a6', shade: '#6f5a90' }), weight: 1 }] }),
  farTrees: scatter({ seed: 42, from: -1500, to: 3500, spacing: [30, 140], ground: x => ridgeHeight(FAR_HILLS, x), flex: 0.3,
    makers: [{ make: flora.pine({ height: [34, 60], width: [18, 26], trunk: '#4e3f6e', leaves: ['#5a4a82', '#544478'] }), weight: 1 }] }),
  midTrees: scatter({ seed: 43, from: -1500, to: 4500, spacing: [60, 260], ground: x => ridgeHeight(MID_HILLS, x), flex: 0.5,
    makers: [
      { make: flora.tree({ height: [80, 130], canopy: [26, 40], trunk: '#433c6c', leaves: ['#443d74', '#4b447c', '#524a86'], light: '#86688f', lobes: [4, 5] }), weight: 2 },
      { make: flora.pine({ height: [80, 130], width: [36, 50], trunk: '#433c6c', leaves: ['#4a437b'] }), weight: 1 },
      { make: flora.bush({ size: [18, 30], colors: ['#4f4882', '#4b447c'] }), weight: 1 },
    ] }),
  nearTrees: scatter({ seed: 46, from: 300, to: 4500, spacing: [1300, 2200], ground: x => groundY(x) + 22, flex: 0.8,
    avoid: [[behind(STOP_X, STOP_CAM, 0.85) - 420, behind(STOP_X, STOP_CAM, 0.85) + 420]],
    makers: [{ make: flora.tree({ height: [300, 400], canopy: [70, 95], trunk: '#2e2638', leaves: ['#243c47', '#2b4751', '#33535c'], light: '#8a6f78', lobes: [6, 8] }), weight: 1 }] }),
  ground: scatter({ seed: 44, from: -800, to: 4500, spacing: [40, 120], ground: groundY, flex: 1,
    makers: [
      { make: flora.tuft({ blades: [3, 6], height: [22, 48], width: 7, colors: ['#46786a', '#3b675c', '#528777'] }), weight: 6 },
      { make: flora.flower({ height: [26, 44], size: [5, 8], stem: '#3b675c', petals: ['#f4a3a8', '#f7d488', '#c9b6f2', '#f5f0e6'] }), weight: 2 },
      { make: flora.rock({ size: [10, 22], colors: ['#51607a', '#475570'] }), weight: 1 },
      { make: flora.bush({ size: [22, 34], colors: ['#35604f', '#2f5646', '#3c6a58'] }), weight: 1 },
    ] }),
  foreground: scatter({ seed: 45, from: -800, to: 5500, spacing: [260, 620], ground: x => H - 50 + noise1(x * 0.01, 9) * 20, flex: 1.3,
    makers: [
      { make: flora.tuft({ blades: [5, 8], height: [120, 200], width: 22, colors: ['#15252b', '#1a2d33'] }), weight: 2 },
      { make: flora.bush({ size: [70, 110], colors: ['#15252b', '#1a2d33', '#122026'] }), weight: 1 },
    ] }),
};

export interface Focus { bone: string; zoom: number }

export class KiteScene extends Stage {
  private readonly kid: Child;
  private readonly kite: Kite;
  private readonly cam: Camera;
  private readonly stars = ((r = rng(21)) => Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * 420, r: 0.8 + r() * 1.6, a: 0.25 + r() * 0.6 })))();

  /** `focus` turns the scene into an asset lab: the camera tracks a bone, zoomed in. */
  constructor(canvas: HTMLCanvasElement, private readonly focus?: Focus) {
    super(canvas, { duration: 7.5 });
    this.paper.light = { x: -1, y: 0.25 }; // low sun on the right
    this.world.ground = groundY;
    this.world.wind = (x, _y, t) => ({ x: windX(x, t), y: noise1(t * 1.1 + x * 0.002, 6) * 25 });
    this.cam = focus
      ? new Camera(900, { width: W, height: H, stiffness: 400, damping: 40, handheld: 2 })
      : new Camera(900, { width: W, height: H, stiffness: 9, damping: 6, handheld: 6 });
    this.kid = new Child(this.world, 620, KID);
    this.kite = new Kite(this.world, this.kid.hand, { x: 250, y: groundY(250) - 50 }, -1.35, 440);
  }

  protected start(): void {
    const f = this.focusPoint();
    this.cam.snap(f?.x ?? this.cameraTarget(), f?.y);
  }

  protected update(t: number, dt: number): void {
    const i = this.kid.intent;
    i.speed = speedAt(t);
    i.crouch = envelope(t, 0.05, 0.35, 0.35, 0.6);
    i.pull = ramp(t, 0.3, 0.8) * (1 - ramp(t, 5.0, 5.8) * 0.85);
    i.lookUp = envelope(t, 1.0, 1.6, 4.4, 4.9);
    i.facing = Math.cos(clamp((t - TURN) / TURN_LEN) * Math.PI);
    i.sad = ramp(t, 5.1, 5.8);
    i.blink = blink(t, [2.1, 6.1]);
    this.kid.update(dt);
  }

  protected lateUpdate(t: number, dt: number): void {
    const f = this.focusPoint();
    this.cam.update(f?.x ?? this.cameraTarget(), dt, t, f?.y);
  }

  private focusPoint() {
    return this.focus ? this.kid.skel.point(this.focus.bone, 0.5) : undefined;
  }

  private cameraTarget(): number {
    const ahead = 170 * clamp(this.kid.intent.speed / MAX_SPEED) * Math.sign(this.kid.intent.facing || 1);
    return ((this.kid.x + this.kite.bridle.x) / 2) * 0.2 + (this.kid.x + ahead) * 0.8;
  }

  probe(): Record<string, unknown> {
    const r = Math.round, k = this.kite.bridle, h = this.kid.hand;
    return {
      ...super.probe(), kidX: r(this.kid.x),
      ropeAngleDeg: r((Math.atan2(h.y - k.y, Math.abs(k.x - h.x)) * 180) / Math.PI), handToKite: r(Math.hypot(k.x - h.x, k.y - h.y)),
    };
  }

  protected draw(t: number): void {
    const { ctx, paper, cam } = this;
    cam.zoom = this.focus?.zoom ?? 1.2 + smoothstep(4.6, 7.5, t) * 0.1;
    const wind = (x: number) => windX(x, t);

    this.drawSky(t);
    cam.layer(ctx, 0.03, () => this.drawSun({ x: 1420, y: 640 }));
    cam.layer(ctx, 0.07, v => drawProps(paper, LAYERS.clouds, v.from, v.to, wind, t));
    cam.layer(ctx, 0.1, v => drawRidge(paper, MOUNTAINS, v.from, v.to, H + 300));
    cam.layer(ctx, 0.2, v => { drawProps(paper, LAYERS.farTrees, v.from, v.to, wind, t); drawRidge(paper, FAR_HILLS, v.from, v.to, H + 300); });
    cam.layer(ctx, 0.42, v => { drawProps(paper, LAYERS.midTrees, v.from, v.to, wind, t); drawRidge(paper, MID_HILLS, v.from, v.to, H + 300); });
    cam.layer(ctx, 0.85, v => drawProps(paper, LAYERS.nearTrees, v.from, v.to, wind, t));
    cam.layer(ctx, 1, v => {
      drawRidge(paper, GROUND, v.from, v.to, H + 400);
      drawProps(paper, LAYERS.ground, v.from, v.to, wind, t, [{ x: this.kid.x, y: groundY(this.kid.x) }]);
      this.kite.drawString(paper);
      this.kite.draw(paper);
      this.kid.draw(paper);
    });
    cam.layer(ctx, 1.6, v => drawProps(paper, LAYERS.foreground, v.from, v.to, wind, t));
    caption(ctx, 'A veces, cae.', { alpha: ramp(t, 5.6, 6.3), y: 180 });
    vignette(ctx, [10, 6, 25], 0.45);
  }

  private drawSky(t: number): void {
    const ctx = this.ctx;
    fillGradient(ctx, [[0, '#171b40'], [0.45, '#3d3a73'], [0.72, '#b3607a'], [0.86, '#f09a6a'], [1, '#ffd49a']]);
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      ctx.globalAlpha = s.a * (0.7 + 0.3 * noise1(t * 1.5 + s.x, 2));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSun(c: { x: number; y: number }): void {
    const ctx = this.ctx;
    const glow = ctx.createRadialGradient(c.x, c.y, 100, c.x, c.y, 380);
    glow.addColorStop(0, 'rgba(255, 226, 168, 0.3)'); glow.addColorStop(1, 'rgba(255, 176, 122, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - 400, c.y - 400, 800, 800);
    this.paper.piece(circlePoly(c, 112, 40), '#fff1cf', { seed: 500, tear: 3, shadow: 0 });
  }
}
