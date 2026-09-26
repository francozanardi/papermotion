import type { V } from '../core/math';
import { type Range, noise1, pick, within } from '../core/random';
import { circlePoly } from '../paper/geometry';
import type { PropMaker } from './scatter';

/** A bumpy circle: canopy lobes, bushes, clouds. */
export function scallop(c: V, r: number, bumps: number, phase: number): V[] {
  return Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    const k = 1 + Math.abs(Math.sin(a * bumps / 2 + phase)) * 0.12 - 0.06;
    return { x: c.x + Math.cos(a) * r * k, y: c.y + Math.sin(a) * r * k };
  });
}

/** Parametric procedural flora. Each maker returns a generator with its own ranges and palette. */
export const flora = {
  tuft(o: { blades: Range; height: Range; width: number; colors: string[] }): PropMaker {
    return (r, x, y, seed) => {
      const n = Math.round(within(r, o.blades));
      const color = pick(r, o.colors);
      const blades = Array.from({ length: n }, (_, i) => ({ a: (i / Math.max(1, n - 1) - 0.5) * 1.0 + (r() - 0.5) * 0.25, h: within(r, o.height) }));
      return {
        x, y,
        draw(paper, sway) {
          blades.forEach((b, i) => {
            const a = b.a + sway * (0.8 + i * 0.1);
            const mid = { x: x + Math.sin(a * 0.5) * b.h * 0.5, y: y - Math.cos(a * 0.5) * b.h * 0.5 };
            const tip = { x: x + Math.sin(a) * b.h, y: y - Math.cos(a) * b.h };
            paper.tube([{ x, y }, mid, tip], o.width, 1.5, color, { seed: seed + i, tear: 0.6, shadow: 3, edge: false });
          });
        },
      };
    };
  },

  /**
   * Broadleaf tree: tapered trunk splitting into branches, scalloped canopy lobes at the branch tips,
   * loose leaves on the silhouette. `leaves` is a dark → light palette assigned by height (self-shade);
   * `light` is the rim color on the side facing the scene light. Sway: trunk < branches < lobes.
   * `loose: false` leaves out the loose leaves.
   */
  tree(o: { height: Range; canopy: Range; trunk: string; leaves: string[]; light: string; lobes?: Range; branches?: Range; loose?: boolean }): PropMaker {
    return (r, x, y, seed) => {
      const h = within(r, o.height), cr = within(r, o.canopy);
      const lean = (r() - 0.5) * 0.12;
      const nb = Math.round(within(r, o.branches ?? [2, 3]));
      const branches = Array.from({ length: nb }, (_, i) => ({
        at: 0.58 + r() * 0.18, angle: (i / Math.max(1, nb - 1) - 0.5) * 0.9 + (r() - 0.5) * 0.25, len: h * (0.24 + r() * 0.1),
      }));
      // Crown: one central lobe plus a ring over the top half — a rounded mass, not a stack.
      const nl = Math.round(within(r, o.lobes ?? [4, 6]));
      const lobes = Array.from({ length: nl }, (_, i) => {
        const a = i === 0 ? 0 : -Math.PI / 2 + ((i - 1) / Math.max(1, nl - 2) - 0.5) * Math.PI * 1.15;
        const d = i === 0 ? 0 : cr * (0.5 + r() * 0.2);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8 + (i === 0 ? cr * 0.1 : 0), r: cr * (i === 0 ? 0.8 : 0.5 + r() * 0.2), bumps: 5 + Math.floor(r() * 4), phase: r() * 6 };
      });
      // Lower lobes sit in the canopy's own shade: drawn first and darker. Order and tone come from
      // the rest layout, so lobes that flutter past each other never swap places between frames.
      const order = lobes.map((_, i) => i).sort((a, b) => lobes[b].dy - lobes[a].dy);
      const highest = Math.min(...lobes.map(l => l.dy)), lowest = Math.max(...lobes.map(l => l.dy));
      const tones = lobes.map(l => {
        const lift = lowest > highest ? (lowest - l.dy) / (lowest - highest) : 1;
        return o.leaves[Math.min(o.leaves.length - 1, Math.round(lift * (o.leaves.length - 1)))];
      });
      const leaves = Array.from({ length: 5 + Math.floor(r() * 6) }, () => ({ a: r() * Math.PI * 2, d: 0.85 + r() * 0.3, lobe: Math.floor(r() * lobes.length), rot: r() * 3 }));
      return {
        x, y,
        draw(paper, sway, t) {
          const bend = lean + sway * 0.25;
          const top = { x: x + Math.sin(bend) * h * 0.72, y: y - Math.cos(bend) * h * 0.72 };
          const mid = { x: x + Math.sin(bend * 0.4) * h * 0.35, y: y - h * 0.36 };
          paper.tube([{ x, y: y + 6 }, mid, top], Math.max(6, h * 0.1), Math.max(3, h * 0.045), o.trunk, { seed, tear: 1, shadow: 6 });
          const crown = { x: top.x, y: top.y - cr * 0.35 };
          branches.forEach((br, i) => {
            const bx = x + Math.sin(bend) * h * br.at, by = y - Math.cos(bend) * h * br.at;
            const a = br.angle + bend * 1.6 + noise1(t * 0.9 + i, seed) * 0.05;
            const tip = { x: bx + Math.sin(a) * br.len, y: by - Math.cos(a) * br.len };
            paper.tube([{ x: bx, y: by }, { x: (bx + tip.x) / 2, y: (by + tip.y) / 2 - br.len * 0.1 }, tip], Math.max(3, h * 0.035), 2, o.trunk, { seed: seed + 3 + i, tear: 0.6, shadow: 4 });
          });
          const centers = lobes.map((l, i) => {
            const flutter = noise1(t * 1.8 + l.phase, seed + i) * cr * 0.04;
            const give = l.dy < 0 ? 1 - l.dy / cr : 1; // outer, higher lobes swing more
            return { x: crown.x + l.dx + sway * cr * 0.3 * give + flutter, y: crown.y + l.dy + flutter * 0.5 };
          });
          order.forEach(i => {
            const l = lobes[i];
            paper.piece(scallop(centers[i], l.r, l.bumps, l.phase), tones[i], {
              seed: seed + 10 + i, tear: Math.max(1.5, l.r * 0.05), shadow: 9, rim: { color: o.light, width: l.r * 0.16 },
            });
          });
          if (o.loose !== false) leaves.forEach((lf, i) => {
            const c = centers[lf.lobe], rr = lobes[lf.lobe].r * lf.d;
            const p = { x: c.x + Math.cos(lf.a) * rr, y: c.y + Math.sin(lf.a) * rr };
            const a = lf.rot + noise1(t * 3 + i, seed + 50) * 0.6;
            const s = Math.max(3, cr * 0.09);
            paper.piece([{ x: p.x - Math.cos(a) * s, y: p.y - Math.sin(a) * s }, { x: p.x - Math.sin(a) * s * 0.45, y: p.y + Math.cos(a) * s * 0.45 },
              { x: p.x + Math.cos(a) * s, y: p.y + Math.sin(a) * s }, { x: p.x + Math.sin(a) * s * 0.45, y: p.y - Math.cos(a) * s * 0.45 }],
            o.leaves[o.leaves.length - 1], { seed: seed + 60 + i, tear: 0.4, shadow: 3, edge: false });
          });
        },
      };
    };
  },

  pine(o: { height: Range; width: Range; trunk: string; leaves: string[]; tiers?: Range }): PropMaker {
    return (r, x, y, seed) => {
      const h = within(r, o.height), w = within(r, o.width);
      const tiers = Math.round(within(r, o.tiers ?? [3, 4]));
      const color = pick(r, o.leaves);
      return {
        x, y,
        draw(paper, sway) {
          paper.tube([{ x, y: y + 4 }, { x, y: y - h * 0.3 }], w * 0.12, w * 0.1, o.trunk, { seed, tear: 0.6, shadow: 4 });
          for (let i = 0; i < tiers; i++) {
            const k = i / tiers;
            const base = y - h * (0.2 + k * 0.6), ww = w * (1 - k * 0.55), tipY = base - h * 0.42;
            const s = sway * h * 0.05 * (1 + k);
            paper.piece([{ x: x - ww / 2 + s * 0.5, y: base }, { x: x + ww / 2 + s * 0.5, y: base }, { x: x + s, y: tipY }], color, { seed: seed + 5 + i, tear: 1.4, shadow: 6 });
          }
        },
      };
    };
  },

  bush(o: { size: Range; colors: string[]; lobes?: Range }): PropMaker {
    return (r, x, y, seed) => {
      const s = within(r, o.size);
      const n = Math.round(within(r, o.lobes ?? [3, 5]));
      const lobes = Array.from({ length: n }, (_, i) => ({
        dx: (i / Math.max(1, n - 1) - 0.5) * s * 1.4, dy: -r() * s * 0.4, r: s * (0.45 + r() * 0.35), c: pick(r, o.colors),
      }));
      return {
        x, y,
        draw(paper, sway) {
          lobes.forEach((l, i) => paper.piece(circlePoly({ x: x + l.dx + sway * s * 0.2 * (-l.dy / s + 0.3), y: y + l.dy - l.r * 0.5 }, l.r, 20), l.c, { seed: seed + i, tear: 1.6, shadow: 7 }));
        },
      };
    };
  },

  rock(o: { size: Range; colors: string[] }): PropMaker {
    return (r, x, y, seed) => {
      const s = within(r, o.size), c = pick(r, o.colors);
      const pts = Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI + (i / 8) * Math.PI;
        const k = 0.7 + r() * 0.35;
        return { x: x + Math.cos(a) * s * 1.3 * k, y: y + 6 + Math.sin(a) * s * k };
      });
      return { x, y, draw(paper) { paper.piece(pts, c, { seed, tear: 1.2, shadow: 6 }); } };
    };
  },

  flower(o: { height: Range; petals: string[]; stem: string; size: Range }): PropMaker {
    return (r, x, y, seed) => {
      const h = within(r, o.height), s = within(r, o.size), c = pick(r, o.petals);
      return {
        x, y,
        draw(paper, sway) {
          const top = { x: x + Math.sin(sway * 1.5) * h, y: y - Math.cos(sway * 1.5) * h };
          paper.tube([{ x, y }, { x: (x + top.x) / 2, y: (y + top.y) / 2 }, top], 2.5, 2, o.stem, { seed, tear: 0.3, shadow: 2, edge: false, texture: 0 });
          paper.piece(circlePoly(top, s, 12), c, { seed: seed + 1, tear: s * 0.25, shadow: 3 });
          paper.piece(circlePoly(top, s * 0.35, 8), '#ffe08a', { seed: seed + 2, tear: 0.3, shadow: 0, edge: false, texture: 0 });
        },
      };
    };
  },

  /** Branching coral (or bare shrub): recursive tapered branches with knobby tips. Tips sway most. */
  coral(o: { height: Range; colors: string[]; tip?: string; light?: string; depth?: number; spread?: number }): PropMaker {
    type Branch = { len: number; angle: number; kids: Branch[] };
    return (r, x, y, seed) => {
      const h = within(r, o.height), color = pick(r, o.colors), spread = o.spread ?? 1.1;
      const grow = (d: number, len: number, angle: number): Branch => {
        const n = d === 0 ? 0 : 2 + (r() > 0.65 ? 1 : 0);
        const kids: Branch[] = [];
        for (let i = 0; i < n; i++) kids.push(grow(d - 1, len * (0.62 + r() * 0.15), (i / (n - 1) - 0.5) * spread + (r() - 0.5) * 0.35));
        return { len, angle, kids };
      };
      const root = grow(o.depth ?? 3, h * 0.36, (r() - 0.5) * 0.2);
      const rim = o.light ? { color: o.light, width: 2.5 } : undefined;
      return {
        x, y,
        draw(paper, sway, t) {
          let k = 0;
          const walk = (b: Branch, from: V, a: number, w: number, d: number): void => {
            const ang = a + b.angle + sway * (0.3 + d * 0.3) + noise1(t * 0.7 + d * 1.3, seed + d) * 0.03 * d;
            const to = { x: from.x + Math.sin(ang) * b.len, y: from.y - Math.cos(ang) * b.len };
            paper.tube([from, { x: (from.x + to.x) / 2 + Math.cos(ang) * b.len * 0.06, y: (from.y + to.y) / 2 }, to], w, w * 0.72, color, { seed: seed + k++, tear: 0.6, shadow: 5, rim });
            if (!b.kids.length) paper.piece(circlePoly(to, w * 0.62, 10), o.tip ?? color, { seed: seed + k++, tear: 0.6, shadow: 2, edge: false });
            b.kids.forEach(kid => walk(kid, to, ang, w * 0.72, d + 1));
          };
          walk(root, { x, y: y + 4 }, 0, Math.max(3, h * 0.09), 0);
        },
      };
    };
  },

  cloud(o: { width: Range; color: string; shade: string }): PropMaker {
    return (r, x, y, seed) => {
      const w = within(r, o.width);
      const puffs = Array.from({ length: 5 }, (_, i) => ({ dx: (i / 4 - 0.5) * w, dy: -Math.sin((i / 4) * Math.PI) * w * 0.18 * (0.6 + r() * 0.6), r: w * (0.16 + Math.sin((i / 4) * Math.PI) * 0.1) }));
      return {
        x, y,
        draw(paper) {
          paper.piece([{ x: x - w * 0.6, y }, { x: x + w * 0.6, y }, { x: x + w * 0.5, y: y + w * 0.06 }, { x: x - w * 0.5, y: y + w * 0.06 }], o.shade, { seed, tear: 2, shadow: 0 });
          puffs.forEach((p, i) => paper.piece(circlePoly({ x: x + p.dx, y: y + p.dy }, p.r, 18), o.color, { seed: seed + 1 + i, tear: 2.2, shadow: 5 }));
        },
      };
    };
  },
};
