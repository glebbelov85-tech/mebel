// ================= ЗАПУСК =================
function initEvents(){
  $("modeBar").addEventListener("click",e=>{ const b=e.target.closest("[data-mode]"); if(b) setMode(b.dataset.mode); });
  document.addEventListener("click",e=>{ const g=e.target.closest("[data-go]"); if(g) setMode(g.dataset.go); });
  $("fitAllBtn").addEventListener("click",fitAll);
  $("itemAdd").addEventListener("click",itemAdd);
  if(LS.get("mk2_mini_off",false)){ $("mini").classList.add("off"); $("miniToggle").textContent="Эскиз"; }
  $("miniToggle").addEventListener("click",e=>{ e.stopPropagation(); const off=$("mini").classList.toggle("off"); LS.set("mk2_mini_off",off); $("miniToggle").textContent=off?"Эскиз":"Свернуть"; drawSketch(); });
  $("miniSvg").addEventListener("click",()=>$("sketchCard").scrollIntoView({behavior:"smooth",block:"start"}));
  $("itemsList").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; if(b.dataset.iedit) itemEdit(+b.dataset.iedit); else if(b.dataset.idel) itemDel(+b.dataset.idel); });
  $("walls").addEventListener("click",e=>{ const b=e.target.closest("[data-act]"); if(b) wallAct(...b.dataset.act.split(",")); });
  $("k_alignTall").onclick=()=>{ const c=kitCtx(S.kit); S.kit.Ht=c.Hl+c.topT+c.apronH+c.Hu; refreshBinds(); calc(); toast(`Высота пенала: ${S.kit.Ht} мм`); };
  $("doorsSame").onclick=()=>{ const d=S.kupe.doors; for(let i=1;i<d.length;i++) d[i]=clone(d[0]); renderDoors(); calc(); };
  $("addExtra").onclick=()=>{ S.extras.push({name:"",q:1,p:0}); renderExtras(); calc(); const i=$("extras").querySelectorAll("input[data-f=name]"); if(i.length) i[i.length-1].focus(); };
  $("viewTabs").addEventListener("click",e=>{
    const b=e.target.closest("[data-v]");
    if(b){ S.view[S.mode]=b.dataset.v; renderViewTabs(); if(b.dataset.v==="3d"&&R3) R3.needFit=true; drawSketch(); LS.set("mk2_current",S); }
    if(e.target.id==="fit3d" && R3){ R3.needFit=true; fit3d(); }
  });
  $("viewTabs").addEventListener("input",e=>{ if(e.target.id==="hideFac"){ S.hideFac=e.target.checked; drawSketch(); } });
  $("sketch").addEventListener("click",e=>{ const r=e.target.closest("[data-i]"); if(r && +r.dataset.i>=0) selectPart(+r.dataset.i); });
  $("u_panels").addEventListener("click",panelsClick);
  $("u_tpl").addEventListener("input",e=>{ S.u.tpl=e.target.value; if(!S.u.manual) buildFromTpl(); else { renderUniv(); $("u_manual").classList.remove("hide"); } });
  $("u_rebuild").onclick=buildFromTpl;
  $("u_saveMod").onclick=saveAsModule;
  $("u_add").onclick=openAddPart;
  initPartMenu();
  $("u_addhw").onclick=()=>{ S.u.hw.push({name:"",q:1,p:0}); markManual(); renderHw(); calc(); };
  $("u_addhwSel").addEventListener("input",e=>{ const id=e.target.value; if(!id) return; S.u.hw.push({id,name:hwName(id),q:1}); e.target.value=""; markManual(); renderHw(); calc(); });
  $("copyClient").onclick=()=>copy(lastClient);
  $("copyParts").onclick=()=>copy(lastParts);
  $("xlsParts").onclick=partsXlsx;
  $("toUniv").onclick=toUniv;
  $("orderOut").onclick=exportOrder;
  $("save").onclick=saveCalc;
  $("newCalc").onclick=()=>confirmBox("Начать новый расчёт? Несохранённые изменения текущего пропадут.","Новый расчёт",()=>{ const m=S.mode; S=defaultState(); S.mode=m; PRICE_SHOWN=null; setMode(m); window.scrollTo({top:0}); });
  $("voiceBtn").innerHTML=MIC_SVG+" Голосом"; $("voiceBtn").style.display="none"; // одна кнопка - плавающая "Голосом" внизу справа
  if($("showBtn")) $("showBtn").style.marginLeft="auto"; $("voiceBtn").title="Опишите проект, правку или вопрос - голосом или текстом";
  const vOpen=()=>window.edOpen?window.edOpen():openVoice(); $("voiceBtn").onclick=vOpen; $("demoVoice").onclick=vOpen;
  if(typeof DEMO!=="undefined" && DEMO && !LS.get("mk2_demo_hidden",0)) $("demoBox").classList.remove("hide");
  $("demoX").onclick=()=>{ $("demoBox").classList.add("hide"); LS.set("mk2_demo_hidden",1); };
  $("mbarBtn").onclick=()=>{ if(priceState()!=="ok"){ showPrice(); return; } $("costCard").scrollIntoView({behavior:"smooth",block:"start"}); };
  $("calcBtn").onclick=()=>showPrice();
  $("costCalcBtn").onclick=()=>showPrice();
}
function start(){
  loadPrice(); loadLib();
  const cur=LS.get("mk2_current",null) || LS.get("kupe_current",null);
  const st=migrateState(cur); if(st) S=st;
  initBinds(); initEvents(); initPricePage(); initLibPage();
  renderSaved(); renderRegion();
  setMode(S.mode);
}
start();
