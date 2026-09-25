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
  protected readonly ctx: CanvasRenderingContext2D;
  protected readonly dt: number;
  /** Steps taken, counted from the start of the pre-roll; time derives from it so it never drifts. */
  private steps = 0;
  private readonly prerollSteps: number;
  private started = false;

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
  }

  get frames(): number { return Math.round(this.fps * this.duration); }

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
    if (!this.started) this.begin();
    const target = n / this.fps;
    if (target < this.clock - this.dt * 1.5) throw new Error(`Frames must be rendered in order: asked for ${n} at t=${this.clock.toFixed(3)}`);
    while (this.clock < target - 1e-9) this.tick();
    this.paper.setFrame(n);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.draw(this.time, n);
  }

  /** Numbers that describe the current state, for inspection. Extend it in each scene. */
  probe(): Record<string, unknown> {
    return { t: +this.clock.toFixed(2) };
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
