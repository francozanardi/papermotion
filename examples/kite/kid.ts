import type { LockSpec } from '../../src';
import type { ChildLook } from '../cast/Child';

const set = (angles: number[], lock: Omit<LockSpec, 'angle'>) => angles.map(angle => ({ ...lock, angle }));

/** The kid from scene 2: yellow raincoat, red scarf, short tousled hair. */
export const KID: ChildLook = {
  skin: '#f1c29c', skinShade: '#e3a984', cheek: 'rgba(240, 143, 134, 0.55)', ink: '#1d1b26', mouth: '#9a5a45',
  top: '#f5c230', topBack: '#d9a417', outfit: 'coat', buttons: '#b8860f',
  legs: '#33365a', legsBack: '#23253f', shoe: '#17182a',
  scarf: { band: '#e2463c', tail: '#c8362e' },
  capTone: 1,
  hair: {
    palette: ['#1f140f', '#2b1d17', '#3a271d', '#4a3326'],
    sheen: 'rgba(160, 118, 90, 0.5)',
    density: 2,
    jitter: { angle: 5, length: 0.15, width: 0.15 },
    locks: [
      ...set([175, 160, 145, -170, -155], { length: 36, width: 20, comb: -55, curl: -6, layer: 'under', tone: 0 }),
      ...set([-155, -140, -125], { length: 38, width: 24, comb: -62, curl: -11, layer: 'over', tone: 1 }),
      ...set([-110, -95, -80, -65], { length: 36, width: 24, comb: -72, curl: -12, layer: 'over', tone: 2 }),
      ...set([-72, -60, -48, -36], { length: 20, width: 17, comb: 78, curl: 6, layer: 'over', tone: 2, inset: 0.97, hold: 1.6 }),
      ...set([165, 148], { length: 20, width: 16, comb: -25, curl: -4, layer: 'over', tone: 1 }),
    ],
  },
};
