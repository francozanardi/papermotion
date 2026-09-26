/**
 * Music theory as data, for scores written in code: note names, scales, chords and a tempo map.
 * A score is just a list of notes the scene renders with voices and places in a `Mixer`.
 */

/** A note to play: start (s), MIDI pitch, how long it is held (s), and velocity 0…1. */
export interface Note { at: number; midi: number; length: number; velocity: number }

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number of a note name like 'C4', 'F#3', 'Bb2' (C4 = 60). */
export function note(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note name "${name}"`);
  return NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}

export const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
} as const;
export type Mode = keyof typeof MODES;

/** The MIDI pitch of scale `degree` (0-based, may be negative or past an octave) in a key. */
export function degree(root: number, mode: Mode, d: number): number {
  const steps = MODES[mode], n = steps.length, oct = Math.floor(d / n);
  return root + oct * 12 + steps[((d % n) + n) % n];
}

/** A triad (or seventh with `seventh`) built on scale `degree` of a key: stacked thirds within the scale. */
export function triad(root: number, mode: Mode, d: number, seventh = false): number[] {
  const out = [degree(root, mode, d), degree(root, mode, d + 2), degree(root, mode, d + 4)];
  if (seventh) out.push(degree(root, mode, d + 6));
  return out;
}

/**
 * Tempo map: beats → seconds at `bpm`, starting at `offset` seconds. `swing` (0…0.5) delays every
 * off-beat eighth for a lilt.
 */
export function tempo(bpm: number, offset = 0, swing = 0): (beat: number) => number {
  const spb = 60 / bpm;
  return beat => {
    const eighth = beat * 2, whole = Math.floor(eighth);
    const off = whole % 2 === 1 ? swing * 0.5 : 0;
    return offset + (whole + (eighth - whole) + off) * 0.5 * spb;
  };
}
