import { type Cue, Mixer, type SoundLog, type Stereo, degree, fbm1, hash, instrument, layer, note, rng, smoothstep, triad, voice } from '../../src';

/** What the score needs from the demo: its sound log, the video length and when each act began (s). */
export interface DemoSound { log: SoundLog; sampleRate: number; length: number; starts: number[] }

const ACTS = ['meadow', 'sea', 'roof', 'closing'] as const;
type ActName = (typeof ACTS)[number];

/**
 * The sound of the tour: each act has its own air (a meadow with birds, the sea, a night with
 * crickets), its own effects, and its own turn of one score in C: a pastoral meadow, a dreamy sea,
 * a night on the roofs, and a closing that resolves.
 */
export function scoreDemo(o: DemoSound): Stereo {
  const mix = new Mixer(o.length, o.sampleRate)
    .bus('air', { gain: 0.5, reverb: 0.08 })
    .bus('sfx', { gain: 1, reverb: 0.14 })
    .bus('voice', { gain: 0.55, reverb: 0.18 })
    .bus('music', { gain: 0.5, reverb: 0.36 });
  const span = spans(o);
  ambience(mix, o, span);
  for (const c of o.log.cues) effect(mix, o, c);
  score(mix, o);
  return mix.render({ reverb: { room: 0.8, damp: 0.4 }, master: 2, ceiling: -1.5, fadeIn: 0.3, fadeOut: 1.2 });
}

type Spans = Record<ActName, [number, number]>;

/** Each act's stretch of video, overlapping the transitions in and out. */
function spans(o: DemoSound): Spans {
  const s = o.starts, out = {} as Spans;
  ACTS.forEach((name, i) => { out[name] = [s[i] ?? o.length, (s[i + 1] ?? o.length - 0.9) + 0.9]; });
  return out;
}

/** 0 → 1 → 0 over an act's span, fading over `fade` seconds at each end. */
const within = ([a, b]: [number, number], t: number, fade = 0.6) => smoothstep(a - fade * 0.5, a + fade * 0.5, t) * (1 - smoothstep(b - fade, b, t));

// --- ambience ---

function ambience(mix: Mixer, o: DemoSound, span: Spans): void {
  const sr = o.sampleRate, L = o.length;
  // Meadow: a soft breeze and birds calling across the field.
  mix.add('air', 0, voice.noise({ duration: L, seed: 31, filter: 'bandpass', freq: t => 600 + 300 * fbm1(t * 0.3, 3), q: 0.5, level: t => 0.1 * within(span.meadow, t) * (0.7 + 0.3 * fbm1(t * 0.5, 4)) }, sr), { pan: -0.3 });
  const birds = rng(5);
  for (let t = span.meadow[0] + 0.4; t < span.meadow[1] - 0.8; t += 0.7 + birds() * 1.3) {
    const f = 2600 + birds() * 1400, n = 2 + Math.floor(birds() * 3), pan = birds() * 1.6 - 0.8;
    for (let k = 0; k < n; k++) mix.add('air', t + k * 0.11, instrument.chirp(f, f * (1.15 + birds() * 0.2), 0.05, sr, { cutoff: 9000 }), { gain: 0.08, pan });
  }
  // Sea: the muffled roar of water, and bubbles rising around.
  mix.add('air', 0, voice.noise({ duration: L, seed: 41, filter: 'lowpass', freq: t => 240 + 120 * fbm1(t * 0.4, 5), q: 0.9, level: t => 0.55 * within(span.sea, t) }, sr));
  const fizz = rng(9);
  for (let t = span.sea[0] + 0.3; t < span.sea[1] - 0.5; t += 0.08 + fizz() * 0.4) mix.add('air', t, bubble(sr, 600 + fizz() * 900), { gain: 0.1, pan: fizz() * 1.6 - 0.8 });
  // Roof: crickets and the far hum of the town.
  mix.add('air', 0, voice.noise({ duration: L, seed: 51, filter: 'lowpass', freq: 160, q: 0.7, level: t => 0.2 * within(span.roof, t) }, sr));
  for (const [f, pan, rate] of [[4700, -0.6, 3.1], [5200, 0.6, 2.4]] as const) {
    mix.add('air', 0, voice.tone({ freq: f, length: L, wave: 'sine', gain: 1 }, sr).map((x, i) => {
      const t = i / sr, chirp = Math.max(0, Math.sin(t * rate * Math.PI * 2)) ** 8 * (0.5 + 0.5 * Math.sin(t * 90));
      return x * chirp * 0.025 * within(span.roof, t);
    }), { pan });
  }
}

const bubble = (sr: number, from: number) => voice.tone({ freq: t => from * (1 + t * 22), length: 0.035, release: 0.02, attack: 0.002, wave: 'sine' }, sr);

// --- effects ---

const crunch = (seed: number, freq: number, sr: number, crackle = 0.6, decay = 0.03) => voice.noise({ duration: decay * 5, seed, filter: 'bandpass', freq, q: 0.9, crackle, attack: 0.002, decay }, sr);
const tap = (seed: number, pitch: number, sr: number) => layer(sr,
  { buffer: voice.noise({ duration: 0.12, seed, filter: 'bandpass', freq: 1500 * pitch, q: 0.8, crackle: 0.4, attack: 0.001, decay: 0.03 }, sr) },
  { buffer: voice.thump({ duration: 0.2, seed, from: 190 * pitch, to: 95 * pitch, sweep: 0.02, decay: 0.04 }, sr), gain: 0.7 },
);
/** Paper laid down softly: a short, dark puff of noise with a rounded start. */
const flop = (seed: number, pitch: number, sr: number) => voice.noise({ duration: 0.25, seed, filter: 'lowpass', freq: 1100 * pitch, q: 0.6, crackle: 0.25, attack: 0.008, decay: 0.045 }, sr);
const actOf = (c: Cue): ActName => ACTS[c.data.act ?? 0] ?? 'meadow';

function effect(mix: Mixer, o: DemoSound, c: Cue): void {
  const sr = o.sampleRate, at = c.at, pan = c.pan;
  switch (c.name) {
    case 'drop': {
      // Paper settling, not a hit: soft and dark, each letter a little different, so the run of
      // eleven reads as a flutter instead of a burst.
      const r = rng(c.seed), pitch = 0.8 + r() * 0.4;
      mix.add('sfx', at + r() * 0.02, flop(c.seed, pitch, sr), { gain: (0.16 + r() * 0.08) * c.gain, pan });
      break;
    }
    case 'letter': {
      // Every letter Clawd lands on is a note; the closing "m" lands on the tonic.
      const midi = c.data.closing ? note('C6') : degree(note('C5'), 'pentatonic', c.data.i);
      mix.add('music', at, instrument.musicBox(midi, sr), { gain: 0.3, pan });
      mix.add('sfx', at, tap(c.seed, 1.1, sr), { gain: 0.3, pan });
      break;
    }
    case 'confetti':
      [note('C6'), note('E6'), note('G6'), note('C7')].forEach((m, i) => mix.add('music', at + i * 0.08, instrument.chime(m, sr), { gain: 0.15, pan: (i - 1.5) * 0.3 }));
      // Confetti fluttering down: a few soft paper flops scattered over a second.
      { const r = rng(c.seed); for (let k = 0; k < 7; k++) mix.add('sfx', at + 0.1 + r() * 1.1, flop(c.seed + k, 1.2 + r() * 0.6, sr), { gain: 0.07 + r() * 0.04, pan: r() * 1.4 - 0.7 }); }
      break;
    case 'step': {
      const act = actOf(c);
      if (act === 'meadow') mix.add('sfx', at, crunch(c.seed, 3200 * c.pitch, sr, 0.3, 0.045), { gain: 0.07, pan });
      else if (act === 'roof') mix.add('sfx', at, voice.noise({ duration: 0.08, seed: c.seed, filter: 'bandpass', freq: 3400 * c.pitch, q: 3, attack: 0.001, decay: 0.012 }, sr), { gain: 0.18, pan });
      break;
    }
    case 'jump':
      mix.add('sfx', at, voice.noise({ duration: 0.3, seed: c.seed, filter: 'bandpass', freq: t => 700 + 2000 * Math.min(1, t / 0.12), q: 1.2, attack: 0.03, decay: 0.05 }, sr), { gain: 0.14, pan });
      break;
    case 'land': {
      const act = actOf(c);
      if (act === 'meadow') mix.add('sfx', at, layer(sr, { buffer: voice.thump({ duration: 0.3, seed: c.seed, from: 120, to: 60, sweep: 0.03, decay: 0.06 }, sr) }, { buffer: crunch(c.seed, 2600, sr, 0.3, 0.06), gain: 0.5 }), { gain: 0.4, pan });
      else if (act === 'roof') mix.add('sfx', at, layer(sr, { buffer: instrument.mallet(note('A6'), sr, { decay: 0.05 }) }, { buffer: tap(c.seed, 0.8, sr), gain: 0.8 }), { gain: 0.25, pan });
      break;
    }
    case 'oh':
      mix.add('voice', at, instrument.chirp(380, 700, 0.26, sr, { vibrato: 30 }), { gain: 0.55, pan });
      break;
    case 'giggle':
      for (let i = 0; i < 4; i++) mix.add('voice', at + i * 0.1, instrument.chirp(760 - i * 40, 980 - i * 60, 0.06, sr), { gain: 0.5 * (1 - i * 0.18), pan });
      break;
    case 'yay':
      mix.add('voice', at, instrument.chirp(620, 900, 0.1, sr), { gain: 0.5, pan });
      mix.add('voice', at + 0.16, instrument.chirp(820, 1250, 0.18, sr, { vibrato: 25 }), { gain: 0.5, pan });
      break;
    case 'seeds': {
      mix.add('sfx', at, voice.noise({ duration: 1.8, seed: c.seed, filter: 'bandpass', freq: 2800, q: 0.5, attack: 0.25, decay: 0.45 }, sr), { gain: 0.3, pan });
      const r = rng(c.seed);
      for (let k = 0; k < 6; k++) mix.add('music', at + 0.1 + k * 0.13, instrument.chime(degree(note('C7'), 'pentatonic', Math.floor(r() * 6)), sr, { decay: 0.3 }), { gain: 0.12, pan: pan + r() - 0.5 });
      break;
    }
    case 'splash': {
      mix.add('sfx', at, layer(sr,
        { buffer: voice.noise({ duration: 1.2, seed: c.seed, filter: 'lowpass', freq: t => 600 + 5000 * Math.exp(-t / 0.08), q: 0.7, attack: 0.003, decay: 0.28 }, sr) },
        { buffer: voice.thump({ duration: 0.5, seed: c.seed, from: 140, to: 50, sweep: 0.05, decay: 0.12 }, sr), gain: 0.8 },
      ), { gain: 0.7, pan });
      const r = rng(c.seed + 1);
      for (let k = 0; k < 7; k++) mix.add('sfx', at + 0.15 + r() * 0.7, bubble(sr, 900 + r() * 1500), { gain: 0.12, pan: pan + r() - 0.5 });
      break;
    }
    case 'underwater':
      mix.add('sfx', at, voice.noise({ duration: 1.4, seed: c.seed, filter: 'lowpass', freq: t => 1400 * Math.exp(-t / 0.3) + 200, q: 0.8, attack: 0.01, decay: 0.35 }, sr), { gain: 0.5, pan });
      break;
    case 'bubble':
      mix.add('sfx', at, bubble(sr, 700 + hash(c.seed) * 700), { gain: 0.12 * c.gain, pan });
      break;
    case 'jelly': {
      const boing = voice.tone({ freq: t => 170 + 70 * Math.sin(t * 30) * Math.exp(-t / 0.25) + 60 * Math.exp(-t / 0.06), length: 0.45, release: 0.2, attack: 0.005, wave: 'sine' }, sr);
      mix.add('sfx', at, layer(sr, { buffer: boing }, { buffer: voice.thump({ duration: 0.4, seed: c.seed, from: 90, to: 45, sweep: 0.05, decay: 0.1 }, sr), gain: 0.6 }), { gain: 0.55, pan });
      break;
    }
    case 'boing': {
      // The bell throws Clawd back up: a springy sweep that wobbles as it rises, and a bright pluck on top.
      const spring = voice.tone({ freq: t => 160 * (1 + 2.2 * Math.min(1, t / 0.35)) * (1 + 0.08 * Math.sin(t * 55) * Math.exp(-t / 0.2)), length: 0.45, release: 0.15, attack: 0.004, wave: 'sine' }, sr);
      mix.add('sfx', at, layer(sr, { buffer: spring }, { buffer: voice.thump({ duration: 0.3, seed: c.seed, from: 130, to: 60, sweep: 0.03, decay: 0.06 }, sr), gain: 0.7 }), { gain: 0.5, pan });
      mix.add('music', at + 0.05, instrument.chime(note('G5'), sr, { decay: 0.35 }), { gain: 0.12, pan });
      break;
    }
    case 'chimney': {
      // Landing on the brick chimney: a dry clay knock, and the string of bulbs tinkling as it shakes.
      mix.add('sfx', at, layer(sr, { buffer: voice.thump({ duration: 0.3, seed: c.seed, from: 170, to: 85, sweep: 0.02, decay: 0.05 }, sr) }, { buffer: crunch(c.seed, 1800, sr, 0.5, 0.03), gain: 0.6 }), { gain: 0.5, pan });
      for (let b = 0; b < 4; b++) mix.add('sfx', at + 0.06 + b * 0.07, instrument.mallet(note('C7') + [0, 4, 7, 12][b], sr, { decay: 0.1 }), { gain: 0.06, pan: pan - 0.2 * b });
      break;
    }
    case 'wire': {
      const k = 1 + (c.data.n ?? 0) * 0.12;
      const twang = voice.tone({ freq: t => 98 * k * (1 + 0.25 * Math.exp(-t / 0.04)) * (1 + 0.02 * Math.sin(t * 40) * Math.exp(-t / 0.2)), length: 0.35, release: 0.5, attack: 0.002, wave: 'saw', cutoff: t => 300 + 2400 * Math.exp(-t / 0.08), q: 2 }, sr);
      mix.add('sfx', at, layer(sr, { buffer: twang }, { buffer: instrument.bass(note('G2') + Math.round((k - 1) * 20), sr, { seed: c.seed }), gain: 0.6 }), { gain: 0.25, pan });
      for (let b = 0; b < 3; b++) mix.add('sfx', at + 0.04 + b * 0.05, instrument.mallet(note('E7') + b * 3, sr, { decay: 0.08 }), { gain: 0.05, pan: pan + (b - 1) * 0.3 });
      break;
    }
    case 'moon':
      [note('E6'), note('G6'), note('B6'), note('E7')].forEach((m, i) => mix.add('music', at + 0.3 + i * 0.22, instrument.chime(m, sr, { decay: 0.8 }), { gain: 0.16, pan: 0.3 }));
      break;
    case 'tear':
      mix.add('sfx', at, ripping(sr, c.seed), { gain: 0.12, pan: 0 });
      break;
    case 'iris':
      mix.add('sfx', at, voice.noise({ duration: 1.2, seed: c.seed, filter: 'bandpass', freq: t => 300 + 1800 * Math.min(1, t / 0.8), q: 1.4, attack: 0.6, decay: 0.2 }, sr), { gain: 0.12 });
      mix.add('music', at + 0.6, instrument.chime(note('G6'), sr, { decay: 0.6 }), { gain: 0.08 });
      break;
  }
}

/**
 * A soft page turn: a gentle, dark paper rustle that swells and fades with the wipe, rather than a
 * sharp rip (it happens between every act, so it should stay in the background).
 */
function ripping(sr: number, seed: number): Float32Array {
  const len = 0.9, swell = (t: number) => Math.sin(Math.PI * Math.min(1, t / len)) ** 1.5;
  return voice.noise({
    duration: len, seed, filter: 'bandpass', freq: t => 700 + 900 * swell(t), q: 0.6, crackle: 0.6, level: swell,
  }, sr);
}

// --- the score: one grid, each act its own chords and instruments ---

const BPM = 104, BEAT = 60 / BPM, BAR = BEAT * 4, C5 = note('C5');

/** Chords by act, as scale degrees of C major (the sea borrows lydian's bright II). */
const CHORDS: Record<ActName, number[]> = {
  meadow: [0, 4, 5, 3],
  sea: [0, 1, 0, 1],
  roof: [5, 3, 0, 4],
  closing: [4, 0, 0, 0],
};

/** The meadow's tune, one bar per chord: [beat, degree from C5, beats held]. */
const TUNE: [number, number, number][][] = [
  [[0, 2, 1], [1, 4, 1], [2, 7, 1.5], [3.5, 6, 0.5]],
  [[0, 4, 2], [2, 1, 1], [3, 2, 1]],
  [[0, 0, 1], [1, 2, 1], [2, 5, 1.5], [3.5, 4, 0.5]],
  [[0, 3, 2], [2, 2, 1], [3, 1, 1]],
];

function score(mix: Mixer, o: DemoSound): void {
  const sr = o.sampleRate, r = rng(3);
  // Each act's music starts with the transition that reveals it, and plays until the next one.
  ACTS.forEach((act, i) => {
    const from = i === 0 ? 0 : (o.starts[i] ?? Infinity) + 0.15, until = Math.min((o.starts[i + 1] ?? Infinity) + 0.15, o.length - 0.8);
    for (let k = 0, at = from; at < until; k++, at += BAR) bar(mix, sr, r, act, k, at, until, o.length);
  });
}

function bar(mix: Mixer, sr: number, r: () => number, act: ActName, k: number, at: number, end: number, length: number): void {
  const b = Math.round(at * 10);
  const d = CHORDS[act][k % 4];
  const lydian = act === 'sea' && d === 1;
  const chord = lydian ? [note('D4'), note('F#4'), note('A4')] : triad(note('C4'), 'major', d);
  const root = lydian ? note('D2') : degree(note('C2'), 'major', d);
  const play = (t: number, buf: Float32Array, gain: number, pan = 0) => { if (t < end) mix.add('music', t, buf, { gain, pan }); };

  switch (act) {
    case 'meadow': {
      chord.forEach((n, i) => play(at, instrument.pad(n, BAR, sr, { seed: i + 1, cutoff: 1100 }), 0.045, (i - 1) * 0.5));
      play(at, instrument.bass(root, sr, { seed: b }), 0.6);
      play(at + 2 * BEAT, instrument.bass(root + 7, sr, { seed: b + 1 }), 0.35);
      [0, 1, 2, 1, 2, 3, 2, 1].forEach((p, e) => play(at + e * BEAT * 0.5, instrument.harp(chord[p % 3] + (p === 3 ? 24 : 12), sr, { seed: b * 8 + e }), 0.2, 0.25));
      for (const [beat, deg] of TUNE[k % 4]) play(at + beat * BEAT, instrument.musicBox(degree(C5, 'major', deg), sr), 0.28, -0.1);
      break;
    }
    case 'sea': {
      const seventh = lydian ? [...chord, note('C#5')] : [...chord, note('B4')];
      seventh.forEach((n, i) => play(at, instrument.pad(n, BAR, sr, { seed: i + 3, cutoff: 650, attack: 0.9, release: 1.8 }), 0.05, (i - 1.5) * 0.4));
      play(at, instrument.bass(root, sr, { seed: b, decay: 2.4 }), 0.45);
      [0, 1, 2, 3].forEach(beat => play(at + beat * BEAT + 0.02 * r(), instrument.chime(seventh[(beat + k) % 4] + 24, sr, { decay: 0.7 }), 0.08, (beat - 1.5) * 0.4));
      break;
    }
    case 'roof': {
      chord.forEach((n, i) => play(at, instrument.pad(n, BAR, sr, { seed: i + 5, cutoff: 700 }), 0.05, (i - 1) * 0.5));
      play(at, instrument.bass(root, sr, { seed: b }), 0.55);
      [0, 1, 2, 3].forEach(beat => play(at + beat * BEAT, instrument.harp(chord[beat % 3] + 12, sr, { seed: b * 4 + beat, brightness: 0.35 }), 0.16, 0.2));
      [2, 1, 0].forEach((p, i) => play(at + (i * 1.5 + 0.5) * BEAT, instrument.musicBox(chord[p] + 24, sr, { decay: 0.8 }), 0.2, -0.2));
      break;
    }
    case 'closing': {
      const last = k >= 1;
      chord.forEach((n, i) => play(at, instrument.pad(n, last ? length - at : BAR, sr, { seed: i + 7, cutoff: 1100 }), 0.05, (i - 1) * 0.5));
      play(at, instrument.bass(root, sr, { seed: b, decay: last ? 3 : 1.6 }), 0.6);
      if (!last) [0, 2, 1, 2, 0, 2, 1, 2].forEach((p, e) => play(at + e * BEAT * 0.5, instrument.mallet(chord[p] + 12, sr), e % 2 ? 0.1 : 0.16, e % 2 ? 0.3 : -0.2));
      else if (k === 1) [0, 1, 2].forEach((p, i) => play(at + i * 0.1, instrument.harp(chord[p] + 12, sr, { seed: 99 + i }), 0.3, (i - 1) * 0.4));
      break;
    }
  }
}
