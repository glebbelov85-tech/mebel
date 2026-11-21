// ================= ЗАМЕР ГОЛОСОМ: КУХНЯ ПО ШАГАМ =================
// Приложение спрашивает - мастер отвечает голосом (или нажимает подсказку). Кухня строится по ходу:
// планировка -> длины стен -> потолок -> угол -> нижний ряд по модулям от угла -> верхний ряд -> фасады -> корпус ->
// столешница -> фурнитура -> доставка и подъём -> итог. После каждого ответа сразу пересчитываются листы (по раскрою),
// петли, направляющие, ножки, полкодержатели, кромка. Цена показывается на шаге "Итог" или по слову "сколько стоит".
// Состояние шага лежит в S.zm (сохраняется вместе с расчётом - если телефон перезагрузил страницу, замер продолжится).
// Логика (zmRun и всё, что выше zmInit) работает без экрана - её проверяет test/t6.js.
const ZM={on:false, undo:[], log:[], eng:null, mic:false, draft:"", prev:null,
  // строгий режим (по просьбе мастера): один вопрос - один ответ - "Стоп" - "Я понял так" - подтверждение. Свободный режим - как раньше.
  strict:(()=>{ try{ return localStorage.getItem("zm-strict")!=="0"; }catch(e){ return true; } })()};
const zmS=()=>{ if(!S.zm||typeof S.zm!=="object") S.zm={step:"layout"}; const z=S.zm; if(!z.dir) z.dir={}; if(!z.len) z.len={}; if(!Array.isArray(z.queue)) z.queue=[]; if(!Array.isArray(z.pend)) z.pend=[]; return z; };
const ZM_WALL=["основная стена","правая стена","левая стена"], ZM_WALL_G=["основной стены","правой стены","левой стены"];
const ZM_STEP_NAMES={layout:"Планировка",len:"Размеры стен",ceil:"Высота",corner:"Угол",low:"Нижний ряд",up:"Верхний ряд",fac:"Фасады",body:"Корпус",top:"Столешница",hw:"Фурнитура",dlv:"Доставка",total:"Итог"};
const ZM_FAC_WORD={mdf:"плёнка",mdf_plastic:"пластик",mdf_enamel:"эмаль",mdf_acryl:"акрил",mdf_veneer:"шпон",mdf_wood:"массив",ldsp16f:"ЛДСП"};
const ZM_ORD={шестнадцат:16,пятнадцат:15,четырнадцат:14,тринадцат:13,двенадцат:12,одиннадцат:11,десят:10,девят:9,восьм:8,седьм:7,шест:6,пят:5,четверт:4,трет:3,втор:2,перв:1};

// ---------- общие правки голосом: фурнитура, толщина фасада, лист, доставка и подъём (работают и в обычном помощнике) ----------
function zmFloor(f){
  let n=vCount(f,"этаж"); if(n) return n;
  const m=f.match(/этаж[а-я]*\s+(\d{1,2})(?!\d)/); if(m) return +m[1];
  for(const k in ZM_ORD) if(new RegExp("(^|\\s)"+k+"[а-я]{1,3} этаж").test(f)) return ZM_ORD[k];
  return null;
}
function zmBodyId(){ return S.mode==="kitchen" ? (MATS[S.kit.body]?S.kit.body:"ldsp16") : S.mode==="kupe" ? (MATS[S.kupe.body]?S.kupe.body:"ldsp16") : "ldsp16"; }
function edHw(f){
  if(/^(цен|сколько|почем|покажи|открой|какая|какие)/.test(f)) return null;
  const K=S.kit, kit=S.mode==="kitchen", big=/\d{3,}/.test(f); let m;
  // --- доставка, подъём, монтаж ---
  if(/без (доставки и монтажа|монтажа и доставки)/.test(f)) return null;                 // как раньше: ноль за доставку и монтаж
  if((m=f.match(/^доставк[а-я]*(?: по городу)?\s+(\d{3,})$/))){ PI.dlv_city.v=+m[1]; savePrice(); if(!S.dlv) S.dlv={mode:"city",km:0,floor:0,lift:null,pick2:false,mount:true}; S.install=null; return [`Доставка по городу: ${money(+m[1])} за рейс`]; }
  if((m=f.match(/^подъем[а-я]*(?: без лифта| на этаж| за этаж)*\s+(\d{3,})(?: за этаж)?$/))){ PI.lift_floor.v=+m[1]; savePrice(); return [`Подъём без лифта: ${money(+m[1])} за этаж`]; }
  const dlvWord=/доставк|самовывоз|сами (забер|привез|вывез)|этаж|лифт|подъем (на|без|по)|без подъема|за город|за чертой|по городу|в городе|в област|в поселок|в село|цех[а-я]*|километр|\d\s*км|частн[а-я]* дом/.test(f);
  if(dlvWord && !/подъемн|по прайсу/.test(f) && !(/(монтаж|установк)/.test(f)&&big)){
    const d=Object.assign({mode:"city",km:0,floor:0,lift:null,pick2:false,mount:true},S.dlv||{}); let hit=false;
    if(/самовывоз|без доставки|сами (забер|привез|вывез)|доставк[а-я]* не нужн/.test(f)){ d.mode="self"; hit=true; }
    else if(/за город|за чертой|в област|в поселок|в село|межгород|километр|\d\s*км/.test(f)){ d.mode="out"; const km=f.match(/(\d+)\s*(?:км|километр)/); if(km) d.km=clamp(+km[1],0,2000); hit=true; }
    else if(/по городу|в городе|в черте/.test(f) || /^доставк[а-я]*$/.test(f)){ d.mode="city"; d.km=0; hit=true; }
    const fl=zmFloor(f); if(fl){ d.floor=clamp(fl,1,60); hit=true; }
    if(/частн[а-я]* дом|без подъема|подъем[а-я]* не нужен/.test(f)){ d.floor=1; d.lift=null; hit=true; }
    if(/лифт/.test(f)){ d.lift=!/без лифт|лифт[а-я]* (не работает|сломан|не ходит|маленьк)|не влез/.test(f); hit=true; }
    if(/цех/.test(f) || /забрать фасад|фасад[а-я]* (отдельно|забира)/.test(f)){ d.pick2=!/(1|один|одного|одном|тот же|том же|том же самом) цех/.test(f); hit=true; }
    if(/без монтаж|без установк|без сборк|сами собер|монтаж[а-я]* не нужен/.test(f)){ d.mount=false; hit=true; }
    else if(/с монтаж|с установк|монтаж нужен/.test(f)){ d.mount=true; hit=true; }
    if(hit){ S.dlv=d; S.install=null; const q=calcCore().quote; return [`Доставка: ${dlvText(d)} - ${money(q.install)}`]; }
  }
  if(S.dlv && /^(без монтаж|без установк|без сборки на месте|монтаж[а-я]* не нужен)/.test(f)){ S.dlv.mount=false; S.install=null; return ["Без монтажа: "+dlvText()]; }
  if(S.dlv && /^(с монтаж|монтаж нужен|верни монтаж)/.test(f)){ S.dlv.mount=true; S.install=null; return ["С монтажом: "+dlvText()]; }
  // --- лист ЛДСП: "лист 2750 на 1830" ---
  if(/(^|\s)лист/.test(f)){
    const ms=vMeasures(" "+f+" ").map(x=>x.mm).filter(v=>v>=1000&&v<=4500);
    if(ms.length>=2){ const id=zmBodyId(), it=PI[id], a=Math.max(ms[0],ms[1]), b=Math.min(ms[0],ms[1]);
      it.m.sw=a; it.m.sh=b; it.name=it.name.replace(/\d{4}\s*[×xх]\s*\d{4}/,a+"×"+b); savePrice();
      const n=calcCore().cost.sheets[id]; return [`Лист ${it.s||it.name}: ${a}×${b} мм`+(n?`. По раскрою нужно листов: ${n}`:"")]; }
  }
  // --- толщина фасада: от неё зависит глубина кухни и угловые модули ---
  if((m=f.match(/толщин[а-я]* фасад[а-я]*\s*(\d{1,2})(?!\d)/)) || (m=f.match(/фасад[а-я]*(?:\s+толщин[а-я]*)?\s+(\d{1,2})\s*(?:мм|миллиметр[а-я]*)(?!\S)/))){
    const id=kit?kitCtx(K).fac:null, it=id&&PI[id]; if(!it) return ["Толщина фасада задаётся для кухни"];
    const t=clamp(+m[1],3,40), old=it.m.t; it.m.t=t; savePrice();
    const c=kitCtx(K); return [`Толщина фасада (${it.s||it.name}): ${old} -> ${t} мм. Глубина низа с фасадом ${c.Dl+t} мм, угловые модули и размеры пересчитаны`];
  }
  if(kit){
    // --- корпус 16 / 18 мм ---
    if(!/фасад/.test(f) && ((m=f.match(/(?:корпус|каркас)[а-я]*\s*(?:из\s*)?(?:лдсп\s*)?(?:толщин[а-я]*\s*)?(16|18)(?!\d)/)) || (m=f.match(/^(?:лдсп|плита)\s*(16|18)(?:\s*мм)?$/)) || (m=f.match(/толщин[а-я]* (?:корпус|лдсп|плит)[а-я]*\s*(16|18)(?!\d)/)))){
      const id=m[1]==="18"?"ldsp18":"ldsp16"; if(!MATS[id]) return null; K.body=id; return ["Корпус: "+matName(id)+" - размеры деталей пересчитаны"]; }
    // --- направляющие ящиков ---
    if(/направляющ|направляшк|тандем|метабокс|модернбокс|роликов|шариков|телескоп/.test(f) && !big){
      const cur=kitCtx(K).guide, i=GUIDES.indexOf(cur);
      let g = /тандем|метабокс|модернбокс|блюм|blum|легра/.test(f)?"tbox" : /роликов/.test(f)?"guide_r" : /шариков|телескоп/.test(f)?"guide" : /полн[а-я]* выдвиж|скрыт|доводчик/.test(f)?"kguide"
        : /дешев|попроще|эконом|прост/.test(f)?GUIDES[Math.max(0,i-1)] : /получше|подороже|лучше|дорож/.test(f)?GUIDES[Math.min(GUIDES.length-1,i+1)] : null;
      if(!g) throw new Error("Какие направляющие поставить: роликовые, шариковые, полного выдвижения или тандембоксы?");
      if(!PI[g]) return null;
      K.guides=g; const n=(genKitchen(K).hw.find(h=>h.id===g)||{q:0}).q;
      return [`Ящики: ${hwName(g).toLowerCase()}`+(n?`, ${n} компл. по ${money(P[g])}`:"")+(g===cur?" (уже стоят)":"")];
    }
    // --- петли ---
    if(/петл/.test(f) && /доводчик|обычн|прост|дешев|эконом|блюм|blum|хорош|поменя|замен|друг/.test(f) && !big){
      const h=/без доводчик|обычн|прост|дешев|эконом/.test(f)?"hinge0":/с доводчик|блюм|blum|хорош/.test(f)?"hinge":(kitCtx(K).hinge==="hinge"?"hinge0":"hinge"); K.hinges=h;
      const n=genKitchen(K).hw.filter(x=>x.id===h).reduce((s,x)=>s+x.q,0);
      return [`${hwName(h)}`+(n?`: ${n} шт. по ${money(P[h])}`:"")];
    }
  }
  return null;
}

// ---------- разбор модулей из фразы: "мойка 800 посудомойка 60 три ящика 600" ----------
const ZM_SPEC=/^(мойк|раковин|посудомо|пмм|ящик|пенал|колонн|духов|варочн|плит[аыуео]|холодильник|холодос|бутылочн|карго|сушк|сушил|вытяжк|полк|полоч|заглушк|планк|доборн|проем|ниш[аиуе]|подъемн|свч|микроволн|окн|стиральн|стиралк)/;
const ZM_GEN=/^(шкаф|модул|тумб)/;
const ZM_CON=/^(под|с|со|для|над|в|во|из)$/;
const ZM_SEP=/^(и|потом|затем|далее|следующ[а-я]*|плюс|еще|рядом|после)$/;
const ZM_CNT=/^(ящик|шт|двер|полк|полок|больш|мал|мелк|глубок|небольш|узк|одинак|высок|низк|распаш|фасад|створ)/;
function zmSplit(t){
  const segs=[];
  t.split(/\s*[,;]\s*/).forEach(chunk=>{
    const ws=chunk.split(/\s+/).filter(Boolean); let cur=null, first=true;
    const fresh=()=>({w:[],spec:0,gen:0,num:0,num0:0,lead:false,hard:first});
    const push=()=>{ if(cur&&cur.w.length){ segs.push(cur); first=false; } cur=null; };
    ws.forEach((w,i)=>{
      if(ZM_SEP.test(w)){ push(); return; }
      const spec=ZM_SPEC.test(w), gen=ZM_GEN.test(w), head=spec||gen, con=ZM_CON.test(ws[i-1]||""), isNum=/^\d+(\.\d+)?$/.test(w), nx=ws[i+1]||"";
      if(!cur) cur=fresh();
      const hasHead=cur.spec||cur.gen;
      if(head && !con && hasHead){
        const complete = cur.num>0 || cur.num0>0 || (cur.spec>0 && !cur.lead);
        if(complete && !(cur.gen&&!cur.spec&&!cur.num&&!cur.num0)){ push(); cur=fresh(); }
      } else if(isNum && hasHead && cur.num0>0 && !cur.num && !ZM_CNT.test(nx)){ push(); cur=fresh(); }   // "600 шкаф 800 мойка" - число идёт перед названием
      if(!cur.w.length && ZM_CON.test(w)) cur.lead=true;
      cur.w.push(w); if(spec) cur.spec++; if(gen) cur.gen++;
      if(isNum && !ZM_CNT.test(nx)){ if(cur.spec||cur.gen) cur.num++; else if(!ZM_GEN.test(nx)||true) cur.num0++; }
    });
    push();
  });
  // слова без названия модуля: голое число - это шкаф такой ширины, остальное - уточнение к предыдущему модулю
  const out=[];
  segs.forEach(s=>{
    const head=s.spec||s.gen, txt=s.w.join(" ");
    if(head){ out.push(s); return; }
    if(/^\d+(\.\d+)?( ?(мм|см|сантиметр[а-я]*|миллиметр[а-я]*))?$/.test(txt)){ s.bare=true; out.push(s); return; }
    const p=out[out.length-1];
    if(p && !p.bare){ p.w.push(...s.w); if(s.num0) p.num+=s.num0; } else { s.unknown=true; out.push(s); }
  });
  // "модуль 600 три ящика": общий модуль с шириной + уточнение без ширины
  for(let i=0;i<out.length-1;i++){ const a=out[i], b=out[i+1];
    if(a.gen && !a.spec && (a.num||a.num0) && b.spec && !b.gen && !b.num && !b.num0 && !b.hard && !b.unknown){ a.w.push(...b.w); a.spec+=b.spec; out.splice(i+1,1); } }
  return out;
}
function zmType(f,row){
  if(/пенал|колонн/.test(f)) return /холодил/.test(f)?"t_fridge" : /духов|свч|микроволн|техник|встро/.test(f)?"t_oven" : "t_shelf";
  if(/встроен[а-я]* холодил|холодил[а-я]* встро/.test(f)) return "t_fridge";
  if(/посудомо|пмм/.test(f)) return "l_dish";
  if(/(^|[^а-я])мойк|раковин/.test(f)) return "l_sink";
  if(/бутылочн|карго/.test(f)) return "l_bottle";
  if(/заглушк|планк|доборн/.test(f)) return row==="upper"?"u_fill":"l_fill";
  if(/сушк|сушил/.test(f)) return "u_dryer";
  if(/вытяжк/.test(f)) return "u_hood";
  if(/подъемн/.test(f)) return "u_lift";
  if(/ящик/.test(f)){
    const n=vCount(f,"ящик");
    if(/двер|распаш/.test(f) || n===1) return "l_drd";
    if(n===2) return "l_dr2";
    if(n>=4) return "l_dr4";
    if(/1\s+(больш|глубок|высок)[а-я]*\s*(и\s+)?2\s+(мал|мелк|небольш|низк|узк)|2\s+(мал|мелк|небольш|низк|узк)[а-я]*\s*(и\s+)?(1\s+)?(больш|глубок|высок)/.test(f)) return "l_dr3b";
    return "l_dr3";
  }
  if(/духов/.test(f)) return "l_oven";
  if(/варочн/.test(f)) return "l_hob";
  if(/микроволн|свч/.test(f)) return row==="upper"?"u_open":"t_oven";
  if(/холодильник|холодос|плит[аыуео]|проем|ниш[аиуе]|стиральн|стиралк/.test(f)) return "l_gap";
  if(/окн|пуст/.test(f)) return row==="lower"?"l_gap":"u_gap";
  if(/полк|полоч|открыт/.test(f) && !/(шкаф|модул|тумб)[а-я]* с /.test(f)) return row==="upper"?"u_open":"l_open";
  if(/шкаф|модул|тумб|распаш|двер/.test(f)) return row==="upper"?"u_shelf":"l_shelf";
  return null;
}
const ZM_FIXW={l_dish:600,l_oven:600,l_gap:600,t_fridge:600,t_oven:600,u_hood:600,l_hob:600,l_bottle:200};
function zmFit(m,lo,hi){ if(m.mm>=lo&&m.mm<=hi) return m.mm; if(!m.unit&&m.second==null) for(const k of [1,10,1000]){ const v=m.raw*k; if(v>=lo&&v<=hi) return Math.round(v); } return null; }
function zmWidthOf(f,t){
  if(/остат|до конца|до стены|до угла|что осталось|оставш|все место|на все/.test(f)) return "rest";
  const f2=f.replace(/(?<![\d.])[1-4]\s+((?:[а-я]+\s+)?(?:распаш|фасад|створ)[а-я]*)/g," | $1").replace(/(?<![\d.])\d{1,2}\s*(?:-?х\s*)?(ящик[а-я]*|шт[а-я.]*|двер[а-я]*|полк[а-я]*|полок|больш[а-я]*|мал[а-я]*|мелк[а-я]*|глубок[а-я]*|небольш[а-я]*|узк[а-я]*|одинак[а-я]*|высок[а-я]*|низк[а-я]*)/g," | $1").replace(/(?:^|\s)\d\s+((?:шкаф|тумб|модул|пенал)[а-я]*\s+по\s)/," $1");
  const ms=vMeasures(" "+f2+" "), fill=/fill/.test(t||""), lo=fill?20:150, hi=fill?300:1500;
  for(let i=ms.length-1;i>=0;i--){ const v=zmFit(ms[i],lo,hi); if(v!=null) return Math.round(v); }
  return null;
}
// фраза -> [{t,w,row}] или null, если это не про модули
function zmMods(t,rowHint){
  const segs=zmSplit(t); if(!segs.length || segs.some(s=>s.unknown)) return null;
  const mods=[];
  for(const s of segs){
    const f=s.w.join(" ");
    const rowW=/верхн|навесн|сверху|наверх/.test(f)?"upper":/нижн|напольн|снизу|вниз/.test(f)?"lower":rowHint;
    const type=s.bare?(rowHint==="upper"?"u_shelf":"l_shelf"):zmType(f,rowW); if(!type) return null;
    const d=modDef(type), row=d.cat==="up"?"upper":"lower";
    let w=zmWidthOf(f,type);
    if(w==null && type==="l_dish" && /узк/.test(f)) w=450;
    if(w==null && ZM_FIXW[type]) w=type==="l_bottle"?modDefW(type):ZM_FIXW[type];
    const cm=f.match(/(?:^|\s)(\d)\s+(?:шкаф|тумб|модул|пенал)[а-я]*\s+по\s/), n=s.bare||!cm?1:clamp(+cm[1],1,6);
    for(let i=0;i<n;i++) mods.push({t:type,w,row,spec:!!s.spec});
  }
  return mods;
}

// ---------- шаги ----------
function zmWalls(){ const lay=LAYOUTS[S.kit.layout]||LAYOUTS["1"]; return [0].concat(lay.walls.filter(w=>w!==0)); }
function zmSteps(){
  const lay=LAYOUTS[S.kit.layout]||LAYOUTS["1"], ws=zmWalls(), z=zmS(), s=["layout"];
  ws.forEach(w=>s.push("len"+w)); s.push("ceil"); if(lay.corners.length) s.push("corner");
  ws.forEach(w=>s.push("low"+w)); if(!z.noUp) ws.forEach(w=>s.push("up"+w));
  return s.concat(["fac","body","top","hw","dlv","total"]);
}
const zmKind=st=>String(st||"").replace(/\d$/,""), zmWi=st=>+String(st||"").slice(-1)||0;
function zmGo(st){ const z=zmS(); z.step=st; z.sub=null; z.queue=[]; z.pend=[]; }
function zmNextStep(){ const z=zmS(), ss=zmSteps(), i=ss.indexOf(z.step); zmGo(ss[Math.min(ss.length-1,i<0?0:i+1)]); }
function zmPrevStep(){ const z=zmS(), ss=zmSteps(), i=ss.indexOf(z.step); zmGo(ss[Math.max(0,i-1)]); }
function zmInfo(){ return genKitchen(S.kit).info; }
function zmFree(wi,row,info){ const iw=(info||zmInfo()).walls.find(x=>x.wi===wi); return iw?Math.round(row==="lower"?iw.freeL:iw.freeU):0; }
function zmDir(wi){ const z=zmS(); if(z.dir[wi]) return z.dir[wi]; return wi===0 ? (S.kit.layout==="2R"?"rtl":"ltr") : wi===1 ? "ltr" : "rtl"; }
function zmDirTxt(wi){ const lay=S.kit.layout, d=zmDir(wi), z=zmS();
  if(z.dir[wi] || lay==="1") return d==="ltr"?"слева направо":"справа налево";
  return "от угла ("+(d==="ltr"?"слева направо":"справа налево")+")"; }
function zmWallName(wi){ return S.kit.layout==="1" ? "стена" : ZM_WALL[wi]; }
// поставить модуль в ряд: по порядку диктовки
function zmPut(md,wi){
  const z=zmS(), list=S.kit.walls[wi][md.row], rtl=zmDir(wi)==="rtl", o={t:md.t,w:md.w}; if(md.dn) o.dn=md.dn;
  if(rtl) list.unshift(o); else list.push(o);
  z.last={wi,row:md.row,j:rtl?0:list.length-1}; z.wall=wi;
  SEL={part:-1,mod:`${wi}${md.row==="lower"?"l":"u"}${z.last.j}`};
}
function zmLastMod(){ const z=zmS(), l=z.last; if(!l) return null; const list=S.kit.walls[l.wi]&&S.kit.walls[l.wi][l.row]; return list&&list[l.j]?{md:list[l.j],list,...l}:null; }
const zmModName=t=>{ const d=modDef(t); return d?d.name:t; };
function zmRowState(wi,row){
  const free=zmFree(wi,row);
  return free>0 ? `Свободно ${fmt(free)} мм` : free<0 ? `Не помещается ${fmt(-free)} мм` : "Ряд заполнен ровно";
}
// верхний ряд "как внизу": над мойкой сушка, над духовкой и варочной вытяжка, над проёмом пусто
function zmMirror(wi){
  const info=zmInfo(), iw=info.walls.find(x=>x.wi===wi); if(!iw) return 0;
  const low=iw.low.filter(m=>!m.tall), list=[]; if(!low.length) return 0;
  const plain=w=>{ if(w<20) return; if(w<150) list.push({t:"u_fill",w}); else if(w>1000){ const h=Math.round(w/2/50)*50; list.push({t:"u_shelf",w:h},{t:"u_shelf",w:w-h}); } else list.push({t:"u_shelf",w}); };
  low.forEach((m,i)=>{
    // у угла верхний ряд начинается раньше нижнего (верхний угловой меньше) - разницу закрывает отдельный шкаф
    const pre = i===0 && iw.low[0]===m ? Math.round(m.s-iw.u0) : 0;
    const post = i===low.length-1 && iw.low[iw.low.length-1]===m && Math.abs(iw.lowEnd-iw.l1)<1 ? Math.round(iw.u1-(m.s+m.w)) : 0;
    let w=Math.round(m.w), t = m.t==="l_sink" ? (w>=500&&w<=900?"u_dryer":"u_shelf") : (m.t==="l_oven"||m.t==="l_hob") ? (w===600?"u_hood":"u_shelf") : m.t==="l_gap" ? "u_gap" : m.t==="l_fill" ? "u_fill" : "u_shelf";
    if(pre>=150) plain(pre); else if(pre>0) w+=pre;
    if(post>0 && post<150) w+=post;
    if(t==="u_shelf") plain(w); else list.push({t,w});
    if(post>=150) plain(post);
  });
  S.kit.walls[wi].upper=list; return list.length;
}
function zmHwCount(R){ const c={hinge:0,guide:0,leg:0,shpin:0,handle:0,lift:0};
  (R.allHw||R.hw||[]).forEach(h=>{ if(h.id==="hinge"||h.id==="hinge0") c.hinge+=h.q; else if(GUIDES.includes(h.id)) c.guide+=h.q; else if(h.id==="leg") c.leg+=h.q; else if(h.id==="shpin") c.shpin+=h.q; else if(h.id==="handle"||h.id==="push") c.handle+=h.q; else if(h.id==="lift") c.lift+=h.q; });
  return c; }
// короткая сводка "что уже насчитано": листы, фасады, кромка, фурнитура
function zmCounts(R){
  const a=[], c=R.cost, K=R.info&&R.info.c;
  Object.keys(c.sheets||{}).forEach(id=>{ if(c.sheets[id]>0) a.push({k:"sheet",id,label:matName(id),val:c.sheets[id]+" "+plur(c.sheets[id],"лист","листа","листов")}); });
  if(K && c.by[K.fac] && MAT(K.fac).kind!=="sheet") a.push({k:"fac",label:"Фасады",val:c.by[K.fac].area.toFixed(2)+" м²"});
  if(c.edgeM) a.push({k:"edge",label:"Кромка",val:c.edgeM+" м"});
  const h=zmHwCount(R);
  if(h.hinge) a.push({k:"hw",label:"Петли",val:h.hinge+" шт."});
  if(h.guide) a.push({k:"hw",label:"Направляющие",val:h.guide+" компл."});
  if(h.lift) a.push({k:"hw",label:"Подъёмники",val:h.lift+" шт."});
  if(h.leg) a.push({k:"hw",label:"Ножки",val:h.leg+" шт."});
  if(h.shpin) a.push({k:"hw",label:"Полкодержатели",val:h.shpin+" шт."});
  if(h.handle) a.push({k:"hw",label:"Ручки",val:h.handle+" шт."});
  return a;
}
// что будет с ценой, если... (S на время подменяется и возвращается)
function zmTry(fn){ const keep=S; let tot=null; try{ S=JSON.parse(JSON.stringify(keep)); fn(S.kit); tot=calcCore().quote.total; }catch(e){ tot=null; } S=keep; return tot; }
function zmCheaper(){
  const K=S.kit, c=kitCtx(K), base=calcCore().quote.total, alts=[];
  const add=(label,say,fn)=>{ const t=zmTry(fn); if(t!=null && t<base) alts.push({label,say,save:base-t}); };
  const hw=genKitchen(K).hw;
  if(hw.some(h=>GUIDES.includes(h.id))) GUIDES.forEach(g=>{ if(g!==c.guide && PI[g] && P[g]<P[c.guide]) add(hwName(g),"направляющие "+({guide_r:"роликовые",guide:"шариковые",kguide:"полного выдвижения"})[g],k=>k.guides=g); });
  if(c.hinge==="hinge" && PI.hinge0 && P.hinge0<P.hinge) add("Петли без доводчика","петли без доводчика",k=>k.hinges="hinge0");
  facMats().forEach(id=>{ if(id!==c.fac && ZM_FAC_WORD[id]) add("Фасады: "+matName(id),"фасады "+ZM_FAC_WORD[id].toLowerCase(),k=>k.fac=id); });
  if(c.top!=="top38" && MATS.top38) add("Столешница: "+matName("top38"),"столешница лдсп",k=>k.top="top38");
  if(c.hnd==="gola") add("Обычные ручки вместо профиля Gola","обычные ручки",k=>k.handles="std");
  if(K.led) add("Без подсветки","без подсветки",k=>k.led=false);
  return alts.sort((a,b)=>b.save-a.save).slice(0,7);
}
function zmNormT(text){
  const s=String(text).replace(/(\d+(?:[.,]\d+)?)\s*(?:тыс[а-я]*\.?)(?=[\s,.]|$)/gi,(m,a)=>String(Math.round(parseFloat(a.replace(",","."))*1000)));
  return vNorm(s).replace(/(?<!\d)[.!?]+|[.!?]+(?!\d)/g,",").replace(/^[\s,]+|[\s,]+$/g,"").trim()
    // "с тремя ящиками", "с одним фасадом", "на двух дверях": числа в падежах -> цифры
    .replace(/(^|\s)(одним|одной|одного|одну)(?=\s+(?:больш|мал|мелк|глубок|небольш|узк|высок|низк|распаш|двер|фасад|створ|ящик|полк|откид|подъем|стекл))/g,"$11")
    .replace(/(^|\s)(двумя|двух)(?=\s)/g,"$12").replace(/(^|\s)(тремя|трех)(?=\s)/g,"$13").replace(/(^|\s)(четырьмя|четырех)(?=\s)/g,"$14");
}
// ---------- строгий режим: один ответ - один модуль ----------
// "мойка, модуль 800" - это ОДИН модуль (мойка 800), "450, посудомоечная машина" - тоже один.
// Если мастер всё же назвал несколько модулей с ширинами, возвращаем их по отдельности - экран спросит про каждый.
const zmSegW=s=>s.bare||s.num>0||s.num0>0;
function zmOneSegs(t){
  // "потом", "затем", "следующий" - явная граница между модулями; внутри куска склеиваем части одного модуля
  const chunks=String(t).split(/(?:^|[\s,]+)(?:потом|затем|далее|следующ[а-я]*|после (?:него|этого|нее))(?=[\s,]|$)/).map(x=>x.replace(/^[\s,-]+|[\s,-]+$/g,"")).filter(Boolean);
  if(chunks.length>1) return chunks.reduce((a,c)=>a.concat(zmOneSegs(c)),[]);
  const segs=zmSplit(t); if(!segs.length) return [];
  const out=[segs[0]];
  for(let i=1;i<segs.length;i++){
    const a=out[out.length-1], b=segs[i], aw=zmSegW(a), bw=zmSegW(b);
    const nameOnly=x=>!zmSegW(x)&&!x.unknown, numOnly=x=>x.bare||(x.gen&&!x.spec&&zmSegW(x)), plainNoW=x=>x.gen&&!x.spec&&!zmSegW(x);
    // имя без ширины + "модуль 800" / голое число; голое число + имя без ширины; "модуль" + что угодно с шириной; уточнение без названия
    if((nameOnly(a)&&numOnly(b)) || (numOnly(a)&&!a.spec&&nameOnly(b)) || (plainNoW(a)&&bw) || (aw&&plainNoW(b)) || b.unknown){
      a.w.push(...b.w); a.spec+=b.spec; a.gen+=b.gen; a.num+=b.num; a.num0+=b.num0; if(b.bare||a.bare){ a.num0=Math.max(1,a.num0); } a.bare=false; a.unknown=false; continue; }
    out.push(b);
  }
  return out;
}
// фраза -> {mods:[{t,w,dn,def,txt}], bad?:true}; def - ширину не назвали, взята обычная
function zmOne(t,row){
  const segs=zmOneSegs(t), mods=[];
  for(const s of segs){
    const f=s.w.join(" ");
    const rowW=/верхн|навесн|сверху|наверх/.test(f)?"upper":/нижн|напольн|снизу|вниз/.test(f)?"lower":row;
    let type=zmType(f,rowW);
    if(!type && zmSegW(s) && !/[а-я]{3,}/.test(f.replace(/мм|см|миллиметр[а-я]*|сантиметр[а-я]*|модул[а-я]*|шкаф[а-я]*|тумб[а-я]*/g,""))) type=rowW==="upper"?"u_shelf":"l_shelf";
    if(!type) return {mods:[],bad:true,txt:f};
    const d=modDef(type); let w=zmWidthOf(f,type), def=false;
    if(w==null && type==="l_dish" && /узк/.test(f)) w=450;
    if(w==null && ZM_FIXW[type]){ w=type==="l_bottle"?modDefW(type):ZM_FIXW[type]; def=true; }
    let dn=0; const dm=f.match(/(?:^|\s)(\d)\s+(?:[а-я]+\s+)?(?:распаш|двер|фасад|створ)/);
    if(dm && !d.drawers && !/fill|gap|dish|hood|lift|open/.test(type)) dn=clamp(+dm[1],1,4);
    else if(/(одн[а-я]*|одинарн[а-я]*)\s+(распаш|двер|фасад|створ)|одностворч/.test(f) && !d.drawers) dn=1;
    else if(/двустворч|двухстворч/.test(f) && !d.drawers) dn=2;
    mods.push({t:type,w,dn,def,row:d.cat==="up"?"upper":"lower",txt:f});
  }
  return {mods};
}
const zmModFull=m=>zmModName(m.t)+(m.dn?(m.dn===1?", одна дверца":", дверц: "+m.dn):"");
// начать новую кухню
function zmFresh(){
  const K=kitDefaults(); K.walls.forEach(w=>{ w.lower=[]; w.upper=[]; }); K.layout="1";
  S.mode="kitchen"; S.kit=K; S.zm={step:"layout",dir:{},len:{},queue:[]}; S.dlv=null; S.install=null; SEL={part:-1,mod:null};
}
// вопрос текущего шага: {q, hint, chips:[[надпись, фраза]], status}
function zmAsk(){
  const z=zmS(), K=S.kit, st=z.step, kind=zmKind(st), wi=zmWi(st), sub=z.sub, lay=K.layout;
  if(sub && sub.k==="have") return {q:"В калькуляторе уже есть проект. Начинаем новую кухню или продолжаем эту?", chips:[["Новая кухня","новая кухня"],["Продолжить эту","продолжить"]]};
  if(sub && sub.k==="scan") return {q:"Я понял замер так: "+zmScanTxt(sub)+". Верно?", hint:"Если что-то не так - скажите, например: \"основная стена 3200\" или \"потолок 2700\".", chips:[["Да, верно","да"],["Нет, назову сам","нет"]].concat((sub.nums||[]).slice(0,5).map(n=>n>=2400&&n<=3000&&!(sub.vals||{}).ceil?["потолок "+n,"потолок "+n]:["основная "+n,"основная стена "+n]))};
  if(sub && sub.k==="side") return {q:"Вторая стена справа или слева от основной?", chips:[["Справа","справа"],["Слева","слева"]]};
  if(sub && sub.k==="w"){ const m=z.queue[0]||{}, free=zmFree(sub.wi,m.row), fill=/fill/.test(m.t), ws=(fill?[30,50,80,100]:[300,400,450,500,600,800,900]).filter(w=>free<=0||w<=free);
    const ch=ws.map(w=>[String(w),String(w)]); if(free>=(fill?20:150)&&free<=1200&&!ws.includes(free)) ch.push(["Остаток "+free,"остаток"]);
    return {q:`Ширина: ${zmModName(m.t).toLowerCase()}?`, status:zmRowState(sub.wi,m.row), chips:ch}; }
  if(sub && sub.k==="rest"){ const f=sub.free, ch=[]; if(f<=300) ch.push(["Заглушка "+f,"заглушка"]); if(f>=150) ch.push(["Шкаф "+f,"шкаф на остаток"]); ch.push(["Растянуть последний","растянуть последний"],["Оставить пусто","оставить"]);
    return {q:`${sub.row==="lower"?"Внизу":"Вверху"} осталось ${fmt(f)} мм. Что делаем?`, chips:ch}; }
  if(sub && sub.k==="over") return {q:`Не помещается ${fmt(sub.over)} мм. Что делаем?`, chips:[["Ужать последний","ужать последний"],["Убрать последний","убрать последний"],[`Стена ${fmt(K.walls[sub.wi].len+sub.over)}`,`${ZM_WALL[sub.wi]} ${K.walls[sub.wi].len+sub.over}`],["Оставить так","оставить"]]};
  if(kind==="layout") return {q:"Какая кухня?", hint:"Можно сразу с размерами: \"угловая, 3 метра 20 на 2 метра\".", chips:[["Прямая","прямая"],["Угол справа","угловая, угол справа"],["Угол слева","угловая, угол слева"],["П-образная","п-образная"]]};
  if(kind==="len") return {q: lay==="1" ? "Какая длина стены?" : `Какая длина ${ZM_WALL_G[wi]}?`, hint:"Например: \"3 метра 20\" или \"3200\".", chips:[]};
  if(kind==="ceil") return {q:"Какая высота потолка?", hint:"Или сразу высота верхних шкафов: \"верхние 720\".", chips:[["2500","потолок 2500"],["2600","потолок 2600"],["2700","потолок 2700"],["Верхние 720","верхние 720"],["Верхние 900","верхние 900"],["Пропустить","дальше"]]};
  if(kind==="corner") return {q:"Что ставим в угол?", hint:"Угловой шкаф занимает по 900 мм на каждой стене. Свой размер: \"угловой 1000 на 900\".", chips:[["Угловой шкаф","угловой шкаф"],["Глухой угол","глухой угол"],["Без углового","без углового"]]};
  if((kind==="low"||kind==="up") && z.pend.length){ const p=z.pend[0];
    return {q:`Следующий модуль из названных: ${zmModFull(p)}${p.w?" "+p.w:""}. Ставим?`, hint:p.w?"":"Ширину вы не назвали - спрошу после.", status:zmRowState(wi,kind==="low"?"lower":"upper"), chips:[["Да, ставим","да"],["Нет, назову другой","нет"]]}; }
  if(ZM.strict && (kind==="low"||kind==="up")){ const row=kind==="low"?"lower":"upper", n=(K.walls[wi][row]||[]).length+1;
    return {q:`${kind==="low"?"Нижний":"Верхний"} ряд, ${zmWallName(wi)}. Модуль ${n}, ${zmDirTxt(wi)}: какой?`, hint:`Назовите один модуль: что это и ширину. Например: ${kind==="low"?"\"мойка 800\", \"посудомойка 450\", \"3 ящика, 1 большой 2 маленьких, 600\", \"шкаф 400, одна дверца\"":"\"шкаф 600\", \"сушка 800\", \"над вытяжкой\""}.`, status:zmRowState(wi,row),
      chips:kind==="low"?[["Мойка","мойка"],["Посудомойка","посудомойка"],["Ящики","ящики"],["Духовка","духовка"],["Шкаф","шкаф"],["Холодильник","холодильник"],["Пенал под технику","пенал под технику"],["Ряд готов","дальше"]]
        :[["Как внизу","как внизу"],["Шкаф","шкаф"],["Сушка","сушка"],["Над вытяжкой","вытяжка"],["Подъёмник","подъёмник"],["Открытая полка","открытая полка"],["Без верхних","без верхних"],["Ряд готов","дальше"]]}; }
  if(kind==="low") return {q:`Нижний ряд, ${zmWallName(wi)}. Называйте модули по порядку, ${zmDirTxt(wi)}.`, hint:"Например: \"мойка 800, посудомойка 60, три ящика 600, распашной 600\". Пеналы называйте здесь же.", status:zmRowState(wi,"lower"),
    chips:[["Мойка","мойка"],["Посудомойка","посудомойка"],["Ящики","ящики"],["Духовка","духовка"],["Шкаф 600","шкаф 600"],["Холодильник","холодильник"],["Пенал под технику","пенал под технику"],["Убрать последний","отмена"]]};
  if(kind==="up") return {q:`Верхний ряд, ${zmWallName(wi)}. Называйте модули, ${zmDirTxt(wi)}.`, hint:"Или одной кнопкой: \"как внизу\" - шкафы встанут над нижними, над мойкой сушка, над духовкой вытяжка.", status:zmRowState(wi,"upper"),
    chips:[["Как внизу","как внизу"],["Шкаф 600","шкаф 600"],["Сушка","сушка"],["Над вытяжкой","вытяжка"],["Подъёмник","подъёмник"],["Открытая полка","открытая полка"],["Без верхних","без верхних"]]};
  if(kind==="fac") return {q:"Какие фасады?", hint:"Можно с толщиной и ценой: \"эмаль 19 миллиметров по 38 тысяч\".", chips:facMats().filter(id=>ZM_FAC_WORD[id]).map(id=>[ZM_FAC_WORD[id].charAt(0).toUpperCase()+ZM_FAC_WORD[id].slice(1),"фасады "+ZM_FAC_WORD[id].toLowerCase()])};
  if(kind==="body"){ const m=MAT(kitCtx(K).body); return {q:`Корпус: ${m.name}, лист ${m.sw} на ${m.sh}. Оставляем?`, hint:"Размер листа нужен для раскроя: \"лист 2750 на 1830\".", chips:[["Оставить","дальше"],["ЛДСП 16","корпус 16"],["ЛДСП 18","корпус 18"],["Лист 2750 на 1830","лист 2750 на 1830"],["Лист 2800 на 2070","лист 2800 на 2070"]]}; }
  if(kind==="top") return {q:"Какая столешница?", chips:[["ЛДСП 38","столешница лдсп"],["Компакт-плита","столешница компакт"],["Камень","столешница камень"],["Пропустить","дальше"]]};
  if(kind==="hw"){ const R=calcCore(), h=zmHwCount(R), c=kitCtx(K);
    return {q:"Фурнитура посчитана сама. Что меняем?", hint:`Сейчас: ${hwName(c.hinge).toLowerCase()} - ${h.hinge} шт., ${hwName(c.guide).toLowerCase()} - ${h.guide} компл., ножки - ${h.leg}, полкодержатели - ${h.shpin}, ручки: ${HANDLES[c.hnd]}.`,
      chips:[["Оставить","дальше"],["Шариковые направляющие","направляющие шариковые"],["Полного выдвижения","направляющие полного выдвижения"],["Тандембоксы","направляющие тандембокс"],["Петли без доводчика","петли без доводчика"],["Петли с доводчиком","петли с доводчиком"],["Ручки Gola","ручки gola"],["Без ручек","без ручек"]]}; }
  if(kind==="dlv") return {q:"Доставка и подъём?", hint:"Например: \"по городу, пятый этаж, лифт есть\" или \"за город 30 километров, второй этаж без лифта\". Если фасады и ЛДСП в разных цехах - скажите \"два цеха\".",
    chips:[["По городу, лифт есть","по городу, лифт есть"],["По городу, 1 этаж","по городу, 1 этаж"],["Без лифта","без лифта"],["Два цеха","два цеха"],["Самовывоз","самовывоз"],["Пропустить","дальше"]]};
  return {q:"Расчёт готов. Что меняем?", hint:"Говорите правки: \"поменяй направляющие на шариковые\", \"фасады плёнка\", \"мойку 600\", \"скидка 5 процентов\". Слово \"дорого\" покажет, на чём можно сэкономить.",
    chips:[["Дорого","дорого"],["Скидка 5%","скидка 5 процентов"],["Без скидки","скидка 0 процентов"],["Раскрой листов","раскрой"],["Отменить правку","отмена"]]};
}
function zmScanTxt(sub){ const v=sub.vals||{}, a=[]; if(v.len0) a.push("основная стена "+fmt(v.len0)+" мм"); if(v.len1) a.push("вторая стена "+fmt(v.len1)+" мм"); if(v.len2) a.push("третья стена "+fmt(v.len2)+" мм"); if(v.ceil) a.push("потолок "+fmt(v.ceil)+" мм"); return a.join(", ")||"размеры не нашлись"; }

// длины стен из фразы: {wi: мм}
function zmLens(t,fromWi){
  const lay=S.kit.layout, ws=zmWalls(), res={}, free=[];
  vMeasures(" "+t+" ").forEach(m=>{
    const v=zmFit(m,500,8000); if(v==null) return;
    const c=m.ctx, role=/потол|высот/.test(c)?"skip" : /(основн|главн|длинн|перв)[а-я]*\s*(стен[а-я]*\s*)?$/.test(c)?0 : /(лев|трет)[а-я]*\s*(стен[а-я]*\s*)?$/.test(c)?2 : /(прав|втор|боков|коротк|друг)[а-я]*\s*(стен[а-я]*\s*)?$/.test(c)?(lay==="2L"?2:1) : null;
    if(role==="skip") return;
    if(role!=null && ws.includes(role)) res[role]=v; else free.push(v);
  });
  let i=Math.max(0,ws.indexOf(fromWi));
  free.forEach(v=>{ while(i<ws.length && res[ws[i]]!=null) i++; if(i<ws.length) res[ws[i++]]=v; });
  return res;
}
function zmSetLens(res,say){
  const z=zmS(), K=S.kit; let n=0;
  Object.keys(res).forEach(k=>{ const wi=+k; K.walls[wi].len=clamp(res[k],500,8000); z.len[wi]=1; n++; say(`${ZM_WALL[wi].charAt(0).toUpperCase()+ZM_WALL[wi].slice(1)}: <b>${fmt(K.walls[wi].len)} мм</b>`); });
  return n;
}
function zmAfterLens(){ const z=zmS(), w=zmWalls().find(x=>!z.len[x]); zmGo(w!=null?"len"+w:"ceil"); if(w==null && z.ceilDone) zmNextStep(); }
function zmCeil(t,say){
  const K=S.kit, c=kitCtx(K), below=c.PL+c.Hl+c.topT+c.apronH, ms=vMeasures(" "+t+" "); if(!ms.length) return false;
  const m=ms[ms.length-1], asUp=/верх|навесн|шкаф/.test(t)&&!/потол/.test(t);
  const hu=zmFit(m,300,1300), ce=zmFit(m,1800,4000), z=zmS();
  if(hu!=null||ce!=null) z.ceilDone=1;
  if(asUp && hu!=null){ K.Hu=clamp(Math.round(hu/10)*10,300,1200); }
  else if(ce!=null && !(hu!=null && m.mm<=1300)){ const avail=ce-below; K.ceil=ce;
    K.Hu = /до потол/.test(t) ? clamp(Math.floor((avail-10)/10)*10,300,1200) : avail>=960 ? 900 : clamp(Math.floor((avail-10)/10)*10,300,1200);
    K.Ht=c.Hl+c.topT+c.apronH+K.Hu;
    say(`Потолок <b>${fmt(ce)} мм</b>: верхние шкафы ${K.Hu} мм, до потолка останется ${fmt(ce-below-K.Hu)} мм.`+(ce-below-K.Hu>150?` Нужны шкафы до потолка - скажите "верхние до потолка ${String(ce/1000).replace(".",",")}".`:""));
    return true; }
  else if(hu!=null){ K.Hu=clamp(Math.round(hu/10)*10,300,1200); }
  else return false;
  K.Ht=c.Hl+c.topT+c.apronH+K.Hu; say(`Верхние шкафы <b>${K.Hu} мм</b>`); return true;
}
function zmCorner(t,say){
  const K=S.kit, lay=LAYOUTS[K.layout];
  const ty=/без углов|до угла|не нужен|без шкаф/.test(t)?"none" : /глух/.test(t)?"blindA" : /углов|г-?\s?образ|двер|обычн|станд|^да$|шкаф/.test(t)?"L" : null;
  if(!ty) return false;
  const ms=vMeasures(" "+t+" ").map(m=>zmFit(m,600,1300)).filter(v=>v!=null);
  lay.corners.forEach(s=>{ const lo=K.corners[s].low; lo.t=ty;
    if(ty==="L"){ lo.A=ms[0]||900; lo.B=ms[1]||ms[0]||900; } else if(ty==="blindA") lo.A=ms[0]||1050; });
  const info=zmInfo(), z=info.cs[lay.corners[0]].low;
  say(`Угол: <b>${CORNER_LOW[ty]}</b>`+(ty!=="none"?`, занимает ${z.A} мм на основной стене и ${z.B} мм на боковой`:"")+". Верхний угол - Г-образный 600 на 600 (поменять: \"верхний угол без углового\").");
  return true;
}
function zmFac(t,say){
  const K=S.kit; let id=edMat(t);
  if(!id){ const it=priceFind(t,4).find(x=>x.m&&x.m.facade&&x.m.t>=12); if(it) id=it.id; }
  let tm=t.match(/(\d{1,2})\s*(?:мм|миллиметр[а-я]*)(?!\S)/)||t.match(/толщин[а-я]*\s*(\d{1,2})(?!\d)/);
  if(!tm){ const m2=t.match(/(?:^|\s)(\d{2})(?=\s|$)/); if(m2 && +m2[1]>=8 && +m2[1]<=40) tm=m2; }
  const pm=t.replace(/\d+\s*(мм|миллиметр[а-я]*)/g," ").match(/(\d{4,7})/);
  if(!id && !tm && !pm) return false;
  if(id) K.fac=id; id=kitCtx(K).fac; const it=PI[id];
  if(tm){ it.m.t=clamp(+tm[1],3,40); }
  if(pm && MAT(id).kind==="area"){ it.v=+pm[1]; }
  if(tm||pm) savePrice();
  const R=calcCore(), a=R.cost.by[id]?R.cost.by[id].area:0;
  say(`Фасады: <b>${esc(it.s||it.name)}</b>, ${MAT(id).t} мм, ${money(P[id])} за ${unitLabel(it.u)}. Площадь фасадов ${a.toFixed(2)} м².`);
  return true;
}
// очередь модулей: кому не назвали ширину - спрашиваем
function zmDrain(say,wi){
  const z=zmS();
  while(z.queue.length){
    const m=z.queue[0], free=zmFree(wi,m.row);
    if(m.w==="rest"){ const min=/fill/.test(m.t)?20:150; if(free<min){ say(`Под "${zmModName(m.t).toLowerCase()}" места не осталось (свободно ${fmt(Math.max(0,free))} мм).`,"zm-err"); z.queue.shift(); continue; } m.w=Math.min(free,1500); }
    if(m.w==null){ z.sub={k:"w",wi}; return false; }
    zmPut(m,wi); z.queue.shift();
    say(`${m.row!==zmRowOf(z.step)&&zmRowOf(z.step)?(m.row==="upper"?"В верхний ряд: ":"В нижний ряд: "):""}<b>${esc(zmModFull(m))} ${m.w}</b>`+(m.def?` <small>(обычная ширина - другую скажите: "ширина 450")</small>`:""));
  }
  z.sub=null; return true;
}
const zmRowOf=st=>zmKind(st)==="low"?"lower":zmKind(st)==="up"?"upper":null;
// после добавления: сколько осталось, не пора ли дальше
function zmAfterAdd(say,wi,row){
  const z=zmS(), free=zmFree(wi,row), cur=zmRowOf(z.step);
  if(free<0){ say(`Не помещается ${fmt(-free)} мм.`,"zm-err"); if(cur===row&&zmWi(z.step)===wi) z.sub={k:"over",wi,row,over:-free}; return; }
  if(free===0 && cur===row && zmWi(z.step)===wi){ say("Ряд заполнен ровно."); zmNextStep(); return; }
  say(free===0?"Ряд заполнен ровно.":`Свободно ${fmt(free)} мм.`,"zm-note");
}
// закончить ряд: остаток - заглушка, шкаф или растянуть
function zmEndRow(say,force){
  const z=zmS(), wi=zmWi(z.step), row=zmRowOf(z.step), list=S.kit.walls[wi][row], free=zmFree(wi,row);
  if(force || !list.length || free===0){ zmNextStep(); return; }
  if(free<0){ z.sub={k:"over",wi,row,over:-free}; return; }
  if(free<20){ const l=[...list].reverse().find(m=>!(modDef(m.t)||{}).gap); if(l){ l.w+=free; say(`Последний модуль шире на ${free} мм - ряд сошёлся.`,"zm-note"); } zmNextStep(); return; }
  if(row==="upper" && free>0){ zmNextStep(); return; }      // верх не обязан идти до конца стены
  z.sub={k:"rest",wi,row,free};
}
function zmStretch(wi,row,delta){
  const list=S.kit.walls[wi][row], z=zmS(), lm=zmLastMod();
  let md=lm&&lm.wi===wi&&lm.row===row&&!(modDef(lm.md.t)||{}).gap?lm.md:null;
  if(!md || (delta<0 && ED_FIXED.has(md.t))) md=[...list].reverse().find(m=>{ const d=modDef(m.t)||{}; return !d.gap && !(delta<0&&ED_FIXED.has(m.t)); });
  if(!md || md.w+delta<(/fill/.test(md.t)?20:150)) return null;
  md.w+=delta; return md;
}
// ---------- одна фраза мастера ----------
// Возвращает {out:[{cls,html}], total?:true, map?:true, close?:true}
function zmRun(text){
  const z=zmS(), K=S.kit, out=[], say=(html,cls)=>out.push({cls:cls||"zm-a",html});
  let t=zmNormT(text); if(!t) return {out};
  const R={out};
  // --- подтверждения особых вопросов ---
  if(z.sub && z.sub.k==="have"){
    if(/^(дальше|далее|следующ[а-я]*|пропус[а-я]*|готово|ок|окей|хорошо|да|нет|ладно)$/.test(t)){ R.need="Выберите: новая кухня или продолжить эту."; return R; }
    if(/продолж|эт[уо]|текущ|остав/.test(t)){ z.sub=null; z.step="total"; S.mode="kitchen"; say("Продолжаем с текущей кухней."); return R; }
    zmFresh(); say("Начинаем новую кухню."); return R;
  }
  if(z.sub && z.sub.k==="scan"){
    const sub=z.sub, nm=(rx)=>{ const m=t.match(rx); return m?zmFit(vMeasures(" "+m[1]+" ")[0],600,8000):null; }, sc={0:nm(/(?:основн|перв|длинн)[а-я]* (?:стен[а-я]* )?(\d[\d., ]*(?:м[а-я]*|см)?(?: \d+)?)/),1:nm(/(?:втор|прав|лев|боков|коротк)[а-я]* (?:стен[а-я]* )?(\d[\d., ]*(?:м[а-я]*|см)?(?: \d+)?)/),2:nm(/трет[а-я]* (?:стен[а-я]* )?(\d[\d., ]*(?:м[а-я]*|см)?(?: \d+)?)/)}, named=sc[0]||sc[1]||sc[2], lens=named?{}:zmLens(t,0), cm=t.match(/потол[а-я]*\s*(\d[\d.]*)/);
    if(/^(да|верно|правильно|так|все верно|подтверждаю|ага|угу|ок|окей)( |,|$)/.test(t)){
      const v=sub.vals||{}; z.sub=null;
      const res={}; if(v.len0) res[0]=v.len0; const ws=zmWalls(); if(v.len1&&ws[1]!=null) res[ws[1]]=v.len1; if(v.len2&&ws[2]!=null) res[ws[2]]=v.len2;
      zmSetLens(res,say); if(v.ceil) zmCeil("потолок "+v.ceil,say);
      if(v.len1 && K.layout==="1"){ z.scanRest={len1:v.len1,len2:v.len2}; say("Вторую стену запомнил - она понадобится, если кухня угловая.","zm-note"); }
      if(zmKind(z.step)==="len"||zmKind(z.step)==="ceil") zmAfterLens();
      return R; }
    if(/^(нет|неверно|не так|не то|неправильно|сам)( |,|$)/.test(t) && !Object.keys(lens).length && !cm){ z.sub=null; say("Хорошо, называйте размеры сами."); return R; }
    if(named){ const v=sub.vals=sub.vals||{}; if(sc[0]) v.len0=sc[0]; if(sc[1]) v.len1=sc[1]; if(sc[2]) v.len2=sc[2]; if(cm){ const c=zmFit(vMeasures(" "+cm[1]+" ")[0],1800,4000); if(c) v.ceil=c; } say("Поправил."); return R; }
    if(Object.keys(lens).length || cm){ const v=sub.vals=sub.vals||{}; if(lens[0]) v.len0=lens[0]; if(lens[1]||lens[2]) v.len1=lens[1]||lens[2]; if(lens[1]&&lens[2]) v.len2=lens[2];
      if(cm){ const c=zmFit(vMeasures(" "+cm[1]+" ")[0],1800,4000); if(c) v.ceil=c; } say("Поправил."); return R; }
    R.need="Скажите \"да\", если размеры верные, или назовите правильный: \"основная стена 3200\"."; return R;
  }
  // --- общие команды ---
  if(/^(назад|вернись|вернуться|верни назад|предыдущ[а-я]* (шаг|вопрос))$/.test(t)){ if(z.sub) z.sub=null; else zmPrevStep(); z.queue=[]; return R; }
  if(/^(повтори|повтори вопрос|еще раз|что|что дальше|какой вопрос)$/.test(t)) return R;
  if(/^(начать заново|начни заново|заново|сначала|с начала|новый замер|новая кухня)$/.test(t)){ zmFresh(); say("Начинаем заново."); return R; }
  if(/^((по|рас|пере)счита(й|ть)|сколько (стоит|выходит|получается|будет|вышло)( (все|всего|кухня|проект|итого))?|итог|итого|цена|покажи (цену|итог|расчет)|что по деньгам|к итогу|в конец)$/.test(t)){ z.sub=null; z.queue=[]; z.step="total"; R.total=true; return R; }
  if(/^(раскрой|карта раскроя|покажи (раскрой|листы|карту раскроя)|раскрой листов|как (ляжет|лягут) (на )?лист[а-я]*|листы)$/.test(t)){ R.map=true; return R; }
  if(/^(открой|открыть|покажи)( в)? калькулятор[а-я]*$|^(закрой|закрыть|выход|выйти|закончить|закончили|хватит)( замер)?$/.test(t)){ R.close=true; return R; }
  if(/^(дорого|это дорого|слишком дорого|дороговато|очень дорого|подешевле|дешевле|как (сделать )?(по)?дешевле|удешеви[а-я]*|на чем (можно )?сэкономить|что можно удешевить)/.test(t)){
    const al=zmCheaper();
    if(!al.length) say("Дешёвых замен не нашёл: фурнитура, фасады и столешница уже самые простые. Можно дать скидку: \"скидка 5 процентов\".");
    else say("На чём можно сэкономить:<br>"+al.map(a=>`<button class="zm-alt" data-say="${esc(a.say)}"><span>${esc(a.label)}</span><b>-${money(a.save)}</b></button>`).join(""));
    R.price=true; return R;
  }
  const kind=zmKind(z.step), wi=zmWi(z.step), row=zmRowOf(z.step);
  const HARD=/^(дальше|далее|следующ[а-я]*( шаг| вопрос| ряд)?|пропус[а-я]*|готово|все|это все|закончил[а-я]*|достаточно|идем дальше|поехали дальше|дальше давай|давай дальше)$/;
  const SOFT=/^(оставить|оставь|оставляем|оставь как есть|ничего|ничего не меня[а-я]*|так и остав[а-я]*|как есть|нет|не надо|ок|окей|хорошо|да|ладно)$/;
  const NEXT={test:x=>HARD.test(x)||(SOFT.test(x)&&(!row||!!z.sub)&&kind!=="len")};
  // --- вопрос про ширину модуля ---
  if(z.sub && z.sub.k==="w"){
    const m=z.queue[0], f=/fill/.test(m.t), w=z.sub.wi; let cont=false;
    if(/^(на )?(остат[а-я]*|до конца|до стены|до угла|все что осталось|весь остаток)$/.test(t)) m.w="rest";
    else if(NEXT.test(t) || /стандарт|как обычно|обычн|не знаю/.test(t)) m.w=modDefW(m.t);
    else {
      const heads=zmSplit(t).some(x=>x.spec||x.gen), ms=vMeasures(" "+t+" "), v=ms.length?zmFit(ms[ms.length-1],f?20:150,f?300:1500):null;
      if(heads && zmMods(t,m.row)){ m.w=modDefW(m.t); say(`${zmModName(m.t)}: взял обычную ширину ${m.w}.`,"zm-note"); cont=true; }
      else if(v!=null) m.w=Math.round(v);
      else if(/^\d/.test(t)){ say("Назовите ширину числом, например \"600\" или \"45\". Или скажите \"остаток\".","zm-note"); return R; }
      else { m.w=modDefW(m.t); say(`${zmModName(m.t)}: взял обычную ширину ${m.w}.`,"zm-note"); cont=true; }
    }
    z.sub=null; const mrow=m.row;
    if(zmDrain(say,w) && !cont) zmAfterAdd(say,w,mrow);
    if(!cont || z.sub) return R;
  }
  // --- остаток или перебор в ряду ---
  if(z.sub && (z.sub.k==="rest"||z.sub.k==="over")){
    const sb=z.sub, list=K.walls[sb.wi][sb.row], free=zmFree(sb.wi,sb.row);
    if(sb.k==="rest"){
      if(/^заглушк|^планк/.test(t)){ z.sub=null; zmPut({t:sb.row==="lower"?"l_fill":"u_fill",w:free,row:sb.row},sb.wi); say(`Заглушка ${free} мм - ряд сошёлся.`); zmNextStep(); return R; }
      if(/растян|увелич|шире последн|последн[а-я]* шире|добав[а-я]* к последн/.test(t)){ const md=zmStretch(sb.wi,sb.row,free); z.sub=null; if(md){ say(`${zmModName(md.t)}: теперь ${md.w} мм - ряд сошёлся.`); zmNextStep(); } else say("Растянуть нечего.","zm-err"); return R; }
      if(/^(шкаф|модул|тумб)[а-я]*( на остаток| на все| до конца)?$/.test(t)){ z.sub=null; zmPut({t:sb.row==="lower"?"l_shelf":"u_shelf",w:free,row:sb.row},sb.wi); say(`Шкаф ${free} мм - ряд сошёлся.`); zmNextStep(); return R; }
      if(NEXT.test(t) || /пуст|оставить|так/.test(t)){ z.sub=null; say(`Оставил ${fmt(free)} мм свободными.`,"zm-note"); zmNextStep(); return R; }
    } else {
      if(/ужать|ужми|сузь|сузить|уменьш|подрежь/.test(t)){ const md=zmStretch(sb.wi,sb.row,free); z.sub=null; if(md){ say(`${zmModName(md.t)}: теперь ${md.w} мм - ряд сошёлся.`); if(zmFree(sb.wi,sb.row)===0) zmNextStep(); } else say("Ужимать нечего: технику и мойку не трогаю. Уберите модуль или удлините стену.","zm-err"); return R; }
      if(/^(убрать|убери|удали|удалить) последн/.test(t)){ const lm=zmLastMod(); z.sub=null; if(lm){ lm.list.splice(lm.j,1); z.last=null; say(`Убрал: ${zmModName(lm.md.t).toLowerCase()} ${lm.md.w}.`); zmAfterAdd(say,sb.wi,sb.row); } return R; }
      if(NEXT.test(t) || /оставить|так/.test(t)){ z.sub=null; say("Оставил как есть - проверьте потом размеры.","zm-note"); zmNextStep(); return R; }
    }
    z.sub=null;      // сказали что-то другое - разбираем как обычную фразу
  }
  if(z.sub && z.sub.k==="side"){
    if(/лев/.test(t)||/прав/.test(t)){ K.layout=/лев/.test(t)?"2L":"2R"; z.sub=null; say(`Кухня угловая, вторая стена <b>${K.layout==="2L"?"слева":"справа"}</b>.`); zmAfterLens(); return R; }
  }
  if(/^(угол |вторая стена |вторая )?(слева|справа)$/.test(t) && /^2/.test(K.layout) && !K.walls.some(w=>w.lower.length||w.upper.length)){
    const nl=/слева/.test(t)?"2L":"2R"; if(nl!==K.layout){ const a=K.layout==="2R"?1:2, b=nl==="2R"?1:2; K.walls[b].len=K.walls[a].len; if(z.len[a]){ z.len[b]=1; delete z.len[a]; } K.layout=nl; if(/^(len|low|up)/.test(z.step)) zmGo(zmKind(z.step)+(zmWi(z.step)===a?b:zmWi(z.step))); }
    say(`Вторая стена <b>${nl==="2L"?"слева":"справа"}</b>.`); return R; }
  // --- "дальше" ---
  // форма кухни нужна для всех следующих шагов: без неё дальше не идём, а подсказываем, что выбрать (без новых строк в ленте)
  if(kind==="layout" && !z.sub && NEXT.test(t)){ R.need="Сначала выберите форму кухни: нажмите вариант ниже или скажите, например, \"прямая\"."; return R; }
  if(kind==="len" && HARD.test(t)){ say(`Длину не назвали - пока беру ${fmt(K.walls[wi].len)} мм. Поправить: "${ZM_WALL[wi]} 3200".`,"zm-note"); z.len[wi]=1; zmAfterLens(); return R; }
  if(NEXT.test(t)){
    if(row){ zmEndRow(say,false); return R; }
    zmNextStep(); return R;
  }
  // --- ответы по шагам ---
  if(kind==="layout"){
    let lay=null;
    if(/п-?\s?образ|буквой п|три стены|3 стен/.test(t)) lay="3";
    else if(/углов|г-?\s?образ|буквой г|две стены|2 стен|с углом|угол/.test(t)) lay=/лев/.test(t)?"2L":/прав/.test(t)?"2R":"2?";
    else if(/прям|линейн|одна стена|1 стен|в линию|в ряд|без угл|одну стену/.test(t)) lay="1";
    if(lay){
      const ask=lay==="2?"; K.layout=ask?"2R":lay;
      say(`Кухня: <b>${({"1":"прямая","2R":"угловая, вторая стена справа","2L":"угловая, вторая стена слева","3":"П-образная"})[K.layout]}</b>`+(ask?" (если слева - скажите \"угол слева\")":""));
      const ws0=zmWalls(); Object.keys(z.len).forEach(k=>{ if(!ws0.includes(+k)) delete z.len[k]; });
      zmSetLens(zmLens(t,0),say);
      if(z.scanRest && K.layout!=="1"){ const ws=zmWalls(), r2={}; if(z.scanRest.len1&&!z.len[ws[1]]) r2[ws[1]]=z.scanRest.len1; if(z.scanRest.len2&&ws[2]!=null&&!z.len[ws[2]]) r2[ws[2]]=z.scanRest.len2; zmSetLens(r2,say); z.scanRest=null; }
      zmAfterLens(); return R;
    }
  }
  if(kind==="len"){
    const res=zmLens(t,wi);
    if(Object.keys(res).length){ zmSetLens(res,say); zmAfterLens(); return R; }
  }
  if(kind==="ceil"){ if(zmCeil(t,say)){ zmNextStep(); return R; } }
  if(kind==="corner"){ if(zmCorner(t,say)){ zmNextStep(); return R; } }
  if(row && z.pend.length && !z.sub){
    if(/^(да|ага|угу|верно|правильно|ставим|ставь|ок|окей|хорошо|давай|подтверждаю)$/.test(t)){ z.queue=[z.pend.shift()]; const r0=z.queue[0].row; if(zmDrain(say,wi)) zmAfterAdd(say,wi,r0); return R; }
    if(/^(нет|не надо|не ставь|не ставим|пропусти|пропустить|другой|не то)$/.test(t)){ z.pend=[]; say("Хорошо, называйте следующий модуль сами."); return R; }
    z.pend=[];
  }
  if(row){
    let m;
    // переходы между рядами и стенами
    if(/^(теперь |давай |переходим (к|на) |дальше )?(верх|верхн[а-я]*( ряд| шкаф[а-я]*| модул[а-я]*)?|навесн[а-я]*)$/.test(t)){ if(z.noUp) z.noUp=false; zmGo("up"+wi); return R; }
    if(/^(теперь |давай |переходим (к|на) )?(низ|нижн[а-я]*( ряд| шкаф[а-я]*| модул[а-я]*)?)$/.test(t)){ zmGo("low"+wi); return R; }
    if((m=t.match(/^(?:теперь |давай |на |переходим на )?(основн|главн|прав|лев|втор|боков)[а-я]* стен[а-я]*$/))){ const w=edWall(t,K); if(w!=null&&w>=0){ zmGo((row==="lower"?"low":"up")+w); return R; } say("Такой стены в этой планировке нет.","zm-err"); return R; }
    if(/^(слева направо|справа налево|от угла|наоборот|в другую сторону)$/.test(t)){ if(t==="от угла") delete z.dir[wi]; else z.dir[wi]=t==="слева направо"?"ltr":t==="справа налево"?"rtl":(zmDir(wi)==="ltr"?"rtl":"ltr"); say(`Порядок: ${zmDirTxt(wi)}.`); return R; }
    if(row==="upper" && /^(как внизу|как снизу|как нижн[а-я]*|по нижним|над нижними|так же как внизу|зеркально)$/.test(t)){
      const n=zmMirror(wi); if(!n){ say("Внизу на этой стене пока нет модулей.","zm-err"); return R; }
      say(`Верхний ряд по нижнему: ${K.walls[wi].upper.map(x=>zmModName(x.t).toLowerCase()+" "+x.w).join(", ")}.`); zmNextStep(); return R; }
    if(row==="upper" && /^(без верхн[а-я]*|без верха|верх[а-я]* не нужн[а-я]*|без навесн[а-я]*|верха нет)( шкаф[а-я]*)?$/.test(t)){
      zmWalls().forEach(w=>K.walls[w].upper=[]); LAYOUTS[K.layout].corners.forEach(s=>K.corners[s].up.t="none"); z.noUp=true; say("Без верхних шкафов."); zmGo("fac"); return R; }
    // поправить последний модуль
    if((m=t.match(/^(?:нет\s+)?(?:ширин[а-я]*|последн[а-я]*(?: модул[а-я]*| шкаф[а-я]*)?|сделай(?: его| ее)?|его|ее|не)\s+(?:на\s+)?(\d[\d. ]*(?:мм|см)?)$/))){
      const lm=zmLastMod(); if(!lm){ say("Пока нечего менять - назовите модуль.","zm-err"); return R; }
      const ms=vMeasures(" "+m[1]+" "), v=ms.length?zmFit(ms[0],/fill/.test(lm.md.t)?20:150,1500):null; if(v==null){ say("Не понял ширину.","zm-err"); return R; }
      const old=lm.md.w; lm.md.w=Math.round(v); say(`${zmModName(lm.md.t)}: ${old} -> <b>${lm.md.w}</b>`); zmAfterAdd(say,lm.wi,lm.row); return R; }
    if((m=t.match(/^(?:замени|поменяй|смени)\s+(?:последн[а-я]*(?: модул[а-я]*| шкаф[а-я]*)?|его|ее)\s+на\s+(.+)$/))){
      const lm=zmLastMod(), ty=zmType(m[1],lm&&lm.row);
      if(lm && ty && ((modDef(ty).cat==="up")===(lm.row==="upper"))){ const w=zmWidthOf(m[1],ty); const old=lm.md.t; lm.md.t=ty; if(typeof w==="number") lm.md.w=w; say(`Заменил: ${zmModName(old).toLowerCase()} -> <b>${zmModName(ty)} ${lm.md.w}</b>`); zmAfterAdd(say,lm.wi,lm.row); return R; }
    }
    if(/^(на )?(остат[а-я]*|до конца|до стены|до угла|все что осталось|весь остаток)$/.test(t)){ const free=zmFree(wi,row); if(free<20){ say("Свободного места в ряду нет.","zm-note"); return R; }
      zmPut({t:free<150?(row==="lower"?"l_fill":"u_fill"):(row==="lower"?"l_shelf":"u_shelf"),w:Math.min(free,1200),row},wi); say(`<b>${free<150?"Заглушка":"Шкаф"} ${Math.min(free,1200)}</b> на остаток.`); zmAfterAdd(say,wi,row); return R; }
    if(/^(убери|убрать|удали|удалить) последн[а-я]*( модул[а-я]*| шкаф[а-я]*)?$/.test(t)){ const lm=zmLastMod(); if(lm){ lm.list.splice(lm.j,1); z.last=null; say(`Убрал: ${zmModName(lm.md.t).toLowerCase()} ${lm.md.w}.`); zmAfterAdd(say,lm.wi,lm.row); } else say("Убирать нечего.","zm-err"); return R; }
  }
  // --- модули: в шагах рядов - любые, в остальных - только с понятным названием ("пенал под технику") ---
  if(!/^(убер|удал|убрат|замен|поменя|перенес|передвин|подвин|сдвин|сколько|как[аои][яйе] |цен|открой|покажи|сохрани|скидк|клиент|телефон|фасад|столешниц|корпус|лист|петл|направля|ручк|доставк|подсветк|фартук|потол|цокол)/.test(t) && row){
    const body=t.replace(/^(добав[а-я]*|постав[а-я]*|ставим|пишем|пиши|запиши|дальше ид[её]т|потом ид[её]т|потом|затем|далее|следующ[а-я]*|еще|и)\s+/,"");
    let mods;
    if(ZM.strict){ const o=zmOne(body,row||"lower"); mods=o.bad||!o.mods.length?null:[o.mods[0]]; if(mods) z.pend=o.mods.slice(1); }
    else mods=zmMods(body,row||"lower");
    if(mods && mods.length){
      const w=wi;
      z.queue=mods;
      const lastRow=mods[mods.length-1].row;
      if(zmDrain(say,w)) zmAfterAdd(say,w,lastRow);
      return R;
    }
  }
  if(kind==="fac"){ if(zmFac(t,say)){ zmNextStep(); return R; } }
  else if(edMat(t) && !/столешниц|корпус|цен[аыу] /.test(t) && (/^фасад/.test(t) || /\d/.test(t) || t.split(" ").length<=2) && zmFac(t,say)) return R;
  if(kind==="body"){ const r=(()=>{ try{ return edHw(t)||edHw("корпус "+t); }catch(e){ return null; } })(); if(r&&r.length){ r.forEach(x=>say(esc(x))); return R; } }
  if(kind==="top"){ const tt=/камен|кварц|акрил/.test(t)?"top_stone":/компакт/.test(t)?"top_compact":/лдсп|38|обычн|пластик|постформ/.test(t)?"top38":null; if(tt){ K.top=tt; say("Столешница: <b>"+esc(matName(tt))+"</b>"); zmNextStep(); return R; } }
  if(kind==="hw"||kind==="dlv"){
    // несколько условий одной фразой: "по городу, пятый этаж, лифт есть"
    const parts=t.split(/\s*[,;]\s*|\s+и\s+/).filter(Boolean); let hit=0; const errs=[];
    parts.forEach(c=>{ try{ let r=edHw(edSyn(c)); if(!r) r=edMore(edSyn(c)); if(r&&r.length){ hit++; r.forEach(x=>say(esc(x))); } }catch(e){ errs.push(e.message); } });
    if(hit){ if(kind==="dlv"){ const last=out[out.length-1]; out.length=0; out.push(last); zmNextStep(); R.total=true; } return R; }
    if(errs.length){ say(esc(errs[0]),"zm-err"); return R; }
  }
  // --- всё остальное понимает обычный помощник: правки, цены, вопросы ---
  if(HARD.test(t)||SOFT.test(t)){ R.need=kind==="layout"?"Сначала выберите форму кухни: нажмите вариант ниже или скажите, например, \"прямая\".":"Ответьте на вопрос: нажмите вариант или назовите его голосом."; return R; }
  // пробный разбор для "Я понял так": команды помощника (открыть, сохранить, показать) не выполняем, правки - пробуем (расчёт потом вернётся)
  if(ZM.dry && typeof edWhole==="function"){ let w=null; try{ w=edWhole(zmNormT(text)); }catch(e){} if(w){ R.edit=true; say("Команда: "+esc(text)); return R; } }
  if(edNewBody(t)!=null){ say("Сейчас идёт замер по шагам. Чтобы начать с начала, скажите \"начать заново\".","zm-note"); return R; }
  ED.noBuild=true; ED.noNav=true; ED.noBalance=zmSteps().indexOf(z.step)<zmSteps().indexOf("fac");
  let r; try{ r=editProject(text);
    // "пенал под технику" без глагола, когда ряды уже названы - значит добавить
    if(!(r&&(r.ok||r.info)) && !row && !/^(добав|постав|убер|удал|замен)/.test(t)){ const mm=zmMods(t,"lower"); if(mm&&mm.length&&mm.every(x=>x.spec)){ const r2=editProject("добавь "+text); if(r2&&r2.ok) r=r2; } }
  }finally{ ED.noBuild=false; ED.noNav=false; ED.noBalance=false; }
  if(r && (r.ok || r.info) ){ (r.msg||[]).forEach(x=>say(r.html?x:esc(x))); (r.errs||[]).forEach(x=>say(esc(x),"zm-err")); if(/сколько стоит|цена для клиента/i.test((r.msg||[]).join(" "))) R.price=true; return R; }
  if(r && r.errs && r.errs.length && !/^Не понял/.test(r.errs[0])){ say(esc(r.errs[0]),"zm-err"); return R; }
  say("Не понял. "+(row?"Назовите модуль и ширину, например \"ящики 600\", или скажите \"дальше\".":"Ответьте на вопрос или скажите \"дальше\"."),"zm-err");
  R.miss=true; return R;
}

// ================= ЭКРАН ЗАМЕРА =================
function zmLog(cls,html){ ZM.log.push({cls,html}); if(ZM.log.length>40) ZM.log.shift(); }
function zmSnapKey(){ return JSON.stringify(S)+"\u0001"+JSON.stringify(PRICE); }
function zmAskKey(){ const z=zmS(), wl=S.kit&&S.kit.walls&&S.kit.walls[zmWi(z.step)]; return z.step+"/"+(z.sub?z.sub.k+":"+(z.queue[0]?z.queue[0].t:"")+(z.sub.free||z.sub.over||""):"")+"/"+z.pend.length+(ZM.strict&&wl?":"+wl.lower.length+"."+wl.upper.length:""); }
function zmSpeak(text){
  if(!text||!window.MebelVoice||(MebelVoice.muted&&MebelVoice.muted())) return;
  const was=ZM.eng&&ZM.mic; if(was) ZM.eng.stop();
  MebelVoice.say(text,()=>{ if(was&&!ZM.strict&&ZM.on&&ZM.eng) ZM.eng.start(); });
}
// ---------- строгий режим: "Я понял так" и подтверждение ----------
const ZM_CMD=/^(да|нет|ага|угу|верно|ок|окей|хорошо|ладно|дальше|далее|следующ[а-я]*( шаг| вопрос| ряд)?|пропус[а-я]*|готово|все|это все|ряд готов|назад|вернись|вернуться|отмена|отмени(ть)?( последн[а-я]*)?|верни( как было)?|повтори( вопрос)?|еще раз|что дальше|какой вопрос|сколько стоит( все| всего| кухня)?|итог|итого|цена|раскрой|листы|закрой|закрыть|выход|выйти|хватит|стоп|начать заново|заново|сначала|новая кухня|продолжить)$/;
const ZM_YES=/^(да|ага|угу|верно|правильно|все верно|так|подтверждаю|ок|окей|хорошо|точно|да верно|ставим|ставь|принято)$/, ZM_NO=/^(нет|не так|неверно|не то|неправильно|заново|сказать заново|еще раз|отмена)$/;
// разобрать ответ "на пробу": что изменится, если его принять (сам расчёт не меняется)
function zmDry(text){
  const kS=JSON.stringify(S), kP=JSON.stringify(PRICE), kSel=SEL, kU=ED.undo.length, kW=ED.wantDesc; let r;
  const sp=typeof savePrice==="function"?savePrice:null; ZM.dry=true; if(sp) savePrice=()=>{};
  try{ r=zmRun(text); }catch(e){ r={out:[{cls:"zm-err",html:esc(e.message||String(e))}]}; }
  finally{ ZM.dry=false; if(sp) savePrice=sp; }
  const z=zmS(), res={r, changed:JSON.stringify(S)!==kS, sub:z.sub?z.sub.k:null, q0:z.queue[0]?Object.assign({},z.queue[0]):null, pend:z.pend.map(p=>Object.assign({},p))};
  S=JSON.parse(kS); PRICE=JSON.parse(kP); SEL=kSel; ED.undo.length=kU; ED.wantDesc=kW;
  return res;
}
function zmPropose(text,byVoice){
  const d=zmDry(text), r=d.r;
  // команда или ответ не дан - подтверждать нечего
  if(r.need || r.total || r.map || r.close || (!d.changed && !r.out.some(o=>o.cls!=="zm-note") && !d.sub)) return false;
  ZM.prev={text, out:r.out, needW:d.sub==="w"&&d.q0?d.q0:null, pend:d.pend, bad:!!r.miss&&!d.changed};
  ZM.need=null; zmRender();
  if(byVoice) zmSpeak(ZM.prev.bad?"Не понял. Скажите ещё раз.":"Я понял так: "+r.out.filter(o=>o.cls!=="zm-note").map(o=>String(o.html).replace(/<[^>]+>/g,"")).join(". ").slice(0,140)+". Верно?");
  return true;
}
function zmConfirm(byVoice){
  const p=ZM.prev; if(!p) return; ZM.prev=null;
  if(p.bad){ zmRender(); return; }
  zmUser(p.text,byVoice,true);
}
function zmUser(text,byVoice,direct){
  text=String(text||"").trim(); if(!text||!ZM.on) return;
  if(voiceCmd(text)==="stop"){ if(ZM.eng) ZM.eng.stop(); return; }
  const t=zmNormT(text);
  if(ZM.prev && !direct){
    if(ZM_YES.test(t)){ zmConfirm(byVoice); return; }
    if(ZM_NO.test(t)){ ZM.prev=null; zmRender(); if(byVoice) zmSpeak(zmAsk().q); return; }
    // назвали только ширину - дописываем к тому, что уже понято
    if(ZM.prev.needW && /^\d[\d.]*( ?(мм|см|миллиметр[а-я]*|сантиметр[а-я]*))?$/.test(t)){ const base=ZM.prev.text; ZM.prev=null; if(!zmPropose(base+" "+text,byVoice)) zmUser(base+" "+text,byVoice,true); return; }
    ZM.prev=null;
  }
  if(ZM.strict && !direct && !ZM_CMD.test(t)){ if(zmPropose(text,byVoice)) return; }
  if(!/^(отмена|отмени(ть)?( последн[а-я]*)?|верни( как было)?|не то|не так|ошибка|убери это|сотри)$/.test(t)){
    const before=zmSnapKey(); let r;
    try{ r=zmRun(text); }catch(e){ r={out:[{cls:"zm-err",html:esc(e.message||String(e))}]}; }
    if(zmSnapKey()!==before){ ZM.undo.push(before); if(ZM.undo.length>30) ZM.undo.shift(); }
    // ответ не дан: подсказку показываем в карточке вопроса и подсвечиваем варианты, в ленту ничего не пишем - сколько ни нажимай
    if(r.need && !r.out.length){ ZM.need=r.need; zmRender(); zmPulse(); if(byVoice) zmSpeak(r.need); return; }
    ZM.need=null; zmLog("zm-u",esc(text));
    r.out.forEach(o=>zmLog(o.cls,o.html));
    zmAfter(r,byVoice); return;
  }
  ZM.need=null; zmLog("zm-u",esc(text));
  if(/^(отмена|отмени(ть)?( последн[а-я]*)?|верни( как было)?|не то|не так|ошибка|убери это|сотри)$/.test(t)){
    const e=ZM.undo.pop();
    if(e){ const i=e.indexOf("\u0001"), st=migrateState(JSON.parse(e.slice(0,i))); if(st) S=st; const p=e.slice(i+1); if(p!==JSON.stringify(PRICE)){ PRICE=JSON.parse(p); savePrice(); } SEL={part:-1,mod:null}; zmLog("zm-a","Отменил - вернул, как было."); }
    else zmLog("zm-err","Отменять нечего.");
    zmAfter({},byVoice); return;
  }
}
// подсветить варианты ответа (после "Дальше" без ответа)
function zmPulse(){ const c=$("zmChips"); if(!c) return; c.classList.remove("zm-pulse"); void c.offsetWidth; c.classList.add("zm-pulse"); try{ c.scrollLeft=0; }catch(e){} }
function zmAfter(r,byVoice){
  if(r.close){ zmClose(); return; }
  const z=zmS(); S.mode="kitchen";
  if(PAGE!=="calc"){ zmClose(true); return; }       // помощник открыл прайс или модули - замер сворачиваем, он продолжится с того же шага
  const keep=SEL; setMode("kitchen"); SEL=keep; calc();
  if(r.total||r.price||z.step==="total") z.price=1;
  if(z.price){
    const q=showPrice();
    if(q && ZM.lastTotal!=null && q.total!==ZM.lastTotal){ const d=q.total-ZM.lastTotal; zmLog("zm-price",`Было ${money(ZM.lastTotal)}, стало <b>${money(q.total)}</b> - ${d<0?"дешевле":"дороже"} на ${money(Math.abs(d))}.`); }
    if(q) ZM.lastTotal=q.total;
  }
  LS.set("mk2_current",S);
  zmRender();
  if(r.map) zmCutMap();
  const key=zmAskKey(), a=zmAsk();
  if(byVoice){ const last=[...(r.out||[])].reverse().find(o=>o.cls==="zm-note"||o.cls==="zm-err"), tail=last?String(last.html).replace(/<[^>]+>/g,""):"";
    zmSpeak(key!==ZM.askKey||r.miss ? (tail&&tail.length<60?tail+" ":"")+a.q : tail||"Принял"); }
  ZM.askKey=key;
}
function zmSketch(){
  const sk=$("sketch"), ms=$("zmSvg"); if(!sk||!ms||!CUR||CUR.type!=="kitchen") return;
  const keepV=sk.getAttribute("viewBox"), keepH=sk.innerHTML;
  try{ drawKitchenElev(); ms.setAttribute("viewBox",sk.getAttribute("viewBox")); ms.innerHTML=sk.innerHTML; }catch(e){}
  if(keepV) sk.setAttribute("viewBox",keepV); sk.innerHTML=keepH;
}
function zmTotalHtml(){
  const q=CUR&&CUR.quote; if(!q) return "";
  const site=!!(window.MebelSite&&MebelSite.write&&MebelSite.urlOf);
  return `<div class="zm-tot-h"><span>Цена для клиента${q.disc?` (скидка ${q.disc}%)`:""}</span><b>${money(q.total)}</b><small>предоплата ${q.prepay}%: ${money(q.pre)} · срок ${q.days} ${q.daysKind==="calendar"?"календ.":"раб."} дн.</small></div>
    <details class="zm-det"><summary>Из чего складывается (для мастера)</summary><table>${$("costs").innerHTML}</table><p class="note">Себестоимость ${money(q.cost)}, прибыль ${money(q.total-q.cost)}.</p></details>
    <div class="zm-acts"><button class="b1" data-za="show">Показать клиенту</button><button class="b2" data-za="map">Раскрой листов</button><a class="btn wa" target="_blank" rel="noopener" href="${esc($("wa").href)}">WhatsApp</a><button class="b2" data-za="save">Сохранить</button>${site?`<button class="b2" data-za="kp">КП и договор</button><button class="b2" data-za="rk">В карту раскроя</button>`:""}<button class="b2" data-za="calc">Открыть в калькуляторе</button></div>`;
}
function zmRender(){
  if(!ZM.on) return;
  const z=zmS(), ss=zmSteps(), i=Math.max(0,ss.indexOf(z.step)), kinds=[...new Set(ss.map(zmKind))], ki=kinds.indexOf(zmKind(z.step)), a=zmAsk();
  $("zmStep").textContent=`Шаг ${ki+1} из ${kinds.length}: ${ZM_STEP_NAMES[zmKind(z.step)]||""}`;
  $("zmBarFill").style.width=Math.round((i+1)/ss.length*100)+"%";
  // пока форма кухни не выбрана - ни плана, ни счёта: показывать нечего
  const empty=z.step==="layout"&&!(z.sub&&z.sub.k==="have");
  $("zmSvg").classList.toggle("hide",empty); $("zmEmpty").classList.toggle("hide",!empty);
  if(!empty) zmSketch();
  if(typeof SCAN!=="undefined" && SCAN.fresh && !(z.sub&&z.sub.k==="scan")){ SCAN.fresh=false; const dd=$("zmDoc").querySelector("details"); if(dd && window.innerWidth<940) dd.open=false; }   // на телефоне после подтверждения замер сворачиваем - откроется нажатием
  const cnt=CUR&&!empty?zmCounts(CUR):[];
  $("zmCnt").innerHTML=cnt.length ? `<span class="zm-c-t">Итог по названному:</span>`+cnt.map(c=>`<${c.k==="sheet"?'button type="button" data-za="map"':"span"} class="zm-c zm-c-${c.k}"><i>${esc(c.label)}</i><b>${esc(c.val)}</b></${c.k==="sheet"?"button":"span"}>`).join("") : (empty?"":`<span class="zm-c0">Счёт появится, когда назовёте модули: листы по раскрою, петли, направляющие, кромка</span>`);
  const tot=$("zmTotal"); tot.classList.toggle("hide",!z.price); if(z.price) tot.innerHTML=zmTotalHtml();
  const log=$("zmLog"); log.innerHTML=ZM.log.map(x=>`<div class="${x.cls}">${x.html}</div>`).join(""); log.scrollTop=log.scrollHeight;
  $("zm").classList.toggle("zm-prev-on",!!ZM.prev);
  if(ZM.prev){ const p=ZM.prev, nm=p.needW, lines=p.out.filter(o=>!(p.bad&&o.cls==="zm-err"));
    const wch=nm?((/fill/.test(nm.t)?[30,50,80,100]:[300,400,450,500,600,700,800,900]).map(w=>`<button type="button" class="zm-chip" data-zpw="${w}">${w}</button>`).join("")):"";
    $("zmQ").innerHTML=p.bad ? `<div class="zm-pv bad"><b>Не понял ответ</b><span class="zm-pv-heard">Вы сказали: "${esc(p.text)}"</span><small>Скажите ещё раз одним модулем: что это и ширину, например "мойка 800".</small></div>`
      : `<div class="zm-pv"><b>Я понял так:</b>`+lines.map(o=>`<div class="zm-pv-l ${o.cls==="zm-err"?"err":o.cls==="zm-note"?"note":""}">${o.html}</div>`).join("")
        +(nm?`<div class="zm-pv-l"><b>${esc(zmModFull(nm))}</b> - ширину не назвали. Нажмите ширину или скажите её:</div><div class="zm-pv-w">${wch}</div>`:"")
        +(p.pend&&p.pend.length?`<div class="zm-pv-l note">Вы назвали ещё ${p.pend.length} ${plur(p.pend.length,"модуль","модуля","модулей")}: ${p.pend.map(x=>esc(zmModFull(x).toLowerCase())+(x.w?" "+x.w:"")).join(", ")}. Спрошу про каждый по очереди.</div>`:"")
        +`<span class="zm-pv-heard">Вы сказали: "${esc(p.text)}"</span></div>`;
    $("zmChips").innerHTML=(p.bad?"":`<button type="button" class="zm-chip zm-ok" data-zp="ok">Да, верно</button>`)+`<button type="button" class="zm-chip" data-zp="again">${p.bad?"Сказать ещё раз":"Нет, сказать заново"}</button>`;
    $("zmBack").disabled=false; const nx=$("zmNext"); nx.textContent=p.bad?"Дальше":"Верно, дальше"; nx.classList.add("b1"); nx.classList.remove("b2");
    $("zmHow").textContent=p.bad?'Нажмите "Говорить" и скажите ответ ещё раз':'Проверьте и нажмите "Да, верно". Если не так - "Нет, сказать заново" или сразу скажите правильно.';
    return; }
  $("zmQ").innerHTML=`<b>${esc(a.q)}</b>`+(a.status?`<span class="zm-status ${/Не помещ/.test(a.status)?"bad":/ровно/.test(a.status)?"ok":""}">${esc(a.status)}</span>`:"")+(ZM.need?`<span class="zm-need">${esc(ZM.need)}</span>`:a.hint?`<small>${esc(a.hint)}</small>`:"");
  $("zmChips").innerHTML=(a.chips||[]).map(c=>`<button type="button" class="zm-chip" data-say="${esc(c[1])}">${esc(c[0])}</button>`).join("");
  $("zmBack").disabled=i===0&&!z.sub;
  const must=z.step==="layout"&&!z.sub, nx=$("zmNext");
  nx.textContent=z.step==="total"?"Готово":"Дальше"; nx.classList.toggle("b1",!must); nx.classList.toggle("b2",must);
  $("zmHow").textContent=ZM.strict?'Нажмите "Говорить", ответьте на вопрос и нажмите "Стоп". Потом проверьте, как я понял.':(a.chips||[]).length?'Нажмите вариант или нажмите "Говорить" и скажите ответ':'Нажмите "Говорить" и скажите ответ, или напишите его ниже';
  const md=$("zmMode"); if(md){ md.textContent=ZM.strict?"По одному":"Свободно"; md.classList.toggle("on",ZM.strict); }
}
// карта раскроя: как детали лягут на листы (движок - тот же, что в инструменте "Карта раскроя")
function zmCutMap(){
  if(!CUR||!CUR.cost) return;
  const ids=Object.keys(CUR.cost.sheets||{}).filter(id=>CUR.cost.sheets[id]>0), cl=cutList(CUR.allParts||CUR.parts); let h="";
  ids.forEach(id=>{
    const m=MAT(id), rows=cl.filter(r=>r.mat===id), n=CUR.cost.sheets[id];
    h+=`<h3 style="margin:10px 0 6px">${esc(m.name)}, лист ${m.sw}×${m.sh}: ${n} ${plur(n,"лист","листа","листов")}, деталей ${rows.reduce((s,r)=>s+r.q,0)}</h3>`;
    if(typeof RK==="undefined"){ h+=`<p class="note">Раскладка по листам - в инструменте "Карта раскроя".</p>`; return; }
    try{
      const res=RK.optimize(rows.map((r,i)=>({id:i,L:r.L,W:r.S,qty:r.q,e:{}})),{L:m.sw,W:m.sh,grain:m.t>4,offcuts:[]},{edgeTypes:{},subtractEdge:false,kerf:4,trim:10,timeMs:250,minOffL:300,minOffW:100,strips:"auto"});
      const k=res.sheets.reduce((s,x)=>s+x.count,0);
      if(k!==n) h+=`<p class="note" style="margin:0 0 6px">На этой раскладке листов: ${k}. В цене учтено ${n} - точную карту с остатками и этикетками делает инструмент "Карта раскроя".</p>`;
      h+=`<div class="zm-maps">`+res.sheets.map(sh=>{ const L=sh.stock.L, W=sh.stock.W, fs=Math.round(L/38);
        return `<figure><svg viewBox="0 0 ${L} ${W}" xmlns="http://www.w3.org/2000/svg"><rect width="${L}" height="${W}" fill="#f3ece2" stroke="#8a5f35" stroke-width="8"/>`+
          sh.placed.map(p=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${m.css}" stroke="#6b5a4a" stroke-width="5"/>`+(p.w>fs*4.2&&p.h>fs*1.3?`<text x="${p.x+p.w/2}" y="${p.y+p.h/2+fs*0.35}" text-anchor="middle" font-size="${fs}" fill="#3a2f26">${Math.round(p.rotated?p.h:p.w)}×${Math.round(p.rotated?p.w:p.h)}</text>`:"")).join("")+
          `</svg><figcaption>${sh.count>1?"×"+sh.count+" · ":""}занято ${Math.round(sh.used*100)}%</figcaption></figure>`; }).join("")+`</div>`;
      if(res.unplaced&&res.unplaced.length) h+=`<p class="note">Не поместились на лист: ${res.unplaced.length} дет. - проверьте размер листа.</p>`;
    }catch(e){ h+=`<p class="note">Раскладку показать не получилось.</p>`; }
  });
  if(!ids.length) h=`<p class="note">Листовых деталей пока нет - назовите модули.</p>`;
  openModal("Раскрой листов",h+`<p class="note">Пропил 4 мм, обрезка края листа 10 мм, детали из ЛДСП не поворачиваются (рисунок). Размер листа: скажите "лист 2750 на 1830" или поменяйте в прайсе.</p>`,null,{wide:true});
}
function zmSendTo(tool){ try{ if(MebelSite.write(toOrder(),"kalkulyator")) location.href=MebelSite.urlOf(tool)+"?from=kalkulyator"; }catch(e){ toast("Не получилось передать заказ"); } }
function zmOpen(fresh,noMic){
  if(ED.eng&&ED.on) ED.eng.stop();
  if(typeof closeModal==="function") closeModal();
  if(PAGE!=="calc") setMode(S.mode);
  // замер, остановленный на первом вопросе, не продолжаем: ответов ещё нет, а кухня в расчёте может быть чужой (из калькулятора)
  const had=S.zm&&typeof S.zm==="object"&&S.zm.step&&!(S.zm.step==="layout"&&!S.zm.sub);
  if(fresh || !had){
    const touched=S.mode==="kitchen" && JSON.stringify(defaultState().kit)!==JSON.stringify(S.kit);
    ED.undo.push({s:JSON.stringify(S),p:JSON.stringify(PRICE)});
    if(touched && !fresh){ S.zm={step:"layout",sub:{k:"have"}}; }
    else zmFresh();
    ZM.log=[]; ZM.undo=[]; ZM.lastTotal=null;
  }
  S.mode="kitchen"; ZM.on=true; ZM.need=null;
  document.body.classList.add("zm-open"); $("zm").classList.remove("hide");
  if(!ZM.log.length) zmLog("zm-a",had&&!fresh?"Продолжаем замер с того же места.":"Я спрашиваю - вы отвечаете: нажмите вариант или скажите его голосом. Слова \"назад\", \"отмена\", \"сколько стоит\" работают в любой момент.");
  const keep=SEL; setMode("kitchen"); SEL=keep; calc();
  if(zmS().price){ const q=showPrice(); if(q) ZM.lastTotal=q.total; }
  ZM.askKey=zmAskKey(); zmRender();
  if(!noMic && ZM.eng && !ZM.mic) ZM.eng.start();
}
function zmClose(keepPage){
  ZM.on=false; if(ZM.eng&&ZM.mic) ZM.eng.stop();
  document.body.classList.remove("zm-open"); $("zm").classList.add("hide");
  if(!keepPage){ setMode("kitchen"); calc(); window.scrollTo({top:0}); }
}
function zmInit(){
  const box=document.createElement("div"); box.id="zm"; box.className="zm hide";
  box.innerHTML=`<div class="zm-box">
    <div class="zm-head"><b>Замер голосом</b><span class="zm-step" id="zmStep"></span>
      <button class="b2 zm-sm" id="zmScanBtn" title="Загрузить замер: приложение попробует прочитать размеры и спросит, верно ли понял"><span class="zm-w">Замер: </span>PDF или фото</button>
      <button class="b2 zm-sm zm-mode" id="zmMode" title="По одному: один вопрос - один ответ, после &quot;Стоп&quot; приложение показывает, как поняло, и ждёт подтверждения. Свободно: можно диктовать подряд, ответы применяются сразу."></button>
      <button class="b2 zm-sm" id="zmRestart" title="Начать новую кухню с первого вопроса">Заново</button>
      <button class="b2 zm-sm" id="zmSound" title="Задавать вопросы вслух">Звук</button>
      <button class="bx" id="zmX" title="Закрыть - кухня останется в калькуляторе">&times;</button></div>
    <div class="zm-bar0"><div id="zmBarFill"></div></div>
    <div class="zm-tts hide" id="zmTts"></div>
    <div class="zm-main">
      <div class="zm-left">
        <div class="zm-doc hide" id="zmDoc"></div>
        <svg id="zmSvg" class="zm-svg" xmlns="http://www.w3.org/2000/svg"></svg>
        <div class="zm-empty hide" id="zmEmpty"><b>Тут появится ваша кухня</b><span>Выберите форму - дальше приложение спросит размеры и модули. Листы и фурнитура считаются по тому, что вы назовёте.</span></div>
        <div class="zm-cnt" id="zmCnt"></div>
        <div class="zm-total hide" id="zmTotal"></div>
      </div>
      <div class="zm-right">
        <div class="zm-log" id="zmLog"></div>
        <div class="zm-q" id="zmQ"></div>
        <div class="zm-chips" id="zmChips"></div>
        <div class="zm-how" id="zmHow"></div>
        <div class="zm-live hide" id="zmLive"></div>
        <div class="zm-ctl"><button class="b2" id="zmBack">Назад</button>
          <button class="zm-mic" id="zmMic" title="Включить или выключить микрофон">${MIC_SVG.replace('width="18" height="18"','width="34" height="34"')}<span>Говорить</span></button>
          <button class="b1" id="zmNext">Дальше</button></div>
        <div class="zm-in"><input id="zmIn" placeholder="или напишите ответ" autocomplete="off" enterkeyhint="send"><button class="b1" id="zmGo">OK</button></div>
        <input type="file" id="zmFile" accept="image/*,application/pdf,.pdf" hidden>
      </div>
    </div></div>`;
  document.body.appendChild(box);
  const inp=$("zmIn"), live=$("zmLive"), mic=$("zmMic");
  $("zmX").onclick=()=>zmClose();
  $("zmRestart").onclick=()=>confirmBox("Начать новую кухню с первого вопроса? Текущую можно вернуть кнопкой \"Отменить\" в калькуляторе.","Начать заново",()=>zmOpen(true,true));
  // защита от двойного нажатия: второе нажатие в течение 0,4 с не считается
  const once=fn=>()=>{ const n=Date.now(); if(n-(ZM.tap||0)<400) return; ZM.tap=n; fn(); };
  $("zmBack").onclick=once(()=>zmUser("назад"));
  $("zmNext").onclick=once(()=>{ if(ZM.prev){ if(ZM.prev.bad){ ZM.prev=null; zmUser("дальше"); } else zmConfirm(); return; } if(zmS().step==="total"&&!zmS().sub) zmClose(); else zmUser("дальше"); });
  $("zmMode").onclick=()=>{ ZM.strict=!ZM.strict; ZM.prev=null; try{ localStorage.setItem("zm-strict",ZM.strict?"1":"0"); }catch(e){}
    zmLog("zm-note",ZM.strict?"Режим \"По одному\": отвечайте на один вопрос, нажимайте \"Стоп\" и подтверждайте, как я понял.":"Режим \"Свободно\": можно диктовать подряд, ответы применяются сразу."); zmRender(); };
  $("zmGo").onclick=()=>{ const v=inp.value; inp.value=""; zmUser(v); };
  inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); const v=inp.value; inp.value=""; zmUser(v); } });
  box.addEventListener("click",e=>{
    const zp=e.target.closest("[data-zp]"); if(zp){ if(zp.dataset.zp==="ok") zmConfirm(); else { ZM.prev=null; zmRender(); if(ZM.eng&&!ZM.mic) ZM.eng.start(); } return; }
    const zw=e.target.closest("[data-zpw]"); if(zw && ZM.prev){ const base=ZM.prev.text; ZM.prev=null; if(!zmPropose(base+" "+zw.dataset.zpw)) zmUser(base+" "+zw.dataset.zpw,false,true); return; }
    const s=e.target.closest("[data-say]"); if(s){ zmUser(s.dataset.say,false,true); return; }
    const a=e.target.closest("[data-za]"); if(!a) return; const k=a.dataset.za;
    if(k==="map") zmCutMap(); else if(k==="show"){ zmClose(); if(typeof clientShow==="function") clientShow(true); }
    else if(k==="save") saveCalc(); else if(k==="calc") zmClose(); else if(k==="kp") zmSendTo("kp"); else if(k==="rk") zmSendTo("raskroy");
  });
  $("zmSound").onclick=()=>{ const b=$("zmTts"); if(!b.classList.contains("hide")){ b.classList.add("hide"); return; } b.classList.remove("hide"); if(window.MebelVoice&&MebelVoice.settings) MebelVoice.settings(b); else b.textContent="Озвучка здесь недоступна."; };
  $("zmScanBtn").onclick=()=>$("zmFile").click();
  $("zmFile").onchange=e=>{ const f=e.target.files[0]; e.target.value=""; if(f && typeof zmScanFile==="function") zmScanFile(f); };
  // микрофон: каждая договорённая фраза - сразу ответ
  const listen=()=>`<span class="ed-wait">Слушаю - говорите...</span>`;
  // По одному: всё сказанное копится, пока мастер не нажмёт "Стоп" (или не скажет "стоп"), потом - "Я понял так".
  // Свободно: каждая договорённая фраза - сразу ответ.
  const draftHtml=extra=>`<span class="ed-heard">Слышу: ${esc((ZM.draft+" "+(extra||"")).trim())}</span><small class="zm-live-tip">Закончили - нажмите "Стоп"</small>`;
  const H={ final(f){
      if(ZM.strict){ let x=String(f).trim(); const stop=/(^|\s)стоп[.!]?$/i.test(x)||/^(все|всё|готово)[.!]?$/i.test(x); if(stop) x=x.replace(/(^|\s)(стоп|все|всё|готово)[.!]?$/i,"").trim();
        if(x) ZM.draft=(ZM.draft+" "+x).trim(); live.innerHTML=ZM.draft?draftHtml():listen(); live.classList.remove("hide"); if(stop&&ZM.eng) ZM.eng.stop(); return; }
      live.innerHTML=`<span class="ed-heard">Принял: ${esc(f)}</span>`; zmUser(f,true); clearTimeout(ZM.heardT); ZM.heardT=setTimeout(()=>{ if(ZM.mic) live.innerHTML=listen(); },1600); },
    interim(s){ if(ZM.strict&&ZM.mic){ live.innerHTML=ZM.draft||s?draftHtml(s):listen(); live.classList.remove("hide"); return; }
      if(s){ live.textContent=s; live.classList.remove("hide"); } else if(ZM.mic){ if(!live.querySelector(".ed-heard")) live.innerHTML=listen(); } else live.classList.add("hide"); },
    state(on,m){ ZM.mic=on; mic.classList.toggle("rec",on); mic.querySelector("span").textContent=on?"Стоп":"Говорить";
      if(on){ if(ZM.strict) ZM.draft=""; live.innerHTML=listen(); live.classList.remove("hide"); } else live.classList.add("hide");
      if(m){ zmLog("zm-err",esc(m)); zmRender(); }
      if(!on && ZM.strict && ZM.draft.trim()){ const d=ZM.draft; ZM.draft=""; zmUser(d,true); } } };
  const SR=!window.claude && (window.SpeechRecognition||window.webkitSpeechRecognition);
  if(window.claude&&window.claude.use) Promise.resolve(window.claude.use("dictation")).then(d=>{ if(d) ZM.eng=claudeEngine(d,H); else mic.classList.add("off"); }).catch(()=>mic.classList.add("off"));
  else if(SR) ZM.eng=webSpeechEngine(SR,H);
  else mic.classList.add("off");
  mic.onclick=()=>{ if(!ZM.eng){ zmLog("zm-err","В этом браузере нет распознавания речи. Откройте сайт в Chrome или диктуйте через микрофон на клавиатуре телефона - в поле ниже."); zmRender(); inp.focus(); return; }
    if(ZM.mic) ZM.eng.stop(); else ZM.eng.start(); };
  // вход: кнопка в шапке, карточка в разделе "Кухня", кнопка в помощнике, фраза "замер по шагам", адрес ?zamer=1
  const hb=document.createElement("button"); hb.className="b1 zm-open-btn"; hb.id="zmOpenBtn"; hb.innerHTML=MIC_SVG+" Замер голосом"; hb.title="Кухня по шагам: приложение спрашивает - вы отвечаете голосом";
  hb.onclick=()=>zmOpen();
  const vb=$("voiceBtn"); if(vb) vb.insertAdjacentElement("beforebegin",hb);
  const kf=$("kitchenForm"); if(kf){ const c=document.createElement("div"); c.className="card zm-card";
    c.innerHTML=`<div><b>Кухня голосом по шагам</b><span>Приложение спрашивает размеры и модули, вы отвечаете. Листы, петли, направляющие и цена считаются сразу.</span></div><button class="b1" id="zmOpenBtn2">${MIC_SVG} Начать замер</button>`;
    kf.insertAdjacentElement("afterbegin",c); $("zmOpenBtn2").onclick=()=>zmOpen(); }
  const et=document.querySelector("#edPanel .ed-tools"); if(et){ const b=document.createElement("button"); b.className="b1 vo-sm"; b.id="edZamer"; b.textContent="Кухня по шагам"; b.onclick=()=>zmOpen(); et.insertAdjacentElement("afterbegin",b); }
  if(/[?&]zamer=1/.test(location.search)) setTimeout(()=>zmOpen(false,true),60);
}
if(typeof setMode==="function" && typeof document!=="undefined"){
  // "замер по шагам", "кухня по шагам", "начать замер" - из обычного помощника
  const _zmEdit=editProject;
  editProject=function(text){
    if(!ZM.on && /^(начать |начни |начнем |открой |давай |новый )?(замер|замер голосом|замер по шагам|(кухн[а-я]* )?по шагам|пошагов[а-я]*( замер| расчет)?|кухн[а-я]* голосом)$/.test(vNorm(text).trim()))
      return {ok:false, info:true, errs:[], msg:["Открываю замер по шагам"], act:()=>setTimeout(()=>zmOpen(),50), applied:false, say:""};
    const r=_zmEdit(text);
    return r;
  };
  zmInit();
}
