import { Stage, Camera, Beats, Fire, Spring, Plate, Surface, scatter, flora, drawProps, circlePoly, fillGradient, vignette, grain, wash, ramp, envelope, hash, noise1, Mixer, instrument, voice, type V } from '../../src';
import { Witness } from './Witness';
import { groundDetails, shelterDetails, voyagerDetails, modernDetails, hearthDetails } from './details';

type Beat = 'shelter' | 'feed' | 'warmth' | 'wonder' | 'voyagers' | 'present' | 'sky';
const HEARTH = { x: 970, y: 922 };
const STARS: V[] = [{x:866,y:292},{x:926,y:239},{x:1018,y:247},{x:1115,y:185},{x:1180,y:95},{x:1268,y:149},{x:1320,y:230}];

/** A wordless meditation on care and curiosity persisting through human generations. */
export class EmbersScene extends Stage {
  private readonly cam = new Camera(960,{width:1920,height:1080,stiffness:8,damping:6,handheld:1.1,ease:1.1});
  private readonly fire = new Fire(HEARTH,{seed:81,width:96,height:195,sparks:15});
  private readonly elder = new Witness({x:1195,y:882},1.12,-1);
  private readonly child = new Witness({x:737,y:912},0.82,1,true);
  private readonly era = new Spring({x:0,y:0},10,6);
  private readonly skyLight = new Spring({x:0,y:0},7,5);
  private readonly beats: Beats<Beat>;
  private fuel: Plate | null = null;
  private contact = Infinity;
  private shot = 'hearth';
  private readonly trees = scatter({ seed: 303, from: -300, to: 2450, spacing: [80, 155], ground: x => 919 + noise1(x * 0.0018, 37) * 150 + noise1(x * 0.008, 38) * 30, avoid: [[610, 1420]], flex: 0.1, makers: [{weight:1,make:flora.pine({height:[45,100],width:[25,49],trunk:'#303b48',leaves:['#293a47','#334752','#3d4e58'],tiers:[4,6]})}] });
  private readonly scrub = scatter({ seed: 305, from: 80, to: 1820, spacing: [83, 142], ground: x => 1030 + noise1(x * 0.008, 71) * 30, avoid: [[620, 1280]], flex: 0.14, makers: [{weight:1,make:flora.tuft({blades:[4,7],height:[15,34],width:2,colors:['#777168','#5f6663','#6f6861']})}] });
  private readonly glowDots = Array.from({length:250},(_,i)=>({x:hash(i*7+40)*3000-550,y:hash(i*7+41)*1100-500,r:0.7+hash(i*7+42)*1.5}));

  constructor(canvas:HTMLCanvasElement){
    super(canvas,{duration:30});
    this.paper.edgeColor='rgba(240,215,180,0.14)';
    this.world.ground=()=>952;
    this.world.surfaces.push(new Surface([{x:900,y:925},{x:1040,y:930}]));
    this.beats=new Beats<Beat>('shelter',{
      shelter:{during:({since})=>{this.elder.intent.shelter=ramp(since,0.5,1.8);},after:2.8,then:'feed'},
      feed:{enter:()=>{this.shot='care';this.cam.cut({x:978,y:790,zoom:1.5});},during:()=>{this.elder.intent.shelter=1;this.child.intent.tend=1;},next:()=>this.contact<17&&'warmth',after:4.5,then:'warmth'},
      warmth:{enter:()=>{const h=this.child.hand;this.fuel=new Plate(this.world,[{x:0,y:0},{x:7+141*this.child.size,y:37*this.child.size-2}],{x:h.x-7,y:h.y+2},0,{mass:1,drag:0.02,friction:0.8});this.cue('fuel');},during:({since})=>{this.elder.intent.shelter=1-ramp(since,0.2,1.2);this.child.intent.tend=1-ramp(since,0.3,1.5);},after:1.8,then:'wonder'},
      wonder:{enter:()=>{this.shot='stars';this.cue('look');this.cam.cut({x:978,y:550,zoom:1.04});},during:({since})=>{this.elder.intent.point=ramp(since,0,1.3);this.elder.intent.look=1;this.child.intent.look=ramp(since,0.8,2);},after:4.4,then:'voyagers'},
      voyagers:{enter:()=>this.cue('era'),during:()=>this.look(),after:5.6,then:'present'},
      present:{enter:()=>this.cue('era'),during:()=>this.look(),after:5.4,then:'sky'},
      sky:{enter:()=>{this.shot='inheritance';this.cue('sky');},during:()=>this.look()},
    });
  }
  private look():void {
    const since=this.beats.reached('present')?this.time-this.beats.startOf('present')!:0;
    this.child.intent.point=ramp(since,0.8,2.3);
    this.elder.intent.point=1-ramp(since,2.4,4.0);
    this.elder.intent.look=1;this.child.intent.look=1;
  }
  protected start():void{this.cam.cut({x:960,y:838,zoom:2.05});}
  protected update(t:number,dt:number):void{
    this.elder.rest();this.child.rest();
    if(!this.settling)this.beats.update(t,dt);
    this.elder.update(dt,t);this.child.update(dt,t);
    const h=this.child.hand;
    this.contact=Math.hypot(h.x+141*this.child.size-HEARTH.x,h.y+37*this.child.size-(HEARTH.y-8));
    const fed=this.beats.reached('warmth'),wind=0.25+1.2*envelope(t,0.8,1.8,3.3,5.6);
    this.fire.update(dt,t,fed?1.12:0.58-0.40*envelope(t,0.8,2,3.4,5),wind*(fed?0.22:1));
    this.era.step({x:this.beats.reached('present')?2:this.beats.reached('voyagers')?1:0,y:0},dt);
    this.skyLight.step({x:this.beats.reached('wonder')?1:0,y:0},dt);
    this.level('heat',this.fire.heat);
  }
  protected lateUpdate(t:number,dt:number):void{
    if(this.settling)return;
    const sky=this.beats.reached('sky');
    if(this.shot==='hearth')this.cam.frame({x:960,y:825,zoom:2.05},dt,t);
    else if(this.shot==='care')this.cam.frame({x:978,y:790,zoom:1.5},dt,t);
    else this.cam.frame({x:978,y:sky?320:550,zoom:sky?0.82:1.04},dt,t);
  }
  probe():Record<string,unknown>{return{...super.probe(),beat:this.beats.current,shot:this.shot,era:this.era.pos.x,contact:this.contact,fuel:this.fuel?.pts.map(p=>({x:p.x,y:p.y})),heat:this.fire.heat,embers:this.fire.embers.list.length,hand:this.child.hand,beats:this.beats.history};}
  private star(at:V,r:number,alpha:number):void{
    const c=this.paper.context;c.save();c.globalAlpha=alpha;c.fillStyle='#e4e8e6';c.beginPath();c.arc(at.x,at.y,r,0,Math.PI*2);c.fill();
    if(r>2){c.strokeStyle='#d9e4ed77';c.lineWidth=0.8;c.beginPath();c.moveTo(at.x-r*3,at.y);c.lineTo(at.x+r*3,at.y);c.moveTo(at.x,at.y-r*3);c.lineTo(at.x,at.y+r*3);c.stroke();}c.restore();
  }
  private mountains(depth:number,base:number,color:string,seed:number):void{
    this.cam.layer(this.paper,depth,view=>{
      const points:V[]=[];for(let x=Math.floor((view.from-100)/80)*80;x<view.to+160;x+=80)points.push({x,y:base+noise1(x*0.0018,seed)*150+noise1(x*0.008,seed+1)*30});
      const region=[...points,{x:points[points.length-1].x,y:1500},{x:points[0].x,y:1500}];
      const p=this.paper;
      p.piece(region,color,{seed,tear:2,shadow:0,texture:0.22,edge:false});
      p.clip(region,()=>{
        for(let i=1;i<points.length-1;i++){
          const a=points[i],prev=points[i-1],next=points[i+1];
          if(a.y>prev.y||a.y>next.y)continue;
          const ridge={x:a.x-15-hash(a.x+seed)*42,y:a.y+78+hash(a.x+seed+2)*60};
          p.piece([a,{x:prev.x,y:prev.y+20},ridge],depth<0.3?'#98a2ad0d':'#9a9aa814',{seed:seed+i,tear:1,shadow:0,edge:false,texture:0.2});
          p.line([a,{x:a.x-12,y:a.y+48},ridge],depth<0.3?'#9facb11a':'#8a9ba02b',1);
        }
        if(depth>0.4)for(let j=0;j<3;j++)p.line(points.map(v=>({x:v.x,y:v.y+90+j*35})), '#71808a15',1.1);
      });
    });
  }
  private ancient():void{
    const p=this.paper;
    // A stone shelter with a hand stencil: a human mark beside the shared fire.
    p.blob([{x:170,y:960},{x:150,y:610},{x:220,y:470},{x:345,y:422},{x:456,y:477},{x:480,y:579},{x:401,y:611},{x:366,y:858},{x:384,y:960}], '#3e3d49',{seed:500,tear:4,shadow:10,rim:{color:'#736157',width:3},shade:{color:'#191e32aa',width:16}});
    p.blob([{x:205,y:824},{x:213,y:572},{x:283,y:504},{x:368,y:480},{x:304,y:576},{x:298,y:850}], '#51474a',{seed:501,tear:3,shadow:0,edge:false});
    shelterDetails(p);
    const hand={x:286,y:627};
    p.piece(circlePoly(hand,17,24,14),'#ae735955',{seed:502,tear:1,shadow:0,edge:false});
    for(let i=0;i<5;i++)p.line([{x:hand.x-13+i*6,y:hand.y-7},{x:hand.x-25+i*11,y:hand.y-28-Math.sin(i*Math.PI/4)*11}],'#ae735977',5);
    p.line([{x:hand.x-8,y:hand.y+5},{x:hand.x-8,y:hand.y+35}],'#ae735955',12);
    p.line([{x:435,y:954},{x:468,y:692}],'#776456',6);
    p.piece([{x:468,y:681},{x:458,y:708},{x:475,y:710}],'#9a9282',{seed:504,tear:0.7,shadow:0});
  }
  private voyagers():void{
    const p=this.paper;
    // A stitched canvas windbreak and a brass sky instrument distinguish the middle passage.
    p.piece([{x:130,y:955},{x:352,y:540},{x:552,y:955}], '#797775',{seed:520,tear:1.5,shadow:8,rim:{color:'#b6a387',width:2},shade:{color:'#202d4088',width:13}});
    p.piece([{x:352,y:540},{x:552,y:955},{x:379,y:913}], '#4b5864',{seed:521,tear:1,shadow:0});
    p.line([{x:352,y:543},{x:379,y:913},{x:133,y:955}],'#c6b28c',2);
    for(let i=0;i<18;i++)p.line([{x:347-i*9,y:557+i*18},{x:356-i*9,y:560+i*18}],'#ada28b',1);
    p.line([{x:350,y:536},{x:593,y:947}],'#a39176',1.4);
    p.piece(circlePoly({x:1326,y:930},36,48),'#aa8759',{seed:522,tear:0.5,shadow:4});
    p.piece(circlePoly({x:1326,y:930},29,40),'#444553',{seed:523,tear:0.4,shadow:0});
    for(let i=0;i<12;i++){const a=i*Math.PI/6;p.line([{x:1326+Math.cos(a)*23,y:930+Math.sin(a)*23},{x:1326+Math.cos(a)*28,y:930+Math.sin(a)*28}],'#c6a779',1);}
    p.line([{x:1303,y:945},{x:1346,y:911}],'#bfa273',2);
    voyagerDetails(p);
  }
  private present():void{
    const p=this.paper;
    p.blob([{x:120,y:955},{x:154,y:770},{x:282,y:688},{x:427,y:720},{x:533,y:955}], '#405765',{seed:540,tear:1.3,shadow:8,rim:{color:'#a1b4b0',width:2},shade:{color:'#11233899',width:10}});
    p.piece([{x:304,y:694},{x:533,y:955},{x:366,y:936}], '#2e4355',{seed:541,tear:1,shadow:0});
    p.line([{x:154,y:951},{x:190,y:793},{x:297,y:706},{x:421,y:747},{x:491,y:950}],'#a5a59a',2);
    p.piece([{x:221,y:953},{x:295,y:765},{x:357,y:953}], '#142435',{seed:542,tear:0.5,shadow:0});
    const pivot={x:1427,y:845};
    p.line([pivot,{x:1365,y:958}],'#7a8487',5);p.line([pivot,{x:1492,y:958}],'#7a8487',5);p.line([pivot,{x:1429,y:970}],'#455662',4);
    p.tube([{x:1396,y:814},{x:1498,y:741}],24,32,'#c0bbaa',{seed:543,tear:0.6,shadow:5,rim:{color:'#ece0b8',width:2},shade:{color:'#34495888',width:5}});
    p.tube([{x:1483,y:752},{x:1505,y:736}],34,34,'#485d6b',{seed:544,tear:0.4,shadow:0});
    p.line([{x:1431,y:835},{x:1450,y:788}],'#9a9e94',6);
    p.blob([{x:1300,y:949},{x:1300,y:905},{x:1326,y:897},{x:1344,y:914},{x:1341,y:952}],'#9b6654',{seed:546,tear:1,shadow:4});
    p.line([{x:1309,y:908},{x:1311,y:948}],'#d4a77c',2);
    modernDetails(p);
  }
  private eraDraw(era:number,alpha:number,t:number):void{
    if(alpha<0.002)return;
    const p=this.paper;
    p.layer(alpha,()=>this.cam.layer(p,1,()=>{
      if(era===0)this.ancient();else if(era===1)this.voyagers();else this.present();
      p.light={x:0.9,y:-0.4};this.elder.draw(p,era,t,this.fire.heat);
      p.light={x:-0.9,y:-0.4};this.child.draw(p,era,t,this.fire.heat,!this.fuel);
    }));
  }
  protected draw(t:number,frame:number):void{
    const p=this.paper,c=this.ctx,e=Math.max(0,Math.min(2,this.era.pos.x));
    fillGradient(c,[[0,'#070f26'],[0.55,'#182640'],[1,'#6a5559']]);
    this.cam.layer(p,0.35,()=>{
      // Irregular translucent paper bands suggest the Milky Way without an image texture.
      for(let j=0;j<5;j++){
        const pts:V[]=[];for(let x=-600;x<2700;x+=85)pts.push({x,y:-250+x*0.19+noise1(x*0.003,j+71)*70+j*23});
        p.ribbon(pts,u=>55+35*Math.sin(u*Math.PI),`rgba(125,141,174,${0.022+this.skyLight.pos.x*0.020})`,{seed:610+j,tear:6,shadow:0,texture:0.6,edge:false});
      }
      for(let i=0;i<3600;i++){
        const x=hash(i*5+130)*3300-700,band=-240+x*0.19,y=band+(hash(i*5+131)+hash(i*5+132)-1)*210;
        this.star({x,y},0.4+hash(i+65)*1.0,0.15+this.skyLight.pos.x*hash(i+44)*0.70);
      }
      this.glowDots.forEach((s,i)=>this.star(s,s.r,0.25+(0.25+0.22*Math.sin(t*0.9+i))*hash(i+500)));
      for(let i=0;i<STARS.length;i++){
        this.star(STARS[i],i===3?3.5:2.5,0.85);
        if(i&&this.skyLight.pos.x>0.02){const g=p.context;g.save();g.globalAlpha=this.skyLight.pos.x*0.22;p.line([STARS[i-1],STARS[i]],'#c7d5e5',0.8);g.restore();}
      }
    });
    this.mountains(0.23,690,'#29374e',13);this.mountains(0.46,765,'#253246',23);
    // The horizon changes; the stars and the little circle of warmth do not.
    if(e>0.005)p.layer(Math.min(1,e),()=>this.cam.layer(p,0.48,()=>{
      for(let j=0;j<55;j++){const x=470+hash(j+870)*1330,y=739+hash(j+871)*58,w=7+hash(j+872)*58;p.line([{x,y},{x:x+w*.5,y:y-0.6},{x:x+w,y}], '#75858d33',0.7);}
      if(e<1.995)p.layer(Math.max(0,1-Math.max(0,e-1)),()=>{
        p.blob([{x:1540,y:738},{x:1620,y:750},{x:1680,y:734}], '#253248',{seed:620,tear:1,shadow:0});
        p.line([{x:1610,y:743},{x:1610,y:640}],'#3c4b60',2);
        p.piece([{x:1606,y:644},{x:1550,y:725},{x:1606,y:719}], '#78828b',{seed:621,tear:0.8,shadow:0});
      });
      if(e>1.002)p.layer(e-1,()=>{const g=p.context;
        for(let i=0;i<29;i++){const x=1470+i*17,h=20+hash(i+810)*57;p.piece([{x,y:765},{x,y:765-h},{x:x+12,y:765-h},{x:x+12,y:765}], '#364255',{seed:650+i,tear:0.3,shadow:0,edge:false});
          for(let k=0;k<Math.floor((h-8)/15);k++){g.fillStyle='#bba679';g.fillRect(x+4,758-k*15,2,3);}}
        });
    }));
    this.mountains(0.78,919,'#283143',37);
    this.cam.layer(p,0.78,v=>{const edge=p.edgeColor;p.edgeColor='rgba(171,189,184,0.035)';drawProps(p,this.trees,v.from,v.to,()=>2,t);p.edgeColor=edge;});
    this.cam.layer(p,1,()=>{
      p.blob([{x:-500,y:1040},{x:250,y:985},{x:650,y:960},{x:1030,y:976},{x:1490,y:964},{x:2450,y:1055},{x:2500,y:1600},{x:-500,y:1600}], '#292d3a',{seed:700,tear:2,shadow:0,texture:0.4,edge:false});
      p.blob([{x:642,y:980},{x:767,y:927},{x:959,y:910},{x:1145,y:933},{x:1270,y:980},{x:958,y:1010}], '#6c4b4244',{seed:701,tear:4,shadow:0,edge:false});
      for(const [x,y,w] of [[1193,955,70],[742,965,45]])p.blob([{x:x-w,y},{x:x-w+14,y:y-57},{x:x+27,y:y-68},{x:x+w,y:y-20},{x:x+w,y:y+10}], '#45414a',{seed:x,tear:2,shadow:7,rim:{color:'#856455',width:2}});
      for(let i=0;i<18;i++){const x=410+hash(i+781)*1180,y=988+hash(i+791)*90;p.line([{x,y},{x:x-4,y:y-12},{x:x-8,y:y-18}],'#71615b',1.1);}
      groundDetails(p);
      drawProps(p,this.scrub,0,1920,()=>8,t);
      this.fire.glow(p,440);
    });
    this.eraDraw(0,1-Math.min(1,e),t);this.eraDraw(1,1-Math.abs(e-1),t);this.eraDraw(2,Math.max(0,e-1),t);
    this.cam.layer(p,1,()=>{
      p.light={x:0,y:-1};
      for(let i=0;i<7;i++){const x=HEARTH.x-83+i*27,y=HEARTH.y+20+Math.sin(i)*10;p.blob([{x:x-18,y},{x:x-20,y:y-13},{x,y:y-23},{x:x+20,y:y-12},{x:x+16,y:y+3}],i%2?'#67606a':'#514e59',{seed:730+i,tear:1,shadow:4,rim:{color:'#c08861',width:1.8}});}
      p.tube([{x:911,y:927},{x:1019,y:900}],20,16,'#65473d',{seed:744,tear:1.3,shadow:5});
      p.tube([{x:930,y:901},{x:1035,y:935}],17,22,'#62493e',{seed:745,tear:1.3,shadow:5});
      for(let i=0;i<6;i++)p.line([{x:926+i*17,y:918},{x:933+i*17,y:923}],'#eaa065',1.4);
      hearthDetails(p,this.fire.heat);
      if(this.fuel)p.tube(this.fuel.pts,6.6,3.3,'#766052',{seed:39,tear:0.6,shadow:2,rim:{color:'#efaf6c',width:1}});
      this.fire.draw(p);
    });
    vignette(c,[4,8,20],0.4,0.38);grain(c,frame,0.035);
    wash(c,'#050b1b',1-ramp(t,0,0.8));wash(c,'#050b1b',ramp(t,28.5,30));
  }
  soundtrack(sr:number){
    const m=new Mixer(this.videoLength,sr).bus('score',{gain:0.65,reverb:0.5}).bus('fire',{gain:0.55,reverb:0.08}).bus('air',{gain:0.15,reverb:0.55});
    const heat=this.sound.track('heat');
    m.add('fire',0,voice.noise({duration:30,seed:42,filter:'bandpass',freq:1500,q:0.65,crackle:0.93,level:t=>0.075+heat(t)*0.13},sr));
    m.add('fire',0,voice.noise({duration:30,seed:43,filter:'lowpass',freq:210,level:t=>heat(t)*0.20},sr));
    m.add('air',0,voice.noise({duration:30,seed:44,filter:'lowpass',freq:650,level:t=>0.11+envelope(t,0.8,2,3.4,6)*0.3},sr));
    for(let i=0;i<65;i++){const at=0.2+i*0.45+hash(i+99)*0.2;m.add('fire',at,voice.noise({duration:0.055,seed:i+812,filter:'highpass',freq:1800,decay:0.009,crackle:0.9},sr),{gain:0.015+heat(at)*0.045,pan:hash(i+813)*0.35-0.175});}
    const chords=[[50,57,62],[46,53,60],[48,55,62],[50,57,64],[43,50,57]];
    chords.forEach((notes,i)=>notes.forEach(n=>m.add('score',i*6,instrument.pad(n,6,sr,{cutoff:480,attack:1.8,release:2}),{gain:0.13})));
    [62,69,65,62,60,57].forEach((n,i)=>m.add('score',1.4+i*1.2,instrument.harp(n,sr,{decay:1.6,brightness:0.25}),{gain:0.18,pan:-0.25}));
    for(const cue of this.sound.cues){const at=this.videoTime(cue.at);
      if(cue.name==='fuel'){m.add('fire',at,voice.thump({duration:0.3,seed:88,from:180,to:75,sweep:0.03,decay:0.07,click:0.22},sr),{gain:0.17});m.add('fire',at+0.2,voice.noise({duration:1,seed:89,filter:'bandpass',freq:900,attack:0.1,decay:0.3,crackle:0.7},sr),{gain:0.12});}
      if(cue.name==='look'||cue.name==='era'||cue.name==='sky'){
        [74,81,77,74,72,69].forEach((n,i)=>m.add('score',at+i*0.64,instrument.musicBox(n,sr,{decay:1.4}),{gain:cue.name==='sky'?0.20:0.13,pan:(i-2.5)*0.13}));
      }
      if(cue.name==='sky')for(const n of [62,69,76,81])m.add('score',at,instrument.pad(n,6,sr,{cutoff:1100,attack:2,release:2}),{gain:0.09});
    }
    return m.render({master:2,ceiling:-1.5,fadeIn:0.8,fadeOut:1.6,reverb:{room:0.8,damp:0.6,width:0.9}});
  }
}
