// ================= ШАБЛОНЫ И ПОКАЗ КЛИЕНТУ =================
// Готовые шаблоны - это фразы: их можно подставить в "Описать словами", дополнить голосом и собрать.
// Свои шаблоны - снимок текущего изделия (localStorage mk2_tpl), открываются сразу.
const TPL_BUILTIN = [
  {name:"Кухня прямая 2,4 м", text:"Прямая кухня 2 метра 40, холодильник отдельно, посудомойка 45"},
  {name:"Кухня прямая 3 м с пеналами", text:"Прямая кухня 3 метра 60, встроенный холодильник, духовка в пенале, посудомойка 60"},
  {name:"Угловая 3 × 2 м", text:"Угловая кухня, основная стена 3 метра, вторая 2 метра, посудомойка 60, холодильник отдельно"},
  {name:"Угловая 3,6 × 1,8 м с пеналом", text:"Угловая кухня, основная стена 3 метра 60, вторая 1 метр 80, встроенный холодильник, посудомойка 60, верхние 900"},
  {name:"П-образная", text:"П-образная кухня, основная 3 метра, левая 2 метра, правая 2 метра, посудомойка 60, холодильник отдельно"},
  {name:"Купе 2,4 м корпусный", text:"Шкаф-купе корпусный, ширина 2 метра 40, высота 2 метра 40, глубина 60 см, две двери, зеркало и ЛДСП"},
  {name:"Купе в нишу 2,7 м", text:"Шкаф-купе в нишу, ширина 2 метра 70, высота 2 метра 60, глубина 60 см, три двери, зеркало по центру, 4 ящика"},
  {name:"Шкаф распашной", text:"Шкаф распашной ширина 80 см, высота 2 метра, глубина 50 см, две двери"},
  {name:"Комод", text:"Комод ширина 90 см, высота 90 см, глубина 45 см, 4 ящика"},
  {name:"Тумба под ТВ", text:"Тумба под телевизор 1800 на 450 на 400, две двери"},
  {name:"Прихожая", text:"Прихожая ширина 1 метр 60, высота 2 метра 20, глубина 40 см"}
];
const MODE_NAMES = {kitchen:"Кухня", kupe:"Шкаф-купе", univ:"Изделие"};
function tplList(){ return LS.get("mk2_tpl",[])||[]; }
function tplSave(name){
  name=String(name||"").trim(); if(!name) return null;
  const m=S.mode, data = m==="kitchen"?clone(S.kit) : m==="kupe"?clone(S.kupe) : clone({tpl:S.u.tpl,prms:S.u.prms,panels:S.u.panels,hw:S.u.hw,manual:S.u.manual,built:S.u.built});
  const list=tplList().filter(x=>x.name.toLowerCase()!==name.toLowerCase());
  list.unshift({id:Date.now().toString(36), name, mode:m, data, at:new Date().toISOString().slice(0,10)});
  LS.set("mk2_tpl",list.slice(0,60)); return name;
}
function tplApply(t){
  ED.undo.push(JSON.stringify(S)); if(ED.undo.length>40) ED.undo.shift();
  if(t.mode==="kitchen") S.kit=clone(t.data); else if(t.mode==="kupe") S.kupe=clone(t.data); else Object.assign(S.u,clone(t.data));
  SEL={part:-1,mod:null}; setMode(t.mode);
}
function tplFind(q){ q=vNorm(q).trim(); if(!q) return null; const all=tplList();
  return all.find(x=>vNorm(x.name).trim()===q) || all.find(x=>vNorm(x.name).includes(q)) || all.find(x=>q.includes(vNorm(x.name).trim())) || null; }
// ряд шаблонов в окне "Описать словами"
function renderTplRow(onPick){
  const box=$("voTpl"); if(!box) return;
  const own=tplList();
  box.innerHTML=`<div class="tpl-h">Быстрый старт - шаблон, дальше можно дополнить голосом:</div><div class="chips tpl-chips">${TPL_BUILTIN.map((t,i)=>`<button data-tb="${i}">${esc(t.name)}</button>`).join("")}</div>`+
    (own.length?`<div class="tpl-h">Мои шаблоны (открываются сразу):</div><div class="chips tpl-chips">${own.map(t=>`<span class="tpl-own"><button data-to="${t.id}" title="${esc(MODE_NAMES[t.mode]||"")}, сохранён ${esc(t.at||"")}">${esc(t.name)}</button><button class="bx" data-tdel="${t.id}" title="Удалить шаблон">&times;</button></span>`).join("")}</div>`:"");
  box.onclick=e=>{
    const b=e.target.closest("[data-tb],[data-to],[data-tdel]"); if(!b) return;
    if(b.dataset.tb!=null) onPick(TPL_BUILTIN[+b.dataset.tb].text);
    else if(b.dataset.to){ const t=tplList().find(x=>x.id===b.dataset.to); if(t){ voiceStopAll(); closeModal(); tplApply(t); toast("Открыт шаблон \""+t.name+"\""); } }
    else if(b.dataset.tdel){ const t=tplList().find(x=>x.id===b.dataset.tdel); if(t) confirmBox(`Удалить шаблон "${t.name}"?`,"Удалить",()=>{ LS.set("mk2_tpl",tplList().filter(x=>x.id!==t.id)); toast("Шаблон удалён"); }); }
  };
}
// команды шаблонов для панели правок: "сохрани как шаблон угловая белая", "открой шаблон угловая белая"
function tplCommand(t){
  let m=t.match(/^(сохрани|запомни|сохранить)[а-я]*( (это|проект|как))*( как)? шаблон[а-я]*\s*(.*)$/);
  if(m){ const name=(m[5]||"").trim()||((MODE_NAMES[S.mode]||"Проект")+" "+new Date().toLocaleDateString("ru-RU"));
    tplSave(name.charAt(0).toUpperCase()+name.slice(1)); return {ok:false, msg:[`Сохранил шаблон "${name}". Он появится в "Новый проект словами".`], errs:[]}; }
  m=t.match(/^(открой|возьми|загрузи|покажи)[а-я]* шаблон[а-я]*\s*(.*)$/);
  if(m){ const q=m[2]; const own=tplFind(q);
    if(own){ tplApply(own); return {ok:false, applied:true, msg:[`Открыл шаблон "${own.name}"`], errs:[]}; }
    const bi=TPL_BUILTIN.find(x=>vNorm(x.name).includes(vNorm(q).trim())||vNorm(q).split(" ").filter(w=>w.length>3).every(w=>vNorm(x.name+" "+x.text).includes(w.slice(0,5))));
    if(bi&&q.trim()){ const r=parseSpeech(bi.text); ED.undo.push(JSON.stringify(S)); r.apply(S); SEL={part:-1,mod:null}; setMode(r.mode); return {ok:false, applied:true, msg:[`Взял шаблон "${bi.name}"`], errs:[]}; }
    return {ok:false, msg:[], errs:[`Не нашёл шаблон "${q}"`]}; }
  return null;
}

// ---------- показ клиенту ----------
function clientShow(on){
  document.body.classList.toggle("show-client",on);
  if(on){
    calc();
    let card=$("clientCard");
    if(!card){ card=document.createElement("div"); card.className="card"; card.id="clientCard"; $("sketchCard").insertAdjacentElement("afterend",card); }
    const lines=lastClient.split("\n").filter(x=>x.trim());
    card.innerHTML=`<div class="cl-top"><h2 style="margin:0">Ваш проект</h2><button class="b2" id="clOut">Выйти из показа</button></div>
      <div class="cl-lines">${lines.map(x=>{ const i=x.indexOf(":"); return i>0&&i<30?`<div><span>${esc(x.slice(0,i))}</span><b>${esc(x.slice(i+1).trim())}</b></div>`:`<div class="cl-full">${esc(x.replace(/^- /,""))}</div>`; }).join("")}</div>
      <div class="btns"><a class="btn wa" target="_blank" rel="noopener" href="${$("wa").href}">Отправить клиенту в WhatsApp</a><button class="b2" id="clCopy">Скопировать текст</button></div>`;
    $("clOut").onclick=()=>clientShow(false);
    $("clCopy").onclick=()=>copy(lastClient);
    if(S.view[S.mode]!=="3d"){ S.view[S.mode]="3d"; renderViewTabs(); }
    if(typeof R3!=="undefined"&&R3) R3.needFit=true;
    drawSketch(); window.scrollTo({top:0});
  } else { if(typeof R3!=="undefined"&&R3) R3.needFit=true; drawSketch(); }
}
function showInit(){
  const b=document.createElement("button"); b.className="b2"; b.id="showBtn"; b.textContent="Показать клиенту";
  $("voiceBtn").insertAdjacentElement("afterend",b); b.onclick=()=>clientShow(true);
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&document.body.classList.contains("show-client")) clientShow(false); });
}
if(typeof setMode==="function") showInit();
