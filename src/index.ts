// Core
export * from './core/math';
export * from './core/random';
export { Spring } from './core/Spring';

// Physics: points and links, rigid plates, strings, soft bodies, platforms, rolling balls
export { World, type Pt, type PointOpts, type Collider, type Link } from './physics/World';
export { Spool, type SpoolOpts } from './physics/Spool';
export { Plate, type AerofoilSpec } from './physics/Plate';
export { rope } from './physics/rope';
export { SoftBody, type SoftOpts } from './physics/SoftBody';
export { Surface } from './physics/Surface';
export { Roller, type RollerOpts } from './physics/Roller';

// Rigs: bones, legged gait, strands, hair
export { Bone, type BoneDef, type BoneSpring } from './rig/Bone';
export { Skeleton } from './rig/Skeleton';
export { Gait, type GaitConfig, type GaitInput } from './rig/Gait';
export { Strand, type StrandMaterial } from './rig/Strand';
export { Hair, type LockSpec, type HairStyle, type HairMaterial } from './rig/Hair';

// Motion: swimming, steering, schools, leaps
export { Swimmer, type SwimSpec, type SwimPose } from './motion/Swimmer';
export { steer } from './motion/steer';
export { School, type SchoolSpec, type Member } from './motion/School';
export { Leap } from './motion/Leap';

// Paper rendering
export { Paper, type PieceOpts, type SheetOpts, type Light } from './paper/Paper';
export { circlePoly, tubePoly } from './paper/geometry';
export { layoutLetters, textWidth, type Letter } from './paper/type';
export { drawShafts, type ShaftSpec } from './paper/shafts';

// Weather and effects
export { drawRain, drawRipples, drawDrips, type RainSpec, type SplashSpec, type RippleSpec, type DripSpec } from './weather/rain';
export { Particles, type Particle, type ParticleOpts, type Burst } from './fx/Particles';
export { drawSnow, snowflakes, type SnowSpec, type Flake } from './weather/snow';
export { Tracks, type Mark, type TracksOpts } from './fx/Tracks';

// Scenery
export { type RidgeSpec, ridgeHeight, drawRidge } from './scenery/ridge';
export { flora, scallop } from './scenery/flora';
export { building } from './scenery/building';
export { type Prop, type PropMaker, type PropSet, type ScatterSpec, scatter, drawProps } from './scenery/scatter';

// Camera
export { Camera, type CameraOpts, type Framing, type View } from './camera/Camera';

// Direction: choreography and time-shaped intents
export { Beats, type BeatSpec, type BeatContext, type BeatLog } from './direction/Beats';
export { ramp, envelope, blink, keys, speedRamp } from './direction/timeline';
export { Edit, type ShotSpec } from './direction/Edit';

// Stage: scenes, playback, overlays, film finishing
export { Stage, type StageOptions } from './stage/Stage';
export { mount, type MountOptions, type StageHooks } from './stage/player';
export { fillGradient, vignette, caption, type CaptionOpts } from './stage/overlay';
export { grade, grain, wash, letterbox } from './stage/grade';
export { tearWipe, irisWipe, type WipeOpts } from './stage/transition';
