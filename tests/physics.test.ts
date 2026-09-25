import { describe, expect, it } from 'vitest';
import { SoftBody, Surface, World, circlePoly, rope } from '../src';

const DT = 1 / 60;

function hangingRope(): World {
  const world = new World();
  world.wind = (x, _y, t) => ({ x: Math.sin(t * 3 + x * 0.01) * 80, y: 0 });
  const a = world.point(0, 0, { mass: Infinity }), b = world.point(200, 0, { mass: 1 });
  rope(world, a, b, 200, 12, { mass: 0.05, drag: 0.05 });
  return world;
}

describe('World', () => {
  it('is deterministic', () => {
    const w1 = hangingRope(), w2 = hangingRope();
    for (let i = 0; i < 240; i++) { w1.step(DT, i * DT); w2.step(DT, i * DT); }
    expect(w1.pts.map(p => [p.x, p.y])).toEqual(w2.pts.map(p => [p.x, p.y]));
  });

  it('keeps ropes from stretching under load', () => {
    const world = hangingRope();
    for (let i = 0; i < 240; i++) world.step(DT, i * DT);
    const pts = world.pts.slice(2);
    const length = [world.pts[0], ...pts].reduce((sum, p, i, all) => (i ? sum + Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) : 0), 0);
    expect(length).toBeLessThan(200 * 1.05);
  });

  it('hard colliders push points out at once; soft ones push gradually', () => {
    for (const soft of [undefined, 800]) {
      const world = new World();
      world.gravity = 0;
      const p = world.point(0, 0, { mass: 1, drag: 0.1 });
      world.colliders.push({ x: 5, y: 0, r: 20, soft });
      world.step(DT, 0);
      const moved = Math.abs(p.x);
      if (soft) expect(moved).toBeLessThan(5);
      else expect(moved).toBeCloseTo(15, 0);
      for (let i = 1; i < 120; i++) world.step(DT, i * DT);
      expect(Math.hypot(p.x - 5, p.y)).toBeGreaterThan(soft ? 17 : 19.9);
    }
  });
});

describe('SoftBody', () => {
  it('springs back to its rest shape after a dent', () => {
    const world = new World();
    world.gravity = 0;
    const body = new SoftBody(world, circlePoly({ x: 0, y: 0 }, 50, 16), { x: 300, y: 300 }, 0, { mass: 1, drag: 0.05, stiffness: 300, damping: 12 });
    const dent = world.colliders[world.colliders.push({ x: 300, y: 250, r: 25 }) - 1];
    for (let i = 0; i < 20; i++) world.step(DT, i * DT);
    const top = () => Math.min(...body.pts.map(p => p.y));
    expect(top()).toBeGreaterThan(260);
    dent.x = 10_000;
    for (let i = 0; i < 180; i++) world.step(DT, i * DT);
    expect(Math.max(...body.pts.map(p => p.y)) - top()).toBeCloseTo(100, -1);
  });

  it('follows an animated rest shape', () => {
    const world = new World();
    world.gravity = 0;
    const body = new SoftBody(world, circlePoly({ x: 0, y: 0 }, 50, 16), { x: 0, y: 0 }, 0, { mass: 1, drag: 0.05, stiffness: 300, damping: 12 });
    body.rest = circlePoly({ x: 0, y: 0 }, 30, 16);
    for (let i = 0; i < 180; i++) world.step(DT, i * DT);
    const width = Math.max(...body.pts.map(p => p.x)) - Math.min(...body.pts.map(p => p.x));
    expect(width).toBeCloseTo(60, -1);
  });
});

describe('Surface', () => {
  it('catches things falling from above and lets them pass from below', () => {
    const world = new World();
    world.surfaces.push(new Surface([{ x: 0, y: 500 }, { x: 200, y: 400 }]));
    const falling = world.point(100, 300, { mass: 1 });
    const rising = world.point(150, 600, { mass: 1, gravity: -1 });
    for (let i = 0; i < 120; i++) world.step(DT, i * DT);
    expect(falling.y).toBeCloseTo(450, 0);
    expect(falling.grounded).toBe(true);
    expect(rising.y).toBeLessThan(400);
    expect(world.floorBelow(100, 300)).toBeCloseTo(450);
    expect(world.floorBelow(100, 460)).toBe(world.ground(100));
  });
});
