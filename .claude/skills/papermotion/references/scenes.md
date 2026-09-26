# Scenes: structure, choreography, cameras, edits

## Anatomy of a scene

```ts
// examples/lighthouse/main.ts   (then register it in examples/catalog.ts)
import { Beats, Camera, Stage, drawProps, fillGradient, ramp, vignette } from '../../src';

const W = 1920, H = 1080;
type Beat = 'wait' | 'climb' | 'look';

export class LighthouseScene extends Stage {
  private readonly cam = new Camera(0, { width: W, height: H, stiffness: 5, damping: 4.5, handheld: 3 });
  private readonly hero: Keeper;          // your own character class (see characters.md)
  private readonly beats: Beats<Beat>;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 14, preroll: 0.8 });
    this.paper.light = { x: -0.6, y: 0.8 };              // one light direction per shot
    this.world.ground = x => 900 + Math.sin(x * 0.004) * 8;
    this.hero = new Keeper(this.world, 300);
    this.beats = new Beats<Beat>('wait', {
      wait:  { during: ({ since }) => { this.hero.intent.look = { x: 1400, y: 300 }; }, after: 1.2, then: 'climb' },
      climb: { during: ({ since }) => { this.hero.intent.speed = 140 * ramp(since, 0, 0.4); }, next: () => this.hero.x > 1100 && 'look' },
      look:  { enter: () => this.hero.startle() },
    });
  }

  protected start(): void { this.cam.cut({ x: this.hero.x + 200, y: 700, zoom: 1.4 }); } // no slide-in on frame 0

  protected update(t: number, dt: number): void {
    this.hero.rest();                        // reset intents every step, then let the beat set them
    if (!this.settling) this.beats.update(t, dt);
    this.hero.update(dt);
  }

  protected lateUpdate(t: number, dt: number): void {
    this.cam.frame({ x: this.hero.x + 200, y: 700, zoom: 1.4 }, dt, t);
  }

  probe() { return { ...super.probe(), beat: this.beats.current, hero: Math.round(this.hero.x), beats: this.beats.history.map(b => `${b.beat}@${b.at.toFixed(2)}`) }; }

  protected draw(t: number): void {
    const { ctx, paper, cam } = this;
    fillGradient(ctx, [[0, '#1d2a4a'], [1, '#e7a37a']]);
    cam.layer(paper, 0.15, v => { /* far hills */ });
    cam.layer(paper, 0.45, v => { /* mid layer */ });
    cam.layer(paper, 1, v => { /* ground, props, the cast */ this.hero.draw(paper); });
    cam.layer(paper, 1.4, v => { /* foreground, maybe blurred */ });
    vignette(ctx, [10, 10, 30], 0.4);
  }
}
```

The frame order is fixed: `update` (intents, beats) → physics step → `lateUpdate` (cameras,
contacts) → `draw`. There are 2 physics substeps per frame, and time comes from an integer step
counter, so it never drifts.

## Choreography with `Beats`

- **Timing is the hard part.** Physics-driven actors arrive late or early, so don't script by the
  clock. Each beat ends on a *condition* (`next`), with `after` as a fallback.
- **Split "line up" from "commit".** First get into position and face the target. Only then act.
  Otherwise the touch or leap happens mid-turn.
- **Latch decisions in `enter`** (which side, which target). Recomputing them every step makes the
  actor flip-flop.
- **Effects belong to the beat they cause.** The splash is in the landing's `enter`, not on a timer.
- **Reset intents every step, then let the active beat set them.** Stale values from an earlier beat
  cause odd poses.
- **Consume one-shot events.** `Beats` can chain several transitions in one step. A "landed" flag read
  by consecutive beats fires them all. Read-and-clear flags (`consumeLanding()`).
- **Several actors?** Give each its own `Beats` and let them read each other: `herBeats.reached('shout')`.
- **Put the beat history in `probe()`** and check timing with `pnpm grab <name> … --probe` before
  looking at pixels.
- **Shape intents over time** with `ramp`, `envelope`, `keys` and `blink`, fed with `since`.

## Cameras

- Frame so the subject is a clear part of the image: around 1.5–2× zoom for a small character in a
  medium shot. Wide shots at 0.4–0.6 make space and loneliness.
- **Cut on the first frame** (`cam.cut`). Otherwise the pre-roll's follow velocity shows as a violent
  move.
- Let the beats or the shot pick the framing, and ease to it (`cam.frame`). Use `handheld` of 2–4 for
  calm shots and 8–13 for panic. `roll` gives a dutch angle for unease.
- **Parallax.** A layer at depth `d` shows x near `x * d`. When you scatter scenery for a far layer,
  center it with `cam.toLayer(x, d)`, not on world x. This matters most when the action is far from
  x = 0.
- **Depth of field.** Draw background layers inside `paper.layer(1, () => cam.layer(paper, …),
  'source-over', 'blur(6px)')`. Always pass `paper` (not `ctx`) to `cam.layer`, so the transform reaches
  the offscreen canvas.

## Multi-shot edits (`Edit`)

```ts
const edit = new Edit<'wide' | 'close' | 'after'>('wide', {
  wide:  { frame: ({ since }) => ({ x: 900 + since * 300, y: 520, zoom: 0.45 }), after: 3, then: 'close' },
  close: { frame: () => ({ x: hero.head.x + 60, y: hero.head.y, zoom: 3.5, handheld: 6 }), next: () => hero.fell && 'after' },
  after: { frame: ({ since }) => ({ x: hero.x, y: 700, zoom: lerp(1.6, 0.6, ramp(since, 1, 5)) }) }, // slow pull-back
});
// update(): edit.update(t, dt)      lateUpdate(): edit.apply(cam, t, dt)
```

- The story runs continuously; only the camera jumps. **Cut on action**, e.g. the moment a body hits
  the ground.
- Close-ups need thinner line weights and more detail (see art-direction.md). Per-shot looks, such as
  light direction and background blur, can be set in the shot's `enter`.
- **Slow motion:** `super(canvas, { duration, rate: speedRamp([{ from: 5.0, to: 5.5, rate: 0.35 }]) })`.
  Times are in scene seconds, and the video gets longer.

## Acts: several sets in one film

- Put each set far apart in the same world (x = 0, 20000, 40000…), each with its own `Camera`.
- Only the act that holds the character performs. Build creatures when their act begins, so they
  haven't drifted away by then.
- Scope world-wide functions (`world.wind`) by x range.
- **Switching acts:**
  1. Move the character (`place`).
  2. Cut the new camera.
  3. Draw the outgoing act, then call `tearWipe(ctx, u, () => drawIncoming())` or `irisWipe(ctx, u,
     center, …)` for about 0.9 s.
- Open an iris from something in the frame: `cam.toScreen(moon, depth)`.

## Motion design

- Titles: `layoutLetters` plus one `paper.text` per letter. Drop each letter with
  `overshoot((t - start) / 0.5)`, stagger them by about 0.07 s, and settle a small rotation.
- Letters can be floors: give each one a top height, so a character can hop along them and each letter
  dips with a spring when landed on.
- Confetti: `Particles` drawn as small paper rectangles, with the width scaled by `cos(age × spin)` so
  they flip.
- Transitions have a physical metaphor: tear the page, open an iris from the moon, match a shape.
