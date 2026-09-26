import type { Stereo } from '../audio/dsp';
import { type CueOpts, SoundLog } from '../audio/SoundLog';
import { Paper } from '../paper/Paper';
import { World } from '../physics/World';

export interface StageOptions {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  /** Physics steps per rendered frame. */
  substeps?: number;
  /** Seconds simulated before frame 0 so strands, hair and cloth settle into place. */
  preroll?: number;
  /**
   * Playback rate at scene time `t`: 1 is real time, 0.3 is slow motion (the scene advances 0.3 s
   * per second of video). The simulation keeps its fixed step, so slow motion is simply fewer steps
   * per frame; `duration` stays in scene seconds and the video gets longer. See `speedRamp`.
   */
  rate?: (t: number) => number;
}

/**
 * A scene: fixed-timestep simulation plus drawing, deterministic frame by frame.
 * Subclasses build their cast in the constructor and fill in `update` (intents, beats, before physics),
 * `lateUpdate` (contacts, camera, after physics) and `draw`.
 *
 * Frames must be rendered in increasing order: the simulation only moves forward.
 */
export abstract class Stage {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly duration: number;
  readonly paper: Paper;
  readonly world = new World();
  /** Sound events and levels the simulation produced, for the scene's `soundtrack`. */
  readonly sound = new SoundLog();
  protected readonly ctx: CanvasRenderingContext2D;
  protected readonly dt: number;
  /** Steps taken, counted from the start of the pre-roll; time derives from it so it never drifts. */
  private steps = 0;
  private readonly prerollSteps: number;
  private started = false;
  /** Scene time shown by each video frame. */
  private readonly frameTimes: number[] = [];
  private readonly rate: (t: number) => number;

  constructor(readonly canvas: HTMLCanvasElement, o: StageOptions) {
    this.width = o.width ?? 1920;
    this.height = o.height ?? 1080;
    this.fps = o.fps ?? 30;
    this.duration = o.duration;
    this.dt = 1 / (this.fps * (o.substeps ?? 2));
    this.prerollSteps = Math.round((o.preroll ?? 0.6) / this.dt);
    canvas.width = this.width;
    canvas.height = this.height;
    this.ctx = canvas.getContext('2d')!;
    this.paper = new Paper(this.ctx);
    const rate = (this.rate = o.rate ?? (() => 1));
    for (let t = 0; t < this.duration - 1e-9; t += Math.max(0.02, rate(t)) / this.fps) this.frameTimes.push(t);
  }

  get frames(): number { return this.frameTimes.length; }

  private get clock(): number { return (this.steps - this.prerollSteps) * this.dt; }

  /** Scene time in seconds, held at 0 during the pre-roll. */
  get time(): number { return Math.max(0, this.clock); }

  /** True during the pre-roll: actors should hold their starting pose. */
  get settling(): boolean { return this.clock < 0; }

  /**
   * Simulate up to frame `n` and draw it.
   * @throws if `n` is earlier than the last rendered frame.
   */
  renderFrame(n: number): void {
    this.advance(n);
    this.paper.setFrame(n);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.draw(this.time, n);
  }

  /**
   * Simulate up to frame `n` without drawing (to reach the end of the story quickly, e.g. for sound).
   * @throws if `n` is earlier than the last simulated frame.
   */
  advance(n: number): void {
    if (!this.started) this.begin();
    const target = this.frameTimes[Math.min(n, this.frameTimes.length - 1)];
    if (target < this.clock - this.dt * 1.5) throw new Error(`Frames must be rendered in order: asked for ${n} at t=${this.clock.toFixed(3)}`);
    while (this.clock < target - 1e-9) this.tick();
  }

  /** Seconds of video at which scene time `t` is shown (they differ once slow motion has played). */
  videoTime(t: number): number {
    const ft = this.frameTimes;
    if (t <= 0) return 0;
    let lo = 0, hi = ft.length - 1;
    if (t >= ft[hi]) return hi / this.fps + (t - ft[hi]) / Math.max(0.02, this.rate(t));
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ft[m] <= t) lo = m; else hi = m; }
    return (lo + (t - ft[lo]) / (ft[hi] - ft[lo] || 1)) / this.fps;
  }

  /** Scene time shown at `v` seconds of video (the inverse of `videoTime`), for sounds driven by levels. */
  sceneTime(v: number): number {
    const ft = this.frameTimes, f = v * this.fps, i = Math.floor(f);
    if (i < 0) return 0;
    if (i >= ft.length - 1) return ft[ft.length - 1] + (f - ft.length + 1) / this.fps * this.rate(ft[ft.length - 1]);
    return ft[i] + (ft[i + 1] - ft[i]) * (f - i);
  }

  /** Length of the finished video (s). */
  get videoLength(): number { return this.frames / this.fps; }

  /** Playback rate at scene time `t` (1 = real time, below 1 = slow motion). */
  rateAt(t: number): number { return Math.max(0.02, this.rate(t)); }

  /**
   * The film's sound, mixed to stereo at `sampleRate`, or null for a silent film. Called once the
   * whole story has been simulated, so `this.sound` holds every cue. Override it to build a soundtrack
   * from `this.sound` with voices, a score and a `Mixer`; place sounds at `videoTime(cue.at)`.
   */
  soundtrack(_sampleRate: number): Stereo | null { return null; }

  /** Numbers that describe the current state, for inspection. Extend it in each scene. */
  probe(): Record<string, unknown> {
    return { t: +this.clock.toFixed(2) };
  }

  /** Fire a sound event now (ignored during the pre-roll). */
  protected cue(name: string, o?: CueOpts): void {
    if (!this.settling) this.sound.cue(name, this.time, o);
  }

  /** Record a continuous sound level now (a speed, the wind), read back with `sound.track(name)`. */
  protected level(name: string, value: number): void {
    if (!this.settling) this.sound.level(name, this.time, value);
  }

  /** Once, after the pre-roll and before the first frame (snap cameras here). */
  protected start(): void {}

  /** Before each physics step: intents, beats, steering. */
  protected abstract update(t: number, dt: number): void;

  /** After each physics step: contacts, catches, camera follow. */
  protected lateUpdate(_t: number, _dt: number): void {}

  protected abstract draw(t: number, frame: number): void;

  private begin(): void {
    this.started = true;
    while (this.clock < 0) this.tick();
    this.start();
  }

  private tick(): void {
    const t = this.time;
    this.update(t, this.dt);
    this.world.step(this.dt, t);
    this.lateUpdate(t, this.dt);
    this.steps++;
  }
}
