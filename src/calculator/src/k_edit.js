// ================= ПРАВКИ ГОТОВОГО ПРОЕКТА СЛОВАМИ =================
// "добавь посудомойку 45 после мойки", "убери верхний шкаф над мойкой", "основная стена 3.5", "фасады эмаль", "отмена".
// Каждая фраза - одна правка с возможностью отмены. Ширина ряда сохраняется: место берётся у простых шкафов с полками.
const ED={undo:[], log:[], open:false};
const ED_PLAIN={lower:"l_shelf", upper:"u_shelf"};
// слова -> модуль кухни. Порядок важен: сначала узкие названия.
const ED_MODS=[
  [/посудомо|пмм/,"l_dish"],
  [/бутылочн|карго/,"l_bottle"],
  [/заглушк|планк|доборн/,(f,row)=>row==="upper"?"u_fill":"l_fill"],
  [/пенал[а-я ]*холодил|холодильник[а-я ]*встро|встроен[а-я ]*холодил/,"t_fridge"],
  [/пенал[а-я ]*(духов|свч)|духов[а-я ]*(в|на) пенал|свч|микроволн/,"t_oven"],
  [/пенал|колонн/,"t_shelf"],
  [/сушк/,"u_dryer"],
  [/подъемн|подъемник|лифт/,"u_lift"],
  [/вытяжк/,"u_hood"],
  [/открыт[а-я]* полк|полк[аиу] открыт/,"u_open"],
  [/окн|пуст/,(f,row)=>row==="lower"?"l_gap":"u_gap"],
  [/холодильник|плит|проем|ниш/,"l_gap"],
  [/духов/,"l_oven"],
  [/(^|[^а-я])мойк/,"l_sink"],
  [/2 глубок|ящик[а-я ]*(2|800)|глубок[а-я]* ящик/,"l_dr2"],
  [/ящик/,"l_dr3"],
  [/верхн[а-я]* (шкаф|модул)|навесн|верхн[а-я]*$|верхн[а-я]* /,"u_shelf"],
  [/шкаф|тумб|модул/,(f,row)=>row==="upper"?"u_shelf":"l_shelf"]
];
const ED_FAM={t_shelf:["t_shelf","t_fridge","t_oven"], l_dr3:["l_dr3","l_dr2"], l_dr2:["l_dr2","l_dr3"], l_gap:["l_gap","t_fridge"], t_fridge:["t_fridge","l_gap"], l_oven:["l_oven","t_oven"], t_oven:["t_oven","l_oven"], u_shelf:["u_shelf","u_lift","u_open"], u_lift:["u_lift","u_shelf"]};
const ED_FIXED=new Set(["l_dish","l_oven","l_sink","l_gap","t_fridge","t_oven","t_shelf"]);
const WALL_ACC=["основную стену","правую стену","левую стену"];
const ED_ORD={перв:1,втор:2,трет:3,четверт:4,пят:5,шест:6,седьм:7};
function edRow(f){ return /верх|навесн|сушк|вытяжк|подъемн|подъемник/.test(f)?"upper":/низ|нижн/.test(f)?"lower":null; }
function edType(f,row){ for(const [rx,t] of ED_MODS) if(rx.test(f)) return typeof t==="function"?t(f,row||edRow(f)):t; return null; }
function edWall(f,K){
  const lay=LAYOUTS[K.layout];
  let wi = /основн|главн|центральн/.test(f)?0 : /прав/.test(f)?1 : /лев/.test(f)?2 : /(втор|боков|друг)[а-я]* стен|(на|у) (втор|боков)[а-я]*$/.test(f)?(K.layout==="2L"?2:1) : null;
  if(wi!=null && !lay.walls.includes(wi)) return -1;
  return wi;
}
function edOrd(f){ if(/последн|крайн/.test(f)) return -1; for(const k in ED_ORD) if(new RegExp("(^|\\s)"+k+"[а-я]*").test(f)) return ED_ORD[k]; return null; }
function edWidth(f){ const ms=vMeasures(" "+f+" "); if(!ms.length) return null; const m=ms[ms.length-1]; return vFit(m,150,1500); }
// найти модули по описанию: тип, ряд, стена, порядковый номер, "над/под X"
function edFind(K,info,f){
  const row0=edRow(f), wall=edWall(f,K), ord=edOrd(f);
  const mOver=f.match(/(?:над|под|рядом с|возле|у) ([а-я -]+)$/), main=mOver?f.slice(0,mOver.index):f;
  const type=edType(main,row0), row=row0||(type?(MODLIB[type]&&MODLIB[type].cat==="up"?"upper":"lower"):null);
  const lay=LAYOUTS[K.layout], walls=wall!=null&&wall>=0?[wall]:[0,...lay.walls.filter(w=>w!==0)];
  const generic = !type || type===ED_PLAIN.lower || type===ED_PLAIN.upper;
  let cands=[];
  walls.forEach(wi=>{ ["lower","upper"].forEach(r=>{ if(row&&r!==row) return;
    K.walls[wi][r].forEach((m,j)=>{ const d=modDef(m.t)||{};
      if(type && !generic && m.t!==type) return;
      if(type && generic && (d.gap||m.t==="l_fill"||m.t==="u_fill") ) return;
      if(type && generic && !mOver && ord==null && m.t!==type) return;
      cands.push({wi,row:r,j,m}); }); }); });
  if(mOver){   // "над мойкой": модуль другого ряда, перекрывающий опорный
    const ref=edFind(K,info,mOver[1]).list[0];
    if(ref){ const wi=ref.wi, iw=info.walls.find(x=>x.wi===wi), src=(ref.row==="lower"?iw.low:iw.up)[ref.j];
      const other=ref.row==="lower"?"upper":"lower", arr=other==="lower"?iw.low:iw.up, mid=src.s+src.w/2;
      const near=/рядом|возле|(^|\s)у$/.test(mOver[0].split(" ")[0]);
      if(near) cands=cands.filter(c=>c.wi===wi && c.row===ref.row && Math.abs(c.j-ref.j)===1);
      else cands=cands.filter(c=>c.wi===wi && c.row===other).filter(c=>{ const p=arr[c.j]; return p && p.s<=mid && p.s+p.w>=mid; })
        .concat(cands.filter(c=>c.wi===wi && c.row===other).filter(c=>{ const p=arr[c.j]; return p && p.s<src.s+src.w && p.s+p.w>src.s; }));
      const seen=new Set(); cands=cands.filter(c=>{ const k=c.wi+c.row+c.j; if(seen.has(k)) return false; seen.add(k); return true; });
    } else cands=[];
  }
  if(!cands.length && type && !generic && ED_FAM[type] && !mOver){   // "пенал" - любой пенал, "ящики" - любые ящики
    walls.forEach(wi=>["lower","upper"].forEach(r=>{ if(row&&r!==row) return; K.walls[wi][r].forEach((m,j)=>{ if(ED_FAM[type].includes(m.t)) cands.push({wi,row:r,j,m}); }); }));
  }
  if(ord!=null){ const c = ord===-1 ? cands[cands.length-1] : cands[ord-1]; cands=c?[c]:[]; }
  return {list:cands, type, row, wall};
}
const edName = t => { const d=modDef(t); return d?d.name.toLowerCase():t; };
function edGen(){ return genKitchen(S.kit).info; }
// подогнать ряд по длине стены: лишнее - забрать у простых шкафов, свободное - отдать им или добавить шкафы
function edBalance(wi,row,keep){
  const K=S.kit, list=K.walls[wi][row], plain=ED_PLAIN[row], fill=row==="lower"?"l_fill":"u_fill", notes=[];
  const freeNow=()=>{ const iw=edGen().walls.find(x=>x.wi===wi); return iw?Math.round(row==="lower"?iw.freeL:iw.freeU):0; };
  for(let it=0;it<8;it++){
    const free=freeNow();
    if(Math.abs(free)<1) break;
    if(free<0){
      let need=-free;
      for(let j=list.length-1;j>=0&&need>0;j--){ const m=list[j]; if(m===keep||!(m.t===plain||m.t===fill||m.t==="u_open")) continue;
        const can = m.t===fill ? m.w : Math.max(0,m.w-300);
        if(can>=need){ m.w-=need; need=0; } else { need-=can; m.w-=can; }
        if(m.w<=0 || (m.t!==fill && m.w<300)){ need+=Math.max(0,m.w); list.splice(j,1); } }
      // всё ещё не помещается - убираем простые шкафы целиком
      for(let j=list.length-1;j>=0&&need>0;j--){ const m=list[j]; if(m===keep||m.t!==plain) continue; need-=m.w; list.splice(j,1); if(need<0){ list.splice(j,0,{t:plain,w:-need}); need=0; } }
      // последнее средство: сузить ящики и другие нефиксированные модули до 400
      for(let j=list.length-1;j>=0&&need>0;j--){ const m=list[j]; const d=modDef(m.t)||{}; if(m===keep||ED_FIXED.has(m.t)||d.gap||d.tall||m.w<=400) continue;
        const can=Math.min(m.w-400,need); m.w-=can; need-=can; notes.push(`${d.name}: сузил до ${m.w} мм`); }
      if(need>0 && keep && list.includes(keep) && !ED_FIXED.has(keep.t) && keep.w-need>=300){ keep.w-=need; notes.push(`${modDef(keep.t).name}: сузил до ${keep.w} мм, чтобы поместился`); }
      else if(need>0 && need===-free) break;          // сжимать больше нечего
    } else {
      let last=-1; for(let j=list.length-1;j>=0;j--) if(list[j]!==keep && list[j].t===plain){ last=j; break; }
      if(last>=0 && list[last].w+free<=900) list[last].w+=free;
      else if(free>=300) fillExact(free).forEach(x=>list.push({t:x.fill?fill:plain,w:x.w}));
      else if(last>=0) list[last].w+=free;
      else list.push({t:fill,w:free});
    }
  }
  const end=freeNow();
  if(end<-0.5) notes.push(`${WALL_NAMES[wi]}, ${row==="lower"?"нижний":"верхний"} ряд не помещается на ${fmt(-end)} мм - уберите или сузьте какой-нибудь модуль, или удлините стену`);
  return notes;
}
function edBalanceWall(wi,keep){
  const low=edBalance(wi,"lower",keep);
  if(low.some(x=>/не помещается/.test(x))) return low;     // пока низ не влез, верх подгонять бессмысленно (пеналы сдвигают верхний ряд)
  return low.concat(edBalance(wi,"upper",keep));
}
// ---------- свойства (размеры, отделка, заказ) ----------
function edMat(f){
  return /эмал|крашен/.test(f)?"mdf_enamel" : /пластик/.test(f)?"mdf_plastic" : /лдсп/.test(f)?"ldsp16f" : /мдф|пленк/.test(f)?"mdf" : null;
}
function edProps(f){
  const msg=[], m1=edWidth(f), K=S.kit;
  if(S.mode==="kitchen"){
    const lay=LAYOUTS[K.layout];
    if(/п-?\s?образн|три стены/.test(f)){ K.layout="3"; msg.push("Кухня П-образная"); }
    else if(/(углов|г-?\s?образн)/.test(f)){ K.layout=/слева|лев/.test(f)?"2L":"2R"; msg.push("Кухня угловая, вторая стена "+(K.layout==="2L"?"слева":"справа")); }
    else if(/угол (слева|справа)|(слева|справа) угол/.test(f)&&K.layout!=="1"&&K.layout!=="3"){ K.layout=/слева/.test(f)?"2L":"2R"; msg.push("Угол "+(K.layout==="2L"?"слева":"справа")); }
    else if(/прям[а-я]* кухн|^прям|линейн/.test(f)){ K.layout="1"; msg.push("Кухня прямая"); }
    if(msg.length){ LAYOUTS[K.layout].walls.forEach(wi=>{ if(!K.walls[wi].lower.length) fillExact(K.walls[wi].len-600).forEach(x=>K.walls[wi].lower.push({t:x.fill?"l_fill":"l_shelf",w:x.w})); edBalanceWall(wi); }); return msg; }
    const wi=edWall(f,K);
    if(/стен|^основн|^прав|^лев|^втор/.test(f) && wi!=null && m1!=null && !edType(f.replace(/стен[а-я]*/,""))){
      if(wi<0) return ["Такой стены в этой планировке нет"];
      const v=clamp(vMeasures(" "+f+" ").pop().mm,900,8000); K.walls[wi].len=v;
      const notes=edBalanceWall(wi); return [`${WALL_NAMES[wi]}: ${fmt(v)} мм`+(notes.length?"":", модули подогнаны"),...notes];
    }
    const mm=(lo,hi)=>{ const ms=vMeasures(" "+f+" "); return ms.length?vFit(ms[ms.length-1],lo,hi):null; };
    if(/потол/.test(f)){ const v=mm(1800,4000); if(v){ const c=kitCtx(K); K.Hu=clamp(Math.min(v-c.PL-c.Hl-c.topT-c.apronH,/до потол/.test(f)?1200:960),300,1200); K.Ht=c.Hl+c.topT+c.apronH+K.Hu; return [`Потолок ${fmt(v)} мм: верхние шкафы ${K.Hu} мм`]; } }
    if(/верхн|навесн/.test(f) && /высот|^верхн[а-я]*( шкаф[а-я]*)? \d/.test(f) || /высот[а-я]* верх/.test(f)){ const v=mm(250,1300); if(v){ K.Hu=clamp(Math.round(v/10)*10,300,1200); const c=kitCtx(K); K.Ht=c.Hl+c.topT+c.apronH+K.Hu; return [`Верхние шкафы ${K.Hu} мм`]; } }
    if(/столешниц[а-я]* на высот|высот[а-я]* (столешниц|нижн)|нижн[а-я]* (шкаф[а-я]* )?\d/.test(f)){ const v=mm(500,1100); if(v){ const c=kitCtx(K); K.Hl=clamp(Math.round((v>=750?v-c.PL-c.topT:v)/10)*10,500,950); return [`Нижние шкафы ${K.Hl} мм`]; } }
    if(/цокол/.test(f) && !/без/.test(f)){ const v=mm(0,250); if(v!=null){ K.PL=v; return [`Цоколь ${v} мм`]; } }
    if(/глубин[а-я]* (верх|навес)/.test(f)){ const v=mm(200,450); if(v){ K.Du=v; return [`Глубина верхних ${v} мм`]; } }
    if(/глубин/.test(f)){ const v=mm(400,900); if(v){ K.TD=v; K.Dl=clamp(v-40,300,700); return [`Глубина столешницы ${v} мм`]; } }
    if(/фасад/.test(f) && edMat(f)){ K.fac=edMat(f); return ["Фасады: "+matName(K.fac)]; }
    if(/столешниц/.test(f)){ const t=/камен|кварц|акрил/.test(f)?"top_stone":/компакт/.test(f)?"top_compact":/лдсп|38|обычн|пластик/.test(f)?"top38":null; if(t){ K.top=t; return ["Столешница: "+matName(t)]; } }
    if(/гола|gola|профил/.test(f)){ K.handles="gola"; return ["Ручки: профиль Gola"]; }
    if(/без ручек|push|пуш|тип-?он/.test(f)){ K.handles="push"; return ["Без ручек (push-to-open)"]; }
    if(/ручк|скоб|рейлинг/.test(f)&&!/без/.test(f)){ K.handles="std"; return ["Обычные ручки"]; }
    if(/подсветк/.test(f)){ K.led=!/без|убери|удали|не нужн|выключ/.test(f); return [K.led?"Подсветка под верхними шкафами":"Без подсветки"]; }
    if(/фартук|стенов/.test(f)){ K.apron=!/без|убери|удали|не нужн/.test(f); if(K.apron&&m1&&m1>=300&&m1<=900) K.apronH=m1; return [K.apron?"Фартук: стеновая панель"+(m1?", "+K.apronH+" мм":""):"Без фартука"]; }
    if(/без верхн|убери все верхн|удали все верхн/.test(f)){ lay.walls.forEach(w=>K.walls[w].upper=[]); return ["Верхние шкафы убраны"]; }
  }
  if(S.mode==="kupe"){
    const k=S.kupe, mm=(lo,hi)=>{ const ms=vMeasures(" "+f+" "); return ms.length?vFit(ms[ms.length-1],lo,hi):null; };
    if(/ширин/.test(f)){ const v=mm(800,6000); if(v){ k.W=v; return [`Ширина ${fmt(v)} мм`]; } }
    if(/высот|потол/.test(f)&&!/антресол|ящик/.test(f)){ const v=mm(1200,3200); if(v){ k.H=clamp(v,1200,3000); return [`Высота ${fmt(k.H)} мм`]; } }
    if(/глубин/.test(f)){ const v=mm(300,1000); if(v){ k.D=clamp(v,350,900); return [`Глубина ${fmt(k.D)} мм`]; } }
    const nd=vCount(f,"двер|створ"); if(nd){ k.M=clamp(nd,2,6); return [`Дверей: ${k.M}`]; }
    const ns=vCount(f,"секци|отделени"); if(ns&&!/(в|во) /.test(f)){ k.N=clamp(ns,1,6); return [`Секций: ${k.N}`]; }
    if(/антресол/.test(f)){ k.ant=!/без|убери|удали|не нужн/.test(f); const v=mm(250,700); if(k.ant&&v) k.antH=v; return [k.ant?"Антресоль "+k.antH+" мм":"Без антресоли"]; }
    if(/подсветк/.test(f)){ k.led=!/без|убери|удали|не нужн/.test(f); return [k.led?"С подсветкой":"Без подсветки"]; }
    if(/премиум|эконом|стандарт/.test(f)&&/профил|^премиум|^эконом/.test(f)){ k.prof=/премиум/.test(f)?"prem":/эконом/.test(f)?"eco":"std"; return ["Профиль: "+PROF[k.prof]]; }
    if(/встроен|в нишу/.test(f)){ k.type="built"; k.back=false; return ["Шкаф встроенный"]; }
    if(/к (одной )?стене/.test(f)){ k.type="semi"; return ["Шкаф к одной стене"]; }
    if(/корпусн|отдельно стоящ/.test(f)){ k.type="korp"; k.back=true; return ["Шкаф корпусный"]; }
    // двери: "все двери зеркало", "вторая дверь лакобель", "зеркало по центру"
    const seg=/зеркал/.test(f)?(/тонир|бронз|графит/.test(f)?"mirror_t":"mirror"):/лакобел|стекл/.test(f)?"glass":/лдсп/.test(f)?"ldsp10":null;
    if(seg && /двер|зеркал|лакобел/.test(f)){
      const o=edOrd(f);
      if(/по центру|посередин|в середин|средн/.test(f)){ for(let i=0;i<k.M;i++) k.doors[i]={segs:[i===Math.floor((k.M-1)/2)?seg:"ldsp10"]}; return ["Зеркало на средней двери"]; }
      if(o){ const i=o===-1?k.M-1:o-1; if(i<k.M){ k.doors[i]={segs:[seg]}; return [`Дверь ${i+1}: ${matName(seg)}`]; } }
      for(let i=0;i<6;i++) k.doors[i]={segs:[seg]}; return ["Все двери: "+matName(seg)];
    }
    // секции: "во второй секции 4 ящика", "добавь штангу в первую секцию", "в третьей 5 полок"
    const so=edOrd(f);
    if(so && /секци|отделени|(в|во) /.test(f)){
      const i=so===-1?k.N-1:so-1, s=k.secs[i]; if(!s||i>=k.N) return ["Такой секции нет"];
      const dr=vCount(f,"ящик"), sh=vCount(f,"полк|полок"), no=/без|убери|удали/.test(f);
      if(/ящик/.test(f)){ s.drawers=no?0:clamp(dr||3,1,5); return [`Секция ${i+1}: ящиков ${s.drawers}`]; }
      if(/штанг/.test(f)){ s.rod=!no; return [`Секция ${i+1}: ${s.rod?"со штангой":"без штанги"}`]; }
      if(/полк|полок/.test(f)){ s.shelves=no?0:clamp(sh||4,0,12); return [`Секция ${i+1}: полок ${s.shelves}`]; }
    }
  }
  if(S.mode==="univ"){
    const tp=S.u.tpl, pr=S.u.prms[tp]; if(!pr) return msg;
    const mm=(lo,hi)=>{ const ms=vMeasures(" "+f+" "); return ms.length?vFit(ms[ms.length-1],lo,hi):null; };
    const setP2=(k2,v,n)=>{ if(!(k2 in pr)||v==null) return null; pr[k2]=v; S.u.built=false; S.u.manual=false; return [`${n}: ${v}`]; };
    let r=null;
    if(/ширин/.test(f)) r=setP2("W",mm(200,4000),"Ширина, мм");
    else if(/высот/.test(f)) r=setP2("H",mm(200,3000),"Высота, мм");
    else if(/глубин/.test(f)) r=setP2("D",mm(150,1200),"Глубина, мм");
    else if(/цокол/.test(f)) r=setP2("plinth",mm(0,250),"Цоколь, мм");
    else if(/двер|створ/.test(f)) r=setP2("doors",/без/.test(f)?0:vCount(f,"двер|створ"),"Дверей");
    else if(/ящик/.test(f)) r=setP2("drawers",/без/.test(f)?0:vCount(f,"ящик"),"Ящиков");
    else if(/полк|полок/.test(f)) r=setP2("shelves",/без/.test(f)?0:vCount(f,"полк|полок"),"Полок");
    else if(/секци/.test(f)) r=setP2("sections",vCount(f,"секци"),"Секций");
    else if(/фасад/.test(f)&&edMat(f)) r=setP2("fac",edMat(f)==="ldsp16f"?"ldsp16":edMat(f),"Фасады");
    if(r){ if(/фасад/.test(f)) r=["Фасады: "+matName(pr.fac)]; return r; }
  }
  // данные заказа
  const {o}=vOrder(" "+f+" ");
  if(o.client||o.phone){ S.client=[o.client,o.phone].filter(Boolean).join(", "); msg.push("Клиент: "+S.client); }
  if(o.decor){ S.decor=o.decor; msg.push("Цвет: "+o.decor); }
  if(o.disc!=null){ S.disc=o.disc; msg.push("Скидка "+o.disc+"%"); }
  if(o.prepay!=null){ S.prepay=o.prepay; msg.push("Предоплата "+o.prepay+"%"); }
  if(o.days!=null){ S.days=o.days; msg.push("Срок "+o.days+" раб. дней"); }
  return msg;
}
// ---------- модули кухни ----------
const ED_VERB={add:/^(добав|постав|вставь|встав|нужн|еще |и еще)/, rm:/^(убер|удал|убрат|сними|выкин)/, swap:/поменя[а-я]* местами|переставь местами/,
  repl:/^(замен|поменя|смени|измени)[а-я]* (.+?) на (.+)$/, move:/^(перенес|передвин|подвин|сдвин|переставь|перемест)[а-я]*/};
function edKitchen(f){
  const K=S.kit; let info=edGen();
  const pick=(frag,label)=>{ const r=edFind(K,info,frag); if(!r.list.length) throw new Error(`Не нашёл ${label||"модуль"}: "${frag.trim()}"`); return r.list[0]; };
  const sel=c=>{ SEL={part:-1,mod:`${c.wi}${c.row==="lower"?"l":"u"}${c.j}`}; };
  let m;
  // поменяй местами X и Y
  if(ED_VERB.swap.test(f)){
    const rest=f.replace(/^.*?местами\s*/,""), parts=rest.split(/\s+и\s+|\s*,\s*/);
    if(parts.length<2) throw new Error("Скажите, что с чем поменять: \"поменяй местами мойку и духовку\"");
    const a=pick(parts[0]), b=pick(parts[1]); const la=K.walls[a.wi][a.row], lb=K.walls[b.wi][b.row];
    const x=la[a.j]; la[a.j]=lb[b.j]; lb[b.j]=x;
    const notes=a.wi!==b.wi||a.row!==b.row ? edBalanceWall(a.wi).concat(edBalanceWall(b.wi)) : [];
    sel(a); return [`Поменял местами: ${edName(lb[b.j].t)} и ${edName(la[a.j].t)}`,...notes];
  }
  // замени X на Y / поменяй X на Y
  if((m=f.match(ED_VERB.repl))){
    const t=edType(m[3],edRow(m[2])), w=edWidth(m[3]);
    if(!t || !edType(m[2])) return null;          // "поменяй фасады на эмаль" - это свойство
    const a=pick(m[2]), list=K.walls[a.wi][a.row], old=list[a.j];
    const tt = (MODLIB[t]&&MODLIB[t].cat==="up")!==(a.row==="upper") ? (a.row==="upper"?"u_shelf":t) : t;
    list[a.j]={t:tt,w:w||old.w};
    const notes=edBalanceWall(a.wi,list[a.j]); sel(a);
    return [`Заменил: ${edName(old.t)} -> ${edName(tt)} ${list[a.j].w} мм`,...notes];
  }
  // убери X
  if(ED_VERB.rm.test(f)){
    const frag=f.replace(/^[а-я]+\s*/,""); if(!edType(frag.replace(/\s(над|под|рядом с|возле) .*$/,""))) return null;
    const all=/(^|\s)все(х)?\s/.test(" "+frag+" ");
    const r=edFind(K,info,frag.replace(/(^|\s)все(х)?\s/," "));
    if(!r.list.length) throw new Error(`Не нашёл, что убрать: "${frag}"`);
    const items=all?r.list:[r.list[0]], walls=new Set(), names=[];
    let repl=false;
    items.slice().sort((a,b)=>b.j-a.j).forEach(c=>{ const list=K.walls[c.wi][c.row], md=list[c.j], plain=ED_PLAIN[c.row];
      names.push(edName(md.t)+" "+md.w+" мм");
      if(md.t===plain||md.t==="l_fill"||md.t==="u_fill"||MODLIB[md.t]&&MODLIB[md.t].gap) list.splice(c.j,1);
      else { list[c.j]={t:plain,w:md.w}; repl=true; }
      walls.add(c.wi); });
    const notes=[]; walls.forEach(wi=>notes.push(...edBalanceWall(wi)));
    return [`Убрал: ${names.join(", ")}`+(repl?" - на его месте шкаф с полкой":""),...notes];
  }
  // перенеси X на правую стену / после Y / в начало / левее
  if(ED_VERB.move.test(f)){
    const frag=f.replace(/^[а-я]+\s*/,"");
    const mm=frag.match(/^(.+?)\s+(на (основн|прав|лев|втор|боков|друг)[а-я]* стен[а-я]*|(после|за|перед|до|справа от|слева от) .+|в начало|в конец|левее|правее|влево|вправо|к углу|первым|последним)$/);
    if(!mm) throw new Error("Скажите куда: \"перенеси посудомойку после мойки\" или \"на правую стену\"");
    const a=pick(mm[1]), src=K.walls[a.wi][a.row], md=src[a.j], where=mm[2];
    src.splice(a.j,1);
    let dstW=a.wi, dst=src, at=a.j;
    if(/^на /.test(where)){ dstW=edWall(where,K); if(dstW==null||dstW<0){ src.splice(a.j,0,md); throw new Error("Такой стены в этой планировке нет"); } dst=K.walls[dstW][a.row]; at=dst.length; }
    else if(/левее|влево/.test(where)) at=Math.max(0,a.j-1);
    else if(/правее|вправо/.test(where)) at=Math.min(src.length,a.j+1);
    else if(/в начало|первым/.test(where)) at=0;
    else if(/в конец|последним/.test(where)) at=src.length;
    else { info=edGen(); const ref=edFind(K,info,where.replace(/^(после|за|перед|до|справа от|слева от)\s+/,"")).list.find(c=>c.wi===a.wi||true);
      if(!ref){ src.splice(a.j,0,md); throw new Error(`Не нашёл "${where}"`); }
      dstW=ref.wi; dst=K.walls[dstW][a.row]; const rj=ref.row===a.row?ref.j:dst.length-1; at=/^(после|за|справа)/.test(where)?rj+1:rj; }
    dst.splice(clamp(at,0,dst.length),0,md);
    const notes=dstW!==a.wi?edBalanceWall(a.wi).concat(edBalanceWall(dstW,md)):[];
    sel({wi:dstW,row:a.row,j:dst.indexOf(md)});
    return [`Перенёс: ${edName(md.t)}`+(dstW!==a.wi?` на ${WALL_ACC[dstW]}`:""),...notes];
  }
  // добавь X [ширина] [куда]
  if(ED_VERB.add.test(f)){
    let frag=f.replace(/^(и )?[а-я]+\s*/,"");
    let where=null; const wm=frag.match(/\s+((после|за|перед|до|справа от|слева от|над|рядом с|возле) .+|в начало|в конец|первым|последним|слева|справа)$/);
    if(wm){ where=wm[1]; frag=frag.slice(0,wm.index); }
    let wallF=null; const sm=frag.match(/\s*на (основн|прав|лев|втор|боков|друг)[а-я]* стен[а-я]*/);
    if(sm){ wallF=sm[0]; frag=frag.replace(sm[0]," "); }
    const row=edRow(frag), t=edType(frag,row);
    if(!t) return null;
    const cat=MODLIB[t].cat, rowT=cat==="up"?"upper":"lower";
    const w=edWidth(frag) || (t==="l_dish"&&/узк|45/.test(frag)?450:modDefW(t));
    let wi=wallF?edWall(wallF,K):0; if(wi==null||wi<0) throw new Error("Такой стены в этой планировке нет");
    let at=null;
    if(where){
      if(/в начало|первым|^слева$/.test(where)) at=0;
      else if(/в конец|последним|^справа$/.test(where)) at=K.walls[wi][rowT].length;
      else { const refF=where.replace(/^(после|за|перед|до|справа от|слева от|над|рядом с|возле)\s+/,""); const ref=edFind(K,info,refF).list[0];
        if(!ref) throw new Error(`Не нашёл "${refF}"`);
        wi=ref.wi;
        if(/^над/.test(where) || ref.row!==rowT){   // над мойкой: модуль верхнего ряда, перекрывающий центр опорного
          const iw=info.walls.find(x=>x.wi===wi), src=(ref.row==="lower"?iw.low:iw.up)[ref.j], arr=rowT==="lower"?iw.low:iw.up, mid=src.s+src.w/2;
          let j=arr.findIndex(p=>p.s<=mid&&p.s+p.w>=mid);
          if(j>=0 && K.walls[wi][rowT][j].t===t) return [`${modDef(t).name} над этим местом уже есть`];
          if(j>=0){ const list=K.walls[wi][rowT], old=list[j];
            if(old.t===ED_PLAIN[rowT]){ list[j]={t,w:/^над/.test(where)&&!edWidth(frag)?src.w:w}; const notes=edBalanceWall(wi,list[j]); sel({wi,row:rowT,j}); return [`Добавил: ${edName(t)} ${list[j].w} мм над модулем "${edName(ref.m.t)}" (вместо шкафа с полками)`,...notes]; }
            at=j; } else at=arr.filter(p=>p.s<mid).length;
        } else at=/^(после|за|справа|рядом|возле)/.test(where)?ref.j+1:ref.j;
      }
    }
    // без указания места и стены: если на основной нет простого шкафа - ищем его на другой стене
    if(at==null && !wallF && !K.walls[wi][rowT].some(x=>x.t===ED_PLAIN[rowT])){
      const o=LAYOUTS[K.layout].walls.find(w=>w!==wi && K.walls[w][rowT].some(x=>x.t===ED_PLAIN[rowT])); if(o!=null) wi=o; }
    const list=K.walls[wi][rowT];
    // без указания места: вместо простого шкафа той же ширины, иначе - вместо самого правого простого шкафа
    if(at==null){
      let j=list.findIndex(x=>x.t===ED_PLAIN[rowT]&&x.w===w);
      if(j<0) for(let q=list.length-1;q>=0;q--) if(list[q].t===ED_PLAIN[rowT]){ j=q; break; }
      if(j>=0){ const old=list[j]; list[j]={t,w}; const notes=edBalanceWall(wi,list[j]); sel({wi,row:rowT,j});
        return [`Добавил: ${edName(t)} ${w} мм на ${WALL_ACC[wi]}`+(old.w===w?` вместо шкафа с полкой`:``),...notes]; }
      at=list.length;
    }
    const md={t,w}; list.splice(clamp(at,0,list.length),0,md);
    const notes=edBalanceWall(wi,md); sel({wi,row:rowT,j:list.indexOf(md)});
    return [`Добавил: ${edName(t)} ${w} мм на ${WALL_ACC[wi]}`,...notes];
  }
  // сделай мойку 600 / посудомойку 45 / второй ящик 400
  const t0=edType(f), w0=edWidth(f);
  if(t0 && w0 && !/стен|высот|глубин|^(верхн|нижн)[а-я]*( шкаф[а-я]*)? \d/.test(f)){
    const a=pick(f.replace(/(сделай|ширин[а-я]*|шириной)/g," ").replace(/\d+(\.\d+)?\s*(мм|см|метр[а-я]*|м)?/g," ")), md=K.walls[a.wi][a.row][a.j], old=md.w;
    md.w=w0; const notes=edBalanceWall(a.wi,md); sel(a);
    return [`${edName(md.t)}: ${old} -> ${w0} мм`,...notes];
  }
  if(/подгони|заполни|выровня/.test(f)){ const notes=[]; LAYOUTS[K.layout].walls.forEach(wi=>notes.push(...edBalanceWall(wi))); return ["Ряды подогнаны по длине стен",...notes]; }
  return null;
}
// ---------- новый проект из той же панели ----------
const ED_NOUN=/^(угловая |угловую |прямая |прямую |п-образная |п-образную |встроенный |встроенная |корпусный |распашной |большой |маленький |небольшой )?(кухн|кухон|шкаф|купе|комод|тумб|прихож|стеллаж|гардероб|пенал|полк|антресол)/;
const ED_NEW=/^(нов[а-я]+ (проект|заказ|изделие)|начн[а-я]* (заново|новый проект)|опиши заново|опиши (новый )?(проект|заказ)|(мне |нам )?(клиенту )?(нужн[аоы]?|нужен|хочу|давай|сделай|сделаем|собери|делаем|проектируем|спроектируй)( нов[а-я]+)?(?= )|нов[а-я]+(?= (угл|прям|п-обр|кухн|кухон|шкаф|купе|комод|тумб|прихож|стеллаж|гардероб)))/;
function edNoun(t){ return ED_NOUN.test(t); }
// тело описания после "новый проект"/"сделай"; null - это не новый проект
function edNewBody(t){ if(/^новый расчет/.test(t)) return null; const m=t.match(ED_NEW); if(!m) return null;
  const rest=t.slice(m[0].length).replace(/^[\s,:-]+/,"");
  if(/^(проект|заказ|изделие|заново|новый проект)/.test(m[0].replace(/^нов[а-я]+ /,"")) || /^нов/.test(m[0])) return rest;
  return edNoun(rest) ? rest : null; }
// фраза начинается с изделия, и это другое изделие или проект ещё не трогали
function edLooksNew(t){ if(!edNoun(t)) return false;
  if(S.mode==="kitchen" && /^шкаф(?![а-я -]*(купе|распаш|гардероб))/.test(t)) return false; // "шкаф 400 после мойки" - модуль кухни
  const ps=parseSpeech(t); if(!ps||!ps.mode) return false;
  if(ps.mode!==S.mode) return true;
  const key=S.mode==="kitchen"?"kit":S.mode==="kupe"?"kupe":"u", d=defaultState();
  return JSON.stringify(d[key])===JSON.stringify(S[key]); }
function edBuild(text, more){
  const ps=parseSpeech(text); if(!ps||!ps.mode||!ps.apply) return null;
  ED.undo.push({s:JSON.stringify(S),p:JSON.stringify(PRICE)}); if(ED.undo.length>40) ED.undo.shift();
  ps.apply(S); SEL={part:-1,mod:null}; ED.wantDesc=false; ED.desc={text, live:true};
  const said=ps.rows.filter(r=>r.src==="said").map(r=>`${esc(r.label)}: <b>${esc(r.val)}</b>`), def=ps.rows.filter(r=>r.src!=="said").length;
  const h=[(more?"Дополнил проект":"Собрал проект")+" - "+esc(({kitchen:"Кухня",kupe:"Шкаф-купе",univ:"Изделие"})[ps.mode]||"")+".", said.join("; ")+(def?`. Остальное (${def}) - типовое, можно поправить.`:"")];
  if(ps.asks.length) h.push("Уточните: "+ps.asks.map(a=>`<button class="vo-link" data-say="${esc(a.ins||a.say)}" title="Например: ${esc(a.say)}">${esc(a.label)}</button>`).join(" · "));
  if(ps.warns&&ps.warns.length) h.push(ps.warns.map(esc).join("<br>"));
  return {ok:true, built:true, mode:ps.mode, html:true, msg:h, say:more?"Дополнил":"Собрал проект"};
}
// ---------- одна фраза = одна или несколько правок ----------
function editProject(text){
  const t=vNorm(text).replace(/(?<!\d)[.!?]+|[.!?]+(?!\d)/g,",").replace(/^[\s,]+|[\s,]+$/g,"").trim();
  if(!t) return {ok:false, msg:[]};
  if(/^(отмен|верни( как было)?$|назад$|отмени)/.test(t)) return edUndo();
  if(typeof tplCommand==="function"){ const r=tplCommand(t); if(r) return r; }
  // новый проект голосом: "новая кухня ...", "сделай шкаф-купе ...", "угловая кухня 3 на 2" - собираем сразу здесь же
  const nb=edNewBody(t);
  if(nb!=null){ if(nb.trim()){ const b=edBuild(nb); if(b) return b; }
    ED.wantDesc=true; return {ok:false, info:true, msg:["Опишите, что делаем: например \"угловая кухня, стена 3 метра и 2 метра, посудомойка 60\" или \"шкаф-купе 2,4 на 2,4, две двери\"."], say:"Опишите, что делаем"}; }
  if(ED.wantDesc || edLooksNew(t)){ const b=edBuild(t); if(b) return b; }
  if(typeof edWhole==="function"){ const w=edWhole(t); if(w){
    if(w.pre){ ED.undo.push({s:JSON.stringify(S),p:JSON.stringify(PRICE)}); w.pre(); return w; }
    if(w.act){ try{ w.act(); }catch(e){ return {ok:false,msg:[],errs:[e.message||String(e)]}; } }
    return w; } }
  // делим на части по запятым и перед новым глаголом: "добавь посудомойку и убери бутылочницу"
  // "зеркало и ЛДСП" на одной двери - не делим по "и"
  const t2=t.replace(/(зеркал[а-я]*|лакобел[а-я]*|стекл[а-я]*|лдсп)\s+и\s+(?=(зеркал|лакобел|стекл|лдсп))/g,"$1 + ");
  const clauses=t2.split(/\s*[,;]\s*|\s+и\s+|\s+а также\s+/).filter(x=>x&&x.trim().length>1);
  const snap={s:JSON.stringify(S),p:JSON.stringify(PRICE)}, msg=[], errs=[]; let changed=false;
  // "поменяй местами мойку, духовку" - не делим
  const parts = ED_VERB.swap.test(t) ? [t.replace(/,/g," и ")] : clauses;
  const VERB=/^(добав|постав|встав|убер|удал|убрат|сними|замен|поменя|перенес|передвин|подвин|сдела)[а-я]*/;
  let prevVerb="";
  const one=c=>{ let r=null; if(typeof edMore==="function") r=edMore(c); if(r&&r.length) return r; if(S.mode==="kitchen") r=edKitchen(c); if(!r||!r.length) r=edProps(c); return r&&r.length?r:null; };
  for(const c0 of parts){ const c=c0.trim(); let r=null, err=null;
    try{ r=one(c); }catch(e){ err=e.message; }
    // "добавь мойку и посудомойку": у второй части глагол берём из первой
    if(!r && prevVerb && !VERB.test(c)){ try{ r=one(prevVerb+" "+c); if(r) err=null; }catch(e){ err=err||e.message; } }
    const vm=c.match(VERB); if(vm) prevVerb=vm[0];
    if(r){ msg.push(...r); changed=true; } else errs.push(err||`Не понял: "${c}"`); }
  if(changed){ ED.undo.push(snap); if(ED.undo.length>40) ED.undo.shift(); if(ED.desc) ED.desc.live=false; }
  // правкой не понял - может, это продолжение описания только что собранного проекта ("вторая стена 2 метра")
  if(!changed && ED.desc && ED.desc.live){ const said=x=>{ const p=parseSpeech(x); return p&&p.mode?JSON.stringify(p.rows.filter(r=>r.src==="said")):""; };
    const a=said(ED.desc.text), c=ED.desc.text+", "+text, bb=said(c);
    if(bb && bb!==a && parseSpeech(c).mode===S.mode){ const b=edBuild(c, true); if(b) return b; } }
  // или описание нового изделия ("комод 90 на 90, 4 ящика")
  if(!changed && edNoun(t)){ const b=edBuild(text); if(b) return b; }
  // ничего не понял - может, это переход по сайту или кнопка на экране ("перейди в раскрой", "нажми сохранить")
  if(!changed && window.MebelSite && MebelSite.voiceNav){ const nv=MebelSite.voiceNav(text); if(nv) return {ok:false, msg:[nv], errs:[], info:true, say:nv}; }
  return {ok:changed, msg, errs};
}
function edUndo(){
  if(!ED.undo.length) return {ok:false, msg:[], errs:["Отменять нечего"]};
  const e=ED.undo.pop(), snap=typeof e==="string"?{s:e}:e;
  const st=migrateState(JSON.parse(snap.s)); if(st) S=st; SEL={part:-1,mod:null};
  if(snap.p && snap.p!==JSON.stringify(PRICE)){ PRICE=JSON.parse(snap.p); savePrice(); }
  return {ok:true, undone:true, msg:["Отменил последнюю правку"], errs:[]};
}
function edRefresh(){ const keep=SEL; setMode(S.mode); SEL=keep; calc(); }

// ответ вслух - только на вопросы, заданные голосом
function edSpeak(text){
  // голос и запись живого голоса - в site/shared/golos.js (MebelVoice); пока говорит - не слушаем
  if(!window.MebelVoice) return;
  const was=ED.eng&&ED.on; if(was) ED.eng.stop();
  MebelVoice.say(text,()=>{ if(was&&ED.open&&ED.eng) ED.eng.start(); });
}
// ---------- панель "Правка голосом" ----------
const ED_HELP={
  kitchen:["добавь посудомойку 45 после мойки","убери верхний шкаф над мойкой","замени духовку на ящики","поменяй местами мойку и посудомойку","перенеси пенал на правую стену","замени все верхние на подъёмники","мойку 600","основная стена 3,5 метра","верхние 900","фасады эмаль","столешница камень","убери ручки","ручки Gola","угол глухой","без цоколя","подсветка"],
  kupe:["ширина 2,6 метра","добавь дверь","все двери зеркало","вторая дверь зеркало и ЛДСП","добавь ящик во вторую секцию","убери полку из первой секции","добавь штангу","ширина второй секции 900","без антресоли","профиль премиум"],
  univ:["ширина 1200","добавь ящик","убери двери","добавь полку","добавь фасад 400 на 700","без задней стенки","фасады эмаль"],
  common:["сколько стоит проект","сколько стоит ЛДСП","цена петли 1500","прайс загружен?","добавь в расчёт смеситель 15000","без монтажа","скидка 5 процентов","телефон 8 701 123 45 67","покажи 3D","открой прайс","покажи клиенту","сохрани расчёт","сохрани как шаблон угловая белая","перейди в раскрой","нажми скачать Excel","новый проект","отмена","помощь"]};
function edHelpHtml(){
  const L=a=>a.map(x=>`<button class="vo-link" data-h="${esc(x)}">${esc(x)}</button>`).join(" · ");
  return (PAGE==="calc"&&ED_HELP[S.mode]?`<div class="ed-hg"><b>${({kitchen:"Кухня",kupe:"Шкаф-купе",univ:"Изделие"})[S.mode]}:</b> ${L(ED_HELP[S.mode])}</div>`:"")+`<div class="ed-hg"><b>Везде:</b> ${L(ED_HELP.common)}</div><div class="note">Новый проект - просто опишите его: "угловая кухня 3 на 2 метра, посудомойка 60". Правки - можно несколько одной фразой через "и" или запятую.</div>`;
}
function edInit(){
  const box=document.createElement("div"); box.id="edBar"; box.className="edbar";
  box.innerHTML=`<button class="ed-pill" id="edPill">${MIC_SVG} Голосом</button>
    <div class="ed-panel hide" id="edPanel">
      <div class="ed-top"><b>Голосовой помощник</b><button class="vo-link ed-mute" id="edVoiceSet" title="Отвечать вслух и каким голосом">звук</button><span class="vo-st" id="edSt"></span><button class="bx" id="edX" title="Свернуть">&times;</button></div>
      <div class="ed-log" id="edLog"></div>
      <div class="vo-live hide" id="edLive"></div>
      <div class="ed-row"><button class="b1 hide" id="edMic" title="Говорить">${MIC_SVG}</button><input id="edIn" placeholder="Опишите проект, правку или вопрос" autocomplete="off"><button class="b1" id="edGo">OK</button></div>
      <div class="ed-tools"><button class="b2 vo-sm" id="edUndo">Отменить правку</button><button class="b2 vo-sm" id="edNew" title="Большое поле: диктовать долго, шаблоны, выжимка">Подробное описание</button><button class="b2 vo-sm" id="edTpl">Сохранить как шаблон</button><button class="b2 vo-sm" id="edShow">Показать клиенту</button><details><summary>Что можно сказать</summary><div class="ed-help" id="edHelp"></div></details></div>
    </div>`;
  document.body.appendChild(box);
  const log=$("edLog"), inp=$("edIn"), live=$("edLive"), mic=$("edMic");
  const show=open=>{ ED.open=open; $("edPanel").classList.toggle("hide",!open); $("edPill").classList.toggle("hide",open); LS.set("mk2_ed_open",open?1:0); if(open) renderHelp(); else if(ED.eng&&ED.on) ED.eng.stop(); };
  const renderHelp=()=>{ $("edHelp").innerHTML=edHelpHtml(); };
  const addLog=(cls,html)=>{ ED.log.push({cls,html}); if(ED.log.length>10) ED.log.shift(); log.innerHTML=ED.log.map(x=>`<div class="${x.cls}">${x.html}</div>`).join(""); log.scrollTop=log.scrollHeight; };
  const run=(text,byVoice)=>{
    text=String(text||"").trim(); if(!text) return;
    const c=voiceCmd(text); if(c==="stop"){ ED.eng&&ED.eng.stop(); return; }
    const r=editProject(text);
    if(r.applied){ addLog("ed-q","&laquo;"+esc(text)+"&raquo;"); addLog("ed-ok",r.msg.map(esc).join("<br>")); if(byVoice) edSpeak("Готово"); return; }
    addLog("ed-q","&laquo;"+esc(text)+"&raquo;");
    if(r.msg.length) addLog(r.info?"ed-info":"ed-ok",r.html?r.msg.join("<br>"):r.msg.map(esc).join("<br>"));
    if(byVoice) edSpeak(r.say || (r.ok ? (r.undone?"Отменил":"Готово") : (r.errs&&r.errs.length&&!r.msg.length ? "Не понял, скажите иначе" : "")));
    if(r.errs&&r.errs.length) addLog("ed-err",r.errs.map(esc).join("<br>")+(r.ok?"":`<br><span class="note">Примеры - в "Что можно сказать".</span>`));
    if(r.built){ setMode(r.mode); calc(); } else if(r.ok) edRefresh();
    if(r.ok){ if(window.innerWidth<940){ const sk=$("sketch"); if(sk) sk.scrollIntoView({behavior:"smooth",block:"start"}); } }
  };
  $("edVoiceSet").onclick=()=>{ let b=$("edTts"); if(!b){ b=document.createElement("div"); b.id="edTts"; b.className="ed-tts"; $("edVoiceSet").closest(".ed-top").insertAdjacentElement("afterend",b); } else if(!b.hidden){ b.hidden=true; return; } b.hidden=false; if(window.MebelVoice) MebelVoice.settings(b); };
  const hint=()=>{ if(!ED.log.length) log.innerHTML=`<div class="ed-info">Говорите или пишите:<br>• новый проект - "угловая кухня, стены 3 и 2 метра, посудомойка 60"<br>• правки - "добавь ящик", "убери ручки", "двери зеркало"<br>• вопросы и переходы - "сколько стоит проект", "открой прайс"</div>`; };
  hint();
  // кнопка "Голосом" вверху и в демо: открыть помощника и сразу слушать
  window.edOpen=()=>{ show(true); if(ED.eng&&!ED.on) ED.eng.start(); else inp.focus(); };
  $("edPill").onclick=()=>show(true);
  $("edX").onclick=()=>show(false);
  $("edGo").onclick=()=>{ run(inp.value); inp.value=""; inp.focus(); };
  inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); run(inp.value); inp.value=""; } });
  $("edUndo").onclick=()=>run("отмена");
  $("edNew").onclick=()=>{ if(ED.eng) ED.eng.stop(); openVoice(); };
  $("edShow").onclick=()=>{ if(typeof clientShow==="function") clientShow(true); };
  $("edTpl").onclick=()=>openModal("Сохранить как шаблон",`<p class="note" style="margin-top:0">Шаблон - копия текущего изделия. Его можно открыть в "Подробное описание" или голосом: "открой шаблон ...".</p>
      <input id="tplName" placeholder="Например: Угловая белая с пеналом" value="${esc((MODE_NAMES[S.mode]||"")+" ")}"><div class="btns"><button class="b1" id="tplOk">Сохранить</button></div>`,()=>{
      const i=$("tplName"); i.focus(); i.setSelectionRange(i.value.length,i.value.length);
      const ok=()=>{ const n=tplSave(i.value); if(n){ closeModal(); toast("Шаблон \""+n+"\" сохранён"); } };
      $("tplOk").onclick=ok; i.addEventListener("keydown",e=>{ if(e.key==="Enter") ok(); }); });
  log.addEventListener("click",e=>{ const b=e.target.closest("[data-say]"); if(b){ inp.value=b.dataset.say.replace(/\s*$/," "); inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length); } });
  $("edHelp").addEventListener("click",e=>{ const b=e.target.closest("[data-h]"); if(b){ inp.value=b.dataset.h; inp.focus(); } });
  // микрофон: каждая договорённая фраза сразу выполняется
  const H={ final(f){ live.classList.add("hide"); run(f,true); },
    interim(s){ live.textContent=s; live.classList.toggle("hide",!s); },
    state(on,m){ ED.on=on; mic.classList.toggle("wa",on); $("edSt").textContent=on?"Слушаю...":""; $("edSt").classList.toggle("rec",on); if(m) addLog("ed-err",esc(m)); } };
  const SR=!window.claude && (window.SpeechRecognition||window.webkitSpeechRecognition);
  if(window.claude&&window.claude.use) Promise.resolve(window.claude.use("dictation")).then(d=>{ if(d){ ED.eng=claudeEngine(d,H); mic.classList.remove("hide"); } }).catch(()=>{});
  else if(SR){ ED.eng=webSpeechEngine(SR,H); mic.classList.remove("hide"); }
  mic.onclick=()=>{ if(!ED.eng) return; if(ED.on) ED.eng.stop(); else ED.eng.start(); };
  if(LS.get("mk2_ed_open",0)) show(true);
}
// панель видна только на странице расчёта; модальное окно голоса не должно конфликтовать с панелью за микрофон
if(typeof setMode==="function"){
const _edSetMode=setMode;
setMode=function(m){ _edSetMode(m); if($("edHelp")) $("edHelp").innerHTML=edHelpHtml(); };
const _edOpenVoice=openVoice;
openVoice=function(){ if(ED.eng&&ED.on) ED.eng.stop(); return _edOpenVoice.apply(this,arguments); };
edInit();
}
