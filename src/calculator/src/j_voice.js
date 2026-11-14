// ================= ОПИСАНИЕ СЛОВАМИ (голосом или текстом) -> ВЫЖИМКА -> ПРОЕКТ =================
// Разбор работает прямо в браузере, без интернета и без ключей.
// Порядок: vNorm (числа словами, поправки "нет, вернее") -> vOrder (клиент, скидка, срок, цвет)
// -> vMeasures (размеры) -> разбор по типу изделия -> выжимка (rows + asks) -> apply(S).
const NUM_W = {ноль:0,один:1,одна:1,одну:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,
  шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,
  сто:100,двести:200,триста:300,четыреста:400,пятьсот:500,шестьсот:600,семьсот:700,восемьсот:800,девятьсот:900};
function vNorm(text){
  let t=" "+String(text).toLowerCase().replace(/ё/g,"е").replace(/[–—]/g,"-").replace(/[«»"“”]/g," ").replace(/(\d)\s*[xх×*]\s*(?=\d)/g,"$1 на ")+" ";
  t=t.replace(/полтора|полторы/g,"1.5").replace(/пол\s?метра/g,"0.5 метра").replace(/(\d+|[а-я]+)\s+с половиной/g,(m,a)=>{ const n=/^\d+$/.test(a)?+a:NUM_W[a]; return n==null?m:String(n+0.5); });
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
  t=out.join("").replace(/(\d),(\d)/g,"$1.$2").replace(/\s+/g," ");
  // "метр двадцать" -> "1 метр 20", "ширина метр" -> "1 метр"
  t=t.replace(/(^|[^\d.\s]\s|[,;:]\s?)(метр[а-я]*)(?=[\s,.;]|$)/g,"$1 1 $2");
  // поправки: "3 метра, нет, 3.5" / "3 метра, вернее 3.5" -> остаётся последнее
  const MS="\\d+(?:\\.\\d+)?(?:\\s*(?:мм|миллиметр[а-я]*|см|сантиметр[а-я]*|метр[а-я]*|м(?![а-я])))?(?:\\s+\\d{1,2}(?![\\d.])(?:\\s*(?:см|сантиметр[а-я]*))?)?";
  t=t.replace(new RegExp("("+MS+")\\s*[,.]?\\s*(?:нет|ой|вернее|точнее|то есть|поправка|исправляю|извините)\\s*[,.]?\\s*(?=\\d)","g"),"");
  // "не 3 метра, а 3.5" -> "3.5"; "не прямая, а угловая" -> "угловая"
  t=t.replace(new RegExp("(^|[\\s,])не\\s+"+MS+"(?:\\s*,\\s*|\\s+)а\\s+(?=\\d)","g"),"$1");
  t=t.replace(/(^|[\s,])не\s+[а-я-]+(?:\s*,\s*|\s+)а\s+(?=[а-я])/g,"$1");
  // отрицания: "посудомойка не нужна", "нет посудомойки", "не надо подсветку" -> "без ..."
  t=t.replace(/([а-я]+)\s+(?:не\s+(?:нужн[а-я]*|надо|будет|ставим|ставить)|нет)(?=[\s,.;]|$)/g," без $1");
  t=t.replace(/(^|[\s,])(?:не\s+(?:нужн[а-я]*|надо|ставим|ставить)|нет)\s+(?=[а-я])/g,"$1без ");
  return t.replace(/\s+/g," ");
}
function vCount(t,rx){ const m=t.match(new RegExp("(\\d+)\\s*(?:-?х\\s*)?(?:"+rx+")")); return m?+m[1]:null; }
const VCOLORS="бел|сер|черн|беж|графит|антрацит|дуб|орех|венге|ясен|кашемир|капучино|зелен|оливк|син|голуб|красн|бордо|молочн|слонов|мрамор|бетон|глян|матов|сонома|крафт|лофт|вишн|бук|клен|сосн|шампань|золот|хром|латун|бронз|изумруд|песочн|кремов|ваниль|терракот|мокко|шоколад|тауп|графитов";
// клиент, телефон, скидка, предоплата, срок, цвет. Найденное вырезается из текста, чтобы не мешать размерам.
function vOrder(t){
  const o={}; let s=t;
  const cut=(rx,fn)=>{ s=s.replace(rx,(...a)=>{ fn(a); return " ".repeat(a[0].length); }); };
  const cap=x=>x.trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  cut(/(?:телефон|номер|тел\.?)\s*:?\s*(\+?\d[\d\s()-]{5,}\d)/g, a=>{ o.phone=a[1].replace(/\s+/g," ").trim(); });
  cut(/(?:клиент(?:ка)?|заказчи(?:к|ца)|для клиента)\s*:?\s*(?!кухн|шкаф|изделие)([а-я-]+(?:\s+(?!телефон|номер|кухн|шкаф|угл|прям|скидк|предоп|срок|цвет|фасад|корпус)[а-я-]+){0,2})/g, a=>{ o.client=cap(a[1]); });
  cut(/скидк[а-я]*\s*(?:в\s+|на\s+)?(\d+(?:\.\d+)?)\s*(?:%|процент[а-я]*)?/g, a=>{ o.disc=clamp(+a[1],0,90); });
  cut(/(?:предоплат|аванс)[а-я]*\s*(?:в\s+)?(\d+)\s*(?:%|процент[а-я]*)?/g, a=>{ o.prepay=clamp(+a[1],0,100); });
  cut(/(?:срок[а-я]*(?:\s+изготовлени[а-я]*)?|сделать за|изготовить за|изготовление за)\s*(?:за\s+)?(\d+)\s*(?:рабоч[а-я]*\s+)?(дн|день|недел)[а-я]*/g, a=>{ o.days=clamp(/недел/.test(a[2])?+a[1]*5:+a[1],1,365); });
  cut(/(\d+)\s*(?:%|процент[а-я]*)/g, ()=>{});         // прочие проценты не размеры
  const dec=[];
  cut(/(?:цвет|декор)[а-я]*\s*(фасадов|корпуса|столешницы)?\s*:?\s*([а-я-]+(?:\s+(?!и\s|фасад|корпус|столешниц|ручк|встро|посудо|духов|холодил|подсвет)[а-я-]+){0,2})/g, a=>{ dec.push((a[1]?a[1]+" ":"")+a[2].trim()); });
  s.replace(new RegExp("(фасад[а-я]*|корпус[а-я]*|столешниц[а-я]*)\\s+(?:[а-я]+\\s+)??((?:(?:"+VCOLORS+")[а-я-]*\\s*){1,3})","g"),(m,a,b)=>{ dec.push(a.replace(/^фасад.*/,"фасады").replace(/^корпус.*/,"корпус").replace(/^столешниц.*/,"столешница")+" "+b.trim()); return m; });
  s.replace(new RegExp("((?:(?:"+VCOLORS+")[а-я-]*\\s+){1,2})(фасад[а-я]*|корпус[а-я]*)","g"),(m,b,a)=>{ dec.push(a.replace(/^фасад.*/,"фасады").replace(/^корпус.*/,"корпус")+" "+b.trim()); return m; });
  if(dec.length) o.decor=[...new Set(dec)].join(", ");
  return {o, s};
}
// все размеры из текста: [{mm, ctx - слова перед числом, pos}]
function vMeasures(t){
  // убрать количества ("3 двери", "2 секции"), чтобы не принять их за размеры
  let s=t.replace(/(\d+)\s*(?:-?х\s*)?(двер|створ|секци|ящик|полк|полок|стен|штанг|модул|шт|пенал|ручк|человек|конфор|раз)/g,(m,a,b)=>" ".repeat(a.length)+" "+b);
  const rx=/(\d+(?:\.\d+)?)\s*(мм|миллиметр[а-я]*|см|сантиметр[а-я]*|метр[а-я]*|м(?![а-я]))?(?:\s*(?:и\s+)?(\d{1,2})(?![\d.])\s*(см|сантиметр[а-я]*)?(?!\s*(?:мм|м(?![а-я])|метр)))?/g;
  const res=[]; let m, prevEnd=0;
  while((m=rx.exec(s))){
    let v=+m[1], u=m[2]||"", mm;
    const second = m[3]!=null && ((/^м/.test(u)&&!/^мм|^милли/.test(u)) || (!u && v<10 && +m[3]>=10)) ? +m[3] : null;
    if(/^мм|^милли/.test(u)) mm=v; else if(/^см|^санти/.test(u)) mm=v*10; else if(/^м/.test(u)) mm=v*1000;
    else mm = (v<=20) ? v*1000 : v<400 ? v*10 : v;
    let end=m.index+m[0].length;
    if(second!=null) mm+=second*10; else if(m[3]!=null){ end=m.index+m[1].length+(m[2]?m[0].indexOf(m[2])-m[1].length+m[2].length:0); rx.lastIndex=end; }
    res.push({mm:Math.round(mm), ctx:s.slice(prevEnd,m.index).slice(-60), after:s.slice(end,end+30), pos:m.index, unit:!!u, raw:v, second});
    prevEnd=end;
  }
  return res;
}
const mmTxt = v => fmt(v)+" мм";
// размер для параметра с известным разумным диапазоном: "цоколь 120" - это 120 мм, а не 120 см
function vFit(m,lo,hi){
  if(m.mm>=lo&&m.mm<=hi) return m.mm;
  if(!m.unit && m.second==null) for(const k of [1,10,1000]){ const v=m.raw*k; if(v>=lo&&v<=hi) return Math.round(v); }
  return clamp(m.mm,lo,hi);
}
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
// выжимка: строки по группам (src: said - услышал, def - по умолчанию, auto - подобрал сам) и вопросы "уточните"
function vSum(){
  const rows=[], asks=[];
  return {rows, asks,
    add(g,label,val,src){ rows.push({g,label,val:String(val),src:src||"said"}); },
    ask(label,say,ins){ asks.push({label,say,ins}); }};
}
const SRC_TXT = {def:"по умолчанию", auto:"подобрал сам"};
function vFinish(mode,R,warns,apply,order){
  if(order){ const o=order;
    if(o.client||o.phone) R.add("Заказ","Клиент",[o.client,o.phone].filter(Boolean).join(", "));
    if(o.decor) R.add("Заказ","Цвет и декор",o.decor);
    if(o.disc!=null) R.add("Заказ","Скидка",o.disc+"%");
    if(o.prepay!=null) R.add("Заказ","Предоплата",o.prepay+"%");
    if(o.days!=null) R.add("Заказ","Срок",o.days+" раб. дней");
  }
  const got=R.rows.map(r=>r.label+": "+r.val+(SRC_TXT[r.src]?" ("+SRC_TXT[r.src]+")":""));
  const wrap = apply ? (S=>{ apply(S); if(order){ const o=order;
      if(o.client||o.phone) S.client=[o.client,o.phone].filter(Boolean).join(", ");
      if(o.decor) S.decor=o.decor; if(o.disc!=null) S.disc=o.disc; if(o.prepay!=null) S.prepay=o.prepay; if(o.days!=null) S.days=o.days; } }) : null;
  return {mode, rows:R.rows, asks:R.asks, got, warns, apply:wrap, order};
}
// текст выжимки - чтобы скопировать в WhatsApp или в заметки
function sumText(res){
  if(!res||!res.rows.length) return "";
  const out=[]; let g=null;
  res.rows.forEach(r=>{ if(r.g!==g){ g=r.g; out.push((out.length?"\n":"")+g+":"); } out.push("- "+r.label+": "+r.val+(SRC_TXT[r.src]?" ("+SRC_TXT[r.src]+")":"")); });
  if(res.asks.length) out.push("\nУточнить: "+res.asks.map(a=>a.label.toLowerCase()).join(", "));
  return out.join("\n");
}

function parseSpeech(text){
  const t0=vNorm(text);
  if(t0.replace(/[\s,.;]/g,"").length<3) return null;
  const {o:order, s:t}=vOrder(t0);
  const has=rx=>rx.test(t0), warns=[], R=vSum();
  const ms=vMeasures(t);
  const role=(m,map)=>{ for(const [rx,k] of map) if(rx.test(m.ctx)) return k; return null; };
  const isKitchen=has(/кухн|кухон/);
  const isKupe=!isKitchen && (has(/купе|гардероб/) || (has(/шкаф(?!чик)/) && !has(/распашн|прихож|пенал|тумб|комод|стеллаж|навесн/)));
  if(isKitchen && has(/купе|гардероб|комод|кроват|прихож|стеллаж/)) warns.push("Похоже, описано несколько изделий. Собираю кухню, остальное опишите отдельно.");
  if(isKupe && has(/комод|кроват|прихож|стеллаж|тумб/)) warns.push("Похоже, описано несколько изделий. Собираю шкаф-купе, остальное опишите отдельно.");

  // ---------- КУХНЯ ----------
  if(isKitchen){
    const K=kitDefaults(), G1="Изделие", G2="Размеры", G3="Отделка", G4="Техника и модули";
    const sLayout = has(/п-?\s?образн|буквой п|три стены|3 стен/) ? "3" : has(/углов|г-?\s?образн|буквой г|две стены|2 стен/) ? "2R" : has(/прям|линейн|одна стена|1 стен|вдоль одной/) ? "1" : null;
    let layout=sLayout;
    // отделка (до размеров: от толщины столешницы зависит высота)
    const facS = has(/эмал|крашен/) ? "mdf_enamel" : has(/пластик|акрилов[а-я]* фасад|фасад[а-я]* акрил/) ? "mdf_plastic" : has(/фасад[а-я]* (из )?лдсп|лдсп[а-я]* фасад/) ? "ldsp16f" : has(/мдф|пленк/) ? "mdf" : null;
    if(facS) K.fac=facS;
    if(has(/шпон|массив|рамочн|стеклянн[а-я]* фасад/)) warns.push("Фасадов из шпона, массива и рамочных в прайсе пока нет - поставил "+matName(K.fac)+". Добавьте свой материал во вкладке \"Прайс\".");
    const topS = has(/столешниц[а-я ]*(камен|кварц|акрил)|(камен|кварц|акрил)[а-я ]*столешниц|искусствен[а-я]* камен/) ? "top_stone" : has(/компакт/) ? "top_compact" : has(/столешниц[а-я ]*(лдсп|пластик|38|обычн)/) ? "top38" : null;
    if(topS) K.top=topS;
    if(!topS && has(/камен|кварц/)) K.top="top_stone";
    const hndS = has(/гола|gola|профил[а-я]* ручк|ручк[а-я]*-?профил|интегрирован/) ? "gola" : has(/без ручек|push|пуш|тип-?он|от нажати|толкател/) ? "push" : has(/ручк|скоб|рейлинг|кноп/) ? "std" : null;
    if(hndS) K.handles=hndS;
    // размеры
    const lens={}, free=[]; let Hu=null, Htot=null, ceil=null, Hl=null, PL=null, TD=null, Du=null, sinkW=null, apS=false;
    ms.forEach(m=>{
      const r=role(m,[[/цокол/,"pl"],[/высот[а-я]* (верх|навес)|верхн[а-я]* (шкаф|ряд|модул)[а-я]*( высот[а-я]*)?\s*$|верх(ние|а)? (высотой )?$/,"hu"],
        [/высот[а-я]* (нижн|столешниц|рабоч)|нижн[а-я]* (шкаф|модул|ряд)[а-я]*( высот[а-я]*)?\s*$|столешниц[а-я]* на высот[а-я]*\s*$/,"hl"],
        [/потол/,"ceil"],[/высот/,"h"],[/глубин[а-я]* (верх|навес)|верхн[а-я]* (шкаф|модул)[а-я]* глубин/,"du"],[/глубин/,"d"],[/фартук|стенов/,"ap"],[/(^|[^а-я])мойк/,"sink"],
        [/посудомо|духов|холодильн|плит|варочн|свч|микроволн|окн|двер/,"skip"],
        [/основн|главн|длинн|больш|перв|длин[а-я]* кухн/,"main"],[/лев|трет/,"left"],[/втор|меньш|коротк|боков|прав|друг/,"side"]]);
      if(r==="hu") Hu=vFit(m,250,1300); else if(r==="hl") Hl=vFit(m,500,1100); else if(r==="ceil") ceil=vFit(m,1800,4000); else if(r==="h") Htot=m.mm;
      else if(r==="pl") PL=vFit(m,0,250); else if(r==="d") TD=vFit(m,400,900); else if(r==="du") Du=vFit(m,200,450); else if(r==="sink") sinkW=vFit(m,400,1000);
      else if(r==="ap"){ K.apronH=vFit(m,300,900); apS=true; }
      else if(r==="skip"){}
      else if(r) lens[r]=m.mm; else if(m.mm>=900) free.push(m.mm);
    });
    ["main","side","left"].forEach(k=>{ if(lens[k]==null && free.length) lens[k]=free.shift(); });
    if(!layout) layout = lens.left ? "3" : lens.side ? "2R" : "1";
    if(layout==="2R" && has(/(стен[а-я]*|угол|сторон[а-я]*) слева|лев[а-я]+ (стен|сторон)|слева (втор|коротк|меньш)|угол лев/)){ layout="2L"; if(lens.left==null){ lens.left=lens.side; delete lens.side; } }
    if(layout==="2L" && lens.left==null && lens.side!=null){ lens.left=lens.side; }
    if(layout==="3" && lens.left==null && lens.side!=null) lens.left=lens.side;
    K.layout=layout;
    const L0=clamp(lens.main||3000,1200,8000), L1=clamp(lens.side||2000,900,8000), L2=clamp(lens.left||L1,900,8000);
    [["main",L0],["side",L1],["left",L2]].forEach(([k,v])=>{ if(lens[k]!=null && lens[k]!==v) warns.push(`Длина ${fmt(lens[k])} мм вне разумных пределов - поставил ${fmt(v)} мм. Проверьте, правильно ли расслышано.`); });
    const LN={"1":"прямая","2R":"угловая, вторая стена справа","2L":"угловая, вторая стена слева","3":"П-образная"};
    R.add(G1,"Кухня",LN[layout], sLayout?"said":"auto");
    R.add(G2,"Основная стена",mmTxt(L0), lens.main?"said":"def");
    if(!lens.main) R.ask("Длина основной стены","основная стена 3 метра 20","основная стена ");
    if(layout==="2R"||layout==="3"){ R.add(G2,"Правая стена",mmTxt(L1), lens.side?"said":"def"); if(!lens.side) R.ask(layout==="3"?"Длина правой стены":"Длина второй стены","вторая стена 1 метр 80",layout==="3"?"правая стена ":"вторая стена "); }
    if(layout==="2L"||layout==="3"){ R.add(G2,"Левая стена",mmTxt(L2), lens.left?"said":"def"); if(!lens.left) R.ask(layout==="3"?"Длина левой стены":"Длина второй стены","левая стена 2 метра","левая стена "); }
    if(PL!=null){ K.PL=clamp(PL,0,200); R.add(G2,"Цоколь",mmTxt(K.PL)); }
    const topT=MAT(K.top).t;
    if(Hl!=null){ const v = Hl>=750 ? Hl-K.PL-topT : Hl; K.Hl=clamp(Math.round(v/10)*10,500,950); R.add(G2,"Нижние шкафы",mmTxt(K.Hl)+(Hl>=750?` (столешница на ${fmt(Hl)} мм от пола)`:"")); }
    if(TD!=null){ K.TD=clamp(TD,400,900); K.Dl=clamp(K.TD-40,300,700); R.add(G2,"Глубина столешницы",mmTxt(K.TD)); }
    if(Du!=null){ K.Du=clamp(Du,200,450); R.add(G2,"Глубина верхних",mmTxt(K.Du)); }
    // высота: верхние шкафы, вся кухня от пола или потолок
    const below=K.PL+K.Hl+topT+K.apronH;
    if(Hu==null && Htot!=null){ if(Htot<=1200) Hu=Htot; else { Hu=Htot-below; R.add(G2,"Высота кухни от пола",mmTxt(Htot)); } }
    let HuSrc="said";
    if(Hu==null && ceil!=null){
      const avail=ceil-below; R.add(G2,"Потолок",mmTxt(ceil));
      if(has(/до потол/)) Hu=avail; else if(avail>1000){ Hu=900; HuSrc="auto"; warns.push(`До потолка над верхними шкафами останется ${fmt(ceil-below-900)} мм. Если нужны шкафы до потолка - скажите "верхние до потолка".`); } else Hu=avail;
    }
    if(Hu!=null){ const r=Math.round(Hu/10)*10; K.Hu=clamp(r,300,1200); R.add(G2,"Верхние шкафы",mmTxt(K.Hu),HuSrc); if(K.Hu!==r) warns.push("Высота верхних шкафов вышла за разумные пределы - поставил "+K.Hu+" мм."); }
    else { R.add(G2,"Верхние шкафы",mmTxt(K.Hu),"def"); R.ask("Высота потолка или верхних шкафов","потолок 2 метра 70 / верхние шкафы 900","потолок "); }
    K.Ht=K.Hl+topT+K.apronH+K.Hu;
    // отделка в выжимку
    R.add(G3,"Фасады",matName(K.fac), facS?"said":"def"); if(!facS) R.ask("Фасады","фасады эмаль / пластик / плёнка / ЛДСП","фасады ");
    R.add(G3,"Корпус",matName(K.body),"def");
    R.add(G3,"Столешница",matName(K.top), topS||K.top!=="top38"?"said":"def"); if(!topS && K.top==="top38") R.ask("Столешница","столешница камень / ЛДСП / компакт","столешница ");
    R.add(G3,"Ручки",HANDLES[K.handles], hndS?"said":"def");
    K.led=has(/подсветк/) && !has(/без подсветк/); K.apron=!has(/без фартук|без стенов/);
    R.add(G3,"Фартук", K.apron?"стеновая панель, высота "+mmTxt(K.apronH):"нет", has(/фартук|стенов/)||apS?"said":"def");
    if(K.led) R.add(G3,"Подсветка","под верхними шкафами");
    // техника
    const noUp=has(/без верхн|без навесн|только низ|только нижн/);
    const dishSaid=has(/посудомо|пмм/), wantDish=dishSaid && !has(/без посудомо|без пмм/), dishW=has(/посудомо[а-я ]*(45|450|узк)|узк[а-я]* посудомо/)?450:600;
    const ovenTall=has(/духов[а-я ]*(в |на )?(пенал|колонн|уровне)|пенал[а-я ]*(с |под )?духов|свч|микроволн/);
    const plate=has(/газов[а-я]* плит|плит[а-я]* (отдельн|свобод|стоит)|отдельностоящ[а-я]* плит|электроплит|своя плита/) && !has(/без плит/);
    const wantOven=!has(/без духов/) && !plate;
    const fridgeIn=has(/встроен[а-я]* холодильн|холодильник[а-я ]* встро|пенал[а-я ]*(под )?холодильн/) && !has(/без холодильн/);
    const fridgeSaid=has(/холодильн/);
    const fridgeGap=!fridgeIn && fridgeSaid && !has(/без холодильн|холодильник (стоит )?(отдельно )?в другом|холодильник[а-я ]*не в кухн/);
    const bottle=has(/бутылочн|карго/) && !has(/без бутылочн/);
    const lifts=has(/подъемн|подъемник|лифт|авентос|aventos/) && !has(/без подъемн/);
    const openSh=has(/открыт[а-я]* полк/);
    const nDr=clamp(vCount(t0,"(?:модул[а-я]*|тумб[а-я]*|блок[а-я]*|шкаф[а-я]*)\\s*(?:с\\s*)?ящик")|| (has(/много ящиков|ящик[а-я]* побольше|побольше ящик/)?2:1),1,4);
    const talls=[]; if(fridgeIn) talls.push("t_fridge"); if(ovenTall) talls.push("t_oven"); if(has(/пенал/) && !has(/без пенал/) && !talls.length) talls.push("t_shelf");
    if(has(/остров/)) warns.push("Остров пока не собирается автоматически - добавьте его в \"Любое изделие\" или модулями вручную.");
    if(has(/окн/)) warns.push("Окно не учтено: над ним поставьте модуль \"Пусто (окно, вытяжка)\" в верхнем ряду.");
    const c=kitCtx(K), lay=LAYOUTS[layout];
    K.walls=[{len:L0,lower:[],upper:[]},{len:L1,lower:[],upper:[]},{len:L2,lower:[],upper:[]}];
    const cz={}; lay.corners.forEach(s=>cz[s]={low:cornerSize(K.corners[s].low,c,false),up:cornerSize(K.corners[s].up,c,true)});
    const run=(wi,k)=> wi===0 ? [lay.corners.includes("L")?cz.L[k].A:0, L0-(lay.corners.includes("R")?cz.R[k].A:0)] : wi===1 ? [cz.R[k].B,L1] : [0,L2-cz.L[k].B];
    // пеналы и проём под холодильник - на свободный конец: у угловой - конец боковой стены, у прямой - левый край
    const endWall = layout==="1"?0 : layout==="2L"?2 : 1;
    const plan={0:{pre:[],req:[],post:[]},1:{pre:[],req:[],post:[]},2:{pre:[],req:[],post:[]}};
    const endKey = endWall===1 ? "post" : "pre", sum=l=>l.reduce((s,m)=>s+m.w,0);
    talls.forEach(tm=>plan[endWall][endKey].push({t:tm,w:600}));
    if(fridgeGap) plan[endWall][endKey][endKey==="post"?"push":"unshift"]({t:"l_gap",w:600});
    // на боковой стене не хватает места для всех пеналов - лишние на свободный край основной стены
    if(endWall!==0){ const [a,e]=run(endWall,"low"), p=plan[endWall][endKey], to=plan[0][endWall===1?"pre":"post"];
      while(p.length>1 && sum(p)>e-a-300){ const x=endKey==="post"?p.shift():p.pop(); to.push(x); } }
    // обязательное на основной стене: мойка, посудомойка, ящики, духовка (или проём под плиту)
    const plates=new Set(), req=plan[0].req;
    const sinkMod={t:"l_sink",w:sinkW?clamp(Math.round(sinkW/50)*50,400,1000):(L0>=2400?800:600)};
    req.push(sinkMod);
    if(wantDish) req.push({t:"l_dish",w:dishW});
    req.push({t:"l_dr3",w:L0>=3000?600:400});
    if(plate){ const g={t:"l_gap",w:600}; plates.add(g); req.push(g); }
    else if(wantOven && !ovenTall) req.push({t:"l_oven",w:600});
    if(bottle) req.push({t:"l_bottle",w:200});
    for(let i=1;i<nDr;i++) req.push({t:i%2?"l_dr2":"l_dr3",w:i%2?800:600});
    // что не влезло на основную стену - переносим на боковую (мойка остаётся)
    { const [a,e]=run(0,"low"), p=plan[0], other=lay.walls.find(w=>w!==0);
      if(other!=null) while(p.req.length>1 && sum(p.pre)+sum(p.req)+sum(p.post)>e-a) plan[other].req.unshift(p.req.pop()); }
    [0].concat(lay.walls.filter(w=>w!==0)).forEach(wi=>{
      const [a,e]=run(wi,"low"), p=plan[wi], len=e-a;
      let rq=p.req.slice();
      while(rq.length>(wi===0?1:0) && sum(p.pre)+sum(rq)+sum(p.post)>len){ const x=rq.pop(); warns.push(`${WALL_NAMES[wi]}: не поместился модуль "${MODLIB[x.t].name}" - стены коротковаты.`); }
      while((p.pre.length||p.post.length) && sum(p.pre)+sum(rq)+sum(p.post)>len){ const x=(p.post.length?p.post:p.pre).pop(); warns.push(`${WALL_NAMES[wi]}: не поместился "${MODLIB[x.t].name}".`); }
      let rest=len-sum(p.pre)-sum(rq)-sum(p.post);
      if(rest<0 && rq.length){ rq[0].w=Math.max(300,rq[0].w+rest); rest=len-sum(p.pre)-sum(rq)-sum(p.post); if(rest<0) warns.push(`${WALL_NAMES[wi]}: слишком короткая для модулей - проверьте длину.`); }
      const extra=fillExact(Math.max(0,rest)).map((x,i)=>({t:x.fill?"l_fill":(wi!==0&&i===0&&x.w<=600?"l_dr3":"l_shelf"),w:x.w}));
      // у основной стены добор ставим со стороны угла / в конец, чтобы мойка осталась ближе к середине
      K.walls[wi].lower = wi===0 ? [...p.pre, ...(layout==="2L"||layout==="3" ? [...extra.filter(x=>x.t!=="l_fill").slice(0,Math.floor(extra.length/2)), ...rq, ...extra.filter(x=>x.t!=="l_fill").slice(Math.floor(extra.length/2)), ...extra.filter(x=>x.t==="l_fill")] : [...rq, ...extra]), ...p.post]
                                 : wi===1 ? [...extra, ...rq, ...p.post] : [...p.pre, ...rq, ...extra.reverse()];
      if(noUp) return;
      // верх: над духовкой и плитой - короткий шкаф под вытяжку, над мойкой - сушка, остальное - шкафы
      const [ua,ue]=run(wi,"up"); let s=a; const marks=[];
      K.walls[wi].lower.forEach(m=>{ const d=MODLIB[m.t];
        if(plates.has(m)||m.t==="l_oven") marks.push({a:s,e:s+m.w,k:"u_hood"});
        else if(d.tall||m.t==="l_gap") marks.push({a:s,e:s+m.w,k:"skip",gap:m.t==="l_gap"});
        else if(m.t==="l_sink"&&m.w>=600) marks.push({a:s,e:s+m.w,k:"u_dryer"});
        s+=m.w; });
      const up=[]; let cur=ua;
      const seg=(to)=>{ if(to-cur>0.5) fillExact(to-cur).forEach(x=>up.push({t:x.fill?"u_fill":(lifts&&x.w>=500?"u_lift":"u_shelf"),w:x.w})); cur=Math.max(cur,to); };
      marks.sort((x,y)=>x.a-y.a).forEach(mk=>{
        if(mk.e<=cur+0.5 && mk.k!=="skip") return;
        if(mk.k==="skip"){ seg(Math.max(cur,mk.a)); if(mk.gap) up.push({t:"u_gap",w:mk.e-Math.max(cur,mk.a)}); cur=Math.max(cur,mk.e); return; }
        if(mk.a<cur-0.5 || mk.e>ue+0.5) return;
        if(mk.a-cur>0.5 && mk.a-cur<300){ return; }
        seg(mk.a); up.push({t:mk.k,w:mk.e-mk.a}); cur=mk.e;
      });
      seg(ue);
      K.walls[wi].upper=up;
    });
    if(openSh && !noUp){ const u=K.walls[0].upper; for(let i=u.length-1;i>=0;i--) if(u[i].t==="u_shelf"||u[i].t==="u_lift"){ u[i]={t:"u_open",w:u[i].w}; break; } }
    // техника и модули в выжимку
    R.add(G4,"Мойка","шкаф под мойку "+sinkMod.w+" мм", sinkW?"said":"auto");
    R.add(G4,"Варка", plate?"плита отдельно (проём 600 мм)":ovenTall?"варочная панель, духовка и СВЧ в пенале":wantOven?"варочная панель, духовка под ней":"варочная панель без духовки",
      has(/духов|плит|варочн|свч|микроволн/)?"said":"def");
    R.add(G4,"Посудомойка", wantDish?"встроенная "+dishW+" мм":"нет", dishSaid?"said":"def");
    if(!dishSaid) R.ask("Посудомойка","посудомойка 60 / посудомойка 45 / без посудомойки","посудомойка ");
    R.add(G4,"Холодильник", fridgeIn?"встроенный, в пенале":fridgeGap?"отдельно стоящий, оставлено место 600 мм":"нет", fridgeSaid?"said":"def");
    if(!fridgeSaid) R.ask("Холодильник","встроенный холодильник / холодильник отдельно / без холодильника","холодильник ");
    R.add(G4,"Ящики", nDr===1?"1 модуль с ящиками":nDr+" модуля с ящиками", has(/ящик/)?"said":"auto");
    if(bottle) R.add(G4,"Бутылочница","200 мм");
    if(talls.includes("t_shelf")) R.add(G4,"Пенал","с полками");
    R.add(G4,"Верхний ряд", noUp?"нет":lifts?"с подъёмными механизмами":"с дверцами"+(openSh?", одна открытая полка":""), noUp||lifts||openSh?"said":"def");
    R.add(G4,"Расстановка","автоматически - модули можно двигать, менять и заменять","auto");
    return vFinish("kitchen",R,warns,S=>{ S.kit=K; S.view.kitchen="3d"; },order);
  }

  // ---------- ШКАФ-КУПЕ ----------
  if(isKupe){
    const k=kupeDefaults(), G1="Изделие", G2="Размеры", G3="Двери", G4="Начинка"; let W=null,H=null,D=null; const free=[];
    ms.forEach(m=>{ const r=role(m,[[/антресол/,"ant"],[/ящик/,"dh"],[/цокол/,"pl"],[/высот|потол/,"h"],[/глубин/,"d"],[/ширин|длин/,"w"]]);
      if(r==="w") W=m.mm; else if(r==="h") H=vFit(m,1200,3200); else if(r==="d") D=vFit(m,300,1000); else if(r==="ant") k.antH=vFit(m,250,700); else if(r==="dh"||r==="pl"){} else free.push(m.mm); });
    // числа без подписи: глубина - самая маленькая (до 900), дальше ширина и высота по порядку
    const small=free.filter(v=>v<=900), big=free.filter(v=>v>900);
    if(D==null && small.length) D=small[0];
    if(W==null && big.length) W=big.shift();
    if(H==null && big.length) H=big.shift();
    if(W!=null) k.W=clamp(W,800,6000); if(H!=null) k.H=clamp(H,1200,3000); if(D!=null) k.D=clamp(D,350,900);
    [[W,k.W,"Ширина"],[H,k.H,"Высота"],[D,k.D,"Глубина"]].forEach(([a,b,n])=>{ if(a!=null&&a!==b) warns.push(`${n} ${fmt(a)} мм вне разумных пределов - поставил ${fmt(b)} мм.`); });
    const typeS = has(/встроен|в нишу|ниш[аеу]|от стены до стены/) ? "built" : has(/к стене|одн[а-я]+ боковин|в угол/) ? "semi" : has(/корпусн|отдельно стоящ/) ? "korp" : null;
    k.type=typeS||"korp"; k.back=k.type==="korp" && !has(/без задн/);
    const nd=vCount(t0,"двер|створ"), ns=vCount(t0,"секци|отделени");
    k.M=clamp(nd|| (k.W<=1800?2:k.W<=3000?3:k.W<=4200?4:5),2,6);
    k.N=clamp(ns|| Math.max(2,Math.round(k.W/800)),1,6);
    if(has(/без антресол/)) k.ant=false; else if(has(/антресол/)) k.ant=true; else k.ant=k.H>=2300;
    k.led=has(/подсветк/) && !has(/без подсветк/);
    if(has(/премиум/)) k.prof="prem"; else if(has(/эконом/)) k.prof="eco";
    // двери: зеркало / лакобель / ЛДСП
    const mir=has(/зеркал/) && !has(/без зеркал/), lac=has(/лакобел|стекл/), allMir=has(/все[а-я ]* зеркал|полностью зеркал|зеркальн[а-я]+ двер|двер[а-я]* зеркальн/) && !has(/одн[а-я]+ зеркал|зеркало в середине|по центру зеркал/);
    for(let i=0;i<6;i++){
      let seg="ldsp10";
      if(mir && lac) seg = i%2 ? "glass" : "mirror";
      else if(mir) seg = allMir ? "mirror" : (has(/зеркал[а-я]* (в середине|по центру|посередине)|по центру зеркал|средн[а-я]+ (двер[а-я]* )?зеркал/) ? (i===Math.floor((k.M-1)/2)||(k.M%2===0&&i===k.M/2)?"mirror":"ldsp10") : (k.M===2 ? (i===0?"mirror":"ldsp10") : (i%2===0?"mirror":"ldsp10")));
      else if(lac) seg = has(/все[а-я ]* (лакобел|стекл)/) ? "glass" : (i%2?"ldsp10":"glass");
      k.doors[i]={segs:[seg]};
    }
    if(has(/пескостру|фотопечат|рисун|витраж/)) warns.push("Рисунок на зеркале (пескоструй, фотопечать) в расчёт не входит - добавьте строкой в \"Дополнительно\".");
    // начинка: чередуем полки и штанги, ящики - в одну секцию
    const drawers=vCount(t0,"ящик")|| (has(/ящик/)&&!has(/без ящик/)?3:0), rods=has(/без штанг/)?0:(vCount(t0,"штанг")||Math.max(1,Math.round(k.N/2)));
    const tallH=k.H-(k.ant?k.antH:0);
    for(let i=0;i<6;i++){ const rod=i%2===1 && Math.floor(i/2)<rods || (k.N===1&&rods>0); k.secs[i]={shelves:rod?(tallH>2000?1:0):Math.max(3,Math.round(tallH/400)-1),rod,drawers:0,w:0}; }
    if(drawers){ const i=k.N>=3?k.N-1:0; const s=k.secs[i]; s.drawers=clamp(drawers,1,5); if(!s.rod) s.shelves=Math.max(2,s.shelves-Math.ceil(s.drawers*k.DH/350)); }
    R.add(G1,"Шкаф-купе",KUPE_TYPES[k.type], typeS?"said":"def");
    if(!typeS) R.ask("Как стоит шкаф","в нишу / к одной стене / отдельно стоящий","шкаф в нишу");
    R.add(G2,"Ширина",mmTxt(k.W), W!=null?"said":"def"); if(W==null) R.ask("Ширина","ширина 2 метра 40","ширина ");
    R.add(G2,"Высота",mmTxt(k.H), H!=null?"said":"def"); if(H==null) R.ask("Высота (или потолок)","высота 2 метра 60","высота ");
    R.add(G2,"Глубина",mmTxt(k.D), D!=null?"said":"def"); if(D==null) R.ask("Глубина","глубина 60 см","глубина ");
    R.add(G3,"Количество",k.M+"", nd?"said":"auto");
    R.add(G3,"Наполнение",k.doors.slice(0,k.M).map(d=>matName(d.segs[0])).join(" / "), mir||lac?"said":"def");
    if(!mir&&!lac) R.ask("Двери","все зеркальные / зеркало по центру / лакобель","двери ");
    R.add(G3,"Профиль",PROF[k.prof], k.prof!=="std"?"said":"def");
    R.add(G4,"Секций",k.N+"", ns?"said":"auto");
    R.add(G4,"Штанг",k.secs.slice(0,k.N).filter(s=>s.rod).length+"", has(/штанг/)?"said":"auto");
    R.add(G4,"Ящиков",drawers?clamp(drawers,1,5)+"":"нет", has(/ящик/)?"said":"def");
    R.add(G4,"Антресоль",k.ant?"есть, высота "+mmTxt(k.antH):"нет", has(/антресол/)?"said":"auto");
    if(k.led) R.add(G4,"Подсветка","есть");
    return vFinish("kupe",R,warns,S=>{ S.kupe=k; S.view.kupe="in"; },order);
  }

  // ---------- ЛЮБОЕ ИЗДЕЛИЕ ----------
  const tp = has(/комод/)?"dresser" : has(/стеллаж|полк[аи] открыт/)?"shelf" : has(/кроват/)?"bed" : has(/прихож/)?"hall" : has(/тумб/)?"tumba" : has(/стол(?!еш)/)?"table" : has(/шкаф|пенал/)?"cab" : null;
  if(!tp){ warns.push("Не понял, что делаем. Начните со слова: кухня, шкаф-купе, шкаф распашной, тумба, комод, стеллаж, кровать, стол или прихожая.");
    return vFinish(null,R,warns,null,order); }
  const pr=tplDefaults()[tp], free=[]; const set={}, G1="Изделие", G2="Размеры", G3="Состав";
  ms.forEach(m=>{ const r=role(m,[[/цокол/,"plinth"],[/высот/,"H"],[/глубин/,"D"],[/ширин|длин/,"W"]]); if(r) set[r]=m.mm; else free.push(m.mm); });
  R.add(G1,"Изделие",TPL[tp].name);
  if(tp==="bed"){ const v=free.concat(set.W||[],set.D||[]); if(v[0]) pr.MW=clamp(Math.min(v[0],v[1]||9e9),700,2200); if(v[1]) pr.ML=clamp(Math.max(v[0],v[1]),1500,2300); pr.lift=has(/подъемн/)&&!has(/без подъемн/); if(has(/лдсп/)) pr.base="ldsp";
    R.add(G2,"Матрас",`${pr.MW}×${pr.ML} мм`, v[0]?"said":"def"); if(!v[0]) R.ask("Размер матраса","кровать 160 на 200","");
    R.add(G3,"Подъёмный механизм",pr.lift?"есть":"нет", has(/подъемн/)?"said":"def"); }
  else{
    const order2 = tp==="table" ? ["W","D","H"] : ["W","H","D"], said={};
    order2.forEach(k2=>{ if(set[k2]==null && free.length) set[k2]=free.shift(); });
    ["W","H","D","plinth"].forEach(k2=>{ if(set[k2]!=null && k2 in pr){ pr[k2]=set[k2]; said[k2]=1; } });
    const nd=vCount(t0,"двер|створ"), nb=vCount(t0,"ящик"), nsh=vCount(t0,"полк|полок"), nsec=vCount(t0,"секци");
    if(nd!=null && "doors" in pr) pr.doors=clamp(nd,0,4); if(nb!=null && "drawers" in pr) pr.drawers=clamp(nb,0,8); if(nsh!=null && "shelves" in pr) pr.shelves=clamp(nsh,0,12); if(nsec!=null && "sections" in pr) pr.sections=clamp(nsec,1,6);
    if("doors" in pr && has(/без двер|открыт/)) pr.doors=0;
    let facS=null;
    if("fac" in pr){ if(has(/эмал/)) facS="mdf_enamel"; else if(has(/пластик/)) facS="mdf_plastic"; else if(has(/зеркал/)) facS="mirror"; else if(has(/лдсп/)&&!has(/мдф/)) facS="ldsp16"; else if(has(/мдф|пленк/)) facS="mdf"; if(facS) pr.fac=facS; }
    if(tp==="hall" && pr.cw>pr.W-300) pr.cw=Math.round(pr.W/2);
    [["W","Ширина","ширина 1 метр 20"],["H","Высота","высота 90 см"],["D","Глубина","глубина 45 см"]].forEach(([k2,n,ex])=>{ if(!(k2 in pr)) return; R.add(G2,n,mmTxt(pr[k2]), said[k2]?"said":"def"); if(!said[k2]) R.ask(n,ex,n.toLowerCase()+" "); });
    if(said.plinth) R.add(G2,"Цоколь",mmTxt(pr.plinth));
    if("doors" in pr) R.add(G3,"Дверей",pr.doors+"", nd!=null||has(/без двер|открыт/)?"said":"def");
    if("drawers" in pr) R.add(G3,"Ящиков",pr.drawers+"", nb!=null?"said":"def");
    if("shelves" in pr) R.add(G3,"Полок",pr.shelves+"", nsh!=null?"said":"def");
    if("sections" in pr) R.add(G3,"Секций",pr.sections+"", nsec!=null?"said":"def");
    if("fac" in pr) R.add(G3,"Фасады",matName(pr.fac), facS?"said":"def");
  }
  return vFinish("univ",R,warns,S=>{ S.u.tpl=tp; S.u.prms[tp]=pr; S.u.manual=false; S.u.built=false; S.view.univ="3d"; },order);
}

// ================= РАСПОЗНАВАНИЕ РЕЧИ =================
// Один интерфейс для двух движков: встроенная диктовка Claude (в артефакте) и Web Speech API браузера (на сайте).
// h: {final(text) - готовая фраза, interim(text) - то, что говорится сейчас, state(on, msg)}.
// Ключевое: после reset() старые фразы не возвращаются - результаты прошлой "сессии" отбрасываются по номеру поколения.
function webSpeechEngine(SR,h){
  const android=/android/i.test(navigator.userAgent);
  let rec=null, want=false, gen=0, quick=0, startedAt=0, lastFinal="";
  function spawn(){
    const my=++gen, r=new SR(); rec=r; lastFinal="";
    r.lang="ru-RU"; r.interimResults=true; r.maxAlternatives=1;
    r.continuous=!android;           // Chrome на Android в непрерывном режиме повторяет фразы - там слушаем по одной фразе и перезапускаем
    let doneIdx=-1;
    r.onresult=ev=>{ if(my!==gen) return; let interim="";
      for(let i=ev.resultIndex;i<ev.results.length;i++){ const x=ev.results[i], s=x[0].transcript;
        if(x.isFinal){ if(i<=doneIdx) continue; doneIdx=i; const f=s.trim(); if(f && !(android && f===lastFinal)){ lastFinal=f; h.final(f); } }
        else interim+=s; }
      h.interim(interim.trim()); quick=0; };
    r.onerror=e=>{ if(my!==gen) return;
      const msg={"not-allowed":"Нет доступа к микрофону. Разрешите микрофон для этого сайта (значок слева от адреса) или напишите текстом.",
        "service-not-allowed":"Браузер не дал включить распознавание речи. Попробуйте Chrome или напишите текстом.",
        "audio-capture":"Микрофон не найден. Проверьте, что он подключён.",
        "network":"Для распознавания речи нужен интернет. Проверьте связь или напишите текстом.",
        "language-not-supported":"Браузер не распознаёт русскую речь. Попробуйте Chrome."}[e.error];
      if(msg){ want=false; h.interim(""); h.state(false,msg); } };      // no-speech, aborted - не ошибки, просто перезапуск
    r.onend=()=>{ if(my!==gen){ if(rec===r && want) spawn(); return; }   // после reset(): новый сеанс только когда старый закрылся
      h.interim("");
      if(!want){ h.state(false); return; }
      if(Date.now()-startedAt<1500) quick++; else quick=0;
      if(quick>4){ want=false; h.state(false,"Микрофон всё время отключается. Попробуйте ещё раз или напишите текстом."); return; }
      setTimeout(()=>{ if(want && my===gen) spawn(); },120); };
    startedAt=Date.now();
    try{ r.start(); }catch(e){ want=false; h.state(false,"Микрофон не включился - можно написать текстом."); }
  }
  return {kind:"web",
    start(){ want=true; quick=0; lastFinal=""; spawn(); h.state(true); },
    stop(){ want=false; try{ rec&&rec.stop(); }catch(e){} },                      // договорённое допишется, потом onend
    reset(){ lastFinal=""; h.interim(""); if(!want) return; gen++; const old=rec;
      try{ old.abort(); }catch(e){}
      setTimeout(()=>{ if(want && rec===old) spawn(); },600); },              // если браузер не прислал onend
    destroy(){ want=false; gen++; try{ rec&&rec.abort(); }catch(e){} }};
}
function claudeEngine(d,h){
  const un=[]; let interim="", drop=false;
  un.push(d.onFinal(({text})=>{ interim=""; h.interim(""); if(drop){ drop=false; return; } if(text&&text.trim()) h.final(text.trim()); }));
  un.push(d.onPartial(({text})=>{ interim=(text||"").trim(); h.interim(drop?"":interim); }));
  un.push(d.onState(({state,reason})=>{ const on=state==="listening"||state==="starting";
    h.state(on, state==="idle"&&reason&&["not_granted","unavailable"].includes(reason)?"Микрофон здесь недоступен - напишите текст или продиктуйте через клавиатуру телефона.":""); }));
  return {kind:"claude",
    start(){ drop=false; d.start({language:"ru"}).catch(e=>{ if(e&&e.code==="unavailable") d.start().catch(()=>{}); else if(e&&e.code!=="stopped"&&e.code!=="dismissed") h.state(false,"Микрофон не включился - можно написать текстом."); }); },
    stop(){ d.stop().catch(()=>{}); },
    reset(){ if(interim) drop=true; interim=""; h.interim(""); },               // недоговорённая фраза до "Очистить" не вернётся
    destroy(){ un.forEach(f=>{ try{f();}catch(e){} }); try{ if(d.active&&d.active()) d.stop(); }catch(e){} }};
}
// голосовые команды - целой фразой
function voiceCmd(s){
  const t=vNorm(s).replace(/[.,!?;]/g," ").replace(/\s+/g," ").trim();
  if(/^(очисти(ть)?|сотри|удали|стереть|убери)( все| всё| полностью| текст)?$|^(начать |начнем |давай )?(заново|сначала|с начала)$/.test(t)) return "clear";
  if(/^(отмена|отмени(ть)?|назад|удали(ть)? последн[а-я]*( фразу)?|сотри последн[а-я]*( фразу)?|убери последн[а-я]*( фразу)?)$/.test(t)) return "undo";
  if(/^(собери(ть)?|собрать|построй|готово|сделай)( проект)?$/.test(t)) return "build";
  if(/^(стоп|хватит|остановись|выключи микрофон)$/.test(t)) return "stop";
  return null;
}
function dropLastPhrase(v){
  v=v.replace(/[\s,.;]+$/,"");
  const i=Math.max(v.lastIndexOf(","),v.lastIndexOf("."),v.lastIndexOf(";"),v.lastIndexOf("\n"));
  return i<0?"":v.slice(0,i).replace(/\s+$/,"");
}
function joinPhrase(v,f){
  f=f.trim(); if(!f) return v;
  const base=v.replace(/\s+$/,"");
  if(!base) return f.charAt(0).toUpperCase()+f.slice(1);
  return base+(/[,.;:!?]$/.test(base)?" ":", ")+f;
}

// ================= ОКНО =================
const VOICE_EX = [
  "Угловая кухня, основная стена 3 метра 60, вторая стена 1,8 метра, потолок 2,7, фасады эмаль белые, столешница камень, встроенный холодильник, посудомойка 45, подсветка",
  "Прямая кухня 2 метра 80, профиль Gola, духовка в пенале, без посудомойки, холодильник отдельно",
  "П-образная кухня, основная 3,2 метра, левая 2 метра, правая 2,4 метра, без ручек, верхние с подъёмниками",
  "Шкаф-купе в нишу, ширина 2 метра 70, высота 2,6, глубина 60 см, три двери, зеркало по центру, 4 ящика, подсветка, клиент Айгуль, скидка 5 процентов",
  "Комод ширина 1 метр, высота 90 см, глубина 45, пять ящиков, фасады пластик",
  "Тумба под телевизор 1800 на 450 на 400, две двери"
];
const VOICE_HELP = [
  ["Изделие","кухня прямая / угловая / П-образная, угол слева; шкаф-купе в нишу; комод, тумба, стеллаж, кровать, стол, прихожая"],
  ["Размеры","метры, сантиметры или миллиметры: \"3 метра 60\", \"2,4 метра\", \"1800\", \"60 см\"; \"2400 на 600\""],
  ["Кухня","основная, вторая, левая, правая стена; потолок; верхние шкафы 900; столешница на высоте 900; цоколь 100; глубина 600"],
  ["Отделка","фасады эмаль, пластик, плёнка, ЛДСП; столешница камень или ЛДСП; Gola, без ручек; цвет фасадов белый глянец"],
  ["Техника","встроенный холодильник или отдельно; посудомойка 45 или 60; духовка в пенале; газовая плита отдельно; мойка 60"],
  ["Заказ","клиент Иван Петров, телефон ...; скидка 5 процентов; предоплата 50; срок 20 дней"],
  ["Поправки","\"3 метра, нет, 3,5\"; \"не прямая, а угловая\"; \"посудомойка не нужна\""],
  ["Команды голосом","\"отмена\" - убрать последнюю фразу, \"очистить\" - стереть всё, \"собрать\" - собрать проект, \"стоп\""]
];
const MIC_SVG=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;
let VO={eng:null, on:false};
const VO_DRAFT="mk2_voice_draft";
function voiceStopAll(){ try{ VO.eng&&VO.eng.destroy(); }catch(e){} VO.eng=null; VO.on=false; }
function renderSum(res){
  if(!res) return "";
  let h="";
  if(res.rows.length){
    h+=`<div class="vo-sh"><b>Что понял</b><button class="b2 vo-sm" id="voCopy" title="Скопировать выжимку текстом">Скопировать</button></div><table class="vo-t">`;
    let g=null;
    res.rows.forEach(r=>{ if(r.g!==g){ g=r.g; h+=`<tr class="vo-g"><td colspan="2">${esc(g)}</td></tr>`; }
      h+=`<tr class="${r.src==="said"?"":"vo-dim"}"><td>${esc(r.label)}</td><td>${esc(r.val)}${SRC_TXT[r.src]?` <span class="vo-src">${SRC_TXT[r.src]}</span>`:""}</td></tr>`; });
    h+="</table>";
  }
  if(res.asks.length) h+=`<div class="vo-ask"><b>Чтобы проект был точнее, скажите:</b><ul>${res.asks.map((a,i)=>`<li><button class="vo-link" data-ask="${i}">${esc(a.label)}</button> - например: "${esc(a.say)}"</li>`).join("")}</ul></div>`;
  return h;
}
function openVoice(){
  openModal("Новый проект: подробное описание",`
    <p class="note" style="margin-top:0">Расскажите о заказе как клиенту или мастеру: что делаем, размеры, отделку, технику. Можно говорить по частям и поправлять себя - ниже сразу видно, что программа поняла и чего не хватает.</p>
    <div id="voTpl"></div>
    <textarea id="voTxt" rows="5" placeholder="Например: угловая кухня, основная стена 3 метра 60, вторая 1,8 метра, потолок 2,7, фасады эмаль, встроенный холодильник"></textarea>
    <div class="vo-live hide" id="voLive"></div>
    <div class="btns vo-bar"><button class="b1 hide" id="voMic">${MIC_SVG} Говорить</button><button class="b2" id="voUndo" title="Убрать последнюю фразу">Отменить фразу</button><button class="b2" id="voClear">Очистить</button><span class="vo-st" id="voSt"></span></div>
    <p class="note" id="voHint">На телефоне можно диктовать прямо в это поле: нажмите на него и выберите значок микрофона на клавиатуре.</p>
    <div class="warns" id="voWarn" style="margin:8px 0 0"></div>
    <div class="vo-sum hide" id="voGot"></div>
    <div class="btns"><button class="b1" id="voGo" disabled>Собрать проект</button><span class="note" id="voGoNote" style="margin:0"></span></div>
    <details class="vo-help"><summary>Что можно сказать</summary>
      <table class="vo-t">${VOICE_HELP.map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>
      <div class="note">Примеры - нажмите, чтобы подставить:</div>
      <div class="cands" id="voEx">${VOICE_EX.map((e,i)=>`<button data-ex="${i}">${esc(e)}</button>`).join("")}</div></details>`,
  ()=>{
    const ta=$("voTxt"), go=$("voGo"), live=$("voLive"), st=$("voSt"), mic=$("voMic"); let res=null;
    ta.value=LS.get(VO_DRAFT,"")||"";
    const save=()=>LS.set(VO_DRAFT,ta.value);
    const upd=()=>{
      res=parseSpeech(ta.value);
      const g=$("voGot"), w=$("voWarn");
      g.classList.toggle("hide",!(res&&(res.rows.length||res.asks.length)));
      g.innerHTML=renderSum(res);
      go.disabled=!(res&&res.mode);
      $("voGoNote").textContent = res&&res.mode&&res.asks.length ? "Можно собрать и сейчас - недостающее заполнится типовыми значениями." : "";
      if(res&&res.warns.length){ w.style.display="block"; w.innerHTML="<ul>"+res.warns.map(x=>`<li>${esc(x)}</li>`).join("")+"</ul>"; } else w.style.display="none";
      save();
    };
    const setText=v=>{ ta.value=v; upd(); ta.scrollTop=ta.scrollHeight; };
    const clearAll=()=>{ if(VO.eng) VO.eng.reset(); live.textContent=""; live.classList.add("hide"); setText(""); };
    const build=()=>{ if(!res||!res.mode) return; voiceStopAll(); res.apply(S);
      SEL={part:-1,mod:null}; LS.set(VO_DRAFT,""); closeModal(); setMode(res.mode); window.scrollTo({top:0}); toast("Проект собран - проверьте и поправьте, что нужно"); };
    ta.addEventListener("input",upd);
    $("voClear").onclick=()=>{ clearAll(); ta.focus(); };
    $("voUndo").onclick=()=>setText(dropLastPhrase(ta.value));
    go.onclick=build;
    $("voGot").addEventListener("click",e=>{
      const a=e.target.closest("[data-ask]");
      if(a){ const q=res.asks[+a.dataset.ask]; if(!q.ins) return; setText(joinPhrase(ta.value,q.ins).replace(/\s*$/," ")); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); return; }
      if(e.target.id==="voCopy"){ const txt=sumText(res); const done=()=>toast("Выжимка скопирована");
        if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done,()=>toast("Не получилось скопировать")); else toast("Копирование здесь недоступно"); }
    });
    if(typeof renderTplRow==="function") renderTplRow(text=>{ if(VO.eng) VO.eng.reset(); setText(text); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); });
    $("voEx").addEventListener("click",e=>{ const b=e.target.closest("[data-ex]"); if(b){ if(VO.eng) VO.eng.reset(); setText(VOICE_EX[+b.dataset.ex]); } });
    // микрофон
    const H={
      final(f){ const c=voiceCmd(f);
        if(c==="clear") return clearAll();
        if(c==="undo") return setText(dropLastPhrase(ta.value));
        if(c==="build") return build();
        if(c==="stop"){ VO.eng&&VO.eng.stop(); return; }
        setText(joinPhrase(ta.value,f)); },
      interim(s){ live.textContent=s; live.classList.toggle("hide",!s); },
      state(on,msg){ VO.on=on; if(!$("voMic")) return;
        mic.innerHTML=on?`${MIC_SVG} Остановить`:`${MIC_SVG} Говорить`; mic.classList.toggle("wa",on);
        st.textContent=on?"Слушаю...":""; st.classList.toggle("rec",on);
        if(msg) $("voHint").textContent=msg; }
    };
    const showMic=()=>{ mic.classList.remove("hide"); $("voHint").textContent="Нажмите \"Говорить\" и рассказывайте. Каждая фраза добавляется в поле - его можно поправить руками. Скажите \"отмена\", чтобы убрать последнюю фразу."; };
    const SR=!window.claude && (window.SpeechRecognition||window.webkitSpeechRecognition);
    if(window.claude&&window.claude.use) Promise.resolve(window.claude.use("dictation")).then(d=>{ if(!d||!$("voMic")) return; VO.eng=claudeEngine(d,H); showMic(); }).catch(()=>{});
    else if(SR){ VO.eng=webSpeechEngine(SR,H); showMic(); }
    mic.onclick=()=>{ if(!VO.eng) return; if(VO.on) VO.eng.stop(); else VO.eng.start(); };
    $("modalX").addEventListener("click",voiceStopAll);
    $("modal").addEventListener("mousedown",e=>{ if(e.target.id==="modal") voiceStopAll(); });
    ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); upd();
  },{wide:true});
}
