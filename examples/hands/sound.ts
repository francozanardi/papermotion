import { type Cue, Mixer, type SoundLog, type Stereo, degree, instrument, layer, note, voice } from '../../src';

/** What the score needs from the film: timing and the story's marks, all in seconds of video. */
export interface HandsTimeline {
  videoLength: number;
  videoTime(t: number): number;
  sceneTime(v: number): number;
  sound: SoundLog;
}

/** Story marks (video seconds) the music changes on. */
export interface Marks { reach: number; lift: number; ages: number; agesEnd: number; visitor: number; fit: number; dark: number }

const D = note('D3');

/**
 * Night air, crickets and the fire; steps on grit; the breath through the pipe; the ages rushing,
 * each new hand a note; and a score in D minor that opens into D major when the lamp goes out.
 */
export function score(s: HandsTimeline, sr: number, m: Marks): Stereo {
  const len = s.videoLength, mix = new Mixer(len, sr);
  mix.bus('air', { gain: 0.55, reverb: 0.1 }).bus('sfx', { gain: 0.9, reverb: 0.2 }).bus('music', { gain: 0.5, reverb: 0.55 });
  const at = (c: Cue) => s.videoTime(c.at);

  // Wind across the canyon: a low bed that swells with the rushing ages.
  const ages = s.sound.track('ages'), fire = s.sound.track('fire');
  mix.add('air', 0, voice.noise({ duration: len, seed: 1, filter: 'lowpass', freq: v => 260 + 900 * Math.min(1, ages(s.sceneTime(v))), level: v => 0.22 + 0.9 * Math.min(1, ages(s.sceneTime(v))), q: 0.6 }, sr), { gain: 0.8 });
  mix.add('air', 0, voice.noise({ duration: len, seed: 2, filter: 'bandpass', freq: v => 700 + 2600 * Math.min(1, ages(s.sceneTime(v))), level: v => 0.35 * Math.min(1, ages(s.sceneTime(v))), q: 1.2 }, sr), { gain: 0.5, pan: 0.2 });

  // The fire: a soft roar and crackling grains that follow its heat.
  mix.add('sfx', 0, voice.noise({ duration: len, seed: 3, filter: 'lowpass', freq: 240, level: v => 0.5 * Math.min(1.2, fire(s.sceneTime(v))) }, sr), { gain: 0.22, pan: -0.25 });
  mix.add('sfx', 0, voice.noise({ duration: len, seed: 4, filter: 'bandpass', freq: 2600, q: 0.7, crackle: 0.97, level: v => 0.5 * Math.min(1.2, fire(s.sceneTime(v))) }, sr), { gain: 0.035, pan: -0.25 });

  // Crickets, quiet, away from the ages.
  mix.add('air', 0, crickets(len, sr, v => (v < m.ages - 0.5 || v > m.agesEnd + 0.5 ? 1 : 0) * Math.min(1, v / 2)), { gain: 0.06, pan: 0.4 });

  for (const c of s.sound.cues) {
    const t = at(c);
    if (c.name === 'step') mix.add('sfx', t, layer(sr,
      { buffer: voice.noise({ duration: 0.12, seed: c.seed, filter: 'lowpass', freq: 700, decay: 0.035 }, sr) },
      { buffer: voice.noise({ duration: 0.1, seed: c.seed + 1, filter: 'bandpass', freq: 3200, crackle: 0.9, decay: 0.02 }, sr), gain: 0.3 },
    ), { gain: 0.32 * c.gain, pan: c.pan });
    // Breath through the bone pipe, and the pigment's hiss on the rock.
    if (c.name === 'puff') mix.add('sfx', t, layer(sr,
      { buffer: voice.noise({ duration: 0.6, seed: c.seed, filter: 'bandpass', freq: 900, q: 0.9, attack: 0.04, decay: 0.18 }, sr) },
      { buffer: voice.noise({ duration: 0.5, seed: c.seed + 2, filter: 'highpass', freq: 5200, attack: 0.05, decay: 0.12, crackle: 0.6 }, sr), gain: 0.35, delay: 0.05 },
    ), { gain: 1.3, pan: c.pan });
    if (c.name === 'click') mix.add('sfx', t, voice.thump({ duration: 0.08, seed: c.seed, from: 2400, to: 1200, sweep: 0.01, decay: 0.012, click: 0.8 }, sr), { gain: 0.35, pan: 0.1 });
  }

  // Each hand added over the ages rings a note: generations playing one slow tune.
  s.sound.named('far').forEach((c, i) => {
    const midi = degree(D + 12, 'minorPentatonic', [0, 2, 4, 3, 5, 4, 6, 7][i % 8] + Math.floor(i / 8) % 2 * 2);
    mix.add('music', at(c), instrument.musicBox(midi, sr, { decay: 0.7 }), { gain: 0.16 * c.gain, pan: c.pan * 0.6 });
    mix.add('sfx', at(c), voice.noise({ duration: 0.4, seed: c.seed, filter: 'bandpass', freq: 1100, attack: 0.03, decay: 0.12 }, sr), { gain: 0.12, pan: c.pan });
  });

  // Score.
  const pad = (from: number, to: number, notes: string[], gain: number, cutoff = 800) => {
    for (const n of notes) mix.add('music', from, instrument.pad(note(n), Math.max(0.5, to - from), sr, { cutoff, attack: 1.5, release: 2.5, seed: note(n) }), { gain: gain / notes.length });
  };
  pad(0.3, m.reach, ['D2', 'A2', 'F3'], 0.5, 600);
  pad(m.reach, m.lift, ['Bb1', 'F2', 'D3', 'A3'], 0.5, 700);
  // The hand rises toward the stars: a harp climbs with it.
  ['D4', 'F4', 'A4', 'C5', 'E5', 'A5'].forEach((n, i) => mix.add('music', m.reach + 0.3 + i * 0.28, instrument.harp(note(n), sr, { decay: 1.8, brightness: 0.4 }), { gain: 0.18, pan: -0.3 + i * 0.1 }));
  // The print appears.
  ['A4', 'D5', 'F5', 'A5'].forEach((n, i) => mix.add('music', m.lift + 0.5 + i * 0.12, instrument.chime(note(n), sr, { decay: 1.4 }), { gain: 0.12 }));
  pad(m.lift, m.ages, ['D2', 'A2', 'F3', 'C4'], 0.5, 800);
  // The ages: harmony climbs while the sky wheels.
  const chords = [['Bb1', 'F2', 'D3'], ['C2', 'G2', 'E3'], ['D2', 'A2', 'F3'], ['F2', 'C3', 'A3']];
  const step = (m.agesEnd - m.ages) / chords.length;
  chords.forEach((c, i) => pad(m.ages + i * step, m.ages + (i + 1) * step + 0.4, c, 0.55 + i * 0.08, 900 + i * 200));
  pad(m.agesEnd + 0.5, m.fit, ['D2', 'A2'], 0.3, 500);
  // It fits: a warm chord.
  pad(m.fit, m.dark, ['F2', 'C3', 'A3', 'E4'], 0.6, 1000);
  ['C5', 'E5', 'A5'].forEach((n, i) => mix.add('music', m.fit + 0.2 + i * 0.2, instrument.chime(note(n), sr, { decay: 1.6 }), { gain: 0.1 }));
  // Lamp off, eyes open to the sky: D major.
  pad(m.dark + 0.6, len, ['D2', 'A2', 'F#3', 'A3', 'D4'], 0.75, 1100);
  ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6'].forEach((n, i) => mix.add('music', m.dark + 1.2 + i * 0.45, instrument.harp(note(n), sr, { decay: 2.2, brightness: 0.35 }), { gain: 0.16, pan: -0.4 + i * 0.13 }));

  return mix.render({ reverb: { room: 0.85, damp: 0.4, width: 1 }, master: 5, ceiling: -1, fadeIn: 1.2, fadeOut: 1.6 });
}

/** Crickets: a high tone chirping in short bursts, `amount(v)` scaling it over the film. */
function crickets(len: number, sr: number, amount: (v: number) => number): Float32Array {
  const n = Math.ceil(len * sr), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr, burst = Math.max(0, Math.sin(t * Math.PI * 1.7)) ** 3, pulse = Math.max(0, Math.sin(t * Math.PI * 2 * 28)) ** 8;
    out[i] = Math.sin(t * Math.PI * 2 * 4650) * pulse * burst * amount(t);
  }
  return out;
}
