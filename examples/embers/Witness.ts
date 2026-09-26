import { Paper, Skeleton, Spring, circlePoly, type V } from '../../src';

/** A seated witness across three eras; a connected rig keeps the recurring gesture recognizable. */
export class Witness {
  readonly rig = new Skeleton([
    { name: 'spine', length: 96, angle: -1.43, spring: { stiffness: 85, damping: 15 } },
    { name: 'neck', parent: 'spine', length: 20, angle: -0.1, spring: { stiffness: 100, damping: 14 } },
    { name: 'head', parent: 'neck', length: 26, angle: 0, spring: { stiffness: 95, damping: 13 } },
    { name: 'upper', parent: 'spine', at: 0.88, length: 65, angle: 1.8, spring: { stiffness: 90, damping: 14 } },
    { name: 'fore', parent: 'upper', length: 66, angle: -0.7, spring: { stiffness: 105, damping: 16 } },
  ], { x: 0, y: 0 });
  private readonly reach = new Spring({ x: 93, y: -28 }, 28, 10);
  readonly intent = { point: 0, tend: 0, look: 0, shelter: 0 };
  constructor(readonly at: V, readonly size: number, readonly facing: number, readonly child = false) {}

  /** Reset the performance targets before each beat. */
  rest(): void { Object.assign(this.intent, { point: 0, tend: 0, look: 0, shelter: 0 }); }

  /** Advance spring bones toward a gaze and a reachable hand target. */
  update(dt: number, t: number): void {
    const i = this.intent;
    this.rig.set('spine', -1.43 + 0.16 * i.tend + 0.016 * Math.sin(t * 1.7));
    this.rig.set('neck', -0.05 - i.look * 0.22);
    this.rig.set('head', -i.look * 0.28);
    this.reach.step({ x: 93 + i.tend * 39 + i.shelter * 27 - i.point * 15, y: -28 - i.shelter * 39 - i.point * 177 }, dt);
    this.rig.reach('upper', 'fore', this.reach.pos, 1);
    this.rig.step(dt);
  }

  /** World-space hand location, for real fuel contact. */
  get hand(): V {
    const p = this.rig.point('fore');
    return { x: this.at.x + p.x * this.size * this.facing, y: this.at.y + p.y * this.size };
  }

  /** Render in an era-specific costume, preserving the underlying pose. */
  draw(p: Paper, era: number, t: number, heat: number, holding = false): void {
    const c = p.context; c.save(); c.translate(this.at.x, this.at.y); c.scale(this.size * this.facing, this.size);
    const skin = this.child ? '#b67e5e' : '#c49a78', lit = '#ffce95';
    const coat = [this.child ? '#8c6651' : '#765c4f', this.child ? '#916f5b' : '#677b7d', this.child ? '#c16c46' : '#576e78'][era];
    const head = this.rig.uprightFrame('head', 12), torso = this.rig.boneFrame('spine');
    const wrist = this.rig.point('fore'), elbow = this.rig.point('upper'), shoulder = this.rig.point('upper', 0);
    const shape = (points: number[][], f: (p:V)=>V) => points.map(([x,y]) => f({x,y}));
    p.sheet({ shadow: 8, texture: 0.4, rim: { color: lit, width: 1.2 + heat * 1.1 }, shade: { color: '#161c3488', width: 5 } }, () => {
      p.tube([{x:0,y:-4},{x:66,y:-16},{x:102,y:46}], 36, 20, era === 0 ? '#594c4c' : '#343e4b', {seed:21,tear:0.8});
      p.blob([{x:83,y:38},{x:113,y:39},{x:128,y:48},{x:125,y:55},{x:85,y:55}], '#3c3840',{seed:22,tear:0.7});
      p.blob(shape([[-12,-31],[30,-30],[91,-23],[106,-2],[88,22],[20,28],[-17,28]],torso),coat,{seed:23,tear:1.1});
      p.tube([this.rig.point('neck',0),this.rig.point('head',0)],19,16,skin,{seed:24,tear:0.6});
      p.blob(shape([[-21,-29],[2,-34],[19,-25],[22,-12],[30,-4],[25,1],[22,17],[9,28],[-13,22],[-24,5]],head),skin,{seed:25,tear:0.5});
      p.inside(()=>{
        p.blob(shape([[-35,-40],[3,-42],[20,-31],[10,-15],[-2,-18],[-8,3],[-24,20]],head),this.child?'#292937':era===0?'#635b59':'#9a9890',{seed:26,tear:0.9});
        p.blob(shape([[-19,-4],[-9,-8],[-5,1],[-10,9],[-20,7]],head),'#97644f',{seed:27,tear:0.4});
        p.line(shape([[-15,-2],[-10,0],[-13,5]],head),'#503e42',1);
        p.blob(shape([[4,4],[19,2],[22,10],[8,13]],head),'#e3a27a',{seed:28,tear:0.2});
        const eye=head({x:13,y:-9});
        if(Math.sin(t*1.1+(this.child?2:0))<0.994){
          p.piece(circlePoly(eye,3.3,16),'#2c2831',{seed:29,tear:0.1});
          p.piece(circlePoly({x:eye.x+0.8,y:eye.y-0.9},1.1,10),'#ffe9be',{seed:30,tear:0});
        }else p.line(shape([[9,-9],[17,-9]],head),'#302b34',1.2);
        p.line(shape([[7,-16],[16,-17]],head),'#544442',1.3);
        p.line(shape([[16,15],[23,13]],head),'#6d4641',1);
        if(era===0){
          for(let k=0;k<7;k++)p.line(shape([[5+k*12,-22],[12+k*10,-12]],torso),'#bc9d7766',1.4);
          p.line(shape([[20,-30],[46,0],[73,20]],torso),'#503f3c',3);
        }else if(era===1){
          p.blob(shape([[7,-40],[30,-40],[41,36],[19,36]],torso),'#b4a080',{seed:31,tear:0.3});
          p.line(shape([[80,-24],[94,0],[84,20]],torso),'#d0b996',2);
        }else{
          for(let k=0;k<5;k++)p.line(shape([[8+k*16,-30],[12+k*16,27]],torso),'#263e4f88',1.2);
          p.line(shape([[12,0],[86,0]],torso),'#d0b699',1.5);
        }
      });
      p.tube([shoulder,elbow,wrist],22,13,coat,{seed:32,tear:0.7});
      p.piece(circlePoly(wrist,8.5,20),skin,{seed:33,tear:0.4});
      if(this.intent.shelter>0.2){
        for(let j=0;j<3;j++)p.tube([{x:wrist.x-4+j*4,y:wrist.y},{x:wrist.x-6+j*4,y:wrist.y-16-j*2}],3.5,2.5,skin,{seed:60+j,tear:0.2});
      }
      if(this.intent.point>0.2){
        const f=this.rig.boneFrame('fore');
        p.tube([wrist,f({x:80,y:-2})],5,3,skin,{seed:34,tear:0.2});
      }
      p.line([shoulder,{x:elbow.x+3,y:elbow.y-4},wrist],'#e7bf8b66',1.3);
    });
    if(holding){
      p.tube([{x:wrist.x-9,y:wrist.y+2},{x:wrist.x+141,y:wrist.y+37}],8,4,'#766052',{seed:39,tear:0.7,shadow:3,rim:{color:'#efaf6c',width:1}});
      p.line([{x:wrist.x+73,y:wrist.y+21},{x:wrist.x+104,y:wrist.y+6}],'#766052',3);
      p.line([{x:wrist.x-5,y:wrist.y-3},{x:wrist.x+3,y:wrist.y+5},{x:wrist.x-2,y:wrist.y+8}],skin,5);
    }
    c.restore();
  }
}
