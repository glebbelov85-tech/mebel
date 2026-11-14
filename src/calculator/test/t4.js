// правки кухни словами (без браузера)
var S={mode:"kitchen",kit:null,kupe:kupeDefaults(),u:{tpl:"dresser",prms:tplDefaults()},client:"",decor:"",view:{}}, SEL={};
function migrateState(s){ return s; }
const r0=parseSpeech("угловая кухня основная стена 3 метра 60 вторая 1 метр 80 встроенный холодильник посудомойка 60"); r0.apply(S);
const show=()=>{ const g=genKitchen(S.kit); return S.kit.walls.map((w,i)=>g.info.lay.walls.includes(i)?`[${i}] L:`+w.lower.map(m=>m.t.slice(2)+m.w).join(",")+" U:"+w.upper.map(m=>m.t.slice(2)+m.w).join(",")+` free ${Math.round(g.info.walls.find(x=>x.wi===i).freeL)}/${Math.round(g.info.walls.find(x=>x.wi===i).freeU)}`:"").filter(Boolean).join("\n    ")+"  overlap:"+checkParts(g.parts,{overlap:1}).length; };
console.log("start\n    "+show());
["убери посудомойку","добавь посудомойку 45 после мойки","поменяй местами мойку и посудомойку","убери верхний шкаф над мойкой","добавь сушку над мойкой","замени духовку на ящики","перенеси пенал на основную стену","мойку 600","основная стена 3 метра","основная стена 4 метра","добавь бутылочницу перед мойкой и убери второй верхний шкаф","добавь подъемник на правую стену","фасады эмаль, столешница камень, без ручек, подсветка","верхние 900","поменяй фасады на пластик","отмена","перенеси посудомойку левее","добавь окно","клиент Иван телефон 87011234567 скидка 10 процентов","сделай прямую кухню","абракадабра"].forEach(c=>{
  const r=editProject(c); console.log(">>",c,"\n   ",r.msg.join(" | "),r.errs&&r.errs.length?"ERR "+r.errs.join(" | "):""); console.log("    "+show()); });
console.log(S.kit.fac,S.kit.top,S.kit.handles,S.kit.led,S.kit.Hu,S.client,S.disc);
S.mode="kupe"; ["ширина 2,6 метра","4 двери","все двери зеркало","вторая дверь лакобель","в третьей секции 4 ящика","добавь штангу в первую секцию","без антресоли","профиль премиум","в нишу"].forEach(c=>{ const r=editProject(c); console.log(">>",c,"|",r.msg.join(" | "),r.errs.join(" | ")); });
console.log(JSON.stringify([S.kupe.W,S.kupe.M,S.kupe.doors.slice(0,4).map(d=>d.segs[0]),S.kupe.secs[2].drawers,S.kupe.secs[0].rod,S.kupe.ant,S.kupe.prof,S.kupe.type]));
S.mode="univ"; ["ширина 1200","5 ящиков","фасады эмаль"].forEach(c=>{ const r=editProject(c); console.log(">>",c,"|",r.msg.join(" | "),r.errs.join(" | ")); });
// помощник: вопросы, ручки, позиции, купе и изделие по шагам
var PAGE="calc", CUR=null, VIEWS={kitchen:[["elev",""],["plan",""],["3d",""]],kupe:[["in",""],["door",""],["3d",""],["top",""]],univ:[["3d",""]]};
S.mode="kitchen"; S.extras=[]; S.install=null;
["убери ручки","ручки рейлинг","ручки гола","угол глухой","без цоколя","замени все верхние на подъемники","добавь в расчет смеситель 15000","добавь позицию подъем на этаж 2 штуки по 3000","убери позицию смеситель","без монтажа","монтаж 40000","телефон 8 701 555 44 33","цена петли 1500","отмена"].forEach(c=>{ const r=editProject(c); console.log("K>>",c,"|",r.msg.join(" | "),(r.errs||[]).join(" | ")); });
console.log(S.kit.handles,S.decor,S.kit.PL,JSON.stringify(S.extras),S.install,S.phone,P.hinge);
["сколько стоит ЛДСП","какая цена на петли","прайс загружен","помощь"].forEach(c=>{ const r=editProject(c); console.log("Q>>",c,"|",r.msg.join(" | ")); });
S.mode="kupe"; S.kupe=kupeDefaults();
["добавь ящик во вторую секцию","добавь 2 ящика","убери полку из первой секции","добавь дверь","убери секцию","вторая дверь зеркало и лдсп","ширина второй секции 900","двери из двух частей","добавь штангу","без задней стенки","убери ручки"].forEach(c=>{ const r=editProject(c); console.log("C>>",c,"|",r.msg.join(" | "),(r.errs||[]).join(" | ")); });
S.mode="univ"; S.u.tpl="cab"; S.u.panels=[];
["добавь ящик","добавь ящик","убери двери","добавь полку","добавь фасад 400 на 700","без задней стенки"].forEach(c=>{ const r=editProject(c); console.log("U>>",c,"|",r.msg.join(" | "),(r.errs||[]).join(" | ")); });
