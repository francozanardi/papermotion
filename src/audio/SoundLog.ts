/** One sound event the simulation asked for: what, when (scene seconds), and how. */
export interface Cue {
  name: string;
  /** Scene time (s). */
  at: number;
  /** Loudness 0…1+, stereo position −1…1, pitch factor, and any numbers the scene wants to keep. */
  gain: number;
  pan: number;
  pitch: number;
  /** A stable number per cue, to seed its sound so repeats never sound identical. */
  seed: number;
  data: Record<string, number>;
}

export type CueOpts = Partial<Pick<Cue, 'gain' | 'pan' | 'pitch' | 'data'>>;

/**
 * What the simulation sounded like: the sound events it fired (a footstep, an impact) and the
 * continuous levels it drove (a rolling speed, the wind). Sounds come from what happens, not from
 * a clock, so they stay in sync however the physics plays out. A scene's soundtrack reads it back.
 */
export class SoundLog {
  readonly cues: Cue[] = [];
  private readonly levels = new Map<string, { t: number[]; v: number[] }>();

  cue(name: string, at: number, o: CueOpts = {}): void {
    this.cues.push({ name, at, gain: o.gain ?? 1, pan: o.pan ?? 0, pitch: o.pitch ?? 1, seed: this.cues.length * 7919 + 17, data: o.data ?? {} });
  }

  /** Record a continuous level at scene time `at`; call it every step it matters. */
  level(name: string, at: number, value: number): void {
    let l = this.levels.get(name);
    if (!l) { l = { t: [], v: [] }; this.levels.set(name, l); }
    l.t.push(at); l.v.push(value);
  }

  /** The cues with this name. */
  named(name: string): Cue[] { return this.cues.filter(c => c.name === name); }

  /** A recorded level as a function of scene time (linear between samples, 0 before and held after). */
  track(name: string): (t: number) => number {
    const l = this.levels.get(name);
    if (!l || !l.t.length) return () => 0;
    const { t: ts, v } = l;
    return t => {
      if (t < ts[0]) return 0;
      if (t >= ts[ts.length - 1]) return v[v.length - 1];
      let lo = 0, hi = ts.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= t) lo = m; else hi = m; }
      const f = (t - ts[lo]) / (ts[hi] - ts[lo] || 1);
      return v[lo] + (v[hi] - v[lo]) * f;
    };
  }
}
