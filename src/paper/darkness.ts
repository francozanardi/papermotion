import type { View } from '../camera/Camera';
import type { V } from '../core/math';
import type { Paper } from './Paper';

/** A light that pushes back the dark: a fire, a torch, the spot of a flashlight. */
export interface Glow {
  at: V;
  /** Where the light has faded out (px). */
  radius: number;
  /** 0…1: how much of the dark it clears at its center. */
  strength: number;
  /** Fraction of the radius that stays fully lit. Default 0.15. */
  core?: number;
  /** Squash along y (a spot on a wall seen at an angle). Default 1. */
  aspect?: number;
}

/**
 * Night over what is already drawn: a veil of `rgb` at `alpha`, with the light of each glow cut out
 * of it (overlapping lights add up). Limit it to a `region` (a wall, the ground) so things drawn
 * later (the cast, lit by their own rim) stay bright. Draw it in the region's camera layer.
 */
export function darkness(paper: Paper, view: View, o: { rgb: string; alpha: number; lights: readonly Glow[]; region?: V[] }): void {
  if (o.alpha <= 0) return;
  paper.layer(1, () => {
    const c = paper.context;
    c.save();
    if (o.region) {
      const path = new Path2D();
      o.region.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
      path.closePath();
      c.clip(path);
    }
    c.fillStyle = `rgba(${o.rgb}, ${Math.min(1, o.alpha)})`;
    c.fillRect(view.from, view.top, view.to - view.from, view.bottom - view.top);
    c.globalCompositeOperation = 'destination-out';
    for (const l of o.lights) {
      if (!(l.strength > 0) || !(l.radius > 0)) continue;
      const sy = l.aspect ?? 1;
      c.save();
      c.translate(l.at.x, l.at.y);
      c.scale(1, sy);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, l.radius);
      g.addColorStop(0, `rgba(0, 0, 0, ${Math.min(1, l.strength)})`);
      g.addColorStop(l.core ?? 0.15, `rgba(0, 0, 0, ${Math.min(1, l.strength)})`);
      g.addColorStop(0.55, `rgba(0, 0, 0, ${Math.min(1, l.strength) * 0.4})`);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = g;
      c.fillRect(-l.radius, -l.radius, l.radius * 2, l.radius * 2);
      c.restore();
    }
    c.restore();
  });
}
