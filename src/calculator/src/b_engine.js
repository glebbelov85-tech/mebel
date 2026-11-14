// ================= ДВИЖОК ДЕТАЛЕЙ =================
// Деталь: {name, mat, o, x,y,z, a,b, edge, t?, f?, hd?, mod?, w?}
//  o - положение: X - вертикальная боковая (a - высота, b - глубина), Y - горизонтальная (a - ширина, b - глубина),
//      Z - фронтальная / задняя (a - ширина, b - высота)
//  x,y,z - левый нижний задний угол детали, мм. X - вправо, Y - вверх, Z - к себе (от стены)
//  edge - сколько сторон кромить (0-4), t - своя толщина (если не как у материала), f - это фасад,
//  hd - где ручка (для эскиза), mod - к какому модулю относится, w - у какой стены стоит (кухня)
const ORI = {X:"Вертикальная боковая (X)", Y:"Горизонтальная (Y)", Z:"Фронтальная / задняя (Z)"};
const ORI_AB = {X:["Высота","Глубина"], Y:["Ширина","Глубина"], Z:["Ширина","Высота"]};
const EDGES = {0:"Без кромки",1:"1 длинная",2:"2 длинные",3:"3 стороны",4:"Все 4"};
function thick(p){ return +p.t || MAT(p.mat).t; }
function dims(p){ const t=thick(p); return p.o==="X"?[t,p.a,p.b] : p.o==="Y"?[p.a,t,p.b] : [p.a,p.b,t]; }
function boxOf(p){ const [dx,dy,dz]=dims(p); return {x0:p.x,y0:p.y,z0:p.z,x1:p.x+dx,y1:p.y+dy,z1:p.z+dz}; }
function edgeLen(p){ const L=Math.max(p.a,p.b), S=Math.min(p.a,p.b); return ({0:0,1:L,2:2*L,3:2*L+S,4:2*(L+S)})[p.edge]||0; }
function hingesFor(h){ return h<=900?2 : h<=1600?3 : h<=2000?4 : 5; }
function isFac(p){ return !!p.f; }
function facEdge(mat){ return MAT(mat).kind==="sheet" ? 4 : 0; }
// деталь из габаритной коробки и положения
function fromBox(p,b,o){
  const q=Object.assign({},p,{o,x:b.x0,y:b.y0,z:b.z0});
  const dx=b.x1-b.x0, dy=b.y1-b.y0, dz=b.z1-b.z0;
  if(o==="X"){ q.a=dy; q.b=dz; } else if(o==="Y"){ q.a=dx; q.b=dz; } else { q.a=dx; q.b=dy; }
  return q;
}
// преобразования: сдвиг, зеркало, поворот в плане (перестановка X и Z)
const XF = {
  move:(dx,dy,dz)=>p=>Object.assign({},p,{x:p.x+dx,y:p.y+dy,z:p.z+dz}),
  mirrorX:L=>p=>{ const b=boxOf(p); return fromBox(p,Object.assign(b,{x0:L-b.x1,x1:L-b.x0}),p.o); },
  mirrorZ:L=>p=>{ const b=boxOf(p); return fromBox(p,Object.assign(b,{z0:L-b.z1,z1:L-b.z0}),p.o); },
  swapXZ:()=>p=>{ const b=boxOf(p); return fromBox(p,{x0:b.z0,x1:b.z1,y0:b.y0,y1:b.y1,z0:b.x0,z1:b.x1}, p.o==="X"?"Z":p.o==="Z"?"X":"Y"); }
};
const xform = (ps,...fns)=>ps.map(p=>fns.reduce((q,f)=>f(q),p));
function roundParts(ps){ ps.forEach(p=>["x","y","z","a","b"].forEach(k=>p[k]=r1(p[k]))); return ps; }
function bounds(ps){
  if(!ps.length) return {W:0,H:0,D:0,x0:0,y0:0,z0:0};
  const bs=ps.map(boxOf), mn=k=>Math.min(...bs.map(b=>b[k])), mx=k=>Math.max(...bs.map(b=>b[k]));
  const x0=mn("x0"), y0=mn("y0"), z0=mn("z0");
  return {x0,y0,z0, W:Math.round(mx("x1")-x0), H:Math.round(mx("y1")-y0), D:Math.round(mx("z1")-z0)};
}
// "Резиновый" размер: всё, что за серединой - сдвигается, всё, что пересекает середину - растягивается
function stretch(ps,axis,oldS,newS){
  const d=newS-oldS; if(!d) return ps.map(p=>Object.assign({},p));
  const k0=axis+"0", k1=axis+"1", mid=oldS/2;
  return ps.map(p=>{
    const b=boxOf(p), thickAxis={X:"x",Y:"y",Z:"z"}[p.o];
    if(b[k0]>=mid){ b[k0]+=d; b[k1]+=d; }
    else if(b[k1]>mid){ if(thickAxis===axis){ if((b[k0]+b[k1])/2>=mid){ b[k0]+=d; b[k1]+=d; } } else b[k1]+=d; }
    return fromBox(p,b,p.o);
  });
}

function Builder(){
  const ps=[], hw={};
  const add=(o,name,x,y,z,a,b,mat,edge,ex)=>{ const p=Object.assign({name,mat,o,x,y,z,a,b,edge},ex||{}); ps.push(p); return p; };
  return {ps,hw,
    X(name,x,y,z,h,d,mat="ldsp16",edge=1,ex){ return add("X",name,x,y,z,h,d,mat,edge,ex); },
    Y(name,x,y,z,w,d,mat="ldsp16",edge=1,ex){ return add("Y",name,x,y,z,w,d,mat,edge,ex); },
    Z(name,x,y,z,w,h,mat="ldsp16",edge,ex){ return add("Z",name,x,y,z,w,h,mat,edge===undefined?facEdge(mat):edge,ex); },
    H(id,q,name){ if(!(q>0)) return; const k=id+"|"+(name||""); if(!hw[k]) hw[k]={id,name:name||hwName(id),q:0}; hw[k].q+=q; }
  };
}
function mergeHw(...lists){
  const m={};
  lists.forEach(l=>l.forEach(h=>{ const k=(h.id||"")+"|"+h.name; if(!m[k]) m[k]=Object.assign({},h,{q:0}); m[k].q+=h.q; }));
  return Object.values(m);
}
function hwPrice(h){ return h.id && h.p===undefined ? (P[h.id]||0) : (+h.p||0); }

// Стоимость по деталям и фурнитуре. Возвращает строки [название, количество, сумма]
function costParts(parts,hw){
  const by={}, edges={}, order=PRICE.map(x=>x.id);
  parts.forEach(p=>{
    const m=MAT(p.mat); if(m.virt || !(p.a>0&&p.b>0)) return;
    const id=MATS[p.mat]?p.mat:"ldsp16";
    const r=by[id]||(by[id]={area:0,len:0,n:0,items:[],lens:[]});
    if(m.kind==="length") r.lens.push(Math.max(p.a,p.b));
    if(m.kind==="sheet") r.items.push({w:Math.max(p.a,p.b),h:Math.min(p.a,p.b),rot:!(m.t>4)});   // плиты толще 4 мм - с рисунком, деталь не поворачивается
    r.area+=p.a*p.b/1e6; r.len+=Math.max(p.a,p.b)/1000; r.n++;
    if(m.kind==="sheet" && m.edge && p.edge) edges[m.edge]=(edges[m.edge]||0)+edgeLen(p)/1000;
  });
  const rows=[], sheets={}, nest={}, slabs={}; let sheetsCut=0;
  Object.keys(by).sort((a,b)=>order.indexOf(a)-order.indexOf(b)).forEach(k=>{
    const m=MATS[k], v=by[k];
    if(m.kind==="sheet"){
      const u=m.usage?clamp(m.usage/100,0.5,0.98):useK();
      // листы: по раскрою (детали раскладываются на лист, как в общем формате заказа) или по площади и проценту
      let s=Math.ceil(v.area/(m.sw*m.sh/1e6*u)-1e-9), note="";
      if(P.nest && MO && MO.nestSheets){
        const ns=MO.nestSheets(v.items,{w:m.sw,h:m.sh},{kerf:4,trim:10}), over=ns.unplaced.reduce((a,x)=>a+x.w*x.h/1e6,0);
        s=ns.sheets+(over>0?Math.ceil(over/(m.sw*m.sh/1e6*u)-1e-9):0); note=`, по раскрою, лист занят на ${ns.usedPct}%`; nest[k]=ns;
      }
      sheets[k]=s; if(m.cut) sheetsCut+=s;
      rows.push([`${m.name} (${v.area.toFixed(2)} м²${note})`, s+" л.", s*P[k]]);
    }else if(m.kind==="area"){ const a=Math.round(v.area*100)/100; rows.push([m.name, a.toFixed(2)+" м²", Math.round(a*P[k])]); }   // как в общем формате: площадь до сотых
    else if(m.kind==="length"){
      // столешница с длиной плиты - целыми плитами, иначе по метрам
      const len=Math.round(v.len*100)/100;
      if(m.slab>0 && MO && MO.packLengths){ const n=MO.packLengths(v.lens,m.slab,4), L=Math.round(n*m.slab/10)/100; slabs[k]=n; rows.push([`${m.name} (${len} п.м., плит по ${m.slab/1000} м: ${n})`, L+" п.м.", Math.round(L*P[k])]); }
      else rows.push([m.name, len+" п.м.", Math.round(len*P[k])]);
    }
  });
  let edgeM=0;
  Object.keys(edges).forEach(id=>{ const mm=Math.ceil(edges[id]*1.1); edgeM+=mm; rows.push([hwName(id), mm+" м", mm*(P[id]||0)]); });
  if(sheetsCut) rows.push([hwName("cut"), sheetsCut+" л.", sheetsCut*P.cut]);
  (hw||[]).forEach(h=>{ if(h.q>0) rows.push([h.name, r1(h.q)+" "+(h.u||hwUnit(h.id)), h.q*hwPrice(h)]); });
  return {rows, by, sheets, edgeM, nest, slabs};
}
// Список на распил: одинаковые детали складываются
function cutList(parts){
  const g={};
  parts.forEach(p=>{
    const m=MAT(p.mat); if(m.virt || !(p.a>0&&p.b>0)) return;
    const L=Math.max(p.a,p.b), S=Math.min(p.a,p.b), e=m.kind==="sheet"?(+p.edge||0):0;
    const k=[p.mat,L,S,e,p.name.replace(/\s*\d+(\.\d+)?$/,"").replace(/^Ящик \d+: /,"Ящик: ")].join("|");
    if(!g[k]) g[k]={mat:p.mat,matName:m.name,name:k.split("|")[4],L,S,edge:e,q:0};
    g[k].q++;
  });
  const order=PRICE.map(x=>x.id);
  return Object.values(g).sort((a,b)=>order.indexOf(a.mat)-order.indexOf(b.mat) || b.L-a.L || b.S-a.S);
}
// Проверки, общие для всех изделий
function checkParts(parts,opt){
  const warns=[];
  parts.forEach((p,i)=>{
    const m=MAT(p.mat); if(m.virt) return;
    if(!(p.a>0&&p.b>0)){ warns.push(`Деталь ${i+1} "${esc(p.name)}": нулевой размер.`); return; }
    if(m.kind==="sheet" && !((p.a<=m.sw&&p.b<=m.sh)||(p.a<=m.sh&&p.b<=m.sw))) warns.push(`Деталь "${esc(p.name)}" ${p.a}×${p.b} не выходит из листа ${m.sw}×${m.sh}.`);
  });
  if(opt && opt.overlap){
    const bs=parts.map(boxOf); let ov=0;
    for(let i=0;i<bs.length && ov<6;i++) for(let j=i+1;j<bs.length && ov<6;j++){
      if(MAT(parts[i].mat).virt||MAT(parts[j].mat).virt) continue;
      const a=bs[i], c=bs[j], e=1;
      if(a.x0<c.x1-e && c.x0<a.x1-e && a.y0<c.y1-e && c.y0<a.y1-e && a.z0<c.z1-e && c.z0<a.z1-e){ warns.push(`Детали ${i+1} "${esc(parts[i].name)}" и ${j+1} "${esc(parts[j].name)}" пересекаются.`); ov++; }
    }
  }
  return warns;
}
