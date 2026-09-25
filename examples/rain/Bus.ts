import { type Paper, type V, circlePoly, clamp } from '../../src';

export interface BusLook { body: string; skirt: string; roof: string; glass: string; lit: string; pillar: string; tire: string; hub: string; rim: string; passenger: string }

export const BUS_LENGTH = 1320;
/** Distance from the front bumper to the middle of the front door. */
export const DOOR_FROM_FRONT = 250;
const HEIGHT = 520, CLEAR = 60, WHEEL = 54;

/**
 * A night bus seen from the side, driving right: lit windows with a few passengers, a folding front
 * door that opens onto a bright interior, turning wheels, head- and taillights. Kinematic: the
 * scene sets `x` (front bumper), `speed` and `door` (0 shut … 1 open).
 */
export class Bus {
  x: number;
  speed = 0;
  door = 0;
  private rolled = 0;

  constructor(x: number, private readonly ground: number, private readonly look: BusLook) {
    this.x = x;
  }

  get doorX(): number { return this.x - DOOR_FROM_FRONT; }
  get front(): V { return { x: this.x, y: this.ground - CLEAR - 120 }; }
  /** Wheel contact points (for spray). */
  get wheels(): V[] { return [this.x - 230, this.x - BUS_LENGTH + 250].map(x => ({ x, y: this.ground })); }

  update(dt: number): void {
    this.x += this.speed * dt;
    this.rolled += this.speed * dt;
  }

  draw(paper: Paper): void {
    const L = this.look, g = this.ground, x1 = this.x, x0 = x1 - BUS_LENGTH, top = g - CLEAR - HEIGHT, bottom = g - CLEAR;
    paper.sheet({ shadow: 10, rim: { color: L.rim, width: 3 }, shade: { color: 'rgba(0, 0, 0, 0.35)', width: 14 } }, () => {
      paper.blob([
        { x: x0 + 20, y: top + 10 }, { x: x1 - 120, y: top }, { x: x1 - 30, y: top + 40 }, { x: x1, y: top + 200 },
        { x: x1 + 4, y: bottom - 10 }, { x: x1 - 20, y: bottom + 4 }, { x: x0 + 10, y: bottom + 4 }, { x: x0 - 4, y: bottom - 30 }, { x: x0, y: top + 40 },
      ], L.body, { seed: 600, tear: 2 });
      paper.inside(() => this.drawSide(paper, x0, x1, top, bottom));
    });
    for (const w of this.wheels) this.drawWheel(paper, { x: w.x, y: g - WHEEL });
  }

  private drawSide(paper: Paper, x0: number, x1: number, top: number, bottom: number): void {
    const L = this.look, flat = (k: number) => ({ seed: 610 + k, tear: 1 });
    paper.piece([{ x: x0 - 20, y: bottom - 90 }, { x: x1 + 20, y: bottom - 90 }, { x: x1 + 20, y: bottom + 20 }, { x: x0 - 20, y: bottom + 20 }], L.skirt, flat(0));
    paper.piece([{ x: x0 - 20, y: top - 10 }, { x: x1 + 20, y: top - 10 }, { x: x1 + 20, y: top + 34 }, { x: x0 - 20, y: top + 34 }], L.roof, flat(1));

    // Windows, lit from inside, a few passengers looking out.
    const wy0 = top + 70, wy1 = top + 250, doorL = x1 - DOOR_FROM_FRONT - 62, doorR = x1 - DOOR_FROM_FRONT + 62;
    let k = 0;
    for (let wx = x0 + 60; wx + 150 < doorL - 20; wx += 176, k++) {
      const pane = [{ x: wx, y: wy0 }, { x: wx + 150, y: wy0 }, { x: wx + 150, y: wy1 }, { x: wx, y: wy1 }];
      paper.piece(pane, L.lit, flat(10 + k));
      if (k === 1 || k === 4) {
        paper.clip(pane, () => {
          const c = { x: wx + (k === 1 ? 60 : 96), y: wy1 - 40 };
          paper.blob([{ x: c.x - 34, y: wy1 + 10 }, { x: c.x - 26, y: c.y + 20 }, { x: c.x + 26, y: c.y + 20 }, { x: c.x + 34, y: wy1 + 10 }], L.passenger, flat(30 + k));
          paper.piece(circlePoly({ x: c.x, y: c.y - 14 }, 22, 14, 19), L.passenger, flat(40 + k));
        });
      }
      paper.line([{ x: wx + 10, y: wy0 + 12 }, { x: wx + 140, y: wy0 + 12 }], 'rgba(255, 255, 255, 0.35)', 3);
    }
    // Windshield and destination sign.
    paper.piece([{ x: x1 - 150, y: wy0 - 20 }, { x: x1 - 44, y: wy0 - 20 }, { x: x1 - 6, y: wy1 + 30 }, { x: x1 - 150, y: wy1 + 30 }], L.glass, flat(50));
    paper.piece([{ x: x1 - 300, y: top + 36 }, { x: x1 - 60, y: top + 36 }, { x: x1 - 60, y: top + 62 }, { x: x1 - 300, y: top + 62 }], L.lit, flat(51));

    // The door: two glass leaves that fold aside onto a bright doorway.
    const open = clamp(this.door), leaf = 62 * (1 - open * 0.8);
    paper.piece([{ x: doorL, y: wy0 - 10 }, { x: doorR, y: wy0 - 10 }, { x: doorR, y: bottom - 6 }, { x: doorL, y: bottom - 6 }], open > 0 ? L.lit : L.glass, flat(52));
    for (const [from, dir] of [[doorL, 1], [doorR, -1]] as const) {
      const a = from, b = from + dir * leaf;
      paper.piece([{ x: Math.min(a, b), y: wy0 - 10 }, { x: Math.max(a, b), y: wy0 - 10 }, { x: Math.max(a, b), y: bottom - 6 }, { x: Math.min(a, b), y: bottom - 6 }], L.glass, flat(53 + dir));
      paper.line([{ x: b, y: wy0 - 10 }, { x: b, y: bottom - 6 }], L.pillar, 5);
    }
    paper.line([{ x: x0 - 10, y: bottom - 100 }, { x: x1 + 10, y: bottom - 100 }], 'rgba(255, 255, 255, 0.25)', 4);
    // Lights: headlight and a lamp over the bumper; taillight at the back.
    paper.piece(circlePoly({ x: x1 - 24, y: bottom - 44 }, 18, 14, 14), '#fbfbf6', flat(60));
    paper.piece(circlePoly({ x: x0 + 18, y: bottom - 50 }, 16, 12, 10), '#8e8e8e', flat(61));
    for (const wx of [x1 - 230, x0 + 250]) paper.piece(circlePoly({ x: wx, y: this.ground - WHEEL }, WHEEL + 14, 20), '#1b1b1c', flat(62 + (wx > x0 + 400 ? 1 : 0)));
  }

  private drawWheel(paper: Paper, c: V): void {
    const L = this.look, a = this.rolled / WHEEL;
    paper.piece(circlePoly(c, WHEEL, 24), L.tire, { seed: 670 + Math.round(c.x), tear: 1, shadow: 4 });
    paper.piece(circlePoly(c, WHEEL * 0.52, 16), L.hub, { seed: 671, tear: 0.6, shadow: 0 });
    for (let k = 0; k < 5; k++) {
      const b = a + (k / 5) * Math.PI * 2;
      paper.piece(circlePoly({ x: c.x + Math.cos(b) * WHEEL * 0.34, y: c.y + Math.sin(b) * WHEEL * 0.34 }, 3.5, 6), L.tire, { seed: 672 + k, tear: 0, shadow: 0, edge: false });
    }
  }

  /** Headlight beam: a cone of light ahead of the bus, screened over the rain and the road. */
  drawBeam(paper: Paper, alpha: number): void {
    if (alpha <= 0) return;
    const h = { x: this.x - 20, y: this.ground - CLEAR - 44 };
    paper.layer(1, () => {
      const g = paper.context.createLinearGradient(h.x, h.y, h.x + 1100, h.y);
      g.addColorStop(0, `rgba(255, 255, 250, ${0.5 * alpha})`);
      g.addColorStop(1, 'rgba(255, 255, 250, 0)');
      paper.piece([{ x: h.x, y: h.y - 14 }, { x: h.x + 1100, y: h.y - 150 }, { x: h.x + 1100, y: this.ground + 40 }, { x: h.x, y: h.y + 14 }], g, { seed: 690, tear: 4, shadow: 0, edge: false, texture: 0 });
    }, 'screen');
  }

  /** Light spilling from the open door onto the road. */
  drawSpill(paper: Paper): void {
    if (this.door <= 0.02) return;
    const d = this.doorX, g = this.ground;
    paper.layer(this.door, () => {
      const grad = paper.context.createRadialGradient(d, g, 10, d, g, 420);
      grad.addColorStop(0, 'rgba(255, 255, 245, 0.55)');
      grad.addColorStop(1, 'rgba(255, 255, 245, 0)');
      paper.piece([{ x: d - 70, y: g - 6 }, { x: d + 70, y: g - 6 }, { x: d + 360, y: g + 70 }, { x: d - 360, y: g + 70 }], grad, { seed: 691, tear: 3, shadow: 0, edge: false, texture: 0 });
    }, 'screen');
  }
}
