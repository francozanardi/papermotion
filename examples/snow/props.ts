import { type Paper, type PropMaker, Spring, type V, noise1, pick, rng, within } from '../../src';

/** A pine in blue shadow with snow resting on the ledge of every tier. */
export function snowyPine(o: { height: [number, number]; width: [number, number]; colors: string[]; snow: string }): PropMaker {
  return (r, x, y, seed) => {
    const h = within(r, o.height), w = within(r, o.width), color = pick(r, o.colors);
    const tiers = 3 + Math.floor(r() * 2);
    return {
      x, y,
      draw(paper, sway) {
        paper.tube([{ x, y: y + 4 }, { x, y: y - h * 0.25 }], w * 0.1, w * 0.08, '#2c2a40', { seed, tear: 0.6, shadow: 3 });
        for (let i = 0; i < tiers; i++) {
          const k = i / tiers, base = y - h * (0.15 + k * 0.62), ww = w * (1 - k * 0.6), tip = base - h * 0.4;
          const s = sway * h * 0.05 * (1 + k);
          paper.piece([{ x: x - ww / 2 + s * 0.5, y: base }, { x: x + ww / 2 + s * 0.5, y: base }, { x: x + s, y: tip }], color, { seed: seed + 5 + i, tear: 1.2, shadow: 5 });
          // Snow on the tier: a thin cap hugging its upper edges and a ledge along its base.
          paper.piece([{ x: x - ww * 0.47 + s * 0.5, y: base - 2 }, { x: x - ww * 0.12 + s * 0.6, y: base - 7 }, { x: x + ww * 0.3 + s * 0.5, y: base - 4 }, { x: x + ww * 0.47 + s * 0.5, y: base }, { x: x - ww * 0.47 + s * 0.5, y: base + 3 }], o.snow, { seed: seed + 20 + i, tear: 1, shadow: 0, edge: false });
          paper.piece([{ x: x + s - ww * 0.1, y: tip + h * 0.1 }, { x: x + s, y: tip }, { x: x + s + ww * 0.1, y: tip + h * 0.1 }, { x: x + s, y: tip + h * 0.13 }], o.snow, { seed: seed + 40 + i, tear: 0.6, shadow: 0, edge: false });
        }
      },
    };
  };
}

/** A small house on a far layer: snow on its roof, a chimney and warm windows. */
export function cottage(o: { colors: string[]; roof: string; snow: string; window: string }): PropMaker {
  return (r, x, y, seed) => {
    const w = within(r, [70, 120]), h = within(r, [45, 70]), color = pick(r, o.colors), pitch = w * within(r, [0.35, 0.5]);
    const wins = 1 + Math.floor(r() * 2), chimney = r() < 0.7;
    return {
      x, y,
      draw(paper) {
        paper.piece([{ x, y }, { x, y: y - h }, { x: x + w, y: y - h }, { x: x + w, y }], color, { seed, tear: 1.2, shadow: 5 });
        if (chimney) paper.piece([{ x: x + w * 0.66, y: y - h - pitch * 0.4 }, { x: x + w * 0.66, y: y - h - pitch * 0.9 }, { x: x + w * 0.78, y: y - h - pitch * 0.9 }, { x: x + w * 0.78, y: y - h - pitch * 0.2 }], o.roof, { seed: seed + 1, tear: 0.8, shadow: 3 });
        paper.piece([{ x: x - 8, y: y - h + 4 }, { x: x + w / 2, y: y - h - pitch }, { x: x + w + 8, y: y - h + 4 }], o.roof, { seed: seed + 2, tear: 1.2, shadow: 4 });
        paper.piece([{ x: x - 10, y: y - h + 1 }, { x: x + w / 2, y: y - h - pitch - 6 }, { x: x + w + 10, y: y - h + 1 }, { x: x + w * 0.8, y: y - h - pitch * 0.3 }, { x: x + w / 2, y: y - h - pitch + 8 }, { x: x + w * 0.2, y: y - h - pitch * 0.25 }], o.snow, { seed: seed + 3, tear: 1.5, shadow: 0 });
        for (let i = 0; i < wins; i++) {
          const wx = x + w * (wins === 1 ? 0.4 : 0.22 + i * 0.4), wy = y - h * 0.62;
          paper.piece([{ x: wx, y: wy }, { x: wx + 14, y: wy }, { x: wx + 14, y: wy + 17 }, { x: wx, y: wy + 17 }], o.window, { seed: seed + 10 + i, tear: 0.5, shadow: 0, edge: false, texture: 0.1 });
        }
      },
    };
  };
}

interface Branch { from: V; to: V; w: number; give: number; kids: Branch[]; snow: number }

/**
 * The bare tree at the bottom of the hill, with snow lying along the top of its branches.
 * A hit kicks an angular spring: the crown shivers, branches whip, snow slides off.
 */
export class SnowTree {
  private readonly branches: Branch[] = [];
  private readonly shake = new Spring({ x: 0, y: 0 }, 70, 3.2);
  private t = 0;
  /** How much snow still lies on the branches, 1 … 0. */
  cover = 1;

  constructor(readonly x: number, readonly y: number, seed: number) {
    const r = rng(seed);
    const grow = (from: V, angle: number, len: number, w: number, depth: number, give: number): Branch => {
      const to = { x: from.x + Math.sin(angle) * len, y: from.y - Math.cos(angle) * len };
      const kids: Branch[] = [];
      if (depth > 0) {
        const n = depth > 1 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const a = angle + (i / (n - 1) - 0.5) * within(r, [0.7, 1.1]) + (r() - 0.5) * 0.25;
          kids.push(grow(to, a, len * within(r, [0.6, 0.75]), w * 0.62, depth - 1, give + 0.35));
        }
      }
      return { from, to, w, give, kids, snow: r() };
    };
    const base = { x, y: y - 300 };
    // A long, low branch reaches left over the spot where Clawd will stop.
    this.branches.push(
      { from: { x, y: y + 6 }, to: base, w: 34, give: 0, kids: [], snow: 0 },
      grow(base, -1.3, 250, 16, 2, 0.4),
      grow(base, -0.35, 190, 20, 3, 0.3),
      grow(base, 0.35, 180, 18, 3, 0.3),
      grow({ x: x + 3, y: y - 170 }, 1.05, 160, 13, 2, 0.35),
    );
  }

  /** Where the long left branch ends: the clump of snow that will fall sits there. */
  get reach(): V { return this.branches[1].to; }

  hit(strength: number): void { this.shake.vel.x += strength; }

  get shaking(): number { return Math.abs(this.shake.pos.x) + Math.abs(this.shake.vel.x) * 0.1; }

  update(dt: number): void {
    this.t += dt;
    this.shake.step({ x: 0, y: 0 }, dt);
  }

  draw(paper: Paper, rim: string): void {
    const s = this.shake.pos.x, t = this.t;
    const bend = (p: V, give: number): V => {
      const h = Math.max(0, this.y - p.y);
      return { x: p.x + (s * give + noise1(t * 0.6 + give, 7) * 0.01) * h * 0.6, y: p.y };
    };
    paper.sheet({ shadow: 8, rim: { color: rim, width: 3 }, shade: { color: 'rgba(10, 5, 30, 0.35)', width: 8 } }, () => {
      const walk = (b: Branch, parentGive: number): void => {
        const a = bend(b.from, parentGive), c = bend(b.to, b.give);
        const mid = { x: (a.x + c.x) / 2 + (c.y - a.y) * 0.05, y: (a.y + c.y) / 2 - Math.abs(c.x - a.x) * 0.06 };
        paper.tube([a, mid, c], b.w, Math.max(2, b.w * 0.6), '#3a3452', { seed: Math.round(b.from.x * 7 + b.to.y), tear: 0.8 });
        b.kids.forEach(k => walk(k, b.give));
      };
      this.branches.forEach(b => walk(b, 0));
    });
    // Snow along the top of the thicker branches.
    const walkSnow = (b: Branch, parentGive: number, i: number): void => {
      const a = bend(b.from, parentGive), c = bend(b.to, b.give);
      const flat = Math.abs(c.x - a.x) / (Math.hypot(c.x - a.x, c.y - a.y) || 1);
      if (flat > 0.35 && b.w > 5 && this.cover > 0.05) {
        const lift = b.w * 0.45, thick = (3 + b.w * 0.35 * flat) * this.cover;
        paper.ribbon([{ x: a.x, y: a.y - lift }, { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 - lift - thick * 0.3 }, { x: c.x, y: c.y - lift * 0.6 }], u => thick * Math.sin(Math.PI * (0.1 + u * 0.8)), '#eef2fb', { seed: 900 + i, tear: 1, shadow: 3 });
      }
      b.kids.forEach((k, j) => walkSnow(k, b.give, i * 3 + j + 1));
    };
    this.branches.forEach((b, i) => walkSnow(b, 0, i * 11));
  }
}
