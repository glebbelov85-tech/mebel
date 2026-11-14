// ================= ОКНА, ПОДСКАЗКИ, БУФЕР =================
function toast(t){ const e=$("toast"); e.textContent=t; e.classList.add("on"); clearTimeout(toast.t); toast.t=setTimeout(()=>e.classList.remove("on"),2600); }
async function copy(text,msg){
  try{ await navigator.clipboard.writeText(text); toast(msg||"Скопировано"); $("fallback").style.display="none"; }
  catch(e){
    if(PAGE!=="calc"){ openModal("Скопируйте текст",`<textarea rows="12" readonly id="cpTa"></textarea><p class="note">Выделите всё (Ctrl+A) и скопируйте (Ctrl+C).</p>`,()=>{ const t=$("cpTa"); t.value=text; t.select(); }); return; }
    const f=$("fallback"); f.value=text; f.style.display="block"; f.select(); toast("Выделите текст ниже и скопируйте");
  }
}
function openModal(title,html,onMount,opt){
  $("modalHost").innerHTML=`<div class="modal" id="modal"><div class="box" style="${opt&&opt.wide?"":"max-width:560px"}"><div class="mh"><b>${esc(title)}</b><button class="bx" id="modalX" title="Закрыть">&times;</button></div>${html}</div></div>`;
  $("modalX").onclick=closeModal;
  $("modal").addEventListener("mousedown",e=>{ if(e.target.id==="modal") closeModal(); });
  if(onMount) onMount();
}
function closeModal(){ $("modalHost").innerHTML=""; }
function confirmBox(text,yes,fn){
  openModal("Подтвердите",`<p style="margin:0 0 4px">${esc(text)}</p><div class="btns"><button class="b1" id="cfYes">${esc(yes)}</button><button class="b2" id="cfNo">Отмена</button></div>`,()=>{
    $("cfNo").onclick=closeModal; $("cfYes").onclick=()=>{ closeModal(); fn(); };
  });
}

// ================= БИБЛИОТЕКА МОДУЛЕЙ =================
function thumbSvg(t){
  const d=modDef(t); if(!d) return "";
  const c=kitCtx(kitDefaults()), b=Builder(); try{ d.gen(b,c,LIB.w[t]||d.w); }catch(e){}
  const keep=SEL; SEL={part:-1,mod:null};
  const items=projItems(b.ps,"front",null).map(r=>Object.assign(r,{i:-2}));
  let out;
  if(!items.length) out=`<svg viewBox="0 0 100 60"><rect x="20" y="8" width="60" height="44" fill="none" stroke="#9a8f84" stroke-dasharray="4 3"/></svg>`;
  else { const e=ext(items), W=e.u1-e.u0, H=e.s1-e.s0, pad=30; out=`<svg viewBox="${e.u0-pad} ${-e.s1-pad} ${W+pad*2} ${H+pad*2}">${SVG_DEFS}${svgRects(items,Math.max(W,H)/130,0,0)}</svg>`; }
  SEL=keep; return out;
}
function openPicker(row,onPick){
  const ids=modsOf(null,row), groups={};
  ids.forEach(t=>{ const d=modDef(t), g=d.custom?"Мои модули":CAT_NAMES[d.cat]; (groups[g]=groups[g]||[]).push(t); });
  openModal(row==="lower"?"Добавить нижний модуль или пенал":"Добавить верхний модуль",
    Object.keys(groups).map(g=>`<h3 style="margin:8px 0 6px;font-size:13px;color:var(--wood-d)">${g}</h3><div class="mgrid">${groups[g].map(t=>{ const d=modDef(t); return `<button class="mcard" data-t="${t}">${thumbSvg(t)}<b>${esc(d.name)}</b><small>${modDefW(t)} мм</small></button>`; }).join("")}</div>`).join("")+
    `<p class="note">Ширину модуля можно поменять после добавления. Свои привычные ширины задаются на вкладке "Модули".</p>`,
    ()=>{ $("modal").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{ closeModal(); onPick(b.dataset.t); }); },{wide:true});
}
function renderLibPage(){
  const box=$("libBody"); let h="";
  ["low","tall","up"].forEach(cat=>{
    h+=`<h3>Кухня: ${CAT_NAMES[cat].toLowerCase()}</h3><div class="mgrid">`;
    Object.keys(MODLIB).filter(t=>MODLIB[t].cat===cat).forEach(t=>{ const d=MODLIB[t], hid=!!LIB.hidden[t];
      h+=`<div class="mcard ${hid?"off2":""}" data-t="${t}">${thumbSvg(t)}<b>${esc(d.name)}</b>
        <div class="mrow2"><input type="number" step="50" min="20" max="1500" data-lw="${t}" value="${LIB.w[t]||d.w}" title="Ширина по умолчанию, мм"><button class="b2" data-lh="${t}">${hid?"показать":"скрыть"}</button></div></div>`; });
    h+=`</div>`;
  });
  h+=`<h3>Мои модули</h3>`;
  if(!LIB.custom.length) h+=`<p class="note" style="margin-top:0">Пока пусто. Откройте "Любое изделие", соберите модуль (по шаблону или вручную) и нажмите "Сохранить как мой модуль".</p>`;
  else h+=`<div class="mgrid">`+LIB.custom.map(cm=>`<div class="mcard" data-t="${cm.id}">${thumbSvg(cm.id)}<input data-ln="${cm.id}" value="${esc(cm.name)}" style="padding:5px;font-size:13px;text-align:center">
      <small>${cm.w}×${cm.h}×${cm.d} мм, деталей: ${cm.parts.length}</small>
      <select data-lc="${cm.id}" style="padding:5px;font-size:13px">${CM_CATS.map(([k,n])=>`<option value="${k}" ${cm.cat===k?"selected":""}>${n}</option>`).join("")}</select>
      <div class="mrow2"><button class="b2" data-lo="${cm.id}">открыть</button><button class="b2" data-ld="${cm.id}">удалить</button></div></div>`).join("")+`</div>`;
  box.innerHTML=h;
}
const CM_CATS=[["low","Кухня: нижний"],["tall","Кухня: пенал"],["up","Кухня: верхний"],["other","Только шаблон"]];
function initLibPage(){
  const box=$("libBody");
  box.addEventListener("change",e=>{
    const t=e.target;
    if(t.dataset.lw){ const v=clamp(+t.value||0,20,1500); if(v===MODLIB[t.dataset.lw].w) delete LIB.w[t.dataset.lw]; else LIB.w[t.dataset.lw]=v; saveLib(); renderLibPage(); }
    if(t.dataset.ln){ const cm=LIB.custom.find(x=>x.id===t.dataset.ln); cm.name=t.value.trim()||cm.name; saveLib(); }
    if(t.dataset.lc){ const cm=LIB.custom.find(x=>x.id===t.dataset.lc); cm.cat=t.value; saveLib(); }
  });
  box.addEventListener("click",e=>{
    const t=e.target.closest("button"); if(!t) return;
    if(t.dataset.lh){ const k=t.dataset.lh; if(LIB.hidden[k]) delete LIB.hidden[k]; else LIB.hidden[k]=1; saveLib(); renderLibPage(); }
    if(t.dataset.lo){ S.u.tpl="cm:"+t.dataset.lo; delete S.u.prms[S.u.tpl]; ensureTpl(); const r=buildUniv(S.u); S.u.panels=r.parts; S.u.hw=r.hw; S.u.manual=false; S.u.built=true; setMode("univ"); }
    if(t.dataset.ld){ const cm=LIB.custom.find(x=>x.id===t.dataset.ld); confirmBox(`Удалить модуль "${cm.name}"? В кухнях, где он стоит, появится предупреждение.`,"Удалить",()=>{ LIB.custom=LIB.custom.filter(x=>x!==cm); saveLib(); renderLibPage(); }); }
  });
}
function saveAsModule(){
  const ps=S.u.panels; if(!ps.length){ toast("В изделии нет деталей"); return; }
  const bb=bounds(ps);
  openModal("Сохранить как мой модуль",`<div class="field"><label>Название</label><input id="smName" value="${esc(tplName(S.u.tpl))} ${bb.W}"></div>
    <div class="field"><label>Где использовать</label><select id="smCat">${CM_CATS.map(([k,n])=>`<option value="${k}">${n}</option>`).join("")}</select></div>
    <p class="note">Размер ${bb.W}×${bb.H}×${bb.D} мм. В кухне ширину модуля можно будет менять: детали растянутся или сдвинутся. Для нижнего модуля кухни собирайте корпус без цоколя - он встанет на ножки, а столешница ляжет сверху.</p>
    <div class="btns"><button class="b1" id="smOk">Сохранить</button></div>`,()=>{
    $("smOk").onclick=()=>{
      const cm={id:uid("m_"), name:$("smName").value.trim()||"Мой модуль", cat:$("smCat").value, w:bb.W, h:bb.H, d:bb.D,
        parts:roundParts(xform(ps,XF.move(-bb.x0,-bb.y0,-bb.z0))), hw:clone(S.u.hw)};
      LIB.custom.push(cm); saveLib(); closeModal(); renderUniv(); toast("Модуль сохранён - он появился в списке шаблонов и в кухне");
    };
  });
}

// ================= СОХРАНЁННЫЕ РАСЧЁТЫ =================
const OLD_FAC={fac_ldsp:"ldsp16f",fac_film:"mdf",fac_plastic:"mdf_plastic",fac_enamel:"mdf_enamel"}, OLD_DOOR={ldsp:["ldsp10"],mirror:["mirror"],lacobel:["glass"],combo:["ldsp10","mirror"]};
function fixState(s){
  const d=defaultState();
  const r=Object.assign(d,s);
  r.kupe=Object.assign(kupeDefaults(),s.kupe||{}); r.kit=Object.assign(kitDefaults(),s.kit||{});
  r.u=Object.assign(defaultState().u,s.u||{}); r.view=Object.assign({kupe:"in",kitchen:"elev",univ:"3d"},s.view||{});
  r.extras=Array.isArray(s.extras)?s.extras:[];
  if(!["kupe","kitchen","univ"].includes(r.mode)) r.mode="kupe";
  if(!LAYOUTS[r.kit.layout]) r.kit.layout="1";
  return r;
}
// расчёты из прошлой версии калькулятора
function migrateState(s){
  if(!s||typeof s!=="object") return null;
  if(s.v===2) return fixState(s);
  const n=defaultState(), num=(v,d)=>isFinite(+v)&&v!==""&&v!=null?+v:d;
  n.mode=["kupe","kitchen","univ"].includes(s.mode)?s.mode:"kupe"; n.client=s.client||""; n.decor=s.decor||"";
  n.disc=num(s.disc,0); n.prepay=num(s.prepay,50); n.days=num(s.days,14); n.extras=Array.isArray(s.extras)?s.extras:[];
  const k=n.kupe; ["W","H","D","N","DH","M"].forEach(f=>k[f]=num(s[f],k[f])); ["ant","back","led"].forEach(f=>{ if(f in s) k[f]=!!s[f]; });
  if(s.type) k.type=s.type; if(s.prof) k.prof=s.prof;
  if(Array.isArray(s.secs)) s.secs.forEach((x,i)=>k.secs[i]={shelves:num(x.shelves,0),rod:!!x.rod,drawers:num(x.drawers,0),w:0});
  if(Array.isArray(s.doors)) s.doors.forEach((x,i)=>k.doors[i]={segs:(OLD_DOOR[x]||["ldsp10"]).slice()});
  const K=n.kit; K.layout=({"1":"1","2":"2R","3":"3"})[s.k_layout]||K.layout;
  K.fac=OLD_FAC[s.k_fac]||K.fac; K.top=s.k_top==="top_ldsp"?"top38":(MATS[s.k_top]?s.k_top:K.top); if(s.k_handles) K.handles=s.k_handles;
  K.Hl=num(s.k_Hl,K.Hl); K.Hu=num(s.k_Hu,K.Hu); K.Ht=num(s.k_Ht,K.Ht); K.cutSink=num(s.k_cutSink,1); K.cutHob=num(s.k_cutHob,1);
  ["apron","tplinth","led"].forEach(f=>{ if(("k_"+f) in s) K[f]=!!s["k_"+f]; });
  if(Array.isArray(s.walls)) s.walls.forEach((w,i)=>{
    if(!w||i>2) return;
    const conv=l=>(l||[]).filter(m=>m.t!=="corner"&&m.t!=="u_corner").map(m=>({t:OLD_MODS[m.t]||"l_shelf",w:num(m.w,600)}));
    // в старой версии П-образная кухня шла "стена 1, 2, 3"; теперь третья стена - левая, её ряд читается слева направо, угол в конце
    const wi=i===2?2:i; K.walls[wi]={len:num(w.len,2400), lower:conv(w.lower), upper:conv(w.upper)};
    if(i===2){ K.walls[2].lower.reverse(); K.walls[2].upper.reverse(); }
  });
  if(s.u){ const u=n.u; u.tpl=TPL[s.u.tpl]?s.u.tpl:"cab"; Object.assign(u.prms,s.u.prms||{}); u.manual=!!s.u.manual; u.built=!!s.u.built;
    u.panels=(s.u.panels||[]).map(p=>Object.assign({},p,MAT(p.mat).facade?{f:1}:{})); u.hw=(s.u.hw||[]).map(h=>({name:h.name,q:+h.q||0,p:+h.p||0})); }
  return n;
}
function savedList(){
  let l=LS.get("mk2_saved",null);
  if(!l){ l=(LS.get("kupe_saved",[])||[]).map(x=>({name:x.name,date:x.date,total:x.total,state:migrateState(x.state)})).filter(x=>x.state); if(l.length) LS.set("mk2_saved",l); }
  return l||[];
}
function renderSaved(){
  const list=savedList(), box=$("savedList");
  if(!list.length){ box.innerHTML=`<p class="note">Пока пусто.</p>`; return; }
  box.innerHTML=list.map((x,i)=>`<div class="saved"><span>${esc(x.name)}<small>${esc(x.date)} · ${money(x.total,x.cur||"KZT")}</small></span>
    <button class="b2 small" data-open="${i}">Открыть</button><button class="bx" data-del="${i}" title="Удалить">&times;</button></div>`).join("");
  box.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{ const x=list[+b.dataset.open]; loadState(x.state); toast((x.cur||"KZT")!==CURCODE?`Расчёт открыт и пересчитан по прайсу в ${curIn()} (был в ${curIn(x.cur||"KZT")})`:"Расчёт открыт"); window.scrollTo({top:0,behavior:"smooth"}); });
  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ const x=list[+b.dataset.del]; confirmBox(`Удалить расчёт "${x.name}"?`,"Удалить",()=>{ list.splice(+b.dataset.del,1); LS.set("mk2_saved",list); renderSaved(); }); });
}
function loadState(st){
  S=fixState(clone(st)); SEL={part:-1,mod:null};
  setMode(S.mode);
}
function saveCalc(){
  const total=calc(), list=savedList();
  list.unshift({name:(clientParts().name||"Без имени")+" - "+CUR.title, date:today(), total, cur:CURCODE, state:clone(S)});
  if(!LS.set("mk2_saved",list.slice(0,80))) toast("Не получилось сохранить: в браузере нет места"); else toast("Расчёт сохранён");
  renderSaved();
}

// ================= РЕЗЕРВНАЯ КОПИЯ =================
function backupSave(){
  const prices={}; curList().forEach(c=>{ const st=LS.get(priceKey(c.code),null); if(st&&Array.isArray(st.items)) prices[c.code]=st; });
  const data={app:"mebel-calc",v:3,date:new Date().toISOString(),cur:CURCODE,price:PRICE,prices,lib:LIB,saved:savedList(),current:S};
  const txt=JSON.stringify(data);
  saveFile(`mebel-kopiya-${new Date().toISOString().slice(0,10)}.json`,txt,txt);
}
function backupLoad(text){
  let d; try{ d=JSON.parse(text); }catch(e){ toast("Это не файл резервной копии"); return; }
  if(d && d.format==="mebel-order"){ importOrder(d); return; }
  if(!d || d.app!=="mebel-calc"){ toast("Это не файл резервной копии калькулятора"); return; }
  confirmBox(`Восстановить копию от ${String(d.date||"").slice(0,10)}? Текущий прайс, модули и сохранённые расчёты будут заменены.`,"Восстановить",()=>{
    if(d.prices){ for(const c in d.prices) if(d.prices[c]&&Array.isArray(d.prices[c].items)) LS.set(priceKey(c),d.prices[c]); }
    else if(Array.isArray(d.price)) LS.set(priceKey(d.cur||"KZT"),{v:3,cur:d.cur||"KZT",items:d.price});
    loadPrice(CURCODE);
    if(d.lib){ LIB=Object.assign({w:{},hidden:{},custom:[]},d.lib); saveLib(); }
    if(Array.isArray(d.saved)) LS.set("mk2_saved",d.saved);
    if(d.current) S=fixState(d.current);
    renderSaved(); renderPricePage(); toast("Копия восстановлена");
  });
}

// ================= ФАЙЛ ЗАКАЗА (общий формат mebel-order 1.1) =================
const ROLE_RX=[[/ящик/,"drawer"],[/боков|стойк/,"side"],[/крыш/,"top"],[/дно/,"bottom"],[/полк/,"shelf"],[/перегород/,"partition"],[/задн/,"back"],[/цокол/,"plinth"],[/столешн/,"countertop"],[/заглушк|планк/,"filler"]];
function orderEdges(p,edgeId){
  const sides={X:[["front","back"],["top","bottom"]],Y:[["front","back"],["left","right"]],Z:[["top","bottom"],["left","right"]]}[p.o], n=clamp(+p.edge||0,0,4);
  if(!n) return undefined;
  const lg=p.a>=p.b?sides[0]:sides[1], sh=p.a>=p.b?sides[1]:sides[0], ord=[lg[0],lg[1],sh[0],sh[1]], out={};
  for(let i=0;i<n;i++) out[ord[i]]=edgeId;
  return out;
}
function toOrder(){
  const R0=CUR, q=R0.quote, now=new Date().toISOString();
  const cat={materials:{},edges:{},hardware:{}};
  const useMat=id=>{ const m=MATS[id], it=PI[id]; if(!m||m.virt||cat.materials[id]) return;
    cat.materials[id]={name:it.name, group:m.kind==="sheet"?(m.t<=4?"dvp":"ldsp"):m.kind==="length"?"top":(m.t<=6?"glass":"mdf"), kind:m.kind, t:m.t, price:+it.v||0, color:m.css};
    if(m.kind==="sheet"){ cat.materials[id].sheet={w:m.sw,h:m.sh}; cat.materials[id].grain=m.t>4; if(m.cut) cat.materials[id].cut=true; if(m.usage) cat.materials[id].usagePct=m.usage; if(m.edge) useEdge(m.edge); }
  };
  const useEdge=id=>{ const it=PI[id]; if(it && !cat.edges[id]) cat.edges[id]={name:it.name, t:id==="edge2"?2:0.4, w:19, price:+it.v||0}; };
  const fin = R0.type==="kitchen" ? {corpus:R0.info.c.body, facade:R0.info.c.fac, top:R0.info.c.top, back:"dvp"} : R0.type==="kupe" ? {corpus:MATS[S.kupe.body]?S.kupe.body:"ldsp16", back:"dvp"} : {};
  Object.values(fin).forEach(useMat);
  if(fin.corpus && MATS[fin.corpus].edge) fin.edge=MATS[fin.corpus].edge;
  let n=0;
  const parts=R0.parts.filter(p=>!MAT(p.mat).virt && p.a>0 && p.b>0).map(p=>{
    useMat(MATS[p.mat]?p.mat:"ldsp16");
    const m=MAT(p.mat), nm=p.name.toLowerCase(), role = p.f?"facade":(ROLE_RX.find(r=>r[0].test(nm))||[0,"other"])[1];
    const ref = p.f && p.mat===fin.facade ? "@facade" : p.mat===fin.top ? "@top" : p.mat===fin.back ? "@back" : p.mat===fin.corpus ? "@corpus" : (MATS[p.mat]?p.mat:"ldsp16");
    const o={id:"p"+(++n), name:p.name, role, mat:ref, o:p.o, x:p.x, y:p.y, z:p.z, a:p.a, b:p.b};
    const e = m.kind==="sheet" && m.edge ? orderEdges(p, m.edge===fin.edge && ref[0]==="@" ? "@edge" : m.edge) : undefined;
    if(e) o.edges=e;
    if(p.mod) o.mod=p.mod;
    return o;
  });
  const hardware=R0.hw.filter(h=>h.q>0).map(h=>{ const o={name:h.name, qty:r1(h.q), unit:(h.u||hwUnit(h.id)).replace(/\.$/,""), price:hwPrice(h)};
    if(h.id && PI[h.id]){ cat.hardware[h.id]={name:PI[h.id].s||PI[h.id].name, unit:PI[h.id].u.replace(/\.$/,""), price:+PI[h.id].v||0}; if(h.p===undefined) o.item=h.id; } return o; });
  const bb=bounds(R0.parts.filter(p=>!MAT(p.mat).virt));
  const extras=S.extras.filter(x=>x.q*x.p>0).map((x,i)=>({id:"x"+(i+1),kind:"item",name:x.name||"Своя позиция",qty:+x.q,unit:"шт",price:+x.p}));
  if(q.install>0) extras.push({id:"xi",kind:"install",name:q.installName,qty:1,unit:"усл",price:q.install});
  const lines=q.rows.map(r=>({group:"material",name:r[0],qty:parseFloat(r[1])||1,unit:String(r[1]).replace(/^[\d.,\s]+/,"")||"шт",price:Math.round(r[2]/(parseFloat(r[1])||1)),sum:Math.round(r[2])}));
  const total=q.total, step=total%100===0?100:1, sub=q.disc?Math.ceil(total/(1-q.disc/100)/step-1e-9)*step:total, cl=clientParts();
  return {format:"mebel-order", version:"1.1", id:"o_"+Date.now().toString(36), number:"", title:R0.title, createdAt:now, updatedAt:now, currency:CURCODE, country:COUNTRY, units:"mm", stage:"lead",
    client:{name:cl.name, phone:cl.phone, address:""},
    products:[{id:"pr1", type:R0.type, name:R0.title, qty:1, size:{w:bb.W,h:bb.H,d:bb.D}, finish:fin, params:clone(R0.type==="kupe"?S.kupe:R0.type==="kitchen"?S.kit:{tpl:S.u.tpl,prms:S.u.prms[S.u.tpl]}),
      generator:{id:"calc."+R0.type,version:"2"}, modules:[], parts, hardware, describe:R0.desc.split("\n")}],
    catalog:cat, extras,
    pricing:{workPct:P.work, markupPct:P.markup, discountPct:q.disc, prepayPct:q.prepay, roundTo:P.round||1, sheetUsagePct:P.usage, ...(P.nest?{sheetMode:"nest"}:{}), edgeReservePct:10, cutPerSheet:P.cut, ...(q.instNoMk&&q.install>0?{markupServices:false}:{})},
    quote:{calcAt:now, currency:CURCODE, lines, materials:Math.round(q.mat), work:Math.round(q.work), services:Math.round(q.install), cost:Math.round(q.cost), markup:Math.round(q.markup),
      clientLines:[{kind:"product",ref:"pr1",name:R0.title,qty:1,unit:"шт",sum:sub}], subtotal:sub, discountPct:q.disc, discountSum:sub-total, total, prepayPct:q.prepay, prepaySum:q.pre, profit:Math.round(total-q.cost)},
    terms:{days:q.days, daysKind:q.daysKind, warrantyMonths:12}, notes:S.decor?("Цвет: "+S.decor):"",
    x:{calculator:{v:2,state:clone(S)}}};
}
function exportOrder(){
  const o=toOrder(), txt=JSON.stringify(o,null,1);
  const nm=(clientParts().name||CUR.title).replace(/[^\wа-яА-ЯёЁ\- ]+/g,"").trim().replace(/\s+/g,"-").slice(0,40)||"zakaz";
  saveFile(`${nm}.mebel.json`,txt,txt);
}
// Соответствие материалов и фурнитуры общего формата позициям прайса калькулятора
const ORD_MAT={dvp3:"dvp","mdf18-film":"mdf","mdf18-plastic":"mdf_plastic","mdf18-enamel":"mdf_enamel",mirror4:"mirror","mirror4-tint":"mirror_t",lacobel4:"glass","top-compact":"top_compact","top-stone":"top_stone","ldsp16-fasad":"ldsp16f"};
const ORD_HW={"prof-eco":"prof_eco","prof-std":"prof_std","prof-prem":"prof_prem"};
const ORD_HW_RX=[[/^цоколь кухни/i,"plinth"],[/^вырез под мойку/i,"cutout"],[/^стык столешниц/i,"topjoin"],[/^плинтус столешницы/i,"tplinth"]];
function orderMatId(id,m,facade){
  if(MATS[id] && !MATS[id].virt) return id;
  if(ORD_MAT[id] && MATS[ORD_MAT[id]]) return ORD_MAT[id];
  if(!m) return facade?"ldsp16f":"ldsp16";
  if(m.kind==="length") return m.t<=20?"top_compact":"top38";
  if(m.kind==="area") return m.group==="glass" ? (/зеркал/i.test(m.name||"")?"mirror":"glass") : "mdf";
  return m.t<=6?"dvp" : m.t<=12?"ldsp10" : facade?"ldsp16f":"ldsp16";
}
// Заказ из другого инструмента (конфигуратор, учёт, КП): детали, фурнитура, услуги и условия переносятся в "Любое изделие".
// Цены берутся из прайса мастера; у позиций, которых в прайсе нет, остаётся цена из заказа.
function importOrder(o){
  const st=o.x&&o.x.calculator&&o.x.calculator.state;
  const oc=o.currency||CURCODE, curNote = oc!==CURCODE ? ` Он был посчитан в ${curIn(oc)}, цены взяты из вашего прайса в ${curIn()}.` : "";
  if(st){ loadState(migrateState(st)); toast("Заказ открыт."+curNote); return; }
  const prods=(o.products||[]).filter(p=>p&&typeof p==="object"); if(!prods.length){ toast("В файле заказа нет изделий"); return; }
  const cv=v=>{ v=+v||0; return oc===CURCODE||!MO ? v : Math.round(MO.convert(v,oc,CURCODE)); };
  const ps=[], hw=[], hwBy={}; let X0=0, loose=0, apronM=0;
  const addHw=(id,name,q,p,u)=>{ if(!(q>0)) return; const key=id||(name+"|"+p);
    if(hwBy[key]){ hwBy[key].q=r1(hwBy[key].q+q); return; }
    hw.push(hwBy[key]=id?{id,name:hwName(id),q:r1(q)}:{name:name||"Позиция",q:r1(q),p,u:u||"шт."}); };
  prods.forEach(pr=>{
    const kitchen=pr.type==="kitchen", n=clamp(Math.round(+pr.qty||1),1,20);
    const list=[]; MO.eachPart({products:[pr],catalog:o.catalog},e=>list.push(e));
    let x0=Infinity, x1=-Infinity, z0=Infinity; const boxes=list.map(e=>{ const b=MO.partBox(o,pr,e.module,e.part); if(b){ x0=Math.min(x0,b.x0); x1=Math.max(x1,b.x1); z0=Math.min(z0,b.z0); } return b; });
    if(!isFinite(x0)){ x0=0; x1=0; z0=0; }
    for(let c=0;c<n;c++){
      const dx=X0-x0; let stackY=0;
      list.forEach((e,i)=>{
        const p=e.part, m=MO.getMaterial(o,pr,p.mat), fac=p.role==="facade";
        if(!(p.a>0&&p.b>0)) return;
        const apron=p.role==="apron"||(m&&m.group==="apron");
        const mat=apron?"_apron":orderMatId(m?m.id:String(p.mat||""),m,fac), t=MAT(mat).t;
        if(apron) apronM+=Math.max(p.a,p.b)/1000;
        // кромка: в калькуляторе это код 0-4, берём тот, что ближе всего к настоящей длине кромки детали
        let edge=0; if(!apron && p.edges){ const el=MO.partEdgeLength(o,pr,p); let real=0; for(const k in el) real+=el[k];
          if(real>0){ let best=1e9; for(let c2=1;c2<=4;c2++){ const d=Math.abs(edgeLen({a:p.a,b:p.b,edge:c2})-real); if(d<best-0.5){ best=d; edge=c2; } } } }
        const base={name:p.name||"Деталь", mat, edge};
        if(fac) base.f=1;
        if(m && m.t>0 && Math.abs(m.t-t)>0.5 && !apron) base.t=m.t;
        const b=boxes[i]; let q;
        if(b){ const rot=e.module?(((+e.module.rot||0)%360)+360)%360:0, o2=(rot===90||rot===270)?(p.o==="X"?"Z":p.o==="Z"?"X":"Y"):p.o;
          q=fromBox(base,{x0:b.x0+dx,x1:b.x1+dx,y0:b.y0,y1:b.y1,z0:b.z0-z0,z1:b.z1-z0},o2); }
        else { q=Object.assign(base,{o:"Y",x:X0+(x1-x0)+100,y:stackY,z:0,a:p.a,b:p.b}); stackY+=(base.t||t)+2; loose++; }
        ["x","y","z","a","b"].forEach(k=>q[k]=r1(q[k]));
        ps.push(q);
      });
      MO.eachHardware({products:[pr]},e=>{
        const h=MO.getHardware(o,e.line), it=h.item;
        let id = it && (ORD_HW[it] || (it==="fasteners" ? (kitchen?"kmisc":null) : (PI[it]&&!MATS[it]?it:null)));
        if(!id){ const r=ORD_HW_RX.find(r=>r[0].test(h.name)); if(r) id=r[1]; }
        if(id && !PI[id]) id=null;
        addHw(id,h.name,h.qty,cv(h.price),h.unit);
      });
      X0+=(x1-x0)+300;
    }
  });
  if(apronM>0) addHw("apron","",Math.ceil(apronM*10-1e-9)/10);
  const keep={client:S.client,phone:S.phone};
  SEL={part:-1,mod:null}; S.decor="";
  S.u.tpl="empty"; S.u.panels=ps; S.u.hw=hw; S.u.manual=true; S.u.built=true;
  S.u.title=String(prods.length===1?(prods[0].name||o.title||""):(o.title||prods.map(p=>p.name).filter(Boolean).join(" + "))).slice(0,60);
  let inst=0; S.extras=[];
  (o.extras||[]).forEach(x=>{ if(!x||typeof x!=="object") return; const q=x.qty==null?1:+x.qty||0, p=cv(x.price);
    if(!(q*p>0)) return;
    if(x.kind&&x.kind!=="item") inst+=q*p; else S.extras.push({name:x.name||"Своя позиция",q,p}); });
  S.install=Math.round(inst);
  const pc=o.pricing||{}, tm=o.terms||{};
  S.disc=clamp(+pc.discountPct||0,0,90); S.prepay=pc.prepayPct==null?50:clamp(+pc.prepayPct||0,0,100);
  S.instNoMk=pc.markupServices===false;
  if(+tm.days>0) S.days=Math.round(+tm.days); S.daysKind=tm.daysKind==="calendar"?"calendar":"work";
  const cl=o.client||{};
  S.client=cl.name||keep.client||""; S.phone=cl.phone||(cl.name?"":keep.phone)||"";
  const dm=/^Цвет:\s*(.+)$/m.exec(o.notes||""); if(dm) S.decor=dm[1].trim();
  setMode("univ");
  toast(`Заказ открыт в режиме "Любое изделие": деталей - ${ps.length}, цены из вашего прайса.`+(loose?` Деталей без координат - ${loose}, они сложены стопкой рядом.`:"")+curNote);
}
function partsXlsx(){
  const rows=[["Материал","Деталь","Длина, мм","Ширина, мм","Кромка","Шт."]].concat(CUR.cut.map(r=>[r.matName,r.name,r.L,r.S,MAT(r.mat).kind==="sheet"?EDGES[r.edge]:"",r.q]));
  saveTable("spisok-detalej.xlsx","Детали",rows,[22,34,11,11,14,6]);
}
function toUniv(){
  const src=CUR;
  S.u.tpl="empty"; S.u.panels=clone(src.parts).map(p=>{ delete p.mod; delete p.w; return p; }); S.u.hw=clone(src.hw).map(h=>Object.assign(h,{q:r1(h.q)}));
  S.u.title=src.type==="kitchen"?"Кухня":src.type==="kupe"?"Шкаф-купе":(S.u.title||"");
  S.u.manual=true; S.u.built=true; setMode("univ"); window.scrollTo({top:0}); toast("Детали перенесены - теперь их можно править по одной");
}
