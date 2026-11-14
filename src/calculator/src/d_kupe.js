// ================= ШКАФ-КУПЕ: генератор деталей =================
const PROF = {eco:"эконом", std:"стандарт", prem:"премиум"};
const KUPE_TYPES = {korp:"корпусный", semi:"к одной стене", built:"встроенный"};
function kupeDefaults(){
  return {type:"korp", W:2400, H:2600, D:600, N:3, DH:180, ant:true, antH:450, back:true, led:false, M:3, prof:"std", body:"ldsp16",
    secs:[{shelves:4,rod:false,drawers:0,w:0},{shelves:1,rod:true,drawers:3,w:0},{shelves:5,rod:false,drawers:0,w:0},{shelves:3,rod:true,drawers:0,w:0},{shelves:4,rod:false,drawers:0,w:0},{shelves:4,rod:false,drawers:0,w:0}],
    doors:[{segs:["mirror"]},{segs:["ldsp10"]},{segs:["mirror"]},{segs:["ldsp10"]},{segs:["mirror"]},{segs:["ldsp10"]}]};
}
function genKupe(k){
  const b=Builder(), warns=[];
  const body=MATS[k.body]?k.body:"ldsp16", T=MAT(body).t, BASE=80, RAIL=100;
  const W=clamp(+k.W||0,800,6000), H=clamp(+k.H||0,1200,3000), D=clamp(+k.D||0,350,900);
  const n=clamp(+k.N||1,1,6), m=clamp(+k.M||2,2,6), DH=+k.DH||180, ANT=clamp(+k.antH||450,250,700);
  const sideL = k.type==="korp", sideR = k.type!=="built", roof = k.type!=="built";
  const bz = k.back?3:0, Dg=D-bz, Dk=Dg-RAIL;           // Dg - глубина корпуса, Dk - глубина начинки (за дверями)
  const x0 = sideL?T:0, inW = W-(sideL?T:0)-(sideR?T:0);
  const yB = BASE+T, yTop = H-(roof?T:0);                 // низ и верх внутреннего проёма
  const P_=(o,...a)=>b[o](...a);
  if(sideL) b.X("Боковина левая",0,0,bz,H,Dg,body);
  if(sideR) b.X("Боковина правая",W-T,0,bz,H,Dg,body);
  if(roof) b.Y("Крыша",x0,H-T,bz,inW,Dg,body);
  b.Y("Дно",x0,BASE,bz,inW,Dg,body);
  b.Z("Цоколь передний",x0,0,bz+Dg-T-20,inW,BASE,body,1);
  b.Z("Цоколь задний",x0,0,bz+40,inW,BASE,body,0);
  let secTop=yTop;
  if(k.ant){
    secTop=yTop-ANT-T;
    b.Y("Полка антресоли",x0,secTop,bz,inW,Dk,body);
    const ap=Math.max(0,Math.ceil(inW/1000)-1);
    for(let j=1;j<=ap;j++) b.X(`Перегородка антресоли ${j}`,x0+inW*j/(ap+1)-T/2,secTop+T,bz,ANT,Dk,body);
  }
  const partH=secTop-yB;
  // ширины секций: заданные вручную + остальное поровну
  const secs=k.secs.slice(0,n), free=inW-T*(n-1);
  let fixed=0, autoN=0; secs.forEach(s=>{ if(+s.w>0) fixed+=+s.w; else autoN++; });
  const autoW = autoN ? (free-fixed)/autoN : 0;
  const sw=secs.map(s=>+s.w>0?+s.w:autoW);
  if(autoN && autoW<150) warns.push(`Секции с заданной шириной не оставляют места остальным (выходит ${fmt(autoW)} мм). Уменьшите ширины.`);
  if(!autoN && Math.abs(fixed-free)>2) warns.push(`Ширины секций в сумме ${fmt(fixed)} мм, а внутри шкафа ${fmt(free)} мм. Оставьте одну секцию без ширины - она займёт остаток.`);
  let x=x0, drawersTotal=0, rodM=0;
  secs.forEach((s,i)=>{
    const w=Math.max(50,sw[i]), key="s"+i;
    if(i>0){ b.X(`Перегородка ${i}`,x-T,yB,bz,partH,Dk,body,1,{mod:key}); }
    let y=yB;
    const nd=clamp(+s.drawers||0,0,6), ns=clamp(+s.shelves||0,0,12);
    for(let d=0;d<nd;d++){
      b.Z(`Фасад ящика ${i+1}.${d+1}`,x+2,y+2,bz+Dk-T,w-4,DH-4,body,4,{mod:key,hd:"t"});
      const bx=x+13, bw=w-26, bh=clamp(DH-50,60,200), bd=Math.floor((Dk-T-20)/50)*50;
      b.X(`Ящик ${i+1}.${d+1}: бок`,bx,y+20,bz+10,bh,bd,body,1,{mod:key}); b.X(`Ящик ${i+1}.${d+1}: бок`,bx+bw-T,y+20,bz+10,bh,bd,body,1,{mod:key});
      b.Z(`Ящик ${i+1}.${d+1}: перед`,bx+T,y+20,bz+10+bd-T,bw-2*T,bh,body,1,{mod:key}); b.Z(`Ящик ${i+1}.${d+1}: зад`,bx+T,y+20,bz+10,bw-2*T,bh,body,1,{mod:key});
      b.Y(`Ящик ${i+1}.${d+1}: дно`,bx,y+17,bz+10,bw,bd,"dvp",0,{mod:key});
      b.H("guide",1); b.H("handle",1,"Ручки ящиков");
      y+=DH; drawersTotal++;
    }
    if(nd){ b.Y(`Полка над ящиками ${i+1}`,x,y,bz,w,Dk,body,1,{mod:key}); y+=T; }
    const zb=y, zt=secTop;
    if(s.rod){
      // полки сверху с шагом 300, под ними штанга
      for(let j=1;j<=ns;j++) b.Y(`Полка ${i+1}.${j}`,x,zt-j*300,bz,w,Dk-20,body,1,{mod:key});
      const ry=zt-ns*300-(ns?70:90);
      b.Y(`Штанга ${i+1}`,x,ry-12,bz+Dk/2-12,w,25,"_metal",0,{t:25,mod:key});
      rodM+=w/1000;
      const hang=ry-zb;
      if(hang<850) warns.push(`Секция ${i+1}: под штангой всего ${fmt(hang)} мм - одежда не поместится (нужно от 900 мм). Уберите полки или ящики.`);
    }else{
      for(let j=1;j<=ns;j++) b.Y(`Полка ${i+1}.${j}`,x,Math.round(zb+(zt-zb)*j/(ns+1)-T/2),bz,w,Dk-20,body,1,{mod:key});
      if(ns && (zt-zb)/(ns+1)<180) warns.push(`Секция ${i+1}: полки стоят слишком часто (шаг ${fmt((zt-zb)/(ns+1))} мм).`);
    }
    if(w>900 && (ns||nd)) warns.push(`Секция ${i+1} шириной ${fmt(w)} мм - полки шире 900 мм прогибаются. Добавьте секцию.`);
    if(w<300 && (nd||s.rod)) warns.push(`Секция ${i+1} узкая (${fmt(w)} мм) - ящики и штанга будут неудобны.`);
    x+=w+T;
  });
  if(k.back){   // задняя стенка из полос - лист ДВП уже шкафа
    const bx0=sideL?2:0, bw=W-bx0-(sideR?2:0), dv=MAT("dvp"), nb=Math.max(1,Math.ceil(bw/(Math.min(dv.sw,dv.sh)-10)));
    for(let j=0;j<nb;j++) b.Z(nb>1?`Задняя стенка ${j+1}`:"Задняя стенка",bx0+j*bw/nb,BASE,0,bw/nb,H-BASE-2,"dvp",0);
  }
  // двери: вставки в профиле, две колеи
  const hO=yTop-yB, doorW=(inW+25*(m-1))/m, doorH=hO-40;
  const dm=doorMats();
  for(let j=0;j<m;j++){
    const dr=k.doors[j]||{segs:["ldsp10"]}, segs=dr.segs.slice(0,3), ns=segs.length;
    const dx=x0+(m>1?j*(inW-doorW)/(m-1):0), track=j%2, fw=doorW-36, fh=(doorH-60-(ns-1)*4)/ns;
    segs.forEach((mat,q)=>{
      const mid=MATS[mat]?mat:(dm[0]||"ldsp10"), mt=MAT(mid).t;
      // q=0 - верхняя часть
      b.Z(`Дверь ${j+1}${ns>1?", часть "+(q+1):""}`,dx+18,yB+30+(ns-1-q)*(fh+4),bz+Dk+25+track*45+(10-mt)/2,fw,fh,mid,0,{f:1,mod:"d"+j});
    });
    b.Z(`Профиль двери ${j+1}`,dx,yB+2,bz+Dk+22+track*45,doorW,doorH,"_metal",0,{t:2,f:1,mod:"d"+j});
  }
  b.H("prof_"+(PROF[k.prof]?k.prof:"std"),m);
  if(rodM) b.H("rod",r1(rodM));
  if(k.led){ b.H("led",Math.ceil(inW/100)/10); b.H("ledpow",1); }
  b.H("misc",1);

  if(doorW>1100) warns.push(`Двери шириной ${fmt(doorW)} мм - тяжёлые и плохо катятся. Добавьте дверь.`);
  if(doorW<500) warns.push(`Двери узкие (${fmt(doorW)} мм) - лучше уменьшить количество дверей.`);
  if(H>2750) warns.push(`Высота ${fmt(H)} мм: боковина может не выйти из листа 2800 мм с учётом обрезки края листа.`);
  if(rodM && Dk<450) warns.push(`Глубина за дверями ${fmt(Dk)} мм - вешалки на обычной штанге не влезут. Нужна торцевая (выдвижная) штанга.`);
  if(k.type!=="korp") warns.push(`Шкаф с опорой на стены - размеры берите по замеру ниши в 3 точках (низ, середина, верх).`);
  if(m>n+1) warns.push(`Дверей больше, чем секций: стыки дверей будут перекрывать середину секций.`);

  const fill=secs.map((s,i)=>{
    const a=[]; if(s.rod)a.push("штанга"); if(+s.shelves)a.push(s.shelves+" полок"); if(+s.drawers)a.push(s.drawers+" ящ.");
    return `- секция ${i+1} (${fmt(sw[i])} мм): ${a.join(", ")||"пустая"}`;
  }).join("\n");
  const doorTxt=k.doors.slice(0,m).map(d=>d.segs.slice(0,3).map(s=>matName(s)).join("+")).join(" / ");
  const desc=`Шкаф-купе ${KUPE_TYPES[k.type]||""}, ${W}×${H}×${D} мм
Корпус: ${matName(body)}, кромка ПВХ
Двери: ${m} шт. (${doorTxt}), профиль ${PROF[k.prof]||""}
Наполнение:
${k.ant?"- антресоль на всю ширину\n":""}${fill}${k.led?"\n- LED-подсветка":""}`;
  return {parts:roundParts(b.ps), hw:Object.values(b.hw), warns, desc, title:`Шкаф-купе ${W}×${H}×${D}`,
    info:{W,H,D,sw,doorW:Math.round(doorW),doorH:Math.round(doorH),m,n}};
}
