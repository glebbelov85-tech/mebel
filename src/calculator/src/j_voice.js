// ================= ОПИСАНИЕ СЛОВАМИ (голосом или текстом) -> ПРОЕКТ =================
// Разбор работает прямо в браузере, без интернета и без ключей.
const NUM_W = {ноль:0,один:1,одна:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,
  шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,
  сто:100,двести:200,триста:300,четыреста:400,пятьсот:500,шестьсот:600,семьсот:700,восемьсот:800,девятьсот:900};
function vNorm(text){
  let t=" "+String(text).toLowerCase().replace(/ё/g,"е").replace(/[–—]/g,"-").replace(/(\d)\s*[xх×*]\s*(?=\d)/g,"$1 на ")+" ";
  t=t.replace(/полтора|полторы/g,"1.5").replace(/(\d+|[а-я]+)\s+с половиной/g,(m,a)=>{ const n=/^\d+$/.test(a)?+a:NUM_W[a]; return n==null?m:String(n+0.5); });
  // числа словами -> цифры ("две тысячи четыреста" -> 2400, "два сорок" остаётся "2 40")
  const w=t.split(/(\s+|[,.;:!?()])/), out=[]; let acc=null, last=0, pendSp="";
  const flush=()=>{ if(acc!=null){ out.push(String(acc)); acc=null; last=0; } if(pendSp){ out.push(pendSp); pendSp=""; } };
  for(const tok of w){
    if(tok==="") continue;
    if(/^\s+$/.test(tok)){ if(acc!=null) pendSp=tok; else out.push(tok); continue; }
    if(/^тысяч/.test(tok)){ acc=(acc==null?1:acc)*1000; last=1000; continue; }
    const n=NUM_W[tok];
    if(n!=null){
      const ord=n>=100?100:n>=20?10:1;
      if(acc!=null && ((last===1000) || (last>ord && !(last===10 && n>=10)))){ acc+=n; last=ord; pendSp=""; }
      else { flush(); acc=n; last=ord; }
      continue;
    }
    flush(); out.push(tok);
  }
  flush();
  return out.join("").replace(/(\d),(\d)/g,"$1.$2").replace(/\s+/g," ");
}
function vCount(t,rx){ const m=t.match(new RegExp("(\\d+)\\s*(?:-?х\\s*)?(?:"+rx+")")); return m?+m[1]:null; }
// все размеры из текста: [{mm, ctx - слова перед числом, pos}]
function vMeasures(t){
  // убрать количества ("3 двери", "2 секции"), чтобы не принять их за размеры
  let s=t.replace(/(\d+)\s*(?:-?х\s*)?(двер|створ|секци|ящик|полк|полок|стен|штанг|модул|шт)/g,(m,a,b)=>" ".repeat(a.length)+" "+b);
  const rx=/(\d+(?:\.\d+)?)\s*(мм|миллиметр[а-я]*|см|сантиметр[а-я]*|метр[а-я]*|м(?![а-я]))?(?:\s*(?:и\s+)?(\d{1,2})(?![\d.])\s*(см|сантиметр[а-я]*)?(?!\s*(?:мм|м(?![а-я])|метр)))?/g;
  const res=[]; let m, prevEnd=0;
  while((m=rx.exec(s))){
    let v=+m[1], u=m[2]||"", mm;
    const second = m[3]!=null && ((/^м/.test(u)&&!/^мм|^милли/.test(u)) || (!u && v<10 && +m[3]>=10)) ? +m[3] : null;
    if(/^мм|^милли/.test(u)) mm=v; else if(/^см|^санти/.test(u)) mm=v*10; else if(/^м/.test(u)) mm=v*1000;
    else mm = (v<=20) ? v*1000 : v<400 ? v*10 : v;
    let end=m.index+m[0].length;
    if(second!=null) mm+=second*10; else if(m[3]!=null){ end=m.index+m[1].length+(m[2]?m[0].indexOf(m[2])-m[1].length+m[2].length:0); rx.lastIndex=end; }
    res.push({mm:Math.round(mm), ctx:s.slice(prevEnd,m.index).slice(-60), after:s.slice(end,end+30), pos:m.index});
    prevEnd=end;
  }
  return res;
}
const mmTxt = v => fmt(v)+" мм";
function fillExact(len){            // разбить длину на модули стандартной ширины
  len=Math.round(len); const r=[];
  if(len<=0) return r;
  if(len<300) return [{w:len,fill:1}];
  let n=Math.floor(len/600), rem=len-600*n;
  for(let i=0;i<n;i++) r.push({w:600});
  if(rem>=300) r.push({w:rem}); else if(rem>0){ if(n>0) r[r.length-1].w+=rem; }
  if(r.length>=2 && r[r.length-1].w<400 && r[r.length-2].w===600){ const sum=r[r.length-1].w+600; r[r.length-2].w=Math.ceil(sum/2/50)*50; r[r.length-1].w=sum-r[r.length-2].w; }
  return r;
}
function parseSpeech(text){
  const t=vNorm(text), has=rx=>rx.test(t), got=[], warns=[];
  if(t.trim().length<3) return null;
  const ms=vMeasures(t);
  const role=(m,map)=>{ for(const [rx,k] of map) if(rx.test(m.ctx)) return k; return null; };
  const isKitchen=has(/кухн/), isKupe=!isKitchen && has(/купе|шкаф(?!чик)/) && !has(/распашн/);
  // ---------- КУХНЯ ----------
  if(isKitchen){
    const K=kitDefaults();
    let layout = has(/п-?\s?образн|буквой п|три стены|3 стен/) ? "3" : has(/углов|г-?\s?образн|буквой г|две стены|2 стен/) ? "2R" : has(/прям|линейн|одна стена|1 стен|вдоль одной/) ? "1" : null;
    const lens={}, free=[]; let Hu=null, Htot=null;
    ms.forEach(m=>{
      const r=role(m,[[/высот[а-я]* (верх|навес)|верхн[а-я]* (шкаф|ряд|модул)[а-я]*( высот[а-я]*)?\s*$/,"hu"],[/потол|высот/,"h"],[/глубин/,"d"],[/фартук/,"ap"],[/посудомо|духов|холодильн|мойк|плит/,"skip"],
        [/основн|главн|длинн|больш|перв/,"main"],[/лев|трет/,"left"],[/втор|меньш|коротк|боков|прав|друг/,"side"]]);
      if(r==="hu") Hu=m.mm; else if(r==="h") Htot=m.mm; else if(r==="d"||r==="ap"||r==="skip"){ if(r==="ap") K.apronH=clamp(m.mm,300,900); }
      else if(r) lens[r]=m.mm; else if(m.mm>=900) free.push(m.mm);
    });
    ["main","side","left"].forEach(k=>{ if(lens[k]==null && free.length) lens[k]=free.shift(); });
    if(!layout) layout = lens.left ? "3" : lens.side ? "2R" : "1";
    if(layout==="2R" && has(/(стен[а-я]*|угол|сторон[а-я]*) слева|лев[а-я]+ (стен|сторон)|слева (втор|коротк|меньш)/)){ layout="2L"; if(lens.left==null){ lens.left=lens.side; delete lens.side; } }
    if(layout==="2L" && lens.left==null && lens.side!=null){ lens.left=lens.side; }
    if(layout==="3" && lens.left==null) lens.left=lens.side;
    K.layout=layout;
    const L0=clamp(lens.main||3000,1200,8000), L1=clamp(lens.side||2000,900,8000), L2=clamp(lens.left||L1,900,8000);
    got.push("Кухня: "+({"1":"прямая","2R":"угловая, вторая стена справа","2L":"угловая, вторая стена слева","3":"П-образная"})[layout]);
    got.push("Основная стена: "+mmTxt(L0)+(lens.main?"":" (не названа - поставил 3 м)"));
    if(layout==="2R"||layout==="3") got.push("Правая стена: "+mmTxt(L1)+(lens.side?"":" (не названа)"));
    if(layout==="2L"||layout==="3") got.push("Левая стена: "+mmTxt(L2)+(lens.left?"":" (не названа)"));
    // высота: либо верхних шкафов, либо всей кухни от пола
    if(Hu==null && Htot!=null){ if(Htot<=1200) Hu=Htot; else { Hu=Htot-K.PL-K.Hl-MAT(K.top).t-K.apronH; got.push("Высота кухни от пола: "+mmTxt(Htot)); } }
    if(Hu!=null){ K.Hu=clamp(Math.round(Hu/10)*10,300,1200); got.push("Верхние шкафы высотой "+mmTxt(K.Hu)); if(K.Hu!==Math.round(Hu/10)*10) warns.push("Высота верхних шкафов вышла за разумные пределы - поставил "+K.Hu+" мм."); }
    // отделка
    if(has(/эмал|крашен/)) K.fac="mdf_enamel"; else if(has(/пластик/)) K.fac="mdf_plastic"; else if(has(/фасад[а-я]* (из )?лдсп|лдсп фасад/)) K.fac="ldsp16f"; else if(has(/мдф|пленк/)) K.fac="mdf";
    if(has(/камен|кварц|акрил/)) K.top="top_stone"; else if(has(/компакт/)) K.top="top_compact";
    if(has(/гола|gola|профил[а-я]* ручк|интегрирован/)) K.handles="gola"; else if(has(/без ручек|push|пуш|тип-?он|от нажати/)) K.handles="push";
    got.push("Фасады: "+matName(K.fac)+", столешница: "+matName(K.top)+", "+HANDLES[K.handles]);
    K.led=has(/подсветк/) && !has(/без подсветк/); K.apron=!has(/без фартук|без стенов/);
    const noUp=has(/без верхн|без навесн|только низ/);
    const wantDish=has(/посудомо|пмм/) && !has(/без посудомо/), dishW=has(/посудомо[а-я ]*(45|450|узк)|узк[а-я]* посудомо/)?450:600;
    const ovenTall=has(/духов[а-я ]*(в |на )?(пенал|колонн|уровне)|пенал[а-я ]*(с |под )?духов|свч|микроволн/);
    const wantOven=!has(/без духов/), fridgeIn=has(/встроен[а-я]* холодильн|холодильник[а-я ]* встро|пенал[а-я ]*(под )?холодильн/);
    const fridgeGap=!fridgeIn && has(/холодильн/) && !has(/без холодильн|холодильник (стоит )?отдельно в/);
    const bottle=has(/бутылочн|карго/);
    const talls=[]; if(fridgeIn) talls.push("t_fridge"); if(ovenTall) talls.push("t_oven"); if(has(/пенал/) && !talls.length) talls.push("t_shelf");
    K.Ht=K.Hl+MAT(K.top).t+K.apronH+K.Hu;
    const c=kitCtx(K), lay=LAYOUTS[layout];
    K.walls=[{len:L0,lower:[],upper:[]},{len:L1,lower:[],upper:[]},{len:L2,lower:[],upper:[]}];
    const cz={}; lay.corners.forEach(s=>cz[s]={low:cornerSize(K.corners[s].low,c,false),up:cornerSize(K.corners[s].up,c,true)});
    const run=(wi,k)=> wi===0 ? [lay.corners.includes("L")?cz.L[k].A:0, L0-(lay.corners.includes("R")?cz.R[k].A:0)] : wi===1 ? [cz.R[k].B,L1] : [0,L2-cz.L[k].B];
    // пеналы и проём под холодильник - на свободный конец: у угловой - конец боковой стены, у прямой - левый край
    const endWall = layout==="1"?0 : layout==="2L"?2 : 1;           // стена, в конец которой ставим пеналы
    const plan={0:{pre:[],req:[],post:[]},1:{pre:[],req:[],post:[]},2:{pre:[],req:[],post:[]}};
    const endKey = endWall===1 ? "post" : "pre";                    // правая стена: свободный конец - в конце ряда
    talls.forEach(tm=>plan[endWall][endKey].push({t:tm,w:600}));
    if(fridgeGap) plan[endWall][endKey][endKey==="post"?"push":"unshift"]({t:"l_gap",w:600});
    // обязательное на основной стене: мойка, посудомойка, ящики, духовка
    const req=plan[0].req;
    req.push({t:"l_sink",w:L0>=2400?800:600});
    if(wantDish) req.push({t:"l_dish",w:dishW});
    req.push({t:"l_dr3",w:L0>=3000?600:400});
    if(wantOven && !ovenTall) req.push({t:"l_oven",w:600});
    if(bottle) req.push({t:"l_bottle",w:200});
    const sum=l=>l.reduce((s,m)=>s+m.w,0);
    // что не влезло на основную стену - переносим на боковую (сначала главное: мойка остаётся)
    { const [a,e]=run(0,"low"), p=plan[0], other=lay.walls.find(w=>w!==0);
      if(other!=null) while(p.req.length>1 && sum(p.pre)+sum(p.req)+sum(p.post)>e-a) plan[other].req.unshift(p.req.pop()); }
    [0].concat(lay.walls.filter(w=>w!==0)).forEach(wi=>{
      const [a,e]=run(wi,"low"), p=plan[wi], len=e-a;
      let rq=p.req.slice();
      // не помещается - убираем необязательное с конца
      while(rq.length>(wi===0?1:0) && sum(p.pre)+sum(rq)+sum(p.post)>len){ const x=rq.pop(); warns.push(`${WALL_NAMES[wi]}: не поместился модуль "${MODLIB[x.t].name}" - стены коротковаты.`); }
      while((p.pre.length||p.post.length) && sum(p.pre)+sum(rq)+sum(p.post)>len){ const x=(p.post.length?p.post:p.pre).pop(); warns.push(`${WALL_NAMES[wi]}: не поместился "${MODLIB[x.t].name}".`); }
      let rest=len-sum(p.pre)-sum(rq)-sum(p.post);
      if(rest<0 && rq.length){ rq[0].w=Math.max(300,rq[0].w+rest); rest=len-sum(p.pre)-sum(rq)-sum(p.post); if(rest<0) warns.push(`${WALL_NAMES[wi]}: слишком короткая для модулей - проверьте длину.`); }
      const extra=fillExact(Math.max(0,rest)).map((x,i)=>({t:x.fill?"l_fill":(wi!==0&&i===0&&x.w<=600?"l_dr3":"l_shelf"),w:x.w}));
      // у основной стены добор ставим со стороны угла / в конец, чтобы мойка осталась ближе к середине
      K.walls[wi].lower = wi===0 ? [...p.pre, ...(layout==="2L"||layout==="3" ? [...extra.filter(x=>x.t!=="l_fill").slice(0,Math.floor(extra.length/2)), ...rq, ...extra.filter(x=>x.t!=="l_fill").slice(Math.floor(extra.length/2)), ...extra.filter(x=>x.t==="l_fill")] : [...rq, ...extra]), ...p.post]
                                 : wi===1 ? [...extra, ...rq, ...p.post] : [...p.pre, ...rq, ...extra.reverse()];
      if(noUp) return;
      // верх: над духовкой - короткий шкаф под вытяжку, над мойкой - сушка, остальное - шкафы
      const [ua,ue]=run(wi,"up"); let s=a; const marks=[];
      K.walls[wi].lower.forEach(m=>{ const d=MODLIB[m.t]; if(d.tall||m.t==="l_gap") marks.push({a:s,e:s+m.w,k:"skip"}); else if(m.t==="l_oven") marks.push({a:s,e:s+m.w,k:"u_hood"}); else if(m.t==="l_sink"&&m.w>=600) marks.push({a:s,e:s+m.w,k:"u_dryer"}); s+=m.w; });
      const up=[]; let cur=ua;
      const seg=(to)=>{ if(to-cur>0.5) fillExact(to-cur).forEach(x=>up.push({t:x.fill?"u_fill":"u_shelf",w:x.w})); cur=Math.max(cur,to); };
      marks.sort((x,y)=>x.a-y.a).forEach(mk=>{
        if(mk.e<=cur+0.5 && mk.k!=="skip") return;
        if(mk.k==="skip"){ seg(Math.max(cur,mk.a)); if(m_gap(mk)) up.push({t:"u_gap",w:mk.e-Math.max(cur,mk.a)}); cur=Math.max(cur,mk.e); return; }
        if(mk.a<cur-0.5 || mk.e>ue+0.5) return;
        if(mk.a-cur>0.5 && mk.a-cur<300){ return; }
        seg(mk.a); up.push({t:mk.k,w:mk.e-mk.a}); cur=mk.e;
      });
      seg(ue);
      K.walls[wi].upper=up;
      function m_gap(mk){ const lw=K.walls[wi].lower; let q=a; for(const m of lw){ if(Math.abs(q-mk.a)<1) return m.t==="l_gap"; q+=m.w; } return false; }
    });
    const mods=[]; if(fridgeIn) mods.push("пенал под встроенный холодильник"); if(fridgeGap) mods.push("место под холодильник"); if(ovenTall) mods.push("пенал с духовкой и СВЧ"); else if(wantOven) mods.push("духовка");
    if(wantDish) mods.push("посудомойка "+dishW); if(bottle) mods.push("бутылочница"); mods.push("мойка");
    got.push("Техника и модули: "+mods.join(", ")+(noUp?"; без верхних шкафов":""));
    if(K.led) got.push("Подсветка под верхними шкафами");
    got.push("Модули расставлены автоматически - их можно поменять местами, заменить и подвинуть.");
    return {mode:"kitchen", got, warns, apply(S){ S.kit=K; S.view.kitchen="3d"; }};
  }
  // ---------- ШКАФ-КУПЕ ----------
  if(isKupe){
    const k=kupeDefaults(); let W=null,H=null,D=null; const free=[];
    ms.forEach(m=>{ const r=role(m,[[/антресол/,"ant"],[/ящик/,"dh"],[/высот|потол/,"h"],[/глубин/,"d"],[/ширин|длин/,"w"]]);
      if(r==="w") W=m.mm; else if(r==="h") H=m.mm; else if(r==="d") D=m.mm; else if(r==="ant") k.antH=clamp(m.mm,250,700); else if(r==="dh"){} else free.push(m.mm); });
    // числа без подписи: глубина - самая маленькая (до 900), дальше ширина и высота по порядку
    const small=free.filter(v=>v<=900), big=free.filter(v=>v>900);
    if(D==null && small.length) D=small[0];
    if(W==null && big.length) W=big.shift();
    if(H==null && big.length) H=big.shift();
    if(W!=null) k.W=clamp(W,800,6000); if(H!=null) k.H=clamp(H,1200,3000); if(D!=null) k.D=clamp(D,350,900);
    k.type = has(/встроен|в нишу|ниш[аеу]/) ? "built" : has(/к стене|одн[а-я]+ боковин|в угол/) ? "semi" : "korp"; k.back=k.type==="korp";
    const nd=vCount(t,"двер|створ"), ns=vCount(t,"секци");
    k.M=clamp(nd|| (k.W<=1800?2:k.W<=3000?3:k.W<=4200?4:5),2,6);
    k.N=clamp(ns|| Math.max(2,Math.round(k.W/800)),1,6);
    if(has(/без антресол/)) k.ant=false; else if(has(/антресол/)) k.ant=true; else k.ant=k.H>=2300;
    k.led=has(/подсветк/) && !has(/без подсветк/);
    if(has(/премиум/)) k.prof="prem"; else if(has(/эконом/)) k.prof="eco";
    // двери: зеркало / лакобель / ЛДСП
    const mir=has(/зеркал/), lac=has(/лакобел|стекл/), allMir=has(/все[а-я ]* зеркал|полностью зеркал|зеркальн[а-я]+ двер/) && !has(/одн[а-я]+ зеркал|зеркало в середине|по центру зеркал/);
    for(let i=0;i<6;i++){
      let seg="ldsp10";
      if(mir && lac) seg = i%2 ? "glass" : "mirror";
      else if(mir) seg = allMir ? "mirror" : (has(/зеркал[а-я]* (в середине|по центру|посередине)|по центру зеркал|средн[а-я]+ (двер[а-я]* )?зеркал/) ? (i===Math.floor((k.M-1)/2)||(k.M%2===0&&i===k.M/2)?"mirror":"ldsp10") : (k.M===2 ? (i===0?"mirror":"ldsp10") : (i%2===0?"mirror":"ldsp10")));
      else if(lac) seg = has(/все[а-я ]* (лакобел|стекл)/) ? "glass" : (i%2?"ldsp10":"glass");
      k.doors[i]={segs:[seg]};
    }
    // начинка: чередуем полки и штанги, ящики - в одну секцию
    const drawers=vCount(t,"ящик")|| (has(/ящик/)?3:0), rods=has(/без штанг/)?0:(vCount(t,"штанг")||Math.max(1,Math.round(k.N/2)));
    const tallH=k.H-(k.ant?k.antH:0);
    for(let i=0;i<6;i++){ const rod=i%2===1 && Math.floor(i/2)<rods || (k.N===1&&rods>0); k.secs[i]={shelves:rod?(tallH>2000?1:0):Math.max(3,Math.round(tallH/400)-1),rod,drawers:0,w:0}; }
    if(drawers){ const i=k.N>=3?k.N-1:0; const s=k.secs[i]; s.drawers=clamp(drawers,1,5); if(!s.rod) s.shelves=Math.max(2,s.shelves-Math.ceil(s.drawers*k.DH/350)); }
    got.push(`Шкаф-купе ${KUPE_TYPES[k.type]}: ширина ${mmTxt(k.W)}${W==null?" (не названа)":""}, высота ${mmTxt(k.H)}${H==null?" (не названа)":""}, глубина ${mmTxt(k.D)}${D==null?" (не названа)":""}`);
    got.push(`Дверей: ${k.M}${nd?"":" (подобрал по ширине)"}, секций: ${k.N}${ns?"":" (подобрал по ширине)"}`);
    got.push("Двери: "+k.doors.slice(0,k.M).map(d=>matName(d.segs[0])).join(" / "));
    got.push(`Начинка: штанг ${k.secs.slice(0,k.N).filter(s=>s.rod).length}${drawers?", ящиков "+clamp(drawers,1,5):""}${k.ant?", антресоль":""}${k.led?", подсветка":""}`);
    return {mode:"kupe", got, warns, apply(S){ S.kupe=k; S.view.kupe="in"; }};
  }
  // ---------- ЛЮБОЕ ИЗДЕЛИЕ ----------
  const tp = has(/комод/)?"dresser" : has(/стеллаж|полк[аи] открыт/)?"shelf" : has(/кроват/)?"bed" : has(/прихож/)?"hall" : has(/тумб/)?"tumba" : has(/стол(?!еш)/)?"table" : has(/шкаф|пенал/)?"cab" : null;
  if(!tp) return {mode:null, got:[], warns:["Не понял, что делаем. Начните со слова: кухня, шкаф-купе, шкаф распашной, тумба, комод, стеллаж, кровать, стол или прихожая."]};
  const pr=tplDefaults()[tp], free=[]; const set={};
  ms.forEach(m=>{ const r=role(m,[[/цокол/,"plinth"],[/высот/,"H"],[/глубин/,"D"],[/ширин|длин/,"W"]]); if(r) set[r]=m.mm; else free.push(m.mm); });
  if(tp==="bed"){ const v=free.concat(set.W||[],set.D||[]); if(v[0]) pr.MW=clamp(Math.min(v[0],v[1]||9e9),700,2200); if(v[1]) pr.ML=clamp(Math.max(v[0],v[1]),1500,2300); pr.lift=has(/подъемн/); if(has(/лдсп/)) pr.base="ldsp";
    got.push(`Кровать под матрас ${pr.MW}×${pr.ML} мм${pr.lift?", с подъёмным механизмом":""}`); }
  else{
    const order = tp==="table" ? ["W","D","H"] : ["W","H","D"];
    order.forEach(k2=>{ if(set[k2]==null && free.length) set[k2]=free.shift(); });
    ["W","H","D","plinth"].forEach(k2=>{ if(set[k2]!=null && k2 in pr) pr[k2]=set[k2]; });
    const nd=vCount(t,"двер|створ"), nb=vCount(t,"ящик"), nsh=vCount(t,"полк|полок"), nsec=vCount(t,"секци");
    if(nd!=null && "doors" in pr) pr.doors=clamp(nd,0,4); if(nb!=null && "drawers" in pr) pr.drawers=clamp(nb,0,8); if(nsh!=null && "shelves" in pr) pr.shelves=clamp(nsh,0,12); if(nsec!=null && "sections" in pr) pr.sections=clamp(nsec,1,6);
    if("doors" in pr && has(/без двер|открыт/)) pr.doors=0;
    if("fac" in pr){ if(has(/эмал/)) pr.fac="mdf_enamel"; else if(has(/пластик/)) pr.fac="mdf_plastic"; else if(has(/зеркал/)) pr.fac="mirror"; else if(has(/лдсп/)&&!has(/мдф/)) pr.fac="ldsp16"; }
    if(tp==="hall" && pr.cw>pr.W-300) pr.cw=Math.round(pr.W/2);
    got.push(`${TPL[tp].name}: ${pr.W}×${pr.H}×${pr.D} мм (ширина × высота × глубина)`);
    const ex=[]; if("doors" in pr) ex.push("дверей "+pr.doors); if(pr.drawers) ex.push("ящиков "+pr.drawers); if("shelves" in pr) ex.push("полок "+pr.shelves); if(ex.length) got.push(ex.join(", "));
  }
  return {mode:"univ", got, warns, apply(S){ S.u.tpl=tp; S.u.prms[tp]=pr; S.u.manual=false; S.u.built=false; S.view.univ="3d"; }};
}

// ---------- окно ----------
const VOICE_EX = [
  "Угловая кухня, основная стена 3 метра 60, вторая стена 1,8 метра, верхние шкафы 900, фасады эмаль, встроенный холодильник, посудомойка 45, подсветка",
  "Прямая кухня 2 метра 80, профиль Gola, столешница камень, духовка в пенале",
  "П-образная кухня, основная 3,2 метра, левая 2 метра, правая 2,4 метра, без ручек",
  "Шкаф-купе в нишу, ширина 2 метра 70, высота 2,6, глубина 60 см, три двери, зеркало по центру, 4 ящика, подсветка",
  "Комод ширина 1 метр, высота 90 см, глубина 45, пять ящиков",
  "Тумба под телевизор 1800 на 450 на 400, две двери"
];
const MIC_SVG=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;
let VO={dict:null, sr:null, on:false, unsub:[]};
function voiceStopAll(){ try{ if(VO.dict&&VO.dict.active()) VO.dict.stop(); }catch(e){} try{ if(VO.sr) VO.sr.stop(); }catch(e){} VO.unsub.forEach(f=>{ try{f();}catch(e){} }); VO.unsub=[]; VO.on=false; }
function openVoice(){
  openModal("Описать проект словами",`
    <p class="note" style="margin-top:0">Скажите или напишите, что нужно сделать: тип изделия, размеры, отделку, технику. Программа соберёт проект, а дальше его можно править как обычно.</p>
    <textarea id="voTxt" rows="4" placeholder="Например: угловая кухня, основная стена 3 метра 60, вторая 1,8 метра, верхние шкафы 900, фасады эмаль, встроенный холодильник"></textarea>
    <div class="btns" style="margin-top:8px"><button class="b1 hide" id="voMic">${MIC_SVG} Говорить</button><button class="b2" id="voClear">Очистить</button></div>
    <p class="note" id="voHint">На телефоне можно диктовать прямо в это поле: нажмите на него и выберите значок микрофона на клавиатуре.</p>
    <div class="info hide" id="voGot"></div>
    <div class="warns" id="voWarn" style="margin:8px 0 0"></div>
    <div class="btns"><button class="b1" id="voGo" disabled>Собрать проект</button></div>
    <details style="margin-top:10px" open><summary>Примеры фраз - нажмите, чтобы попробовать</summary><div class="cands" id="voEx" style="margin-top:6px">${VOICE_EX.map((e,i)=>`<button data-ex="${i}">${esc(e)}</button>`).join("")}</div></details>`,
  ()=>{
    const ta=$("voTxt"), go=$("voGo"); let res=null, base="";
    const upd=()=>{
      res=parseSpeech(ta.value);
      const g=$("voGot"), w=$("voWarn");
      g.classList.toggle("hide",!(res&&res.got.length)); go.disabled=!(res&&res.mode);
      if(res&&res.got.length) g.innerHTML="<b>Понял так:</b><ul style='margin:4px 0 0;padding-left:18px'>"+res.got.map(x=>`<li>${esc(x)}</li>`).join("")+"</ul>";
      if(res&&res.warns.length){ w.style.display="block"; w.innerHTML="<ul>"+res.warns.map(x=>`<li>${esc(x)}</li>`).join("")+"</ul>"; } else w.style.display="none";
    };
    ta.addEventListener("input",upd);
    $("voClear").onclick=()=>{ ta.value=""; base=""; upd(); ta.focus(); };
    $("voEx").addEventListener("click",e=>{ const b=e.target.closest("[data-ex]"); if(b){ ta.value=VOICE_EX[+b.dataset.ex]; upd(); } });
    go.onclick=()=>{ if(!res||!res.mode) return; voiceStopAll(); const keep={client:S.client,decor:S.decor}; res.apply(S); Object.assign(S,keep); SEL={part:-1,mod:null}; closeModal(); setMode(res.mode); window.scrollTo({top:0}); toast("Проект собран - проверьте и поправьте, что нужно"); };
    // микрофон: сначала встроенная диктовка Claude, иначе распознавание речи браузера (если страница открыта отдельным файлом)
    const mic=$("voMic"), setOn=on=>{ VO.on=on; mic.innerHTML=on?`${MIC_SVG} Слушаю... нажмите, чтобы остановить`:`${MIC_SVG} Говорить`; mic.classList.toggle("wa",on); };
    const SR=!window.claude && (window.SpeechRecognition||window.webkitSpeechRecognition);
    const showMic=()=>{ mic.classList.remove("hide"); $("voHint").textContent="Нажмите \"Говорить\" и опишите проект. Слова появятся в поле, их можно поправить руками."; };
    if(window.claude&&window.claude.use) Promise.resolve(window.claude.use("dictation")).then(d=>{ if(!d||!$("voMic")) return; VO.dict=d; showMic();
      VO.unsub.push(d.onFinal(({text})=>{ base=(ta.value&&VO.live!=null?VO.liveBase:ta.value); base=(base+text).replace(/^\s+/,""); ta.value=base; VO.live=null; upd(); }));
      VO.unsub.push(d.onPartial(({text})=>{ if(VO.live==null){ VO.liveBase=ta.value; } VO.live=text; ta.value=(VO.liveBase+(text?" "+text:"")).replace(/^\s+/,""); if(!text) VO.live=null; upd(); }));
      VO.unsub.push(d.onState(({state,reason})=>{ setOn(state==="listening"||state==="starting"); if(state==="idle"&&reason&&["not_granted","unavailable"].includes(reason)){ mic.classList.add("hide"); $("voHint").textContent="Микрофон здесь недоступен - напишите текст или продиктуйте через клавиатуру телефона."; } }));
    }).catch(()=>{});
    else if(SR) showMic();
    mic.onclick=()=>{
      if(VO.dict){ if(VO.on) VO.dict.stop().catch(()=>{}); else VO.dict.start({language:"ru"}).catch(e=>{ if(e&&e.code==="unavailable") VO.dict.start().catch(()=>{}); else if(e&&e.code!=="stopped"&&e.code!=="dismissed") toast("Микрофон не включился - можно написать текстом"); }); return; }
      if(!SR) return;
      if(VO.on){ VO.sr.stop(); return; }
      const r=new SR(); VO.sr=r; r.lang="ru-RU"; r.interimResults=true; r.continuous=true; const start=ta.value?ta.value+" ":"";
      r.onresult=ev=>{ let s=""; for(let i=0;i<ev.results.length;i++) s+=ev.results[i][0].transcript; ta.value=start+s; upd(); };
      r.onend=()=>setOn(false); r.onerror=()=>{ setOn(false); toast("Микрофон не включился - можно написать текстом"); };
      try{ r.start(); setOn(true); }catch(e){ toast("Микрофон не включился"); }
    };
    $("modalX").addEventListener("click",voiceStopAll);
    ta.focus(); upd();
  },{wide:true});
}
