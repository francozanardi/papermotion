import {
  type Letter, type V, Beats, Camera, Particles, Spring, drawProps, fillGradient, flora, layoutLetters, noise1, overshoot, ramp, rng, scatter, textWidth,
} from '../../src';
import { CLAWD_REST } from '../cast/Clawd';
import type { Act, Ctx } from './act';

const W = 1920, H = 1080;
const INK = '#2b2622', ORANGE = '#d97757', CREAM = ['#f4ecdc', '#ece0c8'];
const FONT = '800 210px Montserrat';

interface Tile { l: Letter; x: number; at: number; spin: number; dip: Spring }

/**
 * A title card of paper letters. Letters drop in one after another and settle with an overshoot;
 * Clawd lands on the first and hops along the word, each letter giving under its weight.
 * The same act closes the film with a tag line (`tagline`), and Clawd staying for a wave.
 */
export class TitleAct implements Act {
  readonly cam = new Camera(0, { width: W, height: H, stiffness: 6, damping: 5, handheld: 2 });
  readonly light = { x: -0.5, y: 0.85 };
  private readonly tiles: Tile[];
  private readonly baseline = 610;
  private beats: Beats<'drop' | 'hop' | 'off' | 'gone' | 'stay'>;
  private hop = 0;
  private begun = 0;
  private readonly confetti = new Particles({ seed: 9, gravity: 260, drag: 1.6 });
  private readonly bits: ReturnType<typeof scatter>;

  constructor(private readonly c: Ctx, private readonly origin: number, private readonly tagline: string | null) {
    const width = textWidth(c.ctx, 'papermotion', FONT), r = rng(origin + 5), mid = this.cam.toLayer(origin, 0.3);
    this.bits = scatter({ seed: 91, from: mid - 2500, to: mid + 2500, spacing: [140, 320], ground: x => 200 + noise1(x * 0.01, 4) * 520, flex: 0,
      makers: [{ make: flora.rock({ size: [8, 18], colors: ['#e3c9a9', '#d9b99a', '#e7d6bd'] }), weight: 1 }] });
    this.tiles = layoutLetters(c.ctx, 'papermotion', FONT).map((l, i) => ({
      l, x: origin - width / 2 + l.x, at: 0.15 + i * 0.07, spin: (r() - 0.5) * 0.8, dip: new Spring({ x: 0, y: 0 }, 260, 12),
    }));
    this.beats = this.perform(0);
  }

  get done(): boolean { return this.beats.current === 'gone'; }

  /** Top of letter `i` right now (world), with its drop and its dip. */
  private top(i: number, t: number): V {
    const tile = this.tiles[i];
    return { x: tile.x + tile.l.width / 2, y: this.baseline - tile.l.ascent + this.fall(tile, t) + tile.dip.pos.y };
  }

  private fall(tile: Tile, t: number): number {
    return -900 * (1 - overshoot((t - this.begun - tile.at) / 0.55, 1.4));
  }

  private floor(x: number, t: number): number {
    for (let i = 0; i < this.tiles.length; i++) {
      const tile = this.tiles[i];
      if (x >= tile.x + 4 && x <= tile.x + tile.l.width - 4) return this.top(i, t).y;
    }
    return 1e9;
  }

  begin(t: number): void {
    this.begun = t;
    const clawd = this.c.clawd;
    clawd.floor = x => this.floor(x, t);
    const first = this.tagline ? 6 : 0; // the closing card lands Clawd on the "m"
    clawd.place({ x: this.top(first, t + 2).x - 320, y: -260 }, 'walk');
    this.hop = first;
    this.beats = this.perform(first);
    this.cam.cut({ x: this.origin, y: this.tagline ? 600 : 540, zoom: this.tagline ? 1.08 : 1, handheld: 2 });
  }

  private perform(first: number): Beats<'drop' | 'hop' | 'off' | 'gone' | 'stay'> {
    const clawd = this.c.clawd, n = this.tiles.length;
    const land = (i: number, t: number) => {
      this.tiles[i].dip.vel.y += 320;
      this.hop = i;
      if (this.tagline) this.burst(this.top(i, t));
    };
    return new Beats('drop', {
      drop: {
        enter: ({ t }) => clawd.jump(this.top(first, t + 0.5), 60, 2600),
        next: ({ t }) => { if (!clawd.consumeLanding()) return false; land(first, t); return this.tagline ? 'stay' : 'hop'; },
      },
      hop: {
        enter: ({ t }) => clawd.jump(this.top(this.hop + 1, t + 0.2), 58, 4600),
        next: ({ t }) => {
          if (!clawd.consumeLanding()) return false;
          land(this.hop + 1, t);
          return this.hop + 1 >= n ? 'off' : 'hop';
        },
      },
      off: { enter: () => clawd.jump({ x: this.tiles[n - 1].x + 620, y: 1500 }, 150, 2600), after: 0.55, then: 'gone' },
      gone: {},
      stay: {},
    });
  }

  private burst(at: V): void {
    this.confetti.emit(at, 70, { angle: -Math.PI / 2, spread: 2.4, speed: [300, 900], life: [1.6, 2.6], size: [6, 13] });
  }

  update(t: number, dt: number, active: boolean): void {
    for (const tile of this.tiles) tile.dip.step({ x: 0, y: 0 }, dt);
    this.confetti.update(dt);
    if (!active) return;
    const clawd = this.c.clawd;
    clawd.floor = x => this.floor(x, t);
    Object.assign(clawd.intent, CLAWD_REST, { facing: 1 });
    this.beats.update(t, dt);
    if (this.beats.current === 'stay') {
      const since = this.beats.since(t);
      Object.assign(clawd.intent, { happy: ramp(since, 0.5, 0.6), wave: ramp(since, 0.7, 0.9) * 1.4, arms: 0.35, look: { x: clawd.root.x, y: clawd.root.y + 600 } });
    }
  }

  lateUpdate(t: number, dt: number): void {
    this.cam.frame({ x: this.origin, y: this.tagline ? 560 : 540, zoom: this.tagline ? 1.2 : 1 }, dt, t);
  }

  draw(t: number, withClawd: boolean): void {
    const { paper, ctx } = this.c, cam = this.cam, since = t - this.begun;
    fillGradient(ctx, [[0, CREAM[0]], [1, CREAM[1]]]);
    cam.layer(paper, 0.3, v => {
      paper.edgeColor = 'rgba(255, 250, 240, 0.4)';
      drawProps(paper, this.bits, v.from, v.to, () => 0, t);
    });
    cam.layer(paper, 1, () => {
      paper.edgeColor = 'rgba(255, 250, 240, 0.45)';
      this.tiles.forEach((tile, i) => {
        if (since < tile.at) return;
        const u = (since - tile.at) / 0.55, angle = tile.spin * (1 - overshoot(u, 1.2));
        paper.text(tile.l.ch, { x: tile.x, y: this.baseline + this.fall(tile, t) + tile.dip.pos.y }, {
          font: FONT, color: i >= 5 ? ORANGE : INK, angle, sheet: { shadow: 10, rim: { color: '#fffaf0', width: 2 }, shade: { color: 'rgba(0, 0, 0, 0.18)', width: 5 }, anchor: { x: tile.x, y: 0 } },
        });
      });
      this.drawSubtitle(t);
      if (withClawd) this.c.clawd.draw(paper);
      this.drawConfetti();
    });
  }

  /** The line under the title: slides up and fades in, one strip of paper. */
  private drawSubtitle(t: number): void {
    const since = t - this.begun, text = this.tagline ?? 'a paper-cutout animation engine';
    const a = ramp(since, this.tagline ? 0.9 : 1.1, this.tagline ? 1.5 : 1.7);
    if (a <= 0) return;
    const y = this.baseline + 120 + (1 - overshoot(a, 1.2)) * 40;
    this.c.paper.text(text, { x: this.origin, y }, {
      font: this.tagline ? '500 58px Montserrat' : '300 50px Montserrat', color: INK, align: 'center',
      sheet: { shadow: 4, alpha: a, anchor: { x: this.origin, y } },
    });
  }

  private drawConfetti(): void {
    const colors = [ORANGE, INK, '#e9b44c', '#f4ecdc'];
    this.confetti.draw((p, u) => {
      const a = p.seed * 20 + p.age * (4 + p.seed * 8), s = p.size * (1 - u * 0.3), sq = Math.cos(p.age * 9 + p.seed * 10);
      const pts = [{ x: -s, y: -s * 0.6 }, { x: s, y: -s * 0.6 }, { x: s, y: s * 0.6 }, { x: -s, y: s * 0.6 }]
        .map(q => ({ x: q.x * sq, y: q.y }))
        .map(q => ({ x: p.x + q.x * Math.cos(a) - q.y * Math.sin(a), y: p.y + q.x * Math.sin(a) + q.y * Math.cos(a) }));
      this.c.paper.piece(pts, colors[Math.floor(p.seed * 4)], { seed: Math.floor(p.seed * 1000), tear: 0.4, shadow: 3, edge: false });
    });
  }

  probe(): Record<string, unknown> {
    return { title: this.beats.current, hop: this.hop };
  }
}

