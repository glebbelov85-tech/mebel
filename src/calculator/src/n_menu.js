// ================= ОТМЕНА, ТИПОВЫЕ ДЕТАЛИ, МЕНЮ ПО ПРАВОМУ КЛИКУ / ДОЛГОМУ НАЖАТИЮ =================
// Отмена общая с голосовыми правками (ED.undo): кнопка "Отменить", "Вернуть" в подсказке после удаления, Ctrl+Z, фраза "отмени".
function snapUndo(){
  ED.undo.push({s:JSON.stringify(S),p:JSON.stringify(PRICE)}); if(ED.undo.length>40) ED.undo.shift();
  if(ED.desc) ED.desc.live=false;
  updUndo();
}
function menuRefresh(){
  refreshBinds();
  if(S.mode==="kupe") renderKupeForm(); else if(S.mode==="kitchen") renderKitchenForm(); else if(S.mode==="univ") renderUniv();
  renderExtras(); calc(); updUndo();
}
function undoLast(){
  closePMenu(); hideToastA();
  const r=edUndo();
  if(!r.ok){ toast("Отменять нечего"); updUndo(); return; }
  menuRefresh(); toast("Отменено - вернул как было до последнего изменения");
}
function updUndo(){ const b=$("u_undo"); if(b) b.disabled=!ED.undo.length; }

// подсказка с кнопкой ("Убрано: Дверь 2 · Вернуть")
function toastA(text,btn,fn){
  let e=$("toastA");
  if(!e){ e=document.createElement("div"); e.id="toastA"; e.className="toasta"; document.body.appendChild(e); }
  e.innerHTML=`<span>${esc(text)}</span>${btn?`<button type="button">${esc(btn)}</button>`:""}<button type="button" class="tx" title="Закрыть">&times;</button>`;
  if(btn) e.querySelector("button").onclick=()=>{ hideToastA(); fn(); };
  e.querySelector(".tx").onclick=hideToastA;
  e.classList.add("on"); clearTimeout(toastA.t); toastA.t=setTimeout(hideToastA,8000);
}
function hideToastA(){ const e=$("toastA"); if(e) e.classList.remove("on"); }

// ---------- фурнитура, которая идёт вместе с деталью ----------
const isDoor=p=>p && p.o==="Z" && /^Дверь/i.test(p.name||"");
const drawerNo=p=>{ const m=String(p&&p.name||"").match(/^(?:Фасад ящика|Ящик) (\d+)/); return m?+m[1]:0; };
// петли, ручки и направляющие считаем заново по дверям и ящикам
function hwSync(){
  const u=S.u, doors=u.panels.filter(isDoor), drs=u.panels.filter(p=>/^Фасад ящика/.test(p.name||""));
  const want={hinge:doors.reduce((s,d)=>s+hingesFor(d.b),0), handle:doors.length+drs.length, kguide:drs.length};
  Object.keys(want).forEach(id=>{
    let h=u.hw.find(x=>x.id===id);
    if(!h){ if(!want[id]) return; h={id,name:hwName(id),q:0}; u.hw.push(h); }
    h.q=want[id];
  });
}
// ---------- геометрия корпуса "Любого изделия" по деталям ----------
function bodyGeo(){
  const ps=S.u.panels, body=ps.filter(p=>!p.f && !MAT(p.mat).virt && p.mat!=="dvp");
  if(!body.length) return null;
  const bs=body.map(boxOf), mn=k=>Math.min(...bs.map(b=>b[k])), mx=k=>Math.max(...bs.map(b=>b[k]));
  const side=body.find(p=>p.o==="X"), mat=side?side.mat:body[0].mat, T=thick(side||body[0]);
  const x0=mn("x0"), x1=mx("x1"), y0=mn("y0"), y1=mx("y1"), z0=mn("z0"), zf=mx("z1");
  const facs=ps.filter(p=>p.f), fac=(facs.find(isDoor)||facs[0]||{}).mat || (S.u.prms[S.u.tpl]||{}).fac || "mdf";
  // горизонтальные детали на всю внутреннюю ширину: дно, крыша, полки
  const hor=body.filter(p=>p.o==="Y" && p.a>=(x1-x0-2*T)*0.6).map(boxOf).sort((a,b)=>a.y0-b.y0);
  const bottom=hor.length?hor[0]:{y0:y0,y1:y0+T}, roof=hor.length>1?hor[hor.length-1]:{y0:y1-T,y1:y1};
  return {x0,x1,y0,y1,z0,zf,T,mat,fac,hor,bottom,roof,W:x1-x0,H:y1-y0};
}
// свободный по горизонтали участок фасада в полосе высот [ya,yb]
function frontGaps(g,ya,yb){
  const iv=S.u.panels.filter(p=>p.f && p.o==="Z").map(boxOf).filter(b=>Math.min(b.y1,yb)-Math.max(b.y0,ya)>(yb-ya)*0.3).map(b=>[b.x0,b.x1]).sort((a,b)=>a[0]-b[0]);
  const gaps=[]; let x=g.x0;
  iv.forEach(([a,b])=>{ if(a-x>=100) gaps.push([x,a]); x=Math.max(x,b); });
  if(g.x1-x>=100) gaps.push([x,g.x1]);
  return gaps;
}
function freeNo(re){ const used=new Set(); S.u.panels.forEach(p=>{ const m=String(p.name||"").match(re); if(m) used.add(+m[1]); }); let n=1; while(used.has(n)) n++; return n; }
function nextNo(re){ let n=0; S.u.panels.forEach(p=>{ const m=String(p.name||"").match(re); if(m) n=Math.max(n,+m[1]); }); return n+1; }
function frontBand(g){
  // где начинаются двери: над ящиками, если они есть
  const dr=S.u.panels.filter(p=>p.f && /^Фасад ящика/.test(p.name||"")).map(boxOf);
  const ys=dr.length?Math.max(...dr.map(b=>b.y1))+1.5:g.y0;
  return [ys,g.y1];
}

// ---------- типовые детали ----------
function addDoor(atX){
  const g=bodyGeo(); if(!g) return "Сначала нужен корпус - выберите шаблон и нажмите \"Перестроить по шаблону\".";
  const u=S.u, [ya,yb]=frontBand(g);
  const doors=u.panels.filter(isDoor), ref=doors[0];
  const dy=ref?ref.y:ya+1.5, dh=ref?ref.b:yb-ya-3, dz=ref?ref.z:g.zf;
  let gaps=frontGaps(g,dy,dy+dh);
  if(atX!=null){ const gg=gaps.find(([a,b])=>atX>=a&&atX<=b); if(gg) gaps=[gg]; }
  if(!gaps.length){
    // места нет: одну широкую дверь делим на две
    const wide=doors.filter(d=>d.a>=500).sort((a,b)=>b.a-a.a)[0];
    if(!wide) return "Для новой двери нет места. Уберите или сузьте другую дверь.";
    snapUndo();
    const w=Math.round((wide.a+1.5)/2-1.5), c=clone(wide);
    wide.a=w; wide.hd="vm-r"; c.a=w; c.x=r1(wide.x+w+3); c.hd="vm-l"; c.name=`Дверь ${freeNo(/^Дверь (\d+)/)}`;
    u.panels.splice(u.panels.indexOf(wide)+1,0,c); hwSync();
    return {i:u.panels.indexOf(c), msg:"Разделил дверь на две половины"};
  }
  const [a,b]=gaps.sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]))[0];
  snapUndo();
  const name=`Дверь ${freeNo(/^Дверь (\d+)/)}`;
  const xa=a+(a>g.x0+1?3:1.5), xb=b-(b<g.x1-1?3:1.5);
  const d={name,mat:g.fac,o:"Z",x:r1(xa),y:r1(dy),z:r1(dz),a:r1(xb-xa),b:r1(dh),edge:facEdge(g.fac),f:1,hd:(a+b)/2>(g.x0+g.x1)/2?"vm-l":"vm-r"};
  // встаёт в списке рядом с другими дверями
  const last=u.panels.reduce((k,p,i)=>isDoor(p)?i:k,-1), at=last>=0?last+1:u.panels.length;
  u.panels.splice(at,0,d); hwSync();
  return {i:at, msg:`Поставил: ${name}, ${d.a}×${d.b} мм. Петли и ручка добавлены.`};
}
function addShelf(atY){
  const g=bodyGeo(); if(!g) return "Сначала нужен корпус - выберите шаблон и нажмите \"Перестроить по шаблону\".";
  const u=S.u, hor=g.hor;
  if(hor.length<2) return "Не нашёл дно и крышу, куда ставить полку. Добавьте \"Свою деталь\".";
  // промежутки между горизонтальными деталями; берём тот, куда нажали, иначе самый большой
  const gaps=[]; for(let k=1;k<hor.length;k++) if(hor[k].y0-hor[k-1].y1>=120) gaps.push([hor[k-1].y1,hor[k].y0]);
  if(!gaps.length) return "Полке негде встать: расстояние между полками меньше 12 см.";
  let gp=atY!=null && gaps.find(([a,b])=>atY>=a&&atY<=b); if(!gp) gp=gaps.sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]))[0];
  const ref=u.panels.find(p=>p.o==="Y" && /^Полка/.test(p.name||"")) || {};
  const y=atY!=null&&atY>=gp[0]+40&&atY<=gp[1]-40-g.T ? atY : (gp[0]+gp[1]-g.T)/2;
  const z=ref.z!=null?ref.z:g.z0, depth=ref.b||Math.max(100,g.zf-g.z0-20);
  snapUndo();
  const name=`Полка ${nextNo(/^Полка (\d+)/)}`;
  const sh={name,mat:ref.mat||g.mat,o:"Y",x:r1(g.x0+g.T),y:Math.round(y),z:r1(z),a:r1(g.W-2*g.T),b:r1(depth),edge:1};
  const last=u.panels.reduce((k,p,i)=>/^Полка/.test(p.name||"")?i:k,-1), at=last>=0?last+1:u.panels.length;
  u.panels.splice(at,0,sh);
  return {i:at, msg:`Поставил: ${name} на высоте ${sh.y} мм`};
}
function addPartition(atX){
  const g=bodyGeo(); if(!g) return "Сначала нужен корпус - выберите шаблон и нажмите \"Перестроить по шаблону\".";
  const u=S.u, xs=u.panels.filter(p=>p.o==="X" && !p.f && p.a>=g.H*0.5).map(boxOf).sort((a,b)=>a.x0-b.x0);
  const secs=[]; for(let k=1;k<xs.length;k++) if(xs[k].x0-xs[k-1].x1>=200) secs.push([xs[k-1].x1,xs[k].x0]);
  if(!secs.length) return "Для перегородки нет места.";
  let s=atX!=null && secs.find(([a,b])=>atX>=a&&atX<=b); if(!s) s=secs.sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]))[0];
  const ya=g.bottom.y1, yb=g.roof.y0, side=u.panels.find(p=>p.o==="X"&&!p.f)||{};
  snapUndo();
  const name=`Перегородка ${nextNo(/^Перегородка (\d+)/)}`;
  const p={name,mat:g.mat,o:"X",x:Math.round((s[0]+s[1]-g.T)/2),y:r1(ya),z:r1(side.z!=null?side.z:g.z0),a:r1(yb-ya),b:r1(side.b||g.zf-g.z0),edge:1};
  u.panels.push(p);
  return {i:u.panels.length-1, msg:`Поставил: ${name}. Полки остались во всю ширину - поправьте их длину, если нужно.`};
}
function addDrawer(){
  const g=bodyGeo(); if(!g) return "Сначала нужен корпус - выберите шаблон и нажмите \"Перестроить по шаблону\".";
  const u=S.u, facs=u.panels.filter(p=>p.f && /^Фасад ящика/.test(p.name||""));
  const DH=facs.length?Math.round(facs[0].b+3):180, base=facs.length?Math.max(...facs.map(p=>p.y+p.b))+1.5:g.bottom.y0;
  if(base+DH>g.roof.y0) return "Ящику не хватает высоты.";
  snapUndo();
  const k=nextNo(/^(?:Фасад ящика|Ящик) (\d+)/), T=g.T, x0=g.x0, W=g.W, Dk=g.zf-g.z0, z0=g.z0;
  const bx=x0+T+13, bw=W-2*T-26, bh=Math.max(60,DH-60), bd=Math.max(150,Dk-60), y=base;
  const P=(name,o,x,yy,z,a,b,mat,edge,ex)=>Object.assign({name,mat,o,x:r1(x),y:r1(yy),z:r1(z),a:r1(a),b:r1(b),edge},ex||{});
  const fac=P(`Фасад ящика ${k}`,"Z",x0+1.5,y+1.5,g.zf,W-3,DH-3,g.fac,facEdge(g.fac),{f:1,hd:"t"});
  const add=[fac,
    P(`Ящик ${k}: бок`,"X",bx,y+30,z0+50,bh,bd,g.mat,1), P(`Ящик ${k}: бок`,"X",bx+bw-T,y+30,z0+50,bh,bd,g.mat,1),
    P(`Ящик ${k}: перед`,"Z",bx+T,y+30,z0+Dk-10-T,bw-2*T,bh,g.mat,1), P(`Ящик ${k}: зад`,"Z",bx+T,y+30,z0+50,bw-2*T,bh,g.mat,1),
    P(`Ящик ${k}: дно`,"Y",bx,y+27,z0+50,bw,bd,"dvp",0)];
  // двери, которые закрывали это место, становятся короче снизу
  let cut=0; const top=base+DH;
  u.panels.filter(isDoor).forEach(d=>{ if(d.y<top && d.y+d.b>top+100){ const t=d.y+d.b; d.y=r1(top+1.5); d.b=r1(t-d.y); cut++; } });
  // полки, попавшие внутрь ящика, поднимаем над ним
  u.panels.filter(p=>p.o==="Y" && /^Полка/.test(p.name||"") && p.y>=base-1 && p.y<top).forEach(p=>p.y=r1(top+2));
  const last=u.panels.reduce((q,p,i)=>drawerNo(p)?i:q,-1), at=last>=0?last+1:u.panels.length;
  u.panels.splice(at,0,...add); hwSync();
  return {i:at, msg:`Добавил ящик ${k} (высота ${DH} мм)`+(cut?", двери стали короче":"")+". Направляющие и ручка в фурнитуре."};
}
function addCustom(){
  snapUndo();
  const g=bodyGeo(), p={name:"Новая деталь",mat:g?g.mat:"ldsp16",o:"Y",x:0,y:0,z:0,a:600,b:400,edge:1};
  S.u.panels.push(p); return {i:S.u.panels.length-1, msg:"Добавлена деталь 600×400 - впишите размеры и положение"};
}
function removePart(i,whole){
  const u=S.u, p=u.panels[i]; if(!p) return;
  snapUndo();
  let gone=[p], label=p.name;
  if(whole && drawerNo(p)){ const k=drawerNo(p); gone=u.panels.filter(q=>drawerNo(q)===k); label=`Ящик ${k} целиком`; }
  u.panels=u.panels.filter(q=>!gone.includes(q));
  if(gone.some(q=>isDoor(q)||/^Фасад ящика/.test(q.name||""))) hwSync();
  SEL.part=-1; markManual(); renderPanels(); renderHw(); calc(); updUndo();
  toastA(`Убрано: ${label}`,"Вернуть",undoLast);
}
function dupPart(i){
  const u=S.u; snapUndo();
  const c=clone(u.panels[i]); c.name+=" (копия)"; c.y+=100; u.panels.splice(i+1,0,c); SEL.part=i+1; markManual(); renderPanels(); calc(); updUndo();
}
function applyAdd(r){
  if(typeof r==="string"){ toast(r); return; }
  SEL.part=r.i; markManual(); renderPanels(); renderHw(); calc(); updUndo();
  toastA(r.msg,"Отменить",undoLast);
  const c=$("pc"+r.i); if(c && window.matchMedia("(min-width:940px)").matches) c.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function rebuildAsWas(){
  closePMenu();
  confirmBox("Вернуть изделие как было по шаблону? Все ручные правки деталей пропадут (их можно будет отменить).","Вернуть как было",()=>{ snapUndo(); buildFromTpl(); updUndo(); toastA("Изделие собрано заново по шаблону","Отменить",undoLast); });
}
// окно "Добавить деталь"
function openAddPart(){
  const it=(k,ic,t,s)=>`<button class="addp" data-add="${k}"><span class="ai">${ic}</span><b>${t}</b><small>${s}</small></button>`;
  openModal("Добавить деталь",`<div class="addgrid">
    ${it("door","&#128682;","Дверь","встанет туда, где двери нет; петли и ручка добавятся")}
    ${it("shelf","&#9636;","Полка","в самый большой промежуток")}
    ${it("drawer","&#9707;","Ящик","снизу, с направляющими и ручкой")}
    ${it("part","&#9475;","Перегородка","посередине самой широкой секции")}
    ${it("custom","&#9633;","Своя деталь","лист 600×400, размеры впишете сами")}
  </div><p class="note">Подсказка: правый клик мышью (на телефоне - долгое нажатие) по детали в 3D или на чертеже открывает меню: убрать, поставить дверь, полку, ящик.</p>`,()=>{
    $("modal").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{ closeModal(); addByKind(b.dataset.add); });
  });
}
function addByKind(k,at){
  at=at||{};
  const r = k==="door"?addDoor(at.x) : k==="shelf"?addShelf(at.y) : k==="drawer"?addDrawer() : k==="part"?addPartition(at.x) : addCustom();
  applyAdd(r);
}

// ---------- всплывающее меню ----------
function closePMenu(){ const m=$("pmenu"); if(m) m.remove(); }
let PM_3D=-1;
function showPMenu(x,y,title,sub,items){
  closePMenu();
  // в 3D: приблизить деталь, разобрать/собрать
  if(PM_3D!==-1){ const zi=PM_3D; items=[zi>=0?{t:"Приблизить эту деталь",fn:()=>zoomPart(zi)}:null, {t:EXP.on?"Собрать изделие":"Разобрать по деталям",fn:expToggle}, "-", ...items]; PM_3D=-1; }
  const m=document.createElement("div"); m.id="pmenu"; m.className="pmenu";
  m.innerHTML=`<div class="pmh"><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:""}</div>`+
    items.filter(Boolean).map((it,k)=>it==="-"?`<hr>`:`<button type="button" data-k="${k}" class="${it.danger?"dng":""}" ${it.off?"disabled":""}>${esc(it.t)}</button>`).join("")+
    `<button type="button" class="pmx" data-x="1">Закрыть</button>`;
  document.body.appendChild(m);
  const list=items.filter(Boolean);
  m.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; if(b.dataset.x){ closePMenu(); return; } const it=list[+b.dataset.k]; closePMenu(); if(it&&it.fn) it.fn(); });
  const narrow=window.innerWidth<600;
  if(narrow) m.classList.add("sheet");
  else {
    const w=m.offsetWidth, h=m.offsetHeight;
    m.style.left=Math.max(6,Math.min(x,window.innerWidth-w-6))+"px";
    m.style.top=Math.max(6,Math.min(y,window.innerHeight-h-6))+"px";
  }
}
document.addEventListener("pointerdown",e=>{ const m=$("pmenu"); if(m && !m.contains(e.target)) closePMenu(); },true);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape") closePMenu();
  if((e.ctrlKey||e.metaKey) && !e.shiftKey && (e.key==="z"||e.key==="я"||e.code==="KeyZ") && PAGE==="calc"){
    const t=e.target; if(t && (t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable)) return;
    e.preventDefault(); undoLast();
  }
});

// меню по детали (i - номер в CUR.parts или -1, если нажали мимо деталей); at - точка в мм {x,y}, если известна
function openPartMenu(i,cx,cy,at,mod){
  if(PAGE!=="calc" || !CUR) return;
  at=at||{};
  PM_3D = S.view[S.mode]==="3d" ? (CUR.parts[i]?i:-2) : -1;
  const p=CUR.parts[i] || (mod?{mod}:null), undo={t:"Отменить последнее", fn:undoLast, off:!ED.undo.length};
  if(S.mode==="univ") return univMenu(i,p,cx,cy,at,undo);
  if(S.mode==="kitchen") return kitMenu(p,cx,cy,undo);
  if(S.mode==="kupe") return kupeMenu(p,cx,cy,undo);
}
function univMenu(i,p,cx,cy,at,undo){
  const u=S.u;
  if(p){ SEL.part=i; SEL.mod=null; renderPanels(); drawSketch(); }
  const items=[];
  if(p){
    items.push({t:"Убрать эту деталь", danger:1, fn:()=>removePart(i)});
    if(drawerNo(p)) items.push({t:"Убрать ящик целиком", danger:1, fn:()=>removePart(i,true)});
    items.push({t:"Сделать копию", fn:()=>dupPart(i)});
    items.push("-");
  }
  items.push({t:"Поставить дверь", fn:()=>addByKind("door",at)});
  items.push({t:at.y!=null?"Добавить полку сюда":"Добавить полку", fn:()=>addByKind("shelf",at)});
  items.push({t:"Добавить ящик", fn:()=>addByKind("drawer")});
  items.push({t:"Добавить перегородку", fn:()=>addByKind("part",at)});
  items.push("-", undo);
  if(u.manual && u.tpl!=="empty") items.push({t:"Вернуть как было (по шаблону)", fn:rebuildAsWas});
  showPMenu(cx,cy,p?p.name:"Изделие",p?`${matName(p.mat)} · ${p.a}×${p.b} мм`:"",items);
}
function kitMenu(p,cx,cy,undo){
  const key=p&&p.mod, m=key&&String(key).match(/^(\d)([lu])(\d+)$/);
  if(!m){
    if(key && /^c/.test(key)) return showPMenu(cx,cy,"Угловой модуль","",[{t:"Настроить угол",fn:()=>{ const c=$("cornersCard"); if(c) c.scrollIntoView({behavior:"smooth",block:"start"}); }},"-",undo]);
    return showPMenu(cx,cy,"Кухня","",[undo]);
  }
  const wi=+m[1], row=m[2]==="l"?"lower":"upper", j=+m[3], list=S.kit.walls[wi][row], md=list[j];
  if(!md) return;
  const d=modDef(md.t)||{name:md.t};
  SEL.mod=key; SEL.part=CUR.parts.indexOf(p); markFormSel(false); drawSketch();
  const act=(a)=>()=>{ wallAct(a,wi,row,j); updUndo(); };
  const setT=t=>{ snapUndo(); md.t=t; renderWalls(); calc(); updUndo(); toastA(`Поставил: ${modDef(t).name}`,"Отменить",undoLast); };
  const items=[{t:"Заменить на другой...", fn:()=>openPicker(row,setT)}];
  if(row==="upper" && md.t==="u_open") items.push({t:"Поставить дверцы", fn:()=>setT("u_shelf")});
  else if(row==="upper" && !d.gap && md.t!=="u_fill") items.push({t:"Убрать дверцы (открытая полка)", fn:()=>setT("u_open")});
  if(row==="lower" && !d.gap && !d.drawers && md.t!=="l_fill") items.push({t:"Сделать ящики", fn:()=>setT("l_dr3")});
  if(row==="lower" && d.drawers) items.push({t:"Сделать с дверцами", fn:()=>setT("l_shelf")});
  items.push({t:"Шире на 5 см", fn:()=>{ snapUndo(); md.w=Math.min(1500,(+md.w||0)+50); renderWalls(); calc(); updUndo(); }});
  items.push({t:"Уже на 5 см", fn:()=>{ snapUndo(); md.w=Math.max(50,(+md.w||0)-50); renderWalls(); calc(); updUndo(); }});
  items.push({t:"Левее", off:j===0, fn:act("up")}, {t:"Правее", off:j>=list.length-1, fn:act("down")});
  items.push({t:"Оставить пустое место", fn:()=>setT(row==="lower"?"l_gap":"u_gap")});
  items.push({t:"Убрать модуль", danger:1, fn:()=>{ snapUndo(); list.splice(j,1); SEL={part:-1,mod:null}; renderWalls(); calc(); updUndo(); toastA(`Убрано: ${d.name}`,"Вернуть",undoLast); }});
  items.push("-", undo);
  showPMenu(cx,cy,d.name,`${WALL_NAMES[wi]}, ${row==="lower"?"низ":"верх"}, ${md.w} мм`,items);
}
function kupeMenu(p,cx,cy,undo){
  const k=S.kupe, key=p&&p.mod, items=[];
  const ch=(fn,msg)=>()=>{ snapUndo(); fn(); renderKupeForm(); refreshBinds(); calc(); updUndo(); toastA(msg,"Отменить",undoLast); };
  let title="Шкаф-купе", sub="";
  if(key && /^d\d/.test(key)){
    const di=+key.slice(1), d=k.doors[di]; title=`Дверь ${di+1}`; SEL.mod=key;
    if(d){ [1,2,3].forEach(n=>{ if(d.segs.length!==n) items.push({t:n===1?"Сделать целой":`Разделить на ${n} части`, fn:ch(()=>{ while(d.segs.length<n) d.segs.push(d.segs[d.segs.length-1]==="mirror"?"ldsp10":"mirror"); d.segs.length=n; },"Дверь изменена")}); });
      items.push({t:d.segs.includes("mirror")?"Без зеркала":"С зеркалом", fn:ch(()=>{ const on=d.segs.includes("mirror"); d.segs=d.segs.map(()=>on?"ldsp10":"mirror"); },"Дверь изменена")}); }
  } else if(key && /^s\d/.test(key)){
    const si=+key.slice(1), s=k.secs[si]; title=`Секция ${si+1}`; SEL.mod=key;
    if(s){ items.push({t:"Добавить полку", fn:ch(()=>s.shelves++,"Полка добавлена")}, {t:"Убрать полку", off:!s.shelves, fn:ch(()=>s.shelves=Math.max(0,s.shelves-1),"Полка убрана")},
      {t:"Добавить ящик", fn:ch(()=>s.drawers++,"Ящик добавлен")}, {t:"Убрать ящик", off:!s.drawers, fn:ch(()=>s.drawers=Math.max(0,s.drawers-1),"Ящик убран")},
      {t:s.rod?"Убрать штангу":"Добавить штангу", fn:ch(()=>s.rod=!s.rod,s.rod?"Штанга убрана":"Штанга добавлена")}); }
  }
  if(items.length) items.push("-");
  items.push({t:"Дверей больше", off:k.M>=6, fn:ch(()=>k.M=Math.min(6,k.M+1),"Добавил дверь")}, {t:"Дверей меньше", off:k.M<=2, fn:ch(()=>k.M=Math.max(2,k.M-1),"Убрал дверь")});
  items.push("-", undo);
  markFormSel(false); drawSketch();
  showPMenu(cx,cy,title,sub,items);
}

// ---------- правый клик и долгое нажатие ----------
// el - элемент, который слушаем; hit(e) -> {i, at}
function bindPartMenu(el,hit){
  let lp=null;
  const open=(e)=>{ const h=hit(e)||{i:-1}; openPartMenu(h.i,e.clientX,e.clientY,h.at,h.mod); };
  el.addEventListener("contextmenu",e=>{ e.preventDefault();
    if(lp){ if(!lp.fired){ clearTimeout(lp.t); lp.fired=true; open(lp); } return; }
    if(e.pointerType==="touch") return; if(el._rdown && Math.hypot(e.clientX-el._rdown[0],e.clientY-el._rdown[1])>6) return; open(e); });
  el.addEventListener("pointerdown",e=>{
    if(e.button===2){ el._rdown=[e.clientX,e.clientY]; return; }
    if(e.pointerType==="mouse") return;
    clearTimeout(lp&&lp.t);
    const st={x:e.clientX,y:e.clientY,id:e.pointerId,fired:false,clientX:e.clientX,clientY:e.clientY,target:e.target};
    st.t=setTimeout(()=>{ st.fired=true; if(navigator.vibrate) try{ navigator.vibrate(15); }catch(_){} open(st); },550);
    lp=st;
  });
  el.addEventListener("pointermove",e=>{ if(lp && e.pointerId===lp.id && Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>8){ clearTimeout(lp.t); lp=null; } });
  const end=e=>{ if(lp && e.pointerId===lp.id){ clearTimeout(lp.t); if(lp.fired){ el._skipClick=Date.now(); } lp=null; } };
  el.addEventListener("pointerup",end); el.addEventListener("pointercancel",end);
  // после долгого нажатия не выделяем деталь обычным "кликом"
  el.addEventListener("click",e=>{ if(el._skipClick && Date.now()-el._skipClick<700){ e.stopImmediatePropagation(); e.preventDefault(); } },true);
}
// 2D-чертёж: деталь по data-i, точка в мм по координатам svg
function sketchHit(e){
  const svg=$("sketch"), t=(e.target&&e.target.closest)?e.target.closest("[data-i]"):null;
  let at={};
  try{ const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY; const q=pt.matrixTransform(svg.getScreenCTM().inverse()); const v=S.view[S.mode];
    if(S.mode==="univ"){ if(v==="front") at={x:q.x,y:-q.y}; else if(v==="side") at={y:-q.y}; else if(v==="top") at={x:q.x}; } }catch(_){}
  const el=t || document.elementFromPoint(e.clientX,e.clientY), r=el&&el.closest&&el.closest("[data-i]");
  const gp=!r && el && el.closest && el.closest("[data-gap]");
  return {i:r?+r.dataset.i:-1, at, mod:gp?gp.dataset.gap:null};
}
// 3D: луч из камеры
function hit3d(e){
  if(!R3||!T3) return {i:-1};
  const rc=R3.r.domElement.getBoundingClientRect(), v=new T3.Vector2(((e.clientX-rc.left)/rc.width)*2-1, -((e.clientY-rc.top)/rc.height)*2+1);
  const ray=new T3.Raycaster(); ray.setFromCamera(v,R3.cam);
  const h=ray.intersectObjects(R3.grp.children,false)[0];
  return h ? {i:h.object.userData.i, at:{x:h.point.x,y:h.point.y}} : {i:-1};
}
function initPartMenu(){
  bindPartMenu($("sketch"),sketchHit);
  // 3D-холст появляется позже - вешаем на контейнер
  bindPartMenu($("u3d"),hit3d);
  initExpDrag();
  const ub=$("u_undo"); if(ub) ub.onclick=undoLast;
  updUndo();
}
