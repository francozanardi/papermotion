# Characters and creatures

## Choose the rig by what the character must do

| Character | Rig | Why |
| --- | --- | --- |
| Blocky or sprite-like critter, robot, toy | Custom: a body with squash springs, legs lifted by phase, `Leap` for hops | Reads at any size, never breaks, easy to make expressive |
| Quadruped (cat, dog, fox) | `Skeleton` + `Gait` with 4 legs, phases `[0, .5, .25, .75]`, bends `[-1, -1, 1, 1]` | Real walk and sit, stays readable |
| Biped | `Skeleton` + `Gait` with 2 legs | Works, but humans are the hardest (hair, hands, contact). Budget for it |
| Fish, bird, anything that flies or swims | `Swimmer` for motion, plus a skin drawn from `pose` | Steering, paper turns, effort-driven beats |
| Jelly, slime, balloon | `SoftBody` with an animated `rest` shape | Squash on contact for free |
| Tails, antennae, hair, scarves, flaps | `Strand` / `Hair` riding a bone frame | Follow-through and wind |

Non-human characters are cheaper and often more charming: the shape and the eyes do the acting.
Prefer them unless the story needs a person.

## Pattern A: a sprite-like creature

The whole body is one squashable block on stubby legs. Give it a root (the floor point under it), a
`mode` (`'walk' | 'air' | 'swim'`) and intents. Sketch:

```ts
export class Pebble {
  root: V; mode: 'walk' | 'air' = 'walk';
  intent = { speed: 0, facing: 1, look: null as V | null, joy: 0, blink: 1 };
  floor: (x: number, y: number) => number = () => 1e9;   // the scene decides what is solid
  private leap: Leap | null = null; private flight = 0; private phase = 0; private landedFlag = false;
  private readonly squash = new Spring({ x: 0, y: 0 }, 220, 13);   // x = squash amount (+ flat, − tall)
  private readonly eyes = new Spring({ x: 1, y: 0 }, 120, 18);     // slides toward the facing

  hop(to: V, apex: number) { this.leap = new Leap({ ...this.root }, to, apex, 2600); this.flight = 0; this.mode = 'air'; this.squash.vel.x -= 6; }
  consumeLanding() { const l = this.landedFlag; this.landedFlag = false; return l; }

  update(dt: number) {
    const i = this.intent;
    this.eyes.step({ x: Math.sign(i.facing), y: 0 }, dt);
    if (this.leap) {
      this.flight += dt; this.root = this.leap.at(this.flight);
      if (this.flight >= this.leap.duration) { this.root = { ...this.leap.to }; this.leap = null; this.mode = 'walk'; this.squash.vel.x += 7; this.landedFlag = true; }
    } else {
      const x = this.root.x + i.speed * i.facing * dt;
      this.root = { x, y: this.floor(x, this.root.y - 30) };
      this.phase += (i.speed * dt) / 26;                       // legs alternate with distance, not time
    }
    this.squash.step({ x: 0, y: 0 }, dt);
  }
}
```

Drawing it: see "Cut it from one sheet" below. The legs lift with `max(0, sin(phase + k·π))`. In the
air, stretch the body going up and squash it on the way down (use `keys` on `leap.progress`). The
eyes offset by `eyes.pos.x × 10` toward the direction of travel, or toward `look`.

## Pattern B: skeleton + gait

```ts
const soft = (stiffness: number, damping: number, inertia: number, sway: number) => ({ stiffness, damping, inertia, sway });
const BONES: BoneDef[] = [
  { name: 'spine', length: 90, angle: 0 },                                            // quadruped: root bone points forward
  { name: 'neck', parent: 'spine', length: 28, angle: -1.0, spring: soft(220, 18, 0.2, 0.4) },
  { name: 'head', parent: 'neck', length: 50, angle: -0.6, spring: soft(160, 12, 0.4, 0.8) },
  { name: 'thighN', parent: 'spine', at: 0.05, length: 34, angle: Math.PI / 2 }, { name: 'shinN', parent: 'thighN', length: 36, angle: 0 },
  { name: 'thighF', parent: 'spine', at: 0.05, length: 34, angle: Math.PI / 2 }, { name: 'shinF', parent: 'thighF', length: 36, angle: 0 },
  { name: 'upperN', parent: 'spine', at: 0.9, length: 32, angle: Math.PI / 2 },   { name: 'foreN', parent: 'upperN', length: 34, angle: 0 },
  { name: 'upperF', parent: 'spine', at: 0.9, length: 32, angle: Math.PI / 2 },   { name: 'foreF', parent: 'upperF', length: 34, angle: 0 },
];
const gait = new Gait({ pelvis: 'spine', pelvisAngle: 0, legs: [['thighN', 'shinN'], ['thighF', 'shinF'], ['upperN', 'foreN'], ['upperF', 'foreF']],
  phases: [0, 0.5, 0.25, 0.75], bends: [-1, -1, 1, 1], hipHeight: 62, step: 44, runSpeed: 500, bounce: 3, footLift: 13, footReach: 22, lean: 0, stance: 4 });

// every step:
skel.flip = intent.facing;
skel.root = { x, y: world.floorBelow(x, skel.root.y - 40) };
gait.update(skel, { speed, crouch, lean, ground: lx => world.floorBelow(skel.root.x + lx * dir, skel.root.y - 40) - skel.root.y, footOffset }, dt);
skel.setWorld('head', lookAngle);   // aim the head after the gait
skel.step(dt);
```

- **Poses come from intents, not keyframes.** A sit is: lower the hips (crouch), tilt the spine
  (lean), move the feet (`footOffset`), and let IK fold the legs. Check that every foot still reaches
  the floor.
- **Plan jumps** with `Leap`. In the air, pitch with the velocity, stretch at takeoff, tuck mid-air and
  reach before landing. Kick a squash spring on landing.
- **Turning around** is a paper turn: `flip` goes 1 → 0 → −1 over about 0.3 s. Never bend a side-view
  body into a U.
- **Heads and faces** are drawn in `skel.uprightFrame('head', radius)`: origin at the head center, +x
  toward the face, +y down.

## Cut it from one sheet

A character that is several separate pieces, each with its own shadow and edge, reads as a pile of
parts. Draw it as sheets:

```ts
draw(paper: Paper) {
  const anchor = this.root, k = this.lens;                  // lens ≈ zoom^-0.55: thinner rim in close-ups
  paper.sheet({ shadow: 5, rim: { color: L.rim, width: 2 * k }, anchor }, () => {
    this.drawLeg(paper, 'far', L.furBack);                  // far limbs: darker, their own sheet, behind
  });
  paper.sheet({ shadow: 9, rim: { color: L.rim, width: 3.5 * k }, shade: { color: 'rgba(10,5,20,0.4)', width: 9 * k }, anchor }, () => {
    paper.ribbon(this.tail.pts, u => 14 * (1 - u * 0.5), L.fur, { seed: 10, tear: 1.2 });
    paper.blob(TORSO.map(this.skel.boneFrame('spine')), L.fur, { seed: 20, tear: 1.5 });
    this.drawLeg(paper, 'near', L.fur);
    this.drawHead(paper);                                   // skull, ears, muzzle: silhouette pieces
    paper.inside(() => {                                    // markings never change the silhouette
      paper.blob(CHEST.map(this.skel.boneFrame('spine')), L.light, { seed: 21, tear: 0.8 });
      this.drawFace(paper);
    });
  });
}
```

- **Silhouettes from control points.** Build them with `blob` through croup, back, withers, chest and
  belly, not with a tube sausage. Limbs need mass where they join the body (haunch, shoulder blade).
  Feet need a wrist and a paw wider than the wrist, lying flat on the floor.
- **Recolor part of a piece** (socks, a tail tip, a hem) by redrawing the *same piece with the same seed*
  inside `paper.clip(region, …)`, so the torn edges match exactly.
- **Separate near limbs by tone and a faint crease** line inside the sheet, not by a seam.
- **An arm or wing that crosses the body** gets its own sheet, drawn after the body. When hair should
  fall over it (lying down), draw the hair in yet another sheet after the arm.
- **Draw order is part of the pose.** A coat skirt goes over the thigh. Near legs go before the coat.

## Detail pass

Anything near the camera must not be flat color:

- **Eyes.** An iris in two tones (dark ring, lit lower half), a pupil, one or two catchlights, and an
  upper lid line (thicker, with lashes on people). Blink with `blink(t, times)`. Slide the iris toward
  `look`. Even a two-rectangle sprite eye gets a tiny catchlight.
- **Faces.** A nose with a darker underside, mouth lines, cheek tone, and an inner ear in two tones.
  A profile gets a real silhouette (brow, nose, lips, chin).
- **Expressions** come from few parameters: `blink`, `brow` (−1 knitted … 1 raised), `mouth` (open),
  `happy` (eyes close into arcs), `surprise` (eyes taller). Drive them from beats.
- **Species and material cues:** stripes, collars, feathers, rivets, stitching. Draw them in `inside`.
- **Texture spikes:** two small tufts read as fur, and four read as torn paper.
- **Mud, water, wear:** translucent smears along the direction of motion (`paper.layer(0.6, …)` inside
  `inside`), never round dots.
- **Check proportions at full resolution.** Legs too long, a chest sticking out past the neck, feet that
  read as shoes or posts: none of this shows on a contact sheet.

## Strands, hair and cloth

- `Strand` rides a frame: `() => skel.boneFrame('spine')`. Always pass a function that returns the
  current frame, not a frame computed once.
- **Wet or heavy things** (wool, coats, soaked hair): drag about 0.03, gravity 1, `flex` 0.3. Lying on the
  ground: `strength` and `flex` near 0. Otherwise the styled shape stands up like a horn when the body
  rotates.
- **Hair styled in the head frame points the wrong way when the head turns** (face down: "back" is up).
  Lower `Hair.strength` while lying.
- Long hair is still weak in this engine. Keep it short, tied or under a hat if it matters.

## Contacts between characters and props (the weak spots)

- **Hugs, holds and carries** between two rigs overlap unless you anchor them. Attach one root to the
  other (`anchor()`), put both near arms in sheets drawn after both bodies, and keep the heads apart
  (one on the other's shoulder, not face on face).
- **Held props** must sit *in* the hand: fingers closed around the handle, and the prop's axis following
  the forearm. A prop glued above the hand reads as floating.
- **Momentum:** read the incoming speed at the moment of contact (store it when the leap ends), then
  push the other body by its share of the mass.
