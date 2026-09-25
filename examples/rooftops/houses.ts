import { type Paper, type PropMaker, type Range, type V, Surface, circlePoly, pick, rng, within } from '../../src';

export interface HousePalette { wall: string; wallShade: string; roof: string; tiles: string[]; ridge: string; window: string; windowDark: string; frame: string; rim: string }

/** A house seen from its long side: a roof you can walk along, windows, maybe a chimney. */
export interface HouseSpec {
  x: number;
  width: number;
  /** y of the eaves and of the ridge. */
  eave: number;
  ridge: number;
  /** Horizontal run of the hipped ends. */
  hip: number;
  palette: HousePalette;
  /** Window columns on the wall under the roof, and which are lit. */
  windows: { cols: number; lit: number[] };
  chimney?: { at: number; width: number; height: number };
  seed: number;
}

const OVERHANG = 10;

/** The roof's top edge — what cats walk on. */
export function roofSurface(h: HouseSpec): Surface {
  return new Surface([{ x: h.x - OVERHANG, y: h.eave }, { x: h.x + h.hip, y: h.ridge }, { x: h.x + h.width - h.hip, y: h.ridge }, { x: h.x + h.width + OVERHANG, y: h.eave }]);
}

/** Top of the chimney, where birds perch. */
export function chimneyTop(h: HouseSpec): V | undefined {
  return h.chimney && { x: h.x + h.chimney.at + h.chimney.width / 2, y: h.ridge - h.chimney.height };
}

export function drawHouse(paper: Paper, h: HouseSpec, bottom: number): void {
  const P = h.palette, r = rng(h.seed), rim = { color: P.rim, width: 3 };
  const left = h.x, right = h.x + h.width;
  if (h.chimney) {
    const c = h.chimney, cx = left + c.at, top = h.ridge - c.height;
    paper.piece([{ x: cx, y: h.ridge + 20 }, { x: cx, y: top }, { x: cx + c.width, y: top }, { x: cx + c.width, y: h.ridge + 20 }], P.wallShade, { seed: h.seed + 1, tear: 1.5, shadow: 6, rim });
    paper.piece([{ x: cx - 6, y: top + 10 }, { x: cx - 6, y: top - 2 }, { x: cx + c.width + 6, y: top - 2 }, { x: cx + c.width + 6, y: top + 10 }], P.ridge, { seed: h.seed + 2, tear: 1, shadow: 4, rim });
  }
  paper.piece([{ x: left, y: h.eave }, { x: right, y: h.eave }, { x: right, y: bottom }, { x: left, y: bottom }], P.wall, { seed: h.seed + 3, tear: 2, shadow: 10 });
  paper.piece([{ x: left, y: h.eave }, { x: right, y: h.eave }, { x: right, y: h.eave + 26 }, { x: left, y: h.eave + 26 }], P.wallShade, { seed: h.seed + 4, tear: 1.5, shadow: 0, edge: false });

  const span = h.width / h.windows.cols;
  for (let c = 0; c < h.windows.cols; c++) {
    for (let row = 0; row < 3; row++) {
      const wx = left + span * (c + 0.5), wy = h.eave + 70 + row * 150, lit = h.windows.lit.includes(c + row * h.windows.cols);
      const win = [{ x: wx - 22, y: wy }, { x: wx + 22, y: wy }, { x: wx + 22, y: wy + 64 }, { x: wx - 22, y: wy + 64 }];
      paper.piece(win.map(p => ({ x: p.x + (p.x > wx ? 5 : -5), y: p.y + (p.y > wy ? 5 : -5) })), P.frame, { seed: h.seed + 10 + c * 7 + row, tear: 1, shadow: 4 });
      paper.piece(win, lit ? P.window : P.windowDark, { seed: h.seed + 40 + c * 7 + row, tear: 0.8, shadow: 0, edge: false });
      paper.line([{ x: wx, y: wy }, { x: wx, y: wy + 64 }], P.frame, 3);
      paper.line([{ x: wx - 22, y: wy + 30 }, { x: wx + 22, y: wy + 30 }], P.frame, 3);
    }
  }

  const eave = h.eave + 14;
  const roof = [{ x: left - OVERHANG, y: h.eave }, { x: left + h.hip, y: h.ridge }, { x: right - h.hip, y: h.ridge }, { x: right + OVERHANG, y: h.eave }, { x: right + OVERHANG, y: eave }, { x: left - OVERHANG, y: eave }];
  paper.piece(roof, P.roof, { seed: h.seed + 5, tear: 1.6, shadow: 9, rim });
  const rows = Math.max(2, Math.round((h.eave - h.ridge) / 18));
  for (let k = 1; k < rows; k++) {
    const y = h.ridge + ((h.eave - h.ridge) * k) / rows, inset = h.hip * (1 - k / rows);
    paper.piece([{ x: left + inset - OVERHANG * (k / rows), y }, { x: right - inset + OVERHANG * (k / rows), y }, { x: right - inset + OVERHANG * (k / rows), y: y + 5 }, { x: left + inset - OVERHANG * (k / rows), y: y + 5 }],
      pick(r, P.tiles), { seed: h.seed + 60 + k, tear: 1.2, shadow: 0, edge: false });
  }
  paper.piece([{ x: left + h.hip - 4, y: h.ridge - 3 }, { x: right - h.hip + 4, y: h.ridge - 3 }, { x: right - h.hip + 4, y: h.ridge + 6 }, { x: left + h.hip - 4, y: h.ridge + 6 }], P.ridge, { seed: h.seed + 6, tear: 1, shadow: 3, rim });
}

/**
 * Skyline building for background layers: a block with a flat, pitched or stepped top,
 * sparse lit windows, and sometimes a water tank or an antenna.
 */
export function building(o: { width: Range; height: Range; colors: string[]; window: string; lit: number }): PropMaker {
  return (r, x, y, seed) => {
    const w = within(r, o.width), h = within(r, o.height), color = pick(r, o.colors);
    const top = r();
    const wins: V[] = [];
    for (let wy = y - h + 24; wy < y - 20; wy += 34) for (let wx = x + 12; wx < x + w - 18; wx += 26) if (r() < o.lit) wins.push({ x: wx, y: wy });
    const extra = r();
    return {
      x, y,
      draw(paper) {
        const outline: V[] = top < 0.4
          ? [{ x, y }, { x, y: y - h }, { x: x + w, y: y - h }, { x: x + w, y }]
          : top < 0.75
            ? [{ x, y }, { x, y: y - h }, { x: x + w / 2, y: y - h - w * 0.35 }, { x: x + w, y: y - h }, { x: x + w, y }]
            : [{ x, y }, { x, y: y - h }, { x: x + w * 0.3, y: y - h }, { x: x + w * 0.3, y: y - h - 26 }, { x: x + w * 0.7, y: y - h - 26 }, { x: x + w * 0.7, y: y - h }, { x: x + w, y: y - h }, { x: x + w, y }];
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
