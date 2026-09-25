# Field notes: what we learned making shorts with papermotion

Practical lessons from building the examples (`kite`, `autumn`, `sea`, `rooftops`) and fixing what went wrong.
Read this before making a scene. Each note is a mistake we made, or a fix that worked, and why.

---

## 1. Workflow: look, measure, then fix

- **Render offline, always judge the video.** `pnpm render <example>` renders frame by frame and pipes the
  frames to ffmpeg. The live view (`&live`) stutters on heavy scenes and says nothing about the final smoothness.
  Never judge motion from it.
- **Probe before you look.** Give every scene a `probe()` that returns the numbers that matter: positions,
  distances, the current beat, and the beat history. Most bugs showed up here first, before any frame was checked:
  - a rope stretched 18%;
  - a school of fish that never reached the jelly;
  - a touch that never happened;
  - a zoom that was `NaN`.
- **Contact sheet first, full resolution second.** A sheet (for example 16 frames at 1.6 fps) shows timing and
  composition. Crops of single frames at full resolution show the drawing itself: seams, proportions, markings.
  Many problems don't show on the sheet at all: feet like shoes, a chest sticking out, a bib that looks like a
  sticker.
- **Measure "jumps" numerically.** Plants looked jittery. We logged how far every point moved per frame and
  flagged anything over 12 px. That found the cause (hard colliders, see §3) and proved the fix: zero jumps.
- **Frames go in order.** The simulation only moves forward. `Stage.renderFrame` throws if you go back.

## 2. Engine versus content

- **Reusable behaviour goes in `src/`; the story stays in `examples/`.** When a scene needs a new way to move,
  touch or draw, and another scene could use it too, make it an engine primitive with parameters. That is how
  these came to exist: `SoftBody`, `Swimmer`, `School`, `Surface`, `Strand`, `Leap`, `Beats`, `Paper.sheet`,
  `inside`, `clip` and `shade`.
- **But don't grow a catalog.** A hero house with its walkable roof stayed in the example. Only move it into the
  engine when a second scene needs it.
- **Generalize instead of forking.**
  - The biped `Gait` became a legged gait, with a phase, knee direction and foot offset for each leg. The same
    code walks the child and the cat.
  - `Hair` was rebuilt on `Strand`, so cat tails are strands too.
  - The pigeon flies with `Swimmer` (steering, a paper turn when it reverses, and a "tail beat" that drives the
    wings).
- **Refactor, then check the old examples still give the same numbers.** After generalizing `Gait` and `Hair`,
  the kite and autumn probes had to match the earlier values exactly. They did.

## 3. Physics that reads right, not realistic

- **Long chains stretch under load.** The fix was more solver iterations (32) plus a sweep direction that
  alternates every iteration. Check rope length with the probe.
- **Kites and leaves need anisotropic drag.** Paper falls slowly edge-on but slides easily face-on, so use a
  separate `dragY`. Lift should grow with horizontal airspeed.
- **Flat things settle lying down.** Once grounded in calm air, switch flutter off and add a torque toward lying
  flat. Otherwise a kite lands standing on its tip.
- **Hard colliders snap thin things.** A fish moving 7 px per step pushed kelp tips 16 px in one frame. Use
  `soft` colliders (a spring pushing by how much they overlap) for bodies moving through strands. Keep hard ones
  only for firm contact.
- **Platforms are one-way `Surface`s.** Points land on them from above and pass through from below. Walkers
  query `world.floorBelow(x, y - 40)`, starting a bit above their feet, so they can climb slopes. Tails that
  touch a surface rest on it for free.
- **Pre-roll the scene.** `Stage` simulates about 0.6 s before frame 0 so hair, tails and ropes settle.
  - Actors should hold still during it (`if (this.settling) return`).
  - Cameras must not chase targets that don't exist yet.
- **`Camera.snap` must also zero the camera's velocity.** Otherwise the speed it picked up during the pre-roll
  shows as a violent move in the first frames.
- **"Hasn't happened yet" is `Infinity`, and it must never produce `NaN`.** `smoothstep(Infinity, …)` used to
  return `NaN`: the zoom went `NaN` and whole layers disappeared. The engine now returns 0 or 1 for infinite
  edges, and `Camera.layer` throws on non-finite values.
- **Everything must be deterministic.** Fixed timestep, seeded `rng`, time derived from an integer step counter
  (so `t = 0` is exact). No `Math.random`, no wall clock.

## 4. Rigs and locomotion

- **Keep bodies connected by construction.** A head on a position spring came off the body when running. Use
  bones, where a child always starts on its parent. Put the life in the angular springs (lag, overlap,
  follow-through), not in loose positions.
- **Foot sliding comes from stride mismatch.** Keep `footReach ≈ step / 2`.
- **Choose the knee direction per leg.** Hind knees and human knees bend forward (`-1`); front elbows bend
  backward (`+1`).
- **Poses come from intents, not keyframes.** A cat sits by lowering its hips, tilting the spine up and moving
  its feet (`footOffset`); the IK folds the legs. Check that every foot can still reach the floor. With shorter
  legs, the front paws floated until the chest came down.
- **Plan jumps, don't simulate them.** `Leap` computes the arc from A to B for a given apex height. Keep jump
  gravity snappier than the world's.
  - In the air: pitch the body with the velocity, stretch at takeoff, tuck in the middle, reach before landing.
  - On landing: kick a squash spring.
- **Turning around is a paper turn.** The figure squashes through edge-on (`flip` from 1 through 0 to -1). Never
  bend a side-view body into a U.
- **Swimmers and flyers face where they move, or what they look at when slow.** They pitch along their path, and
  the "tail beat" grows with effort.

## 5. Choreography: beats, not stopwatches

- **Timing was the real bottleneck.** Most iterations on the fish went into when things happen, not how:
  - it arrived late;
  - it touched the jelly in the middle of a turn;
  - it lined up on the wrong side.

  Timed intents can't adapt to physics. Use `Beats`: each beat does something while active, and ends on a
  condition, or after a time as a fallback.
- **Split actions into a "line up" beat and a "commit" beat.** The fish only moves in to touch once it is at the
  staging point and already facing the jelly. Before we split them, the touch happened while it was edge-on.
- **Latch decisions in `enter`.** Pick the approach side once, when the beat starts, from the direction of
  travel. Recomputing it every step (or choosing by position) sent the fish back across the frame.
- **Effects belong to the beat they cause.** The touch is `approach`'s exit condition. The startle, the kick and
  the bubbles are `retreat`'s `enter`.
- **Reset intents every step, then let the active beat set them.** For example
  `Object.assign(cat.intent, CAT_REST)`, then `beats.update()`. Stale values from an earlier beat caused odd
  poses.
- **Let beats choose the camera shot too** (framing point and zoom), and have the camera ease toward it.
- **Put the beat and the beat history in the probe** (`beat@time`), so you can check the timeline without
  watching the video.

## 6. Paper rendering: cohesion first

- **A character is ONE piece of paper.** When each part had its own torn edge, shadow, rim light and cut edge,
  the cat looked like a pile of parts glued together.
  - Draw it inside `paper.sheet(...)`: the parts merge into one silhouette that gets one shadow, one rim light,
    one core shadow, one texture and one cut edge.
  - Use a second sheet for far-side limbs, in a darker tone.
  - Give independent flaps (a bird's near wing) their own sheet.
- **Markings must never change the silhouette.**
  - A white chest drawn as its own piece stuck out of the body like a sticker. Draw markings in
    `paper.inside(...)`, which clips them to the sheet.
  - A marking should touch the silhouette's edge, not float in the middle.
  - To recolor part of a piece (socks, a tail tip, a hem), redraw the **same piece with the same seed** inside
    `paper.clip(region, …)`, so the torn edges match to the pixel. A separate sock piece had its own torn edge
    and left white and black teeth along the join.
- **Tone, not seams, separates the near limbs.** A lighter near-leg color drew a "sleeve" outline. A faint crease
  line inside the sheet gives form without a seam.
- **Build silhouettes from control points.** A tube with a width profile made a lumpy sausage of a torso. Use
  `paper.blob` through points (croup, back, withers, deep chest, tucked belly).
  - Limbs need mass where they join the body: a haunch, a shoulder blade.
  - Feet need a wrist and a paw wider than the wrist. Otherwise they read as posts (too thin) or shoes (too wide,
    pushed forward).
- **Light has one direction per scene (`paper.light`).**
  - The rim light goes on the side facing the light, and the core shadow (`shade`) on the side turned away.
  - Highlights with no logic (all on top, or drawn after every base) looked wrong on trees. Tone the tree lobes
    by height and draw the rim per lobe, in draw order.
- **Pushers must bend props continuously.** Grass used to flip from +0.6 to -0.6 when a body crossed it, and it
  reacted to fish swimming 500 px above it. The push is now zero right on top, strongest to either side, and fades
  with height above the ground.

## 7. Art direction checklist (close-up and protagonists)

- **Size in frame.** Heroes were too small at first (zoom 1.0–1.35). Frame so the subject is a clear part of the
  shot; around 2× worked for a cat on rooftops.
- **No flat masses.** Give each mass at least two tones: base plus core shadow, and a rim on the lit side. The
  detail pass was the biggest jump in quality:
  - **Eyes:** iris in two tones (dark outer ring, lit lower half), pupil, one or two catchlights, and an upper
    lid line.
  - **Faces:** nose with a darker underside, mouth and philtrum lines, whisker pads, inner ear in two tones with
    hairs, cheek tufts on the silhouette.
  - **Species cues:** a pigeon's orange eye with a pale ring, a white cere, an iridescent collar, two wing bars
    and darker flight feathers.
- **Don't overdo texture spikes.** Four fur tufts under the belly read as torn paper; two small ones near the
  chest read as fur.
- **Check proportions at full size.** Things the user caught that we didn't:
  - legs too long;
  - a chest sticking out past the neck;
  - feet like shoes, then like posts.
- **Composition.**
  - Clear the background behind key moments (a dark tree behind the kid's chin read as a blob).
  - Keep foreground silhouettes low and not black-heavy; they dominated the first seconds of the sea.
  - Keep clouds off the moon: a dark cloud looked like a bite taken out of it.
  - Make sure the key event happens in frame. The pigeon's startle was lost until the chimney moved next to the
    landing spot.
- **Aerial perspective is a color rule.** Far layers take on the color of the air or water. Near trees that
  were too saturated or too dark competed with the character.
- **Captions need contrast.** Use dark text with a light glow on bright skies, and light text with a dark glow
  at night. Keep them clear of busy areas (a school of fish crossed the text).

## 8. Performance notes

- Sheets cost a few extra offscreen passes each. The cat scene went from about 25 s to about 45 s to render
  10 s of video. That is fine offline. If it matters, restrict the passes to a bounding box (sheets already do)
  and avoid sheets on tiny background props.
- Drop shadows with blur on every small piece add up. Background props can use smaller shadows.

## 9. Multi-shot stories (`rain`)

A 20-second story with eight shots, two characters, a vehicle and weather. It works as a whole, but it is
**not polished** — see "Still weak" below. What we learned:

### Edit and camera

- **One continuous simulation, many shots.** The story never stops. `Edit` only moves the camera. It is a
  shot list with the same `next` and `after` rules as `Beats`.
- **Cut on action.** Cut when the event happens (`next: () => her.landed && 'mud'`), not at a guessed time.
  A shot can also wait for a story beat (`herBeats.reached('shout')`).
- **Stage key moments inside the shot.** In the traveller's close-up she was already in frame before they
  turned. Check with the probe which beat each character is on at every cut.
- **Slow motion means fewer simulation steps per frame** (`StageOptions.rate`, `speedRamp`). Use it on the
  impact moments: the stumble and the leap into someone's arms. It also makes anything floating hang
  longer in the air (see the scarf below).

### Close-ups

- **World-unit line weights grow with zoom.** At 4× zoom a 3 px rim light turned into a white stripe, and
  the barbed wire into bars. Scale rim, shade and thin lines by about `zoom^-0.55` (`Person.lens`,
  `drawFence(…, lens)`). Rain streaks need the same treatment: width × `zoom^-0.65`.
- **Torn edges are sampled by scale.** The engine does this now. Before, close-ups showed facets.
- **The face must stay readable.** Wet strands drawn across the eye read as scribbles. Rain highlights
  read as freckles. Round mud spots read as clown make-up or a dalmatian. What worked instead:
  - one thin strand at the temple;
  - two highlights;
  - mud as translucent smears along the direction she slid (`paper.layer` inside `paper.inside`).
- **Wind direction is art direction.** A tailwind blew her hair over her face. A headwind is more dramatic
  and keeps the face clear.
- **Draw order is part of a pose.** Lying down, the near-arm sheet cut across the hair. When she lies
  down, the hair moves to its own sheet on top of the arm. When she runs, the near leg goes *before*
  the coat, so the skirt falls over the thigh.

### Physics of cloth and hair in a fall

- **A style in the head frame points the wrong way when the head turns.** Hair combed "back" stands up
  when she lies face down. Lower `Hair.strength` while lying.
- **Strands flung in a fall can hang in the air for seconds.** That happens with high air drag (0.1 per
  step caps the fall at about 120 px/s), and slow motion stretches it further. Wet wool and coats need low
  drag, full gravity and `Strand.flex` near 0 on the ground.
- **Probe positions before guessing.** A white shape standing up after the fall looked like a leg, an
  arm or a coat flap. The probe showed which it was in one run.
- **An IK target too close to the shoulder folds the arm with the elbow up** (it looked like a horn).
  Keep hand targets at a comfortable reach.

### Scene mechanics

- **`Camera.layer` inside `paper.layer` must get the `Paper`, not the main context.** Otherwise the
  camera transform never reaches the offscreen canvas, and the whole background stays frozen. We didn't
  notice for several iterations, because single frames looked fine. Compare two distant frames of the
  same layer to check parallax.
- **Infinity arithmetic bites.** `hitAt = -Infinity`, so `hitAt + 2.1 < t` is always true, and the bus left
  as soon as it stopped. Guard with `Number.isFinite`.
- **Speed intents are reset every step.** Read a collision's velocity at the moment of contact
  (`Person.impact`), not afterwards.
- **Night scenes: turn down the paper cut edge on far layers** (`paper.edgeColor`). Otherwise dark
  scenery turns into line art.
- **Show the goal from the first shot** (a glow on the horizon). It turns "running" into "running toward
  something".
- **Don't edit sources while a render runs.** The render server no longer watches files, but reading a
  half-edited scene is still a bad idea.
- **Keep the story's props readable, or leave them out.** The lost shoe and the scarf unravelling into a
  yarn trail were meant as metaphors ("losing part of yourself"). The user found them confusing, so we
  removed them. One clear action beats a subtle symbol at this scale.

### Still weak (next work)

- **Hair.** Locks are stiff ribbons. Long wet hair needs to clump, cling and move as a mass.
- **The embrace.** Two independent rigs overlap, and nothing holds them in contact. The hug needs real
  two-body contact: shared anchors, arms that wrap around a partner's silhouette, heads that avoid each
  other.
- **The run cycle.** The procedural gait reads as a stiff trot at full speed. It needs:
  - push-off and knee drive;
  - a flight phase;
  - arms that pump from the shoulder;
  - a torso twist.
- **Held props.** The umbrella looked glued above the hand. Held props need a grip: fingers wrapped
  around the handle, with the prop's axis following the forearm.
- **Transitions between modes** (walk → tumble → ground → walk, leap → held) pop in places. Blend
  poses across mode changes instead of switching targets.
