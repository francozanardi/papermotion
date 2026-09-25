import {
  type Paper, type PropMaker, type RidgeSpec, type V, building, circlePoly, drawRipples, flora, hash, noise1, rng, scatter,
} from '../../src';

/** The road the whole story runs along: a field with a barbed-wire fence, then the edge of town and the bus stop. */
export const G = 1000;
export const ground = (x: number): number => G + noise1(x * 0.004, 5) * 3 + noise1(x * 0.03, 6) * 1.2;

export const FENCE = { from: -1600, to: 5600, every: 240, height: 150, wires: [48, 92, 134] };
/** Posts are here; wires sag between them. */
export const postAt = (i: number): number => FENCE.from + i * FENCE.every;
export function wireY(x: number, wire: number): number {
  const u = ((x - FENCE.from) / FENCE.every) % 1;
  return ground(x) - FENCE.wires[wire] + Math.sin(u * Math.PI) * 5;
}

export interface Puddle { x: number; rx: number; ry: number; seed: number }
export const PUDDLES: Puddle[] = ((r = rng(41)) => {
  const list: Puddle[] = [];
  for (let x = -1500; x < 9000; x += 260 + r() * 520) list.push({ x, rx: 60 + r() * 120, ry: 7 + r() * 6, seed: list.length });
  return list;
})();

const reed = (o: { height: [number, number]; color: string }): PropMaker => flora.tuft({ blades: [4, 7], height: o.height, width: 3, colors: [o.color] });

export const LAYERS = {
  clouds: scatter({ seed: 81, from: -4000, to: 9000, spacing: [260, 520], ground: x => 180 + noise1(x * 0.004, 2) * 120,
    makers: [{ make: flora.cloud({ width: [260, 520], color: '#1f1f22', shade: '#18181a' }), weight: 1 }] }),
  trees: scatter({ seed: 82, from: -4000, to: 9000, spacing: [50, 160], ground: () => 745, flex: 0.3, avoid: [[3600, 4300]],
    makers: [
      { make: flora.tree({ height: [90, 170], canopy: [40, 70], trunk: '#121213', leaves: ['#141415', '#171718', '#1a1a1b'], light: '#2e2e30' }), weight: 3 },
      { make: flora.pine({ height: [110, 180], width: [40, 60], trunk: '#121213', leaves: ['#131314', '#161617'] }), weight: 1 },
    ] }),
  town: scatter({ seed: 83, from: 5700, to: 9000, spacing: [120, 240], ground: () => 850, flex: 0,
    makers: [{ make: building({ width: [120, 220], height: [160, 320], colors: ['#1c1c1e', '#202022'], window: '#9c9c98', lit: 0.12 }), weight: 1 }] }),
  poles: { every: 720, height: 360 },
  reeds: scatter({ seed: 84, from: -2000, to: 6000, spacing: [18, 60], ground: x => ground(x) - 6, flex: 1.4,
    makers: [{ make: reed({ height: [22, 48], color: '#1b1b1c' }), weight: 1 }] }),
  grassNear: scatter({ seed: 85, from: -2000, to: 9000, spacing: [30, 90], ground: () => G + 150, flex: 1.6,
    makers: [{ make: reed({ height: [70, 150], color: '#0b0b0c' }), weight: 1 }] }),
};

export const HILLS: RidgeSpec = { seed: 86, base: 700, amp: 60, freq: 0.0012, color: '#19191b', tear: 3, shadow: 0 };

/** Sky: a heavy overcast that lightens toward the horizon; lightning lights the clouds from within. */
export function drawSky(ctx: CanvasRenderingContext2D, flash: number): void {
  const { width: w, height: h } = ctx.canvas;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const lift = Math.round(flash * 80);
  const gray = (v: number) => `rgb(${v + lift}, ${v + lift}, ${v + lift + 3})`;
  g.addColorStop(0, gray(14)); g.addColorStop(0.5, gray(34)); g.addColorStop(0.75, gray(62)); g.addColorStop(1, gray(70));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** A forked bolt from the clouds down behind the hills; deterministic from its seed. */
export function drawBolt(paper: Paper, top: V, bottom: number, seed: number, alpha: number): void {
  if (alpha <= 0.02) return;
  const r = rng(seed);
  const branch = (from: V, to: number, width: number, depth: number): void => {
    const pts = [from];
    let p = from;
    while (p.y < to) { p = { x: p.x + (r() - 0.5) * 60, y: p.y + 20 + r() * 40 }; pts.push(p); }
    paper.line(pts, `rgba(255, 255, 255, ${alpha})`, width);
    if (depth < 2) for (let k = 2; k < pts.length - 2; k += 3) if (r() > 0.5) branch(pts[k], pts[k].y + 80 + r() * 140, width * 0.5, depth + 1);
  };
  paper.layer(1, () => branch(top, bottom, 3.2, 0), 'screen', 'blur(1px)');
}

/** The road and the field's muddy edge, with puddles that mirror the sky and ring with rain. */
export function drawGround(paper: Paper, from: number, to: number, bottom: number, t: number, glow: (x: number) => number): void {
  const pts: V[] = [];
  for (let x = from - 20; x <= to + 20; x += 16) pts.push({ x, y: ground(x) });
  paper.piece([...pts, { x: to + 20, y: bottom }, { x: from - 20, y: bottom }], '#323235', { seed: 700, tear: 1.5, shadow: 0 });
  // A strip of wet road just below the edge, and tyre ruts.
  for (const [dy, c, w] of [[26, '#38383b', 18], [70, '#222223', 6], [112, '#222223', 6]] as const) {
    const band = pts.map(p => ({ x: p.x, y: p.y + dy + noise1(p.x * 0.01, dy) * 3 }));
    paper.line(band, c, w);
  }
  const ctx = paper.context;
  for (const p of PUDDLES) {
    if (p.x + p.rx < from || p.x - p.rx > to) continue;
    const y = ground(p.x) + 18 + (p.seed % 3) * 22;
    const lit = glow(p.x);
    const g = ctx.createLinearGradient(0, y - p.ry, 0, y + p.ry);
    g.addColorStop(0, `rgb(${60 + lit * 120}, ${60 + lit * 120}, ${64 + lit * 120})`);
    g.addColorStop(1, '#2a2a2c');
    paper.piece(circlePoly({ x: p.x, y }, p.ry, 24, p.rx), g, { seed: 710 + p.seed, tear: 2.5, shadow: 0, edge: false, texture: 0.1 });
    drawRipples(ctx, { x: p.x, y }, p.rx, p.ry, { seed: p.seed, rate: 9, life: 0.7, size: 16, squash: 0.25, rgb: '230, 230, 235', alpha: 0.5 }, t);
  }
}

/** Wooden posts and three strands of barbed wire. */
export function drawFence(paper: Paper, from: number, to: number, lens = 1): void {
  const first = Math.max(0, Math.floor((from - FENCE.from) / FENCE.every) - 1);
  for (let i = first; postAt(i) < Math.min(to + FENCE.every, FENCE.to); i++) {
    const x = postAt(i), lean = (hash(i * 13) - 0.5) * 0.08, h = FENCE.height + hash(i * 7) * 16;
    paper.tube([{ x, y: ground(x) + 8 }, { x: x + lean * h, y: ground(x) - h }], 13, 10, '#353331', { seed: 730 + i, tear: 1.2, shadow: 5, rim: { color: '#6e6e6c', width: 2 } });
  }
  const ctx = paper.context;
  ctx.save();
  ctx.strokeStyle = '#626262';
  ctx.lineWidth = 1.6 * Math.max(0.5, lens);
  const barb = 4 * Math.max(0.55, lens);
  for (let w = 0; w < FENCE.wires.length; w++) {
    ctx.beginPath();
    for (let x = Math.max(from, FENCE.from); x <= Math.min(to, FENCE.to); x += 12) (x === Math.max(from, FENCE.from) ? ctx.moveTo(x, wireY(x, w)) : ctx.lineTo(x, wireY(x, w)));
    ctx.stroke();
    ctx.beginPath();
    for (let x = Math.ceil(Math.max(from, FENCE.from) / 34) * 34; x <= Math.min(to, FENCE.to); x += 34) {
      const y = wireY(x, w);
      ctx.moveTo(x - barb, y - barb); ctx.lineTo(x + barb, y + barb); ctx.moveTo(x + barb, y - barb); ctx.lineTo(x - barb, y + barb);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Telegraph poles along the road, far behind, with sagging lines. */
export function drawPoles(paper: Paper, from: number, to: number, base: number): void {
  const { every, height } = LAYERS.poles, ctx = paper.context;
  const first = Math.floor(from / every) - 1, last = Math.ceil(to / every) + 1;
  for (let i = first; i <= last; i++) {
    const x = i * every;
    paper.tube([{ x, y: base }, { x, y: base - height }], 9, 7, '#1e1e20', { seed: 760 + i, tear: 1, shadow: 0 });
    paper.tube([{ x: x - 40, y: base - height + 20 }, { x: x + 40, y: base - height + 20 }], 6, 6, '#1e1e20', { seed: 780 + i, tear: 0.5, shadow: 0 });
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(40, 40, 44, 0.9)';
  ctx.lineWidth = 1.4;
  for (const dx of [-36, 36]) {
    ctx.beginPath();
    for (let i = first; i < last; i++) {
      const a = i * every + dx, b = a + every, y = base - height + 20;
      ctx.moveTo(a, y);
      ctx.quadraticCurveTo((a + b) / 2, y + 36, b, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** The stop: a street lamp with its cone of light and a pool on the wet road, and the bus-stop sign. */
export function drawStop(paper: Paper, lamp: number, sign: number): void {
  const g = ground(lamp), top = g - 440;
  paper.tube([{ x: lamp, y: g + 6 }, { x: lamp, y: top }, { x: lamp + 14, y: top - 22 }, { x: lamp + 70, y: top - 26 }], 12, 8, '#262627', { seed: 800, tear: 1, shadow: 6, rim: { color: '#9a9a98', width: 2 } });
  paper.blob([{ x: lamp + 46, y: top - 36 }, { x: lamp + 104, y: top - 34 }, { x: lamp + 108, y: top - 16 }, { x: lamp + 42, y: top - 18 }], '#1c1c1d', { seed: 801, tear: 0.8, shadow: 4 });
  paper.piece(circlePoly({ x: lamp + 76, y: top - 14 }, 7, 14, 24), '#ffffff', { seed: 802, tear: 0.4, shadow: 0, edge: false });
  const s = ground(sign);
  paper.tube([{ x: sign, y: s + 6 }, { x: sign, y: s - 300 }], 8, 7, '#2a2a2b', { seed: 803, tear: 0.8, shadow: 5, rim: { color: '#8a8a88', width: 2 } });
  paper.piece(circlePoly({ x: sign, y: s - 318 }, 34, 24), '#bdbdb8', { seed: 804, tear: 1, shadow: 5, rim: { color: '#f0f0ec', width: 2 } });
  paper.piece(circlePoly({ x: sign, y: s - 318 }, 26, 24), '#3a3a3b', { seed: 805, tear: 0.8, shadow: 0, edge: false });
  paper.piece([{ x: sign - 12, y: s - 330 }, { x: sign + 12, y: s - 330 }, { x: sign + 12, y: s - 306 }, { x: sign - 12, y: s - 306 }], '#bdbdb8', { seed: 806, tear: 0.5, shadow: 0, edge: false });
}

/** Where the lamp's light cone is, for rain to glint in and for puddles to catch. */
export const lampHead = (lamp: number): V => ({ x: lamp + 76, y: ground(lamp) - 454 });

export function drawLampLight(paper: Paper, lamp: number, strength: number): void {
  const h = lampHead(lamp), g = ground(lamp);
  paper.layer(1, () => {
    const ctx = paper.context;
    const cone = ctx.createLinearGradient(0, h.y, 0, g + 40);
    cone.addColorStop(0, `rgba(255, 255, 248, ${0.34 * strength})`);
    cone.addColorStop(1, `rgba(255, 255, 248, ${0.06 * strength})`);
    paper.piece([{ x: h.x - 14, y: h.y }, { x: h.x + 14, y: h.y }, { x: h.x + 260, y: g + 30 }, { x: h.x - 260, y: g + 30 }], cone, { seed: 810, tear: 3, shadow: 0, edge: false, texture: 0 });
    const pool = ctx.createRadialGradient(h.x, g + 30, 10, h.x, g + 30, 380);
    pool.addColorStop(0, `rgba(255, 255, 248, ${0.35 * strength})`);
    pool.addColorStop(1, 'rgba(255, 255, 248, 0)');
    paper.piece(circlePoly({ x: h.x, y: g + 40 }, 70, 28, 380), pool, { seed: 811, tear: 3, shadow: 0, edge: false, texture: 0 });
    const glow = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, 120);
    glow.addColorStop(0, `rgba(255, 255, 250, ${0.6 * strength})`);
    glow.addColorStop(1, 'rgba(255, 255, 250, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(h.x - 120, h.y - 120, 240, 240);
  }, 'screen');
}

/** The lamp's cone as a polygon, to clip glinting rain into it. */
export function lampCone(lamp: number): V[] {
  const h = lampHead(lamp), g = ground(lamp);
  return [{ x: h.x - 14, y: h.y }, { x: h.x + 14, y: h.y }, { x: h.x + 260, y: g + 30 }, { x: h.x - 260, y: g + 30 }];
}
