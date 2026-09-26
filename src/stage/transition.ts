import { type V, clamp, easeInOut } from '../core/math';
import { noise1 } from '../core/random';

/**
 * Scene-to-scene transitions drawn in screen space, over a frame that already shows the outgoing
 * scene: `next` draws the incoming one, clipped to the revealed region, and a paper edge marks the
 * border. `u` runs 0…1 over the transition.
 */

export interface WipeOpts {
  seed: number;
  /** Direction the tear travels (rad): 0 sweeps left → right, π/2 top → bottom. */
  angle?: number;
  /** Roughness of the torn edge (px). */
  tear?: number;
  /** Color of the torn paper fibers along the edge. */
  paper?: string;
}

/** The old picture is torn away like a page, revealing the next one underneath. */
export function tearWipe(ctx: CanvasRenderingContext2D, u: number, next: () => void, o: WipeOpts): void {
  if (u <= 0) return;
  const { width: W, height: H } = ctx.canvas;
  const a = o.angle ?? 0, d = { x: Math.cos(a), y: Math.sin(a) }, n = { x: -d.y, y: d.x };
  const reach = Math.hypot(W, H) / 2 + 80, c = { x: W / 2, y: H / 2 };
  const s = -reach + 2 * reach * easeInOut(clamp(u));
  const tear = o.tear ?? 26;
  const edge: V[] = [];
  for (let k = -reach; k <= reach; k += 14) {
    const wob = noise1(k * 0.012, o.seed) * tear + noise1(k * 0.06, o.seed + 3) * tear * 0.35;
    edge.push({ x: c.x + d.x * (s + wob) + n.x * k, y: c.y + d.y * (s + wob) + n.y * k });
  }
  const behind = (p: V, k: number) => ({ x: p.x - d.x * k, y: p.y - d.y * k });
  reveal(ctx, [...edge, behind(edge[edge.length - 1], 2 * reach + 200), behind(edge[0], 2 * reach + 200)], next);
  paperEdge(ctx, edge, d, o);
}

/** An iris of torn paper opening from `center` (a moon, a porthole, an eye). */
export function irisWipe(ctx: CanvasRenderingContext2D, u: number, center: V, next: () => void, o: WipeOpts): void {
  if (u <= 0) return;
  const { width: W, height: H } = ctx.canvas;
  const far = Math.max(Math.hypot(center.x, center.y), Math.hypot(W - center.x, center.y), Math.hypot(center.x, H - center.y), Math.hypot(W - center.x, H - center.y));
  const r = (far + 60) * clamp(u) ** 1.6, tear = (o.tear ?? 18) * Math.min(1, r / 200);
  const ring: V[] = [];
  for (let i = 0; i < 96; i++) {
    const th = (i / 96) * Math.PI * 2, rr = r + noise1(i * 0.35, o.seed) * tear;
    ring.push({ x: center.x + Math.cos(th) * rr, y: center.y + Math.sin(th) * rr });
  }
  reveal(ctx, ring, next);
  ctx.save();
  ctx.strokeStyle = o.paper ?? '#f4ecdd';
  ctx.lineWidth = 7;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function reveal(ctx: CanvasRenderingContext2D, region: V[], next: () => void): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const path = new Path2D();
  region.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  path.closePath();
  ctx.clip(path);
  next();
  ctx.restore();
}

/** The white fibrous strip on the torn side, with a soft shadow cast onto the revealed picture. */
function paperEdge(ctx: CanvasRenderingContext2D, edge: V[], d: V, o: WipeOpts): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const strip = new Path2D();
  edge.forEach((p, i) => (i ? strip.lineTo(p.x, p.y) : strip.moveTo(p.x, p.y)));
  for (let i = edge.length - 1; i >= 0; i--) {
    const w = 10 + (noise1(i * 0.7, o.seed + 9) + 1) * 7;
    strip.lineTo(edge[i].x + d.x * w, edge[i].y + d.y * w);
  }
  strip.closePath();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = -d.x * 6;
  ctx.shadowOffsetY = -d.y * 6 + 3;
  ctx.fillStyle = o.paper ?? '#f4ecdd';
  ctx.fill(strip);
  ctx.restore();
}
