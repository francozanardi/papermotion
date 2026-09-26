import { describe, expect, it } from 'vitest';
import { Mixer, SoundLog, degree, encodeWav, hz, note, tempo, triad, voice } from '../src';

const SR = 8000;
const peak = (b: Float32Array) => b.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

describe('voices', () => {
  it('are deterministic per seed and differ between seeds', () => {
    const a = voice.noise({ duration: 0.1, seed: 3, filter: 'bandpass', freq: 1200, crackle: 0.5 }, SR);
    const b = voice.noise({ duration: 0.1, seed: 3, filter: 'bandpass', freq: 1200, crackle: 0.5 }, SR);
    const c = voice.noise({ duration: 0.1, seed: 4, filter: 'bandpass', freq: 1200, crackle: 0.5 }, SR);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('decay and stay finite', () => {
    for (const buf of [
      voice.thump({ duration: 0.6, seed: 1, from: 180, to: 50, sweep: 0.05, decay: 0.1, click: 0.5 }, SR),
      voice.pluck({ freq: 440, duration: 1.5, seed: 1, decay: 0.4 }, SR),
      voice.bell({ freq: 880, duration: 1.5, decay: 0.2 }, SR),
      voice.tone({ freq: 220, length: 0.3, release: 0.2, wave: 'saw', voices: 3, detune: 12, cutoff: 1500 }, SR),
    ]) {
      expect(buf.every(Number.isFinite)).toBe(true);
      expect(peak(buf)).toBeGreaterThan(0.05);
      expect(peak(buf.subarray(Math.floor(buf.length * 0.99)))).toBeLessThan(peak(buf) * 0.1);
    }
  });
});

describe('Mixer', () => {
  it('places sounds at their time, slows them with rate, and never exceeds the ceiling', () => {
    const click = new Float32Array(10).fill(1);
    const mix = new Mixer(1, SR).bus('fx');
    mix.add('fx', 0.5, click, { gain: 5 });
    mix.add('fx', 0.2, click, { rate: 0.5, gain: 0.2 });
    const { left, right } = mix.render({ ceiling: -1 });
    const first = left.findIndex(x => Math.abs(x) > 0.01);
    expect(first).toBe(0.2 * SR);
    expect(left.slice(0.2 * SR, 0.2 * SR + 18).every(x => x > 0.05)).toBe(true);
    expect(Math.abs(left[0.5 * SR + 5])).toBeGreaterThan(0.5);
    expect(Math.max(peak(left), peak(right))).toBeLessThanOrEqual(10 ** (-1 / 20) + 1e-6);
  });

  it('encodes a valid WAV header', () => {
    const bytes = encodeWav({ left: new Float32Array(100), right: new Float32Array(100) }, 48000);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF');
    expect(bytes.length).toBe(44 + 400);
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(48000);
  });
});

describe('music', () => {
  it('names notes, walks scales and builds chords', () => {
    expect(note('A4')).toBe(69);
    expect(note('C4')).toBe(60);
    expect(note('Bb3')).toBe(58);
    expect(hz(69)).toBeCloseTo(440);
    expect(degree(60, 'major', 7)).toBe(72);
    expect(degree(60, 'major', -1)).toBe(59);
    expect(triad(60, 'major', 1)).toEqual([62, 65, 69]);
    const at = tempo(120, 1);
    expect(at(0)).toBe(1);
    expect(at(4)).toBeCloseTo(3);
  });
});

describe('SoundLog', () => {
  it('keeps cues and interpolates levels', () => {
    const log = new SoundLog();
    log.cue('step', 1.2, { gain: 0.5 });
    log.level('speed', 0, 0);
    log.level('speed', 2, 100);
    expect(log.named('step')[0].at).toBe(1.2);
    const speed = log.track('speed');
    expect(speed(1)).toBeCloseTo(50);
    expect(speed(5)).toBe(100);
    expect(log.track('nothing')(1)).toBe(0);
  });
});
