// ================= ФОТО ЗАМЕРА =================
// Фото хранится в IndexedDB браузера (картинка уменьшена до 1600 px), разметка - в S.photos (сохраняется с расчётом).
// На фото отмечаются отрезки; один отрезок с известной длиной (эталон) задаёт масштаб, остальные считаются по нему.
// Любой отрезок можно отправить в проект: "основная стена", "ширина" и т.п. - через тот же разбор, что и голосовые правки.
const PH={db:null, url:{}};
function phDB(){
  if(PH.db) return Promise.resolve(PH.db);
  return new Promise((ok,no)=>{ if(!window.indexedDB) return no(new Error("no idb"));
    const r=indexedDB.open("mk2_photos",1);
    r.onupgradeneeded=()=>r.result.createObjectStore("img");
    r.onsuccess=()=>{ PH.db=r.result; ok(PH.db); }; r.onerror=()=>no(r.error); });
}
function phPut(id,blob){ return phDB().then(db=>new Promise((ok,no)=>{ const tx=db.transaction("img","readwrite"); tx.objectStore("img").put(blob,id); tx.oncomplete=ok; tx.onerror=()=>no(tx.error); })); }
function phGet(id){ if(PH.url[id]) return Promise.resolve(PH.url[id]);
  return phDB().then(db=>new Promise(ok=>{ const q=db.transaction("img").objectStore("img").get(id); q.onsuccess=()=>{ const b=q.result; if(b){ PH.url[id]=URL.createObjectURL(b); ok(PH.url[id]); } else ok(null); }; q.onerror=()=>ok(null); })); }
function phDel(id){ return phDB().then(db=>{ db.transaction("img","readwrite").objectStore("img").delete(id); }).catch(()=>{}); }
// уменьшить фото с телефона: 12 Мп -> 1600 px, JPEG
function phShrink(file){
  return new Promise((ok,no)=>{ const img=new Image(), u=URL.createObjectURL(file);
    img.onload=()=>{ const k=Math.min(1,1600/Math.max(img.width,img.height)), c=document.createElement("canvas");
      c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext("2d").drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u);
      c.toBlob(b=>b?ok({blob:b,w:c.width,h:c.height}):no(new Error("toBlob")),"image/jpeg",0.82); };
    img.onerror=()=>{ URL.revokeObjectURL(u); no(new Error("Не удалось открыть картинку")); }; img.src=u; });
}
const phList=()=>{ if(!Array.isArray(S.photos)) S.photos=[]; return S.photos; };
const phLen=(l,ph)=>Math.hypot((l.x2-l.x1)*ph.w,(l.y2-l.y1)*ph.h);          // длина в пикселях (координаты хранятся долями 0..1)
function phScale(ph){ const r=ph.lines.find(l=>l.ref&&l.mm>0); return r?r.mm/phLen(r,ph):null; }
function phMM(l,ph){ if(l.ref) return l.mm; const k=phScale(ph); return k?Math.round(phLen(l,ph)*k/5)*5:null; }
const PH_TARGETS={kitchen:[["","- куда -"],["основная стена","Основная стена"],["правая стена","Правая стена"],["левая стена","Левая стена"],["потолок","Потолок (высота)"]],
  kupe:[["","- куда -"],["ширина","Ширина"],["высота","Высота"],["глубина","Глубина"]],
  univ:[["","- куда -"],["ширина","Ширина"],["высота","Высота"],["глубина","Глубина"]]};
function phCard(){
  let card=$("photoCard");
  if(!card){ card=document.createElement("div"); card.className="card"; card.id="photoCard";
    const first=document.querySelector("#calcView > .col > .card"); first.insertAdjacentElement("afterend",card); }
  const list=phList();
  card.innerHTML=`<h2>Фото замера</h2>
    <p class="note" style="margin-top:0">Сфотографируйте стену или нишу, отметьте на фото известный размер (рулетку, дверь) - остальные размеры посчитаются по нему.</p>
    <div class="ph-grid">${list.map((p,i)=>`<button class="ph-th" data-ph="${i}" title="${esc(p.name||"")}"><img data-pid="${p.id}" alt=""><span>${p.lines.length?p.lines.length+" размер.":"не размечено"}</span></button>`).join("")}
    <label class="ph-add"><input type="file" accept="image/*" multiple id="phFile" hidden>+ Фото</label></div>`;
  card.querySelectorAll("img[data-pid]").forEach(im=>phGet(im.dataset.pid).then(u=>{ if(u) im.src=u; else im.closest(".ph-th").classList.add("ph-miss"); }));
  $("phFile").onchange=async e=>{
    const files=[...e.target.files]; e.target.value="";
    for(const f of files){ try{ const r=await phShrink(f), id="ph"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
        await phPut(id,r.blob); phList().push({id,name:f.name,w:r.w,h:r.h,lines:[]}); }
      catch(err){ toast("Не получилось сохранить фото: "+(err.message||err)); } }
    LS.set("mk2_current",S); phCard(); if(files.length===1) phEdit(phList().length-1);
  };
  card.querySelector(".ph-grid").onclick=e=>{ const b=e.target.closest("[data-ph]"); if(b) phEdit(+b.dataset.ph); };
}
function phEdit(i){
  const ph=phList()[i]; if(!ph) return;
  openModal("Размеры по фото",`
    <div class="ph-stage" id="phStage"><div class="ph-wrap"><img id="phImg" alt=""><canvas id="phCv"></canvas></div></div>
    <p class="note" id="phHint"></p>
    <div id="phLines"></div>
    <div class="btns"><button class="b2" id="phUndo">Убрать последний отрезок</button><button class="b2" id="phDelPh">Удалить фото</button><button class="b1" id="phDone">Готово</button></div>
    <details class="vo-help"><summary>Как снимать, чтобы размеры были точнее</summary><ul class="note">
      <li>Снимайте стену прямо, стоя напротив её середины, телефон держите вертикально и ровно.</li>
      <li>Эталон должен лежать на той же стене и примерно на той же высоте, что и измеряемое: рулетка, дверной проём, плитка известного размера.</li>
      <li>Точность - как замер на глаз (2-5%). Для изготовления окончательные размеры снимайте рулеткой.</li></ul></details>`,
  ()=>{
    const img=$("phImg"), cv=$("phCv"), ctx=cv.getContext("2d"); let pend=null, drag=null;
    phGet(ph.id).then(u=>{ if(!u){ $("phHint").textContent="Картинка этого фото не найдена в этом браузере (фото хранятся только на том устройстве, где добавлены)."; return; } img.src=u; });
    const size=()=>{ const r=img.getBoundingClientRect(); cv.width=r.width*devicePixelRatio; cv.height=r.height*devicePixelRatio; cv.style.width=r.width+"px"; cv.style.height=r.height+"px"; draw(); };
    img.onload=size; window.addEventListener("resize",size);
    const P=e=>{ const r=cv.getBoundingClientRect(); return {x:clamp((e.clientX-r.left)/r.width,0,1), y:clamp((e.clientY-r.top)/r.height,0,1)}; };
    const draw=()=>{ const W=cv.width, H=cv.height, d=devicePixelRatio; ctx.clearRect(0,0,W,H);
      ph.lines.forEach((l,k)=>{ const col=l.ref?"#e67e22":"#1f8a70";
        ctx.strokeStyle="#fff"; ctx.lineWidth=5*d; ctx.beginPath(); ctx.moveTo(l.x1*W,l.y1*H); ctx.lineTo(l.x2*W,l.y2*H); ctx.stroke();
        ctx.strokeStyle=col; ctx.lineWidth=2.5*d; ctx.stroke();
        [[l.x1,l.y1],[l.x2,l.y2]].forEach(([x,y])=>{ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x*W,y*H,5*d,0,7); ctx.fill(); });
        const mm=phMM(l,ph), t=(k+1)+(mm?": "+fmt(mm)+" мм":"");
        ctx.font=`600 ${13*d}px system-ui,sans-serif`; const tw=ctx.measureText(t).width, cx=(l.x1+l.x2)/2*W, cy=(l.y1+l.y2)/2*H-10*d;
        ctx.fillStyle="rgba(255,255,255,.92)"; ctx.fillRect(cx-tw/2-4*d,cy-13*d,tw+8*d,18*d); ctx.fillStyle=col; ctx.fillText(t,cx-tw/2,cy); });
      if(pend){ ctx.fillStyle="#1f8a70"; ctx.beginPath(); ctx.arc(pend.x*W,pend.y*H,6*devicePixelRatio,0,7); ctx.fill(); }
    };
    const hint=()=>{ $("phHint").textContent = pend ? "Теперь нажмите на второй конец отрезка." : !ph.lines.length ? "Нажмите на начало и конец известного размера (например, рулетки или двери) - это будет эталон." : !phScale(ph) ? "Впишите длину эталона в миллиметрах в строке 1." : "Отмечайте другие размеры двумя нажатиями. Концы отрезков можно перетаскивать."; };
    const save=()=>{ LS.set("mk2_current",S); };
    const renderLines=()=>{
      const tg=PH_TARGETS[S.mode]||[];
      $("phLines").innerHTML=ph.lines.length?`<table class="vo-t ph-t">${ph.lines.map((l,k)=>{ const mm=phMM(l,ph);
        return `<tr><td>${k+1}</td><td>${l.ref?`<input type="number" min="1" step="1" data-ref="${k}" value="${l.mm||""}" placeholder="длина, мм"> <span class="vo-src">эталон</span>`:`<b>${mm?fmt(mm)+" мм":"-"}</b> <button class="vo-link" data-mkref="${k}">сделать эталоном</button>`}</td>
          <td><input data-lbl="${k}" value="${esc(l.label||"")}" placeholder="подпись"></td>
          <td>${mm?`<select data-to="${k}">${tg.map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select>`:""}</td>
          <td><button class="bx" data-rm="${k}" title="Убрать">&times;</button></td></tr>`; }).join("")}</table>`:"";
      hint(); draw();
    };
    cv.addEventListener("pointerdown",e=>{ const p=P(e), r=cv.getBoundingClientRect(), tol=14/r.width;
      for(const l of ph.lines) for(const [a,b] of [["x1","y1"],["x2","y2"]]) if(Math.hypot((l[a]-p.x)*r.width,(l[b]-p.y)*r.height)<14){ drag={l,a,b}; cv.setPointerCapture(e.pointerId); return; }
      if(!pend){ pend=p; hint(); draw(); return; }
      if(Math.hypot((p.x-pend.x)*r.width,(p.y-pend.y)*r.height)<8) return;
      const l={x1:pend.x,y1:pend.y,x2:p.x,y2:p.y,label:""}; if(!phScale(ph)&&!ph.lines.some(x=>x.ref)){ l.ref=true; l.mm=0; }
      ph.lines.push(l); pend=null; save(); renderLines(); if(l.ref){ const inp=document.querySelector(`[data-ref="${ph.lines.length-1}"]`); if(inp) inp.focus(); } });
    cv.addEventListener("pointermove",e=>{ if(!drag) return; const p=P(e); drag.l[drag.a]=p.x; drag.l[drag.b]=p.y; draw(); });
    cv.addEventListener("pointerup",()=>{ if(drag){ drag=null; save(); renderLines(); } });
    $("phLines").addEventListener("input",e=>{ const t=e.target;
      if(t.dataset.ref!=null){ ph.lines[+t.dataset.ref].mm=+t.value||0; save(); draw(); document.querySelectorAll("#phLines tr").forEach((tr,k)=>{ if(!ph.lines[k].ref){ const b=tr.querySelector("b"), mm=phMM(ph.lines[k],ph); if(b) b.textContent=mm?fmt(mm)+" мм":"-"; } }); hint(); }
      if(t.dataset.lbl!=null){ ph.lines[+t.dataset.lbl].label=t.value; save(); } });
    $("phLines").addEventListener("change",e=>{ const t=e.target; if(t.dataset.to==null||!t.value) return;
      const l=ph.lines[+t.dataset.to], mm=phMM(l,ph); if(!mm) return;
      const r=editProject(`${t.value} ${mm} мм`);
      if(r.ok){ if(!l.label) l.label=t.selectedOptions[0].textContent; save(); edRefresh(); toast(r.msg.join(". ")); } else toast((r.errs||[]).join(". ")||"Не получилось применить");
      renderLines(); });
    $("phLines").addEventListener("click",e=>{ const rm=e.target.closest("[data-rm]"), mk=e.target.closest("[data-mkref]");
      if(rm){ ph.lines.splice(+rm.dataset.rm,1); if(!ph.lines.some(l=>l.ref)&&ph.lines[0]){ ph.lines[0].ref=true; ph.lines[0].mm=0; } save(); renderLines(); }
      if(mk){ const k=+mk.dataset.mkref, mm=phMM(ph.lines[k],ph); ph.lines.forEach(l=>{ if(l.ref){ l.ref=false; } }); ph.lines[k].ref=true; ph.lines[k].mm=mm||0; save(); renderLines(); } });
    $("phUndo").onclick=()=>{ if(pend){ pend=null; } else ph.lines.pop(); save(); renderLines(); };
    $("phDelPh").onclick=()=>confirmBox("Удалить это фото вместе с разметкой?","Удалить",()=>{ phDel(ph.id); phList().splice(i,1); save(); phCard(); });
    $("phDone").onclick=()=>{ closeModal(); phCard(); };
    $("modalX").addEventListener("click",()=>phCard());
    renderLines();
  },{wide:true});
}
if(typeof setMode==="function"){
  const _phSetMode=setMode;
  setMode=function(m){ _phSetMode(m); if(PAGE==="calc") phCard(); };
}
