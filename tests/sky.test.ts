import { describe, expect, it } from 'vitest';
import { skyPoint, sprayFleck, starSky, type SkySpec } from '../src';

const SPEC: SkySpec = { seed: 5, pole: { x: 400, y: -300 }, radius: 2000, count: 800, band: { angle: 0.9, offset: 300, width: 160, stars: 600, clouds: 40 } };

describe('starSky', () => {
  it('is deterministic for a seed', () => {
    expect(starSky(SPEC)).toEqual(starSky(SPEC));
    expect(starSky(SPEC).stars).toHaveLength(1400);
    expect(starSky(SPEC).clouds).toHaveLength(40);
  });

  it('keeps most stars faint and a few bright', () => {
    const { stars } = starSky(SPEC);
    const bright = stars.filter(s => s.mag > 0.7).length, faint = stars.filter(s => s.mag < 0.2).length;
    expect(bright).toBeGreaterThan(10);
    expect(faint).toBeGreaterThan(bright * 5);
  });

  it('turns stars around the pole without changing their distance', () => {
    const sky = starSky(SPEC), s = sky.stars[17];
    const a = skyPoint(sky, s, 0), b = skyPoint(sky, s, 1.3), c = skyPoint(sky, s, Math.PI * 2);
    const d = (p: { x: number; y: number }) => Math.hypot(p.x - SPEC.pole.x, p.y - SPEC.pole.y);
    expect(d(b)).toBeCloseTo(d(a), 6);
    expect(c.x).toBeCloseTo(a.x, 6);
    expect(c.y).toBeCloseTo(a.y, 6);
  });
});

describe('sprayFleck', () => {
  it('is pure and stays within the spray radius', () => {
    expect(sprayFleck(3, 12)).toEqual(sprayFleck(3, 12));
    for (let i = 0; i < 500; i++) {
      const f = sprayFleck(9, i);
      expect(Math.hypot(f.x, f.y)).toBeLessThanOrEqual(1);
      expect(f.alpha).toBeGreaterThan(0);
    }
  });

  it('clusters toward the center', () => {
    const d = Array.from({ length: 2000 }, (_, i) => { const f = sprayFleck(4, i); return Math.hypot(f.x, f.y); });
    expect(d.filter(x => x < 0.5).length).toBeGreaterThan(d.length * 0.6);
  });
});
