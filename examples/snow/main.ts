import {
  Beats, Camera, type CueOpts, Edit, Leap, type Stereo, type Mark, Particles, type PropSet, type RidgeSpec, Roller, type SnowSpec, Stage, Tracks, type V, type View,
  circlePoly, clamp, drawProps, drawRidge, drawSnow, easeInOut, envelope, fillGradient, grade, grain, hash, lerp, letterbox, ramp,
  ridgeHeight, scatter, smoothstep, speedRamp, vignette, wash,
} from '../../src';
import { Clawd } from './Clawd';
import { SnowTree, cottage, snowyPine, stalk } from './props';
import { scoreSnow } from './sound';

const W = 1920, H = 1080;

/** The hill: a plateau, a long slope, and a flat bottom by the tree and the lamp. */
const TOP = 800, BOTTOM = 1120, SLOPE_FROM = 1250, SLOPE_TO = 2450;
const ground = (x: number): number => {
  if (x < SLOPE_FROM) return TOP + Math.sin(x * 0.004) * 5;
  if (x > SLOPE_TO) return BOTTOM + Math.sin(x * 0.005) * 4;
  return lerp(TOP + Math.sin(SLOPE_FROM * 0.004) * 5, BOTTOM + Math.sin(SLOPE_TO * 0.005) * 4, easeInOut((x - SLOPE_FROM) / (SLOPE_TO - SLOPE_FROM)));
};

const TREE_X = 3150, LAMP_X = 2600, START_X = 430, STOP_X = 880;

const P = {
  snow: '#e9edf8',
  snowShade: '#c3cbe6',
  snowDeep: '#aab4d8',
  trail: 'rgba(96, 110, 170, 0.34)',
  trailLip: 'rgba(255, 255, 255, 0.55)',
  moonRim: '#cfdcff',
  lampRim: '#ffd69a',
};

type Beat = 'enter' | 'flake' | 'giggle' | 'scoop' | 'push' | 'oops' | 'chase' | 'arrive' | 'lookUp' | 'buried' | 'popOut' | 'eye' | 'hop' | 'top';
type Shot = 'wide' | 'close' | 'push' | 'oops' | 'chase' | 'bottom' | 'finale';

const FLAKE_FALL = 1.7;

/**
 * "First snow": Clawd meets the first flake of the winter, rolls a snowball that grows until it gets
 * away down the hill, gets buried by the tree it crashes into, and ends up as the head of a snowman.
 */
export class SnowScene extends Stage {
  private readonly cam = new Camera(1150, { width: W, height: H, stiffness: 6, damping: 5, handheld: 3, ease: 2.4 });
  private readonly clawd = new Clawd(START_X, ground(START_X));
  private ball: Roller | null = null;
  private readonly tree = new SnowTree(TREE_X, BOTTOM + Math.sin(TREE_X * 0.005) * 4, 11);
  private readonly tracks = new Tracks({ capacity: 3000, spacing: 14 });
  private readonly furrow = new Tracks({ capacity: 3000, spacing: 5 });
  private readonly puff = new Particles({ seed: 5, gravity: 900, drag: 2.2, floor: x => ground(x) + 4 });
  private readonly beats: Beats<Beat>;
  private readonly edit: Edit<Shot>;
  private readonly stalks: PropSet;
  private readonly far: PropSet;
  private readonly village: PropSet;
  private readonly near: PropSet;
  /** The crystal that lands on Clawd, relative to its top, and when it leaves. */
  private flake: V = { x: 0, y: 0 };
  private flakeGone = -Infinity;
  private crashAt = -Infinity;
  /** The clump that falls from the branch: height and speed, or null. */
  private clump: { x: number; y: number; vy: number } | null = null;
  private bury = 0;
  /** Twigs knocked off by the crash: they fall and stick into the ball as a snowman's arms. */
  private twigs: { leap: Leap; side: 1 | -1; spin: number }[] = [];
  private onBall = false;
  private flakeLanded = false;
  private cheered = false;
  private lastStep = -1;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 28, preroll: 0.6, rate: speedRamp([{ from: 16.12, to: 16.6, rate: 0.35 }]) });
    this.paper.light = { x: 0.7, y: 0.65 };
    this.world.ground = ground;
    const c = this.clawd, cam = this.cam;
    c.floor = (x, y) => (this.onBall && this.ball ? this.ball.center.y - this.ball.r + 6 : this.world.floorBelow(x, y));

    this.stalks = scatter({
      seed: 21, from: -400, to: 3900, spacing: [70, 190], ground, flex: 0.6,
      makers: [{ make: stalk({ colors: ['#7d6f7c', '#8c7d77', '#675c70'], height: [22, 48] }), weight: 1 }],
      avoid: [[STOP_X - 60, STOP_X + 220], [2700, 3250]],
    });
    const ridgeFar: RidgeSpec = { seed: 3, base: 560, amp: 70, freq: 0.0025, color: '#8f9acb', tear: 3, bands: [{ offset: 90, color: '#7f8bbd', amp: 30 }] };
    const ridgeMid: RidgeSpec = { seed: 8, base: 690, amp: 40, freq: 0.004, color: '#aab3d9', tear: 2.5 };
    const ridgeNear: RidgeSpec = { seed: 13, base: 830, amp: 45, freq: 0.003, color: '#c7cee8', tear: 2 };
    this.ridges = [ridgeFar, ridgeMid, ridgeNear];
    this.far = scatter({
      seed: 31, from: cam.toLayer(-800, 0.32), to: cam.toLayer(4200, 0.32), spacing: [26, 70], ground: x => this.ridgeY(ridgeMid, x) + 6,
      makers: [{ make: snowyPine({ height: [70, 120], width: [40, 60], colors: ['#65709e', '#5c6794'], snow: '#c9d1ec' }), weight: 1 }],
      avoid: [[cam.toLayer(2750, 0.32), cam.toLayer(3350, 0.32)]],
    });
    this.village = scatter({
      seed: 41, from: cam.toLayer(2750, 0.32), to: cam.toLayer(3350, 0.32), spacing: [110, 150], ground: x => this.ridgeY(ridgeMid, x) + 10,
      makers: [{ make: cottage({ colors: ['#6d6a95', '#7a7098', '#636390'], roof: '#4e4a74', snow: '#dfe4f6', window: '#ffcf7a' }), weight: 1 }],
    });
    this.near = scatter({
      seed: 51, from: cam.toLayer(-800, 0.6), to: cam.toLayer(4300, 0.6), spacing: [90, 260], ground: x => this.ridgeY(ridgeNear, x) + 8,
      makers: [{ make: snowyPine({ height: [150, 230], width: [80, 120], colors: ['#46507c', '#3e4873'], snow: '#dde3f5' }), weight: 1 }],
      avoid: [[cam.toLayer(900, 0.6), cam.toLayer(1300, 0.6)]],
    });

    this.beats = new Beats<Beat>('enter', {
      enter: { during: () => { c.intent.speed = 140; c.intent.facing = 1; }, next: () => c.root.x >= STOP_X && 'flake' },
      flake: {
        enter: () => { this.flake = { x: 70, y: -330 }; },
        during: ({ since }) => {
          const u = clamp(since / FLAKE_FALL);
          this.flake = { x: lerp(70, 6, easeInOut(u)) + Math.sin(since * 4.2) * 26 * (1 - u), y: lerp(-330, -4, u) };
          c.intent.look = { x: c.top.x + this.flake.x, y: c.top.y + this.flake.y };
          c.intent.surprise = 0.5 * ramp(since, 0.2, 0.6);
          if (since >= FLAKE_FALL && !this.flakeLanded) { this.flakeLanded = true; this.cueAt('sparkle', c.top.x); }
          c.intent.lids = 1 - 0.9 * smoothstep(FLAKE_FALL - 0.15, FLAKE_FALL, since) * (1 - smoothstep(FLAKE_FALL + 0.15, FLAKE_FALL + 0.3, since));
        },
        after: FLAKE_FALL + 0.55, then: 'giggle',
      },
      giggle: {
        enter: () => { c.jolt(3); this.flakeGone = this.time; this.cueAt('giggle', c.root.x); },
        during: ({ since }) => { c.intent.happy = 1; c.intent.shake = since < 0.35 ? 0.7 : 0; },
        after: 1.4, then: 'scoop',
      },
      scoop: {
        during: ({ since }) => { c.intent.crouch = ramp(since, 0, 0.3) * (1 - ramp(since, 0.65, 0.85)); c.intent.look = { x: c.root.x + 120, y: c.root.y }; },
        next: ({ since }) => since > 0.7 && 'push',
        exit: () => {
          this.cueAt('pat', c.root.x + 80);
          this.ball = new Roller(c.root.x + 80, ground, { radius: 11, grow: 14, maxRadius: 104, friction: 0.5 });
          this.puff.emit({ x: c.root.x + 80, y: ground(c.root.x + 80) }, 10, { angle: -Math.PI / 2, spread: 1.6, speed: [60, 160], life: [0.4, 0.8], size: [2, 4] });
        },
      },
      push: {
        during: () => {
          const b = this.ball!;
          c.intent.facing = 1;
          c.intent.reach = 1;
          c.intent.crouch = 0.25 + 0.4 * clamp((b.r - 11) / 40);
          c.intent.speed = 150 * (1 - 0.3 * clamp((b.r - 11) / 40));
          c.intent.look = b.center;
          const gap = b.center.x - b.r - (c.root.x + 72);
          if (gap < 2) { b.x += 2 - gap; b.vx = Math.max(b.vx, c.speed); }
        },
        next: () => { const b = this.ball!; return b.center.x - b.r - (c.root.x + 72) > 60 && 'oops'; },
      },
      oops: {
        enter: () => { c.jolt(-4); this.cueAt('oops', c.root.x); },
        during: () => { c.intent.surprise = 1; c.intent.reach = 0.8; c.intent.look = this.ball!.center; },
        after: 0.8, then: 'chase',
      },
      chase: {
        during: () => { c.intent.speed = 330; c.intent.surprise = 0.7; },
        next: () => Number.isFinite(this.crashAt) && c.root.x >= this.ballStop - 30 && 'arrive',
      },
      arrive: {
        during: ({ since }) => { c.intent.look = { x: this.ball!.center.x, y: this.ball!.center.y - this.ball!.r * 0.6 }; c.intent.surprise = 1 - ramp(since, 0.3, 0.8); c.intent.happy = envelope(since, 0.7, 0.9, 1.3, 1.45); },
        after: 1.6, then: 'lookUp',
      },
      lookUp: {
        during: ({ since }) => {
          c.intent.look = { x: c.root.x - 20, y: c.top.y - 300 };
          c.intent.surprise = ramp(since, 0.35, 0.5);
          if (since > 0.25 && !this.clump) { this.clump = { x: c.root.x - 4, y: 760, vy: 0 }; this.cueAt('whoosh', c.root.x); }
        },
        next: () => this.bury > 0 && 'buried',
      },
      buried: {
        enter: () => this.puff.emit({ x: c.root.x, y: c.top.y }, 40, { angle: -Math.PI / 2, spread: 2.6, speed: [120, 380], life: [0.5, 1.1], size: [3, 7] }),
        during: () => { c.intent.lids = 0.4; },
        after: 1.3, then: 'popOut',
      },
      popOut: {
        enter: () => {
          this.bury = 0;
          c.jolt(-7);
          this.cueAt('poof', c.root.x);
          this.puff.emit({ x: c.root.x, y: c.top.y + 30 }, 60, { angle: -Math.PI / 2, spread: 3, speed: [160, 460], life: [0.6, 1.3], size: [3, 8] });
        },
        during: ({ since }) => { c.intent.shake = since < 0.5 ? 1 : 0; c.intent.happy = ramp(since, 0.5, 0.7); },
        after: 1.3, then: 'eye',
      },
      eye: {
        during: ({ since }) => {
          const b = this.ball!;
          c.intent.look = { x: b.center.x, y: b.center.y - b.r - 40 };
          c.intent.crouch = ramp(since, 0.5, 0.8);
        },
        after: 0.85, then: 'hop',
      },
      hop: {
        enter: () => { const b = this.ball!; c.hop({ x: b.center.x, y: b.center.y - b.r + 6 }, 90); this.cueAt('hop', c.root.x); },
        next: () => c.consumeLanding() && 'top',
      },
      top: {
        enter: () => {
          this.onBall = true;
          const b = this.ball!;
          this.cueAt('land', b.center.x);
          this.puff.emit({ x: b.center.x, y: b.center.y - b.r }, 16, { angle: -Math.PI / 2, spread: 2.6, speed: [60, 200], life: [0.4, 0.9], size: [2, 5] });
        },
        during: ({ since }) => { if (since > 0.75 && !this.cheered) { this.cheered = true; this.cueAt('yay', c.root.x); } c.intent.happy = ramp(since, 0.6, 0.9); c.intent.look = since < 0.6 ? { x: c.root.x + 200, y: c.head.y } : null; },
      },
    });

    const head = () => c.head;
    this.edit = new Edit<Shot>('wide', {
      wide: { frame: ({ since }) => ({ x: 1200 + since * 12, y: 640, zoom: 0.62 }), next: () => this.beats.reached('flake') && 'close' },
      close: { frame: () => ({ x: STOP_X + 40, y: c.top.y + 5, zoom: 2.8, handheld: 2 }), next: () => this.beats.reached('scoop') && 'push' },
      push: {
        frame: () => { const bx = this.ball?.center.x ?? c.root.x + 80; return { x: (c.root.x + bx) / 2 + 60, y: ground(c.root.x) - 150, zoom: 1.55 }; },
        next: () => this.beats.reached('oops') && 'oops',
      },
      oops: { frame: () => ({ x: head().x + 70, y: head().y - 10, zoom: 2.5, handheld: 4 }), next: () => this.beats.reached('chase') && 'chase' },
      chase: {
        frame: () => {
          const b = this.ball!, bx = Math.min(b.center.x, TREE_X - 200);
          return { x: bx - 180, y: ground(bx) - 230, zoom: 0.9, handheld: 9 };
        },
        next: () => this.beats.reached('arrive') && 'bottom',
      },
      bottom: { frame: ({ since }) => ({ x: 2930, y: 890, zoom: lerp(1.25, 1.4, ramp(since, 0, 6)), handheld: 3 }), next: () => this.beats.reached('top') && 'finale' },
      finale: { cut: false, frame: ({ since }) => ({ x: lerp(2980, 2860, ramp(since, 0.5, 5)), y: lerp(880, 780, ramp(since, 0.5, 5)), zoom: lerp(1.4, 0.72, ramp(since, 0.8, 5.5)), handheld: 2 }) },
    });
  }

  private readonly ridges: RidgeSpec[];

  /** Height of a ridge in its own layer (for planting props on it). */
  private ridgeY(s: RidgeSpec, x: number): number { return ridgeHeight(s, x); }

  /** Where a twig arm sticks into the ball's side (the ball has stopped by the time they land). */
  private twigAnchor(b: Roller, side: 1 | -1): V {
    const a = -Math.PI / 2 + side * 1.15, c = { x: TREE_X - 16 - b.r - 22, y: b.center.y };
    return { x: c.x + Math.cos(a) * b.r * 0.92, y: c.y + Math.sin(a) * b.r * 0.92 };
  }

  private drawTwigs(t: number): void {
    const b = this.ball;
    if (!b) return;
    for (const tw of this.twigs) {
      const age = t - this.crashAt, u = tw.leap.progress(age);
      const at = u < 1 ? tw.leap.at(age) : { x: b.center.x + Math.cos(-Math.PI / 2 + tw.side * 1.15) * b.r * 0.92, y: b.center.y + Math.sin(-Math.PI / 2 + tw.side * 1.15) * b.r * 0.92 };
      const rest = -Math.PI / 2 + tw.side * 1.15 + tw.side * 0.25;
      const a = u < 1 ? rest + tw.spin * (1 - u) : rest;
      const d = { x: Math.cos(a), y: Math.sin(a) }, L = 78;
      const tip = { x: at.x + d.x * L, y: at.y + d.y * L };
      const fork = { x: at.x + d.x * L * 0.62, y: at.y + d.y * L * 0.62 };
      const fa = a - tw.side * 0.7;
      this.paper.sheet({ shadow: 5, rim: { color: P.lampRim, width: 2 } }, () => {
        this.paper.tube([{ x: at.x - d.x * 10, y: at.y - d.y * 10 }, { x: (at.x + tip.x) / 2 + d.y * 4, y: (at.y + tip.y) / 2 - d.x * 4 }, tip], 7, 3, '#3a3452', { seed: tw.side > 0 ? 97 : 98, tear: 0.5 });
        this.paper.tube([fork, { x: fork.x + Math.cos(fa) * 26, y: fork.y + Math.sin(fa) * 26 }], 4, 2, '#3a3452', { seed: tw.side > 0 ? 99 : 100, tear: 0.4 });
      });
    }
  }

  /** Where the ball rests against the tree, minus room for Clawd. */
  private get ballStop(): number { const b = this.ball!; return b.center.x - b.r - 72; }

  protected start(): void { this.edit.update(0, 0); this.edit.apply(this.cam, 0, 0); }

  protected update(t: number, dt: number): void {
    const c = this.clawd;
    c.rest();
    if (!this.settling) {
      this.beats.update(t, dt);
      this.edit.update(t, dt);
    }
    c.update(dt);
    this.tree.update(dt);

    const b = this.ball;
    if (b) {
      const fast = Math.abs(b.vx);
      const settled = Number.isFinite(this.crashAt) && t > this.crashAt + 1.5;
      if (!settled) b.update(dt);
      if (Number.isFinite(this.crashAt)) b.vx *= Math.exp(-3 * dt);
      if (settled) b.vx = 0;
      if (b.wall(TREE_X - 16, 0.12)) {
        const hit = b.consumeImpact();
        this.crashAt = t;
        this.cueAt('crash', TREE_X, { gain: clamp(hit / 400, 0.4, 1.2), data: { speed: hit } });
        this.tree.hit(hit * 0.0022);
        this.tree.cover = 0.55;
        for (const side of [-1, 1] as const) {
          const from = { x: TREE_X - 40 - (side < 0 ? 140 : 40), y: BOTTOM - 380 + side * 30 };
          this.twigs.push({ leap: new Leap(from, this.twigAnchor(b, side), 40, 2200), side, spin: side * 5 });
        }
        const at = { x: TREE_X - 16, y: b.center.y };
        this.puff.emit(at, 70, { angle: Math.PI, spread: 2.4, speed: [150, 520], life: [0.6, 1.4], size: [3, 9] });
        this.puff.emit({ x: TREE_X - 60, y: BOTTOM - 330 }, 60, { angle: Math.PI / 2, spread: 2.2, speed: [20, 120], life: [1.2, 2.2], size: [2, 6] });
      }
      if (fast > 180 && hash(Math.floor(t * 60)) < 0.5) {
        this.puff.emit(b.contact, 2, { angle: -Math.PI / 2 - Math.sign(b.vx) * 0.9, spread: 0.9, speed: [40, 70 + fast * 0.25], life: [0.3, 0.7], size: [2, 4.5] });
      }
    }

    if (this.clump) {
      const k = this.clump;
      k.vy += 2400 * dt;
      k.y += k.vy * dt;
      if (k.y >= c.top.y - 20) { this.bury = 1; this.clump = null; c.jolt(8); this.cueAt('plop', c.root.x); }
    }
    this.puff.update(dt);
    if (b) { this.level('roll', Math.abs(b.vx)); this.level('size', b.r); }
  }

  /** A sound event at a world x, panned by where it is on screen. */
  private cueAt(name: string, x: number, o: CueOpts = {}): void {
    const sx = this.cam.toScreen({ x, y: ground(x) }).x;
    this.cue(name, { ...o, pan: clamp((sx - W / 2) / (W / 2), -1, 1) * 0.6 });
  }

  protected lateUpdate(t: number, dt: number): void {
    const c = this.clawd;
    this.edit.apply(this.cam, t, dt);
    if (this.settling) return;
    c.feet().forEach((f, k) => {
      if (f.down && !this.onBall && this.tracks.stamp({ x: f.x, y: f.y + 3 }, { rx: 6, ry: 2.4 }, t, `foot${k}`) && Math.abs(c.speed) > 20 && t - this.lastStep > 0.09) {
        this.lastStep = t;
        this.cueAt('step', f.x, { gain: clamp(Math.abs(c.speed) / 180, 0.35, 1), pitch: 0.9 + k * 0.07 });
      }
    });
    const b = this.ball;
    if (b) this.furrow.stamp({ x: b.contact.x, y: b.contact.y + 2 }, { rx: Math.max(5, b.r * 0.5), ry: 2.5 + b.r * 0.035, angle: b.slope }, t, 'ball');
  }

  soundtrack(sampleRate: number): Stereo {
    const mark = (b: Beat) => { const at = this.beats.startOf(b); return at === undefined ? Infinity : this.videoTime(at); };
    return scoreSnow({
      log: this.sound, sampleRate, length: this.videoLength,
      video: t => this.videoTime(t), scene: v => this.sceneTime(v), rate: t => this.rateAt(t),
      marks: { push: mark('push'), oops: mark('oops'), crash: Number.isFinite(this.crashAt) ? this.videoTime(this.crashAt) : Infinity, popOut: mark('popOut'), top: mark('top') },
    });
  }

  probe(): Record<string, unknown> {
    const b = this.ball, c = this.clawd;
    return {
      ...super.probe(),
      beat: this.beats.current, shot: this.edit.current,
      clawd: [Math.round(c.root.x), Math.round(c.root.y)], speed: Math.round(c.speed),
      ball: b && { x: Math.round(b.center.x), y: Math.round(b.center.y), r: +b.r.toFixed(1), vx: Math.round(b.vx) },
      crash: Number.isFinite(this.crashAt) ? +this.crashAt.toFixed(2) : null,
      bury: this.bury, cam: [Math.round(this.cam.x), +this.cam.zoom.toFixed(2)], puff: this.puff.list.length,
      beats: this.beats.history.map(h => `${h.beat}@${h.at.toFixed(2)}`).join(' '),
      shots: this.edit.history.map(h => `${h.beat}@${h.at.toFixed(2)}`).join(' '),
    };
  }

  protected draw(t: number, frame: number): void {
    const { ctx, paper, cam } = this;
    const c = this.clawd;
    c.lens = cam.zoom ** -0.55;
    const warm = smoothstep(2250, 2600, c.root.x);
    c.rim = warm > 0.5 ? P.lampRim : P.moonRim;

    fillGradient(ctx, [[0, '#121936'], [0.38, '#26325f'], [0.7, '#5b6599'], [1, '#a598c0']]);
    this.drawSky(t);
    paper.edgeColor = 'rgba(255, 255, 255, 0.1)';
    cam.layer(paper, 0.12, v => drawRidge(paper, this.ridges[0], v.from, v.to, v.bottom + 400));
    cam.layer(paper, 0.2, v => this.snow(v, t, SNOW_FAR));
    cam.layer(paper, 0.32, v => {
      drawRidge(paper, this.ridges[1], v.from, v.to, v.bottom + 400);
      drawProps(paper, this.far, v.from, v.to, () => 0, t);
      drawProps(paper, this.village, v.from, v.to, () => 0, t);
      this.windowGlow(v);
    });
    this.mist(0.28);
    cam.layer(paper, 0.6, v => {
      drawRidge(paper, this.ridges[2], v.from, v.to, v.bottom + 400);
      drawProps(paper, this.near, v.from, v.to, () => 15, t);
    });
    this.mist(0.16);
    paper.edgeColor = 'rgba(255, 250, 240, 0.3)';
    cam.layer(paper, 0.7, v => this.snow(v, t, SNOW_MID));

    cam.layer(paper, 1, v => {
      this.drawGround(v);
      this.drawLampGlowOnSnow();
      this.tracks.draw(v.from, v.to, t, m => this.drawPrint(m));
      this.furrow.draw(v.from, v.to, t, m => this.drawFurrow(m));
      const pushers: V[] = c.feet().map(f => ({ x: f.x, y: f.y }));
      if (this.ball) pushers.push(this.ball.contact);
      drawProps(paper, this.stalks, v.from, v.to, () => 10, t, pushers);
      this.drawLamp(t);
      this.tree.draw(paper, P.lampRim);
      if (this.ball) this.drawBall(this.ball);
      this.drawTwigs(t);
      c.draw(paper);
      this.drawFlake(t);
      this.drawClump();
      if (this.bury > 0) this.drawMound(t);
      this.drawPuff();
      this.snow(v, t, SNOW_NEAR);
      this.lampFlakes(v, t);
    });
    cam.layer(paper, 1.5, v => paper.layer(0.8, () => this.snow(v, t, SNOW_FRONT), 'source-over', 'blur(3px)'));

    vignette(ctx, [8, 8, 30], 0.55, 0.5);
    grade(ctx, 'saturate(1.05) contrast(1.04)');
    grain(ctx, frame, 0.07);
    wash(ctx, '#05060f', 1 - ramp(t, 0, 0.9));
    wash(ctx, '#05060f', ramp(t, this.duration - 1.4, this.duration - 0.1));
    letterbox(ctx, 2.2);
  }

  // --- sky and far layers ---

  private drawSky(t: number): void {
    const { ctx, cam } = this;
    cam.layer(this.paper, 0.02, () => {
      for (let i = 0; i < 140; i++) {
        const x = hash(i * 3 + 1) * W * 1.4 - W * 0.2, y = hash(i * 3 + 2) * 520 - 60;
        const tw = 0.55 + 0.45 * Math.sin(t * (1 + hash(i) * 2) + i);
        ctx.fillStyle = `rgba(235, 240, 255, ${(0.25 + hash(i * 3 + 3) * 0.6) * tw})`;
        ctx.fillRect(x, y, 2, 2);
      }
    });
    cam.layer(this.paper, 0.04, () => {
      const m = { x: W * 0.24, y: 190 };
      const g = ctx.createRadialGradient(m.x, m.y, 30, m.x, m.y, 260);
      g.addColorStop(0, 'rgba(230, 236, 255, 0.35)');
      g.addColorStop(1, 'rgba(230, 236, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(m.x - 300, m.y - 300, 600, 600);
      this.paper.piece(circlePoly(m, 58, 40), '#f2efe3', { seed: 7, tear: 1.2, shadow: 0 });
      this.paper.piece([{ x: m.x - 22, y: m.y - 18 }, { x: m.x - 6, y: m.y - 24 }, { x: m.x + 2, y: m.y - 8 }, { x: m.x - 14, y: m.y }], 'rgba(200, 200, 215, 0.5)', { seed: 8, tear: 3, shadow: 0, edge: false });
      this.paper.piece(circlePoly({ x: m.x + 18, y: m.y + 20 }, 10, 12), 'rgba(200, 200, 215, 0.45)', { seed: 9, tear: 2, shadow: 0, edge: false });
    });
  }

  private windowGlow(v: View): void {
    const ctx = this.paper.context;
    this.paper.layer(0.9, () => {
      for (const p of this.village.props) {
        if (p.x < v.from - 100 || p.x > v.to + 100) continue;
        const g = ctx.createRadialGradient(p.x + 45, p.y - 35, 4, p.x + 45, p.y - 35, 90);
        g.addColorStop(0, 'rgba(255, 190, 100, 0.35)');
        g.addColorStop(1, 'rgba(255, 190, 100, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - 60, p.y - 140, 210, 200);
      }
    }, 'screen');
  }

  private mist(alpha: number): void {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, 'rgba(170, 170, 215, 0)');
    g.addColorStop(0.5, `rgba(170, 170, 215, ${alpha})`);
    g.addColorStop(1, `rgba(190, 190, 225, ${alpha * 0.4})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  private snow(v: View, t: number, s: SnowSpec): void { drawSnow(this.paper.context, s, v, t); }

  // --- the action plane ---

  private drawGround(v: View): void {
    const paper = this.paper, pts: V[] = [];
    for (let x = v.from - 40; x <= v.to + 40; x += 16) pts.push({ x, y: ground(x) - 2 });
    pts.push({ x: v.to + 40, y: v.bottom + 600 }, { x: v.from - 40, y: v.bottom + 600 });
    paper.sheet({ shadow: 14, rim: { color: '#ffffff', width: 5 }, anchor: { x: 0, y: 0 } }, () => {
      paper.piece(pts, P.snow, { seed: 70, tear: 2.5 });
      paper.inside(() => {
        // Depth under the surface: the snow gets bluer the further down the cut.
        const g = paper.context.createLinearGradient(0, TOP, 0, BOTTOM + 500);
        g.addColorStop(0, 'rgba(160, 172, 215, 0)');
        g.addColorStop(1, 'rgba(120, 132, 190, 0.55)');
        const band: V[] = [];
        for (let x = v.from - 40; x <= v.to + 40; x += 16) band.push({ x, y: ground(x) + 36 + Math.sin(x * 0.013) * 6 });
        band.push({ x: v.to + 40, y: v.bottom + 600 }, { x: v.from - 40, y: v.bottom + 600 });
        paper.piece(band, g, { seed: 71, tear: 3 });
      });
    });
  }

  private drawPrint(m: Mark): void {
    const ctx = this.paper.context;
    ctx.save();
    ctx.fillStyle = P.trail;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y - 0.6, m.rx, m.ry, m.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.trailLip;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y + m.ry * 0.7, m.rx * 0.9, m.ry * 0.45, m.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFurrow(m: Mark): void {
    const ctx = this.paper.context;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    ctx.fillStyle = 'rgba(110, 122, 180, 0.09)';
    ctx.beginPath();
    ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawLampGlowOnSnow(): void {
    const ctx = this.paper.context, y = ground(LAMP_X);
    this.paper.layer(1, () => {
      const g = ctx.createRadialGradient(LAMP_X, y, 10, LAMP_X, y, 420);
      g.addColorStop(0, 'rgba(255, 196, 120, 0.55)');
      g.addColorStop(1, 'rgba(255, 196, 120, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(LAMP_X, y + 10, 460, 70, 0, 0, Math.PI * 2);
      ctx.fill();
    }, 'soft-light');
  }

  private drawLamp(t: number): void {
    const paper = this.paper, ctx = paper.context, y = ground(LAMP_X), top = y - 360;
    paper.sheet({ shadow: 8, rim: { color: P.lampRim, width: 2.5 }, shade: { color: 'rgba(0, 0, 20, 0.35)', width: 6 } }, () => {
      paper.tube([{ x: LAMP_X, y: y + 8 }, { x: LAMP_X, y: top + 40 }], 13, 8, '#2b2a44', { seed: 80, tear: 0.5 });
      paper.piece([{ x: LAMP_X - 20, y: y + 8 }, { x: LAMP_X + 20, y: y + 8 }, { x: LAMP_X + 12, y: y - 30 }, { x: LAMP_X - 12, y: y - 30 }], '#2b2a44', { seed: 81, tear: 0.6 });
      paper.piece([{ x: LAMP_X - 28, y: top + 6 }, { x: LAMP_X + 28, y: top + 6 }, { x: LAMP_X, y: top - 22 }], '#2b2a44', { seed: 82, tear: 0.6 });
      paper.piece([{ x: LAMP_X - 17, y: top + 42 }, { x: LAMP_X + 17, y: top + 42 }, { x: LAMP_X + 22, y: top + 6 }, { x: LAMP_X - 22, y: top + 6 }], '#ffd68a', { seed: 83, tear: 0.5 });
      paper.inside(() => paper.line([{ x: LAMP_X, y: top + 8 }, { x: LAMP_X, y: top + 42 }], '#2b2a44', 3));
    });
    // Snow cap on the lantern's roof.
    paper.piece([{ x: LAMP_X - 30, y: top + 4 }, { x: LAMP_X - 12, y: top - 12 }, { x: LAMP_X, y: top - 27 }, { x: LAMP_X + 13, y: top - 11 }, { x: LAMP_X + 30, y: top + 4 }, { x: LAMP_X, y: top - 5 }], P.snow, { seed: 84, tear: 1.2, shadow: 3 });
    const flicker = 0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 7.1);
    paper.layer(1, () => {
      const g = ctx.createRadialGradient(LAMP_X, top + 24, 6, LAMP_X, top + 24, 300);
      g.addColorStop(0, `rgba(255, 214, 140, ${0.8 * flicker})`);
      g.addColorStop(0.25, `rgba(255, 180, 100, ${0.25 * flicker})`);
      g.addColorStop(1, 'rgba(255, 170, 90, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(LAMP_X - 300, top - 280, 600, 600);
    }, 'screen');
  }

  /** Flakes crossing the lamp's light glint warm. */
  private lampFlakes(v: View, t: number): void {
    const ctx = this.paper.context, top = ground(LAMP_X) - 336;
    if (v.to < LAMP_X - 400 || v.from > LAMP_X + 400) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(LAMP_X, top, 280, 0, Math.PI * 2);
    ctx.clip();
    drawSnow(ctx, { ...SNOW_NEAR, color: '#ffe2ae', alpha: [0.6, 1], seed: 77, density: 3 }, { from: LAMP_X - 300, to: LAMP_X + 300, top: top - 300, bottom: top + 300 }, t);
    ctx.restore();
  }

  private drawBall(b: Roller): void {
    const paper = this.paper, ctx = paper.context, c = b.center, r = b.r;
    const warm = smoothstep(2250, 2650, c.x);
    paper.sheet({ shadow: 10, rim: { color: warm > 0.5 ? P.lampRim : P.moonRim, width: Math.max(1.5, r * 0.07) }, shade: { color: 'rgba(70, 80, 150, 0.35)', width: r * 0.28 }, anchor: c }, () => {
      paper.piece(circlePoly(c, r, 44), P.snow, { seed: 90, tear: Math.max(0.8, r * 0.035) });
      paper.inside(() => {
        // Packed lumps turn with the ball, so it reads as rolling.
        for (let i = 0; i < 9; i++) {
          const a = b.angle + (i / 9) * Math.PI * 2 + hash(i + 5) * 0.4, d = r * (0.35 + hash(i + 9) * 0.55);
          const p = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d };
          ctx.save();
          ctx.fillStyle = i % 2 ? 'rgba(150, 162, 210, 0.3)' : 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r * 0.16, r * 0.07, a + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    });
  }

  private drawFlake(t: number): void {
    const c = this.clawd;
    if (!this.beats.reached('flake')) return;
    const gone = Number.isFinite(this.flakeGone) ? t - this.flakeGone : -1;
    if (gone > 0.9) return;
    const top = c.top;
    let p = { x: top.x + this.flake.x, y: top.y + this.flake.y }, alpha = 1;
    if (gone >= 0) { p = { x: p.x + gone * 90, y: p.y - 140 * gone + 260 * gone * gone }; alpha = 1 - gone / 0.9; }
    const ctx = this.paper.context, spin = this.beats.current === 'flake' ? t * 1.3 : 0.3 + gone * 6;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(spin);
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(180, 200, 255, 0.9)';
    ctx.shadowBlur = 5;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -13);
      ctx.moveTo(0, -6.5); ctx.lineTo(-3.8, -10);
      ctx.moveTo(0, -6.5); ctx.lineTo(3.8, -10);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawClump(): void {
    const k = this.clump;
    if (!k || this.bury > 0) return;
    this.paper.blob([{ x: k.x - 46, y: k.y }, { x: k.x - 30, y: k.y - 30 }, { x: k.x + 6, y: k.y - 38 }, { x: k.x + 44, y: k.y - 14 }, { x: k.x + 34, y: k.y + 16 }, { x: k.x - 20, y: k.y + 18 }], P.snow, { seed: 95, tear: 2, shadow: 8, rim: { color: P.lampRim, width: 3 } });
  }

  /** The heap Clawd is buried under; its eyes blink in a gap near the top. */
  private drawMound(t: number): void {
    const paper = this.paper, c = this.clawd, x = c.root.x, y = c.root.y;
    const since = this.beats.since(t), wob = Math.sin(since * 30) * 3 * ramp(since, 0.7, 1.2);
    paper.sheet({ shadow: 9, rim: { color: P.lampRim, width: 3.5 }, shade: { color: 'rgba(70, 80, 150, 0.35)', width: 16 }, anchor: { x, y } }, () => {
      paper.blob([
        { x: x - 92, y: y + 4 }, { x: x - 70, y: y - 70 }, { x: x - 30 + wob, y: y - 128 }, { x: x + 18 + wob, y: y - 138 },
        { x: x + 64, y: y - 92 }, { x: x + 94, y: y + 4 }, { x: x, y: y + 12 },
      ], P.snow, { seed: 96, tear: 2.5 });
      paper.inside(() => {
        if (since > 0.5) {
          const ctx = paper.context, open = since > 1.0 ? 1 : 0.2;
          ctx.fillStyle = '#231612';
          for (const s of [-1, 1]) ctx.fillRect(x + s * 16 - 5 + 6, y - 96 + 18 * (1 - open), 10, 20 * open);
        }
      });
    });
  }

  private drawPuff(): void {
    const ctx = this.paper.context;
    ctx.save();
    this.puff.draw((p, u) => {
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.fillStyle = p.seed < 0.3 ? '#dfe5f7' : '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - u * 0.4), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}

const SNOW_FAR: SnowSpec = { seed: 1, density: 3, period: 0.9, speed: [22, 34], drift: 8, sway: 8, swayRate: 0.3, size: [0.8, 1.6], color: '#e8ecff', alpha: [0.35, 0.7] };
const SNOW_MID: SnowSpec = { seed: 2, density: 2.2, period: 1.0, speed: [40, 60], drift: 14, sway: 14, swayRate: 0.35, size: [1.4, 2.6], color: '#f0f3ff', alpha: [0.5, 0.85] };
const SNOW_NEAR: SnowSpec = { seed: 3, density: 1.2, period: 1.3, speed: [60, 90], drift: 20, sway: 20, swayRate: 0.4, size: [2.2, 4], color: '#ffffff', alpha: [0.6, 0.95] };
const SNOW_FRONT: SnowSpec = { seed: 4, density: 0.35, period: 2.2, speed: [110, 150], drift: 30, sway: 30, swayRate: 0.3, size: [6, 10], color: '#ffffff', alpha: [0.35, 0.6] };
