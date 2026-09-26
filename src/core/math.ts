/** A 2D point or vector. */
export interface V { x: number; y: number }

export const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: V, s: number): V => ({ x: a.x * s, y: a.y * s });
export const len = (a: V): number => Math.hypot(a.x, a.y);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpV = (a: V, b: V, t: number): V => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const rot = (a: V, ang: number): V => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
export const clamp = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));
/**
 * Hermite ease from 0 at `e0` to 1 at `e1`. Edges may be ±Infinity ("hasn't happened yet"):
 * the result is then 0 before the edge and 1 after it, never NaN.
 */
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0));
  if (Number.isNaN(t)) return x >= e1 ? 1 : 0;
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
/** Ease out past the target and settle back (motion-design "back" ease); `t` is clamped to 0…1. */
export const overshoot = (t: number, s = 1.7): number => { const u = clamp(t) - 1; return 1 + u * u * ((s + 1) * u + s); };

/**
 * Two-bone IK. Returns the middle joint. `bend` (+1/-1) picks the side.
 * Targets beyond reach stretch the limb up to `stretch` (rubber-hose squash & stretch).
 */
export function ik(root: V, target: V, l1: number, l2: number, bend: number, stretch = 1.12): V {
  const d0 = len(sub(target, root));
  const reach = l1 + l2;
  const k = d0 > reach ? Math.min(d0 / reach, stretch) : 1;
  const a1 = l1 * k, a2 = l2 * k;
  const d = clamp(d0, 1e-3, (a1 + a2) * 0.999);
  const cosA = clamp((a1 * a1 + d * d - a2 * a2) / (2 * a1 * d), -1, 1);
  const base = Math.atan2(target.y - root.y, target.x - root.x);
  const ang = base + bend * Math.acos(cosA);
  return { x: root.x + Math.cos(ang) * a1, y: root.y + Math.sin(ang) * a1 };
}

/** Catmull-Rom through points (open curve). */
export function smooth(pts: V[], samples = 6): V[] {
  if (pts.length < 3) return pts;
  const out: V[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Catmull-Rom through points as a closed loop (smooth outlines from a few control points). */
export function smoothClosed(pts: V[], samples = 6): V[] {
  const n = pts.length, out: V[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let s = 0; s < samples; s++) {
      const t = s / samples, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}
