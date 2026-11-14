const ph=[
 "Угловая кухня, основная длина 5 метров, меньшая длина 1,5 метра, высота верхних шкафов 900",
 "Угловая кухня, основная стена 3 метра 60, вторая стена 1,8 метра, верхние шкафы 900, фасады эмаль, встроенный холодильник, посудомойка 45, подсветка",
 "Прямая кухня 2 метра 80, профиль Gola, столешница камень, духовка в пенале",
 "П-образная кухня, основная 3,2 метра, левая 2 метра, правая 2,4 метра, без ручек",
 "кухня угловая три на два с половиной высота два сорок, угол слева",
 "кухня две тысячи четыреста, холодильник",
 "Шкаф-купе в нишу, ширина 2 метра 70, высота 2,6, глубина 60 см, три двери, зеркало по центру, 4 ящика, подсветка",
 "шкаф купе 2400 на 2600 на 600 две двери все зеркальные",
 "Комод ширина 1 метр, высота 90 см, глубина 45, пять ящиков",
 "Тумба под телевизор 1800 на 450 на 400, две двери",
 "кровать 160 на 200 с подъемным механизмом", "привет"];
const S0={kit:null,kupe:null,u:{prms:tplDefaults()},view:{}};
ph.forEach(p=>{ const r=parseSpeech(p); console.log("\n>>",p,"\n  norm:",vNorm(p).trim()); if(!r){console.log("  null");return;} console.log("  "+r.got.join("\n  ")); if(r.warns.length) console.log("  WARN",r.warns);
  if(r.mode){ r.apply(S0); if(r.mode==="kitchen"){ const g=genKitchen(S0.kit); console.log("  walls:",S0.kit.walls.map((w,i)=>g.info.lay.walls.includes(i)?`[${i}] L:`+w.lower.map(m=>m.t.slice(2)+m.w).join(",")+" U:"+w.upper.map(m=>m.t.slice(2)+m.w).join(","):"").filter(Boolean).join("\n         ")); console.log("  genWarns:",g.warns.filter(x=>!/Проёмы/.test(x)), "overlap:",checkParts(g.parts,{overlap:1}).length); }
    if(r.mode==="kupe"){ const g=genKupe(S0.kupe); console.log("  kupe warns",g.warns); }
    if(r.mode==="univ"){ const b=buildUniv({tpl:S0.u.tpl,prms:S0.u.prms}); console.log("  parts",b.parts.length); } } });
