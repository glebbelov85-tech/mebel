// ================= СОСТОЯНИЕ =================
function defaultState(){
  return {v:2, mode:"kupe", client:"", phone:"", decor:"", disc:0, prepay:50, days:14, daysKind:"work", install:null, instNoMk:false, extras:[], items:[],
    kupe:kupeDefaults(), kit:kitDefaults(),
    u:{tpl:"cab", prms:tplDefaults(), panels:[], hw:[], manual:false, built:false},
    view:{kupe:"in", kitchen:"elev", univ:"3d"}, hideFac:false};
}
let S = defaultState();
let PAGE = "calc";                 // calc | price | lib
let CUR = null;                    // результат текущего расчёта
let SEL = {part:-1, mod:null};     // что выделено на эскизе
const getP = path => path.split(".").reduce((o,k)=>o==null?o:o[k],S);
const setP = (path,v) => { const ks=path.split("."), l=ks.pop(); ks.reduce((o,k)=>o[k],S)[l]=v; };
function readEl(el){ return el.type==="checkbox" ? el.checked : (el.type==="number"||"n" in el.dataset) ? (+el.value||0) : el.value; }
function fillEl(el){ const v=getP(el.dataset.b); if(el.type==="checkbox") el.checked=!!v; else if(document.activeElement!==el) el.value = v==null?"":v; }
function refreshBinds(){
  document.querySelectorAll("[data-mats]").forEach(el=>{
    const ids = el.dataset.mats==="body"?bodyMats() : el.dataset.mats==="fac"?[...new Set([...facMats(),...bodyMats()])] : topMats();
    el.innerHTML=matOpts(ids,getP(el.dataset.b));
  });
  document.querySelectorAll("[data-b]").forEach(fillEl);
  $("q_work").value=P.work; $("q_markup").value=P.markup;
  const qi=$("q_install"); if(qi){ if(document.activeElement!==qi) qi.value = S.install==null ? "" : S.install; qi.placeholder = fmt(P[INSTALL_ID[S.mode]]||0)+" - из прайса"; }
}
// Клиент: имя и телефон. Телефон может быть вписан (или надиктован) в поле имени - тогда достаём его оттуда.
const INSTALL_ID = {kupe:"install", kitchen:"kinstall", univ:"uinstall"};
function clientParts(){
  let name=String(S.client||"").trim(), phone=String(S.phone||"").trim();
  const m=/(\+?\d[\d\s()\-]{8,}\d)/.exec(name);
  if(m && m[1].replace(/\D/g,"").length>=10){ if(!phone) phone=m[1].trim(); name=(name.slice(0,m.index)+" "+name.slice(m.index+m[1].length)).replace(/(тел\.?|телефон|номер)\s*:?\s*$/i,"").replace(/\s{2,}/g," ").replace(/^[\s,;]+|[\s,;:]+$/g,""); }
  return {name, phone};
}
function waDigits(phone){ let d=String(phone||"").replace(/\D/g,""); if(d.length===11&&d[0]==="8") d="7"+d.slice(1); if(d.length===10) d="7"+d; return d.length>=11?d:""; }
function initBinds(){
  document.querySelectorAll("[data-b]").forEach(el=>el.addEventListener("input",()=>{
    const path=el.dataset.b; setP(path,readEl(el));
    if(path==="kupe.type"){ S.kupe.back=S.kupe.type==="korp"; refreshBinds(); }
    if(path==="kit.layout"){ kitFitMain(S.kit); renderKitchenForm(); }
    if("r" in el.dataset) renderKupeForm();
    calc();
  }));
  [["q_work","work"],["q_markup","markup"]].forEach(([id,k])=>$(id).addEventListener("input",e=>{ PI[k].v=Math.max(0,+e.target.value||0); savePrice(); calc(); }));
  $("q_install").addEventListener("input",e=>{ const v=e.target.value.trim(); S.install = v==="" ? null : Math.max(0,+v||0); calc(); });
}

// ================= ФОРМЫ: ШКАФ-КУПЕ =================
function renderKupeForm(){ renderSecs(); renderDoors(); }
function renderSecs(){
  const k=S.kupe, box=$("secs");
  while(k.secs.length<k.N) k.secs.push({shelves:4,rod:false,drawers:0,w:0});
  box.innerHTML=k.secs.slice(0,k.N).map((s,i)=>`<div class="sec" data-key="s${i}"><b>Секция ${i+1}</b>
    <div class="row4">
      <div><label>Полок</label><input type="number" min="0" max="12" value="${+s.shelves||0}" data-i="${i}" data-f="shelves"></div>
      <div><label>Ящиков</label><input type="number" min="0" max="6" value="${+s.drawers||0}" data-i="${i}" data-f="drawers"></div>
      <div><label>Ширина</label><input type="number" min="0" step="10" value="${+s.w||""}" placeholder="авто" data-i="${i}" data-f="w"></div>
      <label class="chk" style="margin-top:20px"><input type="checkbox" ${s.rod?"checked":""} data-i="${i}" data-f="rod">Штанга</label>
    </div></div>`).join("");
  box.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",e=>{
    const t=e.target, s=k.secs[+t.dataset.i], f=t.dataset.f;
    if(f==="rod") s.rod=t.checked; else s[f]=clamp(Math.round(+t.value||0),0,f==="w"?5000:+t.max);
    calc();
  }));
}
function renderDoors(){
  const k=S.kupe, box=$("doors"), ids=doorMats();
  while(k.doors.length<k.M) k.doors.push({segs:["ldsp10"]});
  box.innerHTML=k.doors.slice(0,k.M).map((d,i)=>`<div class="door" data-key="d${i}">
    <div class="dh"><span>Дверь ${i+1}</span><select data-i="${i}" data-f="n" title="На сколько частей делится дверь">${[1,2,3].map(n=>`<option value="${n}" ${d.segs.length===n?"selected":""}>${n===1?"целая":n+" части"}</option>`).join("")}</select></div>
    ${d.segs.map((m,q)=>`<select data-i="${i}" data-q="${q}" title="${d.segs.length>1?["Верх","Середина","Низ"][d.segs.length===2&&q===1?2:q]:"Заполнение"}">${matOpts(ids,m)}</select>`).join("")}
  </div>`).join("");
  box.querySelectorAll("select").forEach(s=>s.addEventListener("input",e=>{
    const t=e.target, d=k.doors[+t.dataset.i];
    if(t.dataset.f==="n"){ const n=+t.value; while(d.segs.length<n) d.segs.push(d.segs[d.segs.length-1]==="mirror"?"ldsp10":"mirror"); d.segs.length=n; renderDoors(); }
    else d.segs[+t.dataset.q]=t.value;
    calc();
  }));
}

// ================= ФОРМЫ: КУХНЯ =================
function modOptions(row,sel){
  const ids=modsOf(null,row); if(!ids.includes(sel) && modDef(sel)) ids.push(sel);
  const groups={};
  ids.forEach(t=>{ const d=modDef(t), g=d.custom?"Мои модули":CAT_NAMES[d.cat]; (groups[g]=groups[g]||[]).push(`<option value="${t}" ${t===sel?"selected":""}>${esc(d.name)}</option>`); });
  return Object.keys(groups).map(g=>`<optgroup label="${g}">${groups[g].join("")}</optgroup>`).join("");
}
function renderKitchenForm(){ renderCorners(); renderWalls(); }
function renderCorners(){
  const K=S.kit, lay=LAYOUTS[K.layout], box=$("corners");
  $("cornersCard").classList.toggle("hide",!lay.corners.length);
  const one=(side,k,TYPES,title)=>{
    const cr=K.corners[side][k], t=cr.t, useA=t==="L"||t==="blindA", useB=t==="L"||t==="blindB";
    return `<div class="cg"><div><label>${title}</label><select data-c="${side},${k},t">${Object.keys(TYPES).map(x=>`<option value="${x}" ${x===t?"selected":""}>${TYPES[x]}</option>`).join("")}</select></div>
      <div><label>По основной</label><input type="number" step="10" data-c="${side},${k},A" value="${useA?cr.A:""}" ${useA?"":"disabled"}></div>
      <div><label>По боковой</label><input type="number" step="10" data-c="${side},${k},B" value="${useB?cr.B:""}" ${useB?"":"disabled"}></div></div>`;
  };
  box.innerHTML=lay.corners.map(side=>`<div class="corner" data-key="c${side}"><b>${side==="R"?"Правый угол (основная + правая стена)":"Левый угол (левая + основная стена)"}</b>
    ${one(side,"low",CORNER_LOW,"Низ")}${one(side,"up",CORNER_UP,"Верх")}</div>`).join("");
  box.querySelectorAll("[data-c]").forEach(el=>el.addEventListener("input",e=>{
    const [side,k,f]=e.target.dataset.c.split(","), cr=K.corners[side][k];
    if(f==="t"){
      cr.t=e.target.value;
      const def = k==="low" ? 900 : 600;
      if(cr.t==="L"){ cr.A=cr.A>0&&cr.A<1300?cr.A:def; cr.B=cr.B>0&&cr.B<1300?cr.B:def; if(k==="low"&&cr.A>1000)cr.A=def; }
      if(cr.t==="blindA") cr.A=1050; if(cr.t==="blindB") cr.B=1050;
      renderCorners(); renderWalls();
    } else cr[f]=+e.target.value||0;
    calc();
  }));
}
function renderWalls(){
  const K=S.kit, lay=LAYOUTS[K.layout], box=$("walls");
  const modRow=(wi,row,md,j)=>`<div class="mod" data-key="${wi}${row==="lower"?"l":"u"}${j}">
      <select data-m="${wi},${row},${j},t">${modOptions(row,md.t)}</select>
      <input type="number" step="50" min="20" max="1500" list="stdw" value="${md.w}" data-m="${wi},${row},${j},w" title="Ширина, мм">
      <button class="bx" data-act="up,${wi},${row},${j}" title="Левее" ${j===0?"disabled":""}>&#8593;</button>
      <button class="bx" data-act="down,${wi},${row},${j}" title="Правее">&#8595;</button>
      <button class="bx" data-act="rm,${wi},${row},${j}" title="Убрать">&times;</button></div>`;
  box.innerHTML=lay.walls.map(wi=>{
    const w=K.walls[wi];
    return `<div class="wall"><div class="head"><b>${WALL_NAMES[wi]}</b><span><label>Длина, мм</label><input type="number" step="10" value="${w.len}" data-len="${wi}"></span></div>
      <div class="cnote hide" id="cn${wi}"></div>
      <div class="rowlbl">Нижний ряд и пеналы <span id="occL${wi}"></span></div>
      ${w.lower.map((md,j)=>modRow(wi,"lower",md,j)).join("")}
      <div class="fit hide" id="fitL${wi}"></div>
      <button class="b2 small" data-act="add,${wi},lower">+ нижний модуль</button>
      <div class="rowlbl">Верхний ряд <span id="occU${wi}"></span></div>
      ${w.upper.map((md,j)=>modRow(wi,"upper",md,j)).join("")}
      <div class="fit hide" id="fitU${wi}"></div>
      <button class="b2 small" data-act="add,${wi},upper">+ верхний модуль</button></div>`;
  }).join("");
  box.querySelectorAll("[data-len]").forEach(inp=>inp.addEventListener("input",e=>{ K.walls[+e.target.dataset.len].len=+e.target.value||0; calc(); }));
  box.querySelectorAll("[data-m]").forEach(el=>el.addEventListener("input",e=>{
    const [wi,row,j,f]=e.target.dataset.m.split(","), md=K.walls[+wi][row][+j];
    if(f==="t"){ md.t=e.target.value; md.w=modDefW(md.t); renderWalls(); } else md.w=+e.target.value||0;
    calc();
  }));
}
function wallAct(act,wi,row,j){
  const K=S.kit, list=K.walls[+wi][row]; j=+j;
  if(act!=="add") snapUndo();
  if(act==="rm"){ const md=list.splice(j,1)[0], d=md&&modDef(md.t); toastA(`Убрано: ${d?d.name:"модуль"}`,"Вернуть",undoLast); }
  else if(act==="up" && j>0) [list[j-1],list[j]]=[list[j],list[j-1]];
  else if(act==="down" && j<list.length-1) [list[j+1],list[j]]=[list[j],list[j+1]];
  else if(act==="add"){ openPicker(row,t=>{ snapUndo(); list.push({t,w:modDefW(t)}); renderWalls(); calc(); }); return; }
  else if(act==="fill"||act==="grow"||act==="shrink"){
    const info=CUR.info.walls.find(x=>x.wi===+wi), free=Math.round(row==="lower"?info.freeL:info.freeU);
    if(act==="fill") list.push({t:row==="lower"?"l_fill":"u_fill",w:free});
    else { for(let q=list.length-1;q>=0;q--){ const d=modDef(list[q].t); if(d && !d.gap && (list[q].w+free>=100 || act==="grow")){ list[q].w=Math.max(20,list[q].w+free); break; } } }
  }
  renderWalls(); calc();
}
// Подогнать все ряды под длину стен одной кнопкой: небольшой остаток закрывает планка-заглушка,
// большой - стандартные шкафы и планка, лишнее снимается с последнего модуля.
function fitRow(wi,row){
  const info=CUR.info.walls.find(x=>x.wi===wi); if(!info) return "";
  const list=S.kit.walls[wi][row], low=row==="lower", free=Math.round(low?info.freeL:info.freeU), nm=low?"низ":"верх";
  if(!free || (!low && !list.length)) return "";   // пустой верхний ряд - значит верха на этой стене нет
  const lastMod=()=>{ for(let q=list.length-1;q>=0;q--){ const d=modDef(list[q].t); if(d && !d.gap) return list[q]; } return null; };
  if(free<0){
    // лишнее снимаем с обычных шкафов с конца ряда; технику, пеналы и проёмы не трогаем, уже 300 мм шкаф не делаем
    let need=-free; const cut=[];
    for(let q=list.length-1;q>=0&&need>0;q--){ const d=modDef(list[q].t); if(!d||d.gap||d.tall||/oven|dish|fridge|hood|micro/.test(list[q].t)) continue;
      const min=/fill/.test(list[q].t)?20:300, take=Math.min(need,list[q].w-min); if(take>0){ list[q].w-=take; need-=take; cut.push(take); } }
    return cut.length ? `${nm}: шкафы ужаты на ${-free-need} мм`+(need>0?`, ещё ${need} мм лишние - уберите модуль`:"") : `${nm}: лишние ${-free} мм - уберите модуль`;
  }
  if(free<20){ const m=lastMod(); if(m){ m.w+=free; return `${nm}: последний модуль шире на ${free} мм`; } }
  let rest=free; const added=[];
  while(rest>=300){ const w=[600,500,450,400,300].find(x=>x<=rest); list.push({t:low?"l_shelf":"u_shelf",w}); added.push(w); rest-=w; }
  if(rest>=20) list.push({t:low?"l_fill":"u_fill",w:rest});
  else if(rest>0) list[list.length-1].w+=rest;
  return `${nm}: `+[added.length?`шкафы ${added.join(", ")}`:"", rest>=20?`заглушка ${rest}`:""].filter(Boolean).join(" и ");
}
function fitAll(){
  const done=[];
  S.kit.walls.forEach((w,wi)=>{ ["lower","upper"].forEach(row=>{ if(!CUR.info.walls.some(x=>x.wi===wi)) return; const r=fitRow(wi,row); if(r){ done.push(WALL_NAMES[wi].toLowerCase()+", "+r); calc(); } }); });
  renderWalls(); calc(); toast(done.length?"Подогнано. "+done.join("; "):"Все ряды уже сходятся со стенами");
}
function updateKitchenHints(info){
  const fa=$("fitAll"); if(fa) fa.classList.toggle("hide",!info.walls.some(w=>Math.round(w.freeL)!==0||Math.round(w.freeU)<0||Math.round(w.freeU)>0&&w.up.length));
  info.walls.forEach(w=>{
    const occL=$("occL"+w.wi), occU=$("occU"+w.wi), fitL=$("fitL"+w.wi), fitU=$("fitU"+w.wi), cn=$("cn"+w.wi);
    if(!occL) return;
    const fl=Math.round(w.freeL), fu=Math.round(w.freeU);
    occL.textContent = fl===0 ? `ровно ${fmt(w.l1-w.l0)} мм` : `занято ${fmt(w.lowEnd-w.l0)} из ${fmt(w.l1-w.l0)} мм`;
    occL.className = fl===0?"ok":"bad";
    occU.textContent = fu===0 ? `ровно ${fmt(w.u1-w.u0)} мм` : `занято до ${fmt(w.upEnd-w.u0)} из ${fmt(w.u1-w.u0)} мм`;
    occU.className = fu<0?"bad":fu===0?"ok":"";
    const btn=(act,row,txt)=>`<button data-act="${act},${w.wi},${row}">${txt}</button>`;
    fitL.classList.toggle("hide",fl===0);
    if(fl>0) fitL.innerHTML=`Свободно ${fmt(fl)} мм: ${btn("fill","lower","+ заглушка "+fl)}${btn("grow","lower","растянуть последний модуль")}`;
    if(fl<0) fitL.innerHTML=`Не помещается ${fmt(-fl)} мм: ${btn("shrink","lower","ужать последний модуль")}`;
    fitU.classList.toggle("hide",fu===0);
    if(fu>0) fitU.innerHTML=`Свободно ${fmt(fu)} мм: ${btn("fill","upper","+ заглушка "+fu)}${btn("grow","upper","растянуть последний")}`;
    if(fu<0) fitU.innerHTML=`Не помещается ${fmt(-fu)} мм: ${btn("shrink","upper","ужать последний модуль")}`;
    fitU.style.background = fu>0 ? "#f3eee7" : ""; fitU.style.color = fu>0 ? "var(--muted)" : "";
    const notes=[];
    if(w.wi===0){ if(info.has.L&&w.l0>0) notes.push(`слева угол занимает ${fmt(w.l0)} мм`); if(info.has.R&&w.len-w.l1>0) notes.push(`справа угол занимает ${fmt(w.len-w.l1)} мм`); }
    if(w.wi===1) notes.push(`от угла занято ${fmt(w.l0)} мм`);
    if(w.wi===2) notes.push(`у угла (в конце ряда) занято ${fmt(w.len-w.l1)} мм`);
    cn.classList.toggle("hide",!notes.length); cn.textContent="Угол: "+notes.join(", ")+".";
  });
}

// ================= ДОП. ПОЗИЦИИ =================
function renderExtras(){
  const box=$("extras");
  box.innerHTML=(S.extras.length?`<div class="extra"><label>Название</label><label>Кол-во</label><label>Цена, ${CS()}</label><span></span></div>`:"")+
    S.extras.map((x,i)=>`<div class="extra"><input value="${esc(x.name)}" data-i="${i}" data-f="name" placeholder="Название">
      <input type="number" min="0" value="${x.q}" data-i="${i}" data-f="q"><input type="number" min="0" value="${x.p}" data-i="${i}" data-f="p">
      <button class="bx" data-del="${i}" title="Убрать">&times;</button></div>`).join("");
  box.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",e=>{
    const t=e.target, x=S.extras[+t.dataset.i]; x[t.dataset.f]= t.dataset.f==="name" ? t.value : (+t.value||0); calc();
  }));
  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ S.extras.splice(+b.dataset.del,1); renderExtras(); calc(); });
}

// ================= ФОРМЫ: ЛЮБОЕ ИЗДЕЛИЕ =================
function tplName(k){ if(k.startsWith("cm:")){ const cm=LIB.custom.find(x=>x.id===k.slice(3)); return cm?cm.name:"Мой модуль"; } return TPL[k]?TPL[k].name:"Изделие"; }
function tplParams(k){
  if(k.startsWith("cm:")) return [pN("W","Ширина",0),pN("H","Высота",0),pN("D","Глубина",0)];
  return TPL[k].params;
}
function ensureTpl(){
  const u=S.u;
  if(u.tpl.startsWith("cm:")){
    const cm=LIB.custom.find(x=>x.id===u.tpl.slice(3));
    if(!cm){ u.tpl="cab"; return; }
    if(!u.prms[u.tpl]) u.prms[u.tpl]={W:cm.w,H:cm.h,D:cm.d};
  } else if(!TPL[u.tpl]) u.tpl="cab";
  const d=tplDefaults(); for(const k in d) u.prms[k]=Object.assign(d[k],u.prms[k]||{});
}
function buildFromTpl(){
  ensureTpl();
  const r=buildUniv(S.u); S.u.panels=r.parts; S.u.hw=r.hw; S.u.manual=false; S.u.built=true; SEL.part=-1; delete S.u.title;
  if(R3) R3.needFit=true;
  renderUniv(); calc();
}
function renderUniv(){
  ensureTpl();
  const u=S.u;
  $("u_tpl").innerHTML=`<optgroup label="Шаблоны">${Object.keys(TPL).map(k=>`<option value="${k}" ${k===u.tpl?"selected":""}>${TPL[k].name}</option>`).join("")}</optgroup>`+
    (LIB.custom.length?`<optgroup label="Мои модули">${LIB.custom.map(c=>`<option value="cm:${c.id}" ${"cm:"+c.id===u.tpl?"selected":""}>${esc(c.name)}</option>`).join("")}</optgroup>`:"");
  const pr=u.prms[u.tpl];
  $("u_params").innerHTML=tplParams(u.tpl).map(p=>{
    if(p.t==="n") return `<div class="field"><label>${p.l}</label><input type="number" data-p="${p.k}" value="${pr[p.k]}"></div>`;
    if(p.t==="s"){ const o=p.o===FAC_SEL ? Object.fromEntries([...new Set([...facMats(),"ldsp16"])].map(id=>[id,matName(id)])) : p.o;
      return `<div class="field"><label>${p.l}</label><select data-p="${p.k}">${Object.keys(o).map(k=>`<option value="${k}" ${pr[p.k]===k?"selected":""}>${esc(o[k])}</option>`).join("")}</select></div>`; }
    return `<label class="chk" style="margin-top:18px"><input type="checkbox" data-p="${p.k}" ${pr[p.k]?"checked":""}>${p.l}</label>`;
  }).join("");
  $("u_params").querySelectorAll("[data-p]").forEach(el=>el.addEventListener("input",e=>{
    const t=e.target; pr[t.dataset.p]= t.type==="checkbox"?t.checked : t.type==="number"?(+t.value||0) : t.value;
    if(!u.manual){ const r=buildUniv(u); u.panels=r.parts; u.hw=r.hw; SEL.part=-1; if(R3) R3.needFit=true; renderPanels(); renderHw(); calc(); }
    else $("u_manual").classList.remove("hide");
  }));
  $("u_manual").classList.toggle("hide",!u.manual);
  $("u_addhwSel").innerHTML=`<option value="">+ из прайса...</option>`+PRICE.filter(it=>!it.m && it.g==="Фурнитура").map(it=>`<option value="${it.id}">${esc(it.s||it.name)}</option>`).join("");
  renderPanels(); renderHw();
}
function panelHead(p,i){ return `<i style="background:${MAT(p.mat).css}"></i><span><b>${i+1}.</b> ${esc(p.name)} · ${esc(matName(p.mat))} · ${p.a}×${p.b}</span><button class="bx" data-dup="${i}" title="Копия">&#10697;</button><button class="bx" data-del="${i}" title="Удалить">&times;</button>`; }
function renderPanels(){
  const u=S.u, box=$("u_panels");
  $("u_count").textContent=u.panels.length;
  const mats=PRICE.filter(it=>it.m).map(it=>it.id);
  box.innerHTML=u.panels.map((p,i)=>{
    const sel=i===SEL.part, ab=ORI_AB[p.o];
    return `<div class="pcard ${sel?"sel":""}" id="pc${i}">
      <div class="ph" data-sel="${i}">${panelHead(p,i)}</div>
      ${sel?`<div class="pgrid">
        <div class="w3"><label>Название</label><input data-f="name" value="${esc(p.name)}"></div>
        <div><label>Материал</label><select data-f="mat">${matOpts(MATS[p.mat]&&!mats.includes(p.mat)?[...mats,p.mat]:mats,p.mat)}</select></div>
        <div><label>Положение</label><select data-f="o">${Object.keys(ORI).map(o=>`<option value="${o}" ${p.o===o?"selected":""}>${ORI[o]}</option>`).join("")}</select></div>
        <div><label>Кромка</label><select data-f="edge">${Object.keys(EDGES).map(k=>`<option value="${k}" ${+p.edge===+k?"selected":""}>${EDGES[k]}</option>`).join("")}</select></div>
        <div><label>X (от левого края)</label><input type="number" data-f="x" value="${p.x}"></div>
        <div><label>Y (от пола)</label><input type="number" data-f="y" value="${p.y}"></div>
        <div><label>Z (от стены)</label><input type="number" data-f="z" value="${p.z}"></div>
        <div><label>${ab[0]}</label><input type="number" data-f="a" value="${p.a}"></div>
        <div><label>${ab[1]}</label><input type="number" data-f="b" value="${p.b}"></div>
        <div><label class="chk" style="margin:20px 0 0"><input type="checkbox" data-f="f" ${p.f?"checked":""}>Фасад</label></div>
      </div>`:""}
    </div>`;
  }).join("") || `<p class="note">Деталей пока нет - выберите шаблон или добавьте деталь.</p>`;
  if(SEL.part>=0 && u.panels[SEL.part]){
    const card=$("pc"+SEL.part), p=u.panels[SEL.part];
    card.querySelectorAll("[data-f]").forEach(el=>el.addEventListener("input",e=>{
      const f=e.target.dataset.f, v=e.target.value;
      if(f==="f"){ if(e.target.checked) p.f=1; else delete p.f; }
      else p[f]= (f==="name"||f==="mat"||f==="o") ? v : (+v||0);
      if(f==="mat") delete p.t;
      markManual();
      if(f==="mat"||f==="o") renderPanels(); else card.querySelector(".ph").innerHTML=panelHead(p,SEL.part);
      calc();
    }));
  }
}
function panelsClick(e){
  const u=S.u, t=e.target;
  const del=t.closest("[data-del]"), dup=t.closest("[data-dup]"), sel=t.closest("[data-sel]");
  if(del) removePart(+del.dataset.del);
  else if(dup) dupPart(+dup.dataset.dup);
  else if(sel) selectPart(+sel.dataset.sel,false);
}
function renderHw(){
  const u=S.u, box=$("u_hw");
  box.innerHTML=(u.hw.length?`<div class="extra"><label>Название</label><label>Кол-во</label><label>Цена, ${CS()}</label><span></span></div>`:"")+
    u.hw.map((h,i)=>`<div class="extra"><input value="${esc(h.name)}" data-i="${i}" data-f="name"><input type="number" value="${h.q}" data-i="${i}" data-f="q">
      <input type="number" value="${hwPrice(h)}" data-i="${i}" data-f="p" title="${h.id&&h.p===undefined?"Цена из прайса. Если изменить здесь - будет своя цена только для этого изделия":""}">
      <button class="bx" data-del="${i}">&times;</button></div>`).join("");
  box.querySelectorAll("input").forEach(el=>el.addEventListener("input",e=>{ const t=e.target, h=u.hw[+t.dataset.i]; h[t.dataset.f]=t.dataset.f==="name"?t.value:(+t.value||0); markManual(); calc(); }));
  box.querySelectorAll("[data-del]").forEach(el=>el.onclick=()=>{ snapUndo(); const h=u.hw.splice(+el.dataset.del,1)[0]; markManual(); renderHw(); calc(); toastA(`Убрано: ${h&&h.name||"позиция"}`,"Вернуть",undoLast); });
}
function markManual(){ if(!S.u.manual){ S.u.manual=true; $("u_manual").classList.remove("hide"); } }

// ================= ВЫДЕЛЕНИЕ =================
function selectPart(i,scroll=true){
  if(S.mode==="univ"){
    SEL.part = SEL.part===i ? -1 : i; SEL.mod=null;
    renderPanels(); drawSketch();
    if(scroll && SEL.part>=0){ const c=$("pc"+i); if(c) c.scrollIntoView({behavior:"smooth",block:"nearest"}); }
    return;
  }
  const p=CUR.parts[i];
  if(SEL.part===i){ SEL.part=-1; SEL.mod=null; } else { SEL.part=i; SEL.mod=p&&p.mod||null; }
  markFormSel(scroll); drawSketch();
}
function markFormSel(scroll){
  document.querySelectorAll("#kupeForm [data-key],#kitchenForm [data-key]").forEach(el=>el.classList.remove("sel"));
  if(!SEL.mod) return;
  let key=SEL.mod; if(/^c[LR]/.test(key)) key=key.slice(0,2);
  const el=document.querySelector(`#${S.mode==="kupe"?"kupeForm":"kitchenForm"} [data-key="${key}"]`);
  if(el){ el.classList.add("sel"); if(scroll && window.matchMedia("(min-width:940px)").matches) el.scrollIntoView({behavior:"smooth",block:"nearest"}); }
}

// ================= ОБЩИЙ ИТОГ =================
let lastClient="", lastParts="";

// ================= ЦЕНА ПО КНОПКЕ "ПОСЧИТАТЬ" =================
// Цена не показывается, пока мастер не нажмёт "Посчитать". Запоминаем, какая цена была показана:
// если после этого что-то поменяли и цена стала другой - старая сумма зачёркивается и кнопка "Пересчитать".
let PRICE_SHOWN = null;
function priceSig(q){ return q ? [q.total,q.cost,q.pre,CURCODE].join("|") : ""; }
function priceState(){
  const q=CUR&&CUR.quote; if(!q || PRICE_SHOWN==null) return "none";
  return PRICE_SHOWN===priceSig(q) ? "ok" : "stale";
}
function showPrice(){
  if(!CUR||!CUR.quote) calc();
  PRICE_SHOWN=priceSig(CUR&&CUR.quote); renderPriceState();
  const t=$("total"); t.classList.remove("pop"); void t.offsetWidth; t.classList.add("pop");
  return CUR&&CUR.quote;
}
function priceReset(){ PRICE_SHOWN=null; renderPriceState(); }
function renderPriceState(){
  const st=priceState(), ok=st==="ok", stale=st==="stale";
  document.body.classList.toggle("price-none",st==="none"); document.body.classList.toggle("price-stale",stale);
  const bt=$("calcBtn"), hint=$("totalHint");
  bt.textContent=stale?"Пересчитать":"Посчитать"; bt.classList.toggle("hide",ok);
  $("total").classList.toggle("hide",st==="none"); $("total").classList.toggle("old",stale);
  $("totalSub").classList.toggle("hide",!ok);
  hint.textContent=stale?"Параметры изменились - цена устарела":"Выберите изделие и размеры, потом нажмите";
  hint.classList.toggle("hide",ok);
  $("mbarLabel").textContent=ok?"Цена для клиента":stale?"Цена устарела":"Цена ещё не посчитана";
  $("mbarTotal").classList.toggle("hide",st==="none"); $("mbarTotal").classList.toggle("old",stale);
  $("mbarBtn").textContent=ok?"К расчёту":stale?"Пересчитать":"Посчитать";
  $("mbarBtn").classList.toggle("go",!ok);
  $("costBody").classList.toggle("hide",!ok); $("costWait").classList.toggle("hide",ok);
  $("costWaitText").textContent=stale?"Параметры изменились - нажмите, чтобы пересчитать цену.":"Цена ещё не посчитана. Когда изделие готово - нажмите кнопку.";
  $("costCalcBtn").textContent=stale?"Пересчитать":"Посчитать";
  const mt=$("miniTotal"); if(mt) mt.textContent=ok&&CUR&&CUR.quote?money(CUR.quote.total):"";
}
// Результат одного изделия: mode - вид, st - его параметры (S.kupe, S.kit или S.u)
function resultFor(mode,st){
  if(mode==="kupe"){ const r=genKupe(st); r.type="kupe"; r.install="install"; r.st=st; return r; }
  if(mode==="kitchen"){ const r=genKitchen(st); r.type="kitchen"; r.install="kinstall"; r.st=st; return r; }
  const u=st, bb=bounds(u.panels), used=[...new Set(u.panels.filter(p=>!MAT(p.mat).virt).map(p=>matName(p.mat)))];
  const nm=(u.title||"").trim() || (u.tpl==="empty" ? "Изделие" : tplName(u.tpl));
  return {type:"univ", install:"uinstall", st:u, parts:u.panels, hw:u.hw, warns:checkParts(u.panels,{overlap:1}),
    title:`${nm} ${bb.W}×${bb.H}×${bb.D}`, info:{bb},
    desc:`${nm}, ${bb.W}×${bb.H}×${bb.D} мм (Ш×В×Г)\nМатериалы: ${used.join(", ")||"-"}\nФурнитура: ${u.hw.filter(h=>h.q>0&&h.id!=="umisc").map(h=>String(h.name||"").toLowerCase()).filter(Boolean).join(", ")||"-"}`};
}
function currentResult(){ return resultFor(S.mode, S.mode==="kupe"?S.kupe:S.mode==="kitchen"?S.kit:S.u); }
const isEmptyRes=r=>!r.parts.some(p=>!MAT(p.mat).virt&&p.a>0&&p.b>0) && !r.hw.some(h=>h.q>0);
// ---- несколько изделий в одном заказе: S.items - остальные изделия, на экране всегда одно ("текущее") ----
function curSnap(){ return {mode:S.mode, st:clone(S.mode==="kupe"?S.kupe:S.mode==="kitchen"?S.kit:S.u)}; }
function loadSnap(it){ if(it.mode==="kupe") S.kupe=it.st; else if(it.mode==="kitchen") S.kit=it.st; else S.u=it.st; }
const emptyU=()=>({tpl:"empty", prms:tplDefaults(), panels:[], hw:[], manual:true, built:true});
function itemAdd(){
  if(isEmptyRes(CUR)){ toast("Сначала посчитайте изделие - пока добавлять нечего"); return; }
  const snap=curSnap(); S.items.push(snap);
  if(snap.mode==="kupe") S.kupe=kupeDefaults(); else if(snap.mode==="kitchen") S.kit=kitDefaults();
  S.u=emptyU(); setMode("univ"); window.scrollTo({top:0,behavior:"smooth"});
  toast("Изделие добавлено в заказ. Выберите вверху, что считаем дальше: шкаф-купе, кухню или любое изделие");
}
function itemEdit(i){
  const it=S.items[i]; if(!it) return;
  if(isEmptyRes(CUR)) S.items.splice(i,1); else S.items[i]=curSnap();
  loadSnap(clone(it)); setMode(it.mode); toast("Изделие открыто для правки");
}
function itemDel(i){ const r=CUR.others[i]; confirmBox(`Убрать из заказа "${r?r.title:"изделие"}"?`,"Убрать",()=>{ S.items.splice(i,1); calc(); }); }
function renderItems(R0){
  const box=$("itemsList"); if(!box) return;
  const cur=!isEmptyRes(R0);
  box.innerHTML=R0.others.map((r,i)=>`<div class="saved"><span>${i+1}. ${esc(r.title)}</span><button class="b2 small" data-iedit="${i}">Изменить</button><button class="bx" data-idel="${i}" title="Убрать из заказа">&times;</button></div>`).join("")+
    (R0.others.length ? `<div class="saved"><span>${R0.others.length+1}. ${cur?esc(R0.title):"Новое изделие"}<small>сейчас на экране</small></span></div>` : "");
  $("itemsNote").textContent = R0.others.length ? "Цена, материалы и листы считаются на весь заказ сразу. Эскиз - у изделия, которое на экране." : "В один заказ можно сложить несколько изделий: кухню, шкаф, тумбу. Цена и раскрой будут общими.";
}
function calc(){
  const R0=currentResult(); CUR=R0;
  if(R0.type!=="univ") R0.warns=[...new Set(R0.warns.concat(checkParts(R0.parts)))];
  if(!Array.isArray(S.items)) S.items=[];
  // остальные изделия заказа считаются заново при каждом расчёте - так на них действуют текущие цены
  const others=S.items.map(it=>resultFor(it.mode,it.st)); R0.others=others;
  const prods=(isEmptyRes(R0)&&others.length?[]:[R0]).concat(others); R0.prods=prods;
  const allParts=others.length?[].concat(...prods.map(r=>r.parts)):R0.parts, allHw=[];
  if(others.length){ const byId={}; prods.forEach(r=>r.hw.forEach(h=>{ if(!(h.q>0)) return; if(h.id&&h.p===undefined){ if(byId[h.id]) byId[h.id].q+=h.q; else allHw.push(byId[h.id]=Object.assign({},h)); } else allHw.push(h); })); }
  R0.allParts=allParts; R0.allHw=others.length?allHw:R0.hw;
  R0.orderTitle=prods.length>1?prods.map(r=>r.title).join(" + "):R0.title;
  renderItems(R0);
  const cost=costParts(allParts,R0.allHw); R0.cost=cost;
  const rows=cost.rows.filter(r=>r[2]>0);
  S.extras.forEach(x=>{ if(x.q*x.p>0) rows.push([x.name||"Своя позиция", x.q+" шт.", x.q*x.p]); });
  const disc=clamp(+S.disc||0,0,90), prepay=clamp(+S.prepay||0,0,100), days=Math.max(1,+S.days||1);
  // доставка и монтаж: своя сумма для этого заказа или из прайса; у пустого изделия - ноль
  const mat=rows.reduce((s,r)=>s+r[2],0), installName=prods.length>1?"Доставка и монтаж":hwName(R0.install);
  const install = mat>0 ? (S.install!=null && S.install!=="" ? Math.max(0,+S.install||0) : prods.reduce((s,r)=>s+(P[r.install]||0),0)) : 0;
  const work=Math.round(mat*P.work/100), cst=mat+work+install;
  const markup=Math.round((S.instNoMk ? cst-install : cst)*P.markup/100), beforeDisc=cst+markup, discSum=beforeDisc*disc/100;
  const R=Math.max(1,P.round||1);
  const total=Math.ceil((beforeDisc-discSum)/R-1e-9)*R;
  const pre=Math.min(total,Math.ceil(total*prepay/100/R-1e-9)*R);
  const daysKind=S.daysKind==="calendar"?"calendar":"work";
  R0.quote={rows,mat,work,install,installName,cost:cst,markup,disc,discSum,total,prepay,pre,days,daysKind,instNoMk:!!S.instNoMk};

  let h=`<tr><th>Позиция</th><th class="n">Кол-во</th><th class="n">${CS()}</th></tr>`;
  rows.forEach(r=>h+=`<tr><td>${esc(r[0])}</td><td class="n">${esc(r[1])}</td><td class="n">${fmt(r[2])}</td></tr>`);
  h+=`<tr class="sum"><td>Материалы и фурнитура</td><td></td><td class="n">${fmt(mat)}</td></tr>`;
  h+=`<tr><td>Сборка (${P.work}%)</td><td></td><td class="n">${fmt(work)}</td></tr>`;
  h+=`<tr><td>${esc(installName)}${S.install!=null&&S.install!==""?" (для этого заказа)":""}</td><td></td><td class="n">${fmt(install)}</td></tr>`;
  h+=`<tr class="sum"><td>Себестоимость</td><td></td><td class="n">${fmt(cst)}</td></tr>`;
  h+=`<tr><td>Наценка (${P.markup}%${S.instNoMk&&install?", без доставки и монтажа":""})</td><td></td><td class="n">${fmt(markup)}</td></tr>`;
  if(disc) h+=`<tr class="disc"><td>Скидка клиенту (${disc}%)</td><td></td><td class="n">-${fmt(discSum)}</td></tr>`;
  h+=`<tr class="sum"><td>Итого клиенту</td><td></td><td class="n">${fmt(total)}</td></tr>`;
  h+=`<tr><td>Предоплата (${prepay}%)</td><td></td><td class="n">${fmt(pre)}</td></tr>`;
  $("costs").innerHTML=h;
  $("total").textContent=money(total); $("mbarTotal").textContent=money(total);
  $("totalSub").textContent=`себестоимость ${money(cst)} · прибыль ${money(total-cst)}`;
  renderPriceState();
  const pm=$("pmInfo"); pm.classList.add("hide");
  if(R0.type==="kitchen"){
    updateKitchenHints(R0.info);
    const Lm=R0.info.lowRunMM/1000;
    if(Lm>0){ pm.classList.remove("hide"); pm.textContent=`Длина кухни по низу ${Lm.toFixed(1)} п.м. Выходит ${money(total/Lm)} за погонный метр.`+(P.pm>0?` По вашей цене за метр (${money(P.pm)}) было бы ${money(P.pm*Lm)}.`:""); }
  }
  const wb=$("warns");
  if(R0.warns.length){ wb.style.display="block"; wb.innerHTML=`<b>Проверьте:</b><ul>${R0.warns.map(w=>`<li>${w}</li>`).join("")}</ul>`; } else wb.style.display="none";

  renderPartsCard(R0);
  const ex=S.extras.filter(x=>x.name&&x.q).map(x=>`\n- ${x.name}: ${x.q} шт.`).join("");
  lastClient=`${prods.length>1?prods.map((r,i)=>(i+1)+". "+r.desc).join("\n\n"):R0.desc}${S.decor.trim()?"\nЦвет: "+S.decor.trim():""}${ex?"\nДополнительно:"+ex:""}
${install>0?"Доставка и монтаж включены":"Доставка и монтаж в стоимость не входят"}

Стоимость: ${money(total)}${disc?` (со скидкой ${disc}%)`:""}
Предоплата: ${money(pre)}
Срок изготовления: ${days} ${daysKind==="calendar"?"календарных":"рабочих"} дн.`;
  $("wa").href="https://wa.me/"+waDigits(clientParts().phone)+"?text="+encodeURIComponent(lastClient);
  if(SEL.part>=R0.parts.length){ SEL.part=-1; SEL.mod=null; }
  drawSketch();
  LS.set("mk2_current",S);
  return total;
}

// ================= ДЕТАЛИ: таблицы и текст =================
function renderPartsCard(R0){
  const cl=cutList(R0.allParts||R0.parts); R0.cut=cl;
  let h="", txt=(R0.orderTitle||R0.title)+"\n";
  if(R0.type==="kitchen"){
    const info=R0.info;
    h+=`<table><tr><th>Стена</th><th>Модули, мм</th></tr>`;
    info.walls.forEach(w=>{
      const f=l=>l.filter(m=>!m.gap||m.t==="l_gap").map(m=>`${esc(m.name)} ${m.w}`).join(", ")||"-";
      h+=`<tr><td>${WALL_NAMES[w.wi]}<br><small>${fmt(w.len)}</small></td><td><b>Низ:</b> ${f(w.low)}<br><b>Верх:</b> ${f(w.up.filter(m=>!m.gap))}</td></tr>`;
    });
    ["L","R"].forEach(s=>{ if(info.has[s]){ const cr=S.kit.corners[s], z=info.cs[s];
      h+=`<tr><td>${s==="R"?"Правый":"Левый"} угол</td><td><b>Низ:</b> ${CORNER_LOW[cr.low.t]}${cr.low.t!=="none"?` ${z.low.A}×${z.low.B}`:""}<br><b>Верх:</b> ${CORNER_UP[cr.up.t]}${cr.up.t!=="none"?` ${z.up.A}×${z.up.B}`:""}</td></tr>`; } });
    h+=`</table>`;
    const fl=facadeList(R0.parts,info.c.fac), fa=fl.reduce((s,f)=>s+f.h*f.w*f.q/1e6,0), fn=fl.reduce((s,f)=>s+f.q,0);
    h+=`<h3>Фасады для заказа: ${esc(matName(info.c.fac))}, В×Ш мм</h3><table><tr><th>Размер</th><th class="n">Шт.</th></tr>`;
    fl.forEach(f=>h+=`<tr><td>${f.h}×${f.w}</td><td class="n">${f.q}</td></tr>`);
    h+=`<tr class="sum"><td>Всего ${fa.toFixed(2)} м²</td><td class="n">${fn}</td></tr></table>`;
    txt+=`Фасады (${matName(info.c.fac)}), В×Ш мм:\n`+fl.map(f=>`${f.h}×${f.w} - ${f.q} шт.`).join("\n")+`\nВсего: ${fn} шт., ${fa.toFixed(2)} м²\n\n`;
    h+=`<h3>Столешница</h3><table>${info.topPieces.map(t=>`<tr><td>${WALL_NAMES[t.wi]}</td><td class="n">${fmt(t.e-t.a)} × ${info.c.TD}</td></tr>`).join("")||"<tr><td>-</td></tr>"}</table>`;
    txt+=`Столешница:\n`+info.topPieces.map(t=>`${WALL_NAMES[t.wi]}: ${Math.round(t.e-t.a)}×${info.c.TD}`).join("\n")+"\n\n";
  }
  if(R0.type==="kupe"){
    const i=R0.info;
    h+=`<table><tr><td>Двери</td><td class="n">${i.m} шт. по ${i.doorW}×${i.doorH} мм</td></tr><tr><td>Секции, ширина в свету</td><td class="n">${i.sw.map(w=>Math.round(w)).join(" / ")}</td></tr></table>
      <p class="note">Размер вставок дверей зависит от системы профиля - проверьте по таблице производителя.</p>`;
  }
  h+=`<h3>Список на распил</h3><table><tr><th>Деталь</th><th class="n">Размер, мм</th><th>Кромка</th><th class="n">Шт.</th></tr>`;
  let g="";
  cl.forEach(r=>{
    if(r.mat!==g){ g=r.mat; const s=R0.cost.sheets[g], v=R0.cost.by[g];
      h+=`<tr><td colspan="4" style="background:#f3ece2;font-weight:700;color:var(--wood-d)"><span class="dot" style="background:${MAT(g).css}"></span> ${esc(r.matName)}${v?` - ${v.area.toFixed(2)} м²`:""}${s?`, ${s} л.`:""}</td></tr>`;
      txt+=`\n${r.matName}:\n`; }
    h+=`<tr><td>${esc(r.name)}</td><td class="n">${r.L}×${r.S}</td><td>${MAT(r.mat).kind==="sheet"?EDGES[r.edge].toLowerCase():""}</td><td class="n">${r.q}</td></tr>`;
    txt+=`${r.name}: ${r.L}×${r.S} - ${r.q} шт.${r.edge?` (кромка: ${EDGES[r.edge].toLowerCase()})`:""}\n`;
  });
  h+=`</table>`;
  if(R0.cost.edgeM) txt+=`\nКромка всего: ${R0.cost.edgeM} м`;
  $("parts").innerHTML=h;
  $("partsTitle").textContent = R0.type==="kitchen"?"Модули, фасады, детали" : "Детали";
  $("toUniv").classList.toggle("hide",R0.type==="univ");
  lastParts=txt;
}

// ================= ЭСКИЗЫ =================
const VIEWS = {kupe:[["in","Начинка"],["door","Двери"],["3d","3D"],["top","Сверху"]], kitchen:[["elev","Развёртка"],["plan","План"],["3d","3D"]], univ:[["3d","3D"],["front","Спереди"],["top","Сверху"],["side","Сбоку"]]};
function renderViewTabs(){
  const v=S.view[S.mode];
  $("viewTabs").innerHTML=VIEWS[S.mode].map(([k,n])=>`<button data-v="${k}" class="${k===v?"on":"off"}">${n}</button>`).join("")+
    `<label class="chk" style="margin:0 0 0 6px"><input type="checkbox" id="hideFac" ${S.hideFac?"checked":""}>Скрыть фасады</label><button class="b2 hide" id="fit3d">По центру</button><button class="b2 hide" id="exp3d" title="Разложить изделие на детали и посмотреть каждую">${EXP.on?"Собрать":"Разобрать по деталям"}</button>`;
}
// прямоугольники для вида: u - по горизонтали, s - по вертикали (вверх), d - глубина (дальние рисуются первыми)
function projItems(parts,view,keep){
  const r=[];
  parts.forEach((p,i)=>{
    if(keep && !keep(p,i)) return;
    const b=boxOf(p); if(!(b.x1>b.x0&&b.y1>b.y0&&b.z1>b.z0)) return;
    let it;
    if(view==="front") it={u:b.x0,w:b.x1-b.x0,s:b.y0,h:b.y1-b.y0,d:b.z1,face:p.o==="Z"};
    else if(view==="top") it={u:b.x0,w:b.x1-b.x0,s:-b.z1,h:b.z1-b.z0,d:b.y1,face:p.o==="Y"};
    else if(view==="side") it={u:b.z0,w:b.z1-b.z0,s:b.y0,h:b.y1-b.y0,d:-b.x0,face:p.o==="X"};
    else if(view==="w1") it={u:b.z0,w:b.z1-b.z0,s:b.y0,h:b.y1-b.y0,d:-b.x0,face:p.o==="X"};       // правая стена: смотрим вправо
    else if(view==="w2") it={u:-b.z1,w:b.z1-b.z0,s:b.y0,h:b.y1-b.y0,d:b.x1,face:p.o==="X"};       // левая стена: смотрим влево
    it.p=p; it.i=i; r.push(it);
  });
  return r.sort((a,b)=>a.d-b.d);
}
function svgRects(items,sw,ox,oy){
  let g="";
  items.forEach(r=>{
    const p=r.p, m=MAT(p.mat), x=ox+r.u, y=oy-(r.s+r.h);
    const sel = r.i===SEL.part, msel = !sel && SEL.mod && p.mod===SEL.mod;
    let fill = sel ? "#ff9a3c" : msel ? "#ffcf9e" : (r.face && /^mirror/.test(p.mat) ? "url(#mir)" : m.css);
    const face = r.face && p.f && !m.virt, rx = face ? Math.min(8,r.w/6,r.h/6) : 0;
    const op = p.mat==="_apron" ? ' opacity=".7"' : (p.mat==="_metal" && p.t<=2 ? ' fill-opacity="0"' : (r.face && !p.f && !sel && !msel && p.mat==="dvp" ? ' fill-opacity=".35"' : ""));
    g+=`<rect data-i="${r.i}" x="${r1(x)}" y="${r1(y)}" width="${r1(r.w)}" height="${r1(r.h)}" rx="${r1(rx)}" fill="${fill}"${op} stroke="${m.virt&&p.mat!=="_metal"?"#3a3a3a":"#6b5a4a"}" stroke-width="${sw*(face?1.3:0.8)}"/>`;
    if(face && p.hd && r.w>60 && r.h>60){
      const hl=Math.min(110,r.w*0.45,r.h*0.45), ht=Math.max(8,sw*2.2), k=p.hd, cx0=x+r.w/2, top=y, bot=y+r.h;
      let hx,hy,vw,vh;
      if(k==="t"||k==="b"){ vw=hl; vh=ht; hx=cx0-hl/2; hy=(k==="t"?top+Math.min(55,r.h*0.25):bot-Math.min(55,r.h*0.25))-ht/2; }
      else { vw=ht; vh=hl; const left=k.endsWith("-l"); hx=(left?x+Math.min(45,r.w*0.2):x+r.w-Math.min(45,r.w*0.2))-ht/2;
        hy = k.startsWith("vt") ? top+Math.min(60,r.h*0.1) : k.startsWith("vb") ? bot-Math.min(60,r.h*0.1)-hl : y+r.h/2-hl/2; }
      g+=`<rect x="${r1(hx)}" y="${r1(hy)}" width="${r1(vw)}" height="${r1(vh)}" rx="${r1(Math.min(vw,vh)/2)}" fill="#6b5a4a" pointer-events="none"/>`;
    }
  });
  return g;
}
const SVG_DEFS=`<defs><linearGradient id="mir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfeef5"/><stop offset=".45" stop-color="#b9d3df"/><stop offset=".55" stop-color="#eef7fb"/><stop offset="1" stop-color="#a9c6d4"/></linearGradient>
<pattern id="hatch" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="60" stroke="#c9bdb0" stroke-width="8"/></pattern></defs>`;
function ext(items){ return {u0:Math.min(...items.map(r=>r.u)), u1:Math.max(...items.map(r=>r.u+r.w)), s0:Math.min(...items.map(r=>r.s)), s1:Math.max(...items.map(r=>r.s+r.h))}; }
function drawOrtho(view,keep,extra){
  const svg=$("sketch"), items=projItems(CUR.parts,view,keep);
  if(!items.length){ svg.setAttribute("viewBox","0 0 100 40"); svg.innerHTML=`<text x="50" y="22" text-anchor="middle" font-size="6" fill="#7a7068">Нет деталей</text>`; return; }
  const e=ext(items), W=e.u1-e.u0, H=e.s1-e.s0, M=Math.max(W,H), pad=M*0.09, fs=M/30, sw=M/420;
  svg.setAttribute("viewBox",`${e.u0-pad} ${-e.s1-pad} ${W+pad*2} ${H+pad*2+(extra?fs*1.2:0)}`);
  let g=SVG_DEFS+svgRects(items,sw,0,0);
  g+=`<text x="${e.u0+W/2}" y="${-e.s1-pad*0.35}" text-anchor="middle" font-size="${fs}" fill="#7a7068">${Math.round(W)}</text>`;
  g+=`<text x="${e.u0-pad*0.4}" y="${-e.s0-H/2}" text-anchor="middle" font-size="${fs}" fill="#7a7068" transform="rotate(-90 ${e.u0-pad*0.4} ${-e.s0-H/2})">${Math.round(H)}</text>`;
  if(extra) g+=extra({e,fs,sw,pad});
  svg.innerHTML=g;
}
function drawKitchenElev(){
  const svg=$("sketch"), info=CUR.info, GAP=450, hide=S.hideFac;
  const Htot=Math.max(...CUR.parts.map(p=>boxOf(p).y1),1000)+100;
  const total=info.lay.walls.reduce((s,wi)=>s+info.L[wi],0)+GAP*(info.lay.walls.length-1);
  const fs=Math.max(64,total/60), sw=Math.max(3.5,total/750);
  let g=SVG_DEFS, ox=0;
  info.lay.walls.forEach(wi=>{
    const Lw=info.L[wi], w=info.walls.find(x=>x.wi===wi);
    const view=wi===0?"front":wi===1?"w1":"w2", off=wi===2?Lw:0;
    // угловой модуль виден на двух стенах: на каждой показываем только то плечо, что стоит вдоль неё
    const items=projItems(CUR.parts,view,p=>{
      if(!p.w || !p.w.includes(""+wi) || (hide&&p.f)) return false;
      if(p.w.length<2) return true;
      const b=boxOf(p), lim=(b.y0>=info.yUp-1 ? info.c.Du+info.c.ft : info.c.TD)+30;
      return (wi===0 ? b.z1 : wi===1 ? info.L[0]-b.x0 : b.x1) <= lim;
    });
    g+=`<rect x="${ox}" y="${-Htot}" width="${Lw}" height="${Htot}" fill="#f1ece6"/>`;
    g+=`<text x="${ox+Lw/2}" y="${-Htot-fs*0.6}" text-anchor="middle" font-size="${fs}" fill="#7a7068">${WALL_NAMES[wi]} - ${fmt(Lw)} мм</text>`;
    g+=`<line x1="${ox-60}" y1="0" x2="${ox+Lw+60}" y2="0" stroke="#b9ada0" stroke-width="${sw*2}"/>`;
    // пометка угла
    const cz=(a,b)=>g+=`<rect x="${ox+a}" y="${-Htot}" width="${b-a}" height="${Htot}" fill="url(#hatch)" opacity=".35" pointer-events="none"/>`;
    g+=svgRects(items,sw,ox+off,0);
    if(wi===1) cz(0,info.c.TD);
    if(wi===2) cz(Lw-info.c.TD,Lw);
    if(wi===0 && info.has.R) cz(Lw-info.c.TD,Lw);
    if(wi===0 && info.has.L) cz(0,info.c.TD);
    const lbl=(m,y)=>{ if(m.gap && m.t!=="l_gap") return ""; return `<text x="${ox+m.s+m.w/2}" y="${y}" text-anchor="middle" font-size="${fs*0.62}" fill="${m.key===SEL.mod?"#b5651d":"#7a7068"}">${m.w}</text>`; };
    w.low.forEach(m=>{ g+=lbl(m,fs*0.85);
      if(m.t==="l_gap") g+=`<rect data-gap="${m.key}" pointer-events="all" x="${ox+m.s+12}" y="${-(info.c.PL+info.c.Hl+info.c.topT)}" width="${m.w-24}" height="${info.c.PL+info.c.Hl+info.c.topT}" fill="none" stroke="#9a8f84" stroke-width="${sw}" stroke-dasharray="${sw*5} ${sw*4}"/><text x="${ox+m.s+m.w/2}" y="${-(info.c.PL+info.c.Hl)/2}" text-anchor="middle" font-size="${fs*0.6}" fill="#9a8f84">проём</text>`; });
    w.up.forEach(m=>g+=lbl(m,-(info.yUp+info.c.Hu)-fs*0.3));
    ox+=Lw+GAP;
  });
  svg.setAttribute("viewBox",`-110 ${-Htot-fs*2.1} ${total+220} ${Htot+fs*3.6}`);
  svg.innerHTML=g;
}
function drawSketch(){
  if(!CUR) return;
  const mode=S.mode, v=S.view[mode], use3d = v==="3d";
  $("u3d").classList.toggle("hide",!use3d);
  $("sketch").style.display = use3d ? "none" : "";
  const fb=$("fit3d"); if(fb) fb.classList.toggle("hide",!use3d);
  const eb=$("exp3d"); if(eb){ eb.classList.toggle("hide",!use3d); eb.textContent=EXP.on?"Собрать":"Разобрать по деталям"; eb.classList.toggle("on",EXP.on); }
  const noFac=p=>!(S.hideFac&&p.f);
  if(use3d) show3d();
  else if(mode==="kupe"){
    const i=CUR.info;
    if(v==="top") drawOrtho("top",noFac);
    else drawOrtho("front", v==="in" ? (p=>!p.f) : null, ({e,fs})=>{
      if(v!=="in") return "";
      let x=i.x0||0, t="";
      i.sw.forEach(w=>{ t+=`<text x="${x+w/2}" y="${-e.s0+fs*1.1}" text-anchor="middle" font-size="${fs*0.8}" fill="#7a7068">${Math.round(w)}</text>`; x+=w+MAT(S.kupe.body).t; });
      return t;
    });
  }
  else if(mode==="kitchen"){ if(v==="plan") drawOrtho("top",p=>noFac(p) && boxOf(p).y0<CUR.info.yUp-1); else drawKitchenElev(); }
  else drawOrtho(v,noFac);
  // подпись выделенного и легенда
  const p=CUR.parts[SEL.part], si=$("selInfo");
  if(p){ let mn=""; if(mode==="kitchen"&&p.mod){ const all=CUR.info.walls.flatMap(w=>w.low.concat(w.up)), m=all.find(x=>x.key===p.mod); mn = m?`${m.name} ${m.w} · `:/^c/.test(p.mod)?"Угловой модуль · ":""; }
    si.innerHTML=`<b>${esc(mn)}${esc(p.name)}</b> · ${esc(matName(p.mat))} · ${p.a}×${p.b} мм`; }
  else si.textContent = "Нажмите на деталь, чтобы увидеть размер. Правый клик (на телефоне - долгое нажатие) - меню: "+(mode==="univ"?"убрать, поставить дверь, полку, ящик.":mode==="kitchen"?"заменить, убрать, дверцы или ящики.":"полки, ящики, двери.");
  const used=[...new Set(CUR.parts.filter(p=>!MAT(p.mat).virt).map(p=>p.mat))];
  $("legend").innerHTML=used.map(m=>`<span><i style="background:${MAT(m).css}"></i>${esc(matName(m))}</span>`).join("")+
    (use3d?`<span>оси: <b style="color:#d33">X</b> <b style="color:#3a3">Y</b> <b style="color:#33d">Z</b></span>`:"");
  drawMini(use3d);
}
// Маленький эскиз для телефона: копия плоского вида. Если открыт 3D - рисуем вид спереди.
function drawMini(use3d){
  const mini=$("mini"); if(!mini || !window.matchMedia("(max-width:939px)").matches) return;
  const sk=$("sketch"), ms=$("miniSvg");
  if(!mini.classList.contains("off")){
    if(use3d){
      const keepV=sk.getAttribute("viewBox"), keepH=sk.innerHTML;
      if(S.mode==="kitchen") drawKitchenElev(); else drawOrtho("front",null);
      ms.setAttribute("viewBox",sk.getAttribute("viewBox")); ms.innerHTML=sk.innerHTML;
      if(keepV) sk.setAttribute("viewBox",keepV); sk.innerHTML=keepH;
    } else { ms.setAttribute("viewBox",sk.getAttribute("viewBox")||"0 0 100 40"); ms.innerHTML=sk.innerHTML; }
  }
  $("miniTitle").textContent=CUR.title; $("miniTotal").textContent=CUR.quote&&priceState()==="ok"?money(CUR.quote.total):"";
}

// ================= РЕЖИМЫ И СТРАНИЦЫ =================
function setMode(m){
  PAGE = (m==="price"||m==="lib") ? m : "calc";
  if(PAGE==="calc") S.mode=m;
  document.querySelectorAll("#modeBar [data-mode]").forEach(b=>{ const on=b.dataset.mode===m; b.classList.toggle("on",on); if(!b.classList.contains("tool")) b.classList.toggle("off",!on); });
  $("calcView").classList.toggle("hide",PAGE!=="calc"); $("priceView").classList.toggle("hide",PAGE!=="price"); $("libView").classList.toggle("hide",PAGE!=="lib");
  $("mbar").classList.toggle("hide",PAGE!=="calc");
  if(PAGE==="price"){ renderPricePage(); return; }
  if(PAGE==="lib"){ renderLibPage(); return; }
  $("kupeForm").classList.toggle("hide",m!=="kupe"); $("kitchenForm").classList.toggle("hide",m!=="kitchen"); $("univForm").classList.toggle("hide",m!=="univ");
  SEL={part:-1,mod:null};
  refreshBinds();
  if(m==="kupe") renderKupeForm();
  if(m==="kitchen") renderKitchenForm();
  if(m==="univ"){ if(!S.u.built) { const r=(ensureTpl(),buildUniv(S.u)); S.u.panels=r.parts; S.u.hw=r.hw; S.u.built=true; } renderUniv(); }
  renderExtras(); renderViewTabs();
  if(R3) R3.needFit=true;
  calc();
}
