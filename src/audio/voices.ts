import { Biquad, type FilterType, type Wave, decayEnvelope, gate, noiseSource, wave } from './dsp';

/** A value that is fixed or changes over the sound's own time (seconds from its start). */
export type Param = number | ((t: number) => number);
const at = (p: Param, t: number): number => (typeof p === 'number' ? p : p(t));

/**
 * Parametric voices: each renders one mono sound into a new buffer. They are the unit of sound design,
 * the way `PropMaker`s are for scenery: a scene composes its own sounds from them (a footstep in snow,
 * a door, a bell) by choosing parameters, and layering or sequencing the results in a `Mixer`.
 */
export const voice = {
  /**
   * Filtered noise with an envelope: steps, crunches, whooshes, puffs, surf, rain, wind.
   * `crackle` (0…1) turns the noise into sparse grains, the texture of paper, snow, gravel or fire.
   * `level` overrides the envelope for long, driven sounds (a rolling rumble following a speed).
   */
  noise(o: {
    duration: number; seed: number; filter: FilterType; freq: Param; q?: Param;
    attack?: number; decay?: number; hold?: number; crackle?: number; level?: Param; gain?: number;
  }, sr: number): Float32Array {
    const n = Math.ceil(o.duration * sr), out = new Float32Array(n), rnd = noiseSource(o.seed);
    const f = new Biquad(o.filter, at(o.freq, 0), at(o.q ?? 0.8, 0), sr);
    const dynamic = typeof o.freq !== 'number' || typeof o.q === 'function';
    const crackle = o.crackle ?? 0, gain = o.gain ?? 1;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if (dynamic && i % 16 === 0) f.set(at(o.freq, t), at(o.q ?? 0.8, t));
      let x = rnd();
      if (crackle > 0) { const g = rnd(); x = Math.abs(g) > 1 - crackle * 0.35 ? x * (2 + 6 * crackle) : x * (1 - crackle); }
      const env = o.level !== undefined ? at(o.level, t) : decayEnvelope(t, o.attack ?? 0.002, o.decay ?? 0.08, o.hold ?? 0);
      out[i] = f.process(x) * env * gain;
    }
    return out;
  },

  /**
   * A sine that drops in pitch: thuds, kicks, a body landing, a ball hitting a tree.
   * `click` adds a short noise transient for the contact; `tone` adds a second partial above the fundamental.
   */
  thump(o: { duration: number; seed: number; from: number; to: number; sweep: number; decay: number; attack?: number; click?: number; tone?: number; gain?: number }, sr: number): Float32Array {
    const n = Math.ceil(o.duration * sr), out = new Float32Array(n), rnd = noiseSource(o.seed);
    const click = new Biquad('bandpass', 2500, 0.7, sr);
    let phase = 0, phase2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, f = o.to + (o.from - o.to) * Math.exp(-t / o.sweep);
      phase += f / sr; phase2 += (f * 2.7) / sr;
      const body = Math.sin(2 * Math.PI * phase) + (o.tone ?? 0) * Math.sin(2 * Math.PI * phase2) * Math.exp(-t / (o.decay * 0.4));
      const c = (o.click ?? 0) * click.process(rnd()) * Math.exp(-t / 0.006);
      out[i] = (body * decayEnvelope(t, o.attack ?? 0.001, o.decay) + c * 3) * (o.gain ?? 1);
    }
    return out;
  },

  /** A plucked string (Karplus-Strong): harp, guitar, pizzicato, a music box when bright and short. */
  pluck(o: { freq: number; duration: number; seed: number; decay?: number; brightness?: number; gain?: number }, sr: number): Float32Array {
    const n = Math.ceil(o.duration * sr), out = new Float32Array(n), rnd = noiseSource(o.seed);
    const period = Math.max(2, Math.round(sr / o.freq)), line = new Float32Array(period);
    const bright = o.brightness ?? 0.5;
    const soften = new Biquad('lowpass', 800 + bright * 9000, 0.7, sr);
    for (let i = 0; i < period; i++) line[i] = soften.process(rnd());
    // Loop feedback that gives the requested ring time at this pitch.
    const fb = Math.exp(-period / (sr * Math.max(0.05, (o.decay ?? 1.2) / 6.9)) );
    let idx = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const cur = line[idx];
      const next = (cur * (0.5 + bright * 0.49) + prev * (0.5 - bright * 0.49)) * fb;
      prev = cur;
      line[idx] = next;
      idx = (idx + 1) % period;
      out[i] = cur * (o.gain ?? 1) * Math.min(1, i / 20);
    }
    return out;
  },

  /**
   * Two-operator FM: bells, celesta, glockenspiel, music box tines, glassy chimes.
   * `ratio` sets the timbre (non-integer = bell-like), `index` the brightness, which fades with `indexDecay`.
   */
  bell(o: { freq: number; duration: number; ratio?: number; index?: number; decay?: number; indexDecay?: number; attack?: number; gain?: number }, sr: number): Float32Array {
    const n = Math.ceil(o.duration * sr), out = new Float32Array(n);
    const ratio = o.ratio ?? 3.5, index = o.index ?? 2.5, decay = o.decay ?? 0.8, idec = o.indexDecay ?? decay * 0.4;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const mod = Math.sin(2 * Math.PI * o.freq * ratio * t) * index * Math.exp(-t / idec);
      out[i] = Math.sin(2 * Math.PI * o.freq * t + mod) * decayEnvelope(t, o.attack ?? 0.002, decay) * (o.gain ?? 1);
    }
    return out;
  },

  /**
   * A held oscillator note, optionally a stack of detuned voices through a low-pass: pads, bass,
   * organs, warm leads. `length` is how long it is held; `release` rings after that.
   */
  tone(o: {
    freq: Param; length: number; release?: number; attack?: number; wave?: Wave; voices?: number; detune?: number;
    cutoff?: Param; q?: number; vibrato?: { rate: number; depth: number }; seed?: number; gain?: number;
  }, sr: number): Float32Array {
    const release = o.release ?? 0.3, n = Math.ceil((o.length + release) * sr), out = new Float32Array(n);
    const shape = wave[o.wave ?? 'sine'], count = o.voices ?? 1, spread = o.detune ?? 0;
    const rnd = noiseSource(o.seed ?? 1);
    const phases = Array.from({ length: count }, () => (rnd() + 1) / 2);
    const lp = o.cutoff !== undefined ? new Biquad('lowpass', at(o.cutoff, 0), o.q ?? 0.7, sr) : null;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const vib = o.vibrato ? 2 ** ((Math.sin(2 * Math.PI * o.vibrato.rate * t) * o.vibrato.depth) / 1200) : 1;
      const f = at(o.freq, t) * vib;
      let s = 0;
      for (let v = 0; v < count; v++) {
        const cents = count > 1 ? (v / (count - 1) - 0.5) * spread : 0;
        phases[v] += (f * 2 ** (cents / 1200)) / sr;
        s += shape(phases[v] % 1);
      }
      s /= Math.sqrt(count);
      if (lp) { if (typeof o.cutoff === 'function' && i % 16 === 0) lp.set(at(o.cutoff, t), o.q ?? 0.7); s = lp.process(s); }
      out[i] = s * gate(t, o.length, o.attack ?? 0.01, release) * (o.gain ?? 1);
    }
    return out;
  },
};

/** Sum several mono buffers into one (longest length), each with its own gain and delay (s). */
export function layer(sr: number, ...parts: { buffer: Float32Array; gain?: number; delay?: number }[]): Float32Array {
  const len = Math.max(...parts.map(p => p.buffer.length + Math.round((p.delay ?? 0) * sr)));
  const out = new Float32Array(len);
  for (const p of parts) {
    const off = Math.round((p.delay ?? 0) * sr), g = p.gain ?? 1;
    for (let i = 0; i < p.buffer.length; i++) out[i + off] += p.buffer[i] * g;
  }
  return out;
}
