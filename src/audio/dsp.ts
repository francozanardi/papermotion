/**
 * Small, deterministic signal-processing building blocks. Everything works on plain Float32Arrays at a
 * given sample rate, with no Web Audio and no DOM, so a soundtrack renders the same in a browser and in Node.
 */

/** Two channels of the same length. */
export interface Stereo { left: Float32Array; right: Float32Array }

/** The frequency of a MIDI note (69 = A4 = 440 Hz). */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Decibels to linear gain. */
export const db = (d: number): number => 10 ** (d / 20);

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peak';

/**
 * A biquad filter (RBJ cookbook), one sample at a time. Change `set` per sample for sweeps.
 * `gain` (dB) only matters for 'peak'.
 */
export class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;

  constructor(private readonly type: FilterType, freq: number, q: number, private readonly sr: number, private readonly gain = 0) {
    this.set(freq, q);
  }

  set(freq: number, q: number): void {
    const f = Math.min(Math.max(freq, 10), this.sr * 0.45);
    const w = (2 * Math.PI * f) / this.sr, cos = Math.cos(w), alpha = Math.sin(w) / (2 * Math.max(q, 0.05));
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    switch (this.type) {
      case 'lowpass': b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
      case 'highpass': b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
      case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
      case 'notch': b0 = 1; b1 = -2 * cos; b2 = 1; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
      default: {
        const A = 10 ** (this.gain / 40);
        b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
      }
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** A one-pole smoother: follows a value with time constant `seconds` (declicks gain changes). */
export class Smoother {
  private k: number;
  value: number;
  constructor(seconds: number, sr: number, start = 0) { this.k = 1 - Math.exp(-1 / Math.max(1, seconds * sr)); this.value = start; }
  next(target: number): number { this.value += (target - this.value) * this.k; return this.value; }
}

/** Seeded white noise in −1…1 (xorshift), fast enough for audio rates. */
export function noiseSource(seed: number): () => number {
  let s = (seed * 2654435761) ^ 0x5bd1e995 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/**
 * An envelope: rises over `attack`, holds, then decays exponentially with time constant `decay`
 * (so −60 dB after about 7·decay). `t` in seconds from the start of the sound.
 */
export function decayEnvelope(t: number, attack: number, decay: number, hold = 0): number {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  const d = t - attack - hold;
  return d <= 0 ? 1 : Math.exp(-d / Math.max(decay, 1e-4));
}

/** A linear attack/sustain/release gate for held notes: 1 while held, fading out over `release`. */
export function gate(t: number, length: number, attack: number, release: number): number {
  if (t < 0) return 0;
  const a = attack > 0 ? Math.min(1, t / attack) : 1;
  return t < length ? a : a * Math.max(0, 1 - (t - length) / Math.max(release, 1e-4));
}

/** Oscillator shapes by phase (0…1 per cycle). The band-unlimited ones are softened by the caller's filters. */
export const wave = {
  sine: (p: number) => Math.sin(2 * Math.PI * p),
  triangle: (p: number) => 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5),
  saw: (p: number) => 2 * (p % 1) - 1,
  square: (p: number) => ((p % 1) < 0.5 ? 1 : -1),
};
export type Wave = keyof typeof wave;

/** Soft clipping that stays linear for small signals. */
export const softClip = (x: number): number => Math.tanh(x);
