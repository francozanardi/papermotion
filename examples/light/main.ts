import { Stage, Camera, Beats, Spring, Particles, circlePoly, fillGradient, vignette, grain, wash, ramp, hash, steer, Mixer, instrument, voice, type V } from '../../src';
import { Moth } from './Moth';

type Beat = 'seek' | 'listen' | 'touch' | 'wake' | 'unfold' | 'scatter' | 'rest';
const C = { x: 1050, y: 500 };
const polar = (r: number, a: number, c: V = C): V => ({ x: c.x + Math.cos(a)*r, y: c.y + Math.sin(a)*r });

/** An original paper nocturne: a moth wakes a seed containing a celestial garden. */
export class LightScene extends Stage {
  private readonly cam = new Camera(850, { width: 1920, height: 1080, stiffness: 10, damping: 6.5, handheld: 1.4, ease: 1.2 });
  private readonly moth = new Moth();
  private readonly opening = Array.from({length:24}, () => new Spring({x:0,y:0}, 16, 5));
  private readonly garden = Array.from({length:15}, () => new Spring({x:0,y:0}, 12, 4.5));
  private readonly pulse = new Spring({x:0,y:0}, 35, 5);
  private readonly dust = new Particles({seed:91, gravity:0, drag:0.18});
  private readonly seeds = Array.from({length:56}, (_,i) => ({ pos:{...C}, vel:{x:0,y:0}, angle:hash(i+21)*Math.PI*2, radius:380+hash(i+54)*670, size:3+hash(i+88)*8 }));
  private readonly beats: Beats<Beat>;
  private shot = 'arrival';
  private contactGap = Infinity;
  private released = false;
  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { duration: 27 });
    this.paper.light = {x:-0.5,y:0.8};
    this.paper.edgeColor = 'rgba(255,233,191,0.17)';
    this.beats = new Beats<Beat>('seek', {
      seek: { during:()=>this.go({x:810,y:530},160), next:()=>Math.hypot(this.moth.flight.pos.x-810,this.moth.flight.pos.y-530)<12 && 'listen' },
      listen: { enter:()=>{this.shot='listening';this.cam.cut({x:920,y:505,zoom:1.8});this.cue('question');}, during:()=>this.go({x:824,y:514},75), after:1.7, then:'touch' },
      touch: { during:()=>this.go({x:C.x-91,y:C.y},68), next:()=>this.contactGap<3 && 'wake' },
      wake: { enter:()=>{this.cue('contact');this.pulse.vel.x=4;this.moth.flight.kick({x:-100,y:30});this.dust.emit({x:C.x-58,y:C.y},40,{angle:Math.PI,spread:2.5,speed:[30,190],life:[1,3],size:[1,4]});}, during:()=>this.go({x:820,y:560},90), after:1.5, then:'unfold' },
      unfold: { enter:()=>{this.shot='revelation';this.cue('bloom');}, during:()=>this.go({x:590,y:600},150), after:6, then:'scatter' },
      scatter: { enter:()=>{this.released=true;this.cue('stars');for(const s of this.seeds){s.pos=polar(90,s.angle);s.vel={x:Math.cos(s.angle)*160,y:Math.sin(s.angle)*160};}}, during:()=>this.go({x:660,y:340},100), after:5, then:'rest' },
      rest: { enter:()=>{this.shot='garden';this.cue('answer');}, during:()=>this.go({x:790,y:300},65) },
    });
  }
  private go(to:V,speed:number):void { this.moth.flight.steer(steer.arrive(this.moth.flight.pos,to,speed,65));this.moth.flight.lookAt=C; }
  protected start():void { this.cam.cut({x:850,y:530,zoom:1}); }
  protected update(t:number,dt:number):void {
    if(this.settling) return;
    this.contactGap=Math.hypot(this.moth.flight.pos.x+33-(C.x-58),this.moth.flight.pos.y-C.y);
    this.beats.update(t,dt); this.moth.update(dt); this.pulse.step({x:this.beats.reached('wake')?1:0,y:0},dt);
    const age=this.beats.reached('unfold')?t-this.beats.startOf('unfold')!: -100;
    this.opening.forEach((s,i)=>s.step({x:ramp(age,i*0.065,i*0.065+2.1),y:0},dt));
    this.dust.update(dt);
    const scatterAge=this.beats.reached('scatter')?t-this.beats.startOf('scatter')!: -100;
    this.garden.forEach((s,i)=>s.step({x:ramp(scatterAge,0.5+Math.abs(i-7)*0.25,2+Math.abs(i-7)*0.25),y:0},dt));
    if(this.released) for(const s of this.seeds){
      const goal=polar(s.radius,s.angle); const dx=goal.x-s.pos.x,dy=goal.y-s.pos.y;
      s.vel.x+=(dx*0.8-s.vel.x*1.3)*dt;s.vel.y+=(dy*0.8-s.vel.y*1.3)*dt;
      s.pos.x+=s.vel.x*dt;s.pos.y+=s.vel.y*dt;
    }
  }
  protected lateUpdate(t:number,dt:number):void {
    if(this.settling)return;
    const wide=this.beats.reached('unfold');
    this.cam.frame(wide?{x:1010,y:490,zoom:this.released?0.70:0.88,roll:0.018*Math.sin(t*0.2)}:this.shot==='arrival'?{x:850,y:530,zoom:1.05}:{x:938,y:505,zoom:1.8},dt,t);
  }
  probe():Record<string,unknown>{return {...super.probe(),beat:this.beats.current,shot:this.shot,moth:this.moth.flight.pos,contactGap:this.contactGap,opening:this.opening[23].pos.x,stars:this.released?this.seeds.length:0,beats:this.beats.history};}
  private star(at:V,r:number,seed:number,color='#f5d799'):void {
    this.paper.piece(Array.from({length:8},(_,j)=>polar(j%2?r*0.26:r,j*Math.PI/4,at)),color,{seed,tear:0.25,shadow:0,texture:0.15,edge:false});
  }
  private glow(at:V,r:number,alpha:number):void {
    const c=this.paper.context; c.save();c.globalCompositeOperation='screen';
    const g=c.createRadialGradient(at.x,at.y,0,at.x,at.y,r);g.addColorStop(0,`rgba(255,188,98,${alpha})`);g.addColorStop(0.35,`rgba(222,131,77,${alpha*0.3})`);g.addColorStop(1,'rgba(120,93,124,0)');c.fillStyle=g;c.fillRect(at.x-r,at.y-r,r*2,r*2);c.restore();
  }
  private flower(t:number):void {
    const p=this.paper, o=this.opening[23].pos.x, lit=Math.max(0,this.pulse.pos.x);
    this.glow(C,190+o*510,0.15+lit*0.30);
    // Concentric engraved orbital rings sit behind the hinged paper petals.
    const c=p.context;c.save();c.strokeStyle=`rgba(215,179,121,${0.06+o*0.22})`;c.lineWidth=0.9;
    for(let k=0;k<4;k++) {c.beginPath();c.ellipse(C.x,C.y,175+k*100,175+k*100,0,0,Math.PI*2);c.stroke();}
    for(let i=0;i<96;i++){const a=i*Math.PI/48;c.beginPath();const v=polar(480,a),w=polar(480+(i%4?5:13),a);c.moveTo(v.x,v.y);c.lineTo(w.x,w.y);c.stroke();}c.restore();
    for(let i=0;i<24;i++){
      const u=this.opening[i].pos.x, ring=i<12?0:1, a=i*Math.PI/6+ring*Math.PI/12+u*(ring?0.20:-0.15);
      const length=72+u*(ring?270:380),width=18+u*(ring?42:61);
      const f=(r:number,w:number):V=>({x:C.x+Math.cos(a)*r-Math.sin(a)*w,y:C.y+Math.sin(a)*r+Math.cos(a)*w});
      const color=ring?(i%2?'#e0b77f':'#e9c99c'):(i%2?'#456a7b':'#315164');
      p.blob([f(22,0),f(length*0.38,-width),f(length*0.78,-width*0.64),f(length,0),f(length*0.75,width*0.52),f(length*0.3,width*0.7)],color,{seed:120+i,tear:1,shadow:9,texture:0.36,rim:{color:ring?'#ffedb8':'#86a8ab',width:1.4},shade:{color:'#151a3b77',width:7}});
      p.line([f(35,0),f(length*0.5,-2),f(length-14,0)],ring?'#8d645c99':'#a5bfba66',1.2);
      if(u>0.1)for(let j=1;j<6;j++){
        const r=length*(0.2+j*0.11),w=width*Math.sin((r/length)*Math.PI)*0.75;
        p.line([f(r-15,0),f(r+14,-w)],ring?'#976f5f66':'#9cb3ac55',0.8);
        p.line([f(r-15,0),f(r+14,w*0.75)],ring?'#976f5f66':'#9cb3ac55',0.8);
      }
      if(u>0.5)this.star(f(length-28,0),3+u*2,200+i,ring?'#fff0c7':'#d1c69e');
    }
    p.piece(circlePoly(C,60+lit*6,80),'#b48260',{seed:10,tear:1,shadow:8,rim:{color:'#ffe5aa',width:3},shade:{color:'#493a5488',width:9}});
    p.piece(circlePoly(C,46+lit*4,64),lit>0.5?'#f3d69a':'#303950',{seed:11,tear:0.7,shadow:0,texture:0.4});
    // The seed's crescent becomes a miniature sun at contact.
    if(lit<0.5){p.blob([{x:1045,y:464},{x:1029,y:494},{x:1040,y:527},{x:1063,y:539},{x:1032,y:526},{x:1019,y:496}], '#c6a67a',{seed:12,tear:0.6,shadow:0});}
    else {this.star(C,31,13,'#fff4d3');for(let j=0;j<12;j++)this.star(polar(55,j*Math.PI/6),2,20+j);}
    if(this.released){
      for(let i=0;i<18;i++){const a=this.seeds[i],b=this.seeds[(i+5)%18];if(Math.hypot(a.pos.x-b.pos.x,a.pos.y-b.pos.y)<430)p.line([a.pos,b.pos],'rgba(216,191,136,0.20)',0.8);}
    }
    if(this.released)for(let i=0;i<this.seeds.length;i++){
      const s=this.seeds[i]; this.star(s.pos,s.size*(0.85+0.15*Math.sin(t*2+i)),700+i,i%3?'#f4d39a':'#9fcac9');
      if(i%8===0)this.glow(s.pos,35,0.24);
    }
  }
  protected draw(t:number,frame:number):void {
    const {paper:p,ctx:c,cam}=this;
    fillGradient(c,[[0,'#090f27'],[0.55,'#182c43'],[1,'#314755']]);
    cam.layer(p,0.12,()=>{
      for(let i=0;i<120;i++){
        const x=hash(i*3+8)*2800-400,y=hash(i*3+9)*1300-100;
        const a=0.1+hash(i+55)*0.26;c.fillStyle=`rgba(195,218,214,${a})`;c.fillRect(x,y,1.5,1.5);
      }
    });
    // Tall, nested paper arches frame an abandoned botanical observatory.
    for(const d of [0.25,0.48,0.73])cam.layer(p,d,()=>{
      const radius=760+d*300;
      const arch=Array.from({length:65},(_,i)=>{const a=Math.PI+i*Math.PI/64;return {x:1010+Math.cos(a)*radius,y:860+Math.sin(a)*radius};});
      p.ribbon(arch,()=>18+d*16,d<0.4?'#2a4052':d<0.6?'#263b4e':'#203448',{seed:Math.round(d*100),tear:1,shadow:7,texture:0.4,edge:false});
      for(const side of [-1,1]){
        const x=1010+side*radius;
        p.piece([{x:x-18,y:830},{x:x+18,y:830},{x:x+18,y:1400},{x:x-18,y:1400}], '#263b4b',{seed:80+side,tear:1,edge:false,shadow:5});
      }
    });
    cam.layer(p,0.65,()=>{
      for(let i=0;i<15;i++){
        const x=-300+i*190,y=1060+hash(i+901)*100;
        p.line([{x,y:1300},{x:x+24,y:y-70},{x:x+17,y:y-210}], '#52636b',2);
        const bloom=this.garden[i].pos.x,center={x:x+17,y:y-238};
        if(bloom>0.01){
          for(let k=0;k<7;k++){const a=k*Math.PI*2/7;const tip=polar(18+bloom*(34+hash(i+6)*24),a,center),side=polar(18+bloom*15,a+0.45,center),other=polar(18+bloom*15,a-0.45,center);
            p.blob([center,side,tip,other],i%3?'#bda77d':'#91b9b5',{seed:1200+i*7+k,tear:0.7,shadow:3,texture:0.35,rim:{color:'#e8d8ab',width:1}});
          }
          this.glow(center,95,bloom*0.20);this.star(center,10,1300+i);
        }
        if(bloom<0.15)p.blob([{x:x+17,y:y-210},{x:x-15,y:y-238},{x:x+8,y:y-267},{x:x+32,y:y-242}], '#384e5c',{seed:920+i,shadow:3,tear:0.8});
      }
    });
    cam.layer(p,1,()=>{
      p.line([{x:C.x,y:-450},{x:C.x-2,y:110},{x:C.x,y:C.y-75}], '#a18b6a',1.2);
      this.flower(t);
      this.dust.draw((v,u)=>this.star(v,v.size*(1-u),900,'#ffe0a5'));
      this.moth.draw(p,t);
    });
    vignette(c,[4,8,24],0.48,0.35);grain(c,frame,0.035);
    if(t<3.5){c.save();c.globalAlpha=ramp(t,0.4,1.3)*(1-ramp(t,2.7,3.5));c.font='18px serif';c.textAlign='center';c.fillStyle='#d3b78e';c.fillText('A   P A P E R   N O C T U R N E',960,945);c.restore();}
    if(this.beats.reached('rest')){const a=ramp(t-this.beats.startOf('rest')!,0.8,2.2);c.save();c.globalAlpha=a;c.fillStyle='#f2ddba';c.font='44px Georgia, serif';c.textAlign='center';c.fillText('Where Light Sleeps',960,945);c.restore();}
    wash(c,'#070c1d',1-ramp(t,0,0.8));wash(c,'#070c1d',ramp(t,25.5,27));
  }
  soundtrack(sr:number){
    const mix=new Mixer(this.videoLength,sr).bus('music',{gain:0.65,reverb:0.42}).bus('air',{gain:0.20,reverb:0.6}).bus('foley',{gain:0.6,reverb:0.3});
    mix.add('air',0,voice.noise({duration:27,seed:171,filter:'lowpass',freq:470,attack:2,decay:2,level:0.2},sr));
    for(const [at,notes] of [[0,[50,57,64]],[6,[48,55,62]],[11,[46,53,60,65]],[17,[48,55,62,67]],[22,[50,57,64,69]]] as [number,number[]][]){
      for(const n of notes)mix.add('music',at,instrument.pad(n,5,sr,{cutoff:640,attack:1.6,release:2}),{gain:0.13});
    }
    [74,81,76,69,74,81].forEach((n,i)=>mix.add('music',0.8+i*1.3,instrument.musicBox(n,sr,{decay:0.9}),{gain:0.18,pan:Math.sin(i)*0.4}));
    for(const cue of this.sound.cues){const at=this.videoTime(cue.at);
      if(cue.name==='question'||cue.name==='answer')mix.add('foley',at,instrument.chirp(cue.name==='question'?680:900,cue.name==='question'?1050:660,0.30,sr),{gain:0.10});
      if(cue.name==='contact')mix.add('music',at,instrument.chime(86,sr,{decay:1.4}),{gain:0.42});
      if(cue.name==='bloom'){
        mix.add('foley',at,voice.noise({duration:4,seed:55,filter:'bandpass',freq:1100,attack:1.2,decay:1.5,crackle:0.65},sr),{gain:0.12});
        [50,57,62,65,69,74,77,81,86,89].forEach((n,i)=>mix.add('music',at+i*0.29,instrument.harp(n,sr,{decay:2}),{gain:0.26,pan:(i/9-0.5)*1.1}));
      }
      if(cue.name==='stars')for(let i=0;i<22;i++)mix.add('music',at+i*0.27,instrument.musicBox([74,77,81,86,89,93][i%6],sr,{decay:1}),{gain:0.14,pan:Math.sin(i*2)*0.8});
    }
    return mix.render({master:1,ceiling:-1.5,fadeIn:0.8,fadeOut:1.7,reverb:{room:0.82,damp:0.55,width:0.9}});
  }
}
