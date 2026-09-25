// Core
export * from './core/math';
export * from './core/random';
export { Spring } from './core/Spring';

// Physics: points and links, rigid plates, strings, soft bodies
export { World, type Pt, type PointOpts, type Collider } from './physics/World';
export { Plate, type AerofoilSpec } from './physics/Plate';
export { rope } from './physics/rope';
export { SoftBody, type SoftOpts } from './physics/SoftBody';

// Rigs: bones, biped gait, hair
export { Bone, type BoneDef, type BoneSpring } from './rig/Bone';
export { Skeleton } from './rig/Skeleton';
export { Gait, type GaitConfig, type GaitInput } from './rig/Gait';
export { Hair, type LockSpec, type HairStyle, type HairMaterial } from './rig/Hair';

// Motion: swimming, steering, schools
export { Swimmer, type SwimSpec, type SwimPose } from './motion/Swimmer';
export { steer } from './motion/steer';
export { School, type SchoolSpec, type Member } from './motion/School';

// Paper rendering
export { Paper, type PieceOpts, type Light } from './paper/Paper';
export { circlePoly, tubePoly } from './paper/geometry';
export { drawShafts, type ShaftSpec } from './paper/shafts';

// Scenery
export { type RidgeSpec, ridgeHeight, drawRidge } from './scenery/ridge';
export { flora, scallop } from './scenery/flora';
export { type Prop, type PropMaker, type PropSet, type ScatterSpec, scatter, drawProps } from './scenery/scatter';

// Camera
export { Camera, type CameraOpts } from './camera/Camera';

// Direction: choreography and time-shaped intents
export { Beats, type BeatSpec, type BeatContext, type BeatLog } from './direction/Beats';
export { ramp, envelope, blink, keys } from './direction/timeline';

// Stage: scenes, playback, overlays
export { Stage, type StageOptions } from './stage/Stage';
export { mount, type MountOptions, type StageHooks } from './stage/player';
export { fillGradient, vignette, caption, type CaptionOpts } from './stage/overlay';
