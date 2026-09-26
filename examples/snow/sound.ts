import { type Cue, Mixer, type SoundLog, type Stereo, degree, fbm1, hz, layer, note, rng, triad, voice } from '../../src';

/** What the score needs from the scene: its sound log, time maps, and when the story turns (video seconds). */
export interface SnowSound {
  log: SoundLog;
  sampleRate: number;
  /** Length of the video (s). */
  length: number;
  video: (sceneT: number) => number;
  scene: (videoT: number) => number;
  rate: (sceneT: number) => number;
  marks: { push: number; oops: number; crash: number; popOut: number; top: number };
}

/**
 * The sound of "First snow": wind over the hill, crunchy steps, a snowball that rumbles louder as it
 * grows, a slowed-down crash, Clawd's chirps, and a music-box waltz in F that follows the story.
 */
export function scoreSnow(o: SnowSound): Stereo {
  const mix = new Mixer(o.length, o.sampleRate)
    .bus('air', { gain: 0.55, reverb: 0.05 })
    .bus('sfx', { gain: 1, reverb: 0.12 })
    .bus('voice', { gain: 0.55, reverb: 0.18 })
    .bus('music', { gain: 0.5, reverb: 0.38 });
  wind(mix, o);
  rolling(mix, o);
  for (const c of o.log.cues) effect(mix, o, c);
  waltz(mix, o);
  return mix.render({ reverb: { room: 0.82, damp: 0.45 }, master: 1, ceiling: -1, fadeIn: 0.9, fadeOut: 1.4 });
}

// --- ambience ---

function wind(mix: Mixer, o: SnowSound): void {
  const sr = o.sampleRate;
  for (const [seed, pan] of [[11, -0.7], [12, 0.7]] as const) {
    const gust = (t: number) => 0.55 + 0.45 * fbm1(t * 0.18, seed, 3);
    mix.add('air', 0, voice.noise({
      duration: o.length, seed, filter: 'lowpass', freq: t => 260 + 260 * gust(t), q: 0.6, level: t => 0.22 * gust(t),
    }, sr), { pan });
    mix.add('air', 0, voice.noise({
      duration: o.length, seed: seed + 5, filter: 'bandpass', freq: t => 700 + 500 * gust(t + 3), q: 5, level: t => 0.05 * Math.max(0, gust(t + 3) - 0.45),
    }, sr), { pan: -pan * 0.5 });
  }
}

/** The ball's rumble: a crackling hiss and a low roll, both driven by its speed and size. */
function rolling(mix: Mixer, o: SnowSound): void {
  const sr = o.sampleRate, speed = o.log.track('roll'), size = o.log.track('size');
  const at = (v: number) => { const t = o.scene(v); return { v: speed(t), r: size(t), rate: o.rate(t) }; };
  const loud = (v: number) => { const s = at(v); return Math.min(1, s.v / 320) * (0.35 + s.r / 110); };
  mix.add('sfx', 0, voice.noise({
    duration: o.length, seed: 21, filter: 'bandpass', freq: v => { const s = at(v); return (500 + s.v * 1.1) * s.rate; }, q: 0.9, crackle: 0.75,
    level: v => 0.22 * loud(v),
  }, sr));
  mix.add('sfx', 0, voice.noise({
    duration: o.length, seed: 22, filter: 'lowpass', freq: v => (70 + at(v).v * 0.12) * at(v).rate, q: 1.2, level: v => 1.1 * loud(v),
  }, sr));
}

// --- effects, one recipe per cue ---

const crunch = (seed: number, pitch: number, sr: number, bright = 1) => layer(sr,
  { buffer: voice.noise({ duration: 0.12, seed, filter: 'bandpass', freq: 2300 * pitch * bright, q: 0.9, crackle: 0.85, attack: 0.003, decay: 0.03 }, sr) },
  { buffer: voice.noise({ duration: 0.1, seed: seed + 1, filter: 'lowpass', freq: 420 * pitch, q: 0.8, attack: 0.002, decay: 0.025 }, sr), gain: 0.9 },
);

/** Clawd's voice: short sung glides, like a toy bird. */
const chirp = (from: number, to: number, length: number, sr: number, vibrato = 0) => voice.tone({
  freq: t => from + (to - from) * Math.min(1, t / length), length, release: 0.05, attack: 0.012, wave: 'triangle', cutoff: 3200,
  vibrato: vibrato ? { rate: 22, depth: vibrato } : undefined,
}, sr);

function effect(mix: Mixer, o: SnowSound, c: Cue): void {
  const sr = o.sampleRate, at = o.video(c.at), pan = c.pan, p = c.pitch;
  switch (c.name) {
    case 'step':
      mix.add('sfx', at, crunch(c.seed, p, sr), { gain: 0.32 * c.gain, pan });
      break;
    case 'pat':
      mix.add('sfx', at, layer(sr, { buffer: crunch(c.seed, 0.8, sr, 0.8) }, { buffer: crunch(c.seed + 9, 0.9, sr, 0.8), delay: 0.14, gain: 0.8 }), { gain: 0.45, pan });
      break;
    case 'land':
      mix.add('sfx', at, layer(sr,
        { buffer: crunch(c.seed, 0.75, sr, 0.8) },
        { buffer: voice.thump({ duration: 0.3, seed: c.seed, from: 120, to: 70, sweep: 0.04, decay: 0.06 }, sr), gain: 0.5 },
      ), { gain: 0.55, pan });
      break;
    case 'crash': {
      // The hit plays at the slow-motion rate: longer and deeper, like tape.
      const boom = layer(sr,
        { buffer: voice.thump({ duration: 1.4, seed: c.seed, from: 150, to: 40, sweep: 0.07, decay: 0.4, click: 1, tone: 0.35 }, sr) },
        { buffer: voice.noise({ duration: 1.2, seed: c.seed + 1, filter: 'lowpass', freq: t => 300 + 3200 * Math.exp(-t / 0.12), q: 0.7, attack: 0.004, decay: 0.3 }, sr), gain: 0.9 },
        { buffer: voice.noise({ duration: 1.4, seed: c.seed + 2, filter: 'highpass', freq: 3000, q: 0.7, crackle: 0.9, attack: 0.2, decay: 0.28 }, sr), gain: 0.22, delay: 0.12 },
        { buffer: voice.tone({ freq: t => 92 + 14 * Math.sin(t * 19) + 30 * Math.exp(-t / 0.2), length: 0.5, release: 0.3, wave: 'saw', cutoff: 700, q: 3 }, sr), gain: 0.12, delay: 0.08 },
      );
      mix.add('sfx', at, boom, { gain: 0.9 * c.gain, pan, rate: o.rate(c.at) });
      break;
    }
    case 'whoosh':
      mix.add('sfx', at, voice.noise({ duration: 0.8, seed: c.seed, filter: 'bandpass', freq: t => 250 + 2200 * Math.min(1, t / 0.5), q: 1.6, attack: 0.4, decay: 0.07 }, sr), { gain: 0.5, pan });
      break;
    case 'plop':
      mix.add('sfx', at, layer(sr,
        { buffer: voice.thump({ duration: 0.6, seed: c.seed, from: 110, to: 45, sweep: 0.05, decay: 0.16, click: 0.4 }, sr) },
        { buffer: voice.noise({ duration: 0.6, seed: c.seed + 1, filter: 'lowpass', freq: 900, q: 0.7, attack: 0.004, decay: 0.16 }, sr), gain: 1.1 },
      ), { gain: 0.4, pan });
      break;
    case 'poof':
      mix.add('sfx', at, layer(sr,
        { buffer: voice.noise({ duration: 0.7, seed: c.seed, filter: 'bandpass', freq: t => 700 + 900 * Math.exp(-t / 0.1), q: 0.7, crackle: 0.5, attack: 0.008, decay: 0.16 }, sr) },
        { buffer: crunch(c.seed + 3, 1.1, sr) },
      ), { gain: 0.7, pan });
      mix.add('voice', at + 0.12, chirp(520, 980, 0.13, sr), { gain: 0.5, pan });
      break;
    case 'sparkle':
      [note('A6'), note('C7'), note('F7')].forEach((m, i) =>
        mix.add('music', at + i * 0.07, voice.bell({ freq: hz(m), duration: 1.6, ratio: 7.1, index: 1.1, decay: 0.45 }, sr), { gain: 0.3, pan: pan + (i - 1) * 0.3 }));
      break;
    case 'giggle':
      for (let i = 0; i < 4; i++) mix.add('voice', at + i * 0.1, chirp(760 - i * 40, 980 - i * 60, 0.06, sr), { gain: 0.5 * (1 - i * 0.18), pan });
      break;
    case 'oops':
      mix.add('voice', at, chirp(380, 700, 0.26, sr, 30), { gain: 0.6, pan });
      break;
    case 'hop':
      mix.add('voice', at, chirp(300, 760, 0.16, sr, 60), { gain: 0.45, pan });
      break;
    case 'yay':
      mix.add('voice', at, chirp(620, 900, 0.1, sr), { gain: 0.5, pan });
      mix.add('voice', at + 0.16, chirp(820, 1250, 0.18, sr, 25), { gain: 0.5, pan });
      break;
  }
}

// --- music: a waltz in F for music box, harp, bass and a soft pad ---

const BPM = 138, BEAT = 60 / BPM, BAR = BEAT * 3;
const KEY = note('F5');
/** I vi IV V I iii IV V, as scale degrees. */
const PROGRESSION = [0, 5, 3, 4, 0, 2, 3, 4];
/** The theme, one bar per chord: [beat, scale degree from F5, beats held]. */
const THEME: [number, number, number][][] = [
  [[0, 4, 1], [1, 2, 1], [2, 0, 1]],
  [[0, 5, 2], [2, 4, 1]],
  [[0, 3, 1], [1, 5, 1], [2, 7, 1]],
  [[0, 6, 3]],
  [[0, 4, 1], [1, 2, 1], [2, 0, 1]],
  [[0, 2, 1], [1, 4, 1], [2, 2, 1]],
  [[0, 3, 1], [1, 1, 1], [2, 3, 1]],
  [[0, 1, 2], [2, -1, 1]],
];

type Section = 'calm' | 'play' | 'chase' | 'hush' | 'return';

function waltz(mix: Mixer, o: SnowSound): void {
  const sr = o.sampleRate, m = o.marks, r = rng(77);
  // The last full bar before the fade lands on the tonic; everything is counted back from it.
  const last = Math.floor((o.length - 3.4) / BAR);
  const section = (v: number): Section =>
    v < m.push ? 'calm' : v < m.oops ? 'play' : v < m.crash ? 'chase' : v < m.popOut ? 'hush' : 'return';

  const box = (at: number, midi: number, vel: number, pan = 0.1) => {
    if (at > m.crash && at < m.popOut - 0.05 && vel > 0.3) return;
    mix.add('music', at, layer(sr,
      { buffer: voice.bell({ freq: hz(midi), duration: 2.2, ratio: 4, index: 1.3, decay: 0.55, indexDecay: 0.06 }, sr) },
      { buffer: voice.bell({ freq: hz(midi + 12), duration: 1.2, ratio: 3, index: 0.6, decay: 0.25 }, sr), gain: 0.25 },
    ), { gain: 0.34 * vel, pan });
  };
  const harp = (at: number, midi: number, vel: number, pan: number) =>
    mix.add('music', at, voice.pluck({ freq: hz(midi), duration: 1.6, seed: Math.round(at * 100) + midi, decay: 0.9, brightness: 0.45 }, sr), { gain: 0.4 * vel, pan });
  const bass = (at: number, midi: number, vel: number) =>
    mix.add('music', at, voice.pluck({ freq: hz(midi), duration: 2.2, seed: Math.round(at * 10) + 3, decay: 1.6, brightness: 0.25 }, sr), { gain: 0.6 * vel, pan: -0.15 });
  const pad = (at: number, chord: number[], length: number, vel: number) => {
    for (const [i, n] of chord.entries()) {
      mix.add('music', at, voice.tone({ freq: hz(n), length, release: 1.2, attack: 0.5, wave: 'saw', voices: 3, detune: 14, cutoff: 850, seed: i + 1 }, sr), { gain: 0.05 * vel, pan: (i - 1) * 0.5 });
    }
  };

  for (let b = 0; b <= last; b++) {
    const at = b * BAR, sec = section(at), idx = (((b - last) % 8) + 8) % 8;
    const d = PROGRESSION[idx], chord = triad(note('F3'), 'major', d), root = degree(note('F2'), 'major', d);
    const final = b === last;
    // No new music while the ball flies at the tree and Clawd is under the snow, except a held hush.
    if (at + BAR > m.crash && at < m.popOut) {
      if (at >= m.crash + 0.6) {
        pad(at, triad(note('F3'), 'major', 3), BAR, 0.8);
        if (b % 2 === 0) box(at + BEAT, degree(KEY, 'major', 3), 0.25, -0.2);
      } else if (sec !== 'hush') {
        // The bar the crash falls in: keep playing only up to the hit.
        for (const [beat, deg] of THEME[idx]) if (at + beat * BEAT < m.crash - 0.05) box(at + beat * BEAT, degree(KEY, 'major', deg), 0.7);
      }
      continue;
    }
    pad(at, chord, final ? o.length - at - 1 : BAR, sec === 'calm' ? 0.9 : 0.7);
    if (final) {
      bass(at, root, 1);
      chord.concat([chord[0] + 12]).forEach((n, i) => harp(at + i * 0.09, n + 12, 0.8, -0.3 + i * 0.2));
      box(at + 0.4, degree(KEY, 'major', 7), 0.9);
      box(at + 0.4 + BEAT * 2, degree(KEY, 'major', 11), 0.5, 0.3);
      continue;
    }
    if (sec === 'calm') {
      if (b > 0) bass(at, root, 0.55);
      for (const [beat, deg] of THEME[idx]) box(at + beat * BEAT, degree(KEY, 'major', deg), 0.75);
    } else if (sec === 'chase') {
      bass(at, root, 1);
      bass(at + BEAT * 1.5, root + 7, 0.6);
      const up = [0, 1, 2, 3, 2, 1];
      up.forEach((k, i) => {
        const n = triad(note('F5'), 'major', d)[k % 3] + (k === 3 ? 12 : 0);
        box(at + i * BEAT * 0.5, n, 0.55 + (i === 0 ? 0.25 : 0), (i % 2 ? 0.25 : -0.05));
      });
      for (const beat of [1, 2]) chord.forEach((n, i) => harp(at + beat * BEAT, n + 12, 0.45, -0.3 + i * 0.3));
    } else {
      bass(at, root, 0.9);
      for (const beat of [1, 2]) chord.forEach((n, i) => harp(at + beat * BEAT + i * 0.012, n + 12, sec === 'play' ? 0.55 : 0.45, -0.3 + i * 0.3));
      for (const [beat, deg] of THEME[idx]) box(at + beat * BEAT, degree(KEY, 'major', deg), 0.85);
      // A little ornament now and then: the note above, just before the beat.
      if (r() < 0.35) box(at + BEAT * 2 - 0.1, degree(KEY, 'major', THEME[idx][THEME[idx].length - 1][1] + 1), 0.35, 0.3);
    }
  }
}
