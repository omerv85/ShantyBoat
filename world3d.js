// Shanty Boat — 3D world (three.js).
// The game logic lives in index.html's classic script (globals such as boat, items, parts, gulls, schools, G, FISH, level,
// LEVELS, cam, T, dieT, state). This module only *draws* that state with three.js every frame, and exposes
// window.R3D = {render, project, unproject} so the 2D overlay (mini map, floating text, joystick) can line up with it.
//
// Coordinates: game units on the sea plane (x, y) and height z. One unit = U metres. Game (x, y, z) maps to three.js
// (x*U, z*U, y*U), which matches the old isometric screen orientation with the camera looking along (-1, -1, -1).
// A local boat point (lx, ly) maps to three.js local (lx*U, ?, ly*U) inside a group rotated by -boat.a around y.
//
// Models: Kenney (kenney.nl) Pirate Kit, Survival Kit, City Kit Commercial and Mini Characters, CC0, in models/.
import * as THREE from 'three';
import {Water} from 'three/addons/objects/Water.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const U=0.075;
const CLOSER=1.05; // overall framing: a little closer than the old 2D view; the player's zoom (userZoom) multiplies it
const V3=THREE.Vector3;
const mobile=matchMedia('(pointer:coarse)').matches;
const ELEV=THREE.MathUtils.degToRad(40);                     // camera elevation above the sea
const VIEW=new V3(1,Math.tan(ELEV)*Math.SQRT2,1).normalize(); // direction from the look target to the camera
window.JOYK=1/Math.sin(ELEV);                                 // joystick: screen-vertical to ground scaling
window.MAPY=0.7071*Math.sin(ELEV);                            // mini map: same squash as the screen

// ---------- renderer, scene, camera ----------
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.75:2));
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.5;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
Object.assign(renderer.domElement.style,{zIndex:-1,pointerEvents:'none'});
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x86a3aa);
scene.fog=new THREE.Fog(0x6f8e95,90,230);
const camera=new THREE.PerspectiveCamera(40,1,0.5,1500);
let vw=0,vh=0;
function fit(){if(vw===W&&vh===H)return;vw=W;vh=H;renderer.setSize(W,H);camera.aspect=W/H;camera.fov=W<H?42:30;camera.updateProjectionMatrix();}

// sun, sky (environment lighting only), lights
const sun=new V3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-18),THREE.MathUtils.degToRad(205));
{const pm=new THREE.PMREMGenerator(renderer),sk=new THREE.Scene(),s=new Sky();s.scale.setScalar(1000);
  const u=s.material.uniforms;u.turbidity.value=5;u.rayleigh.value=1.1;u.mieCoefficient.value=0.006;u.mieDirectionalG.value=0.82;u.sunPosition.value.copy(sun);
  sk.add(s);scene.environment=pm.fromScene(sk).texture;}
scene.add(new THREE.HemisphereLight(0xd8e8ee,0x29403f,0.55));
const sunLight=new THREE.DirectionalLight(0xffeccc,2.4);
sunLight.castShadow=true;sunLight.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
Object.assign(sunLight.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:200});
sunLight.shadow.bias=-0.0006;sunLight.shadow.normalBias=0.03;
scene.add(sunLight,sunLight.target);

// ---------- water ----------
function waterNormals(N=256){ // tileable layered value noise -> normal map
  let s=11;const r=()=>{s=(s*16807)%2147483647;return s/2147483647;};const h=new Float32Array(N*N);
  for(const [P,amp] of [[8,1],[16,0.5],[32,0.27],[64,0.14]]){const L=new Float32Array(P*P);for(let i=0;i<P*P;i++)L[i]=r();const cell=N/P;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const gx=x/cell,gy=y/cell,x0=Math.floor(gx),y0=Math.floor(gy);let fx=gx-x0,fy=gy-y0;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
      const a=L[(y0%P)*P+x0%P],b=L[(y0%P)*P+(x0+1)%P],c=L[((y0+1)%P)*P+x0%P],d=L[((y0+1)%P)*P+(x0+1)%P];
      h[y*N+x]+=amp*((a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy);}}
  const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N),d=img.data;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=h[y*N+(x+1)%N]-h[y*N+(x+N-1)%N],dy=h[((y+1)%N)*N+x]-h[((y+N-1)%N)*N+x];
    let nx=-dx*14,ny=-dy*14;const l=Math.hypot(nx,ny,1),i=(y*N+x)*4;d[i]=(nx/l*0.5+0.5)*255;d[i+1]=(ny/l*0.5+0.5)*255;d[i+2]=(1/l*0.5+0.5)*255;d[i+3]=255;}
  g.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
const water=new Water(new THREE.PlaneGeometry(700,700),{textureWidth:mobile?256:512,textureHeight:mobile?256:512,waterNormals:waterNormals(),
  sunDirection:sun.clone().normalize(),sunColor:0xfff0d2,waterColor:0x0b3a44,distortionScale:2.2,fog:true});
water.rotation.x=-Math.PI/2;water.material.uniforms.size.value=5;scene.add(water);
// Hulls sit partly below the waterline and the Kenney rowboat has no floor between its seats, so each hull gets its own
// plank floor a little above the waterline (above the boat's bobbing), which hides the sea inside the boat.
function hullShape(len,wid){ // rounded-rectangle (superellipse) footprint that stays inside the hull walls
  const sh=new THREE.Shape(),n=48,e=2/3.2;
  for(let i=0;i<=n;i++){const t=i/n*Math.PI*2,c=Math.cos(t),s=Math.sin(t);
    const x=Math.sign(c)*Math.pow(Math.abs(c),e)*len/2,z=Math.sign(s)*Math.pow(Math.abs(s),e)*wid/2;i?sh.lineTo(x,z):sh.moveTo(x,z);}
  const g=new THREE.ShapeGeometry(sh);g.rotateX(Math.PI/2);return g;
}
// The Kenney rowboat has no floor between its seats, so each hull also gets a plank floor (boards run along the boat).
const FLOOR_TEX=(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');
  for(let i=0;i<4;i++){g.fillStyle=['#7a5634','#86603a','#71502f','#8a6640'][i];g.fillRect(0,i*16,64,16);g.fillStyle='rgba(30,18,8,.55)';g.fillRect(0,i*16,64,2);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;})();
function hullInside(len,wid,floorY){
  const g=new THREE.Group();
  const tex=FLOOR_TEX.clone();tex.needsUpdate=true;tex.repeat.set(len/1.2,wid/0.55);
  const fg=hullShape(len,wid);{const p=fg.attributes.position,uv=fg.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/len+0.5,p.getZ(i)/wid+0.5);}
  const f=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({map:tex,roughness:0.9,side:THREE.DoubleSide}));f.receiveShadow=true;f.position.y=floorY;g.add(f);
  return g;
}
const noPaddles=g=>{g.traverse(o=>{if(o.name==='paddles')o.visible=false;});return g;};
// add a hull's plank floor sized to the hull mesh itself (the model's bounds also include its paddles)
function addHullFloor(hull,kl,kw){
  boatRoot.updateMatrixWorld(true);const inv=boatRoot.matrixWorld.clone().invert(),box=new THREE.Box3(),tmp=new THREE.Box3();
  hull.traverse(o=>{if(o.isMesh&&o.visible&&o.name!=='paddles'){o.geometry.computeBoundingBox();tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));box.union(tmp);}});
  const sz=box.getSize(new V3()),c=box.getCenter(new V3()),fl=hullInside(sz.x*kl,sz.z*kw,0.12);fl.position.set(c.x,0,c.z);boatRoot.add(fl);
}

// ---------- helpers ----------
const MATS=new Map();
function mat(c,o={}){const k=c+JSON.stringify(o);if(!MATS.has(k))MATS.set(k,new THREE.MeshStandardMaterial(Object.assign({color:c,flatShading:true,roughness:0.85},o)));return MATS.get(k);}
function mesh(geo,m,shadow=true){const o=new THREE.Mesh(geo,m);o.castShadow=shadow;o.receiveShadow=shadow;return o;}
const rgbHex=c=>(c[0]<<16)|(c[1]<<8)|c[2];
const toW=(x,y,z=0)=>new V3(x*U,z*U,y*U);

// ---------- model library ----------
const NEED={
  pirate:['platform','platform-planks','crate','barrel','bottle','boat-row-large','boat-row-small','tool-paddle'],
  survival:['tent-canvas','structure','structure-roof','metal-panel-screws','resource-planks','bottle','box','bucket'],
  city:['building-a','building-b','building-c','building-d','building-e','building-g','building-h','building-j','building-k','building-m','building-skyscraper-a','building-skyscraper-b','building-skyscraper-c'],
  chars:['character-male-b','character-female-d','character-male-g','character-worker'],
};
const LIB={},WEATHERED=new Set();
function weather(m,pack){ // mute Kenney's bright palette to fit the drowned world
  if(WEATHERED.has(m))return;WEATHERED.add(m);
  const amt=pack==='chars'?0.12:0.22,tint=pack==='chars'?'0.97,0.97,0.95':'0.8,0.86,0.84';
  m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',
    `#include <map_fragment>
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(0.299,0.587,0.114))),${amt.toFixed(2)})*vec3(${tint});`);};
  m.needsUpdate=true;
}
async function loadModels(){
  const L=new GLTFLoader(),jobs=[];
  for(const [pack,names] of Object.entries(NEED))for(const n of names)
    jobs.push(L.loadAsync(`models/${pack}/${n}.glb`).then(g=>{
      g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;weather(o.material,pack);}});
      LIB[pack+'/'+n]={scene:g.scene,anims:g.animations,box:new THREE.Box3().setFromObject(g.scene)};}));
  await Promise.all(jobs);
}
// A copy of a model fitted to a size in metres. Give [x,y,z]; null entries keep the model's proportions.
// The result rests on y=0, centred on x/z, wrapped in a group.
function fitModel(key,sx,sy,sz){
  const src=LIB[key],o=src.anims.length?SkeletonUtils.clone(src.scene):src.scene.clone();
  const b=src.box,s=b.getSize(new V3()),c=b.getCenter(new V3());
  const ks=[sx&&sx/s.x,sy&&sy/s.y,sz&&sz/s.z].filter(Boolean),k=ks.length?ks.reduce((a,v)=>a+v)/ks.length:1;
  const kx=sx?sx/s.x:k,ky=sy?sy/s.y:k,kz=sz?sz/s.z:k;
  o.scale.set(kx,ky,kz);o.position.set(-c.x*kx,-b.min.y*ky,-c.z*kz);
  const g=new THREE.Group();g.add(o);g.userData.size=new V3(s.x*kx,s.y*ky,s.z*kz);g.userData.inner=o;g.userData.anims=src.anims;return g;
}

// ---------- people ----------
const mixers=new Set();
const CHAR=['character-male-b','character-female-d','character-male-g','character-worker'];
function person(idx,anim,height=1.3){
  const g=fitModel('chars/'+CHAR[idx%CHAR.length],null,height,null);
  g.userData.inner.rotation.y=Math.PI/2;g.userData.inner.position.set(0,g.userData.inner.position.y,0); // face +x
  const mx=new THREE.AnimationMixer(g.userData.inner);mixers.add(mx);g.userData.mixer=mx;g.userData.cur=null;
  play(g,anim);return g;
}
function play(g,name,once=false){
  if(g.userData.cur===name)return;const clip=THREE.AnimationClip.findByName(g.userData.anims,name);if(!clip)return;
  const a=g.userData.mixer.clipAction(clip);a.reset();
  if(once){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}
  const prev=g.userData.action;a.play();if(prev&&prev!==a)prev.crossFadeTo(a,0.25,false);
  g.userData.action=a;g.userData.cur=name;
}
function disposePeople(root){root.traverse(o=>{if(o.userData&&o.userData.mixer)mixers.delete(o.userData.mixer);});}

// ---------- props built in code ----------
function tomatoPot(){
  const g=new THREE.Group();
  const pot=mesh(new THREE.CylinderGeometry(0.32,0.24,0.5,10),mat(0xa65a3a));pot.position.y=0.25;g.add(pot);
  const soil=mesh(new THREE.CylinderGeometry(0.3,0.3,0.04,10),mat(0x3f2a1c));soil.position.y=0.5;g.add(soil);
  const stake=mesh(new THREE.CylinderGeometry(0.02,0.02,1.3,5),mat(0x8a6a3a));stake.position.y=1.1;g.add(stake);
  for(const [x,y,z,r] of [[-.15,.9,0,.22],[.12,1.1,.1,.2],[0,1.35,-.08,.2],[.15,.75,-.1,.18],[-.1,1.5,.05,.15]]){
    const l=mesh(new THREE.IcosahedronGeometry(r,0),mat(0x4f8a36));l.position.set(x,y,z);g.add(l);}
  for(const [x,y,z] of [[-.2,.85,.12],[.18,1.0,.15],[.05,1.25,.16],[-.12,1.2,-.12]]){
    const t=mesh(new THREE.SphereGeometry(0.075,8,6),mat(0xd8352a,{roughness:0.4,flatShading:false}));t.position.set(x,y,z);g.add(t);}
  return g;
}
function outboard(){
  const g=new THREE.Group();
  const cowl=mesh(new THREE.BoxGeometry(0.62,0.6,0.5),mat(0xb2342a,{roughness:0.5}));cowl.position.y=0.62;g.add(cowl);
  const band=mesh(new THREE.BoxGeometry(0.64,0.08,0.52),mat(0xe8e6e0));band.position.y=0.55;g.add(band);
  const shaft=mesh(new THREE.BoxGeometry(0.16,0.95,0.18),mat(0x3c3e40,{metalness:0.4,roughness:0.5}));shaft.position.y=-0.1;g.add(shaft);
  const tiller=mesh(new THREE.CylinderGeometry(0.03,0.03,0.85,6),mat(0x262626));tiller.rotation.z=Math.PI/2;tiller.position.set(0.55,0.72,0.1);g.add(tiller);
  return g;
}
function gullMesh(){
  const g=new THREE.Group();const body=mesh(new THREE.CapsuleGeometry(0.11,0.4,3,6),mat(0xf2f2ee),false);body.rotation.z=Math.PI/2;g.add(body);
  const head=mesh(new THREE.SphereGeometry(0.1,8,6),mat(0xf6f6f2),false);head.position.set(0.28,0.07,0);g.add(head);
  const beak=mesh(new THREE.ConeGeometry(0.03,0.12,5),mat(0xf0b030),false);beak.rotation.z=-Math.PI/2;beak.position.set(0.41,0.06,0);g.add(beak);
  const wings=[];for(const s of [-1,1]){const w=new THREE.Group();const m=mesh(new THREE.BoxGeometry(0.28,0.025,0.8),mat(0xe4e6e2),false);m.position.z=s*0.4;w.add(m);
    const tip=mesh(new THREE.BoxGeometry(0.2,0.025,0.22),mat(0x2a2a2a),false);tip.position.z=s*0.86;w.add(tip);g.add(w);wings.push(w);}
  g.userData.wings=wings;return g;
}

// ---------- the boat for a level ----------
const boatRoot=new THREE.Group();scene.add(boatRoot);
let boatKey='',crew=[],oars=[],motorObj=null,antenna=null,deckTop=0.2;
function buildBoat(){
  disposePeople(boatRoot);boatRoot.clear();crew=[];oars=[];motorObj=null;antenna=null;
  const L=LEVELS[level];
  const top=0.2;deckTop=top;
  // log rafts
  for(const r of L.rects){const p=fitModel('pirate/platform',r[2]*U,0.34,r[3]*U);p.position.set(r[0]*U,top-0.34,r[1]*U);boatRoot.add(p);
    if(L.bottles)edgeBottles(r[0]-r[2]/2,r[0]+r[2]/2,r[1]-r[3]/2,r[1]+r[3]/2);}
  // lashed planks between the rafts
  const plank=(x,y,w,d)=>{const p=fitModel('pirate/platform-planks',w*U,0.12,d*U);p.position.set(x*U,top-0.02,y*U);boatRoot.add(p);};
  if(L.planks)for(const s of [1,-1])for(const px of [-9,9])plank(px,s*36,7,22);
  if(L.frontPlanks)for(const s of [1,-1])plank(36.5,s*9,22,7);
  if(L.sternRaft)for(const s of [1,-1])plank(-33.5,s*9,11,7);
  // catamaran pontoons and cross planks
  if(L.cats)for(const s of [1,-1]){const b=fitModel('pirate/boat-row-small',null,null,null);const sz=b.userData.size,long=sz.x>=sz.z?'x':'z';
    const f=fitModel('pirate/boat-row-small',long==='x'?104*U:24*U,0.9,long==='x'?24*U:104*U);if(long==='z')f.rotation.y=Math.PI/2;
    f.position.set(12*U,-0.45,s*64*U);boatRoot.add(noPaddles(f));addHullFloor(f,0.84,0.7);for(const px of [-14,44])plank(px,s*42,7,44);}
  // rowboat hull
  if(L.hull){const b=fitModel('pirate/boat-row-large',null,null,null),sz=b.userData.size,long=sz.x>=sz.z?'x':'z';
    const h=fitModel('pirate/boat-row-large',long==='x'?121*U:54*U,1.15,long==='x'?54*U:121*U);if(long==='z')h.rotation.y=Math.PI/2;
    h.position.set(29.5*U,-0.55,0);boatRoot.add(noPaddles(h));deckTop=0.13;
    addHullFloor(h,0.86,0.76);}
  const dt=deckTop;
  // tent or shack
  if(L.tent){const t=fitModel('survival/tent-canvas',32*U,1.8,30*U);t.position.set(-2*U,dt,0);boatRoot.add(t);}
  if(L.shack){
    const sh=new THREE.Group();sh.position.set(-3*U,dt,0);boatRoot.add(sh);
    const S=30*U,fr=fitModel('survival/structure',S,1.9,S);sh.add(fr);
    const rf=fitModel('survival/structure-roof',S*1.2,null,S*1.2);rf.position.y=1.9*0.9;sh.add(rf);
    for(const [x,z,ry,len] of [[0,-S/2,0,S],[0,S/2,0,S],[-S/2,0,Math.PI/2,S]]){
      const w=fitModel('survival/metal-panel-screws',len*0.96,1.6,null);w.position.set(x,0,z);w.rotation.y=ry;sh.add(w);}
    const pipe=mesh(new THREE.CylinderGeometry(0.08,0.08,1.0,8),mat(0x3b3b3b,{metalness:0.6,roughness:0.5}));pipe.position.set(-7*U,2.1,8*U);sh.add(pipe);
    if(level>=MAP_LEVEL){antenna=new THREE.Group();antenna.position.set(3*U,2.0,-7*U);sh.add(antenna);
      const pole=mesh(new THREE.CylinderGeometry(0.025,0.03,1.3,5),mat(0x6a6f73,{metalness:0.5}));pole.position.y=0.65;antenna.add(pole);
      const bar=mesh(new THREE.BoxGeometry(1.0,0.05,0.08),mat(0xa7b0b5,{metalness:0.5}));bar.position.y=1.3;antenna.add(bar);antenna.userData.bar=bar;
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6),new THREE.MeshBasicMaterial({color:0xff5a3a}));lamp.position.y=1.38;antenna.add(lamp);antenna.userData.lamp=lamp;}
  }
  if(L.pot){const p=tomatoPot();p.position.set(L.pot[0]*U,dt,L.pot[1]*U);boatRoot.add(p);}
  if(L.motor){motorObj=outboard();motorObj.position.set(L.motor*U,dt-0.15,0);boatRoot.add(motorObj);}
  // crew
  for(const c of crewList(L)){
    const o=c.o,anim=o.role==='motor'?'sit':o.role==='row'?'holding-both':o.role==='fish'?'holding-right':o.role==='farm'?'pick-up':'holding-right';
    const p=person(o.idx,anim);p.position.set(c.pl[0]*U,dt+(anim==='sit'?0.32:0),c.pl[1]*U);
    if(anim==='sit'){const seat=fitModel('pirate/crate',0.5,0.34,0.5);seat.position.set(c.pl[0]*U-0.12,dt,c.pl[1]*U);boatRoot.add(seat);}
    if(o.role==='farm'&&o.pot)p.rotation.y=-Math.atan2(o.pot[1]-c.pl[1],o.pot[0]-c.pl[0]);
    if(o.role==='fish'){const rod=mesh(new THREE.CylinderGeometry(0.015,0.025,2.4,5),mat(0x4a3424));rod.position.set(0.55,1.55,0.15);rod.rotation.z=-0.55;p.add(rod);p.userData.rodTip=new V3(1.15,2.6,0.15);}
    boatRoot.add(p);crew.push({g:p,c,home:p.position.clone(),homeRot:p.rotation.y});
    // one long sculling oar over the stern: the rower stands facing aft, both hands on the handle, and sweeps it side to side
    if(o.role==='row'){p.rotation.y=Math.PI;
      const g=new THREE.Group(),tilt=new THREE.Group();g.add(tilt);
      const pd=fitModel('pirate/tool-paddle',null,2.9,null);pd.rotation.z=Math.PI/2;pd.position.x=2.55;tilt.add(pd);
      tilt.rotation.z=-0.36;g.position.set(c.pl[0]*U-0.38,dt+0.78,c.pl[1]*U);g.userData.tilt=tilt;boatRoot.add(g);oars.push(g);}
  }
}
function edgeBottles(x0,x1,y0,y1,y=-0.08){
  const sp=0.7/U;
  const add=(x,yy,rot)=>{const b=fitModel(Math.random()<0.5?'pirate/bottle':'survival/bottle',null,0.42,null);b.userData.inner.rotation.z=Math.PI/2;
    b.position.set(x*U,y,yy*U);b.rotation.y=rot;boatRoot.add(b);};
  for(let x=x0+sp/2;x<x1;x+=sp){add(x,y0-2,0);add(x,y1+2,0);}
  for(let yy=y0+sp/2;yy<y1;yy+=sp){add(x0-2,yy,Math.PI/2);add(x1+2,yy,Math.PI/2);}
}

// ---------- items ----------
const itemObjs=new Map();
function itemMesh(it){
  let g;
  switch(it.kind){
    case 'wood':g=fitModel(Math.random()<0.5?'survival/resource-planks':'pirate/platform-planks',it.len*U*0.85,null,null);break;
    case 'bottle':g=fitModel(Math.random()<0.6?'pirate/bottle':'survival/bottle',null,0.55,null);g.userData.inner.rotation.z=Math.PI/2;g.userData.inner.position.y+=0.12;break;
    case 'crate':{if(it.sub){g=applianceMesh(it.sub);break;}
      g=new THREE.Group();const c=rgbHex(it.col);
      const b=mesh(new THREE.BoxGeometry(1.1,0.72,0.9),mat(c,{roughness:0.55}));b.position.y=0.25;g.add(b);
      const rim=mesh(new THREE.BoxGeometry(1.16,0.1,0.96),mat(new THREE.Color(c).multiplyScalar(0.75).getHex(),{roughness:0.55}));rim.position.y=0.62;g.add(rim);
      for(const x of [-0.3,0.3]){const s=mesh(new THREE.BoxGeometry(0.06,0.5,0.92),mat(new THREE.Color(c).multiplyScalar(0.8).getHex()));s.position.set(x,0.22,0);g.add(s);}
      break;}
    case 'survivor':g=survivorRaft(it);break;
    default:g=junkMesh(it);
  }
  if(it.gull){const gl=gullMesh();gl.scale.setScalar(0.75);gl.position.y=it.sub==='foam'?0.28:0.2;gl.userData.wings.forEach(w=>w.rotation.x=0);
    gl.userData.wings[0].scale.z=0.35;gl.userData.wings[1].scale.z=0.35;gl.rotation.y=it.gull.fx>0?0:Math.PI;g.add(gl);g.userData.gull=gl;}
  return g;
}
// A washing machine or fridge floating on its back, mostly under water, door facing up.
function applianceMesh(sub){
  const g=new THREE.Group(),body=mat(0xd8d5ca,{roughness:0.45}),dark=mat(0x2a2e30,{roughness:0.4}),
    rust=mat(0x7a4a26,{roughness:1}),chrome=mat(0x9aa0a2,{metalness:0.7,roughness:0.35});
  const stain=(x,z,w,d)=>{const s=mesh(new THREE.BoxGeometry(w,0.02,d),rust);s.position.set(x,0,z);return s;};
  if(sub==='washer'){
    const b=mesh(new THREE.BoxGeometry(0.85,0.6,0.85),body);b.position.y=0;g.add(b);
    const top=0.3;
    const ring=mesh(new THREE.TorusGeometry(0.26,0.05,8,20),chrome);ring.rotation.x=Math.PI/2;ring.position.set(0.06,top+0.02,0);g.add(ring);
    const glass=mesh(new THREE.CylinderGeometry(0.22,0.22,0.03,20),new THREE.MeshStandardMaterial({color:0x1d3440,roughness:0.15,metalness:0.2,transparent:true,opacity:0.85}));
    glass.position.set(0.06,top+0.02,0);g.add(glass);
    const panel=mesh(new THREE.BoxGeometry(0.16,0.03,0.8),mat(0xbcb8ac,{roughness:0.5}));panel.position.set(-0.33,top+0.01,0);g.add(panel);
    const knob=mesh(new THREE.CylinderGeometry(0.05,0.05,0.05,10),dark);knob.position.set(-0.33,top+0.04,0.25);g.add(knob);
    for(const [x,z,w,d] of [[0.3,-0.33,0.18,0.12],[-0.2,0.36,0.25,0.08]]){const s=stain(x,z,w,d);s.position.y=top+0.005;g.add(s);}
  } else {
    const b=mesh(new THREE.BoxGeometry(1.75,0.62,0.72),body);b.position.y=0;g.add(b);
    const top=0.31;
    const seam=mesh(new THREE.BoxGeometry(0.025,0.02,0.72),dark);seam.position.set(0.38,top+0.005,0);g.add(seam); // freezer / fridge doors
    for(const x of [0.48,0.28]){const h=mesh(new THREE.BoxGeometry(x>0.4?0.3:0.55,0.05,0.05),chrome);h.position.set(x>0.4?x+0.2:x-0.3,top+0.04,-0.27);g.add(h);}
    const gasket=mesh(new THREE.BoxGeometry(1.77,0.04,0.74),dark);gasket.position.y=top-0.05;g.add(gasket);
    for(const [x,z,w,d] of [[-0.55,0.2,0.3,0.14],[0.7,-0.1,0.16,0.22],[-0.1,-0.3,0.22,0.07]]){const s=stain(x,z,w,d);s.position.y=top+0.005;g.add(s);}
  }
  g.scale.setScalar(1.35); // a bit larger than life so they read at game zoom, like the plastic boxes
  return g;
}
function junkMesh(it){
  const g=new THREE.Group();
  switch(it.sub){
    case 'tire':{const t=mesh(new THREE.TorusGeometry(0.36,0.16,8,16),mat(0x1d1f20,{roughness:0.9}));t.rotation.x=Math.PI/2;t.position.y=0.05;g.add(t);break;}
    case 'blackbag':{const b=mesh(new THREE.IcosahedronGeometry(0.45,1),mat(0x16181a,{roughness:0.35,metalness:0.1}));b.scale.set(1,0.65,0.9);b.position.y=0.12;g.add(b);
      const k=mesh(new THREE.ConeGeometry(0.1,0.25,5),mat(0x16181a,{roughness:0.35}));k.position.y=0.45;g.add(k);break;}
    case 'bag':{const b=mesh(new THREE.IcosahedronGeometry(0.38,1),mat(0xe8e8de,{transparent:true,opacity:0.75,roughness:0.6}));b.scale.set(1,0.35,0.85);g.add(b);break;}
    case 'can':{const c=mesh(new THREE.CylinderGeometry(0.1,0.1,0.32,10),mat(rgbHex(it.col),{metalness:0.6,roughness:0.35,flatShading:false}));c.rotation.z=Math.PI/2;c.position.y=0.05;g.add(c);break;}
    case 'foam':{const f=mesh(new THREE.BoxGeometry(0.85,0.22,0.55),mat(0xd6d4c8));f.position.y=0.06;g.add(f);break;}
    default:{const n=mesh(new THREE.PlaneGeometry(0.95,0.95,4,4),new THREE.MeshStandardMaterial({color:0x3c5a46,wireframe:true}));n.rotation.x=-Math.PI/2;n.position.y=0.03;g.add(n);}
  }
  return g;
}
function survivorRaft(it){
  const g=new THREE.Group();
  const p=fitModel('pirate/platform',26*U,0.3,26*U);p.position.y=-0.12;g.add(p);
  if(it.farmer){const t=tomatoPot();t.position.set(-6*U,0.18,-6*U);g.add(t);}
  else{const pole=mesh(new THREE.CylinderGeometry(0.03,0.03,2.0,5),mat(0x5d3f22));pole.position.set(-9*U,1.18,-9*U);g.add(pole);
    const flag=mesh(new THREE.PlaneGeometry(0.9,0.55,6,1),new THREE.MeshStandardMaterial({color:0xd8d2c0,side:THREE.DoubleSide,roughness:0.9}));
    flag.position.set(-9*U+0.45,1.9,-9*U);g.add(flag);g.userData.flag=flag;}
  const idx=it.farmer?3:it.fisher?2:1;
  const pp=person(idx,'emote-yes');pp.position.set(2*U,0.18,2*U);g.add(pp);g.userData.person=pp;
  if(it.fisher){const rod=mesh(new THREE.CylinderGeometry(0.015,0.025,2.4,5),mat(0x4a3424));rod.position.set(0.5,1.4,-0.4);rod.rotation.set(0.5,0,-0.6);pp.add(rod);}
  return g;
}

// ---------- drowned buildings ----------
const ruinObjs=new Map();
const GRIME=new Map();
function grimy(m){if(!GRIME.has(m)){const c=m.clone();c.color=c.color.clone().multiplyScalar(0.6).lerp(new THREE.Color(0x5e5a44),0.32);c.roughness=1;
  c.onBeforeCompile=m.onBeforeCompile;GRIME.set(m,c);}return GRIME.get(m);}
function ruinMesh(r){
  const g=new THREE.Group();
  const key=NEED.city[(hash(r.seed,7)*NEED.city.length)|0];
  const w=r.w*U,d=r.d*U,b=fitModel('city/'+key,w,null,d);
  b.userData.inner.traverse(o=>{if(o.isMesh)o.material=grimy(o.material);});
  const hgt=b.userData.size.y,want=Math.max(2,r.h*U);
  b.position.y=-Math.max(hgt*0.12,hgt-want);g.add(b);
  const slime=mesh(new THREE.BoxGeometry(w+0.06,0.7,d+0.06),mat(0x34412f,{roughness:1}),false);slime.position.y=0.1;g.add(slime);
  g.position.copy(toW(r.x,r.y));g.rotation.y=-r.a;
  return g;
}

// ---------- ropes & lines (chains of thin cylinders) ----------
function makeLine(n,radius,color){const segs=[];const geo=new THREE.CylinderGeometry(radius,radius,1,5);geo.translate(0,0.5,0);geo.rotateX(Math.PI/2);
  for(let i=0;i<n;i++){const m=mesh(geo,mat(color),false);m.visible=false;scene.add(m);segs.push(m);}return segs;}
const _a=new V3(),_b=new V3();
function setLine(segs,p0,p1,sag){
  const n=segs.length;
  for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n;
    const q=(t,out)=>out.lerpVectors(p0,p1,t).add(new V3(0,-sag*4*t*(1-t),0));
    q(t0,_a);q(t1,_b);const m=segs[i];m.visible=true;m.position.copy(_a);m.lookAt(_b);m.scale.set(1,1,_a.distanceTo(_b));}
}
const hideLine=segs=>segs.forEach(s=>s.visible=false);
const rope=makeLine(14,0.025,0xd8c08e),fishLine=makeLine(12,0.008,0xeeeeea);
const hook=mesh(new THREE.TorusGeometry(0.12,0.03,5,10,Math.PI*1.3),mat(0x59636a,{metalness:0.6,roughness:0.4}),false);hook.visible=false;scene.add(hook);
const bobber=mesh(new THREE.SphereGeometry(0.07,8,6),mat(0xe8e4dc),false);bobber.visible=false;scene.add(bobber);
const hookedFish=mesh(new THREE.SphereGeometry(0.18,8,6),mat(0xc9d4da,{metalness:0.5,roughness:0.3}),false);hookedFish.scale.set(1.6,0.6,0.5);hookedFish.visible=false;scene.add(hookedFish);

// ---------- particles, gulls, fish (pooled) ----------
const pools={};
const PGEO={ring:new THREE.RingGeometry(0.85,1,24).rotateX(-Math.PI/2),foam:new THREE.CircleGeometry(1,10).rotateX(-Math.PI/2),
  drop:new THREE.SphereGeometry(1,6,4),chip:new THREE.BoxGeometry(2,0.7,0.7),smoke:new THREE.IcosahedronGeometry(1,0),
  fish:new THREE.SphereGeometry(1,8,5)};
function pooled(kind,i){
  const pool=pools[kind]||(pools[kind]=[]);
  if(!pool[i]){let m;
    if(kind==='chip')m=new THREE.Mesh(PGEO.chip,new THREE.MeshStandardMaterial({color:0x8a6239,flatShading:true}));
    else if(kind==='smoke')m=new THREE.Mesh(PGEO.smoke,new THREE.MeshStandardMaterial({color:0xbebdb8,transparent:true,depthWrite:false,flatShading:true}));
    else if(kind==='fish')m=new THREE.Mesh(PGEO.fish,new THREE.MeshBasicMaterial({color:0x0c2a32,transparent:true,opacity:0.5,depthWrite:false}));
    else m=new THREE.Mesh(PGEO[kind],new THREE.MeshBasicMaterial({color:0xeaf6f6,transparent:true,depthWrite:false,fog:true}));
    if(kind==='ring'||kind==='foam'||kind==='fish')m.renderOrder=1;
    scene.add(m);pool[i]=m;}
  pool[i].visible=true;return pool[i];
}
function hideRest(kind,n){const pool=pools[kind];if(pool)for(let i=n;i<pool.length;i++)pool[i].visible=false;}
const gullObjs=[];

// ---------- per-frame sync ----------
let lastT=performance.now(),wasDead=false;
function render(){
  fit();
  const now=performance.now(),dt=Math.min(0.05,(now-lastT)/1000);lastT=now;
  const playing=state!=='menu';
  // camera: the same framing as before — boat in the lower middle, zoom from ZOOMS
  const sc=baseScale()*zoom*CLOSER*(typeof userZoom==='number'?userZoom:1),hfov=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*camera.aspect);
  const widthM=W/sc*U,dist=widthM/(2*Math.tan(hfov/2));
  const fwd=0.19*H*U/(sc*Math.sin(ELEV));
  const look=toW(cam.x,cam.y).add(new V3(-fwd/Math.SQRT2,0,-fwd/Math.SQRT2));
  const px=U/sc,right=new V3(1,0,-1).normalize();
  camera.position.copy(look).addScaledVector(VIEW,dist).addScaledVector(right,-(cam.sx||0)*px).add(new V3(0,(cam.sy||0)*px,0));
  camera.lookAt(look);camera.updateMatrixWorld();
  sunLight.position.copy(look).addScaledVector(sun,80);sunLight.target.position.copy(look);
  water.position.set(look.x,0,look.z);water.material.uniforms.time.value+=dt*0.6;

  // boat
  boatRoot.visible=playing;
  const dead=dieT>=0;
  if(playing&&(boatKey!==String(level)||(wasDead&&!dead))){boatKey=String(level);buildBoat();}
  wasDead=dead;
  if(playing){
    const L=LEVELS[level],sp=Math.hypot(boat.vx,boat.vy);
    boatRoot.position.set(boat.x*U,boat.bob*U*0.6,boat.y*U);
    boatRoot.rotation.set(Math.sin(T*1.1)*0.02,-boat.a,Math.sin(T*0.9+1)*0.025);
    const bc=Math.cos(boat.row),sw=Math.sin(boat.row);
    const yaw=oarYaw();for(const o of oars){o.visible=!dead;o.rotation.y=Math.PI+yaw;o.userData.tilt.rotation.x=bc*0.35;} // blade feathers at each end of the sweep
    if(motorObj){const run=!dead&&sp>5;motorObj.position.y=deckTop-0.15+(run?Math.sin(T*45)*0.012:0);}
    if(antenna){antenna.userData.bar.rotation.y=T*2.5;antenna.userData.lamp.visible=(T%1.2)<0.35;}
    for(const cm of crew){const o=cm.c.o,g=cm.g;
      if(dead){
        play(g,'die',true);
        const k=clamp((dieT-fallTime(o.idx))/FALL_DUR,0,1);
        if(k>0){const d=fallDest(cm.c.pl);g.position.set(lerp(cm.home.x,d[0]*U,k),cm.home.y+Math.sin(k*Math.PI)*0.7-k*1.2-(k>=1?Math.min(2,(dieT-fallTime(o.idx)-FALL_DUR)*0.6):0),lerp(cm.home.z,d[1]*U,k));}
        g.visible=g.position.y>-1.6;
      } else {g.visible=true;
        if(o.role==='row'){g.rotation.y=Math.PI+oarYaw()*0.55;g.rotation.z=0;}
        if(o.grapple&&o.role!=='row'){play(g,G.st==='throw'?'attack-melee-right':'holding-right',G.st==='throw');}
        if(o.role==='fish')play(g,FISH.st==='cast'?'attack-melee-right':'holding-right',FISH.st==='cast');
      }}
  }
  boatRoot.updateMatrixWorld();

  // items
  const seen=new Set();
  for(const it of items){
    if(Math.abs(it.x-cam.x)>1400||Math.abs(it.y-cam.y)>1400)continue;
    let g=itemObjs.get(it);if(!g){g=itemMesh(it);scene.add(g);itemObjs.set(it,g);}
    seen.add(it);
    g.position.set(it.x*U,it.bz*U*0.35,it.y*U);g.rotation.y=-it.a;
    if(it.kind!=='survivor'){g.rotation.x=Math.sin(T*1.3+it.ph)*0.06;g.rotation.z=Math.cos(T*1.1+it.ph)*0.06;}
    if(g.userData.flag){const pos=g.userData.flag.geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i);pos.setZ(i,Math.sin(T*6+it.ph+x*5)*0.08*(x+0.45));}pos.needsUpdate=true;}
    if(g.userData.person){const toB=Math.atan2(boat.y-it.y,boat.x-it.x);g.userData.person.rotation.y=-(toB-it.a);}
    if(g.userData.gull&&!it.gull){g.remove(g.userData.gull);g.userData.gull=null;}
  }
  for(const [it,g] of itemObjs)if(!seen.has(it)){scene.remove(g);disposePeople(g);itemObjs.delete(it);}

  // ruins near the camera
  const rseen=new Set();
  for(const r of ruinsNear(cam.x,cam.y,2600)){let g=ruinObjs.get(r);if(!g){g=ruinMesh(r);scene.add(g);ruinObjs.set(r,g);}rseen.add(r);}
  for(const [r,g] of ruinObjs)if(!rseen.has(r)){scene.remove(g);ruinObjs.delete(r);}

  // grapple rope from the grappler's hands to the hook
  const gc=crew.find(c=>c.c.o.grapple);
  if(playing&&G.st!=='idle'&&gc&&!dead){
    const hand=gc.g.localToWorld(new V3(0.25,0.85,0.15));
    const h=toW(G.hx,G.hy,G.hz);setLine(rope,hand,h,G.st==='throw'?-0.6:0.35);hook.visible=true;hook.position.copy(h);hook.rotation.y=T;
  } else {hideLine(rope);hook.visible=false;}
  // fishing line
  const fc=crew.find(c=>c.c.o.role==='fish');
  if(playing&&fc&&!dead&&fc.g.userData.rodTip){
    const tip=fc.g.localToWorld(fc.g.userData.rodTip.clone());
    const b=FISH.st==='idle'?tip.clone().add(new V3(0,-1.2,0)):toW(FISH.bx,FISH.by,FISH.bz||0);
    setLine(fishLine,tip,b,FISH.st==='wait'?0.4:0.05);bobber.visible=FISH.st!=='idle';bobber.position.copy(b);
    hookedFish.visible=FISH.st==='reel'&&FISH.caught;if(hookedFish.visible){hookedFish.position.copy(b).add(new V3(0,-0.2,0));hookedFish.rotation.z=Math.sin(T*25)*0.6;}
  } else {hideLine(fishLine);bobber.visible=false;hookedFish.visible=false;}

  // particles
  const n={ring:0,foam:0,drop:0,chip:0,smoke:0};
  for(const p of parts){const k=p.k;if(!(k in n))continue;const m=pooled(k,n[k]++);
    if(k==='ring'){m.position.set(p.x*U,0.04,p.y*U);m.scale.setScalar(Math.max(0.01,p.size*U));m.material.opacity=p.a*(p.life/p.max);}
    else if(k==='foam'){m.position.set(p.x*U,0.035,p.y*U);m.scale.setScalar(Math.max(0.01,p.size*U*0.9));m.material.opacity=Math.min(0.6,p.a*1.3*Math.min(1,p.life/p.max*1.4));}
    else if(k==='drop'){m.position.set(p.x*U,p.z*U,p.y*U);m.scale.setScalar(p.size*U*0.6);m.material.opacity=0.9;}
    else if(k==='chip'){m.position.set(p.x*U,p.z*U,p.y*U);m.scale.setScalar(p.size*U);m.rotation.set(p.rot+T*6,p.rot,T*4);m.material.color.setRGB(p.col[0]/255,p.col[1]/255,p.col[2]/255);}
    else {m.position.set(p.x*U,p.z*U,p.y*U);m.scale.setScalar(p.size*U*0.9);m.material.opacity=0.4*Math.min(1,p.life/p.max*1.5);}}
  for(const k in n)hideRest(k,n[k]);

  // flying gulls
  while(gullObjs.length<gulls.length){const g=gullMesh();scene.add(g);gullObjs.push(g);}
  gullObjs.forEach((g,i)=>{const gl=gulls[i];g.visible=!!gl;if(!gl)return;
    g.position.set(gl.x*U,gl.z*U*0.4,gl.y*U);g.rotation.y=-Math.atan2(gl.vy||0,gl.vx||1);
    const f=Math.sin(gl.ph)*0.55;g.userData.wings[0].rotation.x=f;g.userData.wings[1].rotation.x=-f;});

  // schools of fish: dark shapes just under the surface
  let fi=0;
  for(const s of schools){if(Math.abs(s.x-cam.x)>900||Math.abs(s.y-cam.y)>900)continue;
    const c=Math.cos(s.h),sn=Math.sin(s.h);
    for(const f of s.fish){const wob=Math.sin(T*1.5+f.ph)*3,ox=f.ox+Math.sin(T*0.7+f.ph)*2;
      const m=pooled('fish',fi++);m.position.set((s.x+ox*c-(f.oy+wob)*sn)*U,0.02,(s.y+ox*sn+(f.oy+wob)*c)*U);
      m.scale.set(0.34*f.sz,0.02,0.11*f.sz);m.rotation.y=-s.h+Math.sin(T*(s.flee>0?12:4)+f.ph)*0.25;}}
  hideRest('fish',fi);

  for(const mx of mixers)mx.update(dt);
  renderer.render(scene,camera);
}

// ---------- HUD icons rendered from 3D models ----------
function makeIcons(){
  const S=96,r=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  r.setPixelRatio(1);r.setSize(S,S,false);r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.0;
  const sc=new THREE.Scene();sc.environment=scene.environment;
  sc.add(new THREE.HemisphereLight(0xffffff,0x40484c,1.3));const dl=new THREE.DirectionalLight(0xfff4e0,2.4);dl.position.set(2,4,3);sc.add(dl);
  const cam=new THREE.PerspectiveCamera(24,1,0.05,50);
  const shot=(obj,dir=new V3(1,0.85,1.2))=>{sc.add(obj);obj.updateMatrixWorld(true);
    const sph=new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
    cam.position.copy(sph.center).add(dir.normalize().multiplyScalar(sph.radius/Math.sin(THREE.MathUtils.degToRad(12))));cam.lookAt(sph.center);
    r.render(sc,cam);const url=r.domElement.toDataURL('image/png');sc.remove(obj);return url;};
  const std=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:0.5},o));
  // food: a tin can with a red label
  const can=new THREE.Group();
  can.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.8,24),std(0xb9c0c6,{metalness:0.7,roughness:0.3})));
  const lab=new THREE.Mesh(new THREE.CylinderGeometry(0.345,0.345,0.46,24,1,true),std(0xc8402f));can.add(lab);
  const dot=new THREE.Mesh(new THREE.CircleGeometry(0.11,16),std(0xf2c14e));dot.position.set(0.2,0,0.28);dot.lookAt(0.6,0,0.84);can.add(dot);
  for(const y of [-0.4,0.4]){const rim=new THREE.Mesh(new THREE.TorusGeometry(0.33,0.025,6,24),std(0xdfe4e8,{metalness:0.8,roughness:0.25}));rim.rotation.x=Math.PI/2;rim.position.y=y;can.add(rim);}
  // water: a blue jug, half full
  const jug=new THREE.Group();
  jug.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.34,0.62,20),std(0xd8f0fb,{roughness:0.15,transparent:true,opacity:0.6})));
  const wat=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.32,0.42,20),std(0x2f8fe0,{roughness:0.2}));wat.position.y=-0.09;jug.add(wat);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.3,0.22,20),std(0xd8f0fb,{roughness:0.15,transparent:true,opacity:0.6}));neck.position.y=0.42;jug.add(neck);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.13,16),std(0x1f5fa8));cap.position.y=0.58;jug.add(cap);
  // plastic: a crumpled clear bottle lying down with a red cap
  const pb=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.24,0.8,12,4),std(0xa8dcee,{roughness:0.2,transparent:true,opacity:0.85}));
  {const p=body.geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setX(i,p.getX(i)*(1+Math.sin(y*14)*0.12));}body.geometry.computeVertexNormals();}
  pb.add(body);const pn=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.19,0.22,12),body.material);pn.position.y=0.5;pb.add(pn);
  const pc=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.1,12),std(0xd23d2c));pc.position.y=0.65;pb.add(pc);pb.rotation.z=-0.45;
  // parts: a steel gear with a bolt
  const gear=new THREE.Group(),steel=std(0xaeb6be,{metalness:0.45,roughness:0.38});
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.16,28),steel);gear.add(disc);
  for(let i=0;i<10;i++){const t=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.16,0.14),steel);const a=i/10*Math.PI*2;t.position.set(Math.cos(a)*0.47,0,Math.sin(a)*0.47);t.rotation.y=-a;gear.add(t);}
  const hole=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.18,16),std(0x262b30));gear.add(hole);
  const bolt=new THREE.Group();bolt.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.12,6),std(0xc9a24a,{metalness:0.8,roughness:0.3})));
  const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.5,10),std(0xc9a24a,{metalness:0.8,roughness:0.35}));sh.position.y=-0.3;bolt.add(sh);
  bolt.position.set(0.3,0.3,0.25);bolt.rotation.set(0.5,0,-0.6);gear.add(bolt);gear.rotation.set(0.6,0,-0.5);
  const wood=fitModel('survival/resource-planks',1,null,null);
  // health: a glossy red heart with bevelled edges
  const hs=new THREE.Shape();
  hs.moveTo(0,-0.9);hs.bezierCurveTo(-0.15,-0.7,-1,-0.2,-1,0.35);hs.bezierCurveTo(-1,0.8,-0.6,1.05,-0.32,1.05);
  hs.bezierCurveTo(-0.12,1.05,0,0.9,0,0.72);hs.bezierCurveTo(0,0.9,0.12,1.05,0.32,1.05);
  hs.bezierCurveTo(0.6,1.05,1,0.8,1,0.35);hs.bezierCurveTo(1,-0.2,0.15,-0.7,0,-0.9);
  const hg=new THREE.ExtrudeGeometry(hs,{depth:0.32,bevelEnabled:true,bevelThickness:0.18,bevelSize:0.16,bevelSegments:6,curveSegments:24});hg.center();
  const heart=new THREE.Mesh(hg,new THREE.MeshPhysicalMaterial({color:0xd8322a,roughness:0.22,clearcoat:1,clearcoatRoughness:0.15,sheen:0.3}));
  const out={food:shot(can),water:shot(jug),bottles:shot(pb),misc:shot(gear),wood:shot(wood),heart:shot(heart,new V3(0.25,0.15,1))};
  r.dispose();r.forceContextLoss();
  return out;
}

// screen projection helpers used by the 2D overlay and the game logic
const _p=new V3();
function project(x,y,z){_p.set(x*U,(z||0)*U,y*U).project(camera);if(_p.z>1)return [-9999,-9999];return [(_p.x+1)/2*W,(1-_p.y)/2*H];}
const _ray=new THREE.Raycaster(),_plane=new THREE.Plane(new V3(0,1,0),0),_hit=new V3();
function unproject(sx,sy){_ray.setFromCamera(new THREE.Vector2(sx/W*2-1,-(sy/H)*2+1),camera);
  if(!_ray.ray.intersectPlane(_plane,_hit)){_hit.copy(_ray.ray.direction).multiplyScalar(400).add(_ray.ray.origin);}return [_hit.x/U,_hit.z/U];}

await loadModels();
fit();
try{setHudIcons(makeIcons());}catch(e){console.warn('HUD icons',e);}
window.R3D={render,project,unproject,debug:{scene,water,boatRoot,LIB,THREE}}; // debug handles for console testing
