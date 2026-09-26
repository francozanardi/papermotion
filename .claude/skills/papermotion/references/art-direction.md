# Art direction: sets, light, color, composition

## Sets are the strength: build them in layers

A rich set is 5–8 parallax layers, each simple:

| Depth | What | Notes |
| --- | --- | --- |
| backdrop | `fillGradient` sky, stars | Screen space. A lighter band near the horizon separates the land |
| 0.02–0.06 | sun or moon, clouds, a distant glow (the goal of the story) | Barely moves. Keep clouds off the moon (it reads as a bite) |
| 0.1–0.3 | hills (`drawRidge`), skyline (`building`), far trees | Take on the color of the air: low contrast, the sky's hue |
| 0.35–0.6 | trees, poles, houses, mid ridges | A band of mist (a gradient strip) between layers adds depth |
| 1 | ground, the cast, interactive props, physics, particles, rain with splashes | Full contrast and detail |
| 1.2–1.5 | foreground grass, branches, frames | Dark, low, blurred (`paper.layer` + `'blur(5px)'`). Never cover the key action |
| 2+ | near rain, dust | Sparse, faint, long streaks |

- Place each far layer's props around `cam.toLayer(actionX, depth)`.
- Things the character **touches** must be at depth 1 and physical. Examples:
  - grass bent by `pushers`;
  - a wire that sags (a `chain` with the character's weight added);
  - a jelly (`SoftBody`);
  - kelp (strands with a soft collider);
  - water that splashes (`Particles` + rings).

  Interactions are what make a set feel alive.
- Write your own `PropMaker`s for the set's identity (lamps, fences, signs, boats), and parameterize
  them.
- **Clear the background behind key moments**, e.g. `scatter`'s `avoid` ranges. A dark tree behind a
  character's head reads as a blob.

## Light

- **One light direction per shot:** `paper.light = { x, y }`, the direction the light travels. Rim light
  lands on the side facing the light, and the core shadow on the side away from it. All sheets follow
  it automatically.
- **Motivate the light.** It can come from a low sun behind, a street lamp, a bus door, the moon, or
  shafts under water. Glows and cones are `paper.layer(…, 'screen')` gradients. Rain drawn clipped to
  a light cone glints; that is where rain becomes dramatic.
- **Night:** fade the paper cut edge on far layers (`paper.edgeColor = 'rgba(…, 0.05)'`), or dark
  scenery turns into line art. Lit windows and bulbs sell the city.
- **Flashes** (lightning, a camera flash): `wash(ctx, '#fff', a, 'screen')` plus a brighter sky for a few
  frames, as a double flicker.

## Color and value

- **Pick a palette per set:** a dominant hue, an accent (usually the hero) and neutrals. The protagonist
  should be the most saturated or the highest-contrast element in the frame.
- **Aerial perspective:** far layers get closer to the sky color and lower in contrast. Near trees that
  are too dark or saturated compete with the character.
- **Tones inside masses:** a base, a lighter top plane and a darker underside. Those, plus rim and core
  shadow, beat any texture.
- **Grayscale or noir:** author in grays and add `grade(ctx, 'grayscale(1) contrast(1.1)')` as a safety
  net. Make contrast carry the drama (lamps, wet reflections, rim light on a dark silhouette), and don't
  let everything sink to black.

## Composition

- Make the subject a clear part of the frame, with its key action in frame and staged in profile.
- Put the horizon low in a wide shot for sky and loneliness, or high to show the ground.
- **Show the goal early.** A distant glow turns "running" into "running toward something".
- **Captions and titles need contrast** (dark text with a light glow on bright skies, and the reverse at
  night). Keep them away from busy areas.
- **Typography as paper:** heavy weights read best as cut paper (e.g. Montserrat 800). The page loads
  Montserrat 300, 500 and 800.

## Finishing

The order matters: layers → vignette → flash → `grade` → `grain` → fades → `letterbox`.
- `grain` at 0.05–0.15 gives a film or paper feel.
- `letterbox(ctx, 2.39)` gives cinema. Remember the visible band is only the middle 803 px.
- Fade in from black over about 0.7 s and fade out at the end.

## Close-ups

- Line weights are in world px, so they grow with zoom. Scale rim, shade and thin lines by about
  `zoom^-0.55` (the scene sets a `lens` factor on the characters). Scale rain width by `zoom^-0.65`.
- Blur the background (depth of field), and keep one strong shape behind the head (a light, a post).
- Faces need the detail pass (see characters.md). Keep strands and "wet marks" off the eyes.
- Protect the face in the staging too. Wind blowing hair across the face hides the performance; a
  headwind keeps it clear and reads as struggle.
