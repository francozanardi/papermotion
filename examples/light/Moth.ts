import { Paper, Skeleton, Swimmer, circlePoly, type V } from '../../src';

/** A copper-and-ivory moth; spring bones articulate the independent paper wings. */
export class Moth {
  readonly flight = new Swimmer({ x: 390, y: 640 }, { maxSpeed: 240, accel: 300, drag: 3, beat: [2.4, 0.006], turn: 0.6, maxPitch: 0.4 }, 1, 7);
  private readonly rig = new Skeleton([
    { name: 'body', length: 32, angle: 0 },
    { name: 'far', parent: 'body', at: 0.4, length: 75, angle: -1.9, spring: { stiffness: 180, damping: 9 } },
    { name: 'near', parent: 'body', at: 0.4, length: 88, angle: -2, spring: { stiffness: 160, damping: 8 } },
    { name: 'feel', parent: 'body', length: 27, angle: -0.9, spring: { stiffness: 90, damping: 9 } },
  ], { x: 0, y: 0 });
  /** Advance locomotion and wing intents. */
  update(dt: number): void {
    this.flight.update(dt);
    const p = this.flight.pose;
    this.rig.set('far', -1.7 + p.beat * 0.8);
    this.rig.set('near', -2.1 + p.beat * 1.0);
    this.rig.set('feel', -0.75 - p.bend * 0.5);
    this.rig.step(dt);
  }
  /** Render cohesive body and separately hinged patterned wings. */
  draw(p: Paper, t: number): void {
    const pose = this.flight.pose, c = p.context;
    c.save(); c.translate(pose.at.x, pose.at.y); c.rotate(pose.angle); c.scale(pose.flip, 1);
    const wing = (name: string, far: boolean) => {
      const f = this.rig.boneFrame(name), m = (x: number, y: number): V => f({ x, y });
      p.sheet({ shadow: 5, texture: 0.35, rim: { color: '#fff0cd', width: 1.1 }, shade: { color: '#794e5477', width: 4 } }, () => {
        p.blob([[0,0],[22,-26],[76,-31],[98,-11],[82,20],[48,37],[12,17]].map(([x,y]) => m(x,y)), far ? '#b18780' : '#f1dfb6', { seed: far ? 400 : 401, tear: 0.6 });
        p.inside(() => {
          p.blob([[47,-40],[77,-38],[95,-8],[69,35],[52,31],[72,-5]].map(([x,y]) => m(x,y)), far ? '#795d75' : '#b36d58', { seed: 404, tear: 0.4 });
          p.piece(circlePoly(m(56,3), 12, 24), '#40364e', { seed: 405, tear: 0.25 });
          p.piece(circlePoly(m(57,3), 7, 24), '#d7b77b', { seed: 406, tear: 0.2 });
          p.piece(circlePoly(m(59,1), 3, 12), '#fff6d6', { seed: 407, tear: 0.1 });
          for (let k = 0; k < 5; k++) p.line([m(4,0),m(37,-15+k*9),m(83,-20+k*10)], '#715a6355', 0.8);
        });
      });
    };
    wing('far', true);
    p.sheet({ shadow: 4, rim: { color: '#fff3ce', width: 1 }, shade: { color: '#51374b88', width: 3 } }, () => {
      p.blob([{x:-24,y:0},{x:-8,y:-12},{x:22,y:-10},{x:37,y:-4},{x:31,y:8},{x:1,y:11}], '#d4a472', {seed:410,tear:0.6});
      p.inside(() => {
        for(let i=0;i<5;i++) p.line([{x:-19+i*8,y:-11},{x:-22+i*8,y:13}], '#73516a88', 2);
        p.piece(circlePoly({x:28,y:-5},5,18), '#252840', {seed:411,tear:0.1});
        if (Math.sin(t*2.7) < 0.985) p.piece(circlePoly({x:29,y:-7},1.6,12), '#fff8de', {seed:412,tear:0});
      });
      const a = this.rig.point('feel',1);
      p.line([{x:30,y:-8},a,{x:a.x+9,y:a.y-5}], '#ecd4a7', 1.6);
      p.line([{x:25,y:-9},{x:a.x-5,y:a.y-4},{x:a.x-3,y:a.y-13}], '#ecd4a7', 1.2);
    });
    wing('near',false);
    c.restore();
  }
}
