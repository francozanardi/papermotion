import {
  Beats, Camera, Edit, type Glow, type Light, Particles, Fire, type Sky, Stage, type V,
  caption, clamp, darkness, drawSky, drawSpray, easeInOut, envelope, fillGradient, grain, keys, lerp, noise1, ramp, rng, vignette, wash,
} from '../../src';
import { handOutline, placeHand } from './hand';
import { type Palette, Person } from './Person';
import { DEPTH, FIRE, FLOOR, GROUND, WALL, drawFloor, drawForeground, drawHearth, drawLand, drawWall, makeSky } from './set';
import { score } from './sound';

const W = 1920, H = 1080;

type AncientBeat = 'sit' | 'gaze' | 'rise' | 'reach' | 'turn' | 'shadow' | 'walk' | 'press' | 'blow' | 'lift' | 'behold' | 'back' | 'rest';
type VisitorBeat = 'wait' | 'enter' | 'arrive' | 'raise' | 'hover' | 'dark' | 'up';
type Shot = 'open' | 'gaze' | 'hand' | 'turn' | 'wall' | 'print' | 'ages' | 'visitor' | 'match' | 'sky';

/** A hand stenciled on the wall: the hand's outline is the mask, the pigment sprayed around it. */
interface Print { mask: V[]; center: V; radius: number; rgb: string; seed: number; at: number; alpha: number }

const ANCIENT: Palette = {
  skin: '#8e5a3b', skinFar: '#5c3726', skinLight: '#aa714a', skinDark: '#653b27', hair: '#1c120e', hairLight: '#3a2a20',
  cloth: '#a07a4a', clothFar: '#6d5232', clothLight: '#c4a57a', clothDark: '#553722', legs: '#8e5a3b', legsFar: '#5c3726', feet: '#5c3726',
  accent: '#b2402a', eye: '#2b1a10', rim: '#ffc27e', shade: 'rgba(28, 8, 6, 0.45)',
};
const HIKER: Palette = {
  skin: '#6c5043', skinFar: '#48352c', skinLight: '#80624f', skinDark: '#4c372d', hair: '#261d19', hairLight: '#3b2e27',
  cloth: '#2c4650', clothFar: '#1f3037', clothLight: '#3b5963', clothDark: '#18262c', legs: '#262c3f', legsFar: '#1b2030', feet: '#2a201a',
  accent: '#a8432d', eye: '#1e1510', rim: '#9fb4ea', shade: 'rgba(4, 6, 18, 0.5)',
};
const HAND = { size: 46, lengths: [1, 1, 1, 1] };
/** Where the first hand goes on the wall: wrist and the direction the fingers point. */
const PRESS = { wrist: { x: 1066, y: 618 }, angle: -1.28 };
const PIGMENTS = ['150, 38, 26', '150, 38, 26', '168, 52, 30', '128, 30, 24', '186, 92, 44', '226, 214, 192', '38, 26, 24', '196, 140, 64'];

export class HandsScene extends Stage {
  private readonly cam = new Camera(700, { width: W, height: H, stiffness: 7, damping: 5.5, handheld: 2.5, ease: 2.4 });
  private readonly sky: Sky = makeSky();
  private readonly fire = new Fire(FIRE, { seed: 3, width: 92, height: 150, sparks: 14 });
  private readonly spray = new Particles({ seed: 8, gravity: 20, drag: 3.2 });
  private readonly ancient = new Person(770, -1, GROUND, 'hide', ANCIENT, HAND);
  private readonly hiker = new Person(470, 1, GROUND, 'jacket', HIKER, HAND);
  private readonly a: Beats<AncientBeat>;
  private readonly v: Beats<VisitorBeat>;
  private readonly edit: Edit<Shot>;
  private readonly prints: Print[] = [];
  /** How much pigment has landed around the first hand (0…1). */
  private sprayed = 0;
  private first: Print | null = null;
  private turn = 0;
  private turnRate = 0;
  private lampOn = 0;
  private heat = 1;
  private prevT = 0;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 48, preroll: 1 });
    this.makePrints();
    const A = this.ancient, V = this.hiker, sky = { x: 470, y: 330 };
    const press = PRESS.wrist, handCenter = this.handCenter();

    this.a = new Beats<AncientBeat>('sit', {
      sit: { during: ({ since }) => { A.intent.facing = -1; A.intent.crouch = 70; A.intent.look = { x: FIRE.x, y: FIRE.y - 40 - since * 10 }; }, after: 2.3, then: 'gaze' },
      // Eyes follow a spark up out of the fire into the stars.
      gaze: { during: ({ since }) => { A.intent.facing = -1; A.intent.crouch = 70; A.intent.look = { x: lerp(FIRE.x, sky.x, easeInOut(clamp(since / 1.2))), y: lerp(FIRE.y - 80, sky.y, easeInOut(clamp(since / 1.2))) }; }, after: 1.3, then: 'rise' },
      rise: { during: ({ since }) => { A.intent.facing = -1; A.intent.crouch = 70 * (1 - ramp(since, 0, 1.1)); A.intent.look = sky; }, after: 1.2, then: 'reach' },
      reach: {
        during: ({ since }) => {
          A.intent.facing = -1; A.intent.look = sky;
          const sh = A.skel.point('upperN', 0), up = ramp(since, 0, 0.9);
          A.intent.reach = { x: sh.x - 60 - 40 * up, y: sh.y + 60 - 170 * up };
          A.intent.palmAngle = -2.05; A.intent.spread = 0.95;
          A.intent.curl = 0.55 * envelope(since, 1.5, 1.9, 2.2, 2.6);
        },
        after: 2.9, then: 'turn',
      },
      turn: { during: () => { A.intent.facing = 1; A.intent.look = { x: 1150, y: 520 }; }, after: 0.8, then: 'shadow' },
      // The fire throws the raised hand onto the rock, huge.
      shadow: {
        during: ({ since }) => {
          A.intent.facing = 1; A.intent.look = { x: 1100, y: 470 };
          const sh = A.skel.point('upperN', 0), up = ramp(since, 0.2, 1.0);
          A.intent.reach = { x: sh.x + 40 + 45 * up, y: sh.y + 70 - 80 * up };
          A.intent.palmAngle = -1.35 + Math.sin(since * 3) * 0.12; A.intent.spread = 0.6 + 0.35 * Math.abs(Math.sin(since * 2.2));
        },
        after: 2.3, then: 'walk',
      },
      walk: { during: () => { A.intent.facing = 1; A.intent.speed = 85; A.intent.look = { x: press.x + 30, y: press.y - 40 }; }, next: () => A.x >= 985 && 'press' },
      press: {
        during: () => { A.intent.facing = 1; A.intent.reach = press; A.intent.palmAngle = PRESS.angle; A.intent.spread = 0.95; A.intent.look = handCenter; },
        after: 1.0, then: 'blow',
      },
      blow: {
        enter: () => { this.first = { ...this.firstPrint(), mask: A.handPoly() }; this.prints.unshift(this.first); },
        during: ({ since }) => {
          A.intent.facing = 1; A.intent.reach = press; A.intent.palmAngle = PRESS.angle; A.intent.spread = 0.95; A.intent.look = handCenter;
          A.intent.hold = A.mouth;
          const puff = [0.45, 1.15, 1.85].reduce((s, p) => s + envelope(since, p, p + 0.07, p + 0.3, p + 0.45), 0);
          A.intent.blow = puff;
        },
        after: 2.6, then: 'lift',
      },
      lift: {
        during: ({ since }) => {
          A.intent.facing = 1; A.intent.look = handCenter;
          const off = ramp(since, 0.1, 1.0);
          A.intent.reach = { x: press.x - 50 * off, y: press.y + 30 * off };
          A.intent.palmAngle = PRESS.angle - 0.3 * off; A.intent.spread = 0.95 - 0.4 * off;
          A.intent.speed = since > 0.5 && since < 1.0 ? -40 : 0;
        },
        after: 1.2, then: 'behold',
      },
      behold: {
        during: ({ since }) => {
          A.intent.facing = 1; A.intent.look = handCenter;
          const near = envelope(since, 0.5, 1.2, 2.0, 2.6);
          if (near > 0.02) {
            A.intent.reach = { x: press.x - 22 + 8 * near, y: press.y + 50 - 44 * near };
            A.intent.palmAngle = PRESS.angle; A.intent.spread = 0.3 + 0.6 * near;
          }
        },
        after: 2.8, then: 'back',
      },
      back: { during: () => { A.intent.facing = -1; A.intent.speed = 80; A.intent.look = { x: FIRE.x, y: FIRE.y - 60 }; }, next: () => A.x <= 780 && 'rest' },
      rest: { during: ({ since }) => { A.intent.facing = -1; A.intent.crouch = 70 * ramp(since, 0, 0.8); A.intent.look = { x: FIRE.x, y: FIRE.y - 30 }; } },
    });

    this.v = new Beats<VisitorBeat>('wait', {
      wait: { next: ({ t }) => t >= 30.8 && 'enter' },
      // The lamp sweeps the wall and finds hand after hand.
      enter: {
        during: ({ since }) => {
          V.intent.facing = 1; V.intent.speed = 95 * ramp(since, 0, 0.4) * (1 - ramp(V.x, 880, 975) * 0.6);
          V.intent.look = { x: keys(since, [[0, 800], [1, 980], [2.2, 1330], [3.4, 1160], [4.6, handCenter.x]]), y: keys(since, [[0, 760], [1, 560], [2.2, 480], [3.4, 700], [4.6, handCenter.y]]) };
        },
        next: () => V.x >= 972 && 'arrive',
      },
      arrive: { during: () => { V.intent.look = handCenter; }, after: 0.5, then: 'raise' },
      // First beside the old hand, then slowly into it: it fits.
      raise: {
        during: ({ since }) => {
          V.intent.look = handCenter;
          const up = ramp(since, 0, 1.1), into = ramp(since, 1.9, 3.0);
          V.intent.reach = { x: lerp(press.x - 60, press.x - 34 + 34 * into, up), y: lerp(press.y + 70, press.y + 30 - 30 * into, up) };
          V.intent.palmAngle = PRESS.angle; V.intent.spread = lerp(0.4, 0.95, up);
        },
        after: 3.1, then: 'hover',
      },
      // A hand's breadth from the rock, over the one that was left there.
      hover: {
        during: () => { V.intent.look = handCenter; V.intent.reach = press; V.intent.palmAngle = PRESS.angle; V.intent.spread = 0.95; },
        after: 1.8, then: 'dark',
      },
      dark: {
        enter: () => this.cue('click'),
        during: ({ since }) => {
          const down = ramp(since, 0.3, 1.2);
          V.intent.look = { x: lerp(handCenter.x, 700, ramp(since, 0.8, 2)), y: lerp(handCenter.y, 200, ramp(since, 0.8, 2)) };
          if (down < 1) { V.intent.reach = { x: lerp(press.x, press.x - 60, down), y: lerp(press.y, press.y + 120, down) }; V.intent.palmAngle = PRESS.angle; V.intent.spread = 0.95 - down * 0.7; }
        },
        after: 1.6, then: 'up',
      },
      up: { during: () => { V.intent.look = { x: 700, y: 150 }; } },
    });

    const aim = (p: V, dx = 0, dy = 0) => ({ x: p.x + dx, y: p.y + dy });
    this.edit = new Edit<Shot>('open', {
      open: { frame: ({ since }) => ({ x: keys(since, [[0, 820], [3.2, 700]]), y: keys(since, [[0, -80], [3.4, 630]]), zoom: keys(since, [[0, 0.9], [3.4, 1.05]]), handheld: 2 }), next: () => this.a.reached('rise') && 'gaze' },
      gaze: { frame: () => ({ x: 690, y: 520, zoom: 1.6, handheld: 3 }), next: () => this.a.reached('reach') && this.a.since(this.time) > 1.1 && 'hand' },
      hand: { frame: () => ({ ...aim(A.wrist, -10, -12), zoom: 2.7, handheld: 3 }), next: () => this.a.reached('turn') && 'turn' },
      turn: { frame: ({ since }) => ({ x: 930 + since * 8, y: 560, zoom: 1.08, handheld: 2.5 }), next: () => this.a.reached('press') && 'wall' },
      wall: { frame: () => ({ x: 1010, y: 610, zoom: 2.15, handheld: 3 }), next: () => this.a.reached('lift') && this.a.since(this.time) > 0.35 && 'print' },
      print: { frame: ({ since }) => ({ x: handCenter.x - 30 - since * 6, y: handCenter.y + 10, zoom: 2.9 - since * 0.05, handheld: 2.5 }), next: () => this.a.reached('back') && this.a.since(this.time) > 0.3 && 'ages' },
      ages: { frame: ({ since }) => ({ x: 1000, y: 540 - since * 3, zoom: 0.92 + since * 0.006, handheld: 1.5 }), next: () => this.v.reached('enter') && 'visitor' },
      visitor: { frame: () => ({ x: clamp(V.x + 120, 700, 1060), y: 610, zoom: 1.45, handheld: 3 }), next: () => this.v.reached('raise') && this.v.since(this.time) > 0.8 && 'match' },
      match: { frame: ({ since }) => ({ x: handCenter.x - 20, y: handCenter.y + 20, zoom: 3.1 + since * 0.04, handheld: 2.5 }), next: () => this.v.reached('dark') && this.v.since(this.time) > 0.9 && 'sky' },
      sky: { frame: ({ since }) => { const u = easeInOut(clamp(since / 4.5)); return { x: lerp(900, 820, u), y: lerp(560, 190, u), zoom: lerp(1.1, 0.7, u), handheld: 2 }; }, cut: true },
    });
  }

  private handCenter(): V {
    return { x: PRESS.wrist.x + Math.cos(PRESS.angle) * HAND.size * 0.42, y: PRESS.wrist.y + Math.sin(PRESS.angle) * HAND.size * 0.42 };
  }

  private firstPrint(): Print {
    return { mask: [], center: this.handCenter(), radius: 70, rgb: PIGMENTS[0], seed: 1, at: Infinity, alpha: 1 };
  }

  /** The hands left over the ages: spread around the first one, never on top of it, children's among them. */
  private makePrints(): void {
    const r = rng(99), c0 = this.handCenter(), taken: V[] = [c0];
    let n = 0;
    for (let tries = 0; tries < 900 && n < 38; tries++) {
      const c = { x: 900 + r() * 700, y: 380 + r() * 420 };
      if (c.y > 860 - (c.x - 900) * 0.02 || taken.some(q => Math.hypot(q.x - c.x, q.y - c.y) < 66)) continue;
      // Stay on the rock, clear of its edge.
      if (!inside(WALL, c) || !inside(WALL, { x: c.x - 60, y: c.y }) || !inside(WALL, { x: c.x, y: c.y - 70 })) continue;
      const size = HAND.size * (r() < 0.2 ? 0.6 + r() * 0.12 : 0.85 + r() * 0.22);
      const angle = -Math.PI / 2 + (r() - 0.5) * 1.1, side: 1 | -1 = r() < 0.8 ? 1 : -1;
      const shape = handOutline({ size, spread: 0.6 + r() * 0.4, side, lengths: [0.9 + r() * 0.2, 0.9 + r() * 0.2, 0.9 + r() * 0.2, 0.9 + r() * 0.2] });
      const wrist = { x: c.x - Math.cos(angle) * size * 0.42, y: c.y - Math.sin(angle) * size * 0.42 };
      const at = 23 + 6.2 * (n / 37) ** 0.85 + (r() - 0.5) * 0.25;
      this.prints.push({ mask: placeHand(shape, wrist, angle), center: c, radius: size * 1.45, rgb: PIGMENTS[Math.floor(r() * PIGMENTS.length)], seed: 10 + n, at, alpha: 0.7 + r() * 0.25 });
      taken.push(c); n++;
    }
  }

  protected start(): void {
    this.edit.update(0, 0);
    this.edit.apply(this.cam, 0, 0);
  }

  protected update(t: number, dt: number): void {
    const A = this.ancient, V = this.hiker;
    A.rest(); V.rest();
    if (!this.settling) { this.a.update(t, dt); this.v.update(t, dt); this.edit.update(t, dt); }
    else { A.intent.facing = -1; A.intent.crouch = 70; A.intent.look = { x: FIRE.x, y: FIRE.y - 40 }; }
    A.update(dt, t);
    if (this.v.reached('enter')) V.update(dt, t);

    // Pigment: each puff through the pipe sprays toward the hand; what lands builds up around it.
    const blow = this.a.current === 'blow' ? A.intent.blow : 0;
    if (blow > 0.3) {
      const from = A.pipeTip, c = this.handCenter(), ang = Math.atan2(c.y - from.y, c.x - from.x);
      this.spray.emit(from, Math.ceil(blow * 5), { angle: ang, spread: 0.9, speed: [120, 300], life: [0.2, 0.5], size: [1.5, 4.5] });
      this.sprayed = Math.min(1, this.sprayed + dt * blow * 0.95);
    }
    if (blow > 0.3 && this.prevBlow <= 0.3) this.cue('puff', { gain: 1, pan: 0.15 });
    this.prevBlow = blow;
    this.spray.update(dt);
    for (const p of this.prints) if (p.at > this.prevT && p.at <= t) this.cue('far', { gain: 0.5 + (p.seed % 5) * 0.08, pan: (p.center.x - 1100) / 900 });

    // The sky: nearly still, then wheeling through the ages, then still again.
    this.turnRate = 0.0035 + 1.15 * envelope(t, 22.6, 24.6, 28.6, 30.4);
    this.turn += this.turnRate * dt;

    // Fire: steady, then many fires over the ages (bright, low, out), then only cold ash.
    const ages = envelope(t, 22.4, 23.2, 29.6, 30.6);
    const nights = 0.45 + 0.55 * Math.max(0, noise1(t * 3.1, 17));
    const live = (1 - ramp(t, 29.6, 30.6)) * lerp(1, nights, ages);
    this.fire.update(dt, t, live * (1 + 0.1 * noise1(t * 0.7, 4)), 0.08 + noise1(t * 0.4, 9) * 0.15);
    this.heat = this.fire.heat;
    this.level('fire', this.fire.heat);
    this.level('ages', this.turnRate);

    this.lampOn = this.v.reached('enter') && !this.v.reached('dark') ? Math.min(1, this.lampOn + dt * 8) : this.v.reached('dark') && this.v.since(t) > 0 ? Math.max(0, this.lampOn - dt * 10) : this.lampOn;
    for (const person of [A, V]) if (person.consumeStep()) this.cue('step', { gain: person === A ? 0.7 : 0.9, pan: (person.x - 900) / 1000 });
    this.prevT = t;
  }

  private prevBlow = 0;

  protected lateUpdate(t: number, dt: number): void {
    if (this.settling) return;
    this.edit.apply(this.cam, t, dt);
  }

  probe(): Record<string, unknown> {
    const A = this.ancient, V = this.hiker;
    return {
      ...super.probe(), a: this.a.current, v: this.v.current, shot: this.edit.current,
      ancient: { x: Math.round(A.x), wrist: rnd(A.wrist), head: rnd(A.head) }, hiker: { x: Math.round(V.x), wrist: rnd(V.wrist) },
      sprayed: +this.sprayed.toFixed(2), prints: this.prints.filter(p => p.at <= this.time).length, of: this.prints.length,
      turn: +this.turn.toFixed(2), heat: +this.heat.toFixed(2), lamp: +this.lampOn.toFixed(2), zoom: +this.cam.zoom.toFixed(2),
      beats: this.a.history.map(b => `${b.beat}@${b.at.toFixed(1)}`).join(' '), vbeats: this.v.history.map(b => `${b.beat}@${b.at.toFixed(1)}`).join(' '),
      shots: this.edit.history.map(b => `${b.beat}@${b.at.toFixed(1)}`).join(' '),
    };
  }

  protected draw(t: number, frame: number): void {
    const { ctx, paper, cam } = this, A = this.ancient, V = this.hiker;
    const lens = cam.zoom ** -0.55;
    A.lens = V.lens = lens;
    const city = ramp(t, 28.2, 31), wash_ = 0.08 + 0.3 * city - 0.26 * ramp(t, this.darkAt() + 0.6, this.darkAt() + 3);
    const shot = this.edit.current;
    // One light per shot: the fire until it dies, then starlight from above.
    const lit = this.heat > 0.15 ? Math.sign(A.x - FIRE.x) || 1 : 0;
    paper.light = (lit ? { x: lit, y: 0.28 } : { x: 0.25, y: 1 }) as Light;
    paper.edgeColor = 'rgba(255, 236, 214, 0.2)';

    fillGradient(ctx, [[0, '#04060f'], [0.45, '#0b1026'], [0.75, '#18203d'], [1, '#262a44']]);
    cam.layer(paper, DEPTH.stars, () => drawSky(ctx, this.sky, { turn: this.turn, trail: this.turnRate * 0.5, t, twinkle: 0.35, wash: Math.max(0, wash_) }));
    paper.edgeColor = 'rgba(200, 210, 255, 0.05)';
    cam.layer(paper, DEPTH.mesas, v => drawLand(paper, 'mesas', v, city));
    cam.layer(paper, DEPTH.canyon, v => drawLand(paper, 'canyon', v, city));
    cam.layer(paper, DEPTH.rim, v => drawLand(paper, 'rim', v, city));
    paper.edgeColor = 'rgba(255, 236, 214, 0.2)';

    cam.layer(paper, 1, v => {
      const ages = ramp(t, 23, 30);
      drawWall(paper, lens, 0.35 + 0.65 * ages, ages);
      const pctx = paper.context;
      for (const p of this.prints) {
        const amount = p === this.first ? this.sprayed : clamp((t - p.at) / 0.35);
        if (amount <= 0) continue;
        pctx.save(); pctx.globalAlpha = p.alpha;
        drawSpray(pctx, { seed: p.seed, center: p.center, radius: p.radius, rgb: p.rgb, amount, mask: p.mask, specks: 1600, opacity: 1 });
        pctx.restore();
      }
      // The fire throws the ancient's shadow on the rock: huge near the hearth, one with them at the wall.
      const fade = 1 - ramp(t, 22.6, 24);
      if (fade > 0 && this.heat > 0.05) {
        const grow = 1 + 0.95 * clamp((1000 - A.x) / 240);
        paper.clip(WALL, () => paper.castShadow({ x: FIRE.x, y: FIRE.y - 50 }, grow, () => A.drawSilhouette(paper), { alpha: (0.18 + 0.4 * clamp((1000 - A.x) / 160)) * fade * Math.min(1, this.heat), blur: 3 + grow * 2 }));
      }
      const lights = this.lights(t);
      darkness(paper, v, { rgb: '6, 8, 22', alpha: 0.86, lights, region: WALL });
      drawFloor(paper, lens);
      darkness(paper, v, { rgb: '6, 8, 22', alpha: 0.8, lights: lights.map(l => ({ ...l, aspect: 1 })), region: FLOOR });
      drawHearth(paper, this.heat, ramp(t, 29.6, 30.4) * (1 - ramp(t, 30.4, 31.2)) * 0.6 + this.heat * 0.4);

      if (fade > 0) {
        if (fade < 1) paper.layer(fade, () => A.draw(paper));
        else A.draw(paper);
      }
      if (this.v.reached('enter')) V.draw(paper);
      this.fire.draw(paper);
      // The breath of pigment: a soft cloud between the pipe and the hand, and the specks in it.
      const puff = this.a.current === 'blow' ? A.intent.blow : 0;
      if (puff > 0.05) {
        const a = A.pipeTip, b = this.handCenter(), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const g = pctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 60);
        g.addColorStop(0, `rgba(190, 60, 36, ${0.35 * Math.min(1, puff)})`); g.addColorStop(1, 'rgba(190, 60, 36, 0)');
        pctx.fillStyle = g; pctx.fillRect(m.x - 60, m.y - 60, 120, 120);
      }
      this.spray.draw((s, u) => {
        pctx.save(); pctx.globalAlpha = (1 - u) * 0.9;
        pctx.fillStyle = u < 0.3 ? 'rgb(214, 86, 52)' : 'rgb(176, 50, 32)'; pctx.beginPath(); pctx.arc(s.x, s.y, s.size * 0.7, 0, Math.PI * 2); pctx.fill(); pctx.restore();
      });
      this.fire.glow(paper, 520);
      this.beam(paper);
      void v;
    });
    if (shot === 'turn' || shot === 'ages' || shot === 'visitor' || shot === 'open') paper.layer(1, () => cam.layer(paper, 1.35, v => drawForeground(paper, v)), 'source-over', 'blur(5px)');

    vignette(ctx, [2, 3, 10], 0.55, 0.4);
    this.captions(t);
    grain(ctx, frame, 0.07);
    wash(ctx, '#000', 1 - ramp(t, 0, 1.2));
    wash(ctx, '#000', ramp(t, this.duration - 1.6, this.duration - 0.1));
  }

  /** The time the lamp goes off, or ∞ before it does. */
  private darkAt(): number { return this.v.startOf('dark') ?? Infinity; }

  private lights(t: number): Glow[] {
    const f = this.heat, flick = 1 + 0.06 * noise1(t * 9, 2);
    const out: Glow[] = [{ at: { x: FIRE.x + 40, y: FIRE.y - 80 }, radius: 1080 * (0.5 + 0.5 * f) * flick, strength: Math.min(1, f * 1.05), core: 0.1 }];
    const spot = this.spot();
    if (spot && this.lampOn > 0) out.push({ at: spot, radius: 190, strength: this.lampOn, core: 0.25, aspect: 1.1 });
    return out;
  }

  /** Where the headlamp lands on the rock. */
  private spot(): V | null {
    const look = this.hiker.intent.look;
    return look && inside(WALL, look) ? look : null;
  }

  private beam(paper: Stage['paper']): void {
    if (this.lampOn <= 0) return;
    const lamp = this.hiker.lamp, spot = this.spot() ?? { x: lamp.at.x + Math.cos(lamp.angle) * 400, y: lamp.at.y + Math.sin(lamp.angle) * 400 };
    const c = paper.context, d = Math.hypot(spot.x - lamp.at.x, spot.y - lamp.at.y) || 1, n = { x: -(spot.y - lamp.at.y) / d, y: (spot.x - lamp.at.x) / d };
    paper.layer(this.lampOn * Math.min(1, 1.6 / this.cam.zoom), () => {
      const g = c.createLinearGradient(lamp.at.x, lamp.at.y, spot.x, spot.y);
      g.addColorStop(0, 'rgba(255, 246, 220, 0.17)');
      g.addColorStop(1, 'rgba(255, 246, 220, 0.03)');
      const pc = paper.context;
      pc.fillStyle = g;
      pc.beginPath(); pc.moveTo(lamp.at.x, lamp.at.y); pc.lineTo(spot.x + n.x * 120, spot.y + n.y * 120); pc.lineTo(spot.x - n.x * 120, spot.y - n.y * 120); pc.closePath(); pc.fill();
      const s = pc.createRadialGradient(lamp.at.x, lamp.at.y, 0, lamp.at.x, lamp.at.y, 14);
      s.addColorStop(0, 'rgba(255, 252, 235, 1)'); s.addColorStop(1, 'rgba(255, 252, 235, 0)');
      pc.fillStyle = s; pc.fillRect(lamp.at.x - 14, lamp.at.y - 14, 28, 28);
    }, 'screen');
  }

  private captions(t: number): void {
    const { ctx } = this;
    caption(ctx, 'Patagonia, hace 9.300 años', { alpha: envelope(t, 1.2, 2.2, 4.2, 5.2), y: 110, font: '300 34px Montserrat, sans-serif', color: '#e9dcc8' });
    const u = ramp(t, 23.2, 30.2), years = Math.round(9300 * (1 - easeInOut(u)) / 50) * 50;
    const label = years > 0 ? `hace ${years.toLocaleString('es-AR')} años` : 'hoy';
    caption(ctx, label, { alpha: envelope(t, 22.6, 23.2, 31.4, 32.4), y: 110, font: '300 34px Montserrat, sans-serif', color: '#e9dcc8' });
    const end = this.darkAt() + 2.4;
    caption(ctx, 'Aquí estuvimos.', { alpha: Number.isFinite(end) ? envelope(t, end, end + 1.4, 60, 61) : 0, y: 330, font: '300 72px Montserrat, sans-serif', color: '#f3e7d2', glow: 'rgba(0, 0, 10, 0.8)' });
  }

  soundtrack(sampleRate: number) {
    const vt = (t: number | undefined) => this.videoTime(t ?? this.duration);
    return score(this, sampleRate, {
      reach: vt(this.a.startOf('reach')), lift: vt(this.a.startOf('lift')), ages: vt(22.6), agesEnd: vt(30.4),
      visitor: vt(this.v.startOf('enter')), fit: vt((this.v.startOf('raise') ?? this.duration) + 2.4), dark: vt(this.v.startOf('dark')),
    });
  }
}


const rnd = (p: V) => ({ x: Math.round(p.x), y: Math.round(p.y) });

function inside(poly: V[], p: V): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
