import { type Paper, type SwimSpec, type V, Swimmer, circlePoly, noise1, rot, steer } from '../../src';

/** Flight uses the same steer-and-flip locomotion as swimming; the "tail beat" drives the wings. */
const FLIGHT: SwimSpec = { maxSpeed: 460, accel: 1100, drag: 2.5, beat: [3.2, 0.006], turn: 0.14, maxPitch: 0.8 };

export interface PigeonLook {
  body: string; belly: string; wing: string; wingBack: string; primaries: string; bar: string;
  neck: string; neckPurple: string; beak: string; cere: string; eye: string; eyeRing: string; rim: string;
}

/** A pigeon: perched and bobbing until startled, then it flaps off toward `exit`. */
export class Pigeon {
  readonly flight: Swimmer;
  private perched = true;
  private exit: V = { x: 0, y: 0 };

  constructor(private readonly perch: V, facing: number, private readonly look: PigeonLook, private readonly scale = 1, private readonly seed = 7) {
    this.flight = new Swimmer(perch, FLIGHT, facing, seed);
  }

  get pos(): V { return this.flight.pos; }

  /** Take off: a hop up and away, then fly to `exit`. */
  startle(exit: V): void {
    if (!this.perched) return;
    this.perched = false;
    this.exit = exit;
    const dir = Math.sign(exit.x - this.perch.x) || 1;
    this.flight.kick({ x: dir * 220, y: -380 });
  }

  update(dt: number): void {
    if (this.perched) return;
    this.flight.steer(steer.arrive(this.flight.pos, this.exit, 440, 10));
    this.flight.update(dt);
  }

  draw(paper: Paper, t: number): void {
    const L = this.look, pose = this.flight.pose;
    const bob = this.perched ? Math.max(0, noise1(t * 2.2, this.seed)) * 5 : 0;
    const F = (p: V) => { const q = rot({ x: p.x * pose.flip * this.scale, y: p.y * this.scale }, pose.angle); return { x: pose.at.x + q.x, y: pose.at.y + q.y }; };
    const at = (pts: V[]) => pts.map(F);
    const lift = this.perched ? -24 : -14;

    // Flap: wings sweep from high over the back to low under the belly.
    const flap = this.perched ? 0.15 : pose.beat * 1.3;
    const wing = (angle: number, len: number) => [{ x: 6, y: lift + 16 }, ...[[-0.2, 1], [0.15, 0.9], [0.45, 0.55]].map(([a, k]) => {
      const d = rot({ x: -len * k, y: 0 }, angle + a);
      return { x: 6 + d.x, y: lift + 16 + d.y };
    })];
    const rim = { color: L.rim, width: 2.5 };
    const y = (v: number) => lift + v;
    if (!this.perched) paper.sheet({ shadow: 3, rim }, () => paper.piece(at(wing(-0.9 + flap, 40)), L.wingBack, { seed: this.seed + 1, tear: 0.8 }));
    if (this.perched) {
      paper.line([F({ x: -2, y: y(24) }), F({ x: -3, y: 0 })], '#c9807a', 2.2 * this.scale);
      paper.line([F({ x: 5, y: y(24) }), F({ x: 6, y: 0 })], '#c9807a', 2.2 * this.scale);
    }

    // One sheet for tail, body, neck and head; belly, iridescent collar, tail band and face are markings inside it.
    const head = { x: 19 + bob, y: y(-2) + bob * 0.3 };
    const shade = { color: 'rgba(20, 18, 40, 0.35)', width: 6 * this.scale };
    paper.sheet({ shadow: 5, rim, shade, anchor: pose.at }, () => {
      paper.blob(at([{ x: -46, y: y(24) }, { x: -30, y: y(10) }, { x: -8, y: y(2) }, { x: 10, y: y(3) }, { x: 19, y: y(14) }, { x: 14, y: y(27) }, { x: -2, y: y(30) }, { x: -20, y: y(27) }, { x: -36, y: y(27) }]), L.body, { seed: this.seed + 3, tear: 0.8 });
      paper.tube(at([{ x: 9, y: y(10) }, head]), 16 * this.scale, 13 * this.scale, L.body, { seed: this.seed + 5, tear: 0.6 });
      paper.piece(at(circlePoly(head, 8.5, 16)), L.body, { seed: this.seed + 6, tear: 0.6 });
      paper.piece(at([{ x: head.x + 6, y: head.y - 1 }, { x: head.x + 14, y: head.y + 2 }, { x: head.x + 6, y: head.y + 4 }]), L.beak, { seed: this.seed + 7, tear: 0.3 });
      paper.inside(() => {
        const flat = (k: number) => ({ seed: this.seed + k, tear: 0.4 });
        paper.blob(at([{ x: -24, y: y(22) }, { x: 0, y: y(16) }, { x: 20, y: y(16) }, { x: 16, y: y(34) }, { x: -20, y: y(34) }]), L.belly, flat(4));
        paper.blob(at([{ x: -60, y: y(14) }, { x: -32, y: y(14) }, { x: -30, y: y(34) }, { x: -60, y: y(34) }]), L.wingBack, flat(2));
        paper.blob(at([{ x: -60, y: y(18) }, { x: -41, y: y(18) }, { x: -40, y: y(34) }, { x: -60, y: y(34) }]), L.bar, flat(11));
        paper.tube(at([{ x: 5, y: y(1) }, { x: 17, y: y(13) }]), 10 * this.scale, 10 * this.scale, L.neck, flat(10));
        paper.tube(at([{ x: 3, y: y(6) }, { x: 13, y: y(17) }]), 6 * this.scale, 6 * this.scale, L.neckPurple, flat(12));
        paper.piece(at([{ x: head.x + 6, y: head.y - 1.5 }, { x: head.x + 9, y: head.y - 0.5 }, { x: head.x + 6, y: head.y + 1.5 }]), L.cere, flat(13));
        paper.line(at([{ x: head.x + 7, y: head.y + 1.8 }, { x: head.x + 13, y: head.y + 2.2 }]), 'rgba(60, 40, 30, 0.6)', 0.8 * this.scale);
        const eye = { x: head.x + 2, y: head.y - 2 };
        paper.piece(at(circlePoly(eye, 3.4, 10)), L.eyeRing, flat(14));
        paper.piece(at(circlePoly(eye, 2.5, 10)), L.eye, flat(8));
        paper.piece(at(circlePoly({ x: eye.x + 0.3, y: eye.y }, 1.2, 8)), '#15131c', flat(15));
        paper.piece(at(circlePoly({ x: eye.x + 1, y: eye.y - 1 }, 0.5, 6)), '#ffffff', flat(16));
      });
    });

    // The near wing is its own flap of paper, hinged at the shoulder: two dark bars and darker flight feathers.
    const wingShape = this.perched
      ? [{ x: 10, y: y(6) }, { x: -8, y: y(5) }, { x: -30, y: y(14) }, { x: -20, y: y(21) }, { x: 4, y: y(20) }]
      : wing(-0.9 + flap + 0.25, 44);
    paper.sheet({ shadow: 4, rim, shade: { color: 'rgba(20, 18, 40, 0.3)', width: 4 * this.scale }, anchor: pose.at }, () => {
      paper.blob(at(wingShape), L.wing, { seed: this.seed + 9, tear: 0.8 });
      paper.inside(() => {
        const flat = (k: number) => ({ seed: this.seed + k, tear: 0.4 });
        if (this.perched) {
          paper.blob(at([{ x: -14, y: y(5) }, { x: -34, y: y(14) }, { x: -22, y: y(22) }, { x: -10, y: y(18) }]), L.primaries, flat(20));
          for (const [x0, x1] of [[-2, -8], [-8, -14]] as const) paper.tube(at([{ x: x0, y: y(8) }, { x: x1, y: y(19) }]), 2.6 * this.scale, 2.6 * this.scale, L.bar, flat(21 + x0));
        } else {
          const tip = wingShape.slice(1, 3), root = wingShape[0];
          paper.blob(at([...tip, { x: (tip[1].x + root.x) / 2, y: (tip[1].y + root.y) / 2 }]), L.primaries, flat(20));
        }
      });
    });
  }
}
