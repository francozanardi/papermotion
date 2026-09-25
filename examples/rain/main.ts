/**
 * "Lluvia" — a woman runs through a storm toward a far light: the bus stop where someone is about to
 * leave. She trips on the fence line and goes down in the mud, gets up and keeps going, limping, then
 * running again. The bus overtakes her and
 * soaks her. At the stop the traveller is about to board, turns, and she throws herself into their arms.
 * The umbrella goes flying and the bus leaves without them.
 *
 * Content only: set, cast, the beats of each actor and the edit.
 */
import {
  type V, Beats, Camera, Edit, Particles, Stage, blink, drawDrips, drawProps, drawRain, drawRidge,
  envelope, grade, grain, keys, lerp, letterbox, noise1, ramp, speedRamp, vignette, wash,
} from '../../src';
import { BUS_LENGTH, DOOR_FROM_FRONT, Bus } from './Bus';
import { HEAD_R, PERSON_REST, type PersonLook, Person } from './Person';
import { Suitcase, Umbrella } from './props';
import {
  G, HILLS, LAYERS, drawBolt, drawFence, drawGround, drawLampLight, drawPoles, drawSky, drawStop, ground, lampCone,
} from './set';

const W = 1920, H = 1080;

/** Slow motion (scene seconds): the stumble and fall, and the leap into their arms. */
const SLOW = [{ from: 5.02, to: 5.5, rate: 0.35 }, { from: 17.0, to: 17.45, rate: 0.45 }];

// ── Where things are ───────────────────────────────────────
const TRIP_X = 2860;
const TRAVELLER_X = 6300;
const LAMP_X = TRAVELLER_X - 190;
const SIGN_X = TRAVELLER_X + 330;
/** The bus stops with its door here, a couple of steps to the traveller's right. */
const DOOR_X = TRAVELLER_X + 170;

// ── Cast ───────────────────────────────────────────────────
const HER: PersonLook = {
  skin: '#c9c5c1', skinShade: '#a9a5a2', lip: '#8f8784', ink: '#101010', iris: '#5b5b5b', sclera: '#e4e2de',
  hair: {
    palette: ['#0c0c0d', '#151516', '#1f1f21'], sheen: '#77777c', density: 3, jitter: { angle: 10, length: 0.25, width: 0.2 },
    locks: [
      { angle: -170, length: 70, width: 15, comb: -60, curl: -8, layer: 'under', tone: 0 },
      { angle: -135, length: 104, width: 17, comb: -95, curl: -9, layer: 'under', tone: 1 },
      { angle: -105, length: 112, width: 15, comb: -125, curl: -8, layer: 'over', tone: 1 },
      { angle: -80, length: 84, width: 12, comb: -150, curl: -10, layer: 'over', tone: 2 },
      { angle: -150, length: 90, width: 13, comb: -70, curl: -6, layer: 'over', tone: 2, inset: 0.95 },
    ],
  },
  hairCap: '#141415',
  coat: '#8b8b8a', coatBack: '#5d5d5c', coatDetail: 'rgba(40, 40, 40, 0.45)', coatLength: 0.72,
  trousers: '#3a3a3b', trousersBack: '#262627', boot: '#161616',
  rim: '#f2f2ee', shade: 'rgba(0, 0, 0, 0.42)', mud: '#2a2724', mudDeep: '#1b1917',
  scarf: { base: '#dcdcd8', stripe: '#9b9b97' },
};
const THEM: PersonLook = {
  skin: '#bcb7b1', skinShade: '#9e9994', lip: '#86807b', ink: '#0e0e0e', iris: '#4a4a4a', sclera: '#dcdad6',
  hair: {
    palette: ['#1a1a1b', '#222224', '#2c2c2e'], sheen: '#6e6e72', density: 2, jitter: { angle: 8, length: 0.2, width: 0.2 },
    locks: [{ angle: -160, length: 20, width: 12, comb: -50, curl: -5, layer: 'under', tone: 1 }],
  },
  hairCap: '#232325',
  coat: '#2c2c2e', coatBack: '#1c1c1d', coatDetail: 'rgba(120, 120, 120, 0.35)', coatLength: 0.95,
  trousers: '#1f1f20', trousersBack: '#151516', boot: '#0f0f0f',
  rim: '#e6e6e2', shade: 'rgba(0, 0, 0, 0.45)', mud: '#2a2724', mudDeep: '#1b1917',
  hat: { crown: '#161617', band: '#3a3a3b' },
};

type HerBeat = 'run' | 'tumble' | 'down' | 'rise' | 'limp' | 'run2' | 'shout' | 'leap' | 'hold';
type TheirBeat = 'wait' | 'board' | 'hesitate' | 'turn' | 'see' | 'caught';
type BusBeat = 'away' | 'drive' | 'brake' | 'stopped' | 'leave';
type Shot = 'wide' | 'track' | 'mud' | 'low' | 'stop' | 'shout' | 'turn' | 'embrace';

/** Per-shot look: depth of field on the background, and the direction the key light comes from. */
interface Look { blur: number; light: V; foreground: boolean }

export class RainScene extends Stage {
  private readonly her: Person;
  private readonly them: Person;
  private readonly bus: Bus;
  private readonly umbrella: Umbrella;
  private readonly suitcase: Suitcase;
  private readonly cam = new Camera(0, { width: W, height: H, stiffness: 5, damping: 4.4, handheld: 4, ease: 2.4 });
  private readonly herBeats: Beats<HerBeat>;
  private readonly theirBeats: Beats<TheirBeat>;
  private readonly busBeats: Beats<BusBeat>;
  private readonly edit: Edit<Shot>;
  private readonly mud = new Particles({ seed: 5, gravity: 1500, drag: 1.2, floor: ground });
  private readonly spray = new Particles({ seed: 6, gravity: 1400, drag: 0.8, floor: x => ground(x) + 30 });
  private readonly breath = new Particles({ seed: 7, gravity: -30, drag: 1.6 });
  private look: Look = { blur: 0, light: { x: -0.6, y: 0.8 }, foreground: false };
  private soaked = -Infinity;
  private hitAt = -Infinity;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 22.2, preroll: 0.8, rate: speedRamp(SLOW) });
    this.world.ground = x => ground(x) - 1;
    this.world.wind = (x, _y, t) => ({ x: -170 + noise1(t * 0.7 + x * 0.002, 3) * 120, y: 0 });
    this.her = new Person(this.world, 180, HER, true, 1000);
    this.them = new Person(this.world, TRAVELLER_X, THEM, false, 2000);
    this.bus = new Bus(-5000, G, {
      body: '#6f6f6e', skirt: '#4e4e4d', roof: '#858584', glass: '#2c2c2e', lit: '#cfcfc9', pillar: '#3b3b3b', tire: '#121212', hub: '#6a6a6a', rim: '#e8e8e4', passenger: '#3a3a3a',
    });
    this.umbrella = new Umbrella(this.world, { canopy: '#131314', rib: 'rgba(120, 120, 124, 0.5)', shaft: '#2a2a2a', rim: '#d8d8d4' });
    this.suitcase = new Suitcase(this.world, '#4b4b4b', '#2b2b2b');
    this.herBeats = this.performHer();
    this.theirBeats = this.performThem();
    this.busBeats = this.driveBus();
    this.edit = this.cutFilm();
  }

  // ── Her ────────────────────────────────────────────────
  private performHer(): Beats<HerBeat> {
    const her = this.her, i = () => her.intent, them = this.them;
    const pant = (t: number, open: number) => open + Math.max(0, noise1(t * 5.5, 9)) * 0.3;
    const desperate = (t: number, base: number) => base + noise1(t * 1.7, 4) * 45 + noise1(t * 4.1, 5) * 20;
    return new Beats<HerBeat>('run', {
      run: {
        during: ({ t, since }) => {
          Object.assign(i(), { speed: desperate(t, 540) * ramp(since, 0, 0.4), effort: 1, mouth: pant(t, 0.45), brow: -0.4, look: { x: her.x + 900, y: G - 360 } });
        },
        next: () => her.x >= TRIP_X && 'tumble',
      },
      tumble: {
        enter: () => her.trip(200),
        during: () => Object.assign(i(), { mouth: 0.6, brow: 0.6, effort: 0.3 }),
        next: () => her.mode === 'ground' && 'down',
      },
      down: {
        enter: () => {
          const hit = her.head;
          this.mud.emit({ x: hit.x, y: ground(hit.x) }, 60, { angle: -Math.PI / 2 + 0.3, spread: 2.2, speed: [180, 620], life: [0.6, 1.6], size: [0.8, 2.6] });
          this.mud.emit({ x: her.x, y: ground(her.x) }, 30, { angle: -Math.PI / 2, spread: 2.6, speed: [120, 420], life: [0.6, 1.4], size: [0.8, 2.4] });
        },
        during: ({ since }) => {
          her.lift = ramp(since, 1.2, 1.9);
          Object.assign(i(), { blink: ramp(since, 0.7, 0.85) * blink(since, [1.5]), mouth: 0.25 + Math.max(0, noise1(since * 3, 2)) * 0.2, brow: 0.8, look: { x: her.x + 1400, y: G - 420 } });
        },
        after: 2.45, then: 'rise',
      },
      rise: {
        during: ({ since }) => {
          her.lift = 1;
          her.rise = keys(since, [[0, 0], [0.6, 0.35], [1.3, 0.7], [1.9, 1]]);
          Object.assign(i(), { mouth: 0.45, brow: -0.6, effort: 0.6, look: { x: her.x + 1400, y: G - 420 } });
        },
        after: 1.9, then: 'limp',
      },
      limp: {
        enter: () => { her.mode = 'walk'; },
        during: ({ t, since }) => Object.assign(i(), { speed: lerp(140, 360, ramp(since, 0, 1.4)), limp: lerp(1, 0.6, ramp(since, 0.4, 1.4)), effort: 0.9, mouth: pant(t, 0.4), brow: -0.5, lean: 0.08 }),
        after: 1.4, then: 'run2',
      },
      run2: {
        during: ({ t }) => {
          const flinch = envelope(t - this.soaked, 0, 0.1, 0.5, 0.9);
          Object.assign(i(), {
            speed: desperate(t, 480) * (1 - flinch * 0.35), limp: 0.4, effort: 1, mouth: pant(t, 0.5), brow: -0.5 + flinch, lean: 0.06,
            reachN: flinch > 0.05 ? { x: her.head.x + 40, y: her.head.y - 30 } : null, look: { x: her.x + 900, y: G - 360 },
          });
        },
        next: () => her.x > them.x - 1500 && 'shout',
      },
      shout: {
        during: ({ t, since }) => Object.assign(i(), {
          speed: desperate(t, 430), limp: 0.35, effort: 1, mouth: 0.5 + envelope(since, 0.1, 0.25, 0.9, 1.2) * 0.5, brow: 0.9 * envelope(since, 0.1, 0.25, 0.9, 1.2), lean: 0.04,
          reachN: since > 0.3 ? { x: her.x + 260, y: G - 330 } : null, look: them.head,
        }),
        next: () => her.x > them.x - 280 && this.theirBeats.reached('see') && 'leap',
      },
      leap: {
        enter: () => her.embrace({ x: them.x - 58, y: ground(them.x - 58) }, () => ({ x: this.them.x - 58, y: G })),
        during: () => Object.assign(i(), { mouth: 0.3, brow: 1, reachN: them.body(0.95, 12), reachF: them.body(1.05, 0) }),
        next: () => her.mode === 'held' && 'hold',
      },
      hold: {
        enter: ({ t }) => { this.hitAt = t; },
        during: ({ since }) => Object.assign(i(), {
          mouth: 0.15 + envelope(since, 0.8, 1, 1.6, 2) * 0.25, brow: 1, blink: 1 - ramp(since, 0.3, 0.5) * 0.95, nod: 0.5,
          reachN: them.body(0.8, -24), reachF: them.body(0.95, -10),
        }),
      },
    });
  }

  // ── Them ───────────────────────────────────────────────
  private performThem(): Beats<TheirBeat> {
    const them = this.them, i = () => them.intent, her = this.her;
    const umbrellaUp = () => ({ x: them.x + them.intent.facing * 24, y: G - 262 });
    return new Beats<TheirBeat>('wait', {
      wait: {
        during: ({ t }) => Object.assign(i(), { facing: 1, reachN: umbrellaUp(), reachF: them.body(0.1, 10), nod: 0.25 + noise1(t * 0.4, 8) * 0.05, brow: 0.3, blink: blink(t, [3.1, 7.7, 12.2]) }),
        next: () => this.bus.door > 0.8 && 'board',
      },
      board: {
        during: ({ since, t }) => Object.assign(i(), {
          facing: 1, speed: 110 * envelope(since, 0, 0.3, 0.9, 1.3), reachN: umbrellaUp(), reachF: them.body(0.15, 20), nod: 0.1, brow: 0.3, blink: blink(t, [13.9]),
        }),
        next: () => this.herBeats.reached('shout') && 'hesitate', after: 3, then: 'hesitate',
      },
      hesitate: {
        during: () => Object.assign(i(), { facing: 1, reachN: umbrellaUp(), reachF: them.body(0.15, 20), nod: -0.1, brow: 0.5 }),
        next: () => this.edit.current === 'turn' && 'turn',
      },
      turn: {
        during: ({ since }) => Object.assign(i(), {
          facing: lerp(1, -1, ramp(since, 0.25, 0.7)), reachN: umbrellaUp(), reachF: them.body(0.15, 20), nod: 0.15, brow: 0.8 + ramp(since, 0.7, 0.9) * 0.2, mouth: ramp(since, 0.8, 1) * 0.2,
          look: since > 0.6 ? her.head : null,
        }),
        after: 1.0, then: 'see',
      },
      see: {
        during: () => Object.assign(i(), { facing: -1, reachN: { x: them.x - 30, y: G - 250 }, reachF: them.body(0.15, 14), brow: 1, mouth: 0.25, look: her.head, speed: 0, nod: 0.1 }),
        next: () => this.herBeats.reached('hold') && 'caught',
      },
      caught: {
        enter: ({ dt }) => {
          // Momentum: she arrives at `impact` px/s; together they carry on at her share of the mass.
          const v = this.her.impact;
          them.push = v * 0.45;
          this.umbrella.drop({ x: v * 0.35 + 40, y: -330 }, 5, dt || this.dt);
          this.suitcase.drop({ x: v * 0.2, y: 0 }, -1.5, dt || this.dt);
        },
        during: ({ since }) => Object.assign(i(), {
          facing: -1, reachN: her.body(0.72, -20), reachF: her.body(0.85, -14), nod: 0.55, brow: 1, blink: 1 - ramp(since, 0.8, 1.1) * 0.95, mouth: 0.1,
        }),
      },
    });
  }

  // ── The bus ────────────────────────────────────────────
  private driveBus(): Beats<BusBeat> {
    const bus = this.bus, her = this.her, stopAt = DOOR_X + DOOR_FROM_FRONT, CRUISE = 1900, BRAKE = 2300;
    return new Beats<BusBeat>('away', {
      away: { next: () => this.herBeats.reached('limp') && 'drive' },
      drive: {
        enter: () => { bus.x = her.x - 1900; bus.speed = CRUISE; },
        next: () => stopAt - bus.x <= (CRUISE * CRUISE) / (2 * BRAKE) && 'brake',
      },
      brake: {
        during: ({ dt }) => { bus.speed = Math.sqrt(Math.max(0, 2 * BRAKE * (stopAt - bus.x))); if (bus.speed < 30) { bus.speed = 0; bus.x = stopAt; } void dt; },
        next: () => bus.speed === 0 && 'stopped',
      },
      stopped: {
        during: ({ since }) => { bus.door = ramp(since, 0.4, 1.0) * (this.herBeats.reached('hold') ? 1 - ramp(this.time - (this.hitAt + 0.8), 0, 0.5) : 1); },
        next: () => Number.isFinite(this.hitAt) && this.hitAt + 1.4 < this.time && 'leave',
      },
      leave: { during: ({ since }) => { bus.door = 0; bus.speed = 900 * ramp(since, 0, 1.2) + 500 * since; } },
    });
  }

  // ── The edit ───────────────────────────────────────────
  private cutFilm(): Edit<Shot> {
    const her = this.her, them = this.them;
    const set = (blur: number, light: V, foreground = false) => () => { this.look = { blur, light, foreground }; };
    const road = { x: -0.6, y: 0.8 }, lamp = { x: 0.55, y: 0.85 };
    return new Edit<Shot>('wide', {
      wide: { enter: set(0, road), frame: ({ since }) => ({ x: 900 + since * 330, y: G - 560, zoom: 0.42, handheld: 2 }), after: 2.7, then: 'track' },
      track: {
        enter: set(1.5, road),
        frame: () => ({ x: her.x + 150, y: G - 210, zoom: 1.2, handheld: 9, roll: 0.025 }),
        next: () => her.landed && 'mud',
      },
      mud: {
        enter: set(7, road),
        frame: () => ({ x: her.head.x + 70, y: Math.min(her.head.y, G - 60) + 12, zoom: 4.2, handheld: 5 }),
        after: 2.75, then: 'low',
      },
      low: {
        enter: set(2.5, road, true),
        frame: ({ since }) => ({ x: TRIP_X + 360 + Math.max(0, since - 1.9) * 300, y: G - 150, zoom: 1.1, roll: -0.04, handheld: 3 }),
        next: () => this.bus.x - BUS_LENGTH > her.x + 500 && this.edit.current === 'low' && this.bus.speed > 0 && 'stop',
        after: 4.2, then: 'stop',
      },
      stop: {
        enter: set(0.8, lamp),
        frame: () => ({ x: TRAVELLER_X - 120, y: G - 330, zoom: 0.72, handheld: 2 }),
        next: () => this.herBeats.reached('shout') && this.theirBeats.current === 'hesitate' && 'shout',
      },
      shout: {
        enter: set(6, road),
        frame: () => ({ x: her.head.x + 90, y: her.head.y + 30, zoom: 3.1, handheld: 13, roll: -0.03 }),
        after: 1.2, then: 'turn',
      },
      turn: {
        enter: set(6, lamp),
        frame: () => ({ x: them.head.x - 20, y: them.head.y + 6, zoom: 3.3, handheld: 3 }),
        next: () => this.herBeats.reached('leap') && 'embrace',
      },
      embrace: {
        enter: set(1, lamp),
        frame: ({ since }) => {
          const back = ramp(since, 1.3, 4.8);
          return { x: lerp(them.x - 70, them.x - 320, back), y: lerp(G - 250, G - 480, back), zoom: lerp(1.75, 0.5, back), handheld: lerp(4, 1.5, back) };
        },
      },
    });
  }

  protected start(): void {
    this.herBeats.update(0, 0);
    this.edit.update(0, 0);
    this.edit.apply(this.cam, 0, 0);
  }

  protected update(t: number, dt: number): void {
    Object.assign(this.her.intent, PERSON_REST, { blink: blink(t, [2.4, 11.1]) });
    Object.assign(this.them.intent, PERSON_REST);
    if (!this.settling) {
      this.edit.update(t, dt);
      this.herBeats.update(t, dt);
      this.theirBeats.update(t, dt);
      this.busBeats.update(t, dt);
    } else {
      Object.assign(this.them.intent, { reachN: { x: this.them.x + 24, y: G - 262 }, reachF: this.them.body(0.1, 10), nod: 0.25 });
    }
    this.her.update(dt);
    this.them.update(dt);
    this.bus.update(dt);
    this.effects(t, dt);
  }

  /** Mud, spray from the tyres, the soaking when the bus passes her, breath in the cold. */
  private effects(t: number, dt: number): void {
    const bus = this.bus, her = this.her;
    if (bus.speed > 300) for (const w of bus.wheels) this.spray.emit({ x: w.x - 30, y: w.y + 4 }, 2, { angle: -2.4, spread: 0.9, speed: [200, 600], life: [0.3, 0.8], size: [1.5, 4], carry: { x: bus.speed * 0.4, y: 0 } });
    const front = bus.wheels[0];
    if (this.soaked === -Infinity && bus.speed > 0 && front.x > her.x - 40) {
      this.soaked = t;
      this.spray.emit({ x: her.x - 30, y: G + 24 }, 320, { angle: -1.75, spread: 0.9, speed: [600, 1600], life: [0.5, 1.3], size: [2, 7], carry: { x: bus.speed * 0.25, y: 0 } });
    }
    if (this.herBeats.current !== 'down' && her.mode !== 'held' && Math.floor(t * 30) % 11 === 0 && Math.floor((t - dt) * 30) % 11 !== 0) {
      const f = her.skel.uprightFrame('head', HEAD_R)({ x: HEAD_R * 1.1, y: HEAD_R * 0.6 });
      this.breath.emit(f, 3, { angle: her.intent.facing > 0 ? 0 : Math.PI, spread: 0.6, speed: [30, 70], life: [0.6, 1.1], size: [5, 10], carry: { x: her.velocity * 0.6, y: 0 } });
    }
    this.mud.update(dt);
    this.spray.update(dt);
    this.breath.update(dt);
  }

  protected lateUpdate(t: number, dt: number): void {
    const them = this.them, hand = them.skel.point('foreN', 1.05), far = them.skel.point('foreF', 1.1);
    if (this.umbrella.held) this.umbrella.hold(hand, 0);
    if (this.suitcase.held) this.suitcase.hold(far, 0);
    if (!this.settling) this.edit.apply(this.cam, t, dt);
  }

  probe(): Record<string, unknown> {
    const r = Math.round;
    return {
      ...super.probe(), shot: this.edit.current, her: [r(this.her.x), this.her.mode, this.herBeats.current], them: [r(this.them.x), this.theirBeats.current],
      bus: [r(this.bus.x), r(this.bus.speed), +this.bus.door.toFixed(2), this.busBeats.current], zoom: +this.cam.zoom.toFixed(2),
      edit: this.edit.history.map(s => `${s.beat}@${s.at.toFixed(2)}`), herBeats: this.herBeats.history.map(s => `${s.beat}@${s.at.toFixed(2)}`),
    };
  }

  // ── Drawing ────────────────────────────────────────────
  private flash(t: number): number {
    return [1.15, 5.7, 16.9].reduce((m, at) => {
      const d = t - at;
      return d < 0 ? m : Math.max(m, Math.exp(-d * 9) + (d > 0.13 ? Math.exp(-(d - 0.13) * 12) * 0.7 : 0));
    }, 0);
  }

  protected draw(t: number, frame: number): void {
    const { ctx, paper, cam } = this;
    const flash = this.flash(t);
    paper.light = this.look.light;
    this.her.lens = this.them.lens = cam.zoom ** -0.55;
    drawSky(ctx, flash);
    const blur = this.look.blur;
    paper.layer(1, () => this.drawDistance(t, flash), 'source-over', blur > 0 ? `blur(${blur}px)` : 'none');
    cam.layer(paper, 0.45, v => drawRain(paper.context, RAIN.far, v, t));
    cam.layer(paper, 1, v => this.drawAction(v.from, v.to, v.top, v.bottom, t));
    if (this.look.foreground) paper.layer(1, () => cam.layer(paper, 1.45, v => drawProps(paper, LAYERS.grassNear, v.from, v.to, x => 140 + noise1(x * 0.01 + t, 2) * 80, t)), 'source-over', `blur(${Math.max(2, blur * 0.8)}px)`);
    cam.layer(paper, 2.2, v => drawRain(paper.context, RAIN.near, v, t));
    vignette(ctx, [0, 0, 0], 0.55, 0.4);
    wash(ctx, '#ffffff', flash * 0.35, 'screen');
    grade(ctx, 'grayscale(1) contrast(1.12) brightness(1.02)');
    grain(ctx, frame, 0.14);
    wash(ctx, '#000', Math.max(1 - ramp(t, 0, 0.7), ramp(t, 21.2, 22.15)));
    letterbox(ctx, 2.39);
  }

  /** Clouds, lightning, hills, the tree line, town and telegraph poles. */
  private drawDistance(t: number, flash: number): void {
    const { paper, cam } = this;
    paper.edgeColor = 'rgba(200, 200, 205, 0.05)';
    cam.layer(paper, 0.03, () => this.drawGoal());
    cam.layer(paper, 0.04, () => drawBolt(paper, { x: 1500 + (t > 10 ? 400 : 0), y: 120 }, 700, t > 10 ? 3 : t > 4 ? 2 : 1, flash));
    cam.layer(paper, 0.06, v => drawProps(paper, LAYERS.clouds, v.from, v.to, () => 0, t));
    cam.layer(paper, 0.14, v => { drawRidge(paper, HILLS, v.from, v.to, 1400); this.mist(v.from, v.to, 640, 170, 0.22 + flash * 0.2); });
    cam.layer(paper, 0.3, v => drawProps(paper, LAYERS.trees, v.from, v.to, x => 200 + noise1(x * 0.01, 1) * 100, t));
    cam.layer(paper, 0.6, v => {
      drawProps(paper, LAYERS.town, v.from, v.to, () => 0, t);
      drawPoles(paper, v.from, v.to, 880);
      this.mist(v.from, v.to, 830, 120, 0.16);
    });
    paper.edgeColor = 'rgba(255, 255, 250, 0.2)';
  }

  /** The far light she runs toward: the edge of town, a glow on the horizon. */
  private drawGoal(): void {
    const ctx = this.paper.context, c = { x: 1640, y: 640 };
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 260);
    g.addColorStop(0, 'rgba(255, 255, 250, 0.5)');
    g.addColorStop(0.08, 'rgba(255, 255, 250, 0.22)');
    g.addColorStop(1, 'rgba(255, 255, 250, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(c.x - 260, c.y - 260, 520, 520);
    ctx.fillStyle = '#ffffff';
    for (const [dx, dy, r] of [[0, 0, 2.6], [-22, 6, 1.4], [18, 4, 1.6], [40, 8, 1.1]]) { ctx.beginPath(); ctx.arc(c.x + dx, c.y + dy, r, 0, Math.PI * 2); ctx.fill(); }
  }

  /** A band of wet haze lying over the land, so each layer separates from the next. */
  private mist(from: number, to: number, y: number, height: number, alpha: number): void {
    const ctx = this.paper.context, g = ctx.createLinearGradient(0, y - height, 0, y + height);
    g.addColorStop(0, 'rgba(120, 120, 126, 0)');
    g.addColorStop(0.55, `rgba(120, 120, 126, ${alpha})`);
    g.addColorStop(1, 'rgba(120, 120, 126, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(from, y - height, to - from, height * 2);
  }

  /** The action plane: road, fence, stop, bus, the two of them, props, particles and rain. */
  private drawAction(from: number, to: number, top: number, bottom: number, t: number): void {
    const { paper, ctx } = this;
    const lampGlow = (x: number) => Math.max(0, 1 - Math.abs(x - (LAMP_X + 76)) / 500) + (this.bus.door > 0 ? Math.max(0, 1 - Math.abs(x - DOOR_X) / 400) * this.bus.door * 0.6 : 0);
    drawGround(paper, from, to, bottom + 50, t, lampGlow);
    drawFence(paper, from, to, this.her.lens);
    drawProps(paper, LAYERS.reeds, from, to, x => 120 + noise1(x * 0.01 + t, 2) * 60, t, [this.her.root]);
    this.bus.draw(paper);
    this.bus.drawSpill(paper);
    drawStop(paper, LAMP_X, SIGN_X);

    const hugging = this.her.mode === 'held';
    this.suitcase.draw(paper);
    this.them.draw(paper);
    if (!hugging) this.them.drawNearArm(paper);
    this.her.draw(paper);
    this.her.drawNearArm(paper);
    if (hugging) this.them.drawNearArm(paper);
    this.umbrella.draw(paper);

    ctx.save();
    ctx.fillStyle = HER.mud;
    this.mud.draw(p => { ctx.globalAlpha = p.landed ? 0.7 : 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * (p.landed ? 0.4 : 1), 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = 'rgb(215, 215, 220)';
    this.spray.draw((p, u) => { ctx.globalAlpha = 0.6 * (1 - u); ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = 'rgb(230, 230, 232)';
    this.breath.draw((p, u) => { ctx.globalAlpha = 0.07 * (1 - u); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + u * 2.5), 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();

    const canopy = this.umbrella.held ? this.umbrella.top() : null;
    const floor = (x: number) => {
      let y = ground(x) + 10;
      if (canopy && x >= canopy[0].x && x <= canopy[canopy.length - 1].x) {
        for (let k = 1; k < canopy.length; k++) if (x <= canopy[k].x) { const a = canopy[k - 1], b = canopy[k]; y = Math.min(y, a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1)); break; }
      }
      return y;
    };
    const view = { from, to, top, bottom };
    const scale = this.cam.zoom ** -0.65;
    drawRain(ctx, { ...RAIN.mid, width: RAIN.mid.width * scale }, view, t, floor);
    paper.clip(lampCone(LAMP_X), () => drawRain(ctx, { ...RAIN.lit, width: RAIN.lit.width * scale }, view, t, floor));
    drawLampLight(paper, LAMP_X, 1);
    this.bus.drawBeam(paper, this.bus.speed > 0 || this.bus.door > 0 ? 1 : 0);
    if (this.umbrella.held) drawDrips(ctx, this.umbrella.tips(), ground(this.them.x) + 20, { seed: 3, period: 0.5, bead: 2.4, gravity: 1800, rgb: '230, 230, 235', alpha: 0.75 }, t);
  }
}

const RAIN = {
  far: { seed: 1, density: 11, period: 0.4, speed: 2100, slant: -0.14, length: 38, width: 1.1, rgb: '205, 205, 210', alpha: [0.1, 0.26] as [number, number] },
  mid: {
    seed: 2, density: 7, period: 0.38, speed: 2700, slant: -0.14, length: 66, width: 1.7, rgb: '215, 215, 220', alpha: [0.16, 0.45] as [number, number],
    splash: { color: 'rgba(225, 225, 230, 0.5)', size: 7, life: 0.24 },
  },
  lit: { seed: 4, density: 10, period: 0.4, speed: 2700, slant: -0.14, length: 62, width: 1.8, rgb: '250, 250, 245', alpha: [0.35, 0.8] as [number, number] },
  near: { seed: 3, density: 1.3, period: 0.6, speed: 3400, slant: -0.14, length: 160, width: 3.4, rgb: '220, 220, 225', alpha: [0.05, 0.14] as [number, number] },
};

