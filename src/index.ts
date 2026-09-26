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
export { darkness, type Glow } from './paper/darkness';

export { Fire, type FireOpts } from './fx/Fire';

// Weather and effects
export { drawRain, drawRipples, drawDrips, type RainSpec, type SplashSpec, type RippleSpec, type DripSpec } from './weather/rain';
export { Particles, type Particle, type ParticleOpts, type Burst } from './fx/Particles';
export { drawSnow, snowflakes, type SnowSpec, type Flake } from './weather/snow';
export { Tracks, type Mark, type TracksOpts } from './fx/Tracks';
export { drawSpray, sprayFleck, type SpraySpec, type Speck } from './fx/spray';

// Audio: sound events from the simulation, parametric voices, scores and a mixer
export { type Stereo, type FilterType, type Wave, Biquad, Smoother, hz, db, noiseSource, decayEnvelope, gate, wave, softClip } from './audio/dsp';
export { voice, layer, type Param } from './audio/voices';
export { instrument } from './audio/instruments';
export { Mixer, freeverb, limit, encodeWav, type BusOpts, type PlaceOpts, type MixOpts } from './audio/Mixer';
export { SoundLog, type Cue, type CueOpts } from './audio/SoundLog';
export { note, degree, triad, tempo, MODES, type Mode, type Note } from './audio/music';

// Scenery
export { type RidgeSpec, ridgeHeight, drawRidge } from './scenery/ridge';
export { flora, scallop } from './scenery/flora';
export { building } from './scenery/building';
export { starSky, drawSky, skyPoint, type Sky, type SkySpec, type SkyFrame, type Star, type SkyCloud } from './scenery/stars';
export { type Prop, type PropMaker, type PropSet, type ScatterSpec, scatter, drawProps, pushBend } from './scenery/scatter';
export { type SwardSpec, drawSward } from './scenery/sward';

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
