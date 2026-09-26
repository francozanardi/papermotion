# Pitfalls: symptom → cause → fix

Each of these happened. Check this list when something looks wrong.

## Physics and simulation

| Symptom | Cause | Fix |
| --- | --- | --- |
| Plants or strands jump several px in one frame | A hard collider snaps points; a pusher sign flips abruptly | `soft` colliders for bodies moving through strands; continuous push kernels |
| A rope or chain stretches under load | Too few iterations | The engine uses 32 alternating iterations. Check the length in the probe |
| A strand or cloth end "stands up like a horn" after a fall | It was flung up and huge air drag (0.1/step caps the fall near 120 px/s) holds it; slow motion makes it linger | Wet cloth: drag ≈ 0.03, gravity 1, `flex` ≈ 0.3; lying: `strength`/`flex` near 0 |
| Styled hair spikes when the head is horizontal | The rest shape lives in the head frame | Lower `Hair.strength` while lying |
| A flat thing lands standing on its edge | Flutter keeps going on the ground | Settle torque when grounded in calm air (`Plate` does it) |
| Things you set up at t = 0 are gone when the act starts | They simulated for 15 s | Create them when their act begins |
| A value is `NaN` and whole layers vanish | `Infinity` arithmetic, e.g. a "not happened yet" time | `smoothstep` handles ±Infinity; guard others with `Number.isFinite` |
| An event fires at once (a bus leaves the moment it stops) | `-Infinity + 2 < t` is true | `Number.isFinite(hitAt) && …` |
| A collision pushes nothing | Speed intents are reset each step, so the velocity read later is 0 | Store the impact velocity at the moment of contact |
| Run 2 differs from run 1 | `Math.random`, wall-clock time, iteration over unordered state | Seeded `rng`/`hash`, time from `this.time` |

## Choreography

| Symptom | Cause | Fix |
| --- | --- | --- |
| An actor does a dozen hops in one frame | Several beats chained in one step on the same "landed" flag | Read-and-clear events (`consumeLanding()`) |
| An action happens mid-turn or from the wrong side | Acting before lining up; side recomputed each step | A "line up" beat, then "commit"; latch the side in `enter` |
| Odd leftover poses | Intents not reset each step | `Object.assign(intent, REST)` before `beats.update` |
| Timing drifts from the plan | Scripted by the clock | Conditions (`next`), `after` as a fallback; check with `--probe` |
| A cut shows the wrong moment (the other actor is already in frame) | Shots triggered by time | Trigger shots from beats (`reached`, `current`) |

## Rigs and drawing

| Symptom | Cause | Fix |
| --- | --- | --- |
| A character looks like a pile of parts | Each part has its own shadow, rim and edge | One `paper.sheet` per character (plus far-limb and crossing-limb sheets) |
| Markings stick out like stickers | Drawn as separate pieces | `paper.inside`; recolor with `clip` + the same seed |
| Feet look like shoes or posts | No wrist taper; paw narrower or wider than it should be | Wrist, then a wider paw lying flat on the floor |
| An elbow or knee pokes up like a horn | IK target too close to the root: the chain folds | Keep targets at a comfortable reach (arms stretched out, not tucked) |
| Leg drawn over the coat or skirt | Draw order | Legs first, then the garment that covers them |
| The shoulder slices across the hair | The arm sheet is drawn after the hair | While lying, draw the hair in its own sheet after the arm |
| Feet slide while walking | Stride mismatch | `footReach ≈ step / 2` |
| A head comes off the body when running | Position springs | Bones (the child starts on the parent); angular springs only |
| A held prop floats above the hand | Glued at the hand point | Grip with fingers; the axis follows the forearm |
| Mud reads as polka dots or clown make-up | Round dark blots | Translucent smears along the slide direction; few; keep off the eyes |

## Camera and render

| Symptom | Cause | Fix |
| --- | --- | --- |
| The background never scrolls (no parallax); foreground missing | `cam.layer(ctx, …)` inside `paper.layer`: the transform goes to the wrong canvas | Always `cam.layer(paper, …)` |
| Far-layer scenery (trees, skyline) never appears | Props scattered around world x on a layer at depth d | Scatter around `cam.toLayer(x, d)` |
| A violent camera move in the first frames | Follow velocity from the pre-roll | `cam.cut(framing)` in `start()` and when a set begins |
| Close-up: white stripes, thick wires, faceted edges | World-unit line weights × zoom | Scale by `zoom^-0.55`; torn edges are already scale-aware |
| Scenery reads as line art at night | A bright cut edge on dark shapes | `paper.edgeColor` fainter on far layers |
| A render dies half way with "Execution context was destroyed" | The page reloaded | The scripts disable HMR and watching; still, don't edit while a render runs |
| Motion looks jerky in the browser | The live view drops frames | Judge only the rendered MP4 |
| "Frames must be rendered in order" | Asked for an earlier frame | Grab times in increasing order |

## Story

| Symptom | Cause | Fix |
| --- | --- | --- |
| Viewers don't get it | A symbolic prop (a lost shoe, yarn trail) with no setup | One clear action; show the goal early |
| Felt derivative | Reused a previous short's cast and props | Invent new ones; reuse engine primitives, not content |
