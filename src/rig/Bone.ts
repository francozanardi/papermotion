import type { V } from '../core/math';

export interface BoneSpring {
  /** Pull toward the target angle (rad/s² per rad). */
  stiffness: number;
  damping: number;
  /** 0…1 — how much the bone keeps its world orientation when the parent turns (drag/lag). */
  inertia?: number;
  /** How strongly acceleration of the bone's base swings it (follow-through). */
  sway?: number;
}

export interface BoneDef {
  name: string;
  parent?: string;
  length: number;
  /** Rest angle: relative to the parent, or absolute for a root (0 = +x, -π/2 = up). */
  angle: number;
  /** Where the bone starts along its parent (0…1). Default: parent end. */
  at?: number;
  spring?: BoneSpring;
  limits?: [number, number];
}

/** One bone's runtime state: target and simulated angle, world transform, history for follow-through. */
export class Bone {
  target: number;
  angle: number;
  vel = 0;
  start: V = { x: 0, y: 0 };
  end: V = { x: 0, y: 0 };
  world = 0;
  prevWorld = NaN;
  prevBase: V | null = null;
  prevBaseVel: V | null = null;

  constructor(readonly def: BoneDef, readonly parent?: Bone) {
    this.target = this.angle = def.angle;
  }
}
