import { type V, clamp } from '../core/math';
import { Spring } from '../core/Spring';
import type { Skeleton } from './Skeleton';

export interface GaitConfig {
  /** Root bone that tilts to lean the body. */
  pelvis: string;
  /** Rest angle of the root bone: -π/2 (up) for a biped's pelvis, 0 (forward) for a quadruped's spine. */
  pelvisAngle?: number;
  /** [thigh, shin] per leg, near leg first. */
  legs: [string, string][];
  /** When each leg steps, as a fraction of the stride cycle. Default: alternating (0, ½, 0, ½…). */
  phases?: number[];
  /** Knee direction per leg for the IK (-1 bends forward like a knee, +1 backward like an elbow). Default -1. */
  bends?: number[];
  /** [upper, fore] arms that swing with the stride (arms driven elsewhere are omitted). */
  arms?: [string, string][];
  hipHeight: number;
  /** Ground covered per step (px). */
  step: number;
  /** Speed at which the gait reaches a full run (px/s). */
  runSpeed: number;
  bounce: number;
  footLift: number;
  footReach: number;
  lean: number;
  stance: number;
  /** Arm swing amplitude at a full run (rad). Default 1. */
  armSwing?: number;
  /** Elbow bend at a full run (rad). Default 0.9. */
  elbow?: number;
}

export interface GaitInput {
  speed: number;
  /** Crouch amount (anticipation, sadness) in px. */
  crouch?: number;
  /** Extra forward lean in radians. */
  lean?: number;
  /** Ground height relative to the root at a local x. */
  ground: (localX: number) => number;
  /** Per-leg shift of the foot target (local px), e.g. hind paws forward when sitting, feet apart when bracing. */
  footOffset?: readonly V[];
  /**
   * 0…1: favour the first leg (a hurt foot). Less time is spent on it, the hip drops while it bears
   * weight and the stride shortens on its side.
   */
  limp?: number;
}

/**
 * Procedural legged locomotion: stride phase from distance travelled, hip bounce, foot placement
 * on the ground with IK (each foot under its own hip or shoulder), and counter-swinging arms.
 * Two legs make a biped; four legs with phases like [0, ½, ¼, ¾] make a walking quadruped.
 */
export class Gait {
  phase = 0;
  private readonly run = new Spring({ x: 0, y: 0 }, 60, 15);
  private clock = 0;

  constructor(private readonly cfg: GaitConfig) {}

  get amount(): number {
    return this.run.pos.x;
  }

  update(skel: Skeleton, input: GaitInput, dt: number): void {
    const c = this.cfg;
    this.clock += dt;
    const limp = input.limp ?? 0;
    // Hurry through the stance of the first leg: the phase runs faster while it is on the ground.
    const onHurt = Math.cos(this.phase) < 0 ? 1 : 0;
    this.phase += ((input.speed * dt) / c.step) * Math.PI * (1 + limp * (onHurt ? 0.7 : -0.3));
    const run = this.run.step({ x: clamp(Math.abs(input.speed) / c.runSpeed), y: 0 }, dt).x;

    const bob = -(1 - Math.abs(Math.cos(this.phase))) * c.bounce * run + limp * 16 * Math.max(0, -Math.cos(this.phase)) * Math.min(1, run * 3);
    const breathe = Math.sin(this.clock * 2.4) * 2 * (1 - run);
    skel.rootOffset = { x: 0, y: -c.hipHeight + bob + breathe + (input.crouch ?? 0) };
    skel.set(c.pelvis, (c.pelvisAngle ?? -Math.PI / 2) + c.lean * run + (input.lean ?? 0));

    c.legs.forEach(([thigh, shin], k) => {
      const ph = this.phase + (c.phases?.[k] ?? (k % 2) * 0.5) * Math.PI * 2;
      const hip = skel.get(thigh).start.x;
      const shift = input.footOffset?.[k];
      const reach = c.footReach * (k === 0 ? 1 - limp * 0.35 : 1);
      const x = hip + Math.sin(ph) * reach * run + (k % 2 ? -c.stance : c.stance) * (1 - run) + (shift?.x ?? 0);
      const foot: V = { x, y: input.ground(x) - Math.max(0, Math.cos(ph)) * c.footLift * run + (shift?.y ?? 0) };
      skel.reach(thigh, shin, foot, c.bends?.[k] ?? -1);
    });

    c.arms?.forEach(([upper, fore], k) => {
      const swing = Math.sin(this.phase + (k ? 0 : Math.PI)) * (c.armSwing ?? 1) * run + 0.1;
      skel.setWorld(upper, Math.PI / 2 - swing);
      skel.set(fore, -0.25 - (c.elbow ?? 0.9) * run);
    });
  }
}
