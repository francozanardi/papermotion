import { type Paper, type Sky, type V, type View, circlePoly, fbm1, hash, noise1, rng, smoothstep, starSky } from '../../src';

/** The shelter floor (world y). */
export const GROUND = 900;
/** Where the fire burns. */
export const FIRE: V = { x: 600, y: 896 };

/**
 * The back wall of the rock shelter, a backdrop on the action plane: it rises from the floor on the
 * right, leans out into an overhang above the fire, and runs up out of frame.
 */
export const WALL: V[] = [
  { x: 884, y: 905 }, { x: 874, y: 800 }, { x: 852, y: 690 }, { x: 826, y: 590 }, { x: 800, y: 500 }, { x: 768, y: 420 },
  { x: 732, y: 350 }, { x: 698, y: 302 }, { x: 668, y: 268 }, { x: 648, y: 244 }, { x: 664, y: 222 }, { x: 720, y: 206 },
  { x: 760, y: 204 }, { x: 800, y: 184 }, { x: 860, y: 186 }, { x: 930, y: 158 }, { x: 990, y: 150 }, { x: 1050, y: 118 },
  { x: 1120, y: 110 }, { x: 1200, y: 84 }, { x: 1300, y: 62 }, { x: 1380, y: 22 }, { x: 1480, y: 8 }, { x: 1600, y: -60 },
  { x: 1760, y: -104 }, { x: 1900, y: -130 }, { x: 2050, y: -210 }, { x: 2300, y: -300 },
  { x: 3200, y: -520 }, { x: 3200, y: 1000 }, { x: 884, y: 1000 },
];

/** The shelter floor: a ledge that ends in the canyon on the left. */
export const FLOOR: V[] = [
  { x: 60, y: 1000 }, { x: 96, y: 930 }, { x: 150, y: 904 }, { x: 260, y: 898 }, { x: 900, y: 900 }, { x: 3200, y: 902 }, { x: 3200, y: 1500 }, { x: 60, y: 1500 },
];

/** Layer depths of the set. */
export const DEPTH = { stars: 0.12, mesas: 0.25, canyon: 0.45, rim: 0.7 };

/** The southern sky: the stars wheel clockwise around an empty pole, the Cross and the two Clouds nearby. */
export function makeSky(): Sky {
  const pole = { x: 760, y: 170 };
  const cross = { x: 1010, y: 40 };
  const angle = 1.15, nrm = { x: -Math.sin(angle), y: Math.cos(angle) };
  const offset = (cross.x - pole.x) * nrm.x + (cross.y - pole.y) * nrm.y;
  const sky = starSky({
    seed: 21, pole, radius: 2400, count: 4200,
    band: { angle, offset, width: 150, stars: 4000, clouds: 120, color: '200, 205, 235' },
    tints: ['205, 220, 255', '255, 250, 242', '255, 236, 205', '190, 210, 255'],
  });
  const star = (p: V, mag: number, tint = '225, 235, 255') => {
    const d = { x: p.x - pole.x, y: p.y - pole.y };
    sky.stars.push({ r: Math.hypot(d.x, d.y), a: Math.atan2(d.y, d.x), mag, tint, phase: p.x });
  };
  // Crux, and the two Pointers.
  star({ x: cross.x, y: cross.y - 46 }, 0.97); star({ x: cross.x + 6, y: cross.y + 40 }, 1);
  star({ x: cross.x - 30, y: cross.y - 2 }, 0.9); star({ x: cross.x + 32, y: cross.y + 4 }, 0.86);
  star({ x: cross.x + 14, y: cross.y + 16 }, 0.6);
  star({ x: cross.x + 150, y: cross.y + 60 }, 1, '255, 240, 215'); star({ x: cross.x + 112, y: cross.y + 46 }, 0.95);
  // The Magellanic Clouds: two soft patches on the other side of the pole.
  const cloud = (p: V, size: number, alpha: number) => {
    const d = { x: p.x - pole.x, y: p.y - pole.y };
    sky.clouds.push({ r: Math.hypot(d.x, d.y), a: Math.atan2(d.y, d.x), size, alpha });
  };
  for (let i = 0; i < 5; i++) cloud({ x: pole.x - 190 + i * 7, y: pole.y + 90 - i * 5 }, 40 - i * 4, 0.14);
  for (let i = 0; i < 3; i++) cloud({ x: pole.x - 60 + i * 5, y: pole.y + 170 }, 24 - i * 4, 0.12);
  return sky;
}

/** Flat-topped mesas along the horizon (layer px). */
export function mesaHeight(x: number): number {
  const n = fbm1(x * 0.0011, 7, 3);
  return 770 - 80 * smoothstep(-0.02, 0.05, n) - 55 * smoothstep(0.26, 0.31, n) + noise1(x * 0.02, 3) * 3;
}

/** Faraway land: mesas, a city glow behind them late in the film, the far canyon wall and its rim. */
export function drawLand(p: Paper, depth: keyof typeof DEPTH, v: View, city: number): void {
  const from = Math.floor(v.from / 10) * 10, pts: V[] = [];
  if (depth === 'mesas') {
    if (city > 0) {
      const c = p.context, g = c.createLinearGradient(0, 560, 0, 800);
      g.addColorStop(0, 'rgba(255, 150, 70, 0)');
      g.addColorStop(1, `rgba(255, 150, 80, ${0.32 * city})`);
      c.fillStyle = g; c.fillRect(v.from, 560, v.to - v.from, 260);
    }
    for (let x = from; x <= v.to + 10; x += 10) pts.push({ x, y: mesaHeight(x) });
    pts.push({ x: v.to + 10, y: v.bottom + 400 }, { x: from, y: v.bottom + 400 });
    p.piece(pts, '#171b33', { seed: 301, tear: 1.5, shadow: 0 });
    return;
  }
  if (depth === 'canyon') {
    for (let x = from; x <= v.to + 10; x += 10) pts.push({ x, y: 800 + fbm1(x * 0.004, 12, 3) * 38 });
    pts.push({ x: v.to + 10, y: v.bottom + 400 }, { x: from, y: v.bottom + 400 });
    p.piece(pts, '#12152a', { seed: 302, tear: 2, shadow: 4 });
    // Strata on the far canyon wall.
    for (let k = 0; k < 3; k++) {
      const band: V[] = [];
      for (let x = from; x <= v.to + 10; x += 20) band.push({ x, y: 850 + k * 40 + fbm1(x * 0.006, 40 + k, 2) * 14 });
      for (let x = v.to + 10; x >= from; x -= 20) band.push({ x, y: 862 + k * 40 + fbm1(x * 0.006, 40 + k, 2) * 14 });
      p.piece(band, 'rgba(38, 42, 70, 0.55)', { seed: 310 + k, tear: 1.5, shadow: 0, edge: false, texture: 0.1 });
    }
    return;
  }
  // The near rim of the canyon, with shrubs.
  for (let x = from; x <= v.to + 10; x += 10) pts.push({ x, y: 880 + fbm1(x * 0.003, 19, 3) * 30 });
  pts.push({ x: v.to + 10, y: v.bottom + 400 }, { x: from, y: v.bottom + 400 });
  p.piece(pts, '#0d0f1b', { seed: 303, tear: 2, shadow: 6 });
  for (let cell = Math.floor(v.from / 90); cell * 90 < v.to; cell++) {
    if (hash(cell * 13 + 5) < 0.55) continue;
    const x = cell * 90 + hash(cell * 7) * 60, y = 880 + fbm1(x * 0.003, 19, 3) * 30, s = 10 + hash(cell * 3) * 16;
    p.blob([{ x: x - s * 1.4, y: y + 3 }, { x: x - s, y: y - s * 0.8 }, { x: x, y: y - s * 1.2 }, { x: x + s, y: y - s * 0.7 }, { x: x + s * 1.4, y: y + 3 }], '#0a0c15', { seed: 320 + cell, tear: 2, shadow: 0 });
  }
}

/** The rock face: warm volcanic stone in strata, spalls, cracks; soot over the hearth, lichen with the ages. */
export function drawWall(p: Paper, lens: number, soot: number, lichen: number): void {
  p.sheet({ shadow: 0, texture: 0.45, edge: true }, () => {
    p.piece(WALL, '#8f5f45', { seed: 401, tear: 3 });
    p.inside(() => {
      for (let k = 0; k < 11; k++) {
        const y0 = -300 + k * 115, band: V[] = [], th = 36 + hash(k * 3) * 50;
        for (let x = 600; x <= 3200; x += 40) band.push({ x, y: y0 + (x - 600) * -0.14 + fbm1(x * 0.004, 50 + k, 3) * 40 });
        for (let x = 3200; x >= 600; x -= 40) band.push({ x, y: y0 + th + (x - 600) * -0.14 + fbm1(x * 0.004, 70 + k, 3) * 30 });
        p.piece(band, k % 3 === 0 ? 'rgba(70, 32, 22, 0.28)' : k % 3 === 1 ? 'rgba(255, 214, 170, 0.09)' : 'rgba(120, 60, 40, 0.2)', { seed: 410 + k, tear: 2.5, shadow: 0, edge: false, texture: 0 });
      }
      const r = rng(77);
      for (let i = 0; i < 16; i++) {
        const c = { x: 850 + r() * 1500, y: 240 + r() * 620 }, s = 30 + r() * 70;
        const spall = circlePoly(c, s * (0.4 + r() * 0.3), 9, s).map((q, j) => ({ x: q.x + (hash(i * 40 + j) - 0.5) * s * 0.5, y: q.y + (hash(i * 40 + j + 9) - 0.5) * s * 0.3 }));
        p.piece(spall, r() < 0.5 ? 'rgba(255, 220, 185, 0.1)' : 'rgba(60, 25, 18, 0.16)', { seed: 440 + i, tear: 2, shadow: 0, edge: false, texture: 0 });
      }
      for (let i = 0; i < 9; i++) {
        let q = { x: 880 + r() * 1300, y: 200 + r() * 640 };
        const crack = [q];
        for (let j = 0; j < 5; j++) { q = { x: q.x + (r() - 0.5) * 60, y: q.y + 25 + r() * 35 }; crack.push(q); }
        p.line(crack, 'rgba(30, 12, 10, 0.5)', (1.4 + r()) * lens);
      }
      // The base of the wall, darker where the floor's dust has climbed it.
      p.piece([{ x: 860, y: 905 }, { x: 870, y: 850 }, { x: 1400, y: 856 }, { x: 3200, y: 850 }, { x: 3200, y: 910 }], 'rgba(40, 22, 18, 0.35)', { seed: 470, tear: 4, shadow: 0, edge: false, texture: 0 });
      if (soot > 0) {
        const c = p.context, g = c.createRadialGradient(700, 250, 10, 700, 250, 320);
        g.addColorStop(0, `rgba(12, 6, 4, ${0.75 * soot})`);
        g.addColorStop(1, 'rgba(12, 6, 4, 0)');
        c.fillStyle = g; c.fillRect(380, -70, 640, 640);
      }
      if (lichen > 0) {
        for (let i = 0; i < 40; i++) {
          const c = { x: 900 + hash(i * 11) * 1400, y: 150 + hash(i * 17) * 680 }, s = (6 + hash(i * 5) * 22) * Math.min(1, lichen * 1.6 - hash(i * 3) * 0.6);
          if (s <= 1) continue;
          p.piece(circlePoly(c, s * 0.7, 10, s), hash(i) < 0.5 ? 'rgba(180, 185, 140, 0.35)' : 'rgba(210, 170, 90, 0.3)', { seed: 480 + i, tear: s * 0.25, shadow: 0, edge: false, texture: 0 });
        }
      }
    });
  });
}

/** The floor ledge with pebbles and the dust of use. */
export function drawFloor(p: Paper, lens: number): void {
  p.sheet({ shadow: 8, texture: 0.4 }, () => {
    p.piece(FLOOR, '#54392d', { seed: 501, tear: 2.5 });
    p.inside(() => {
      p.piece([{ x: 60, y: 940 }, { x: 3200, y: 930 }, { x: 3200, y: 1500 }, { x: 60, y: 1500 }], 'rgba(20, 10, 10, 0.35)', { seed: 502, tear: 5, shadow: 0, edge: false, texture: 0 });
      const r = rng(55);
      for (let i = 0; i < 60; i++) {
        const c = { x: 120 + r() * 2400, y: 906 + r() * 60 }, s = 3 + r() * 7;
        p.piece(circlePoly(c, s * 0.55, 8, s), r() < 0.5 ? '#6d4c3b' : '#3d2820', { seed: 510 + i, tear: 0.8, shadow: 0, edge: false });
      }
    });
  });
  void lens;
}

/** The hearth: a ring of stones, charred sticks and ash, glowing with the fire's heat. */
export function drawHearth(p: Paper, heat: number, embers: number): void {
  const at = FIRE;
  p.sheet({ shadow: 6, rim: { color: `rgba(255, 170, 90, ${0.8 * Math.max(heat, embers)})`, width: 2 }, texture: 0.35 }, () => {
    p.blob([{ x: at.x - 80, y: at.y + 8 }, { x: at.x - 50, y: at.y - 4 }, { x: at.x + 50, y: at.y - 4 }, { x: at.x + 80, y: at.y + 8 }, { x: at.x, y: at.y + 14 }], '#2a1d1a', { seed: 520, tear: 1.5 });
    for (let i = 0; i < 9; i++) {
      const x = at.x - 84 + i * 21, s = 10 + hash(i * 9) * 7;
      p.blob(circlePoly({ x, y: at.y + 4 - s * 0.35 }, s * 0.6, 7, s), i % 2 ? '#6a5a55' : '#574845', { seed: 530 + i, tear: 1.2 });
    }
    p.tube([{ x: at.x - 60, y: at.y + 2 }, { x: at.x + 34, y: at.y - 16 }], 12, 10, '#3b2618', { seed: 541, tear: 1 });
    p.tube([{ x: at.x + 58, y: at.y + 2 }, { x: at.x - 28, y: at.y - 18 }], 11, 9, '#46301f', { seed: 542, tear: 1 });
    p.inside(() => {
      p.blob([{ x: at.x - 40, y: at.y + 2 }, { x: at.x, y: at.y - 12 }, { x: at.x + 40, y: at.y + 2 }, { x: at.x, y: at.y + 8 }], `rgba(255, 110, 40, ${0.6 * Math.max(heat * 0.6, embers)})`, { seed: 543, tear: 2, shadow: 0, edge: false, texture: 0 });
      p.line([{ x: at.x - 20, y: at.y - 10 }, { x: at.x + 18, y: at.y - 13 }], `rgba(255, 190, 90, ${0.8 * Math.max(heat, embers)})`, 2.5);
    });
  });
}

/** Dark, soft shapes close to the lens: a boulder and dry grass in the corners. */
export function drawForeground(p: Paper, v: View): void {
  const c = { x: v.from + 120, y: v.bottom - 20 };
  p.blob([{ x: c.x - 300, y: c.y + 200 }, { x: c.x - 220, y: c.y - 90 }, { x: c.x - 40, y: c.y - 150 }, { x: c.x + 160, y: c.y - 70 }, { x: c.x + 260, y: c.y + 200 }], '#07080d', { seed: 601, tear: 3, shadow: 0 });
  for (let i = 0; i < 14; i++) {
    const x = v.to - 380 + i * 26, h = 60 + hash(i * 5) * 90;
    p.ribbon([{ x, y: v.bottom + 20 }, { x: x + 8, y: v.bottom - h * 0.6 }, { x: x + 20 + hash(i) * 20, y: v.bottom - h }], u => 7 * (1 - u), '#07080d', { seed: 610 + i, tear: 0.5, shadow: 0 });
  }
}
