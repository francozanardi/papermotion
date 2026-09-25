import type { LockSpec } from '../../src';
import type { ChildLook } from '../cast/Child';

const set = (angles: number[], lock: Omit<LockSpec, 'angle'>) => angles.map(angle => ({ ...lock, angle }));

/** A girl in a teal dress and burgundy tights, with long auburn hair falling down her back. */
export const GIRL: ChildLook = {
  skin: '#eab592', skinShade: '#d99c78', cheek: 'rgba(236, 128, 118, 0.55)', ink: '#231a1f', mouth: '#9a4a3c',
  top: '#3b8190', topBack: '#2e6874', outfit: 'dress',
  legs: '#8e3b3f', legsBack: '#6e2c31', shoe: '#2a1c1e',
  capTone: 1,
  hair: {
    palette: ['#3a1c12', '#52291a', '#6b3a24', '#85502f'],
    sheen: 'rgba(214, 150, 104, 0.5)',
    density: 2,
    jitter: { angle: 5, length: 0.12, width: 0.15 },
    locks: [
      ...set([178, 165, 152, -172, -160], { length: 104, width: 26, comb: -78, curl: -3, layer: 'under', tone: 0, hold: 0.55 }),
      ...set([-150, -135, -120], { length: 70, width: 26, comb: -70, curl: -9, layer: 'over', tone: 1, hold: 0.7 }),
      ...set([-105, -90, -75], { length: 52, width: 24, comb: -76, curl: -12, layer: 'over', tone: 2 }),
      ...set([-66, -54, -42], { length: 22, width: 18, comb: 82, curl: 5, layer: 'over', tone: 2, inset: 0.97, hold: 1.6 }),
      ...set([170, 155], { length: 64, width: 20, comb: -60, curl: -2, layer: 'over', tone: 1, hold: 0.6 }),
    ],
  },
};
