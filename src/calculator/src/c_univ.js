// ================= ШАБЛОНЫ "ЛЮБОЕ ИЗДЕЛИЕ" =================
function genCabinet(b,x0,p){
  const body=p.body||"ldsp16", T=MAT(body).t, W=+p.W, H=+p.H, D=+p.D, PL=+p.plinth, S=+p.shelves, ND=+p.doors, NB=+p.drawers, fac=p.fac;
  const zo=p.back?3:0, ft=MAT(fac).t, Dk=D-((ND||NB)?ft:0)-zo, i0=b.ps.length;
  b.X("Боковина левая",x0,0,0,H,Dk,body); b.X("Боковина правая",x0+W-T,0,0,H,Dk,body);
  b.Y("Крыша",x0+T,H-T,0,W-2*T,Dk,body); b.Y("Дно",x0+T,PL,0,W-2*T,Dk,body);
  if(PL>0) b.Z("Цоколь",x0+T,0,Dk-60,W-2*T,PL,body,1);
  const DH = p.drawerH ? +p.drawerH : 180;
  for(let k=0;k<NB;k++){
    const y=PL+k*DH;
    b.Z(`Фасад ящика ${k+1}`,x0+1.5,y+1.5,Dk,W-3,DH-3,fac,undefined,{f:1,hd:"t"});
    const bx=x0+T+13, bw=W-2*T-26, bh=Math.max(60,DH-60), bd=Dk-60;
    b.X(`Ящик ${k+1}: бок`,bx,y+30,50,bh,bd,body); b.X(`Ящик ${k+1}: бок`,bx+bw-T,y+30,50,bh,bd,body);
    b.Z(`Ящик ${k+1}: перед`,bx+T,y+30,Dk-10-T,bw-2*T,bh,body,1); b.Z(`Ящик ${k+1}: зад`,bx+T,y+30,50,bw-2*T,bh,body,1);
    b.Y(`Ящик ${k+1}: дно`,bx,y+27,50,bw,bd,"dvp",0);
    b.H("kguide",1); b.H("handle",1);
  }
  const dTop=PL+NB*DH;
  if(NB && (S||ND) && dTop<H-T-50) b.Y("Полка над ящиками",x0+T,dTop,0,W-2*T,Dk,body);
  const z0=NB?dTop+T:PL+T, z1=H-T;
  for(let i=1;i<=S;i++) b.Y(`Полка ${i}`,x0+T,Math.round(z0+(z1-z0)*i/(S+1)-T/2),0,W-2*T,Dk-20,body);
  if(ND && dTop<H-100){
    const ys=NB?dTop:0, dh=H-ys-3, dw=W/ND-3;
    for(let i=0;i<ND;i++) b.Z(`Дверь ${i+1}`,x0+i*W/ND+1.5,ys+1.5,Dk,dw,dh,fac,undefined,{f:1,hd:i%2?"vm-l":"vm-r"});
    b.H("hinge",ND*hingesFor(dh)); b.H("handle",ND);
  }
  for(let i=i0;i<b.ps.length;i++) b.ps[i].z+=zo;
  if(p.back) b.Z("Задняя стенка",x0,PL,0,W,H-PL,"dvp",0);
  b.H("leg",4);
}
function genShelf(b,p){
  const T=16, W=+p.W, H=+p.H, n=Math.max(1,+p.sections), S=+p.shelves, PL=+p.plinth, zo=p.back?3:0, D=+p.D-zo;
  b.X("Боковина левая",0,0,0,H,D); b.X("Боковина правая",W-T,0,0,H,D);
  b.Y("Крыша",T,H-T,0,W-2*T,D); b.Y("Дно",T,PL,0,W-2*T,D);
  if(PL>0) b.Z("Цоколь",T,0,D-60,W-2*T,PL,"ldsp16",1);
  const sw=(W-2*T-(n-1)*T)/n;
  for(let i=1;i<n;i++) b.X(`Перегородка ${i}`,T+i*(sw+T)-T,PL+T,0,H-PL-2*T,D);
  for(let i=0;i<n;i++) for(let j=1;j<=S;j++) b.Y(`Полка ${i+1}.${j}`,T+i*(sw+T),Math.round(PL+T+(H-PL-2*T)*j/(S+1)-T/2),0,sw,D-20);
  b.ps.forEach(q=>q.z+=zo);
  if(p.back) b.Z("Задняя стенка",0,PL,0,W,H-PL,"dvp",0);
  b.H("leg",4);
}
function genBed(b,p){
  const T=16, MW=+p.MW, ML=+p.ML, LH=+p.legH, RH=+p.railH, HH=+p.headH, W=MW+2*T;
  b.Z("Изголовье",0,0,0,W,HH,"ldsp16",4);
  b.X("Царга левая",0,LH,T,RH,ML,"ldsp16",2); b.X("Царга правая",W-T,LH,T,RH,ML,"ldsp16",2);
  b.Z("Изножье",0,0,T+ML,W,LH+RH,"ldsp16",4);
  if(MW>1200) b.X("Центральная балка",W/2-T/2,LH,T,RH-40,ML,"ldsp16",0);
  if(p.base==="ldsp") b.Y("Днище",T,LH+RH-60,T,MW,ML,"ldsp16",0); else b.H("lamels",1);
  b.H("leg",MW>1200?6:4,"Опоры кровати");
  if(p.lift) b.H("bedlift",1);
}
function genHall(b,p){
  const T=16, W=+p.W, H=+p.H, D=+p.D, CW=+p.cw, PL=+p.plinth, fac=p.fac;
  genCabinet(b,0,{W:CW,H,D,plinth:PL,shelves:4,doors:CW>500?2:1,drawers:0,back:true,fac});
  const Dk=D-MAT(fac).t-3, ow=W-CW-T, i0=b.ps.length;
  if(ow<=100) return;
  b.X("Боковина открытой части",W-T,0,0,H,Dk);
  b.Y("Крыша открытой части",CW,H-T,0,ow,Dk);
  b.Y("Полка для шапок",CW,H-350,0,ow,Dk);
  b.Z("Панель для крючков",CW,900,0,ow,H-350-900,"ldsp16",4);
  b.Y("Сиденье",CW,450,0,ow,Dk);
  b.Y("Полка для обуви",CW,150,0,ow,Dk-40);
  b.Y("Дно открытой части",CW,PL,0,ow,Dk);
  if(PL>0) b.Z("Цоколь открытой части",CW,0,Dk-60,ow,PL,"ldsp16",1);
  for(let i=i0;i<b.ps.length;i++) b.ps[i].z+=3;
  b.H("hook",Math.max(1,Math.floor(ow/150)));
}
function genTable(b,p){
  const T=16, W=+p.W, D=+p.D, H=+p.H, tm=p.topMat, tt=MAT(tm).t;
  b.X("Опора левая",0,0,25,H-tt,D-50); b.X("Опора правая",W-T,0,25,H-tt,D-50);
  b.Z("Царга",T,H-tt-300,60,W-2*T,300,"ldsp16",1);
  b.Y("Столешница",0,H-tt,0,W,D,tm,MAT(tm).kind==="sheet"?4:0);
  b.H("leg",4,"Подпятники");
}
const pN=(k,l,v)=>({k,l,v,t:"n"}), pC=(k,l,v)=>({k,l,v,t:"c"}), pS=(k,l,v,o)=>({k,l,v,t:"s",o});
const FAC_SEL = "fac";   // список фасадных материалов подставляется при отрисовке
const TPL = {
  cab:    {name:"Шкаф / тумба распашная", params:[pN("W","Ширина",800),pN("H","Высота",2000),pN("D","Глубина",500),pN("plinth","Цоколь",80),pN("shelves","Полок",4),pN("doors","Дверей",2),pN("drawers","Ящиков снизу",0),pN("drawerH","Высота ящика",180),pS("fac","Фасады","mdf",FAC_SEL),pC("back","Задняя стенка",true)], gen:(b,p)=>genCabinet(b,0,p)},
  tumba:  {name:"Тумба (ТВ, прикроватная)", params:[pN("W","Ширина",1600),pN("H","Высота",500),pN("D","Глубина",420),pN("plinth","Цоколь",60),pN("shelves","Полок",0),pN("doors","Дверей",2),pN("drawers","Ящиков снизу",0),pN("drawerH","Высота ящика",180),pS("fac","Фасады","mdf",FAC_SEL),pC("back","Задняя стенка",true)], gen:(b,p)=>genCabinet(b,0,p)},
  dresser:{name:"Комод", params:[pN("W","Ширина",900),pN("H","Высота",900),pN("D","Глубина",450),pN("plinth","Цоколь",80),pN("drawers","Ящиков",4),pS("fac","Фасады","mdf",FAC_SEL),pC("back","Задняя стенка",true)],
           gen:(b,p)=>genCabinet(b,0,Object.assign({},p,{shelves:0,doors:0,drawerH:Math.floor((+p.H-+p.plinth-16)/Math.max(1,+p.drawers))}))},
  shelf:  {name:"Стеллаж открытый", params:[pN("W","Ширина",1200),pN("H","Высота",2000),pN("D","Глубина",350),pN("plinth","Цоколь",60),pN("sections","Секций",2),pN("shelves","Полок в секции",4),pC("back","Задняя стенка",true)], gen:genShelf},
  bed:    {name:"Кровать", params:[pN("MW","Ширина матраса",1600),pN("ML","Длина матраса",2000),pN("legH","Высота ножек",100),pN("railH","Высота царги",250),pN("headH","Высота изголовья",1000),pS("base","Основание","lamels",{lamels:"Ламели",ldsp:"ЛДСП"}),pC("lift","Подъёмный механизм",false)], gen:genBed},
  hall:   {name:"Прихожая (шкаф + вешалка)", params:[pN("W","Общая ширина",1600),pN("H","Высота",2200),pN("D","Глубина",400),pN("cw","Ширина шкафа",800),pN("plinth","Цоколь",60),pS("fac","Фасады","mdf",FAC_SEL)], gen:genHall},
  table:  {name:"Стол", params:[pN("W","Ширина",1200),pN("D","Глубина",600),pN("H","Высота",750),pS("topMat","Столешница","ldsp16",{ldsp16:"ЛДСП 16",top38:"Столешница 38"})], gen:genTable},
  empty:  {name:"Пустое изделие (собрать вручную)", params:[], gen:()=>{}}
};
function tplDefaults(){ const r={}; for(const k in TPL){ r[k]={}; TPL[k].params.forEach(p=>r[k][p.k]=p.v); } return r; }
// собрать изделие по шаблону или из "моего модуля" (tpl = "cm:<id>")
function buildUniv(u){
  if(u.tpl.startsWith("cm:")){
    const cm=LIB.custom.find(x=>x.id===u.tpl.slice(3));
    if(!cm) return {parts:[],hw:[]};
    const pr=u.prms[u.tpl]||{W:cm.w,H:cm.h,D:cm.d};
    return {parts:roundParts(resizeModule(cm,+pr.W||cm.w,+pr.H||cm.h,+pr.D||cm.d)), hw:clone(cm.hw||[])};
  }
  const b=Builder(); TPL[u.tpl].gen(b,u.prms[u.tpl]);
  const hw=Object.values(b.hw);
  const real=b.ps.filter(p=>!MAT(p.mat).virt).length;
  if(real) hw.push({id:"umisc",name:hwName("umisc"),q:real});
  return {parts:roundParts(b.ps), hw};
}
function resizeModule(cm,W,H,D){
  let ps=cm.parts;
  ps=stretch(ps,"x",cm.w,W); ps=stretch(ps,"y",cm.h,H); ps=stretch(ps,"z",cm.d,D);
  return ps;
}
