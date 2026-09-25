import type { Camera, Framing } from '../camera/Camera';
import { type BeatContext, type BeatSpec, Beats } from './Beats';

/**
 * One shot of an edit: where the camera looks while it lasts, and what ends it (like a beat:
 * `next`, or `after` seconds going to `then`). A shot opens with a hard cut unless `cut` is false,
 * in which case the camera eases from wherever it was (a move within the same take).
 */
export interface ShotSpec<S extends string> extends BeatSpec<S> {
  frame(ctx: BeatContext): Framing;
  cut?: boolean;
}

/**
 * The edit: a sequence of shots over one continuous simulation. The story keeps running between
 * cuts; only the camera jumps. Cut on action with `next` (the moment a body hits the ground),
 * or on a timer with `after`.
 *
 * @example
 * const edit = new Edit<'wide' | 'close'>('wide', {
 *   wide:  { frame: () => ({ x: hero.x, y: 500, zoom: 0.5 }), next: () => hero.fell && 'close' },
 *   close: { frame: () => ({ x: hero.head.x, y: hero.head.y, zoom: 4, handheld: 8 }) },
 * });
 * // update(): edit.update(t, dt)   lateUpdate(): edit.apply(cam, t, dt)
 */
export class Edit<S extends string> {
  private readonly beats: Beats<S>;
  private pendingCut = true;
  private context: BeatContext = { t: 0, dt: 0, since: 0 };

  constructor(first: S, private readonly shots: Record<S, ShotSpec<S>>) {
    const specs = {} as Record<S, BeatSpec<S>>;
    for (const name in shots) {
      const s = shots[name];
      specs[name] = { ...s, enter: ctx => { if (s.cut !== false) this.pendingCut = true; s.enter?.(ctx); } };
    }
    this.beats = new Beats(first, specs);
  }

  /** The shot on screen. */
  get current(): S { return this.beats.current; }
  get history() { return this.beats.history; }
  startOf(shot: S): number | undefined { return this.beats.startOf(shot); }

  /** Advance the edit (before physics): resolve cuts. */
  update(t: number, dt: number): void {
    this.beats.update(t, dt);
    this.context = { t, dt, since: this.beats.since(t) };
  }

  /** Point the camera (after physics): cut to the shot's framing, or ease toward it. */
  apply(cam: Camera, t: number, dt: number): void {
    const f = this.shots[this.beats.current].frame({ t, dt, since: this.beats.since(t) });
    if (this.pendingCut) { cam.cut(f); cam.update(f.x, 0, t, f.y); this.pendingCut = false; }
    else cam.frame(f, dt, t);
  }

  /** The framing the current shot asks for right now. */
  framing(): Framing {
    return this.shots[this.beats.current].frame(this.context);
  }
}
