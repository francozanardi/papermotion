import type { V } from './math';

/** Critically-damped spring for a scalar or vector value, stepped with fixed dt. */
export class Spring {
  vel: V = { x: 0, y: 0 };
  constructor(public pos: V, private readonly stiffness: number, private readonly damping: number) {}
  step(target: V, dt: number): V {
    const ax = this.stiffness * (target.x - this.pos.x) - this.damping * this.vel.x;
    const ay = this.stiffness * (target.y - this.pos.y) - this.damping * this.vel.y;
    this.vel.x += ax * dt; this.vel.y += ay * dt;
    this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt;
    return this.pos;
  }
}
