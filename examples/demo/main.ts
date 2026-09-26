/**
 * "A walk through paper" — a papermotion demo starring Clawd. It hops across the title, blows a
 * dandelion in a meadow, dives into a pond that turns out to be a sea, bounces off a jellyfish,
 * walks a string of lights over the rooftops, and lands on the closing card.
 *
 * Every act lives in the same world, far apart, with its own camera; transitions tear the page
 * or open an iris between them. Content only: the acts are in this folder.
 */
import { type CueOpts, type Stereo, type V, Stage, clamp, grain, irisWipe, noise1, tearWipe, vignette } from '../../src';
import { Clawd } from '../cast/Clawd';
import type { Act, Ctx } from './act';
import { MeadowAct } from './meadow';
import { RoofAct } from './roof';
import { SeaAct } from './sea';
import { scoreDemo } from './sound';
import { TitleAct } from './title';

const CLAWD = { body: '#d97757', top: '#e8906f', under: '#b95f42', legs: '#c96a4c', eye: '#1c1512', rim: '#ffd6bf', shade: 'rgba(90, 30, 10, 0.32)' };
const TRANSITION = 0.9;

interface Cut { from: Act; to: Act; at: number; kind: 'tear' | 'iris'; angle: number; center: V }

export class DemoScene extends Stage {
  private readonly acts: Act[];
  private readonly sea: SeaAct;
  private current = 0;
  private cut: Cut | null = null;
  private readonly clawd = new Clawd({ x: 0, y: 0 }, CLAWD);
  /** When each act began (scene seconds), for the score. */
  private readonly starts: number[] = [0];
  private wasAirborne = false;
  private footfalls = -1;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 29.5, preroll: 0.6 });
    const c: Ctx = { world: this.world, paper: this.paper, ctx: this.ctx, clawd: this.clawd, cue: (name, at, o) => this.cueAt(name, at, o) };
    this.sea = new SeaAct(c, 40000);
    this.acts = [new TitleAct(c, 0, null), new MeadowAct(c, 20000), this.sea, new RoofAct(c, 60000), new TitleAct(c, 80000, 'made with Claude Opus 5.5')];
    this.world.wind = (x, y) => (x > 35000 && x < 50000 ? this.sea.current(x, y) : { x: 30 + noise1(x * 0.001, 1) * 20, y: 0 });
  }

  protected start(): void {
    this.acts[0].begin(0);
  }

  protected update(t: number, dt: number): void {
    if (this.settling) return;
    const act = this.acts[this.current];
    if (act.done && !this.cut && this.current < this.acts.length - 1) this.next(t);
    this.acts.forEach((a, i) => a.update(t, dt, i === this.current));
    this.clawd.update(dt);
    this.listen();
  }

  /** Sounds every act shares: Clawd's hops, landings and steps. */
  private listen(): void {
    const c = this.clawd, air = c.airborne;
    if (air && !this.wasAirborne) this.cueAt('jump', c.root, { data: { act: this.current } });
    if (!air && this.wasAirborne && c.mode === 'walk') this.cueAt('land', c.root, { data: { act: this.current } });
    this.wasAirborne = air;
    const f = c.footfalls;
    if (f >= 0 && this.footfalls >= 0 && f !== this.footfalls) this.cueAt('step', c.root, { data: { act: this.current }, pitch: f % 2 ? 1.08 : 0.95 });
    this.footfalls = f;
  }

  /** A sound at a world point, panned by where the current act's camera shows it. */
  private cueAt(name: string, at: V, o: CueOpts = {}): void {
    const x = this.acts[this.current].cam.toScreen(at).x;
    this.cue(name, { ...o, pan: clamp((x - 960) / 960, -1, 1) * 0.6 });
  }

  /** Move Clawd to the next act and start the transition that reveals it. */
  private next(t: number): void {
    const from = this.acts[this.current], to = this.acts[++this.current];
    const kinds: [Cut['kind'], number][] = [['tear', 0], ['tear', Math.PI / 2], ['tear', -Math.PI / 2], ['iris', 0]];
    const [kind, angle] = kinds[this.current - 1];
    this.cut = { from, to, at: t, kind, angle, center: from.exitPoint?.() ?? { x: 960, y: 540 } };
    this.starts.push(t);
    this.cue(kind, { data: { act: this.current } });
    to.begin(t);
  }

  protected lateUpdate(t: number, dt: number): void {
    if (this.settling) return;
    this.acts[this.current].lateUpdate(t, dt);
    this.cut?.from.lateUpdate(t, dt);
    if (this.cut && t - this.cut.at > TRANSITION) this.cut = null;
  }

  soundtrack(sampleRate: number): Stereo {
    return scoreDemo({ log: this.sound, sampleRate, length: this.videoLength, starts: this.starts });
  }

  probe(): Record<string, unknown> {
    return { ...super.probe(), act: this.current, cut: !!this.cut, ...this.acts[this.current].probe() };
  }

  protected draw(t: number, frame: number): void {
    const { ctx, paper } = this;
    const show = (a: Act, clawd: boolean) => { paper.light = a.light; a.draw(t, clawd); };
    if (this.cut) {
      const u = (t - this.cut.at) / TRANSITION, cut = this.cut;
      show(cut.from, false);
      if (cut.kind === 'iris') irisWipe(ctx, u, cut.center, () => show(cut.to, true), { seed: 5 });
      else tearWipe(ctx, u, () => show(cut.to, true), { seed: this.current * 7, angle: cut.angle });
    } else show(this.acts[this.current], true);
    vignette(ctx, [30, 20, 10], 0.28, 0.5);
    grain(ctx, frame, 0.06);
  }
}
