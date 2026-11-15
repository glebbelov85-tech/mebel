// ================= 3D (three.js, загружается только когда открыт вид 3D) =================
let R3=null, T3=null, t3p=null;
function need3(){
  return t3p || (t3p=Promise.all([import("three"),import("three/addons/controls/OrbitControls.js")]).then(([T,O])=>{ T3=T; T3OC=O.OrbitControls; return T; }));
}
let T3OC=null;
function show3d(){
  const host=$("u3d");
  if(T3){ build3d(); return; }
  if(!host.querySelector(".ld")) host.insertAdjacentHTML("beforeend",`<div class="ld">Загружаю 3D-модель...</div>`);
  need3().then(()=>{ const l=host.querySelector(".ld"); if(l) l.remove(); if(S.view[S.mode]==="3d" && PAGE==="calc") build3d(); })
    .catch(()=>{ t3p=null; const l=host.querySelector(".ld"); if(l) l.textContent="Не получилось загрузить 3D (нет интернета?). Остальные виды работают без него."; });
}
function init3d(){
  const host=$("u3d"), T=T3;
  const r=new T.WebGLRenderer({antialias:true}); r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  host.appendChild(r.domElement);
  const scene=new T.Scene(); scene.background=new T.Color(0xf6f2ec);
  const cam=new T.PerspectiveCamera(40,1,10,80000);
  const ctl=new T3OC(cam,r.domElement); ctl.enableDamping=true;
  scene.add(new T.AmbientLight(0xffffff,1.7));
  const dl=new T.DirectionalLight(0xffffff,1.7); dl.position.set(1,2,1.6); scene.add(dl);
  const dl2=new T.DirectionalLight(0xffffff,0.7); dl2.position.set(-1.5,0.6,1); scene.add(dl2);
  const grp=new T.Group(); scene.add(grp);
  const room=new T.Group(); scene.add(room);
  scene.add(new T.AxesHelper(400));
  R3={r,scene,cam,ctl,grp,room,host,needFit:true};
  (function loop(){ requestAnimationFrame(loop); if(host.offsetParent===null) return; expTick(); ctl.update(); r.render(scene,cam); })();
  window.addEventListener("resize",size3d);
  const ray=new T.Raycaster(), mv=new T.Vector2(); let down=null;
  r.domElement.addEventListener("pointerdown",e=>down=[e.clientX,e.clientY,performance.now()]);
  r.domElement.addEventListener("pointerup",e=>{
    // правая кнопка и долгое нажатие открывают меню (n_menu.js), а не выделяют
    if(!down||e.button===2||performance.now()-down[2]>500||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6) return;
    const rc=r.domElement.getBoundingClientRect();
    mv.x=((e.clientX-rc.left)/rc.width)*2-1; mv.y=-((e.clientY-rc.top)/rc.height)*2+1;
    ray.setFromCamera(mv,cam);
    const hit=ray.intersectObjects(grp.children,false)[0];
    if(hit) selectPart(hit.object.userData.i);
  });
}
function size3d(){ if(!R3) return; const w=R3.host.clientWidth||600, h=R3.host.clientHeight||440; R3.r.setSize(w,h); R3.cam.aspect=w/h; R3.cam.updateProjectionMatrix(); }
function clear3(g){ while(g.children.length){ const c=g.children.pop(); c.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); } }
function build3d(){
  if(!T3) return;
  if(!R3) init3d();
  size3d();
  const T=T3, g=R3.grp; clear3(g); clear3(R3.room);
  const lineMat=()=>new T.LineBasicMaterial({color:0x6b5a4a});
  CUR.parts.forEach((p,i)=>{
    if(S.hideFac && p.f) return;
    const [dx,dy,dz]=dims(p); if(!(dx>0&&dy>0&&dz>0)) return;
    const m=MAT(p.mat), sel=i===SEL.part, msel=!sel && SEL.mod && p.mod===SEL.mod;
    if(p.mat==="_metal" && p.t<=2 && !sel) return;                 // рамка профиля двери - только контур в 2D
    const geo=new T.BoxGeometry(dx,dy,dz);
    const glassy=/^mirror/.test(p.mat);
    const mat=new T.MeshLambertMaterial({color:sel?0xff9a3c:msel?0xffcf9e:m.css, transparent:glassy||p.mat==="_apron", opacity:glassy?0.8:p.mat==="_apron"?0.6:1});
    const mesh=new T.Mesh(geo,mat); mesh.position.set(p.x+dx/2,p.y+dy/2,p.z+dz/2); mesh.userData.i=i; mesh.userData.base=mesh.position.clone(); mesh.userData.o=p.o; mesh.userData.f=!!p.f;
    mesh.add(new T.LineSegments(new T.EdgesGeometry(geo),lineMat()));
    g.add(mesh);
  });
  expPrepare();
  // пол и стены
  const bb=bounds(CUR.parts), R=Math.max(bb.W,bb.D,1500), wallMat=()=>new T.MeshBasicMaterial({color:0xe9e2d8,side:T.DoubleSide,transparent:true,opacity:0.55});
  const grid=new T.GridHelper(Math.ceil(R*2.4/1000)*1000,Math.ceil(R*2.4/1000)*5,0xcdbfb0,0xe4dbd0); grid.position.set(bb.x0+bb.W/2,0,bb.z0+bb.D/2); R3.room.add(grid);
  if(CUR.type==="kitchen"){
    const info=CUR.info, Hw=Math.max(2500,bb.H+250);
    const wall=(w,x,z,ry)=>{ const pl=new T.Mesh(new T.PlaneGeometry(w,Hw),wallMat()); pl.position.set(x,Hw/2,z); pl.rotation.y=ry; R3.room.add(pl); };
    wall(info.L[0],info.L[0]/2,-2,0);
    if(info.has.R) wall(info.L[1],info.L[0]+2,info.L[1]/2,Math.PI/2);
    if(info.has.L) wall(info.L[2],-2,info.L[2]/2,Math.PI/2);
  }
  if(R3.needFit) fit3d();
}
function fit3d(){
  if(!R3) return;
  const T=T3, box=new T.Box3().setFromObject(R3.grp);
  if(box.isEmpty()) return;
  const c=box.getCenter(new T.Vector3()), s=box.getSize(new T.Vector3()), r=Math.max(s.x,s.y,s.z);
  let k=[0.9,0.55,1.7];
  if(CUR.type==="kitchen"){ const h=CUR.info.has; k = h.R&&!h.L ? [-0.8,0.7,1.5] : h.L&&!h.R ? [0.8,0.7,1.5] : [0.2,0.75,1.6]; }
  R3.cam.position.set(c.x+r*k[0],c.y+r*k[1],c.z+r*k[2]); R3.ctl.target.copy(c); R3.ctl.update();
  R3.needFit=false;
}
