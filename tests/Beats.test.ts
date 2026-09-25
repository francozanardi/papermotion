import { describe, expect, it } from 'vitest';
import { Beats } from '../src';

const DT = 1 / 60;
const run = <B extends string>(beats: Beats<B>, seconds: number, from = 0) => {
  for (let t = from; t < from + seconds - 1e-9; t += DT) beats.update(t, DT);
};

describe('Beats', () => {
  it('moves on after a timed beat', () => {
    const beats = new Beats<'a' | 'b'>('a', { a: { after: 0.5, then: 'b' }, b: {} });
    run(beats, 0.4);
    expect(beats.current).toBe('a');
    run(beats, 0.2, 0.4);
    expect(beats.current).toBe('b');
    expect(beats.startOf('b')).toBeCloseTo(0.5, 1);
  });

  it('moves on when a condition holds, with the timeout as a fallback', () => {
    let touched = false;
    const beats = new Beats<'approach' | 'retreat'>('approach', {
      approach: { next: () => touched && 'retreat', after: 2, then: 'retreat' },
      retreat: {},
    });
    run(beats, 1);
    expect(beats.current).toBe('approach');
    touched = true;
    beats.update(1, DT);
    expect(beats.current).toBe('retreat');
    expect(beats.startOf('retreat')).toBe(1);

    const lonely = new Beats<'approach' | 'retreat'>('approach', { approach: { next: () => false, after: 2, then: 'retreat' }, retreat: {} });
    run(lonely, 2.1);
    expect(lonely.current).toBe('retreat');
  });

  it('runs enter, during and exit in order, with `since` measured from the beat start', () => {
    const log: string[] = [];
    const beats = new Beats<'a' | 'b'>('a', {
      a: { enter: () => log.push('enter a'), exit: () => log.push('exit a'), after: DT * 2, then: 'b' },
      b: { enter: ({ t }) => log.push(`enter b@${t.toFixed(3)}`), during: ({ since }) => log.push(`during b ${since.toFixed(3)}`) },
    });
    run(beats, DT * 4);
    expect(log[0]).toBe('enter a');
    expect(log[1]).toBe('exit a');
    expect(log[2]).toMatch(/^enter b@0\.033/);
    expect(log[3]).toBe('during b 0.000');
    expect(log[4]).toBe('during b 0.017');
  });

  it('chains several transitions in one step and records them', () => {
    const beats = new Beats<'a' | 'b' | 'c'>('a', { a: { next: () => 'b' }, b: { next: () => 'c' }, c: {} });
    beats.update(0, DT);
    expect(beats.current).toBe('c');
    expect(beats.history.map(h => h.beat)).toEqual(['a', 'b', 'c']);
    expect(beats.reached('b')).toBe(true);
  });

  it('accepts forced transitions', () => {
    const beats = new Beats<'idle' | 'hit'>('idle', { idle: {}, hit: {} });
    beats.update(0, DT);
    beats.go('hit', 1.5);
    expect(beats.current).toBe('hit');
    expect(beats.since(2)).toBeCloseTo(0.5);
  });
});
