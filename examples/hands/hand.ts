import { type V, rot } from '../../src';

/** A hand seen flat (back or palm): the same outline draws a live hand and masks a stencil. */
export interface HandShape {
  /** Wrist to middle fingertip (px). */
  size: number;
  /** 0 fingers together … 1 spread wide. */
  spread: number;
  /** 1: thumb on the -y side of the hand frame; -1 mirrors it (the other hand, or seen from the palm). */
  side: 1 | -1;
  /** Per-finger length factors (pinky…index) for individual hands. */
  lengths?: readonly number[];
  /** 0…1 curls the fingers toward the palm (a hand closing on a star). */
  curl?: number;
}

const FINGERS = [0.38, 0.47, 0.52, 0.47];

/**
 * One closed outline in a frame where the wrist is at (0, 0) and the fingers point along +x:
 * palm, four fingers fanned from the knuckles by `spread`, and a thumb out from the side.
 */
export function handOutline(h: HandShape): V[] {
  const s = h.size, side = h.side, curl = h.curl ?? 0;
  const wrist = 0.19 * s, palmLen = 0.46 * s, knuckle = 0.23 * s, fw = 0.105 * s;
  const out: V[] = [];
  const P = (x: number, y: number) => out.push({ x, y: y * side });
  P(-0.02 * s, wrist);
  P(palmLen * 0.55, knuckle * 1.02);
  // Fingers from the pinky (+y) to the index (−y), each fanned around its knuckle.
  for (let i = 0; i < 4; i++) {
    const by = knuckle * (0.78 - i * 0.52), bx = palmLen + (i === 0 ? -0.04 * s : i === 2 ? 0.02 * s : 0);
    const a = (1.5 - i) * 0.2 * h.spread;
    const L = s * FINGERS[i] * (h.lengths?.[i] ?? 1) * (1 - curl * 0.55);
    const dir = { x: Math.cos(a), y: Math.sin(a) }, nrm = { x: -dir.y, y: dir.x };
    const at = (u: number, w: number) => ({ x: bx + dir.x * u + nrm.x * w, y: by + dir.y * u + nrm.y * w });
    const pts = [at(0, fw * 0.5), at(L - fw * 0.5, fw * 0.46), at(L - fw * 0.1, fw * 0.3), at(L, 0), at(L - fw * 0.1, -fw * 0.3), at(L - fw * 0.5, -fw * 0.46), at(0, -fw * 0.5)];
    for (const p of pts) P(p.x, p.y);
    if (i < 3) P(bx - 0.035 * s, by - knuckle * 0.26);
  }
  // The thumb leaves the palm near the wrist, angled out with the spread.
  const ta = -0.55 - h.spread * 0.55 + curl * 0.5, tl = 0.36 * s, tw = 0.12 * s;
  const base = { x: palmLen * 0.42, y: -knuckle * 1.02 };
  const tdir = rot({ x: 1, y: 0 }, ta), tn = { x: -tdir.y, y: tdir.x };
  const tp = (u: number, w: number) => ({ x: base.x + tdir.x * u + tn.x * w, y: base.y + tdir.y * u + tn.y * w });
  P(palmLen * 0.62, -knuckle * 1.04);
  for (const p of [tp(tl * 0.35, tw * 0.5), tp(tl - tw * 0.4, tw * 0.45), tp(tl, 0), tp(tl - tw * 0.4, -tw * 0.5), tp(tl * 0.2, -tw * 0.6)]) P(p.x, p.y);
  P(0.08 * s, -wrist * 1.05);
  P(-0.02 * s, -wrist);
  return out;
}

/** Map a hand-frame outline to world: wrist position, finger direction (rad), and a uniform scale. */
export function placeHand(outline: V[], wrist: V, angle: number, scale = 1): V[] {
  return outline.map(p => { const q = rot({ x: p.x * scale, y: p.y * scale }, angle); return { x: wrist.x + q.x, y: wrist.y + q.y }; });
}
