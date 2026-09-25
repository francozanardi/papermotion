import { type BoneDef, Bone } from './Bone';
import { type V, add, clamp, ik, lerpV, rot } from '../core/math';

/**
 * A 2D bone hierarchy. Joints are connected by construction: a child always starts on its
 * parent. Life comes from angular springs (lag, overlap, follow-through), never from loose positions.
 *
 * Everything is computed in a "facing right" local space and mirrored by `flip` when mapped to world.
 */
export class Skeleton {
  readonly bones: Bone[] = [];
  private readonly byName = new Map<string, Bone>();
  /** World position of local (0, 0). */
  root: V;
  /** Local position of the root bone's start (e.g. hip height). */
  rootOffset: V = { x: 0, y: 0 };
  /** 1 facing right, -1 facing left; values in between squash the figure (paper turn). */
  flip = 1;

  constructor(defs: BoneDef[], root: V) {
    this.root = { ...root };
    for (const d of defs) {
      const b = new Bone(d, d.parent ? this.get(d.parent) : undefined);
      this.bones.push(b);
      this.byName.set(d.name, b);
    }
    this.step(0);
  }

  get(name: string): Bone {
    const b = this.byName.get(name);
    if (!b) throw new Error(`Unknown bone "${name}"`);
    return b;
  }

  /** Set a bone's target angle relative to its parent. */
  set(name: string, angle: number): void {
    this.get(name).target = angle;
  }

  /** Set a bone's target by world (local-space) angle. */
  setWorld(name: string, angle: number): void {
    const b = this.get(name);
    b.target = angle - (b.parent?.world ?? 0);
  }

  /**
   * Blend bone targets toward a pose (relative angles) by `weight` 0…1: sitting, curling up, a stretch.
   * Call after anything else that sets targets this step (gait, IK), before `step`.
   */
  pose(targets: Readonly<Record<string, number>>, weight: number): void {
    if (weight <= 0) return;
    for (const name in targets) {
      const b = this.get(name);
      b.target += (targets[name] - b.target) * Math.min(1, weight);
    }
  }

  /** Two-bone IK: aim `upper`+`lower` so the chain ends at `target` (local space). */
  reach(upper: string, lower: string, target: V, bend: number): void {
    const a = this.get(upper), b = this.get(lower);
    const joint = ik(a.start, target, a.def.length, b.def.length, bend);
    const w1 = Math.atan2(joint.y - a.start.y, joint.x - a.start.x);
    const w2 = Math.atan2(target.y - joint.y, target.x - joint.x);
    a.target = w1 - (a.parent?.world ?? 0);
    b.target = w2 - w1;
  }

  step(dt: number): void {
    for (const b of this.bones) this.solve(b, dt);
  }

  /** Local → world. */
  map(p: V): V {
    return { x: this.root.x + p.x * this.flip, y: this.root.y + p.y };
  }

  toLocal(p: V): V {
    const f = Math.sign(this.flip || 1) * Math.max(Math.abs(this.flip), 0.15);
    return { x: (p.x - this.root.x) / f, y: p.y - this.root.y };
  }

  /** World point on a bone: `u` along its length plus a perpendicular offset. */
  point(name: string, u = 1, offset: V = { x: 0, y: 0 }): V {
    const b = this.get(name);
    return this.map(add(b.start, rot({ x: b.def.length * u + offset.x, y: offset.y }, b.world)));
  }

  /** A frame riding a bone: +x along the bone, +y to its right (local → world). Tails, ears, props held. */
  boneFrame(name: string): (p: V) => V {
    const b = this.get(name);
    return (p: V) => this.map(add(b.start, rot(p, b.world)));
  }

  /**
   * A drawing frame attached to a bone whose +x points "forward" (facing) and +y "down",
   * as if the bone pointed up. Used for heads, faces and hands.
   */
  uprightFrame(name: string, along = 0): (p: V) => V {
    const b = this.get(name);
    return (p: V) => this.map(add(b.start, rot({ x: along - p.y, y: p.x }, b.world)));
  }

  private solve(b: Bone, dt: number): void {
    const p = b.parent;
    const parentWorld = p ? p.world : 0;
    b.start = p ? lerpV(p.start, p.end, b.def.at ?? 1) : { ...this.rootOffset };

    const s = b.def.spring;
    if (s && dt > 0) {
      if (!Number.isNaN(b.prevWorld)) b.angle += (b.prevWorld - parentWorld - b.angle) * (s.inertia ?? 0);
      const torque = this.baseTorque(b, dt) * (s.sway ?? 0);
      b.vel += (s.stiffness * (b.target - b.angle) - s.damping * b.vel + torque) * dt;
      b.angle += b.vel * dt;
    } else {
      b.angle = b.target;
    }
    if (b.def.limits) b.angle = clamp(b.angle, b.def.limits[0], b.def.limits[1]);

    b.world = parentWorld + b.angle;
    b.end = add(b.start, rot({ x: b.def.length, y: 0 }, b.world));
    b.prevWorld = b.world;
  }

  /** Angular acceleration induced by the linear acceleration of the bone's base (a pendulum's swing). */
  private baseTorque(b: Bone, dt: number): number {
    const base = { x: this.root.x * Math.sign(this.flip || 1) + b.start.x, y: this.root.y + b.start.y };
    let torque = 0;
    if (b.prevBase) {
      const vel = { x: (base.x - b.prevBase.x) / dt, y: (base.y - b.prevBase.y) / dt };
      if (b.prevBaseVel) {
        const acc = { x: (vel.x - b.prevBaseVel.x) / dt, y: (vel.y - b.prevBaseVel.y) / dt };
        const dir = { x: Math.cos(b.world), y: Math.sin(b.world) };
        torque = clamp((dir.x * -acc.y - dir.y * -acc.x) / b.def.length, -600, 600);
      }
      b.prevBaseVel = vel;
    }
    b.prevBase = base;
    return torque;
  }
}
