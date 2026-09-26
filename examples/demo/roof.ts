import { type Pt, type V, Beats, Camera, Surface, building, circlePoly, drawProps, fillGradient, noise1, ramp, rng, scatter } from '../../src';
import { CLAWD_REST } from '../cast/Clawd';
import { type HousePalette, type HouseSpec, chimneyTop, drawHouse, roofSurface } from '../sets/houses';
import type { Act, Ctx } from './act';

const W = 1920, H = 1080;
const BULBS = ['#ffd37a', '#ff9a6a', '#f6e7a8', '#ffc0a0'];

type Beat = 'arrive' | 'walk' | 'chimney' | 'wire' | 'boing' | 'across' | 'hop' | 'moon' | 'gone';

const TILES: HousePalette = {
  wall: '#3b4068', wallShade: '#2f345a', roof: '#5b4260', tiles: ['#654a69', '#523a56', '#5e4463'], ridge: '#3f2c44',
  window: '#f2c46a', windowDark: '#262b4a', frame: '#2a2d4c', rim: '#a9b3f0',
};

/**
 * Night over the rooftops: Clawd lands on a roof, climbs a chimney and walks a string of lights to
 * the next one. The wire sags under it and throws it back up; the bulbs swing. Then the moon.
 */
export class RoofAct implements Act {
  readonly cam: Camera;
  readonly light = { x: -0.55, y: 0.85 };
  private readonly a: HouseSpec;
  private readonly b: HouseSpec;
  private readonly wire: Pt[];
  private readonly moon: V;
  private beats: Beats<Beat>;
  private boings = 0;
  private readonly stars: { x: number; y: number; r: number; a: number }[];
  private readonly layers;

  constructor(private readonly c: Ctx, private readonly X: number) {
    this.a = { x: X - 1100, width: 1000, eave: 650, ridge: 570, hip: 110, palette: TILES, windows: { cols: 5, lit: [1, 3, 6] }, chimney: { at: 860, width: 70, height: 110 }, seed: 700 };
    this.b = { x: X + 300, width: 1100, eave: 630, ridge: 550, hip: 100, palette: { ...TILES, wall: '#45466f', wallShade: '#37395f', roof: '#684559', tiles: ['#72505f', '#5c3f4f', '#6b4859'] }, windows: { cols: 5, lit: [0, 2, 7] }, chimney: { at: 60, width: 70, height: 130 }, seed: 800 };
    const w = c.world;
    for (const h of [this.a, this.b]) {
      w.surfaces.push(roofSurface(h));
      const top = chimneyTop(h)!, half = h.chimney!.width / 2 + 4;
      w.surfaces.push(new Surface([{ x: top.x - half, y: top.y }, { x: top.x + half, y: top.y }]));
    }
    const from = chimneyTop(this.a)!, to = chimneyTop(this.b)!, n = 22;
    const start = w.point(from.x + 30, from.y - 4, { mass: Infinity }), end = { x: to.x - 30, y: to.y - 4 };
    const seg = (Math.hypot(end.x - start.x, end.y - start.y) * 1.05) / n;
    this.wire = w.chain(start, n - 1, seg, { x: (end.x - start.x) / (n * seg), y: (end.y - start.y) / (n * seg) }, { mass: 0.4, drag: 0.02, gravity: 1 });
    const last = w.point(end.x, end.y, { mass: Infinity });
    w.link(this.wire[this.wire.length - 1], last, 1, false, seg);
    this.wire.push(last);
    w.forces.push(() => this.weigh());
    this.moon = { x: 1380, y: 250 };
    const r = rng(33);
    this.stars = Array.from({ length: 110 }, () => ({ x: r() * W, y: r() * 640, r: 0.7 + r() * 1.6, a: 0.3 + r() * 0.6 }));
    const at = (d: number) => W / 2 + (X - W / 2) * d;
    this.layers = {
      far: scatter({ seed: 71, from: at(0.14) - 2500, to: at(0.14) + 2500, spacing: [60, 150], ground: () => 660, flex: 0,
        makers: [{ make: building({ width: [60, 140], height: [90, 240], colors: ['#27315d', '#2a3462'], window: '#b8964f', lit: 0.06, base: 900 }), weight: 1 }] }),
      near: scatter({ seed: 72, from: at(0.4) - 2500, to: at(0.4) + 2500, spacing: [120, 240], ground: () => 740, flex: 0,
        makers: [{ make: building({ width: [120, 220], height: [150, 300], colors: ['#1c2346', '#1f2649'], window: '#e0ae58', lit: 0.1, base: 900 }), weight: 1 }] }),
    };
    this.cam = new Camera(X, { width: W, height: H, stiffness: 4, damping: 4, handheld: 3 });
    this.beats = this.perform();
  }

  get done(): boolean { return this.beats.current === 'gone'; }

  exitPoint(): V { return this.cam.toScreen(this.moon, 0.02); }

  /** The wire's height under x, if x is over it. */
  private wireAt(x: number): number | undefined {
    const p = this.wire;
    if (x < p[0].x || x > p[p.length - 1].x) return undefined;
    for (let i = 1; i < p.length; i++) if (x <= p[i].x) { const u = (x - p[i - 1].x) / (p[i].x - p[i - 1].x || 1); return p[i - 1].y + (p[i].y - p[i - 1].y) * u; }
    return undefined;
  }

  private floor(x: number, y: number): number {
    const onWire = this.wireAt(x);
    const f = this.c.world.floorBelow(x, y);
    return onWire !== undefined && onWire >= y - 20 ? Math.min(onWire, f) : f;
  }

  /** Clawd's weight pulls on the two wire points around its feet. */
  private weigh(): void {
    const clawd = this.c.clawd, x = clawd.root.x, y = this.wireAt(x);
    if (y === undefined || clawd.mode !== 'walk' || Math.abs(clawd.root.y - y) > 6) return;
    for (const p of this.wire) {
      const k = Math.max(0, 1 - Math.abs(p.x - x) / 60);
      if (p.invMass) p.ay += 5200 * k;
    }
  }

  begin(): void {
    this.c.clawd.place({ x: this.X - 640, y: 1250 }, 'walk');
    this.beats = this.perform();
    this.cam.cut({ x: this.X - 440, y: this.a.ridge - 110, zoom: 1.55, handheld: 3 });
  }

  private perform(): Beats<Beat> {
    const clawd = this.c.clawd, i = () => clawd.intent, A = chimneyTop(this.a)!, B = chimneyTop(this.b)!;
    const mid = (this.wire[0].x + this.wire[this.wire.length - 1].x) / 2;
    const kick = () => { for (const p of this.wire) { const k = Math.max(0, 1 - Math.abs(p.x - clawd.root.x) / 90); if (p.invMass) p.py -= 7 * k; } };
    return new Beats<Beat>('arrive', {
      arrive: { enter: () => clawd.jump({ x: this.X - 420, y: this.a.ridge }, 140), during: () => Object.assign(i(), { arms: 1 }), next: () => clawd.consumeLanding() && 'walk' },
      walk: { during: ({ since }) => Object.assign(i(), { speed: 170 * ramp(since, 0.2, 0.5) }), next: () => clawd.root.x >= A.x - 150 && 'chimney' },
      chimney: { enter: () => clawd.jump(A, 70), next: () => clawd.consumeLanding() && 'wire' },
      wire: { enter: () => this.c.cue('oh', clawd.root), during: ({ since }) => Object.assign(i(), { speed: 170 * ramp(since, 0.15, 0.4), look: { x: clawd.root.x, y: clawd.root.y + 300 }, surprise: 0.6 }), next: () => clawd.root.x >= mid - 20 && 'boing' },
      boing: {
        enter: () => { clawd.jump({ x: clawd.root.x + 6, y: this.wireAt(clawd.root.x + 6)! }, 70, 2400); kick(); },
        during: () => Object.assign(i(), { arms: 1, happy: 1 }),
        next: () => { if (!clawd.consumeLanding()) return false; kick(); this.c.cue('wire', clawd.root, { data: { n: this.boings + 1 } }); return ++this.boings >= 2 ? 'across' : 'boing'; },
      },
      across: { during: ({ since }) => Object.assign(i(), { speed: 190 * ramp(since, 0.1, 0.35), happy: 1 }), next: () => clawd.root.x >= B.x - 150 && 'hop' },
      hop: { enter: () => clawd.jump(B, 70), next: () => { if (!clawd.consumeLanding()) return false; this.c.cue('chimney', clawd.root); return 'moon'; } },
      moon: { enter: () => this.c.cue('moon', clawd.root), during: ({ since }) => Object.assign(i(), { look: { x: clawd.root.x + 400, y: clawd.root.y - 900 }, happy: ramp(since, 0.6, 0.7), arms: ramp(since, 0.7, 1.0) }), after: 1.5, then: 'gone' },
      gone: {},
    });
  }

  update(t: number, dt: number, active: boolean): void {
    if (!active) return;
    const clawd = this.c.clawd;
    clawd.floor = (x, y) => this.floor(x, y);
    Object.assign(clawd.intent, CLAWD_REST, { facing: 1 });
    this.beats.update(t, dt);
  }

  lateUpdate(t: number, dt: number): void {
    const clawd = this.c.clawd, b = this.beats.current;
    const x = b === 'moon' || b === 'gone' ? clawd.root.x + 250 : clawd.root.x + 160;
    this.cam.frame({ x, y: clawd.root.y - 110, zoom: b === 'moon' || b === 'gone' ? 1.25 : 1.55, handheld: 3 }, dt, t);
  }

  draw(t: number, withClawd: boolean): void {
    const { paper, ctx } = this.c, cam = this.cam;
    fillGradient(ctx, [[0, '#0b1030'], [0.5, '#1c2654'], [0.8, '#34407a'], [1, '#4a4a80']]);
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      ctx.globalAlpha = s.a * (0.65 + 0.35 * noise1(t * 1.3 + s.x, 3));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    paper.edgeColor = 'rgba(255, 246, 232, 0.12)';
    cam.layer(paper, 0.02, () => this.drawMoon());
    cam.layer(paper, 0.14, v => drawProps(paper, this.layers.far, v.from, v.to, () => 0, t));
    cam.layer(paper, 0.4, v => drawProps(paper, this.layers.near, v.from, v.to, () => 0, t));
    paper.edgeColor = 'rgba(255, 246, 232, 0.28)';
    cam.layer(paper, 1, () => {
      drawHouse(paper, this.a, H + 900);
      drawHouse(paper, this.b, H + 900);
      this.drawWire(t);
      if (withClawd) this.c.clawd.draw(paper);
    });
  }

  private drawMoon(): void {
    const ctx = this.c.paper.context, c = this.moon;
    const glow = ctx.createRadialGradient(c.x, c.y, 90, c.x, c.y, 460);
    glow.addColorStop(0, 'rgba(220, 225, 255, 0.28)'); glow.addColorStop(1, 'rgba(220, 225, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - 480, c.y - 480, 960, 960);
    this.c.paper.piece(circlePoly(c, 104, 44), '#fbf3da', { seed: 900, tear: 2.5, shadow: 0 });
    [[-30, -22, 18], [28, 18, 24], [-12, 42, 12], [40, -34, 10]].forEach(([dx, dy, r], k) =>
      this.c.paper.piece(circlePoly({ x: c.x + dx, y: c.y + dy }, r, 16), '#ece2c4', { seed: 910 + k, tear: 1.2, shadow: 0, edge: false }));
  }

  /** The wire and its bulbs: each bulb hangs from a point, swings with it and glows. */
  private drawWire(t: number): void {
    const paper = this.c.paper, ctx = paper.context, pts = this.wire;
    paper.line(pts, '#1a1a26', 2.4);
    const bulbs: { at: V; color: string }[] = [];
    for (let k = 1; k < pts.length - 1; k += 2) {
      const p = pts[k], swing = (p.x - p.px) * 0.08;
      const at = { x: p.x + Math.sin(swing) * 14, y: p.y + 14 };
      bulbs.push({ at, color: BULBS[(k >> 1) % BULBS.length] });
      paper.line([p, at], '#1a1a26', 1.6);
    }
    paper.layer(1, () => {
      for (const [i, b] of bulbs.entries()) {
        const flicker = 0.75 + 0.25 * noise1(t * 3 + i, 5);
        const g = ctx.createRadialGradient(b.at.x, b.at.y, 2, b.at.x, b.at.y, 60);
        g.addColorStop(0, `rgba(255, 220, 150, ${0.55 * flicker})`); g.addColorStop(1, 'rgba(255, 210, 140, 0)');
        paper.context.fillStyle = g;
        paper.context.fillRect(b.at.x - 60, b.at.y - 60, 120, 120);
      }
    }, 'screen');
    bulbs.forEach((b, i) => paper.piece(circlePoly({ x: b.at.x, y: b.at.y + 6 }, 9, 12, 7), b.color, { seed: 950 + i, tear: 0.5, shadow: 3, edge: false }));
  }

  probe(): Record<string, unknown> {
    return { roof: this.beats.current, x: Math.round(this.c.clawd.root.x - this.X), y: Math.round(this.c.clawd.root.y) };
  }
}

