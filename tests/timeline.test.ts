import { describe, expect, it } from 'vitest';
import { blink, envelope, keys, ramp, smoothstep } from '../src';

describe('timeline', () => {
  it('ramps and envelopes', () => {
    expect(ramp(0, 1, 2)).toBe(0);
    expect(ramp(1.5, 1, 2)).toBeCloseTo(0.5);
    expect(ramp(3, 1, 2)).toBe(1);
    expect(envelope(2, 0, 1, 3, 4)).toBe(1);
    expect(envelope(5, 0, 1, 3, 4)).toBe(0);
  });

  it('blinks briefly around each time', () => {
    expect(blink(1, [1])).toBe(0);
    expect(blink(1.2, [1])).toBe(1);
    expect(blink(2, [1, 2])).toBe(0);
  });

  it('interpolates keys and holds the ends', () => {
    const speed = (t: number) => keys(t, [[1, 0], [2, 100], [3, 100], [4, 0]]);
    expect(speed(0)).toBe(0);
    expect(speed(1.5)).toBeCloseTo(50);
    expect(speed(2.5)).toBe(100);
    expect(speed(9)).toBe(0);
  });

  it('never returns NaN for events that have not happened (Infinity edges)', () => {
    expect(smoothstep(Infinity, Infinity, 3)).toBe(0);
    expect(smoothstep(Infinity, Infinity + 1, 3)).toBe(0);
    expect(envelope(3 - Infinity, 0, 0.5, 1, 1.5)).toBe(0);
  });
});
