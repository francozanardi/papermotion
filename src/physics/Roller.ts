export interface RollerOpts {
  /** Starting radius (px). */
  radius: number;
  /** Gravity along slopes (px/s²). Rolling bodies accelerate at 5/7 of it, like a solid ball. */
  gravity?: number;
  /** Rolling resistance (fraction of speed lost per second). */
  friction?: number;
  /**
   * Area picked up per px rolled (px²): a snowball growing, a ball of yarn winding up. 0 = rigid.
   * The radius grows as sqrt(r² + grow·distance / π) until `maxRadius`.
   */
  grow?: number;
  maxRadius?: number;
}

/**
 * A ball rolling along a ground line in side view: slopes speed it up, friction slows it, pushes
 * move it, it can gather material as it rolls, and it spins by the distance it covers.
 * Stops against walls with a bounce, reporting the impact speed.
 *
 * @example
 * const ball = new Roller(800, x => ground(x), { radius: 12, grow: 13, maxRadius: 100 });
 * ball.push(90);            // a character pushing it (px/s², along x)
 * ball.update(dt);
 * paper.piece(circlePoly(ball.center, ball.r), …) // rotate markings by ball.angle
 */
export class Roller {
  x: number;
  /** Speed along x (px/s). */
  vx = 0;
  r: number;
  /** Turned angle (rad), from the distance rolled. */
  angle = 0;
  /** Total distance rolled (px). */
  rolled = 0;
  /** Speed of the last wall hit (px/s), consumed with `consumeImpact()`. */
  private impact = 0;
  private force = 0;

  constructor(x: number, private readonly ground: (x: number) => number, private readonly o: RollerOpts) {
    this.x = x;
    this.r = o.radius;
  }

  /** Where the ball touches the ground. */
  get contact(): { x: number; y: number } { return { x: this.x, y: this.ground(this.x) }; }

  /** The ball's center, sitting on the ground (along the slope normal). */
  get center(): { x: number; y: number } {
    const a = this.slope;
    return { x: this.x + Math.sin(a) * this.r, y: this.ground(this.x) - Math.cos(a) * this.r };
  }

  /** Ground angle under the ball (rad, positive when the ground goes down to the right). */
  get slope(): number {
    const h = 6;
    return Math.atan2(this.ground(this.x + h) - this.ground(this.x - h), 2 * h);
  }

  /** Add a push (px/s² along x) for this step. */
  push(accel: number): void { this.force += accel; }

  /** Stop against a wall at `wallX`, facing the ball's direction of travel; returns true on a new hit. */
  wall(wallX: number, bounce = 0.2): boolean {
    const side = Math.sign(wallX - this.x) || 1;
    if (side * (this.x + side * this.r - wallX) < 0 || side * this.vx <= 0) return false;
    this.x = wallX - side * this.r;
    this.impact = Math.abs(this.vx);
    this.vx = -this.vx * bounce;
    return true;
  }

  /** The speed of the last hit, once (0 afterwards). */
  consumeImpact(): number { const i = this.impact; this.impact = 0; return i; }

  update(dt: number): void {
    const o = this.o, a = this.slope;
    this.vx += ((o.gravity ?? 1400) * (5 / 7) * Math.sin(a) * Math.cos(a) + this.force) * dt;
    this.vx *= Math.exp(-(o.friction ?? 0.6) * dt);
    this.force = 0;
    const dx = this.vx * dt, d = Math.abs(dx) / Math.max(0.2, Math.cos(a));
    this.x += dx;
    this.rolled += d;
    this.angle += Math.sign(dx) * d / this.r;
    if (o.grow) this.r = Math.min(o.maxRadius ?? Infinity, Math.sqrt(this.r * this.r + (o.grow * d) / Math.PI));
  }
}
