// ================= ГОЛОСОВОЙ ПОМОЩНИК: вопросы, переходы, прайс, ручки, ящики, двери, позиции =================
// edWhole(t) - фраза целиком: вопросы ("сколько стоит ЛДСП"), переходы ("открой прайс", "покажи 3D"), действия ("сохрани расчёт").
// edMore(c)  - одна правка из фразы: ручки, позиции в расчёт, монтаж, телефон, цены прайса, углы кухни, ящики и полки купе и изделий.
const stem = w => w.length>5 ? w.slice(0,w.length>7?5:4) : w.length>3 ? w.slice(0,4) : w;
const STOP = new Set(["сколько","стоит","стоят","какая","какие","какой","цена","цены","цену","почем","прайс","прайсе","стоимость","на","в","за","и","у","нас","мне","скажи","посмотри","покажи","найди","по","сейчас","одна","один","штука","штуки"]);
function priceFind(q,n){
  const ws=vNorm(q).split(/[^а-яa-z0-9]+/).filter(w=>w.length>=2&&!STOP.has(w)).map(stem);
  if(!ws.length) return [];
  return PRICE.filter(it=>it.u!=="%"&&it.u!=="да/нет").map(it=>{ const hay=vNorm(it.name+" "+(it.s||"")+" "+(it.sku||""));
      let sc=0; ws.forEach(w=>{ if(new RegExp("(^|[^а-яa-z0-9])"+w).test(hay)) sc+=w.length>=4?2:1; else if(hay.includes(w)) sc+=0.5; });
      return {it,sc}; }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,n||3).map(x=>x.it);
}
const priceTxt = it => `${it.s||it.name}: ${money(+it.v||0)} за ${it.u}`;
function edSay(msg,say){ return {ok:false, msg:[].concat(msg), errs:[], say:say||[].concat(msg).join(". "), info:true}; }
function edAct(msg,fn){ return {ok:false, msg:[].concat(msg), errs:[], act:fn, info:true}; }
const ED_TABS=[[/прайс|цены|расценк/,"price"],[/модул|библиотек/,"lib"],[/кухн/,"kitchen"],[/купе|шкаф(?!чик)/,"kupe"],[/любое|издели|комод|тумб|стеллаж|кроват|прихож|стол(?!еш)/,"univ"]];
const ED_VIEWS=[[/3 ?д|3d|объем|трехмер/,"3d"],[/разверт/,"elev"],[/план|сверху/,"plan"],[/начинк|внутр/,"in"],[/двер/,"door"],[/сверху/,"top"],[/спереди|фасад/,"front"],[/сбоку/,"side"]];
function edHelpText(){
  return {kitchen:"добавь посудомойку 45 после мойки; убери верхний шкаф над мойкой; замени все верхние на подъёмники; основная стена 3,5 метра; ручки Gola или убери ручки; угол глухой; без цоколя",
    kupe:"добавь ящик во вторую секцию; убери полку из первой; добавь дверь; вторая дверь зеркало и ЛДСП; ширина второй секции 900; без антресоли",
    univ:"добавь ящик; убери двери; 3 полки; добавь фасад 400 на 700; без задней стенки"}[S.mode]||"";
}
function edWhole(t){
  // ---- помощь ----
  if(/^(помощь|помоги|что (ты )?умеешь|что можно (сказать|делать)|какие команды|подскажи)/.test(t))
    return edSay(["Можно: "+edHelpText()+".","Ещё: сколько стоит ЛДСП; цена петли 1500; добавь в расчёт смеситель 15000; без монтажа; покажи 3D; открой прайс; покажи клиенту; сохрани расчёт; перейди в раскрой; отмена."],"Говорите правку, вопрос про цену или куда перейти. Например: добавь ящик, сколько стоит ЛДСП, открой прайс.");
  // ---- вопросы про проект ----
  if(/^(сколько (стоит|выходит|получается|будет)( (весь )?(проект|заказ|кухня|шкаф|изделие|итого|всего))?$|какая (цена|стоимость|сумма)( (проекта|заказа|для клиента))?$|итого$|общая (сумма|цена)|цена для клиента)/.test(t)){
    calc(); const q=CUR.quote; if(!q) return edSay("Пока нечего считать");
    const m=[`Цена для клиента ${money(q.total)}`+(q.disc?` (со скидкой ${q.disc}%)`:""), `себестоимость ${money(q.cost)}, прибыль ${money(q.total-q.cost)}`, `предоплата ${money(q.pre)}`];
    return edSay(m.join(", "),`Цена для клиента ${fmt(q.total)}. Предоплата ${fmt(q.pre)}.`);
  }
  if(/^(какие|что за|сколько) (материал|листов|плит)|сколько (листов|плит)/.test(t)){
    calc(); const rows=(CUR.quote&&CUR.quote.rows||[]).filter(r=>/лист|м²/.test(r[1])).slice(0,4);
    return edSay(rows.length?rows.map(r=>`${r[0]}: ${r[1]}`).join("; "):"Листовых материалов нет");
  }
  // ---- вопросы про прайс ----
  if(/прайс[а-я]* (загружен|подгружен|обновлен|актуал|свой|мой|чей|какой)|(загружен|подгружен|есть ли|какой)[а-я ]* прайс|что (в|с) прайс|чей прайс/.test(t)){
    const def=priceDefaults(), changed=PRICE.filter(it=>{ const d=def.find(x=>x.id===it.id); return !d||+d.v!==+it.v; }).length, own=PRICE.filter(it=>!it.sys).length;
    const meta=PRICE_META||{}, src=[meta.supplier,meta.file,meta.date].filter(Boolean).join(", ");
    const m = meta.starter&&!changed ? `Сейчас стоят примерные стартовые цены (позиций: ${PRICE.length}, валюта ${CURCODE}). Свой прайс можно загрузить во вкладке "Прайс" из Excel.`
      : `Прайс свой: позиций ${PRICE.length}, изменено цен ${changed}, своих позиций ${own}, валюта ${CURCODE}${src?". Источник: "+src:""}.`;
    return edSay(m);
  }
  let m;
  if((m=t.match(/^(?:(?:покажи|скажи|найди|посмотри|подскажи) )?(сколько сто[ия]т|какая цена( на| у)?|какие цены( на)?|почем|цен[аеуы]( на)?|стоимость)\s+(.+)$/)) && !/\d{2,}/.test(m[m.length-1])){
    const q=m[m.length-1], f=priceFind(q,3);
    if(!f.length) return edSay(`В прайсе не нашёл "${q}"`);
    return edSay(f.map(priceTxt).join("; "), f.slice(0,2).map(it=>`${it.s||it.name} - ${fmt(+it.v||0)} за ${it.u==="шт."?"штуку":it.u==="м²"?"квадратный метр":it.u==="п.м."?"погонный метр":it.u}`).join(". "));
  }
  // ---- переходы внутри калькулятора ----
  if((m=t.match(/^(открой|перейди|покажи|переключи|давай|включи|зайди)[а-я]*( (на|в|во))?( вкладк[а-я]*| раздел[а-я]*| страниц[а-я]*)?\s*(.+)$/))){
    const what=m[5];
    for(const [rx,v] of ED_VIEWS) if(rx.test(what) && PAGE==="calc" && (VIEWS[S.mode]||[]).some(x=>x[0]===v) && !/вкладк|раздел/.test(t))
      return edAct(`Показываю: ${(VIEWS[S.mode].find(x=>x[0]===v)||[])[1]}`,()=>{ S.view[S.mode]=v; renderViewTabs(); if(typeof R3!=="undefined"&&R3) R3.needFit=true; drawSketch(); const sk=$("sketchCard"); if(sk) sk.scrollIntoView({behavior:"smooth",block:"nearest"}); });
    if(/клиент/.test(what)) return edAct("Показываю клиенту",()=>clientShow(true));
    if(/заказ[а-я]* (целиком|полностью)|все изделия/.test(what)){}
    else for(const [rx,v] of ED_TABS) if(rx.test(what)) return edAct(`Открываю: ${({price:"Прайс",lib:"Модули",kitchen:"Кухня",kupe:"Шкаф-купе",univ:"Любое изделие"})[v]}`,()=>{ setMode(v); window.scrollTo({top:0,behavior:"smooth"}); });
  }
  if(/^(скрой|спрячь|убери) фасад/.test(t)) return edAct("Фасады скрыты",()=>{ S.hideFac=true; const c=$("hideFac"); if(c) c.checked=true; drawSketch(); });
  if(/^(покажи|верни) фасад/.test(t)) return edAct("Фасады показаны",()=>{ S.hideFac=false; const c=$("hideFac"); if(c) c.checked=false; drawSketch(); });
  if(/^(выйди|закрой|выход)[а-я]* (из )?(показ|режим)/.test(t)) return edAct("Вышел из показа",()=>clientShow(false));
  if(/^(сохрани|запомни)[а-я]* (расчет|проект|заказ)$|^сохрани$/.test(t)) return edAct("Сохраняю расчёт в \"Мои расчёты\"",()=>saveCalc());
  if(/^(скачай|выгрузи|сохрани)[а-я]* (список деталей|детали|excel|эксель|раскрой)/.test(t)) return edAct("Скачиваю список деталей в Excel",()=>partsXlsx());
  if(/^(скачай|выгрузи|сохрани)[а-я]* (файл )?заказ/.test(t)) return edAct("Скачиваю файл заказа",()=>exportOrder());
  if(/^(скопируй|копируй)[а-я]* (для клиента|текст|описание)/.test(t)) return edAct("Текст для клиента скопирован",()=>copy(lastClient));
  if(/(отправ|пошли|скинь)[а-я]* .*(ватсап|вотсап|whatsapp|клиенту)/.test(t)) return {ok:false, msg:[`Нажмите, чтобы отправить: <a class="btn wa" target="_blank" rel="noopener" href="${$("wa").href}">WhatsApp</a>`], errs:[], html:true, info:true, say:"Нажмите кнопку WhatsApp в панели"};
  if(/^(добав|положи)[а-я]* (это |еще )?(изделие|в заказ)|^(следующее|еще одно|новое) изделие/.test(t)) return edAct("Изделие добавлено в заказ, выберите, что считаем дальше",()=>itemAdd());
  if(/^(новый|начни новый|начать новый|чистый) расчет/.test(t)){ return {ok:true, msg:["Начат новый расчёт (\"отмена\" вернёт прежний)"], errs:[], pre:()=>{ const m0=S.mode; S=defaultState(); S.mode=m0; }}; }
  return null;
}
// ---------- правки ----------
function edMore(f){
  let m;
  // телефон, монтаж, срок, наценка
  if((m=f.match(/(?:телефон|номер)[а-я]*\s*:?\s*(\+?\d[\d\s()-]{5,}\d)/))){ S.phone=m[1].replace(/\s+/g," ").trim(); return ["Телефон клиента: "+S.phone]; }
  if(/без (доставки|монтажа|установки|сборки на месте)/.test(f)){ S.install=0; return ["Без доставки и монтажа"]; }
  if(/(монтаж|доставк|установк)[а-я ]*по прайсу/.test(f)){ S.install=null; return ["Доставка и монтаж - по прайсу"]; }
  if((m=f.match(/^(?:доставк[а-я]*\s*(?:и\s*)?)?(?:монтаж|установк)[а-я]*(?:\s*и\s*доставк[а-я]*)?\s*(\d+)/)) && +m[1]>=100){ S.install=+m[1]; return ["Доставка и монтаж: "+money(S.install)]; }
  if(/календарн/.test(f)&&/дн|срок/.test(f)){ S.daysKind="calendar"; const d=vCount(f,"календарн"); if(d) S.days=d; return ["Срок в календарных днях"+(d?": "+d:"")]; }
  if((m=f.match(/^наценк[а-я]*\s*(\d+)/))){ PI.markup.v=+m[1]; savePrice(); return ["Наценка "+m[1]+"%"]; }
  if((m=f.match(/^(?:сборк[а-я]*|работ[а-я]*)\s*(\d+)\s*(%|процент)/))){ PI.work.v=+m[1]; savePrice(); return ["Сборка "+m[1]+"% от материалов"]; }
  // позиции в расчёт: "добавь в расчёт смеситель 15000", "добавь позицию подъём на этаж 5000", "убери позицию смеситель"
  if((m=f.match(/^(?:добав|впиши|запиши|включи)[а-я]*\s+(?:в расчет|в смету|позици[а-я]*|строк[а-я]*|отдельно)\s+(.+)$/)) || (m=f.match(/^(?:добав|впиши)[а-я]*\s+(.+?)\s+в (?:расчет|смету)(.*)$/))){
    let s=(m[1]+" "+(m[2]||"")).trim(); let q=1; const qm=s.match(/(\d+)\s*(?:шт[а-я.]*|штук[а-я]*)/); if(qm){ q=+qm[1]; s=s.replace(qm[0]," "); }
    const pm=s.match(/(?:по|за|цена|стоимост[а-я]*)?\s*(\d+(?:\.\d+)?)\s*(?:тенге|рубл[а-я]*|руб)?\s*$/); const p=pm?+pm[1]:0; if(pm) s=s.slice(0,pm.index);
    const name=s.replace(/\s+/g," ").trim(); if(!name) throw new Error("Скажите название позиции: \"добавь в расчёт смеситель 15000\"");
    S.extras.push({name:name.charAt(0).toUpperCase()+name.slice(1),q,p}); return [`В расчёт добавлено: ${name}${q>1?", "+q+" шт.":""}${p?", "+money(p):" (цену впишите в \"Дополнительно\")"}`];
  }
  if((m=f.match(/^(?:убер|удал)[а-я]*\s+(?:из расчета|из сметы|позици[а-я]*|строк[а-я]*)\s+(.+)$/))){
    const ws=m[1].split(" ").filter(w=>w.length>2).map(stem), i=S.extras.findIndex(x=>ws.every(w=>vNorm(x.name).includes(w)));
    if(i<0) throw new Error(`В "Дополнительно" нет позиции "${m[1]}"`); const x=S.extras.splice(i,1)[0]; return ["Убрал из расчёта: "+x.name];
  }
  // цена в прайсе: "цена петли 1500", "поставь цену на ЛДСП 23000", "петли по 1500"
  if((m=f.match(/^(?:поставь|установи|сделай|измени|запиши)?\s*цен[аыу]?\s+(?:на\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(?:тенге|рубл[а-я]*|руб|сум|сом|₸)?$/)) || (m=f.match(/^(.+?)\s+по\s+(\d+(?:\.\d+)?)\s*(?:тенге|рубл[а-я]*|руб)?$/))){
    const it=priceFind(m[1],1)[0]; if(!it) throw new Error(`В прайсе не нашёл "${m[1]}"`);
    ED.priceTouched=true; const old=it.v; it.v=+m[2]; savePrice(); return [`Цена "${it.s||it.name}": ${money(old)} -> ${money(it.v)} за ${it.u}`];
  }
  // ручки
  if(/ручк|рейлинг|скоб|кнопк|ракушк|гола|gola|push|пуш|тип-?он/.test(f)){
    if(S.mode==="kupe") return ["У шкафа-купе ручек нет - двери откатные"];
    if(S.mode==="univ"){ return ["Ручки в изделии считаются по количеству дверей и ящиков; вид ручки впишите в \"Цвет и декор\""]; }
    const K=S.kit, kind=/рейлинг/.test(f)?"рейлинг":/скоб/.test(f)?"скоба":/кнопк/.test(f)?"кнопка":/ракушк/.test(f)?"ракушка":/черн/.test(f)?"чёрные":/золот|латун/.test(f)?"золото":null;
    if(/гола|gola|профил/.test(f) && !/убер|без|удал/.test(f)){ K.handles="gola"; return ["Ручки: профиль Gola"]; }
    if(/(убер|удал|сними|без|не нужн)[а-я ]*ручк|ручк[а-я ]*не нужн|push|пуш|тип-?он/.test(f)){ K.handles="push"; return ["Без ручек: открывание нажатием (push-to-open)"]; }
    K.handles="std"; if(kind){ S.decor=(S.decor?S.decor.replace(/,?\s*ручки:[^,]*/,"")+", ":"")+"ручки: "+kind; }
    return ["Ручки обычные"+(kind?` (${kind} - записал в "Цвет и декор")`:"")];
  }
  if(S.mode==="kitchen"){
    const K=S.kit, lay=LAYOUTS[K.layout];
    // углы: "угол глухой", "правый угол без углового", "верхний угол г-образный"
    if(/угол|углов/.test(f) && /глух|г-?образ|без углов|до угла|обычн/.test(f) && !lay.corners.length) return ["У прямой кухни угла нет. Скажите \"сделай угловую кухню\", если нужен угол"];
    if(/угол|углов/.test(f) && /глух|г-?образ|без углов|до угла|обычн/.test(f) && lay.corners.length){
      const sides=/прав/.test(f)?["R"]:/лев/.test(f)?["L"]:lay.corners, up=/верх/.test(f);
      const t=/без углов|до угла/.test(f)?"none":/глух/.test(f)?(/боков/.test(f)?"blindB":"blindA"):"L";
      if(up && t.startsWith("blind")) return ["Верхний угол бывает только Г-образный или без углового"];
      sides.filter(s=>lay.corners.includes(s)).forEach(s=>K.corners[s][up?"up":"low"].t=t);
      const notes=[]; lay.walls.forEach(wi=>notes.push(...edBalanceWall(wi)));
      return [`${up?"Верхний":"Нижний"} угол: ${(up?CORNER_UP:CORNER_LOW)[t]}`,...notes];
    }
    if(/без цокол/.test(f)){ K.PL=0; return ["Без цоколя"]; }
    if(/плинтус/.test(f)){ K.tplinth=!/без|убер|удал|не нужн/.test(f); return [K.tplinth?"С плинтусом столешницы":"Без плинтуса столешницы"]; }
    if(/вырез/.test(f)){ const n=/без/.test(f)?0:(vCount(f,"вырез")||1); if(/варочн|плит/.test(f)){ K.cutHob=n; return ["Вырезов под варочную: "+n]; } if(/мойк/.test(f)){ K.cutSink=n; return ["Вырезов под мойку: "+n]; } }
    if((m=f.match(/зазор[а-я]*\s*(\d+(?:\.\d+)?)/))){ K.gap=clamp(+m[1],0,8); return ["Зазор между фасадами "+K.gap+" мм"]; }
    if(/выровня[а-я]* пенал|пенал[а-я]* (по|до) верх/.test(f)){ const c=kitCtx(K); K.Ht=c.Hl+c.topT+c.apronH+c.Hu; return ["Пенал выровнен по верху навесных: "+K.Ht+" мм"]; }
    if(/высот[а-я]* пенал/.test(f)){ const ms=vMeasures(" "+f+" "); if(ms.length){ K.Ht=clamp(vFit(ms[ms.length-1],1400,2740),1400,2740); return ["Высота пеналов "+K.Ht+" мм"]; } }
    if(/^подгони|^заполни|^выровня[а-я]* (ряды|модули|стены)/.test(f) && typeof fitAll==="function"){ fitAll(); return ["Модули подогнаны под стены"]; }
    // "замени все верхние на подъёмники", "все верхние сделай открытыми"
    if((m=f.match(/^(?:замени|поменяй|сделай)[а-я]*\s+все\s+(.+?)\s+(?:на|в)\s+(.+)$/)) || (m=f.match(/^все\s+(.+?)\s+(?:сделай|замени на|с|на)\s+(.+)$/))){
      const row=edRow(m[1])||"upper", from=edType(m[1],row), to=edType(m[2],row)||(/открыт/.test(m[2])?"u_open":/подъем/.test(m[2])?"u_lift":/обычн|дверц/.test(m[2])?(row==="upper"?"u_shelf":"l_shelf"):null);
      if(!to) throw new Error(`Не понял, на что заменить: "${m[2]}"`);
      const fam=from&&ED_FAM[from]?ED_FAM[from]:[from]; let n=0;
      lay.walls.forEach(wi=>K.walls[wi][row].forEach((x,j)=>{ const d=modDef(x.t)||{}; if((from?fam.includes(x.t):!d.gap&&!/fill/.test(x.t)) && x.t!==to && (row!=="upper"||!/dryer|hood/.test(x.t)||from)){ K.walls[wi][row][j]={t:to,w:x.w}; n++; } }));
      return n?[`Заменил ${n} шт.: теперь ${edName(to)}`]:["Заменять нечего"];
    }
    if(/^(добав|постав)[а-я]* фасад/.test(f)) return ["У кухни фасады на каждом модуле. Скажите, например: \"фасады эмаль\", \"добавь шкаф 600\" или \"добавь ящики\""];
  }
  if(S.mode==="kupe") return edKupeMore(f);
  if(S.mode==="univ") return edUnivMore(f);
  return null;
}
const ED_ADD=/^(добав|постав|встав|еще)/, ED_RM=/^(убер|удал|сними|убав|минус)/;
// "убери двери", "убери все ящики" - убрать все; "убери ящик" - один
const edAll = f => /(^|\s)все(х)?\s/.test(" "+f+" ") || (ED_RM.test(f) && /(двери|ящики|полки|штанги|ящиков|полок)(\s|$)/.test(f) && !vCount(f,"двер|ящик|полк|полок|штанг"));
function edNum(f,rx){ const n=vCount(f,rx); return n||1; }
function edKupeMore(f){
  const k=S.kupe, add=ED_ADD.test(f), rm=ED_RM.test(f), o=edOrd(f);
  if(!add&&!rm){
    // "ширина второй секции 900"
    if(/ширин/.test(f)&&/секци/.test(f)&&o){ const i=o===-1?k.N-1:o-1, ms=vMeasures(" "+f+" "); if(i>=k.N||!ms.length) return null; k.secs[i].w=clamp(vFit(ms[ms.length-1],250,1500),250,1500); return [`Секция ${i+1}: ширина ${k.secs[i].w} мм`]; }
    if(/ширин/.test(f)&&/секци/.test(f)&&/(одинаков|поровну|равн|авто)/.test(f)){ k.secs.forEach(s=>s.w=0); return ["Секции поровну"]; }
    if(/высот[а-я]* ящик/.test(f)){ const ms=vMeasures(" "+f+" "); if(ms.length){ k.DH=clamp(vFit(ms[ms.length-1],100,400),100,400); return ["Высота ящиков "+k.DH+" мм"]; } }
    if(/задн[а-я]* стенк/.test(f)){ k.back=!/без/.test(f); return [k.back?"С задней стенкой":"Без задней стенки"]; }
    // двери из частей: "вторая дверь зеркало и ЛДСП", "двери из двух частей"
    if(/двер/.test(f)&&/част|пополам|раздели|напополам/.test(f)){
      const n=/тр[ие]/.test(f)||/\b3\b/.test(f)?3:/цел|одн/.test(f)?1:2, idx=o?[o===-1?k.M-1:o-1]:[...Array(k.M).keys()];
      idx.forEach(i=>{ const d=k.doors[i]; if(!d) return; while(d.segs.length<n) d.segs.push(d.segs[d.segs.length-1]==="mirror"?"ldsp10":"mirror"); d.segs.length=n; });
      return [(o?`Дверь ${idx[0]+1}`:"Все двери")+`: ${n===1?"целая":"из "+n+" частей"}`];
    }
    const mats=[...f.matchAll(/зеркал[а-я]*|лакобел[а-я]*|стекл[а-я]*|лдсп/g)].map(x=>/зеркал/.test(x[0])?(/тонир|бронз|графит/.test(f)?"mirror_t":"mirror"):/лакобел|стекл/.test(x[0])?"glass":"ldsp10");
    if(mats.length>=2 && /двер/.test(f)){ const idx=o?[o===-1?k.M-1:o-1]:[...Array(k.M).keys()]; idx.forEach(i=>{ if(k.doors[i]) k.doors[i]={segs:mats.slice(0,3)}; }); return [(o?`Дверь ${idx[0]+1}`:"Все двери")+": "+mats.slice(0,3).map(matName).join(" / ")]; }
    return null;
  }
  const sign=add?1:-1;
  if(/двер|створ/.test(f)&&!/секци/.test(f)){ k.M=clamp(k.M+sign*edNum(f,"двер|створ"),2,6); return [`Дверей: ${k.M}`]; }
  if(/секци|отделени/.test(f)&&!/(в|во|из|с) [а-я]*\s*секци/.test(f)&&!o){ k.N=clamp(k.N+sign*edNum(f,"секци|отделени"),1,6); return [`Секций: ${k.N}`]; }
  if(/антресол/.test(f)){ k.ant=add; return [add?"С антресолью":"Без антресоли"]; }
  if(/подсветк/.test(f)){ k.led=add; return [add?"С подсветкой":"Без подсветки"]; }
  // в секцию: если номер не назван - в секцию, где уже есть такие элементы, иначе в последнюю
  const what=/ящик/.test(f)?"drawers":/штанг/.test(f)?"rod":/полк|полок/.test(f)?"shelves":null; if(!what) return null;
  let i=o?(o===-1?k.N-1:o-1):-1;
  if(i<0){ i=k.secs.slice(0,k.N).findIndex(s=>what==="rod"?(rm?s.rod:!s.rod):(rm?s[what]>0:s[what]>0)); if(i<0) i=what==="rod"&&add?k.secs.slice(0,k.N).findIndex(s=>!s.rod):k.N-1; if(i<0) i=k.N-1; }
  const s=k.secs[i]; if(!s||i>=k.N) return ["Такой секции нет"];
  if(what==="rod"){ s.rod=add; return [`Секция ${i+1}: ${add?"добавлена штанга":"штанга убрана"}`]; }
  const n=rm&&edAll(f)?s[what]:edNum(f,what==="drawers"?"ящик":"полк|полок");
  s[what]=clamp(s[what]+sign*n,0,what==="drawers"?5:12);
  return [`Секция ${i+1}: ${what==="drawers"?"ящиков":"полок"} ${s[what]}`];
}
function edUnivMore(f){
  const u=S.u, tp=u.tpl, pr=u.prms[tp]; if(!pr) return null;
  const add=ED_ADD.test(f), rm=ED_RM.test(f), mm=(lo,hi)=>{ const ms=vMeasures(" "+f+" "); return ms.length?vFit(ms[ms.length-1],lo,hi):null; };
  const rebuild=()=>{ u.built=false; u.manual=false; };
  // ручная деталь: "добавь фасад 400 на 700", "добавь полку 800 на 300", "добавь деталь 600 на 400"
  if(add && /фасад|полк|детал|стенк|перегородк|боковин/.test(f)){
    const ms=vMeasures(" "+f+" ").map(x=>x.mm); if(ms.length>=2){
      const fac=/фасад/.test(f), shelf=/полк/.test(f), side=/перегородк|боковин/.test(f);
      const mat=fac?(edMat(f)==="ldsp16f"?"ldsp16":edMat(f)||(pr.fac||"mdf")):"ldsp16";
      const p={name:fac?"Фасад":shelf?"Полка":side?"Перегородка":"Деталь",mat,o:fac?"Z":shelf?"Y":side?"X":"Z",x:0,y:0,z:0,a:ms[0],b:ms[1],edge:1}; if(fac) p.f=1;
      u.panels.push(p); u.manual=true; u.built=true; SEL={part:u.panels.length-1,mod:null};
      return [`Добавлена деталь "${p.name}" ${ms[0]}×${ms[1]} мм (${matName(mat)}). Поставьте её на место в списке деталей.`];
    }
  }
  const step=(key,rx,lo,hi,label)=>{ if(!(key in pr)) return null; const n=rm&&edAll(f)?pr[key]:edNum(f,rx); pr[key]=clamp((+pr[key]||0)+(add?n:-n),lo,hi); rebuild(); return [`${label}: ${pr[key]}`]; };
  if(add||rm){
    if(/ящик/.test(f)) return step("drawers","ящик",0,8,"Ящиков");
    if(/двер|створ/.test(f)) return step("doors","двер|створ",0,4,"Дверей");
    if(/полк|полок/.test(f)) return step("shelves","полк|полок",0,12,"Полок");
    if(/секци/.test(f)) return step("sections","секци",1,6,"Секций");
    if(/задн[а-я]* стенк/.test(f)&&"back" in pr){ pr.back=add; rebuild(); return [add?"С задней стенкой":"Без задней стенки"]; }
    if(/подъемн/.test(f)&&"lift" in pr){ pr.lift=add; rebuild(); return [add?"С подъёмным механизмом":"Без подъёмного механизма"]; }
  }
  if(/без задн[а-я]* стенк/.test(f)&&"back" in pr){ pr.back=false; rebuild(); return ["Без задней стенки"]; }
  if(/высот[а-я]* ящик/.test(f)&&"drawerH" in pr){ const v=mm(80,500); if(v){ pr.drawerH=v; rebuild(); return ["Высота ящика "+v+" мм"]; } }
  if(/ширин[а-я]* шкаф/.test(f)&&"cw" in pr){ const v=mm(300,2000); if(v){ pr.cw=v; rebuild(); return ["Ширина шкафа "+v+" мм"]; } }
  if(/основани|ламел/.test(f)&&"base" in pr){ pr.base=/лдсп/.test(f)?"ldsp":"lamels"; rebuild(); return ["Основание: "+(pr.base==="ldsp"?"ЛДСП":"ламели")]; }
  if(/подъемн/.test(f)&&"lift" in pr){ pr.lift=!/без/.test(f); rebuild(); return [pr.lift?"С подъёмным механизмом":"Без подъёмного механизма"]; }
  if(/матрас/.test(f)&&"MW" in pr){ const ms=vMeasures(" "+f+" ").map(x=>x.mm); if(ms.length>=2){ pr.MW=clamp(Math.min(ms[0],ms[1]),700,2200); pr.ML=clamp(Math.max(ms[0],ms[1]),1500,2300); rebuild(); return [`Матрас ${pr.MW}×${pr.ML} мм`]; } }
  if(/столешниц/.test(f)&&"topMat" in pr){ pr.topMat=/38|столешниц[а-я]* 38|толст/.test(f)?"top38":"ldsp16"; rebuild(); return ["Столешница: "+matName(pr.topMat)]; }
  if(/назов|назови|название/.test(f)){ const n=f.replace(/^.*?(назов[а-я]*|назови|название)\s*/,""); if(n){ u.title=n.charAt(0).toUpperCase()+n.slice(1); return ["Название для клиента: "+u.title]; } }
  return null;
}
