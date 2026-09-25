import { noise1 } from '../core/random';
import { Spring } from '../core/Spring';

export interface CameraOpts {
  width: number;
  height: number;
  /** Follow spring (lower = lazier). */
  stiffness?: number;
  damping?: number;
  /** Handheld drift in px. */
  handheld?: number;
}

/**
 * 2D camera with parallax: each layer has a depth (0 = infinitely far, 1 = the action plane,
 * >1 = foreground). Position follows a target with a spring; handheld noise adds life.
 */
export class Camera {
  zoom = 1;
  private readonly follow: Spring;
  private readonly followY: Spring;
  private t = 0;

  constructor(x: number, private readonly o: CameraOpts) {
    this.follow = new Spring({ x, y: 0 }, o.stiffness ?? 9, o.damping ?? 6);
    this.followY = new Spring({ x: 0, y: 0 }, o.stiffness ?? 9, o.damping ?? 6);
  }

  get x(): number {
    return this.follow.pos.x + noise1(this.t * 0.9, 31) * (this.o.handheld ?? 5);
  }

  private get y(): number {
    return this.followY.pos.y + noise1(this.t * 0.8, 32) * (this.o.handheld ?? 5) * 0.7;
  }

  snap(x: number, y?: number): void {
    this.follow.pos.x = x;
    if (y !== undefined) this.followY.pos.y = y - this.o.height / 2;
  }

  /** Follow a target; `targetY` (world) is optional, default keeps the action plane centered. */
  update(targetX: number, dt: number, t: number, targetY?: number): void {
    this.t = t;
    this.follow.step({ x: targetX, y: 0 }, dt);
    this.followY.step({ x: 0, y: targetY === undefined ? 0 : targetY - this.o.height / 2 }, dt);
  }

  /** Draw inside the transform of a layer at `depth`. */
  layer(ctx: CanvasRenderingContext2D, depth: number, draw: (view: { from: number; to: number }) => void): void {
    const { width: W, height: H } = this.o;
    if (!Number.isFinite(this.zoom) || !Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      throw new Error(`Camera has a non-finite value (zoom=${this.zoom}, x=${this.x}, y=${this.y})`);
    }
    const z = this.zoom ** depth;
    const offset = (this.x - W / 2) * depth;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.rotate(noise1(this.t * 0.5, 33) * 0.003 * depth);
    ctx.translate(-W / 2 - offset, -H / 2 - this.y * depth);
    const half = W / 2 / z;
    draw({ from: W / 2 + offset - half - 50, to: W / 2 + offset + half + 50 });
    ctx.restore();
  }
}
