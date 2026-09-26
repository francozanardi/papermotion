/**
 * "Tejados" — a cat walks a moonlit ridge, sizes up the gap, wiggles, leaps to the next roof,
 * startles a pigeon and sits to watch the moon. Content only: city, cast and the cat's beats.
 */
import {
  type V, Beats, Camera, Stage, blink, building, caption, circlePoly, drawProps, envelope, fillGradient, flora, lerp, noise1,
  ramp, rng, scatter, vignette,
} from '../../src';
import { CAT_REST, type CatLook, Cat } from './Cat';
import { type PigeonLook, Pigeon } from './Pigeon';
import { type HousePalette, type HouseSpec, chimneyTop, drawHouse, roofSurface } from '../sets/houses';

const W = 1920, H = 1080;

// ── City ───────────────────────────────────────────────────
const TILES: HousePalette = {
  wall: '#3b4068', wallShade: '#2f345a', roof: '#5b4260', tiles: ['#654a69', '#523a56', '#5e4463'], ridge: '#3f2c44',
  window: '#f2c46a', windowDark: '#262b4a', frame: '#2a2d4c', rim: '#a9b3f0',
};
const HOUSE_A: HouseSpec = { x: 180, width: 1060, eave: 650, ridge: 560, hip: 120, palette: TILES, windows: { cols: 5, lit: [1, 3, 7] }, seed: 100 };
const HOUSE_B: HouseSpec = {
  x: 1420, width: 1100, eave: 560, ridge: 470, hip: 90, palette: { ...TILES, wall: '#45466f', wallShade: '#37395f', roof: '#684559', tiles: ['#72505f', '#5c3f4f', '#6b4859'] },
  windows: { cols: 5, lit: [0, 4, 6] }, chimney: { at: 330, width: 64, height: 100 }, seed: 200,
};
const STOP_X = 990;
const LANDING: V = { x: 1560, y: HOUSE_B.ridge };

const LAYERS = {
  clouds: scatter({ seed: 71, from: -1500, to: 4000, spacing: [500, 900], ground: x => 200 + noise1(x * 0.01, 4) * 90, avoid: [[850, 1700]],
    makers: [{ make: flora.cloud({ width: [180, 320], color: '#44508a', shade: '#38437c' }), weight: 1 }] }),
  far: scatter({ seed: 72, from: -1500, to: 4500, spacing: [60, 150], ground: () => 790, flex: 0,
    makers: [{ make: building({ width: [60, 140], height: [90, 240], colors: ['#27315d', '#2a3462'], window: '#b8964f', lit: 0.06 }), weight: 1 }] }),
  mid: scatter({ seed: 73, from: -1500, to: 4500, spacing: [90, 200], ground: () => 860, flex: 0,
    makers: [{ make: building({ width: [90, 180], height: [120, 280], colors: ['#1f2850', '#232c56'], window: '#d9ab58', lit: 0.1 }), weight: 1 }] }),
  near: scatter({ seed: 74, from: -1500, to: 4500, spacing: [140, 260], ground: () => 980, flex: 0,
    makers: [{ make: building({ width: [140, 240], height: [160, 320], colors: ['#181f40', '#1b2245'], window: '#e8b75e', lit: 0.12 }), weight: 1 }] }),
};

// ── Cast ───────────────────────────────────────────────────
const TOM: CatLook = {
  fur: '#2a2633', furNear: '#342f3f', furBack: '#1c1924', light: '#dddaf0', lightShade: '#b3b0cc', lightBack: '#8d8aa8', rim: '#b5bfff',
  eye: '#d9e866', eyeDeep: '#8ea23a', ink: '#141220', nose: '#d88c9c', noseDeep: '#8e4f5e', innerEar: '#9a6a82', innerEarDeep: '#6e4459',
};
const DOVE: PigeonLook = {
  body: '#8a8fa6', belly: '#a3a8bd', wing: '#7c8199', wingBack: '#5d6178', primaries: '#555a70', bar: '#3e4256',
  neck: '#5f8a86', neckPurple: '#76608a', beak: '#6c6464', cere: '#e6e4ec', eye: '#e08a3c', eyeRing: '#b6b9c8', rim: '#c9d0ff',
};

type CatBeat = 'walk' | 'stop' | 'look' | 'wiggle' | 'leap' | 'land' | 'stroll' | 'sit';

/** Where the camera wants to be: a point to frame and a zoom. Beats set it; the camera eases to it. */
interface Shot { x: number; y: number; zoom: number }

export class RooftopsScene extends Stage {
  private readonly cat: Cat;
  private readonly pigeon: Pigeon;
  private readonly beats: Beats<CatBeat>;
  private readonly cam: Camera;
  private shot: Shot = { x: 0, y: 0, zoom: 2.1 };
  private zoom = 2.1;
  private readonly stars = ((r = rng(9)) => Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * 620, r: 0.7 + r() * 1.5, a: 0.3 + r() * 0.6 })))();

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 10 });
    this.paper.light = { x: -0.55, y: 0.85 }; // moonlight from the upper right
    this.world.ground = () => 1400;
    this.world.surfaces.push(roofSurface(HOUSE_A), roofSurface(HOUSE_B));
    this.cat = new Cat(this.world, 700, HOUSE_A.ridge, TOM);
    this.pigeon = new Pigeon(chimneyTop(HOUSE_B)!, -1, DOVE, 1.6);
    this.cam = new Camera(900, { width: W, height: H, stiffness: 4, damping: 4, handheld: 4 });
    this.beats = this.perform();
  }

  /** The cat's performance. Each beat sets intents and the shot; transitions come from what happens. */
  private perform(): Beats<CatBeat> {
    const cat = this.cat, i = () => cat.intent;
    const frame = (x: number, zoom: number, y = cat.root.y - 90) => { this.shot = { x, y, zoom }; };
    const gap = (LANDING.x + STOP_X + 90) / 2;
    return new Beats<CatBeat>('walk', {
      walk: {
        during: ({ since }) => { i().speed = 150 * ramp(since, 0, 0.5); i().tail = 0.85; frame(cat.x + 120, 2.1); },
        next: () => cat.x >= STOP_X && 'stop',
      },
      stop: { during: ({ since }) => { i().speed = 150 * (1 - ramp(since, 0, 0.35)); i().tail = 0.7; frame(cat.x + 120, 2.1); }, after: 0.45, then: 'look' },
      look: {
        during: ({ since }) => {
          i().look = since < 0.5 || since > 0.85 ? LANDING : { x: STOP_X + 200, y: 1100 };
          i().crouch = 0.15;
          i().tail = 0.45;
          frame(gap, 1.55, lerp(cat.root.y, LANDING.y, 0.5) - 90);
        },
        after: 1.2, then: 'wiggle',
      },
      wiggle: {
        during: ({ since }) => {
          i().look = LANDING;
          i().crouch = ramp(since, 0, 0.3);
          i().wiggle = envelope(since, 0.2, 0.35, 0.75, 0.9);
          i().tail = 0.2;
          frame(gap, 1.55, lerp(cat.root.y, LANDING.y, 0.5) - 90);
        },
        after: 0.95, then: 'leap',
      },
      leap: {
        enter: () => cat.jump(LANDING, 110),
        during: () => { i().look = LANDING; i().tail = 0.3; frame(cat.x + 120, 1.7); },
        next: () => !cat.airborne && 'land',
      },
      land: {
        enter: () => this.pigeon.startle({ x: HOUSE_B.x + 1500, y: -300 }),
        during: ({ since }) => { i().look = this.pigeon.pos; i().crouch = 0.3 * (1 - ramp(since, 0.1, 0.5)); i().tail = 0.5; frame(cat.x + 150, 1.9); },
        after: 0.6, then: 'stroll',
      },
      stroll: {
        during: ({ since }) => { i().speed = 110 * envelope(since, 0, 0.4, 0.9, 1.3); i().tail = 0.85; frame(cat.x - 40, 2.1); },
        after: 1.3, then: 'sit',
      },
      sit: {
        during: ({ since }) => {
          i().sit = ramp(since, 0, 0.7);
          i().tail = 0.1;
          i().look = { x: cat.x + 500, y: cat.root.y - 520 };
          frame(cat.x - 150, 2.35, cat.root.y - 120);
        },
      },
    });
  }

  protected start(): void {
    this.beats.update(0, 0);
    this.cam.snap(this.shot.x, this.shot.y);
  }

  protected update(t: number, dt: number): void {
    Object.assign(this.cat.intent, CAT_REST, { blink: blink(t, [1.2, 4.9, 8.6]) });
    if (!this.settling) this.beats.update(t, dt);
    this.cat.update(dt);
    this.pigeon.update(dt);
  }

  protected lateUpdate(t: number, dt: number): void {
    this.zoom += (this.shot.zoom - this.zoom) * (1 - Math.exp(-2.2 * dt));
    this.cam.update(this.shot.x, dt, t, this.shot.y);
  }

  probe(): Record<string, unknown> {
    const r = Math.round, c = this.cat.root, p = this.pigeon.pos;
    return { ...super.probe(), beat: this.beats.current, cat: [r(c.x), r(c.y)], airborne: this.cat.airborne, pigeon: [r(p.x), r(p.y)], zoom: +this.zoom.toFixed(2), beats: this.beats.history.map(b => `${b.beat}@${b.at.toFixed(2)}`) };
  }

  protected draw(t: number): void {
    const { ctx, paper, cam } = this;
    cam.zoom = this.zoom;
    this.drawSky(t);
    cam.layer(ctx, 0.02, () => this.drawMoon({ x: 1250, y: 300 }));
    cam.layer(ctx, 0.05, v => drawProps(paper, LAYERS.clouds, v.from, v.to, () => 0, t));
    cam.layer(ctx, 0.12, v => drawProps(paper, LAYERS.far, v.from, v.to, () => 0, t));
    cam.layer(ctx, 0.28, v => drawProps(paper, LAYERS.mid, v.from, v.to, () => 0, t));
    cam.layer(ctx, 0.52, v => drawProps(paper, LAYERS.near, v.from, v.to, () => 0, t));
    cam.layer(ctx, 1, () => {
      drawHouse(paper, HOUSE_A, H + 900);
      drawHouse(paper, HOUSE_B, H + 900);
      this.pigeon.draw(paper, t);
      this.cat.draw(paper);
    });
    caption(ctx, 'Hay saltos que se piensan.', { alpha: ramp(t, 8.3, 9.0), color: '#f3eede', glow: 'rgba(6, 8, 30, 0.7)' });
    vignette(ctx, [4, 6, 22], 0.55);
  }

  private drawSky(t: number): void {
    const ctx = this.ctx;
    fillGradient(ctx, [[0, '#0b1030'], [0.5, '#1c2654'], [0.8, '#34407a'], [1, '#4a4a80']]);
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      ctx.globalAlpha = s.a * (0.65 + 0.35 * noise1(t * 1.3 + s.x, 3));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawMoon(c: V): void {
    const ctx = this.ctx;
    const glow = ctx.createRadialGradient(c.x, c.y, 90, c.x, c.y, 460);
    glow.addColorStop(0, 'rgba(220, 225, 255, 0.28)'); glow.addColorStop(1, 'rgba(220, 225, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - 480, c.y - 480, 960, 960);
    this.paper.piece(circlePoly(c, 104, 44), '#fbf3da', { seed: 900, tear: 2.5, shadow: 0 });
    [[-30, -22, 18], [28, 18, 24], [-12, 42, 12], [40, -34, 10]].forEach(([dx, dy, r], k) =>
      this.paper.piece(circlePoly({ x: c.x + dx, y: c.y + dy }, r, 16), '#ece2c4', { seed: 910 + k, tear: 1.2, shadow: 0, edge: false }));
  }
}
