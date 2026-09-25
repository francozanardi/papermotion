import { type Paper, type Pt, type V, add, Plate, rope, rot, World } from '../../src';

const PAPER = { mass: 0.35, drag: 0.03, dragY: 0.07, friction: 0.35 };

/** A diamond kite: an aerofoil plate, a string tied to a hand, and a tail of bows. */
export class Kite {
  readonly plate: Plate;
  readonly string: Pt[];
  readonly tail: Pt[];

  constructor(world: World, hand: Pt, center: V, angle: number, length: number) {
    this.plate = new Plate(world, [{ x: 0, y: -62 }, { x: 48, y: 0 }, { x: 0, y: 92 }, { x: -48, y: 0 }, { x: 0, y: -4 }], center, angle, PAPER)
      .aerofoil({ lift: 7.5, liftRange: [80, 420], flutter: 2600, weathervane: 5200, lean: 0.35, seed: 5 }, 0, 2);
    const [, , bottom, , bridle] = this.plate.pts;
    this.string = rope(world, hand, bridle, length, 22, { mass: 0.03, drag: 0.03, friction: 0.7 }, world.ground);
    this.tail = world.chain(bottom, 9, 15, rot({ x: 0, y: 1 }, angle), { mass: 0.06, drag: 0.12, friction: 0.5 });
  }

  get bridle(): Pt { return this.plate.pts[4]; }

  draw(paper: Paper): void {
    const [top, right, bottom, left, bridle] = this.plate.pts;
    paper.line(this.tail, 'rgba(250, 240, 222, 0.85)', 2);
    this.tail.forEach((p, i) => {
      if (i === 0 || i % 3 !== 0) return;
      const prev = this.tail[i - 1];
      const a = Math.atan2(p.y - prev.y, p.x - prev.x) + Math.PI / 2;
      const wing = (s: number) => [p, add(p, rot({ x: 14 * s, y: -7 }, a)), add(p, rot({ x: 14 * s, y: 7 }, a))];
      paper.piece(wing(1), '#ffd166', { seed: 300 + i, tear: 0.8, shadow: 4 });
      paper.piece(wing(-1), '#ffc043', { seed: 320 + i, tear: 0.8, shadow: 4 });
    });
    paper.piece([top, bottom, left], '#e2463c', { seed: 201, tear: 2 });
    paper.piece([top, right, bottom], '#f28c38', { seed: 202, tear: 2, shadow: 0 });
    paper.tube([top, bottom], 4, 4, '#7a2a22', { seed: 203, tear: 0.6, shadow: 0, texture: 0 });
    paper.tube([left, bridle, right], 4, 4, '#7a2a22', { seed: 204, tear: 0.6, shadow: 0, texture: 0 });
  }

  drawString(paper: Paper): void {
    paper.line(this.string, 'rgba(250, 240, 222, 0.9)', 2);
  }
}
