import {
  type RidgeSpec, type V, Beats, Camera, Particles, Spring, circlePoly, drawProps, drawRidge, fbm1, fillGradient, flora, noise1, ramp,
  scatter,
} from '../../src';
import { CLAWD_REST } from '../cast/Clawd';
import type { Act, Ctx } from './act';

const W = 1920, H = 1080;
const G = 900;

type Beat = 'walk' | 'look' | 'bump' | 'watch' | 'follow' | 'leap' | 'splash' | 'gone';

/**
 * Golden hour in a meadow: grass that bends around Clawd, a dandelion it bumps into, seeds that
 * ride the wind, and a pond to jump into.
 */
export class MeadowAct implements Act {
  readonly cam: Camera;
  readonly light = { x: 0.75, y: 0.55 }; // low sun behind, on the left
  private readonly dandelion: V;
  private readonly pond: [number, number];
  private readonly seeds = new Particles({ seed: 11, gravity: 14, drag: 1.3, flow: (x, y) => this.wind(x, y) });
  private readonly splash = new Particles({ seed: 12, gravity: 1500, drag: 0.4, floor: () => G + 8 });
  private readonly stem = new Spring({ x: 0, y: 0 }, 60, 3);
  private released = false;
  private splashAt = -Infinity;
  private beats: Beats<Beat>;
  private t = 0;
  private readonly layers;
  private readonly hills: RidgeSpec[];

  constructor(private readonly c: Ctx, private readonly X: number) {
    this.dandelion = { x: X + 650, y: this.ground(X + 650) };
    this.pond = [X + 1150, X + 2150];
    this.cam = new Camera(X, { width: W, height: H, stiffness: 5, damping: 4.5, handheld: 4 });
    const at = (d: number) => this.cam.toLayer(X, d);
    this.hills = [
      { seed: 41, base: 700, amp: 70, freq: 0.0014, color: '#d49a7c', tear: 3, shadow: 0 },
      { seed: 42, base: 760, amp: 60, freq: 0.002, color: '#b99069', tear: 3, shadow: 4 },
      { seed: 43, base: 820, amp: 40, freq: 0.0026, color: '#8f8a52', tear: 3, shadow: 6, fringe: { color: '#7f7c45', height: 10, spacing: 9 } },
    ];
    this.layers = {
      clouds: scatter({ seed: 44, from: at(0.05) - 2500, to: at(0.05) + 2500, spacing: [650, 1000], ground: x => 170 + noise1(x * 0.004, 3) * 70,
        makers: [{ make: flora.cloud({ width: [160, 280], color: '#fbe0bf', shade: '#f2c8a2' }), weight: 1 }] }),
      trees: scatter({ seed: 45, from: at(0.45) - 2500, to: at(0.45) + 3000, spacing: [120, 300], ground: () => 830, flex: 0.4,
        makers: [
          { make: flora.tree({ height: [160, 260], canopy: [60, 95], trunk: '#6a4a3a', leaves: ['#6f7a3e', '#7f8a45', '#94984f'], light: '#f6c27a' }), weight: 3 },
          { make: flora.pine({ height: [170, 260], width: [60, 90], trunk: '#5e4636', leaves: ['#5f6d3a', '#6b7a40'] }), weight: 1 },
        ] }),
      grass: scatter({ seed: 46, from: X - 1500, to: X + 1100, spacing: [14, 40], ground: x => this.ground(x) + 4, flex: 1.2,
        makers: [
          { make: flora.tuft({ blades: [4, 8], height: [34, 70], width: 5, colors: ['#8e9a45', '#a2a84e', '#7f8c3e'] }), weight: 6 },
          { make: flora.flower({ height: [50, 80], petals: ['#f2e2c4', '#e9b44c', '#e58f6a'], stem: '#6f7d3a', size: [7, 11] }), weight: 1 },
        ] }),
      reeds: scatter({ seed: 47, from: X + 1010, to: X + 2350, spacing: [16, 34], ground: x => G + 6 + (x > this.pond[0] + 60 && x < this.pond[1] - 60 ? 400 : 0), flex: 1,
        makers: [{ make: flora.tuft({ blades: [3, 5], height: [70, 130], width: 5, colors: ['#6f7a3a', '#5f6b33'] }), weight: 1 }] }),
      fore: scatter({ seed: 48, from: at(1.4) - 2500, to: at(1.4) + 5000, spacing: [60, 160], ground: () => H + 120, flex: 1.5,
        makers: [{ make: flora.tuft({ blades: [5, 9], height: [140, 260], width: 12, colors: ['#5a6630', '#4f5a2b'] }), weight: 1 }] }),
    };
    this.beats = this.perform();
  }

  get done(): boolean { return this.beats.current === 'gone'; }

  private ground(x: number): number {
    return G + fbm1(x * 0.003, 7) * 10;
  }

  private wind(x: number, y: number): V {
    return { x: 260 + noise1(this.t * 0.6 + x * 0.002, 2) * 90, y: -30 + noise1(this.t * 0.8 + y * 0.004, 3) * 40 };
  }

  /** How far the ground dips below the waterline around the pond (a sloped bank, not a wall). */
  private bank(x: number): number {
    const [a, b] = this.pond, d = Math.min(x - a, b - x);
    return d <= -80 ? 0 : 300 * Math.min(1, (d + 80) / 180) ** 1.6;
  }

  private floor(x: number): number {
    return x > this.pond[0] + 40 && x < this.pond[1] - 40 ? G + 8 : this.ground(x);
  }

  private get head(): V {
    const lean = this.stem.pos.x;
    return { x: this.dandelion.x + lean * 60, y: this.dandelion.y - 250 + Math.abs(lean) * 12 };
  }

  begin(): void {
    this.c.clawd.place({ x: this.X + 260, y: this.ground(this.X + 260) }, 'walk');
    this.beats = this.perform();
    this.cam.cut({ x: this.X + 440, y: G - 140, zoom: 1.6, handheld: 4 });
  }

  private perform(): Beats<Beat> {
    const clawd = this.c.clawd, i = () => clawd.intent;
    return new Beats<Beat>('walk', {
      walk: { during: ({ since }) => Object.assign(i(), { speed: 160 * ramp(since, 0, 0.3) }), next: () => clawd.root.x >= this.dandelion.x - 105 && 'look' },
      look: { during: ({ since }) => Object.assign(i(), { speed: 160 * (1 - ramp(since, 0, 0.25)), look: this.head, surprise: ramp(since, 0.3, 0.5) }), after: 0.65, then: 'bump' },
      bump: {
        during: ({ since }) => Object.assign(i(), { look: this.head, crouch: ramp(since, 0, 0.2), arms: ramp(since, 0.15, 0.3) }),
        next: ({ since }) => {
          if (since > 0.25 && clawd.mode === 'walk' && !this.released) { clawd.jump({ x: clawd.root.x + 30, y: this.ground(clawd.root.x + 30) }, 70, 2600); this.released = true; this.release(); }
          return this.released && clawd.consumeLanding() && 'watch';
        },
      },
      watch: { during: ({ since }) => Object.assign(i(), { look: this.seedsCenter(), happy: ramp(since, 0.35, 0.45), arms: 0.5 + Math.sin(since * 6) * 0.2 }), after: 1.1, then: 'follow' },
      follow: { during: ({ since }) => Object.assign(i(), { speed: 250 * ramp(since, 0, 0.3), look: this.seedsCenter() }), next: () => clawd.root.x >= this.pond[0] - 20 && 'leap' },
      leap: {
        enter: () => clawd.jump({ x: this.pond[0] + 420, y: G + 8 }, 150, 2600),
        during: () => Object.assign(i(), { arms: 1, happy: 1 }),
        next: ({ t }) => { if (!clawd.consumeLanding()) return false; this.splashAt = t; this.splashUp(); clawd.dive(); return 'splash'; },
      },
      splash: { during: () => clawd.swimmer.steer({ x: 40, y: 200 }), after: 0.45, then: 'gone' },
      gone: {},
    });
  }

  private release(): void {
    this.stem.vel.x += 5;
    this.seeds.emit(this.head, 90, { angle: -0.4, spread: 2.6, speed: [40, 220], life: [5, 9], size: [0.8, 1.2] });
  }

  private splashUp(): void {
    const at = { x: this.c.clawd.root.x, y: G + 4 };
    this.splash.emit(at, 70, { angle: -Math.PI / 2, spread: 1.4, speed: [300, 900], life: [0.5, 1.2], size: [3, 8] });
  }

  private seedsCenter(): V {
    const l = this.seeds.list;
    if (!l.length) return this.head;
    let x = 0, y = 0;
    for (const p of l) { x += p.x; y += p.y; }
    return { x: x / l.length, y: y / l.length };
  }

  update(t: number, dt: number, active: boolean): void {
    this.t = t;
    this.stem.step({ x: 0, y: 0 }, dt);
    this.seeds.update(dt);
    this.splash.update(dt);
    if (!active) return;
    const clawd = this.c.clawd;
    clawd.floor = x => this.floor(x);
    Object.assign(clawd.intent, CLAWD_REST, { facing: 1 });
    this.beats.update(t, dt);
  }

  lateUpdate(t: number, dt: number): void {
    const clawd = this.c.clawd, b = this.beats.current;
    const close = b === 'look' || b === 'bump' || b === 'watch';
    const x = close ? this.dandelion.x + 40 : b === 'leap' || b === 'splash' || b === 'gone' ? this.pond[0] + 260 : clawd.root.x + 180;
    this.cam.frame({ x, y: close ? G - 200 : G - 140, zoom: close ? 1.85 : 1.6, handheld: 4 }, dt, t);
  }

  draw(t: number, withClawd: boolean): void {
    const { paper, ctx } = this.c, cam = this.cam;
    fillGradient(ctx, [[0, '#f7cf98'], [0.45, '#f4b07a'], [0.75, '#ec9470'], [1, '#e2806c']]);
    cam.layer(paper, 0.02, () => {
      const sun = ctx.createRadialGradient(1500, 640, 20, 1500, 640, 420);
      sun.addColorStop(0, 'rgba(255, 244, 214, 0.9)'); sun.addColorStop(0.2, 'rgba(255, 232, 190, 0.45)'); sun.addColorStop(1, 'rgba(255, 220, 170, 0)');
      paper.context.fillStyle = sun;
      paper.context.fillRect(1080, 220, 840, 840);
      paper.piece(circlePoly({ x: 1500, y: 640 }, 70, 40), '#fff3d6', { seed: 400, tear: 1.5, shadow: 0 });
    });
    paper.edgeColor = 'rgba(255, 246, 232, 0.2)';
    cam.layer(paper, 0.05, v => drawProps(paper, this.layers.clouds, v.from, v.to, () => 0, t));
    cam.layer(paper, 0.12, v => drawRidge(paper, this.hills[0], v.from, v.to, H + 800));
    cam.layer(paper, 0.25, v => drawRidge(paper, this.hills[1], v.from, v.to, H + 800));
    cam.layer(paper, 0.45, v => { drawProps(paper, this.layers.trees, v.from, v.to, x => 60 + noise1(x * 0.01 + t, 1) * 40, t); drawRidge(paper, this.hills[2], v.from, v.to, H + 800); });
    paper.edgeColor = 'rgba(255, 246, 232, 0.28)';
    cam.layer(paper, 1, v => this.drawNear(v.from, v.to, t, withClawd));
    paper.layer(1, () => cam.layer(paper, 1.4, v => drawProps(paper, this.layers.fore, v.from, v.to, x => 120 + noise1(x * 0.01 + t, 2) * 60, t)), 'source-over', 'blur(5px)');
  }

  private drawNear(from: number, to: number, t: number, withClawd: boolean): void {
    const { paper } = this.c, clawd = this.c.clawd;
    const pts: V[] = [];
    for (let x = from - 20; x <= to + 20; x += 18) pts.push({ x, y: this.ground(x) + this.bank(x) });
    this.drawPond(t);
    paper.piece([...pts, { x: to + 20, y: H + 900 }, { x: from - 20, y: H + 900 }], '#7c8a3f', { seed: 410, tear: 2, shadow: 6, rim: { color: '#f6d28a', width: 3 } });
    const breeze = (x: number) => 140 + noise1(x * 0.01 + t * 0.7, 2) * 90;
    drawProps(paper, this.layers.reeds, from, to, breeze, t, withClawd ? [clawd.root] : []);
    this.drawDandelion();
    drawProps(paper, this.layers.grass, from, to, breeze, t, withClawd ? [clawd.root] : []);
    if (withClawd && clawd.mode !== 'swim') clawd.draw(paper);
    this.drawSeeds();
    this.drawSplash();
  }

  private drawPond(t: number): void {
    const { paper } = this.c, [a, b] = this.pond, ctx = paper.context;
    const g = ctx.createLinearGradient(0, G, 0, G + 220);
    g.addColorStop(0, '#f6cfa6'); g.addColorStop(0.12, '#d9a88c'); g.addColorStop(0.3, '#7fa6a0'); g.addColorStop(1, '#3e6f78');
    const water: V[] = [];
    for (let x = a - 60; x <= b + 60; x += 20) water.push({ x, y: G + 8 });
    paper.piece([...water, { x: b + 60, y: G + 400 }, { x: a - 60, y: G + 400 }], g, { seed: 420, tear: 1.5, shadow: 0 });
    paper.line([{ x: a + 10, y: G + 12 }, { x: b - 10, y: G + 12 }], 'rgba(255, 240, 215, 0.7)', 3);
    for (const [dx, w] of [[0.3, 90], [0.62, 140]] as const) paper.line([{ x: a + (b - a) * dx, y: G + 30 }, { x: a + (b - a) * dx + w, y: G + 30 }], 'rgba(255, 236, 205, 0.45)', 2.5);
    for (let k = 0; k < 3; k++) {
      const age = t - this.splashAt - k * 0.25;
      if (age < 0 || age > 1.6) continue;
      const r = 20 + age * 160, x = this.c.clawd.swimmer.pos.x || a + 420;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 244, 224, ${0.7 * (1 - age / 1.6)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(Math.min(Math.max(x, a + 100), b - 100), G + 10, r, r * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  /** Stem, seed head (a ball of little parachutes) or, once blown, the bare receptacle. */
  private drawDandelion(): void {
    const { paper } = this.c, h = this.head, base = this.dandelion, ctx = paper.context;
    paper.tube([base, { x: (base.x + h.x) / 2 + this.stem.pos.x * 12, y: (base.y + h.y) / 2 }, h], 5, 4, '#6f7d3a', { seed: 430, tear: 0.5, shadow: 4 });
    paper.piece(circlePoly(h, 9, 12), '#b8a868', { seed: 431, tear: 0.6, shadow: 3 });
    if (this.released) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 252, 244, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2, r = 38 + (k % 3) * 3;
      ctx.moveTo(h.x + Math.cos(a) * 8, h.y + Math.sin(a) * 8);
      ctx.lineTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 252, 244, 0.35)';
    ctx.beginPath(); ctx.arc(h.x, h.y, 40, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Each seed: a stalk and a tuft, tilted by its drift. */
  private drawSeeds(): void {
    const ctx = this.c.paper.context;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 252, 244, 0.9)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    this.seeds.draw(p => {
      const a = Math.atan2(p.vy, p.vx) * 0.3 - Math.PI / 2 + Math.sin(p.age * 3 + p.seed * 9) * 0.3, s = 9 * p.size;
      const tip = { x: p.x + Math.cos(a) * s, y: p.y + Math.sin(a) * s };
      ctx.moveTo(p.x, p.y); ctx.lineTo(tip.x, tip.y);
      for (let k = -2; k <= 2; k++) {
        const b = a + k * 0.45;
        ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + Math.cos(b) * s * 0.7, tip.y + Math.sin(b) * s * 0.7);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  private drawSplash(): void {
    const ctx = this.c.paper.context;
    ctx.save();
    ctx.fillStyle = 'rgba(236, 246, 244, 0.85)';
    this.splash.draw((p, u) => { if (p.landed) return; ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - u * 0.5), 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  probe(): Record<string, unknown> {
    return { meadow: this.beats.current, seeds: this.seeds.list.length, x: Math.round(this.c.clawd.root.x - this.X) };
  }
}
