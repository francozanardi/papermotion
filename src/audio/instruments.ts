import { hz } from './dsp';
import { layer, voice } from './voices';

/**
 * Ready-made instruments built from the voices: pitched sounds for scores, each a function of a MIDI
 * note that returns a mono buffer peaking near 1 (set the level when placing it). Parameters shape the
 * timbre; scenes pick and tune them, the way they pick flora makers.
 */
export const instrument = {
  /** FM tine with a faint octave: music box, celesta. */
  musicBox(midi: number, sr: number, o: { decay?: number } = {}): Float32Array {
    const d = o.decay ?? 0.55;
    return layer(sr,
      { buffer: voice.bell({ freq: hz(midi), duration: d * 4, ratio: 4, index: 1.3, decay: d, indexDecay: 0.06 }, sr) },
      { buffer: voice.bell({ freq: hz(midi + 12), duration: d * 2.2, ratio: 3, index: 0.6, decay: d * 0.45 }, sr), gain: 0.25 },
    );
  },

  /** Wooden bar: a quick, round strike (marimba, xylophone when high). */
  mallet(midi: number, sr: number, o: { decay?: number } = {}): Float32Array {
    const d = o.decay ?? 0.3;
    return layer(sr,
      { buffer: voice.bell({ freq: hz(midi), duration: d * 5, ratio: 1, index: 0.7, decay: d, indexDecay: 0.02 }, sr) },
      { buffer: voice.bell({ freq: hz(midi) * 3.9, duration: d * 1.2, ratio: 1, index: 0, decay: d * 0.18 }, sr), gain: 0.3 },
    );
  },

  /** Plucked string, bright: harp, guitar. */
  harp(midi: number, sr: number, o: { seed?: number; decay?: number; brightness?: number } = {}): Float32Array {
    return voice.pluck({ freq: hz(midi), duration: (o.decay ?? 0.9) * 1.8, seed: o.seed ?? midi, decay: o.decay ?? 0.9, brightness: o.brightness ?? 0.45 }, sr);
  },

  /** Plucked string, dark and long: upright bass. */
  bass(midi: number, sr: number, o: { seed?: number; decay?: number } = {}): Float32Array {
    return voice.pluck({ freq: hz(midi), duration: (o.decay ?? 1.6) * 1.4, seed: o.seed ?? midi + 3, decay: o.decay ?? 1.6, brightness: 0.25 }, sr);
  },

  /** A held, soft chord tone: detuned saws through a low-pass, slow in and out. */
  pad(midi: number, length: number, sr: number, o: { cutoff?: number; seed?: number; attack?: number; release?: number } = {}): Float32Array {
    return voice.tone({ freq: hz(midi), length, release: o.release ?? 1.2, attack: o.attack ?? 0.5, wave: 'saw', voices: 3, detune: 14, cutoff: o.cutoff ?? 850, seed: o.seed ?? 1 }, sr);
  },

  /** Glassy, high sparkle. */
  chime(midi: number, sr: number, o: { decay?: number } = {}): Float32Array {
    return voice.bell({ freq: hz(midi), duration: (o.decay ?? 0.45) * 3.5, ratio: 7.1, index: 1.1, decay: o.decay ?? 0.45 }, sr);
  },

  /**
   * A sung glide from one pitch to another (Hz): a small creature's voice, a toy bird.
   * `vibrato` in cents makes it questioning or excited.
   */
  chirp(from: number, to: number, length: number, sr: number, o: { vibrato?: number; cutoff?: number } = {}): Float32Array {
    return voice.tone({
      freq: t => from + (to - from) * Math.min(1, t / length), length, release: 0.05, attack: 0.012, wave: 'triangle',
      cutoff: o.cutoff ?? 3200, vibrato: o.vibrato ? { rate: 22, depth: o.vibrato } : undefined,
    }, sr);
  },
};
