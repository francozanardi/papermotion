import { type Stereo, db, softClip } from './dsp';

export interface BusOpts {
  /** Bus level (linear). */
  gain?: number;
  /** How much of the bus goes to the shared reverb (0…1). */
  reverb?: number;
}

export interface PlaceOpts {
  gain?: number;
  /** −1 left … 1 right (equal power). */
  pan?: number;
  /**
   * Playback speed: 1 as rendered, 0.35 plays it slower and lower, like tape in slow motion.
   * Match it to the scene's playback rate at the moment of the cue.
   */
  rate?: number;
}

export interface MixOpts {
  /** Shared reverb: room size and damping (0…1), and how wide it spreads. */
  reverb?: { room: number; damp: number; width?: number };
  /** Master gain in dB before the limiter. */
  master?: number;
  /** Peak ceiling in dBFS (the limiter keeps everything under it). Default −1. */
  ceiling?: number;
  /** Fade the whole mix in and out over these many seconds (match the picture's fades). */
  fadeIn?: number;
  fadeOut?: number;
}

interface Bus { gain: number; reverb: number; left: Float32Array; right: Float32Array }

/**
 * Lays sounds on a timeline and mixes them down to stereo: buses with their own level and reverb send,
 * one shared reverb, and a look-ahead limiter on the master so nothing clips. Times are in seconds of
 * the finished video.
 */
export class Mixer {
  private readonly buses = new Map<string, Bus>();
  readonly length: number;

  constructor(readonly duration: number, readonly sampleRate = 48000) {
    this.length = Math.ceil(duration * sampleRate);
  }

  bus(name: string, o: BusOpts = {}): this {
    this.buses.set(name, { gain: o.gain ?? 1, reverb: o.reverb ?? 0, left: new Float32Array(this.length), right: new Float32Array(this.length) });
    return this;
  }

  /** Place a mono buffer on a bus, starting at `at` seconds. Parts outside the timeline are dropped. */
  add(bus: string, at: number, buffer: Float32Array, o: PlaceOpts = {}): void {
    const b = this.buses.get(bus);
    if (!b) throw new Error(`Unknown bus "${bus}"`);
    const pan = Math.max(-1, Math.min(1, o.pan ?? 0)), a = ((pan + 1) * Math.PI) / 4;
    const gl = Math.cos(a) * (o.gain ?? 1), gr = Math.sin(a) * (o.gain ?? 1);
    const rate = o.rate ?? 1, start = Math.round(at * this.sampleRate);
    const n = Math.floor((buffer.length - 1) / rate);
    for (let i = 0; i < n; i++) {
      const j = start + i;
      if (j < 0) continue;
      if (j >= this.length) break;
      const p = i * rate, k = Math.floor(p), f = p - k;
      const s = buffer[k] + (buffer[k + 1] - buffer[k]) * f;
      b.left[j] += s * gl;
      b.right[j] += s * gr;
    }
  }

  render(o: MixOpts = {}): Stereo {
    const left = new Float32Array(this.length), right = new Float32Array(this.length);
    const sendL = new Float32Array(this.length), sendR = new Float32Array(this.length);
    for (const b of this.buses.values()) {
      for (let i = 0; i < this.length; i++) {
        const l = b.left[i] * b.gain, r = b.right[i] * b.gain;
        left[i] += l; right[i] += r;
        sendL[i] += l * b.reverb; sendR[i] += r * b.reverb;
      }
    }
    if (o.reverb) {
      const wet = freeverb({ left: sendL, right: sendR }, this.sampleRate, o.reverb);
      for (let i = 0; i < this.length; i++) { left[i] += wet.left[i]; right[i] += wet.right[i]; }
    }
    const g = db(o.master ?? 0);
    for (let i = 0; i < this.length; i++) { left[i] *= g; right[i] *= g; }
    limit({ left, right }, this.sampleRate, db(o.ceiling ?? -1));
    const fin = (o.fadeIn ?? 0) * this.sampleRate, fout = (o.fadeOut ?? 0) * this.sampleRate;
    for (let i = 0; i < this.length; i++) {
      const k = Math.min(fin > 0 ? i / fin : 1, fout > 0 ? (this.length - i) / fout : 1, 1);
      if (k < 1) { const e = k * k; left[i] *= e; right[i] *= e; }
    }
    return { left, right };
  }
}

/** Freeverb (Schroeder–Moorer): 8 damped combs and 4 all-passes per channel. Returns only the wet signal. */
export function freeverb(input: Stereo, sr: number, o: { room: number; damp: number; width?: number }): Stereo {
  const scale = sr / 44100, spread = 23;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], passes = [556, 441, 341, 225];
  const feedback = 0.7 + o.room * 0.28, damp = o.damp * 0.4;
  const channel = (x: Float32Array, offset: number): Float32Array => {
    const out = new Float32Array(x.length);
    for (const len of combs) {
      const size = Math.round((len + offset) * scale), buf = new Float32Array(size);
      let idx = 0, store = 0;
      for (let i = 0; i < x.length; i++) {
        const y = buf[idx];
        store = y * (1 - damp) + store * damp;
        buf[idx] = x[i] * 0.015 + store * feedback;
        idx = idx + 1 === size ? 0 : idx + 1;
        out[i] += y;
      }
    }
    for (const len of passes) {
      const size = Math.round((len + offset) * scale), buf = new Float32Array(size);
      let idx = 0;
      for (let i = 0; i < x.length; i++) {
        const b = buf[idx], v = out[i];
        buf[idx] = v + b * 0.5;
        out[i] = b - v;
        idx = idx + 1 === size ? 0 : idx + 1;
      }
    }
    return out;
  };
  const l = channel(input.left, 0), r = channel(input.right, spread), w = o.width ?? 1;
  const a = (1 + w) / 2, b = (1 - w) / 2;
  const left = new Float32Array(l.length), right = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) { left[i] = l[i] * a + r[i] * b; right[i] = r[i] * a + l[i] * b; }
  return { left, right };
}

/**
 * Look-ahead peak limiter, in place: the gain starts coming down a few ms before a peak and recovers
 * slowly after it, so loud hits get tamed without clicks. A soft clip catches what is left.
 */
export function limit(s: Stereo, sr: number, ceiling: number, lookahead = 0.005, release = 0.12): void {
  const n = s.left.length, block = Math.max(1, Math.round(lookahead * sr)), blocks = Math.ceil(n / block);
  const need = new Float32Array(blocks + 1).fill(1);
  for (let i = 0; i < n; i++) {
    const peak = Math.max(Math.abs(s.left[i]), Math.abs(s.right[i]));
    if (peak > ceiling) need[Math.floor(i / block)] = Math.min(need[Math.floor(i / block)], ceiling / peak);
  }
  const down = 1 - Math.exp(-3 / block), up = 1 - Math.exp(-1 / (release * sr));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(i / block), target = Math.min(need[k], need[k + 1]);
    g += (target - g) * (target < g ? down : up);
    s.left[i] = knee(s.left[i] * g, ceiling);
    s.right[i] = knee(s.right[i] * g, ceiling);
  }
}

/** Linear up to 85% of the ceiling, then bends smoothly toward it. */
function knee(x: number, ceiling: number): number {
  const a = Math.abs(x), k = ceiling * 0.85;
  return a <= k ? x : Math.sign(x) * (k + (ceiling - k) * softClip((a - k) / (ceiling - k)));
}

/** 16-bit PCM WAV bytes of a stereo signal. */
export function encodeWav(s: Stereo, sr: number): Uint8Array {
  const n = s.left.length, bytes = new Uint8Array(44 + n * 4), v = new DataView(bytes.buffer);
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.round(Math.max(-1, Math.min(1, s.left[i])) * 32767), true);
    v.setInt16(46 + i * 4, Math.round(Math.max(-1, Math.min(1, s.right[i])) * 32767), true);
  }
  return bytes;
}
