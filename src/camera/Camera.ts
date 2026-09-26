import { noise1 } from '../core/random';
import { Spring } from '../core/Spring';
import { Paper } from '../paper/Paper';

export interface CameraOpts {
  width: number;
  height: number;
  /** Follow spring (lower = lazier). */
  stiffness?: number;
  damping?: number;
  /** Handheld drift in px. */
  handheld?: number;
  /** How fast zoom, roll and handheld ease toward a framing (1/s). */
  ease?: number;
}

/** What a shot wants the camera to show: a world point at the center of the frame, and how. */
export interface Framing {
  x: number;
  y: number;
  zoom: number;
  /** Dutch angle (rad). */
  roll?: number;
  /** Handheld drift (px); a close-up can shake more than a locked-off wide. */
  handheld?: number;
}

/** The part of a layer the camera sees, in that layer's coordinates (with a margin). */
export interface View { from: number; to: number; top: number; bottom: number }

/**
 * 2D camera with parallax: each layer has a depth (0 = infinitely far, 1 = the action plane,
 * >1 = foreground). Position follows a target with a spring; handheld noise adds life.
 */
export class Camera {
  zoom = 1;
  roll = 0;
  handheld: number;
  private readonly follow: Spring;
  private readonly followY: Spring;
  private t = 0;

  constructor(x: number, private readonly o: CameraOpts) {
    this.follow = new Spring({ x, y: 0 }, o.stiffness ?? 9, o.damping ?? 6);
    this.followY = new Spring({ x: 0, y: 0 }, o.stiffness ?? 9, o.damping ?? 6);
    this.handheld = o.handheld ?? 5;
  }

  get x(): number {
    return this.follow.pos.x + noise1(this.t * 0.9, 31) * this.handheld;
  }

  private get y(): number {
    return this.followY.pos.y + noise1(this.t * 0.8, 32) * this.handheld * 0.7;
  }

  /** Jump to a target and stand still there (no leftover follow velocity). */
  snap(x: number, y?: number): void {
    this.follow.pos.x = x;
    this.follow.vel = { x: 0, y: 0 };
    if (y !== undefined) this.followY.pos.y = y - this.o.height / 2;
    this.followY.vel = { x: 0, y: 0 };
  }

  /** A hard cut: jump straight to a framing, zoom and roll included. */
  cut(f: Framing): void {
    this.snap(f.x, f.y);
    this.zoom = f.zoom;
    this.roll = f.roll ?? 0;
    this.handheld = f.handheld ?? this.o.handheld ?? 5;
  }

  /** Follow a target; `targetY` (world) is optional, default keeps the action plane centered. */
  update(targetX: number, dt: number, t: number, targetY?: number): void {
    this.t = t;
    this.follow.step({ x: targetX, y: 0 }, dt);
    this.followY.step({ x: 0, y: targetY === undefined ? 0 : targetY - this.o.height / 2 }, dt);
  }

  /** Ease toward a framing: position on the follow spring; zoom, roll and handheld exponentially. */
  frame(f: Framing, dt: number, t: number): void {
    this.update(f.x, dt, t, f.y);
    const k = 1 - Math.exp(-(this.o.ease ?? 2.2) * dt);
    this.zoom += (f.zoom - this.zoom) * k;
    this.roll += ((f.roll ?? 0) - this.roll) * k;
    this.handheld += ((f.handheld ?? this.o.handheld ?? 5) - this.handheld) * k;
  }

  /**
   * The x in the coordinates of a layer at `depth` that sits in front of world x (the action plane),
   * for placing scenery. Far layers scroll slower, so their props live near `x * depth`, not near `x`.
   */
  toLayer(x: number, depth: number): number {
    return this.o.width / 2 + (x - this.o.width / 2) * depth;
  }

  /** Where a point of the layer at `depth` lands on screen (ignoring the tiny handheld roll). */
  toScreen(p: { x: number; y: number }, depth = 1): { x: number; y: number } {
    const { width: W, height: H } = this.o, z = this.zoom ** depth;
    const offset = (this.x - W / 2) * depth, lift = this.y * depth;
    const dx = (p.x - W / 2 - offset) * z, dy = (p.y - H / 2 - lift) * z, c = Math.cos(this.roll), s = Math.sin(this.roll);
    return { x: W / 2 + dx * c - dy * s, y: H / 2 + dx * s + dy * c };
  }

  /**
   * Draw inside the transform of a layer at `depth`. Pass the `Paper` (not a raw context) to draw into
   * whatever it is drawing on right now: inside `paper.layer` or `paper.sheet` that is an offscreen
   * canvas, and a transform set on the main context would not reach it.
   */
  layer(target: CanvasRenderingContext2D | Paper, depth: number, draw: (view: View) => void): void {
    const ctx = target instanceof Paper ? target.context : target;
    const { width: W, height: H } = this.o;
    if (!Number.isFinite(this.zoom) || !Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      throw new Error(`Camera has a non-finite value (zoom=${this.zoom}, x=${this.x}, y=${this.y})`);
    }
    const z = this.zoom ** depth;
    const offset = (this.x - W / 2) * depth, lift = this.y * depth;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.rotate(noise1(this.t * 0.5, 33) * 0.003 * depth + this.roll);
    ctx.translate(-W / 2 - offset, -H / 2 - lift);
    const grow = 1 + Math.abs(this.roll) * 1.2, half = (W / 2 / z) * grow, halfH = (H / 2 / z) * grow;
    draw({ from: W / 2 + offset - half - 50, to: W / 2 + offset + half + 50, top: H / 2 + lift - halfH - 50, bottom: H / 2 + lift + halfH + 50 });
    ctx.restore();
  }
}
