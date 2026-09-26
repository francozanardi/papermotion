import { describe, expect, it } from 'vitest';
import { Roller, Tracks, snowflakes, type SnowSpec } from '../src';

const SNOW: SnowSpec = { seed: 3, density: 4, period: 0.7, speed: [50, 90], drift: 20, sway: 12, swayRate: 0.4, size: [2, 5], color: '#fff', alpha: [0.5, 1] };
const VIEW = { from: 0, to: 1920, top: 0, bottom: 1080 };

describe('snowflakes', () => {
  it('is a pure function of time', () => {
    expect(snowflakes(SNOW, VIEW, 7.3)).toEqual(snowflakes(SNOW, VIEW, 7.3));
  });

  it('fills the view and flakes fall smoothly', () => {
    const a = snowflakes(SNOW, VIEW, 5), b = snowflakes(SNOW, VIEW, 5 + 1 / 30);
    expect(a.length).toBeGreaterThan(100);
    expect(a.every(f => f.x >= 0 && f.x <= 1920 && f.y >= 0 && f.y <= 1080)).toBe(true);
    const byId = new Map(b.map(f => [f.id, f]));
    for (const f of a) {
      const g = byId.get(f.id);
      if (g) expect(Math.hypot(g.x - f.x, g.y - f.y)).toBeLessThan(6);
    }
  });
});

describe('Roller', () => {
  it('speeds up downhill, grows as it rolls and stops at a wall', () => {
    const ground = (x: number) => (x < 500 ? 0 : (x - 500) * 0.3);
    const ball = new Roller(520, ground, { radius: 10, grow: 12, maxRadius: 60 });
    for (let i = 0; i < 120; i++) ball.update(1 / 60);
    expect(ball.vx).toBeGreaterThan(100);
    expect(ball.r).toBeGreaterThan(10);
    expect(ball.r).toBeLessThanOrEqual(60);
    expect(ball.center.y).toBeLessThan(ground(ball.x));
    let hit = false;
    for (let i = 0; i < 600 && !hit; i++) { ball.update(1 / 60); hit = ball.wall(1500); }
    expect(hit).toBe(true);
    expect(ball.consumeImpact()).toBeGreaterThan(100);
    expect(ball.consumeImpact()).toBe(0);
    expect(ball.vx).toBeLessThanOrEqual(0);
  });
});

describe('Tracks', () => {
  it('leaves one print per planted foot and drops the oldest past capacity', () => {
    const tracks = new Tracks({ capacity: 3, spacing: 10 });
    expect(tracks.stamp({ x: 0, y: 0 }, { rx: 4, ry: 2 }, 0, 'foot')).toBe(true);
    expect(tracks.stamp({ x: 2, y: 0 }, { rx: 4, ry: 2 }, 0.1, 'foot')).toBe(false);
    for (let i = 1; i <= 4; i++) tracks.stamp({ x: i * 20, y: 0 }, { rx: 4, ry: 2 }, i, 'foot');
    expect(tracks.marks.map(m => m.x)).toEqual([40, 60, 80]);
  });
});
