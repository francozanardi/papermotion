import { type Paper, type SwimPose, type V, circlePoly, rot } from '../../src';

/** Everything that makes one fish look different from another. Pure data. */
export interface FishLook {
  length: number;
  height: number;
  body: string;
  belly: string;
  fin: string;
  rim: string;
  /** Band positions along the body (0 = nose, 1 = tail) and color. */
  stripes?: { at: number[]; color: string };
  /** Dorsal and pectoral fins, eye with a pupil (heroes); small fish skip them. */
  detail: boolean;
}

/** Fish width along the body, u = 0 at the nose: round head, belly, thin tail stalk. */
const profile = (h: number) => (u: number) => (u < 0.28 ? h * (0.5 + 0.5 * Math.sin((u / 0.28) * Math.PI / 2)) : h * (1 - 0.74 * ((u - 0.28) / 0.72) ** 1.3));

/**
 * Paper fish skin driven by a `SwimPose`: body along a bent spine, tail fin foreshortening with the
 * beat (the side-view read of a lateral stroke), fins, and an eye that looks at things.
 */
export function drawFish(paper: Paper, pose: SwimPose, look: FishLook, seed: number, scale = 1, lookAt: V | null = null, t = 0): void {
  const L = look.length * scale, H = look.height * scale;
  const toWorld = (p: V): V => {
    const q = rot({ x: p.x * pose.flip, y: p.y }, pose.angle);
    return { x: pose.at.x + q.x, y: pose.at.y + q.y };
  };
  const spineAt = (u: number): V => ({ x: L / 2 - u * L, y: pose.bend * L * (u - 0.3) ** 2 * 0.6 + pose.beat * H * 0.12 * u * u });
  const spine = Array.from({ length: 7 }, (_, i) => spineAt(i / 6));
  const w = profile(H);
  const edge = (u: number, side: number): V => { const p = spineAt(u); return { x: p.x, y: p.y + side * w(u) / 2 }; };

  const tail = spineAt(1), fin = 1 - 0.55 * Math.abs(pose.beat), tl = H * 0.75 * fin, tilt = pose.beat * 0.25;
  const tailFin = [{ x: 0, y: -H * 0.1 }, { x: -tl, y: -H * 0.55 }, { x: -tl * 0.62, y: 0 }, { x: -tl, y: H * 0.55 }, { x: 0, y: H * 0.1 }]
    .map(p => { const q = rot(p, tilt); return toWorld({ x: tail.x + q.x + H * 0.05, y: tail.y + q.y }); });
  const pieces = { tear: Math.max(0.5, H * 0.03), shadow: Math.max(2, H * 0.12) };
  paper.piece(tailFin, look.fin, { seed: seed + 1, ...pieces });

  if (look.detail) {
    const lag = -pose.bend * H * 0.4;
    const dorsal = [edge(0.22, -1), { x: spineAt(0.42).x - H * 0.1, y: spineAt(0.42).y - H * 0.95 + lag }, { x: spineAt(0.62).x - H * 0.25, y: spineAt(0.62).y - H * 0.55 + lag }, edge(0.68, -1)];
    paper.piece(dorsal.map(toWorld), look.fin, { seed: seed + 2, ...pieces });
  }

  paper.ribbon(spine.map(toWorld), w, look.body, { seed: seed + 3, ...pieces, rim: { color: look.rim, width: Math.max(2, H * 0.07) } });
  const belly = spine.map(p => toWorld({ x: p.x, y: p.y + H * 0.2 }));
  paper.ribbon(belly, u => w(u) * 0.5, look.belly, { seed: seed + 4, tear: pieces.tear, shadow: 0, edge: false });
  look.stripes?.at.forEach((u, i) => {
    const band = [edge(u, -0.94), spineAt(u), edge(u, 0.94)].map(toWorld);
    paper.tube(band, H * 0.16, H * 0.16, look.stripes!.color, { seed: seed + 10 + i, tear: pieces.tear, shadow: 0, edge: false });
  });

  if (look.detail) {
    const root = spineAt(0.34), flap = Math.sin(t * 9 + seed) * 0.35 + pose.beat * 0.2;
    const pec = [{ x: 0, y: 0 }, { x: -H * 0.5, y: -H * 0.12 }, { x: -H * 0.62, y: H * 0.14 }, { x: -H * 0.2, y: H * 0.2 }]
      .map(p => { const q = rot(p, 0.35 + flap); return toWorld({ x: root.x + q.x, y: root.y + H * 0.12 + q.y }); });
    paper.piece(pec, look.fin, { seed: seed + 5, tear: pieces.tear, shadow: 3, edge: false });
  }

  const eye = toWorld({ x: spineAt(0.13).x, y: spineAt(0.13).y - H * 0.12 });
  const er = H * (look.detail ? 0.15 : 0.12);
  if (look.detail) paper.piece(circlePoly(eye, er, 16, er * Math.max(0.2, Math.abs(pose.flip))), '#fbf6ea', { seed: seed + 6, tear: 0.4, shadow: 0, edge: false, texture: 0 });
  let pupil = eye;
  if (lookAt && look.detail) {
    const dx = lookAt.x - eye.x, dy = lookAt.y - eye.y, d = Math.hypot(dx, dy) || 1;
    pupil = { x: eye.x + (dx / d) * er * 0.4, y: eye.y + (dy / d) * er * 0.4 };
  } else if (look.detail) pupil = toWorld({ x: spineAt(0.13).x + er * 0.35, y: spineAt(0.13).y - H * 0.12 });
  const pr = look.detail ? er * 0.55 : er;
  paper.piece(circlePoly(pupil, pr, 12, pr * Math.max(0.2, Math.abs(pose.flip))), '#141b26', { seed: seed + 7, tear: 0.2, shadow: 0, edge: false, texture: 0 });
  if (look.detail) {
    paper.line([toWorld({ x: L / 2 - H * 0.08, y: H * 0.1 }), toWorld({ x: L / 2 - H * 0.26, y: H * 0.14 })], '#5a2413', Math.max(1.5, H * 0.04));
  }
}
