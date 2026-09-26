import { describe, it, expect } from 'vitest';
import { Fire } from '../src/fx/Fire';

describe('Fire', () => {
  it('repeats wind-driven motion and particle emission for the same seed', () => {
    const make = () => new Fire({ x: 100, y: 200 }, { seed: 4, width: 60, height: 100 });
    const a = make(), b = make();
    for (let i = 0; i < 600; i++) for (const f of [a, b]) f.update(1 / 60, i / 60, 0.8, Math.sin(i / 90));
    expect(a.tips).toEqual(b.tips);
    expect(a.embers.list).toEqual(b.embers.list);
    expect(a.embers.list.length).toBeGreaterThan(0);
  });
  it('settles to extinguished without lingering particles or negative flame height', () => {
    const f = new Fire({ x: 0, y: 0 }, { seed: 9, width: 70, height: 150 });
    for (let i = 0; i < 300; i++) f.update(1 / 60, i / 60, 1);
    for (let i = 300; i < 1500; i++) f.update(1 / 60, i / 60, 0);
    expect(f.heat).toBeLessThan(0.0001);
    expect(f.embers.list).toHaveLength(0);
    expect(f.tips.every(p => Number.isFinite(p.x) && p.y <= 0 && p.y > -0.01)).toBe(true);
  });
  it('keeps weak flames upright enough to avoid horizontal folded strips in strong wind', () => {
    const f = new Fire({ x: 0, y: 0 }, { seed: 81, width: 96, height: 195 });
    for (let i = 0; i < 360; i++) {
      f.update(1 / 60, i / 60, 0.18, i < 180 ? 1.45 : -2);
      const spread = Math.sqrt(Math.min(1, f.heat));
      f.tips.forEach((tip, j) => {
        const base = (j - 3) * 96 / 9 * spread;
        expect(Math.abs(tip.x - base)).toBeLessThanOrEqual(-tip.y * 0.65 + 1e-8);
        expect(tip.y).toBeLessThan(0);
      });
    }
  });
  it('leans with the wind while preserving its fixed fuel position', () => {
    const f = new Fire({ x: 100, y: 200 }, { seed: 1, width: 60, height: 100, sparks: 0 });
    for (let i = 0; i < 180; i++) f.update(1 / 60, i / 60, 1, 2);
    expect(f.tips.reduce((sum, p) => sum + p.x, 0) / 7).toBeGreaterThan(120);
    expect(f.at).toEqual({ x: 100, y: 200 });
    expect(f.embers.list).toHaveLength(0);
  });
});
