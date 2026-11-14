const ph=[
 "угловая кухня основная стена три метра нет три с половиной вторая метр восемьдесят потолок два семьдесят посудомойка не нужна холодильник отдельно фасады белый глянец клиент Айгуль Сапарова телефон 8 701 123 45 67 скидка 5 процентов предоплата 50 срок 3 недели",
 "кухня не прямая а угловая, основная 3200, вторая 2 метра, угол слева, газовая плита отдельно, мойка 60, верхние с подъемниками, открытые полки, столешница на высоте 900, цоколь 120, два модуля с ящиками",
 "кухня 3 метра, верхние до потолка, потолок 2500",
 "кухня метр двадцать",
 "кухонный гарнитур вдоль одной стены длина три метра двадцать сантиметров, высота верхних девятьсот, фасады пластик серый, корпус белый, бутылочница",
 "шкаф в прихожую ширина 1200 высота 2200 глубина 400",
 "гардероб ширина 2 метра высота 2.5",
 "шкаф купе ширина 2400",
 "комод",
 "Кухня угловая. Основная стена 3,6 м. Вторая 1,8 м. Фасады эмаль, столешница камень, посудомойка 60, встроенный холодильник, духовка в пенале.",
];
const S0={kit:null,kupe:null,u:{prms:tplDefaults()},view:{}};
ph.forEach(p=>{ const r=parseSpeech(p); console.log("\n>>",p,"\n  norm:",vNorm(p).trim()); if(!r){console.log("  null");return;}
  console.log("  "+r.rows.filter(x=>x.src==="said").map(x=>x.label+"="+x.val).join(" | ")); console.log("  ASK:",r.asks.map(a=>a.label).join("; ")); if(r.warns.length) console.log("  WARN",r.warns); if(r.order) console.log("  order",JSON.stringify(r.order));
  if(r.mode){ r.apply(S0); if(r.mode==="kitchen"){ const g=genKitchen(S0.kit); console.log("  walls:",S0.kit.walls.map((w,i)=>g.info.lay.walls.includes(i)?`[${i}] L:`+w.lower.map(m=>m.t.slice(2)+m.w).join(",")+" U:"+w.upper.map(m=>m.t.slice(2)+m.w).join(","):"").filter(Boolean).join("\n         ")); console.log("  K:",S0.kit.Hl,S0.kit.Hu,S0.kit.PL,"genWarns:",g.warns.filter(x=>!/Проёмы/.test(x)), "overlap:",checkParts(g.parts,{overlap:1}).length); } } });
["отмена","Очистить всё","начать заново","собрать проект","стоп","удали последнюю фразу","очистить фасады"].forEach(c=>console.log("cmd",c,"->",voiceCmd(c)));
console.log(dropLastPhrase("Кухня, 3 метра, фасады эмаль"), "|", joinPhrase("","кухня угловая"), "|", joinPhrase("Кухня угловая","три метра"));
