import type { Camera, CueOpts, Paper, V, World } from '../../src';
import type { Clawd } from '../cast/Clawd';

/** What every act gets: the shared world, paper and canvas, and the one Clawd who travels between them. */
export interface Ctx {
  world: World;
  paper: Paper;
  ctx: CanvasRenderingContext2D;
  clawd: Clawd;
  /** Fire a sound event at a world point (panned by where the current act's camera shows it). */
  cue(name: string, at: V, o?: CueOpts): void;
}

/**
 * One set of the tour. Acts live side by side in the same world (far apart in x), each with its own
 * camera. Only the act Clawd is in performs; the others just keep simulating and can still be drawn
 * (the outgoing act, under a transition).
 */
export interface Act {
  readonly cam: Camera;
  /** The scene light for this act. */
  readonly light: V;
  /** Clawd arrives: place it, reset the act's beats. */
  begin(t: number): void;
  /** Before physics, every step (whether or not Clawd is here). */
  update(t: number, dt: number, active: boolean): void;
  /** After physics: camera. */
  lateUpdate(t: number, dt: number): void;
  /** The whole frame for this act, backdrop included. */
  draw(t: number, withClawd: boolean): void;
  /** Clawd has left: time to move on. */
  readonly done: boolean;
  /** Where the transition out should open from (screen), e.g. the moon for an iris. */
  exitPoint?(): V;
  probe(): Record<string, unknown>;
}
