/** What a beat's hooks receive every step. */
export interface BeatContext {
  /** Scene time (s). */
  t: number;
  dt: number;
  /** Seconds since this beat started. */
  since: number;
}

/**
 * One beat of an actor's performance: what it does while active, and what ends it.
 * A beat ends when `next` returns another beat's name, or after `after` seconds (going to `then`),
 * whichever comes first. Use `after` alone for timed beats, and as a fallback for conditional ones.
 */
export interface BeatSpec<B extends string> {
  /** Once, when the beat starts (latch decisions, trigger reactions, fire effects). */
  enter?(ctx: BeatContext): void;
  /** Every step while active (set intents, steer). */
  during?(ctx: BeatContext): void;
  /** Once, when the beat ends. */
  exit?(ctx: BeatContext): void;
  /** Checked every step; return a beat name to switch to it. */
  next?(ctx: BeatContext): B | false | null | undefined;
  after?: number;
  then?: B;
}

/** A transition, kept for probes: which beat started when. */
export interface BeatLog<B extends string> { beat: B; at: number }

/**
 * Choreography as a state machine: an actor moves through beats triggered by what happens
 * ("when you are close, circle for 1.4 s, then line up") instead of by a fixed clock.
 * Call `update` once per simulation step, before the physics.
 *
 * @example
 * const fish = new Beats<'arrive' | 'inspect' | 'leave'>('arrive', {
 *   arrive:  { during: () => swim.steer(steer.arrive(swim.pos, jelly, 280)), next: () => near() && 'inspect' },
 *   inspect: { during: () => swim.steer(steer.orbit(swim.pos, jelly, 240, 200)), after: 1.4, then: 'leave' },
 *   leave:   { enter: () => swim.kick({ x: 480, y: -90 }) },
 * });
 */
export class Beats<B extends string> {
  readonly history: BeatLog<B>[] = [];
  private active: B;
  private startedAt = 0;
  private started = false;

  constructor(first: B, private readonly specs: Record<B, BeatSpec<B>>) {
    this.active = first;
  }

  /** The current beat. */
  get current(): B { return this.active; }

  /** Seconds since the current beat started, at scene time `t`. */
  since(t: number): number { return t - this.startedAt; }

  /** When `beat` last started, or undefined if it never did. */
  startOf(beat: B): number | undefined {
    for (let i = this.history.length - 1; i >= 0; i--) if (this.history[i].beat === beat) return this.history[i].at;
    return undefined;
  }

  /** Whether `beat` has started at some point (useful for "after the touch…" logic). */
  reached(beat: B): boolean { return this.startOf(beat) !== undefined; }

  /** Force a transition (external events). */
  go(beat: B, t: number, dt = 0): void {
    if (this.started) this.specs[this.active].exit?.(this.context(t, dt));
    this.active = beat;
    this.startedAt = t;
    this.started = true;
    this.history.push({ beat, at: t });
    this.specs[beat].enter?.(this.context(t, dt));
  }

  /** Advance one step: resolve transitions (several may chain in one step), then run `during`. */
  update(t: number, dt: number): void {
    if (!this.started) this.go(this.active, t, dt);
    for (let hops = 0; hops < 8; hops++) {
      const next = this.transition(t, dt);
      if (!next) break;
      this.go(next, t, dt);
    }
    this.specs[this.active].during?.(this.context(t, dt));
  }

  private transition(t: number, dt: number): B | null {
    const spec = this.specs[this.active], ctx = this.context(t, dt);
    const next = spec.next?.(ctx);
    if (next) return next;
    if (spec.after !== undefined && spec.then !== undefined && ctx.since >= spec.after) return spec.then;
    return null;
  }

  private context(t: number, dt: number): BeatContext {
    return { t, dt, since: t - this.startedAt };
  }
}
