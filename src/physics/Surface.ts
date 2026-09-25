import type { V } from '../core/math';

/**
 * A one-way platform: a polyline, left to right, that things stand on and land on from above
 * but pass through from below (roofs, branches, shelves, a ridge line).
 */
export class Surface {
  /** @param pts polyline points, sorted by x. */
  constructor(readonly pts: readonly V[]) {}

  get from(): number { return this.pts[0].x; }
  get to(): number { return this.pts[this.pts.length - 1].x; }

  /** Height (y) of the surface at x, or undefined outside its span. */
  heightAt(x: number): number | undefined {
    const p = this.pts;
    if (x < p[0].x || x > p[p.length - 1].x) return undefined;
    for (let i = 1; i < p.length; i++) {
      if (x <= p[i].x) {
        const a = p[i - 1], b = p[i];
        return b.x === a.x ? Math.min(a.y, b.y) : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
      }
    }
    return p[p.length - 1].y;
  }
}
