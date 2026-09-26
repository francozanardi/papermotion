# Embers

A wordless, 30-second paper film about two forms of inheritance: looking after one another and wondering about the world.

A gust diminishes a campfire. An elder shelters it while a child adds a branch. The fire recovers. The elder points to a constellation, and the child looks up. Around the same little circle of warmth, a stone shelter becomes a seafarer's camp and then a contemporary campsite. Finally, the child raises a hand toward the sky as the elder lowers theirs.

These are poetic, fictional eras, not a reconstruction of a specific culture or a claim that human history followed a single path. The constellation is invented. There are no titles, captions, spoken words, external images or audio samples.

## Direction

- **0–2.8 s:** close view of the hearth; a gust shrinks and bends the flame.
- **2.8–3.47 s:** cut on the child's reach. A branch enters the coal bed.
- **3.47–5.28 s:** the released branch falls under physics, resting against the fire bed and ground. The flame regains strength.
- **5.28–9.68 s:** the elder points. A wider view connects the people with the night sky.
- **9.68–15.28 s:** the shelter, clothing and horizon dissolve into a seafaring-era camp; the poses and constellation remain continuous.
- **15.28–20.68 s:** a modern tent, telescope and distant town emerge. The child takes over the pointing gesture.
- **20.68–30 s:** the camera withdraws and lifts to the Milky Way. The fire remains a small warm presence below it.

Times are measured from the fixed-step simulation; the fuel beat is contact-triggered.

## Engine and content

`src/fx/Fire.ts` is a reusable primitive with spring-driven flame tongues, wind response, heat output, deterministic continuous ember emission, smoke, and a separate glow pass. Unit tests cover repeatability, extinction, wind response and low-heat geometry under strong wind. Lateral reach is bounded by flame height, and each color layer is merged into one paper silhouette to prevent detached strips during gusts.

`details.ts` adds weathered stone strata, wood grain and char, ash, ground debris, canvas folds, fastenings and small era-specific belongings. Mountain samples are anchored to world coordinates so their contours stay stable while the camera moves.

`Witness.ts` contains the story's connected seated character rig and its three costumes. `main.ts` owns choreography, the set, the synthetic score and stereo fire ambience. The branch reuses `Plate` and `Surface`; it does not remain suspended at the released hand position.

The score repeats one melodic figure through the eras. Crackles and low flame noise follow the simulated heat level. The branch contact produces its own sound event.

## Run

```bash
pnpm render embers
pnpm grab embers 1 3.5 5 7 14 19 24 28
pnpm sheet embers 1 0 30
pnpm typecheck
pnpm test
```

Output: `out/embers.mp4`, 1920 × 1080, 30 fps, stereo audio.
