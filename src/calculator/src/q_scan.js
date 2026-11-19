// ================= ЗАМЕР ИЗ PDF ИЛИ ФОТО =================
// Приложение пробует прочитать размеры само, но НИКОГДА не подставляет их молча:
// всегда показывает "Я понял замер так: ..." и ждёт "да" или поправку голосом.
// PDF с текстом читается надёжно. Скан и фото распознаются программой чтения текста (Tesseract) -
// печатные цифры она читает, рукописные часто нет. Сам замер остаётся на экране перед глазами.
const SCAN={busy:false};
// Разбор текста замера: числа -> предположение о стенах и потолке. Работает без экрана (проверяется в test/t7.js).
function zmScanParse(text){
  const t=" "+String(text||"").toLowerCase().replace(/ё/g,"е").replace(/[×хx*]/g," x ").replace(/\s+/g," ")+" ";
  const all=[], add=(v,i)=>{ v=Math.round(v); if(v>=30&&v<=8000) all.push({v,i}); };
  let m; const re=/(\d{1,2})[.,](\d{1,3})\s*(м(?![а-я])|m\b)?|(?<!\d)(\d)\s(\d{3})(?!\d)|(\d{2,4})\s*(мм|см|м(?![а-я])|mm|cm)?/g;
  while((m=re.exec(t))){
    if(m[1]!=null){ const f=parseFloat(m[1]+"."+m[2]); if(f>=0.3&&f<=8) add(f*1000,m.index); else if(m[3]) add(f*1000,m.index); }
    else if(m[4]!=null) add(+(m[4]+m[5]),m.index);
    else { const n=+m[6], u=m[7]||""; if(/^(см|cm)$/.test(u)) add(n*10,m.index); else if(/^(м|m)$/.test(u)&&n<=8) add(n*1000,m.index); else add(n,m.index); }
  }
  // если всё в сантиметрах (нет ни одного числа от 1000) - переводим
  if(all.length && !all.some(x=>x.v>=1000) && all.some(x=>x.v>=150)) all.forEach(x=>x.v*=10);
  const near=(rx,lo,hi)=>{ let mm; const r=new RegExp(rx.source,"g"); while((mm=r.exec(t))){ const c=all.filter(x=>x.i>=mm.index&&x.i-mm.index<40&&x.v>=lo&&x.v<=hi)[0]; if(c) return c; } return null; };
  const vals={}, used=new Set();
  const c=near(/потол|высот[аы] (помещ|комнат|потол)|h\s*=/,2200,3500); if(c){ vals.ceil=c.v; used.add(c); }
  [["len0",/основн[а-я]* стен|стена\s*(а|a|1)\b|длинн[а-я]* стен/],["len1",/(прав|лев|втор|боков)[а-я]* стен|стена\s*(б|b|2)\b|коротк[а-я]* стен/],["len2",/трет[а-я]* стен|стена\s*(в|c|3)\b/]].forEach(([k,rx])=>{ const x=near(rx,1000,8000); if(x&&!used.has(x)){ vals[k]=x.v; used.add(x); } });
  const walls=[...new Set(all.filter(x=>!used.has(x)&&x.v>=1200&&x.v<=7000).map(x=>x.v))].sort((a,b)=>b-a);
  if(!vals.len0 && walls.length) vals.len0=walls.shift();
  if(!vals.len1 && vals.len0){ const i=walls.findIndex(v=>v>=1500 && v!==vals.len0 && v!==vals.ceil && !(vals.ceil==null && v>=2400&&v<=2800&&walls.length===1)); if(i>=0 && /стен|угл|г-обр|п-обр/.test(t)) vals.len1=walls.splice(i,1)[0]; }
  const nums=[...new Set(all.map(x=>x.v))].filter(v=>v>=1000&&v!==vals.len0).sort((a,b)=>b-a).slice(0,8);
  return {vals, nums, found:all.length};
}
function scanLoad(urls,test){
  if(test()) return Promise.resolve(true);
  return urls.reduce((p,u)=>p.then(ok=>ok||new Promise(res=>{ const s=document.createElement("script"); s.src=u; s.onload=()=>res(!!test()); s.onerror=()=>{ s.remove(); res(false); }; document.head.appendChild(s); })),Promise.resolve(false));
}
function scanPdfLib(){
  return scanLoad(["../kp/lib/pdf.min.js","https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"],()=>window.pdfjsLib).then(ok=>{
    if(ok && !pdfjsLib.GlobalWorkerOptions.workerSrc){ const mine=[...document.scripts].some(s=>/kp\/lib\/pdf\.min\.js/.test(s.src)); pdfjsLib.GlobalWorkerOptions.workerSrc=mine?"../kp/lib/pdf.worker.min.js":"https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"; }
    return ok; });
}
function scanStatus(txt){ const d=$("zmDoc"); d.classList.remove("hide"); let s=d.querySelector(".zm-doc-st"); if(!s){ s=document.createElement("div"); s.className="zm-doc-st"; d.insertAdjacentElement("afterbegin",s); } s.textContent=txt||""; s.classList.toggle("hide",!txt); }
function scanShow(canvas,name){ const d=$("zmDoc"); d.classList.remove("hide"); d.innerHTML=`<div class="zm-doc-st"></div><details open><summary>Замер: ${esc(name||"файл")}</summary></details>`; canvas.title="Нажмите, чтобы увеличить"; canvas.onclick=()=>{ const w=openModal("Замер",`<div style="overflow:auto"></div>`,null,{wide:true}); const c=document.createElement("img"); c.src=canvas.toDataURL("image/jpeg",0.85); c.style.maxWidth="none"; c.style.width="100%"; const box=document.querySelector(".modal .box div[style]"); if(box) box.appendChild(c); }; d.querySelector("details").appendChild(canvas); }
function scanImgCanvas(file){
  return new Promise((ok,no)=>{ const img=new Image(), u=URL.createObjectURL(file);
    img.onload=()=>{ const k=Math.min(1,2200/Math.max(img.width,img.height)), c=document.createElement("canvas"); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext("2d").drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u); ok(c); };
    img.onerror=()=>{ URL.revokeObjectURL(u); no(new Error("Не удалось открыть картинку")); }; img.src=u; });
}
async function scanOcr(canvas){
  const ok=await scanLoad(["https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"],()=>window.Tesseract);
  if(!ok) throw new Error("нет связи с программой чтения текста");
  const w=await Tesseract.createWorker("eng",1,{logger:m=>{ if(m.status==="recognizing text") scanStatus("Читаю цифры: "+Math.round(m.progress*100)+"%"); else if(/load/.test(m.status)) scanStatus("Загружаю программу чтения (один раз, несколько мегабайт)..."); }});
  try{ await w.setParameters({tessedit_char_whitelist:"0123456789.,", tessedit_pageseg_mode:"11"}); const r=await w.recognize(canvas); return r.data.text||""; } finally{ try{ await w.terminate(); }catch(e){} }
}
async function zmScanFile(file){
  if(SCAN.busy) return; SCAN.busy=true;
  const isPdf=/pdf$/i.test(file.type)||/\.pdf$/i.test(file.name); let text="", canvas=null, how="";
  try{
    scanStatus("Открываю замер...");
    if(isPdf){
      if(!(await scanPdfLib())) throw new Error("не получилось загрузить программу чтения PDF - проверьте интернет");
      const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
      for(let i=1;i<=Math.min(pdf.numPages,5);i++){ const pg=await pdf.getPage(i);
        if(i===1){ const vp0=pg.getViewport({scale:1}), vp=pg.getViewport({scale:Math.min(3,2000/Math.max(vp0.width,vp0.height))}); canvas=document.createElement("canvas"); canvas.width=Math.round(vp.width); canvas.height=Math.round(vp.height); await pg.render({canvasContext:canvas.getContext("2d"),viewport:vp}).promise; }
        const tc=await pg.getTextContent(); text+=" "+tc.items.map(x=>x.str).join(" "); }
      how="pdf";
    } else canvas=await scanImgCanvas(file);
    scanShow(canvas,file.name);
    let P=zmScanParse(text);
    if(!P.vals.len0){ how="ocr"; try{ text=await scanOcr(canvas); P=zmScanParse(text); }catch(e){ P={vals:{},nums:[],found:0,err:e.message}; } }
    scanStatus("");
    if(P.vals.len0){
      zmS().sub={k:"scan",vals:P.vals,nums:P.nums}; SCAN.fresh=true;
      zmLog("zm-a",(how==="ocr"?"Прочитал цифры с картинки - мог ошибиться, проверьте.":"Прочитал размеры из PDF.")+" Замер оставил на экране.");
    } else zmLog("zm-err","Размеры прочитать не получилось"+(P.err?" ("+esc(P.err)+")":how==="ocr"?" - рукописные и мелкие цифры программа читает плохо":"")+". Замер оставил на экране - смотрите на него и называйте размеры голосом.");
  }catch(e){ scanStatus(""); zmLog("zm-err","Не получилось открыть файл: "+esc(e.message||String(e))+". Назовите размеры голосом."); }
  SCAN.busy=false; LS.set("mk2_current",S); zmRender();
  const a=zmAsk(); ZM.askKey=zmAskKey(); zmSpeak(a.q);
}
