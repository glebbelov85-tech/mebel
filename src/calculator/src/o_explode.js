// ================= РАЗБОР ПО ДЕТАЛЯМ (3D) =================
// Изделие разлетается на детали: каждую можно нажать (меню, размер), приблизить и потянуть в сторону.
// Перетаскивание только для просмотра - размеры и положение деталей в проекте не меняются. "Собрать" - всё на место.
const EXP={on:false, amt:0, drag:{}, n:-1};
function expToggle(){
  EXP.on=!EXP.on;
  if(!EXP.on) EXP.drag={};
  if(R3 && EXP.on) R3.fitAfterExp=true;
  drawSketch();
  toast(EXP.on?"Детали разобраны. Нажмите на деталь - меню, тяните - подвинуть, \"Приблизить\" - крупно":"Собрано");
}
// направление разлёта: от центра изделия + вдоль толщины детали (фасады - вперёд)
function expPrepare(){
  if(!R3) return;
  const T=T3, ms=R3.grp.children; if(!ms.length) return;
  if(EXP.n!==CUR.parts.length){ EXP.drag={}; EXP.n=CUR.parts.length; }
  const box=new T.Box3(); ms.forEach(m=>box.expandByPoint(m.userData.base));
  const c=box.getCenter(new T.Vector3()), s=box.getSize(new T.Vector3()), R=Math.max(s.x,s.y,s.z,600);
  ms.forEach(m=>{
    const v=m.userData.base.clone().sub(c), d=new T.Vector3(v.x*0.55,v.y*0.45,v.z*0.55);
    const ax={X:"x",Y:"y",Z:"z"}[m.userData.o], sg=Math.sign(v[ax])||1;
    d[ax]+=sg*R*(m.userData.f?0.45:0.18);
    m.userData.dir=d;
  });
  expApply();
}
function expApply(){
  if(!R3) return;
  R3.grp.children.forEach(m=>{ const u=m.userData; if(!u.base) return; m.position.copy(u.base); if(u.dir) m.position.addScaledVector(u.dir,EXP.amt); const g=EXP.drag[u.i]; if(g&&EXP.amt>0) m.position.add(g); });
}
function expTick(){
  const goal=EXP.on?1:0;
  if(Math.abs(EXP.amt-goal)>0.001){ EXP.amt+= (goal-EXP.amt)*0.18; if(Math.abs(EXP.amt-goal)<0.01) EXP.amt=goal; expApply(); if(EXP.amt===goal && R3.fitAfterExp){ R3.fitAfterExp=false; fit3d(); } }
  const tw=R3&&R3.tween;
  if(tw){ const k=Math.min(1,(performance.now()-tw.t0)/350), e=k*(2-k);
    R3.cam.position.lerpVectors(tw.p0,tw.p1,e); R3.ctl.target.lerpVectors(tw.c0,tw.c1,e); if(k>=1) R3.tween=null; }
}
// приблизить деталь (камера плавно подлетает)
function zoomPart(i){
  if(!R3||!T3) return;
  const m=R3.grp.children.find(o=>o.userData.i===i); if(!m) return;
  const T=T3, b=new T.Box3().setFromObject(m), c=b.getCenter(new T.Vector3()), s=b.getSize(new T.Vector3()), r=Math.max(s.x,s.y,s.z,250);
  const dir=R3.cam.position.clone().sub(R3.ctl.target).normalize();
  R3.tween={t0:performance.now(), p0:R3.cam.position.clone(), c0:R3.ctl.target.clone(), p1:c.clone().addScaledVector(dir,r*1.9), c1:c};
}
// перетаскивание детали в разобранном виде
function initExpDrag(){
  const host=$("u3d"); let dr=null;
  host.addEventListener("pointerdown",e=>{
    if(!EXP.on||!R3||(e.pointerType==="mouse"&&e.button!==0)) return;
    const h=hit3d(e); if(h.i<0) return;
    const m=R3.grp.children.find(o=>o.userData.i===h.i), T=T3;
    const n=R3.cam.getWorldDirection(new T.Vector3()), pl=new T.Plane().setFromNormalAndCoplanarPoint(n,m.position.clone());
    dr={i:h.i, m, pl, id:e.pointerId, x:e.clientX, y:e.clientY, on:false, start:rayOnPlane(e,pl), g0:(EXP.drag[h.i]||new T.Vector3()).clone()};
    R3.ctl.enabled=false;
  },true);
  host.addEventListener("pointermove",e=>{
    if(!dr||e.pointerId!==dr.id) return;
    if(!dr.on && Math.hypot(e.clientX-dr.x,e.clientY-dr.y)<6) return;
    dr.on=true; const p=rayOnPlane(e,dr.pl); if(!p||!dr.start) return;
    EXP.drag[dr.i]=dr.g0.clone().add(p.sub(dr.start)); expApply();
  },true);
  const end=e=>{ if(!dr||e.pointerId!==dr.id) return; dr=null; if(R3) R3.ctl.enabled=true; };
  host.addEventListener("pointerup",end,true); host.addEventListener("pointercancel",end,true);
  host.addEventListener("dblclick",e=>{ const h=hit3d(e); if(h.i>=0) zoomPart(h.i); });
}
function rayOnPlane(e,pl){
  const T=T3, rc=R3.r.domElement.getBoundingClientRect(), v=new T.Vector2(((e.clientX-rc.left)/rc.width)*2-1, -((e.clientY-rc.top)/rc.height)*2+1);
  const ray=new T.Raycaster(); ray.setFromCamera(v,R3.cam); return ray.ray.intersectPlane(pl,new T.Vector3());
}
