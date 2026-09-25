import { type V, clamp } from '../core/math';

/** Steering behaviours: each returns a desired velocity for `Swimmer.steer`. */
export const steer = {
  /** Go to a point, slowing down within `slow` px. */
  arrive(from: V, to: V, speed: number, slow = 150): V {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1e-6;
    const k = (speed * Math.min(1, d / slow)) / d;
    return { x: dx * k, y: dy * k };
  },
  /** Circle a point; `squash` < 1 flattens the orbit (a circle seen from the side). dir: 1 cw, -1 ccw. */
  orbit(from: V, center: V, radius: number, speed: number, dir = 1, squash = 1): V {
    const dx = from.x - center.x, dy = (from.y - center.y) / squash, d = Math.hypot(dx, dy) || 1e-6;
    const radial = clamp((radius - d) / radius * 2, -1, 1);
    const x = (-dy / d) * dir + (dx / d) * radial, y = ((dx / d) * dir + (dy / d) * radial) * squash;
    const l = Math.hypot(x, y) || 1;
    return { x: (x / l) * speed, y: (y / l) * speed };
  },
  /** Get away from a point, harder the closer it is (zero beyond `range`). */
  flee(from: V, threat: V, speed: number, range: number): V {
    const dx = from.x - threat.x, dy = from.y - threat.y, d = Math.hypot(dx, dy) || 1e-6;
    const k = (speed * Math.max(0, 1 - d / range)) / d;
    return { x: dx * k, y: dy * k };
  },
  add(...vs: V[]): V { return vs.reduce((a, b) => ({ x: a.x + b.x, y: a.y + b.y }), { x: 0, y: 0 }); },
};
