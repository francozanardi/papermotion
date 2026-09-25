import { type V } from '../core/math';

/** A circle (or ellipse with `rx`) as a polygon of `n` points. */
export function circlePoly(c: V, r: number, n = 28, rx = r): V[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: c.x + Math.cos(a) * rx, y: c.y + Math.sin(a) * r };
  });
}

/** Outline of a strip along `pts` with a width profile `width(u)`, u in 0…1, with round caps. */
export function tubePoly(pts: V[], width: (u: number) => number): V[] {
  const left: V[] = [], right: V[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = width(i / (n - 1)) / 2;
    left.push({ x: pts[i].x - (dy / d) * w, y: pts[i].y + (dx / d) * w });
    right.push({ x: pts[i].x + (dy / d) * w, y: pts[i].y - (dx / d) * w });
  }
  return [...left, ...cap(pts[n - 1], pts[n - 2], width(1) / 2), ...right.reverse(), ...cap(pts[0], pts[1], width(0) / 2)];
}

function cap(end: V, prev: V, r: number): V[] {
  const base = Math.atan2(end.y - prev.y, end.x - prev.x);
  return Array.from({ length: 7 }, (_, i) => {
    const a = base + Math.PI / 2 - (i / 6) * Math.PI;
    return { x: end.x + Math.cos(a) * r, y: end.y + Math.sin(a) * r };
  });
}

/** Points every `spacing` px along a closed polygon. */
export function resample(poly: V[], spacing: number): V[] {
  const out: V[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / spacing));
    for (let s = 0; s < steps; s++) out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
  }
  return out;
}

/** Axis-aligned bounding box. */
export function bounds(poly: V[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
