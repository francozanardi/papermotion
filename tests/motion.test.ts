import { describe, expect, it } from 'vitest';
import { type Prop, type SwimSpec, Swimmer, drawProps, steer } from '../src';
import type { Paper } from '../src';

const DT = 1 / 60;
const SPEC: SwimSpec = { maxSpeed: 300, accel: 600, drag: 4, beat: [1, 0.01], turn: 0.3, maxPitch: 0.6 };

describe('Swimmer', () => {
  it('turns around like paper when it reverses', () => {
    const fish = new Swimmer({ x: 0, y: 0 }, SPEC, 1);
    const flips: number[] = [];
    for (let i = 0; i < 120; i++) {
      fish.steer({ x: -200, y: 0 });
      fish.update(DT);
      flips.push(fish.flip);
    }
    expect(fish.facing).toBe(-1);
    expect(fish.flip).toBe(-1);
    expect(flips.some(f => Math.abs(f) < 0.1)).toBe(true);
  });

  it('bleeds off a kick back to cruising speed', () => {
    const fish = new Swimmer({ x: 0, y: 0 }, SPEC, 1);
    fish.kick({ x: 900, y: 0 });
    for (let i = 0; i < 90; i++) { fish.steer({ x: 100, y: 0 }); fish.update(DT); }
    expect(Math.hypot(fish.vel.x, fish.vel.y)).toBeLessThan(SPEC.maxSpeed + 1);
  });

  it('arrives and slows down near the target', () => {
    const far = steer.arrive({ x: 0, y: 0 }, { x: 1000, y: 0 }, 200, 100);
    const close = steer.arrive({ x: 0, y: 0 }, { x: 20, y: 0 }, 200, 100);
    expect(far.x).toBeCloseTo(200);
    expect(close.x).toBeCloseTo(40);
  });
});

describe('drawProps pushers', () => {
  const sways: number[] = [];
  const tuft: Prop = { x: 0, y: 1000, draw: (_p, sway) => { sways.push(sway); } };
  const set = { props: [tuft], flex: 0 };
  const paper = {} as Paper;

  it('bend props smoothly as a body walks through them (no snapping)', () => {
    sways.length = 0;
    for (let x = -120; x <= 120; x += 2) drawProps(paper, set, -500, 500, () => 0, 0, [{ x, y: 1000 }]);
    const steps = sways.slice(1).map((s, i) => Math.abs(s - sways[i]));
    expect(Math.max(...steps)).toBeLessThan(0.05);
    expect(Math.max(...sways.map(Math.abs))).toBeGreaterThan(0.4);
  });

  it('ignore bodies far above the ground', () => {
    sways.length = 0;
    drawProps(paper, set, -500, 500, () => 0, 0, [{ x: 30, y: 500 }]);
    expect(sways[0]).toBe(0);
  });
});
