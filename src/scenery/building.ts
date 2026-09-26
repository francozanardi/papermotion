import type { V } from '../core/math';
import { type Range, pick, within } from '../core/random';
import { circlePoly } from '../paper/geometry';
import type { PropMaker } from './scatter';

/**
 * Skyline building for background layers: a block with a flat, pitched or stepped top,
 * sparse lit windows, and sometimes a water tank or an antenna. `base` extends the block that far
 * below its ground line, so a skyline seen from above (or with a moving camera) never shows its
 * bottom edge floating over the sky.
 */
export function building(o: { width: Range; height: Range; colors: string[]; window: string; lit: number; base?: number }): PropMaker {
  return (r, x, y, seed) => {
    const w = within(r, o.width), h = within(r, o.height), color = pick(r, o.colors);
    const top = r();
    const wins: V[] = [];
    for (let wy = y - h + 24; wy < y - 20; wy += 34) for (let wx = x + 12; wx < x + w - 18; wx += 26) if (r() < o.lit) wins.push({ x: wx, y: wy });
    const extra = r(), foot = y + (o.base ?? 0);
    return {
      x, y,
      draw(paper) {
        const outline: V[] = top < 0.4
          ? [{ x, y: foot }, { x, y: y - h }, { x: x + w, y: y - h }, { x: x + w, y: foot }]
          : top < 0.75
            ? [{ x, y: foot }, { x, y: y - h }, { x: x + w / 2, y: y - h - w * 0.35 }, { x: x + w, y: y - h }, { x: x + w, y: foot }]
            : [{ x, y: foot }, { x, y: y - h }, { x: x + w * 0.3, y: y - h }, { x: x + w * 0.3, y: y - h - 26 }, { x: x + w * 0.7, y: y - h - 26 }, { x: x + w * 0.7, y: y - h }, { x: x + w, y: y - h }, { x: x + w, y: foot }];
        paper.piece(outline, color, { seed, tear: 2, shadow: 6 });
        if (top < 0.4 && extra < 0.35) {
          paper.piece(circlePoly({ x: x + w * 0.7, y: y - h - 18 }, 14, 12, 12), color, { seed: seed + 1, tear: 1, shadow: 3 });
          paper.line([{ x: x + w * 0.62, y: y - h }, { x: x + w * 0.62, y: y - h - 8 }], color, 3);
        } else if (extra > 0.8) {
          paper.line([{ x: x + w * 0.4, y: y - h }, { x: x + w * 0.4, y: y - h - 50 }], color, 2);
          paper.line([{ x: x + w * 0.4 - 14, y: y - h - 38 }, { x: x + w * 0.4 + 14, y: y - h - 38 }], color, 2);
        }
        wins.forEach((p, i) => paper.piece([p, { x: p.x + 11, y: p.y }, { x: p.x + 11, y: p.y + 15 }, { x: p.x, y: p.y + 15 }], o.window, { seed: seed + 10 + i, tear: 0.6, shadow: 0, edge: false, texture: 0.1 }));
      },
    };
  };
}
