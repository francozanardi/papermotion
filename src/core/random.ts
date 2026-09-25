/** Integer hash to [0, 1): stateless randomness for things that must not depend on history (rain drops). */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i * 374761 + seed * 668265);
  const b = hash((i + 1) * 374761 + seed * 668265);
  return (a + (b - a) * u) * 2 - 1;
}

export function fbm1(x: number, seed = 0, octaves = 3): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise1(x * freq, seed + o * 17) * amp;
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

/** Seeded PRNG (mulberry32). Every random choice in a scene should come from one of these. */
export function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A [min, max] range for procedural parameters. */
export type Range = [number, number];

/** A value inside `range`, drawn from `r`. */
export const within = (r: () => number, [a, b]: Range): number => a + r() * (b - a);

/** One element of `xs`, drawn from `r`. */
export const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
