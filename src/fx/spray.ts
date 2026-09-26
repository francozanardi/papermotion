import type { V } from '../core/math';
import { hash } from '../core/random';

/**
 * Pigment sprayed onto a surface, optionally around a stencil: blown paint, an airbrush, a spray can,
 * soot on a wall, frost on glass. Stateless: `amount` says how much has landed so far, so it can grow
 * while it is sprayed and stays put afterwards, identical after any cut.
 */
export interface SpraySpec {
  seed: number;
  center: V;
  /** Reach of the spray (px); the haze fades to nothing at this radius. */
  radius: number;
  /** Pigment color as 'r, g, b'. */
  rgb: string;
  /** 0…1: how much has been sprayed. */
  amount: number;
  /** A stencil held against the surface: nothing lands inside this polygon. */
  mask?: V[];
  /** Specks at full amount. Default 900. */
  specks?: number;
  /** Opacity of the densest haze. Default 0.75. */
  opacity?: number;
  /** Squash the spray along y (a wider-than-tall cloud). Default 1. */
  aspect?: number;
}

/** A speck of a spray: offset from the center (as a fraction of the radius), size and opacity. */
export interface Speck { x: number; y: number; size: number; alpha: number }

/** The i-th speck of a spray: denser near the center, pure function of the seed and index. */
export function sprayFleck(seed: number, i: number): Speck {
  const h = (k: number) => hash(seed * 7919 + i * 31 + k);
  // Sum of uniforms: roughly Gaussian, so the pigment clusters near where it was aimed.
  const d = Math.abs(h(1) + h(2) + h(3) - 1.5) / 1.5, a = h(4) * Math.PI * 2;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, size: 0.5 + h(5) ** 2 * 2.4, alpha: 0.25 + h(6) * 0.6 };
}

/** Draw a spray in the current transform. */
export function drawSpray(ctx: CanvasRenderingContext2D, s: SpraySpec): void {
  if (!(s.amount > 0)) return;
  const k = Math.min(1, s.amount), c = s.center, R = s.radius, sy = s.aspect ?? 1;
  ctx.save();
  if (s.mask) {
    const clip = new Path2D();
    clip.rect(c.x - R * 2, c.y - R * 2 * sy, R * 4, R * 4 * sy);
    s.mask.forEach((p, i) => (i ? clip.lineTo(p.x, p.y) : clip.moveTo(p.x, p.y)));
    clip.closePath();
    ctx.clip(clip, 'evenodd');
  }
  ctx.translate(c.x, c.y);
  ctx.scale(1, sy);
  const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  const o = (s.opacity ?? 0.75) * (0.35 + 0.65 * k);
  haze.addColorStop(0, `rgba(${s.rgb}, ${o})`);
  haze.addColorStop(0.45, `rgba(${s.rgb}, ${o * 0.55 * k})`);
  haze.addColorStop(1, `rgba(${s.rgb}, 0)`);
  ctx.fillStyle = haze;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgb(${s.rgb})`;
  const n = Math.floor((s.specks ?? 900) * k);
  for (let i = 0; i < n; i++) {
    const f = sprayFleck(s.seed, i);
    ctx.globalAlpha = f.alpha * (1 - f.x * f.x - f.y * f.y * 0.5);
    ctx.fillRect(f.x * R * 1.1 - f.size / 2, f.y * R * 1.1 - f.size / 2, f.size, f.size);
  }
  ctx.restore();
}
