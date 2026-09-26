# Sound: effects, ambience and music from code

No samples and no music models: every sound is synthesized from the `audio` primitives. The engine
provides voices, a mixer and the cue log; the scene decides what things sound like.

## The pipeline

1. **Fire cues where things happen**, not on a clock. Put them in the same places as the effects they
   belong to: a beat's `enter`, a contact, a landing, a `Tracks.stamp` that returned true.
   `this.cue('crash', { gain: speed / 400, pan, data: { speed } })`. Pan by screen position
   (`cam.toScreen`), so sounds sit where they are seen.
2. **Record levels for continuous sounds** every step: `this.level('roll', speed)`. A rumble, the
   wind, an engine follow them.
3. **Write `soundtrack(sampleRate)`** on the stage (the recipes can live in a `sound.ts` next to the
   scene): a `Mixer` with buses (`air`, `sfx`, `voice`, `music`), one recipe per cue name, beds driven
   by levels, and a score. Return `mix.render({ reverb, ceiling: -1, fadeIn, fadeOut })`, with fades
   matching the picture's.
4. **Check it without ears:** `pnpm listen <name>` (seconds; no drawing), then `pnpm render` muxes it.

## Timing

- Place every sound at `this.videoTime(cue.at)`. Slow motion shifts scene time against video time.
- To slow a sound with the picture, place it with `rate: this.rateAt(cue.at)`: longer and deeper, like
  tape. It sells an impact in slow motion.
- Level-driven beds are rendered in video time: read the level at `this.sceneTime(v)`.
- Music runs in video time. Turn the story's beats into video-time marks
  (`videoTime(beats.startOf('crash'))`) and let the score change section on them: calm, chase, a
  silence at the impact, a return, a cadence that lands before the fade.

## Recipes that worked

Instruments for scores are ready-made in `instrument.*` (music box, mallet, harp, bass, pad, chime,
chirp). Build effects from `voice.*`.

| Sound | Recipe |
| --- | --- |
| Step in snow | `noise` bandpass ~2.3 kHz, `crackle` 0.85, decay 0.03 + `noise` lowpass ~420 Hz, decay 0.025 |
| Snowball rumble | two long `noise` beds with `level`/`freq` from the ball's speed and size: crackly bandpass + low lowpass |
| Impact | `thump` 150→40 Hz with `click` + a lowpass sweep of noise + a quiet crackly tail |
| Whoosh | `noise` bandpass sweeping 250 → 2.5 kHz, slow attack, fast decay |
| Character voice | `tone` triangle with a gliding `freq`, cutoff ~3 kHz, 60–250 ms; vibrato for questions |
| Sparkle | three fast `bell`s high up, `ratio` 7.1, `index` ~1 |
| Music box | `bell` `ratio` 4, `index` 1.3, `indexDecay` 0.06 + a quiet octave `bell` |
| Harp, bass | `pluck`, brightness 0.45 (harp) / 0.25 (bass) |
| Pad | `tone` saw × 3 voices, detune 14 cents, cutoff ~850 Hz, slow attack |
| Paper tearing | `noise` bandpass sweeping up and back, `crackle` 0.97, `level` rising and falling over ~1 s |
| Splash | lowpass noise sweep 5.6 kHz → 600 Hz + a low `thump` + a few rising sine "bubbles" |
| Rubbery bounce | a sine whose pitch wobbles (`sin(30t)·e^(−t/0.25)`) over a soft `thump` |
| Wire twang | a saw with a falling pitch and a closing low-pass + a low `bass` pluck |
| Crickets | a high sine gated by `max(0, sin)^8` pulses |
| Notes on contact | each hop lands on the next note of a pentatonic scale: a tune played by the action |

## Mixing

- Aim for about −16 LUFS integrated and a true peak under −1 dBFS (the limiter holds the ceiling).
- The biggest story moment should be the loudest thing; small events (a plop, a step) must not beat it.
  Read the waveform in `out/<name>_audio.png`: the tallest spike should be the key moment.
- Several acts or sets: give each its own ambience bed, faded in and out over its stretch of video.
- Fire time-based cues on a crossing of the previous step's time, not `t - dt`: float error fires them twice.
- Debounce frequent cues (a step every ≥ 0.09 s), or four feet fire four sounds at once.
- Leave room: drop the music at the impact and let it come back after.
- Long crackly tails get longer in slow motion; keep them short.

## Limits

- You can't listen. `pnpm listen` gives the cue list, loudness and a spectrogram; judge timing and
  balance from them, and ask the user to judge taste (melody, timbre).
- Synthesis does bells, plucks, pads, chiptune and foley well. It doesn't do a convincing orchestra or
  piano; write for what it does well.
