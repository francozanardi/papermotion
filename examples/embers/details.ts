import { circlePoly, hash, type Paper, type V } from '../../src';

/** Stone grain, worn paths and small debris around this particular hearth. */
export function groundDetails(p: Paper): void {
  for (let i = 0; i < 85; i++) {
    const x = 370 + hash(i * 9 + 51) * 1320, y = 976 + hash(i * 9 + 52) * 173;
    const w = 2 + hash(i * 9 + 53) * 8;
    p.blob([{ x: x - w, y }, { x: x - w * 0.4, y: y - w * 0.5 }, { x: x + w, y: y - w * 0.2 }, { x: x + w * 0.5, y: y + w * 0.25 }], i % 3 ? '#53505b' : '#76655d', { seed: 1500 + i, tear: 0.3, shadow: 0, edge: false, texture: 0.2 });
  }
  for (let i = 0; i < 11; i++) {
    const x = 544 + i * 31, y = 1045 + Math.sin(i * 0.8) * 21 + i * 3;
    p.blob(circlePoly({ x, y }, 2.8, 12, 8), '#181e2b66', { seed: 1600 + i, tear: 0.6, shadow: 0, edge: false });
  }
  for (const [x, y, w] of [[1193, 955, 70], [742, 965, 45]]) {
    p.piece([{ x: x - w + 14, y: y - 57 }, { x: x + 27, y: y - 68 }, { x: x + 15, y: y - 40 }, { x: x - w + 7, y: y - 26 }], '#74615a55', { seed: x + 4, tear: 0.8, shadow: 0, edge: false });
    p.line([{ x: x + 15, y: y - 40 }, { x: x + 29, y: y - 23 }, { x: x + 24, y: y - 4 }], '#292d3c', 1.2);
    p.line([{ x: x - w + 5, y: y - 20 }, { x: x - 12, y: y - 23 }, { x: x + 6, y: y - 15 }], '#8f75634d', 1.1);
  }
  // Contact shadows keep the small props and people on the same piece of ground.
  for (const [x, y, rx, ry] of [[954, 952, 135, 14], [737, 977, 65, 8], [1195, 969, 89, 9]])
    p.piece(circlePoly({ x, y }, ry, 28, rx), '#101b2d44', { seed: x + 30, tear: 1, shadow: 0, edge: false });
}

/** Weathered strata and pigment residue on the stone shelter. */
export function shelterDetails(p: Paper): void {
  const rock = [{x:170,y:960},{x:150,y:610},{x:220,y:470},{x:345,y:422},{x:456,y:477},{x:480,y:579},{x:401,y:611},{x:366,y:858},{x:384,y:960}];
  p.clip(rock, () => {
    p.piece([{x:150,y:744},{x:223,y:674},{x:230,y:847},{x:205,y:955},{x:152,y:969}], '#292f3c99', {seed:1610,tear:2,shadow:0,edge:false});
    p.piece([{x:251,y:476},{x:345,y:435},{x:442,y:482},{x:394,y:493},{x:304,y:475}], '#86716955',{seed:1611,tear:2,shadow:0,edge:false});
    for (let j = 0; j < 9; j++) {
      const y = 490 + j * 49;
      p.line([{x:165,y:y+32},{x:254,y:y+7},{x:337,y:y+18},{x:462,y:y-9}],j%2?'#1f273a66':'#a3846960',1+j%2);
    }
    p.line([{x:398,y:462},{x:376,y:514},{x:390,y:548},{x:355,y:596},{x:363,y:642}], '#242b3aaa',2);
    p.line([{x:245,y:701},{x:227,y:746},{x:246,y:789},{x:231,y:837}], '#222c3b',1.6);
    for (let i=0;i<32;i++) {
      const x=183+hash(i+1800)*182,y=494+hash(i+1850)*420;
      p.line([{x,y},{x:x+2+hash(i+1801)*8,y:y-2}], '#b0947233',1);
    }
  });
  // A shallow clay bowl and two worked stones are quiet signs of daily life.
  p.blob([{x:495,y:947},{x:511,y:969},{x:542,y:966},{x:551,y:944}], '#755442',{seed:1620,tear:1,shadow:4,rim:{color:'#b58a64',width:1.2}});
  p.piece(circlePoly({x:523,y:945},5,28,29),'#322e34',{seed:1621,tear:0.5,shadow:0});
  p.line([{x:498,y:943},{x:523,y:941},{x:548,y:944}], '#a98362',1);
  p.piece([{x:560,y:972},{x:574,y:959},{x:589,y:972}], '#929087',{seed:1622,tear:0.7,shadow:3});
}

/** Canvas folds, pegged guy lines and a coil of rope at the seafarer's camp. */
export function voyagerDetails(p: Paper): void {
  const tent=[{x:130,y:955},{x:352,y:540},{x:552,y:955}];
  p.clip(tent,()=>{
    p.piece([{x:350,y:550},{x:204,y:953},{x:260,y:953}], '#afa68c22',{seed:1650,tear:0.5,shadow:0,edge:false});
    p.piece([{x:351,y:548},{x:324,y:938},{x:378,y:914}], '#343d4c55',{seed:1651,tear:0.5,shadow:0,edge:false});
    for(let j=0;j<8;j++)p.line([{x:351,y:548},{x:149+j*29,y:953}], '#ded0a525',0.8);
    p.line([{x:164,y:924},{x:327,y:884},{x:398,y:911}], '#beb29477',1.2);
    for(let j=0;j<14;j++)p.line([{x:166+j*13,y:932-j*2.8},{x:172+j*13,y:930-j*2.8}], '#dfc8a277',1);
  });
  for(const [x,y] of [[133,955],[593,947]]) {
    p.line([{x:x-5,y:y+7},{x:x+5,y:y-10}], '#b4a590',4);
    p.line([{x:x-5,y:y-1},{x:x+7,y:y-2}], '#5a4d47',2);
  }
  for(let j=0;j<4;j++){
    const line=Array.from({length:33},(_,i)=>{const a=i*Math.PI/16;return{x:618+Math.cos(a)*(23-j*4),y:972+Math.sin(a)*(9-j)};});
    p.line(line,'#9f8666',1.8);
  }
  p.line([{x:597,y:976},{x:579,y:982},{x:562,y:977}], '#9f8666',1.7);
  p.piece([{x:1318,y:963},{x:1306,y:975},{x:1344,y:975},{x:1335,y:963}], '#584f48', {seed:1660,tear:0.5,shadow:3,rim:{color:'#918064',width:0.7}});
  p.line([{x:1326,y:894},{x:1326,y:879}], '#a98d68',2);
  p.line(Array.from({length:17},(_,i)=>({x:1326+Math.cos(i*Math.PI/8)*5,y:878+Math.sin(i*Math.PI/8)*6})), '#c4a779',1.3);
}

/** Mesh, stitching, fastenings and small gear in the contemporary campsite. */
export function modernDetails(p: Paper): void {
  const doorway=[{x:221,y:953},{x:295,y:765},{x:357,y:953}];
  p.clip(doorway,()=>{
    for(let j=0;j<14;j++)p.line([{x:219+j*11,y:760},{x:254+j*11,y:956}], '#68808722',0.7);
    for(let j=0;j<16;j++)p.line([{x:218,y:775+j*12},{x:361,y:775+j*12}], '#68808722',0.7);
  });
  p.line([{x:296,y:773},{x:299,y:927}], '#b9b4a080',1.2);
  p.line([{x:298,y:923},{x:301,y:932},{x:297,y:935}], '#d2bb8e',2);
  p.piece([{x:162,y:814},{x:183,y:789},{x:199,y:804},{x:190,y:831}], '#75827f55',{seed:1700,tear:0.4,shadow:0,edge:false});
  p.line([{x:175,y:950},{x:154,y:870},{x:132,y:812},{x:91,y:963}], '#95a19a88',1);
  p.line([{x:426,y:761},{x:582,y:962}], '#95a19a88',1);
  for(const x of [91,582])p.line([{x:x-4,y:971},{x:x+5,y:955}], '#b7b1a0',3);
  p.line([{x:1307,y:907},{x:1314,y:896},{x:1331,y:895},{x:1337,y:906}], '#d5b08a',3);
  p.blob([{x:1307,y:927},{x:1336,y:926},{x:1338,y:941},{x:1307,y:942}], '#6d4d45',{seed:1701,tear:0.6,shadow:0});
  p.line([{x:1310,y:929},{x:1333,y:929}], '#c7a784',1);
  p.tube([{x:1460,y:759},{x:1469,y:752}],34,34,'#788990',{seed:1702,tear:0.2,shadow:0});
  p.piece(circlePoly({x:1447,y:804},5,20),'#333f50',{seed:1703,tear:0.2,shadow:1});
  p.line([{x:1448,y:809},{x:1462,y:824}], '#727f83',2);
  // An enamel cup catches a small fire-side highlight without becoming a second light source.
  p.blob([{x:1264,y:946},{x:1266,y:967},{x:1285,y:967},{x:1287,y:946}], '#758580',{seed:1704,tear:0.4,shadow:3,rim:{color:'#d6b88a',width:1}});
  p.line([{x:1287,y:949},{x:1294,y:950},{x:1294,y:960},{x:1287,y:961}], '#91a096',2);
  p.piece(circlePoly({x:1276,y:946},3,18,11),'#293744',{seed:1705,tear:0.2,shadow:0});
}

/** Bark, end grain, charred fissures and ash in the shared fire bed. */
export function hearthDetails(p: Paper, heat: number): void {
  const logs: [V,V,number][]=[[{x:911,y:927},{x:1019,y:900},20],[{x:930,y:901},{x:1035,y:935},17]];
  for(const [a,b,w] of logs){
    const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l;
    const at=(u:number,v:number):V=>({x:a.x+dx*u+nx*v,y:a.y+dy*u+ny*v});
    for(let j=-2;j<=2;j++)p.line([at(0.05,j*w*.13),at(.34,j*w*.13+1),at(.65,j*w*.13-1),at(.96,j*w*.13)],j%2?'#302d30':'#a1724d88',0.8);
    for(let i=0;i<4;i++){const u=.2+i*.17;p.line([at(u,-w*.32),at(u+.025,-1),at(u+.006,w*.28)], '#282931',1.3);}
    p.piece(circlePoly(b,w*.43,24,w*.23),'#8d6549',{seed:1750+w,tear:0.4,shadow:0});
    p.line(Array.from({length:25},(_,i)=>{const a=i*Math.PI/12;return{x:b.x+Math.cos(a)*w*.13,y:b.y+Math.sin(a)*w*.29};}), '#463a36',.9);
  }
  for(let i=0;i<22;i++){
    const x=906+hash(i+1920)*130,y=929+hash(i+1930)*12;
    p.piece(circlePoly({x,y},1+hash(i+1931)*2,10,2+hash(i+1932)*3),i%3?'#9f8a7955':`rgba(246,139,71,${heat*.5})`,{seed:1800+i,tear:.3,shadow:0,edge:false,texture:0});
  }
}
