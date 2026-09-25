import { type V, clamp } from '../core/math';

export interface SwimSpec {
  maxSpeed: number;
  /** Max steering acceleration (px/s²). */
  accel: number;
  /** How fast speed above `maxSpeed` (after a kick) bleeds off (1/s). */
  drag: number;
  /** Tail beats per second: at rest, and extra per px/s of speed. */
  beat: [number, number];
  /** Seconds for the paper turn (flip through edge-on). */
  turn: number;
  maxPitch: number;
}

/** Everything a skin needs to draw a swimmer this frame. */
export interface SwimPose {
  at: V;
  vel: V;
  /** Body angle in screen space, already signed for the facing. */
  angle: number;
  /** Drawn x-scale in the body frame: 1 facing right, -1 left, through 0 while turning. */
  flip: number;
  /** Body curvature from pitching (rad over the body). */
  bend: number;
  /** Tail beat, -1…1 scaled by effort. */
  beat: number;
  effort: number;
}

const limit = (v: V, max: number): V => {
  const l = Math.hypot(v.x, v.y);
  return l > max ? { x: (v.x / l) * max, y: (v.y / l) * max } : v;
};

/**
 * Side-view swimming locomotion (the fish counterpart of `Gait`): steer toward a desired velocity
 * within muscle limits, pitch along the path, flip around like a paper cutout, beat the tail harder
 * with effort. Drifts with the water flow.
 */
export class Swimmer {
  readonly pos: V;
  readonly vel: V = { x: 0, y: 0 };
  facing: number;
  flip: number;
  /** When slow, the swimmer turns to face this point. */
  lookAt: V | null = null;
  private desired: V = { x: 0, y: 0 };
  private pitch = 0;
  private bend = 0;
  private phase: number;
  private effort = 0;
  private burst = 0;

  constructor(at: V, private readonly s: SwimSpec, facing = 1, seed = 0) {
    this.pos = { ...at };
    this.facing = this.flip = facing;
    this.phase = seed * 1.7;
  }

  /** Ask for a velocity (px/s); set it every step before `update`. */
  steer(desired: V): void { this.desired = desired; }

  /** A sudden burst (startle, dart). */
  kick(impulse: V): void {
    this.vel.x += impulse.x; this.vel.y += impulse.y;
    this.burst = 1;
  }

  update(dt: number, flow: V = { x: 0, y: 0 }): void {
    const s = this.s;
    const want = limit(this.desired, s.maxSpeed);
    const push = limit({ x: want.x - this.vel.x, y: want.y - this.vel.y }, s.accel * dt);
    this.vel.x += push.x; this.vel.y += push.y;
    let speed = Math.hypot(this.vel.x, this.vel.y);
    if (speed > s.maxSpeed) {
      const k = Math.exp(-s.drag * dt);
      this.vel.x *= k; this.vel.y *= k; speed *= k;
    }
    this.pos.x += (this.vel.x + flow.x) * dt;
    this.pos.y += (this.vel.y + flow.y) * dt;

    this.turnAround(dt, speed);
    const prev = this.pitch;
    const target = speed > 25 ? clamp(Math.atan2(this.vel.y, Math.abs(this.vel.x)), -s.maxPitch, s.maxPitch) : 0;
    this.pitch += (target - this.pitch) * (1 - Math.exp(-6 * dt));
    this.bend += (clamp(((this.pitch - prev) / dt) * 0.25, -0.5, 0.5) - this.bend) * (1 - Math.exp(-8 * dt));

    const strain = Math.hypot(push.x, push.y) / (s.accel * dt);
    const effort = clamp(0.25 + (speed / s.maxSpeed) * 0.6 + strain * 0.3) + this.burst;
    this.effort += (effort - this.effort) * (1 - Math.exp(-5 * dt));
    this.phase += dt * Math.PI * 2 * (s.beat[0] + s.beat[1] * speed + this.burst * 3);
    this.burst *= Math.exp(-3 * dt);
  }

  private turnAround(dt: number, speed: number): void {
    if (Math.abs(this.vel.x) > 30) this.facing = Math.sign(this.vel.x);
    else if (this.lookAt && speed < 60) this.facing = Math.sign(this.lookAt.x - this.pos.x) || this.facing;
    const rate = (dt * 2) / this.s.turn;
    this.flip += clamp(this.facing - this.flip, -rate, rate);
  }

  get pose(): SwimPose {
    const side = Math.sign(this.flip) || this.facing;
    return {
      at: this.pos, vel: this.vel, angle: this.pitch * side, flip: this.flip,
      bend: this.bend * side, beat: Math.sin(this.phase) * this.effort, effort: this.effort,
    };
  }
}
