import { describe, expect, it } from 'vitest';
import { pushBend } from '../src';

describe('pushBend', () => {
  const foot = { x: 100, y: 500 };

  it('parts grass to either side of a body and leaves it alone far away', () => {
    expect(pushBend(100, 500, foot)).toBe(0);
    expect(pushBend(140, 500, foot)).toBeGreaterThan(0);
    expect(pushBend(60, 500, foot)).toBeLessThan(0);
    expect(pushBend(400, 500, foot)).toBe(0);
  });

  it('fades as the body rises off the ground', () => {
    const low = pushBend(140, 500, foot), high = pushBend(140, 500, { x: 100, y: 420 });
    expect(Math.abs(high)).toBeLessThan(Math.abs(low));
    expect(pushBend(140, 500, { x: 100, y: 200 })).toBe(0);
  });

  it('is continuous, so blades never snap', () => {
    for (let x = 0; x < 200; x++) expect(Math.abs(pushBend(x + 1, 500, foot) - pushBend(x, 500, foot))).toBeLessThan(0.1);
  });
});
