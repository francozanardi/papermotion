import { type PointOpts, type Pt, World } from './World';

/** A string between two points that can go slack but not stretch. */
export function rope(world: World, a: Pt, b: Pt, length: number, segments: number, material: PointOpts, lay?: (x: number) => number): Pt[] {
  const seg = length / segments;
  const pts = [a];
  for (let i = 1; i < segments; i++) {
    const k = i / segments;
    const x = a.x + (b.x - a.x) * k;
    const y = a.y + (b.y - a.y) * k;
    const p = world.point(x, lay ? Math.min(lay(x), y) : y, material);
    world.link(pts[i - 1], p, 1, true, seg);
    pts.push(p);
  }
  world.link(pts[pts.length - 1], b, 1, true, seg);
  pts.push(b);
  return pts;
}
