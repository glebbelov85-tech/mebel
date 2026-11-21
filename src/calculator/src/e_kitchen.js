// ================= КУХНЯ: библиотека модулей и сборка =================
const WALL_NAMES = ["Основная стена","Правая стена","Левая стена"];
const LAYOUTS = {"1":{name:"Прямая (1 стена)",walls:[0],corners:[]}, "2R":{name:"Угловая, вторая стена справа",walls:[0,1],corners:["R"]},
  "2L":{name:"Угловая, вторая стена слева",walls:[2,0],corners:["L"]}, "3":{name:"П-образная (3 стены)",walls:[2,0,1],corners:["L","R"]}};
const HANDLES = {std:"ручки", gola:"профиль Gola", push:"без ручек (push-to-open)"};
const GUIDES = ["guide_r","guide","kguide","tbox"];      // от простых к дорогим
const STD_W = [150,200,300,400,450,500,600,700,800,900,1000];

// --- помощники для модулей. c - общие размеры кухни (см. kitCtx)
function kFac(b,c,name,x,y,w,h,z,hd){     // фасад в ячейке x..x+w, y..y+h; зазор делится пополам
  const g=c.gap;
  b.Z(name,x+g/2,y+g/2,z,w-g,h-g,c.fac,undefined,{f:1,hd:hd||""});
  if(hd){ if(c.hnd==="std") b.H("handle",1); else if(c.hnd==="push") b.H("push",1); }
}
function kDoors(b,c,x,y,w,h,z,opt){
  opt=opt||{}; const n=opt.n||(c.dn>0&&c.dn<=4?c.dn:0)||(w>500?2:1), side=opt.up?"vb":"vt";
  for(let i=0;i<n;i++) kFac(b,c,n>1?`Дверь ${i+1}`:"Дверь",x+i*w/n,y,w/n,h,z, h>1200?(i===0&&n>1?"vm-r":n>1?"vm-l":"vm-r") : side+(n>1?(i===0?"-r":"-l"):"-r"));
  b.H(c.hinge,n*hingesFor(h));
}
function kDrawer(b,c,x,y,w,h,D,name){
  const T=c.T, bz=3;
  kFac(b,c,`Фасад ящика${name||""}`,x,y,w,h,D,"t");
  const bx=x+T+13, bw=w-2*T-26, bh=clamp(Math.floor((h-70)/10)*10,60,200), bd=Math.floor((D-bz-10)/50)*50;
  b.X(`Ящик${name||""}: бок`,bx,y+25,bz+10,bh,bd,c.body); b.X(`Ящик${name||""}: бок`,bx+bw-T,y+25,bz+10,bh,bd,c.body);
  b.Z(`Ящик${name||""}: перед`,bx+T,y+25,bz+10+bd-T,bw-2*T,bh,c.body,1); b.Z(`Ящик${name||""}: зад`,bx+T,y+25,bz+10,bw-2*T,bh,c.body,1);
  b.Y(`Ящик${name||""}: дно`,bx,y+22,bz+10,bw,bd,"dvp",0);
  b.H(c.guide,1);
}
function kShelves(b,c,x,w,y0,y1,D,n){ for(let i=1;i<=n;i++) b.Y(n>1?`Полка ${i}`:"Полка",x,Math.round(y0+(y1-y0)*i/(n+1)-c.T/2),3,w,D-3-20,c.body); if(n>0) b.H("shpin",4*n); }
function kPlinth(b,c,w){ b.Z("Цоколь",0,-c.PL,c.Dl-50,w,c.PL,"_plinth",0); c.acc.plinth+=w; }
function lowBody(b,c,w,o){
  o=o||{}; const T=c.T, D=c.Dl, H=c.Hl, bz=3;
  b.Y("Дно",0,0,bz,w,D-bz,c.body);
  b.X("Боковина",0,T,bz,H-T,D-bz,c.body); b.X("Боковина",w-T,T,bz,H-T,D-bz,c.body);
  b.Y("Царга",T,H-T,bz,w-2*T,100,c.body); b.Y("Царга",T,H-T,D-100,w-2*T,100,c.body);
  if(!o.noBack) b.Z("Задняя стенка",0,0,0,w,H,"dvp",0);
  if(o.sh) kShelves(b,c,T,w-2*T,T,H-T,D,o.sh);
  b.H("leg",w>=900?6:4); b.H("kmisc",1); kPlinth(b,c,w);
}
function tallBody(b,c,w,o){
  o=o||{}; const T=c.T, D=c.Dl, H=c.Ht, bz=3;
  b.X("Боковина",0,0,bz,H,D-bz,c.body); b.X("Боковина",w-T,0,bz,H,D-bz,c.body);
  b.Y("Дно",T,0,bz,w-2*T,D-bz,c.body); b.Y("Крыша",T,H-T,bz,w-2*T,D-bz,c.body);
  b.Z("Задняя стенка",0,0,0,w,Math.min(H,2740),"dvp",0);
  (o.fix||[]).forEach((y,i)=>b.Y(`Полка жёсткая ${i+1}`,T,y,bz,w-2*T,D-bz,c.body));
  b.H("leg",4); b.H("kmisc",1); kPlinth(b,c,w);
}
function upBody(b,c,w,H,o){
  o=o||{}; const T=c.T, D=c.Du, bz=3, y=o.y||0;
  b.X("Боковина",0,y,bz,H,D-bz,c.body); b.X("Боковина",w-T,y,bz,H,D-bz,c.body);
  b.Y("Дно",T,y,bz,w-2*T,D-bz,c.body); b.Y("Крыша",T,y+H-T,bz,w-2*T,D-bz,c.body);
  b.Z("Задняя стенка",0,y,0,w,H,"dvp",0);
  if(o.sh) kShelves(b,c,T,w-2*T,y+T,y+H-T,D,o.sh);
  b.H("kmisc",1);
}
function gola(c,mm){ if(c.hnd==="gola") c.acc.gola+=mm; }
// линия стыка фасадов пенала - по низу верхних шкафов
function tallSplit(c){ return clamp(c.Hl+c.topT+c.apronH, 600, c.Ht-300); }

// --- библиотека. cat: low - нижние, tall - пеналы, up - верхние. top - сверху идёт столешница
const MODLIB = {
  l_shelf: {cat:"low", name:"Шкаф с дверцами и полкой", w:600, top:1, gen(b,c,w){ lowBody(b,c,w,{sh:1}); kDoors(b,c,0,0,w,c.Hl,c.Dl); gola(c,w); }},
  l_sink:  {cat:"low", name:"Под мойку", w:800, top:1, sink:1, gen(b,c,w){ lowBody(b,c,w,{noBack:1}); kDoors(b,c,0,0,w,c.Hl,c.Dl); gola(c,w); }},
  l_dr3:   {cat:"low", name:"Ящики: 1 малый + 2 глубоких", w:600, top:1, drawers:1, gen(b,c,w){ lowBody(b,c,w); const H=c.Hl, h1=Math.round(H*0.4);
             kDrawer(b,c,0,0,w,h1,c.Dl," 1"); kDrawer(b,c,0,h1,w,h1,c.Dl," 2"); kDrawer(b,c,0,2*h1,w,H-2*h1,c.Dl," 3"); gola(c,2*w); }},
  l_dr2:   {cat:"low", name:"Ящики: 2 глубоких", w:800, top:1, drawers:1, gen(b,c,w){ lowBody(b,c,w); const h=c.Hl/2; kDrawer(b,c,0,0,w,h,c.Dl," 1"); kDrawer(b,c,0,h,w,h,c.Dl," 2"); gola(c,2*w); }},
  l_dr3b:  {cat:"low", name:"Ящики: 2 малых + 1 глубокий", w:600, top:1, drawers:1, gen(b,c,w){ lowBody(b,c,w); const H=c.Hl, h1=Math.round(H*0.25);
             kDrawer(b,c,0,0,w,H-2*h1,c.Dl," 1"); kDrawer(b,c,0,H-2*h1,w,h1,c.Dl," 2"); kDrawer(b,c,0,H-h1,w,h1,c.Dl," 3"); gola(c,2*w); }},
  l_dr4:   {cat:"low", name:"Ящики: 4 одинаковых", w:600, top:1, drawers:1, gen(b,c,w){ lowBody(b,c,w); const h=c.Hl/4; for(let i=0;i<4;i++) kDrawer(b,c,0,i*h,w,h,c.Dl," "+(i+1)); gola(c,2*w); }},
  l_drd:   {cat:"low", name:"Ящик сверху + дверцы", w:600, top:1, gen(b,c,w){ lowBody(b,c,w,{sh:1}); const h1=Math.round(c.Hl*0.2); kDoors(b,c,0,0,w,c.Hl-h1,c.Dl); kDrawer(b,c,0,c.Hl-h1,w,h1,c.Dl,""); gola(c,2*w); }},
  l_hob:   {cat:"low", name:"Под варочную панель", w:600, top:1, gen(b,c,w){ lowBody(b,c,w,{sh:1}); kDoors(b,c,0,0,w,c.Hl,c.Dl); gola(c,w); }},
  l_open:  {cat:"low", name:"Открытые полки (низ)", w:300, top:1, gen(b,c,w){ lowBody(b,c,w,{sh:2}); }},
  l_oven:  {cat:"low", name:"Под духовку", w:600, top:1, gen(b,c,w){ lowBody(b,c,w,{noBack:1}); const fh=c.Hl-600;
             if(fh>=100){ kDrawer(b,c,0,0,w,fh,c.Dl,""); gola(c,w); } else if(fh>20) kFac(b,c,"Планка под духовкой",0,0,w,fh,c.Dl);
             if(fh>=30) b.Y("Полка под духовку",c.T,fh-c.T,3,w-2*c.T,c.Dl-3,c.body);
             b.Z("Духовка",3,Math.max(0,fh)+2,c.Dl-2,w-6,596,"_appl",0,{t:22,f:1}); }},
  l_dish:  {cat:"low", name:"Посудомойка (только фасад)", w:600, top:1, gen(b,c,w){ kFac(b,c,"Фасад посудомойки",0,0,w,c.Hl,c.Dl,"t"); gola(c,w);
             b.Z("Посудомоечная машина",5,0,60,w-10,c.Hl-5,"_appl",0,{t:c.Dl-70}); kPlinth(b,c,w); }},
  l_bottle:{cat:"low", name:"Бутылочница (карго)", w:200, top:1, gen(b,c,w){ lowBody(b,c,w); kFac(b,c,"Фасад бутылочницы",0,0,w,c.Hl,c.Dl,"t"); b.H("cargo",1); gola(c,w); }},
  l_fill:  {cat:"low", name:"Заглушка (планка)", w:50, top:1, gen(b,c,w){ kFac(b,c,"Заглушка нижняя",0,0,w,c.Hl,c.Dl); kPlinth(b,c,w); }},
  l_gap:   {cat:"low", name:"Проём (плита, холодильник)", w:600, gap:1, gen(){ }},
  t_shelf: {cat:"tall", name:"Пенал с полками", w:600, tall:1, gen(b,c,w){ const s=tallSplit(c); tallBody(b,c,w,{fix:[s-c.T/2]});
             kShelves(b,c,c.T,w-2*c.T,c.T,s-c.T/2,c.Dl,2); kShelves(b,c,c.T,w-2*c.T,s+c.T/2,c.Ht-c.T,c.Dl,c.Ht-s>600?1:0);
             kDoors(b,c,0,0,w,s,c.Dl); kDoors(b,c,0,s,w,c.Ht-s,c.Dl,{up:1}); }},
  t_fridge:{cat:"tall", name:"Пенал под встроенный холодильник", w:600, tall:1, gen(b,c,w){ const s=tallSplit(c); tallBody(b,c,w,{fix:[Math.min(c.Ht-150,1790)]});
             kFac(b,c,"Фасад холодильника нижний",0,0,w,s,c.Dl,"vt-r"); kFac(b,c,"Фасад холодильника верхний",0,s,w,c.Ht-s,c.Dl,"vb-r");
             b.Z("Холодильник",c.T+2,c.T+60,40,w-2*c.T-4,Math.min(c.Ht-200,1770)-c.T-60,"_appl",0,{t:c.Dl-45}); }},
  t_oven:  {cat:"tall", name:"Пенал: духовка + СВЧ", w:600, tall:1, gen(b,c,w){ const H=c.Hl, y1=H, y2=H+600, y3=H+980;
             tallBody(b,c,w,{fix:[y1-c.T,y2,y3].filter(y=>y<c.Ht-100)});
             kDrawer(b,c,0,0,w,H/2,c.Dl," 1"); kDrawer(b,c,0,H/2,w,H/2,c.Dl," 2");
             b.Z("Духовка",3,y1+2,c.Dl-2,w-6,596,"_appl",0,{t:22,f:1}); b.Z("СВЧ",3,y2+c.T+2,c.Dl-2,w-6,360,"_appl",0,{t:22,f:1});
             if(c.Ht-y3-c.T>150) kDoors(b,c,0,y3+c.T,w,c.Ht-y3-c.T,c.Dl,{up:1,n:1}); }},
  u_shelf: {cat:"up", name:"Шкаф с полками", w:600, gen(b,c,w){ upBody(b,c,w,c.Hu,{sh:c.Hu>800?2:1}); kDoors(b,c,0,0,w,c.Hu,c.Du,{up:1}); }},
  u_dryer: {cat:"up", name:"С сушкой для посуды", w:800, gen(b,c,w){ upBody(b,c,w,c.Hu); b.H("dryer",1); kDoors(b,c,0,0,w,c.Hu,c.Du,{up:1}); }},
  u_lift:  {cat:"up", name:"С подъёмником", w:800, gen(b,c,w){ const two=c.Hu>600; upBody(b,c,w,c.Hu,{sh:two?1:0});
             if(two){ kFac(b,c,"Фасад подъёмный верхний",0,c.Hu/2,w,c.Hu/2,c.Du,"b"); kFac(b,c,"Фасад подъёмный нижний",0,0,w,c.Hu/2,c.Du,"b"); b.H("lift",2); }
             else { kFac(b,c,"Фасад подъёмный",0,0,w,c.Hu,c.Du,"b"); b.H("lift",1); } }},
  u_hood:  {cat:"up", name:"Над вытяжкой (короткий)", w:600, gen(b,c,w){ const h=Math.min(360,c.Hu), y=c.Hu-h; upBody(b,c,w,h,{y}); kFac(b,c,"Фасад над вытяжкой",0,y,w,h,c.Du,"b"); b.H("lift",1);
             b.Z("Вытяжка",w*0.1,y-120,60,w*0.8,120,"_metal",0,{t:c.Du-20}); }},
  u_open:  {cat:"up", name:"Открытая полка", w:400, gen(b,c,w){ upBody(b,c,w,c.Hu,{sh:1}); }},
  u_fill:  {cat:"up", name:"Заглушка (планка)", w:50, gen(b,c,w){ kFac(b,c,"Заглушка верхняя",0,0,w,c.Hu,c.Du); }},
  u_gap:   {cat:"up", name:"Пусто (окно, вытяжка)", w:600, gap:1, gen(){ }}
};
const OLD_MODS = {shelf:"l_shelf",sink:"l_sink",drawers3:"l_dr3",drawers2:"l_dr2",oven:"l_oven",dish:"l_dish",gap:"l_gap",tall:"t_shelf",fridge:"t_fridge",tallOven:"t_oven",
  u_shelf:"u_shelf",u_dryer:"u_dryer",u_lift:"u_lift",u_hood:"u_hood",u_open:"u_open",u_gap:"u_gap"};
const CAT_NAMES = {low:"Нижние", tall:"Пеналы", up:"Верхние"};
// библиотека пользователя: свои ширины стандартных модулей, скрытые модули и свои модули
let LIB = {w:{}, hidden:{}, custom:[]};
function loadLib(){ const s=LS.get("mk2_lib",null); if(s) LIB=Object.assign({w:{},hidden:{},custom:[]},s); }
function saveLib(){ LS.set("mk2_lib",LIB); }
function modDef(t){
  if(MODLIB[t]) return MODLIB[t];
  const cm=LIB.custom.find(x=>x.id===t);
  if(cm) return {cat:cm.cat, name:cm.name, w:cm.w, top:cm.cat==="low"?1:0, tall:cm.cat==="tall"?1:0, custom:cm,
    gen(b,c,w){ const yb=bounds(cm.parts).y0;
      stretch(cm.parts,"x",cm.w,w).forEach(p=>b.ps.push(Object.assign({},p,{y:p.y-yb})));
      (cm.hw||[]).forEach(h=>{ const k="c|"+h.name; b.hw[k]=b.hw[k]||Object.assign({},h,{q:0}); b.hw[k].q+=h.q; });
      if(cm.cat!=="up") c.acc.plinth+=w; }};
  return null;
}
function modDefW(t){ const d=modDef(t); return d ? (LIB.w[t]||d.w) : 600; }
function modsOf(cat,row){   // row: "lower" - нижние и пеналы, "upper" - верхние
  const r=[];
  Object.keys(MODLIB).forEach(t=>{ const d=MODLIB[t]; if(!LIB.hidden[t] && (row==="lower"?d.cat!=="up":d.cat==="up")) r.push(t); });
  LIB.custom.forEach(cm=>{ if(row==="lower"?cm.cat!=="up":cm.cat==="up") r.push(cm.id); });
  return r;
}

// --- угловые модули. Строятся для левого угла: плечо A идёт вдоль основной стены (X), плечо B - вдоль боковой (Z)
const CORNER_LOW = {L:"Г-образный (2 фасада)", blindA:"Глухой, корпус вдоль основной стены", blindB:"Глухой, корпус вдоль боковой стены", none:"Без углового: основная стена до угла"};
const CORNER_UP  = {L:"Г-образный (2 фасада)", none:"Без углового: основная стена до угла"};
function cornerSize(cr,c,up){   // сколько занимает угол на основной стене (A) и на боковой (B)
  const D=up?c.Du:c.Dl, dead=up?D+c.ft+2:c.TD, min=D+c.ft+150;
  if(cr.t==="L") return {A:Math.max(min,+cr.A||0), B:Math.max(min,+cr.B||0)};
  if(cr.t==="blindA") return {A:Math.max(dead+250,+cr.A||0), B:dead};
  if(cr.t==="blindB") return {A:dead, B:Math.max(dead+250,+cr.B||0)};
  return {A:0, B:dead};
}
function genCornerL(b,c,A,B,up){
  const T=c.T, D=up?c.Du:c.Dl, H=up?c.Hu:c.Hl, bz=3, ft=c.ft, g=c.gap, e=up?T:0, sy=up?0:T;
  const hor=(name,y,ins)=>{ b.Y(name+" (плечо A)",bz,y,bz,A-bz-e,D-bz-ins,c.body); b.Y(name+" (плечо B)",bz,y,D-ins,D-bz-ins,B-D-e+ins,c.body); };
  hor("Дно углового",0,0);
  if(up) hor("Крыша углового",H-T,0);
  b.X("Боковина угловая",A-T,sy,bz,H-sy,D-bz,c.body);
  b.Z("Боковина угловая",bz,sy,B-T,D-bz,H-sy,c.body,1);
  if(!up){
    b.Y("Царга угловая",D,H-T,D-100,A-T-D,100,c.body); b.Y("Царга угловая",D-100,H-T,D,100,B-T-D,c.body);
    b.Y("Царга угловая",bz,H-T,bz,A-T-bz,100,c.body); b.Y("Царга угловая",bz,H-T,bz+100,100,B-T-bz-100,c.body);
  }
  const ny=up&&H>800?2:1;
  for(let i=1;i<=ny;i++){ const y=Math.round(sy+(H-sy-(up?T:T))*i/(ny+1)); b.Y("Полка угловая (плечо A)",bz,y,bz,A-bz-T,D-bz-20,c.body); b.Y("Полка угловая (плечо B)",bz,y,D-20,D-bz-20,B-D-T+20,c.body); }
  b.Z("Задняя стенка угловая",0,0,0,A,H,"dvp",0);
  b.X("Задняя стенка угловая",0,0,bz,H,B-bz,"dvp",0);
  // два фасада во внутреннем углу
  b.Z("Дверь угловая A",D+ft+g/2,g/2,D,A-D-ft-g,H-g,c.fac,undefined,{f:1,hd:up?"vb-l":"vt-l"});
  b.X("Дверь угловая B",D,g/2,D+ft+g/2,H-g,B-D-ft-g,c.fac,facEdge(c.fac),{f:1});
  b.H(c.hinge,2*hingesFor(H),c.hinge==="hinge"?"Петли угловые":"Петли угловые без доводчика"); 
  if(c.hnd==="std") b.H("handle",1); else if(c.hnd==="push") b.H("push",1); else if(!up) c.acc.gola+=A+B-2*D;
  b.H("kmisc",1);
  if(!up){ b.H("leg",6); b.Z("Цоколь",D-50,-c.PL,D-50,A-D+50,c.PL,"_plinth",0); b.X("Цоколь",D-50,-c.PL,D-34,c.PL,B-D+34,"_plinth",0,{t:16}); c.acc.plinth+=A+B-2*D; }
}
function genCornerBlind(b,c,W){   // прямой корпус вдоль плеча A, часть фасада закрыта соседним рядом
  const z0=c.TD, pl=50;
  lowBody(b,c,W,{sh:1});
  b.Z("Планка глухого угла",z0,c.gap/2,c.Dl,pl,c.Hl-c.gap,c.fac,undefined,{f:1});
  kFac(b,c,"Дверь глухого угла",z0+pl,0,W-z0-pl,c.Hl,c.Dl,"vt-l"); b.H(c.hinge,2); gola(c,W-z0-pl);
}
function genCorner(c,cr,up){
  const b=Builder(), s=cornerSize(cr,c,up);
  if(cr.t==="L") genCornerL(b,c,s.A,s.B,up);
  else if(cr.t==="blindA" && !up) genCornerBlind(b,c,s.A);
  else if(cr.t==="blindB" && !up){ genCornerBlind(b,c,s.B); const ps=xform(b.ps,XF.swapXZ()); b.ps.length=0; ps.forEach(p=>b.ps.push(p)); }
  return b;
}

function kitDefaults(){
  return {layout:"2R", body:"ldsp16", fac:"mdf", top:"top38", handles:"std", Hl:720, Hu:720, Ht:2078, PL:100, Dl:560, Du:300, apronH:600, gap:3, TD:600, guides:"kguide", hinges:"hinge",
    cutSink:1, cutHob:1, apron:true, tplinth:true, led:false,
    walls:[
      {len:3300, lower:[{t:"l_dr3",w:400},{t:"l_sink",w:800},{t:"l_dish",w:600},{t:"l_oven",w:600}], upper:[{t:"u_shelf",w:400},{t:"u_dryer",w:800},{t:"u_shelf",w:600},{t:"u_hood",w:600},{t:"u_shelf",w:300}]},
      {len:2400, lower:[{t:"l_shelf",w:450},{t:"l_dr3",w:450},{t:"t_fridge",w:600}], upper:[{t:"u_lift",w:600},{t:"u_shelf",w:600}]},
      {len:1800, lower:[{t:"l_shelf",w:900}], upper:[{t:"u_open",w:400},{t:"u_shelf",w:800}]}],
    corners:{R:{low:{t:"L",A:900,B:900},up:{t:"L",A:600,B:600}}, L:{low:{t:"L",A:900,B:900},up:{t:"L",A:600,B:600}}}};
}
function kitCtx(K){
  const body=MATS[K.body]?K.body:"ldsp16", fac=MATS[K.fac]?K.fac:"mdf", top=MATS[K.top]?K.top:"top38";
  return {body, fac, top, T:MAT(body).t, ft:MAT(fac).t, topT:MAT(top).t, hnd:HANDLES[K.handles]?K.handles:"std", guide:GUIDES.includes(K.guides)&&PI[K.guides]?K.guides:"kguide", hinge:K.hinges==="hinge0"&&PI.hinge0?"hinge0":"hinge",
    Hl:clamp(+K.Hl||720,500,950), Hu:clamp(+K.Hu||720,300,1200), Ht:clamp(+K.Ht||2078,1400,2740), PL:clamp(+K.PL||0,0,200),
    Dl:clamp(+K.Dl||560,300,700), Du:clamp(+K.Du||300,200,450), apronH:clamp(+K.apronH||600,300,900), gap:clamp(+K.gap||0,0,8), TD:clamp(+K.TD||600,400,900),
    acc:{plinth:0,gola:0}};
}
// перевод из координат "вдоль стены" в общие координаты кухни
function wallXF(wi,L){
  if(wi===0) return [];
  if(wi===1) return [XF.swapXZ(), XF.mirrorX(L[0])];      // правая стена: смотрит влево, идёт от угла к себе
  return [XF.swapXZ(), XF.mirrorZ(L[2])];                  // левая стена: смотрит вправо, угол - в конце ряда
}
function mergeIv(iv){
  iv=iv.filter(a=>a[1]-a[0]>1).sort((a,b)=>a[0]-b[0]); const r=[];
  iv.forEach(a=>{ const l=r[r.length-1]; if(l && a[0]<=l[1]+1) l[1]=Math.max(l[1],a[1]); else r.push([a[0],a[1]]); });
  return r;
}
function genKitchen(K){
  const c=kitCtx(K), lay=LAYOUTS[K.layout]||LAYOUTS["1"], warns=[];
  const L=[0,1,2].map(i=>clamp(+K.walls[i].len||0,500,8000));
  const has={R:lay.corners.includes("R"), L:lay.corners.includes("L")};
  const cs={}; ["R","L"].forEach(s=>{ if(has[s]){ const cr=K.corners[s]; cs[s]={low:cornerSize(cr.low,c,false), up:cornerSize(cr.up,c,true)}; } });
  // свободные участки стен (между углами)
  const run=(wi,k)=>{
    if(wi===0) return [has.L?cs.L[k].A:0, L[0]-(has.R?cs.R[k].A:0)];
    if(wi===1) return [cs.R[k].B, L[1]];
    return [0, L[2]-cs.L[k].B];
  };
  const parts=[], hwL=[], walls=[], topIv={0:[],1:[],2:[]};
  const yLow=c.PL, yUp=c.PL+c.Hl+c.topT+c.apronH;
  let upMM=0, hasSink=false, modsN=0, lowN=0, tallN=0, upN=0;
  const place=(b,wi,s,y,key,wtag)=>{
    const ps=xform(b.ps.map(p=>Object.assign(p,{mod:key,w:wtag})),XF.move(s,y,0),...wallXF(wi,L));
    ps.forEach(p=>parts.push(p)); hwL.push(Object.values(b.hw));
  };
  lay.walls.forEach(wi=>{
    const wall=K.walls[wi], nm=WALL_NAMES[wi], [l0,l1]=run(wi,"low"), [u0,u1]=run(wi,"up");
    let s=l0; const talls=[], low=[], up=[];
    wall.lower.forEach((md,j)=>{
      const d=modDef(md.t); if(!d){ warns.push(`${nm}: модуль удалён из библиотеки - замените его.`); return; }
      const w=clamp(+md.w||0,20,1500), key=`${wi}l${j}`, b=Builder();
      c.dn=+md.dn||0; try{ d.gen(b,c,w); } finally{ c.dn=0; } place(b,wi,s,yLow,key,""+wi);
      low.push({s,w,t:md.t,key,name:d.name,tall:d.tall,gap:d.gap});
      if(d.tall){ talls.push([s,s+w]); tallN++; } else if(!d.gap && md.t!=="l_fill") lowN++;
      if(d.top) topIv[wi].push([s,s+w]);
      if(d.sink) hasSink=true;
      if(!d.gap) modsN++;
      if(d.cat==="low" && !d.drawers && md.t!=="l_fill" && w>1000) warns.push(`${nm}: "${d.name}" шириной ${w} мм - полки прогибаются, двери тяжёлые.`);
      if(d.drawers && w>1000) warns.push(`${nm}: ящики шириной ${w} мм - нужны усиленные направляющие.`);
      if(d.tall && (wi===0 ? (has.L&&s<l0+1)||(has.R&&s+w>l1-1) : wi===1 ? s<l0+1 : s+w>l1-1)) warns.push(`${nm}: пенал стоит вплотную к углу - дверь соседнего ряда может не открыться.`);
      s+=w;
    });
    const lowEnd=s;
    let us=u0;
    wall.upper.forEach((md,j)=>{
      const d=modDef(md.t); if(!d){ warns.push(`${nm}: модуль удалён из библиотеки - замените его.`); return; }
      const w=clamp(+md.w||0,20,1500), key=`${wi}u${j}`, b=Builder();
      let moved=true; while(moved){ moved=false; for(const [a,e] of talls){ if(us<e-0.5 && us+w>a+0.5){ us=e; moved=true; } } }
      c.dn=+md.dn||0; try{ d.gen(b,c,w); } finally{ c.dn=0; } place(b,wi,us,yUp,key,""+wi);
      up.push({s:us,w,t:md.t,key,name:d.name,gap:d.gap});
      if(!d.gap){ modsN++; if(md.t!=="u_fill") upN++; upMM+=w; }
      if(md.t==="u_lift" && w>1200) warns.push(`${nm}: подъёмный фасад шире 1200 мм - тяжело для механизма.`);
      us+=w;
    });
    // свободное место верхнего ряда - без пеналов, которые стоят дальше последнего верхнего шкафа
    const tallAhead=talls.reduce((q,[a,e])=>q+Math.max(0,Math.min(e,u1)-Math.max(a,us)),0);
    const freeL=l1-lowEnd, freeU=us>u1 ? u1-us : u1-us-tallAhead;
    if(freeL<-0.5) warns.push(`${nm}: нижний ряд не помещается, лишние ${fmt(-freeL)} мм.`);
    else if(freeL>=1) warns.push(`${nm}: внизу свободно ${fmt(freeL)} мм - добавьте модуль, проём или заглушку.`);
    if(freeU<-0.5) warns.push(`${nm}: верхний ряд (с обходом пеналов) не помещается, лишние ${fmt(-freeU)} мм.`);
    walls.push({wi,len:L[wi],low,up,l0,l1,u0,u1,lowEnd,upEnd:us,freeL,freeU});
  });
  // угловые модули
  ["L","R"].forEach(side=>{
    if(!has[side]) return;
    const cr=K.corners[side], wSide=side==="R"?1:2, tag="0"+wSide;
    [["low",false,yLow],["up",true,yUp]].forEach(([k,up,y])=>{
      if(cr[k].t==="none") return;
      const b=genCorner(c,cr[k],up);
      const ps=xform(b.ps.map(p=>Object.assign(p,{mod:"c"+side+k,w:tag})),XF.move(0,y,0),...(side==="R"?[XF.mirrorX(L[0])]:[]));
      ps.forEach(p=>parts.push(p)); hwL.push(Object.values(b.hw)); modsN++;
      if(up) upMM+=cs[side].up.A+cs[side].up.B-c.Du; 
    });
    const lo=cs[side].low;
    // столешница: квадрат угла всегда закрывает основная стена
    if(lo.A>0) topIv[0].push(side==="L"?[0,lo.A]:[L[0]-lo.A,L[0]]);
    if(lo.B>c.TD) topIv[wSide].push(side==="R"?[c.TD,lo.B]:[L[2]-lo.B,L[2]-c.TD]);
    if(cr.low.t.startsWith("blind")){ const dw=(cr.low.t==="blindA"?lo.A:lo.B)-c.TD-50; if(dw<300) warns.push(`Глухой угол: дверь всего ${fmt(dw)} мм - сделайте корпус длиннее (обычно 1000-1100 мм).`); }
  });
  // столешница, фартук
  let topMM=0, joints=0; const topPieces=[];
  lay.walls.forEach(wi=>{
    const iv=mergeIv(topIv[wi]);
    iv.forEach(([a,e],q)=>{
      const b=Builder();
      b.Y(`Столешница (${WALL_NAMES[wi].toLowerCase()}${iv.length>1?", часть "+(q+1):""})`,a,yLow+c.Hl,0,e-a,c.TD,c.top,0);
      if(K.apron) b.Z("Фартук",a,yLow+c.Hl+c.topT,0,e-a,c.apronH,"_apron",0);
      place(b,wi,0,0,"top"+wi,""+wi);
      topMM+=e-a; topPieces.push({wi,a,e});
    });
  });
  ["L","R"].forEach(side=>{
    if(!has[side]) return;
    const wSide=side==="R"?1:2, m0=mergeIv(topIv[0]), m1=mergeIv(topIv[wSide]);
    const at0 = side==="R" ? m0.some(v=>v[1]>=L[0]-1) : m0.some(v=>v[0]<=1);
    const at1 = side==="R" ? m1.some(v=>v[0]<=c.TD+1) : m1.some(v=>v[1]>=L[2]-c.TD-1);
    if(at0 && at1) joints++;
    else if(at1 && !at0) warns.push(`Угол ${side==="R"?"справа":"слева"}: основная стена не доходит до угла столешницей - проверьте модули у угла.`);
  });
  const hw=mergeHw(...hwL), H=(id,q,name)=>{ if(q>0) hw.push({id,name:name||hwName(id),q}); };
  const m1=mm=>Math.ceil(mm/100-1e-9)/10;
  const topM=m1(topMM);
  H("plinth",m1(c.acc.plinth));
  if(c.hnd==="gola") H("gola",m1(c.acc.gola));
  const cuts=clamp(+K.cutSink||0,0,3)+clamp(+K.cutHob||0,0,3);
  if(topM){ H("cutout",cuts); H("topjoin",joints); if(K.apron) H("apron",topM); if(K.tplinth) H("tplinth",topM); }
  if(K.led && upMM){ H("led",m1(upMM),"Подсветка под верхними шкафами"); H("ledpow",1); }

  if(!hasSink) warns.push(`Нет модуля под мойку.`);
  if(c.PL+c.Ht>2650) warns.push(`Пенал ${fmt(c.PL+c.Ht)} мм с цоколем - проверьте высоту потолка и как его поднимать при сборке.`);
  if(tallN && Math.abs((c.PL+c.Ht)-(yUp+c.Hu))>2) warns.push(`Верх пенала (${fmt(c.PL+c.Ht)} мм от пола) не совпадает с верхом навесных шкафов (${fmt(yUp+c.Hu)} мм). Для ровной линии высота пенала - ${fmt(yUp+c.Hu-c.PL)} мм.`);
  warns.push(`Проёмы под технику берите по инструкции конкретной модели (духовка, ПММ, холодильник).`);

  const lens=lay.walls.map(wi=>L[wi]);
  const desc=`Кухня ${({"1":"прямая","2R":"угловая","2L":"угловая","3":"П-образная"})[K.layout]||""}, ${lens.join(" + ")} мм
Корпус: ${matName(c.body)}
Фасады: ${matName(c.fac)}, ${HANDLES[c.hnd]}
Модули: нижних ${lowN}, верхних ${upN}${tallN?", пеналов "+tallN:""}${lay.corners.length?", угловых "+lay.corners.reduce((n,s)=>n+(K.corners[s].low.t!=="none")+(K.corners[s].up.t!=="none"),0):""}
Столешница: ${matName(c.top)}, ${topM} п.м.${K.apron?"\nСтеновая панель":""}${K.led?"\nПодсветка под верхними шкафами":""}
Фурнитура: ${c.hinge==="hinge0"?"петли без доводчика":"петли с доводчиком"}${hw.some(h=>GUIDES.includes(h.id))?", ящики: "+hwName(c.guide).toLowerCase():""}${hw.some(h=>h.id==="lift")?", подъёмные механизмы":""}
Техника, мойка и смеситель в стоимость не входят`;
  return {parts:roundParts(parts), hw, warns, desc, title:`Кухня ${lens.join("+")}`, info:{c,L,walls,cs,has,topM,topPieces,joints,yUp,lay,lowRunMM:topMM+walls.reduce((s,w)=>s+w.low.filter(m=>m.tall).reduce((a,m)=>a+m.w,0),0)}};
}
// размеры фасада: [высота, ширина]
function facHW(p){ return p.o==="X" ? [p.a,p.b] : [p.b,p.a]; }
function facadeList(parts,fac){
  const g={};
  parts.forEach(p=>{ if(p.f && p.mat===fac){ const [h,w]=facHW(p).map(Math.round), k=h+"×"+w; g[k]=g[k]||{h,w,q:0}; g[k].q++; } });
  return Object.values(g).sort((a,b)=>b.h-a.h||b.w-a.w);
}

// подогнать длину основной стены под модули (при смене планировки)
function kitFitMain(K){
  const c=kitCtx(K), lay=LAYOUTS[K.layout]||LAYOUTS["1"];
  let need=K.walls[0].lower.reduce((a,m)=>a+(+m.w||0),0);
  lay.corners.forEach(s=>need+=cornerSize(K.corners[s].low,c,false).A);
  K.walls[0].len=need;
}
