// ================= СТРАНИЦА "ПРАЙС" =================
let PX = {q:"", g:"", open:null};
const NEW_MAT = {"Плиты":{...SHEET,t:16,css:"#d8c3a5",edge:"edge",cut:1}, "Фасады":{kind:"area",t:18,css:"#e8e2d8",facade:1}, "Стекло и зеркало":{kind:"area",t:4,css:"#b9d3df",facade:1}, "Столешницы":{kind:"length",t:38,css:"#8a6a4a"}};
const NEW_UNIT = {"Плиты":"лист","Фасады":"м²","Стекло и зеркало":"м²","Столешницы":"п.м.","Кромка":"м","Услуги":"¤"};
function priceChanged(it){ const d=defOf(it.id); return d && +d.v!==+it.v; }
function renderPricePage(){
  renderRegion();
  $("p_chips").innerHTML=[["","Все"]].concat(GROUPS.map(g=>[g,g])).map(([g,n])=>`<button data-g="${g}" class="${PX.g===g?"on":"off"}">${n}</button>`).join("");
  renderPriceTable();
}
function renderPriceTable(){
  const q=normTxt(PX.q); let h=`<tr><th>Название</th><th style="width:130px">Артикул</th><th style="width:92px">Ед.</th><th class="n" style="width:120px">Цена, ${esc(CS())}</th><th style="width:96px"></th></tr>`;
  GROUPS.forEach(g=>{
    if(PX.g && PX.g!==g) return;
    const items=PRICE.filter(it=>it.g===g && (!q || normTxt(it.name+" "+(it.sku||"")).includes(q)));
    if(!items.length && q) return;
    h+=`<tr class="g"><td colspan="5">${g}${g!=="Правила расчёта"?`<button class="b2" data-padd="${g}">+ позиция</button>`:""}</td></tr>`;
    items.forEach(it=>{
      const rule=g==="Правила расчёта";
      h+=`<tr data-id="${it.id}" class="${priceChanged(it)?"chg":""}">
        <td>${it.m?`<span class="dot" style="background:${it.m.css}"></span> `:""}<input data-f="name" value="${esc(it.name)}" ${rule?"disabled":""} style="width:${it.m?"calc(100% - 22px)":"100%"}"></td>
        <td>${rule?"":`<input data-f="sku" value="${esc(it.sku||"")}" placeholder="-">`}</td>
        <td>${rule?esc(unitLabel(it.u)):`<select data-f="u">${UNITS.map(u=>`<option value="${u}" ${u===it.u?"selected":""}>${esc(unitLabel(u))}</option>`).join("")}</select>`}</td>
        <td class="pv"><input type="number" min="0" data-f="v" value="${it.v}"></td>
        <td style="white-space:nowrap">${it.m||NEW_MAT[g]?`<button class="bx" data-pm="${it.id}" title="Свойства материала: лист, толщина, цвет">&#9881;</button>`:""}${priceChanged(it)?`<button class="bx" data-pr="${it.id}" title="Вернуть примерную цену ${money(defOf(it.id).v)}">&#8634;</button>`:""}${!it.sys?`<button class="bx" data-pd="${it.id}" title="Удалить">&times;</button>`:""}</td></tr>`;
      if(PX.open===it.id) h+=matPropsRow(it);
    });
  });
  $("p_table").innerHTML=h;
}
function matPropsRow(it){
  const m=it.m||{kind:""}, edges=PRICE.filter(x=>x.g==="Кромка");
  return `<tr class="mrow" data-id="${it.id}"><td colspan="5"><div class="mprops">
    <div><label>Как считается</label><select data-mf="kind"><option value="">не материал для деталей</option><option value="sheet" ${m.kind==="sheet"?"selected":""}>листами (плита)</option><option value="area" ${m.kind==="area"?"selected":""}>по площади, м²</option><option value="length" ${m.kind==="length"?"selected":""}>по длине, п.м.</option></select></div>
    ${m.kind?`<div><label>Короткое название</label><input data-f="s" value="${esc(it.s||"")}" placeholder="как в расчёте"></div>
    <div><label>Толщина, мм</label><input type="number" data-mf="t" value="${m.t||""}"></div>
    ${m.kind==="sheet"?`<div><label>Лист, длина</label><input type="number" data-mf="sw" value="${m.sw||""}"></div><div><label>Лист, ширина</label><input type="number" data-mf="sh" value="${m.sh||""}"></div>
    <div><label>Кромка</label><select data-mf="edge"><option value="">без кромки</option>${edges.map(e=>`<option value="${e.id}" ${m.edge===e.id?"selected":""}>${esc(e.s||e.name)}</option>`).join("")}</select></div>`:""}
    <div><label>Цвет на эскизе</label><input type="color" data-mf="css" value="${m.css||"#cccccc"}"></div>
    <label class="chk"><input type="checkbox" data-mf="facade" ${m.facade?"checked":""}>Годится на фасады</label>
    ${m.kind==="sheet"?`<label class="chk"><input type="checkbox" data-mf="cut" ${m.cut?"checked":""}>Считать распил</label>`:""}`:""}
  </div></td></tr>`;
}
function initPricePage(){
  $("p_search").addEventListener("input",e=>{ PX.q=e.target.value; renderPriceTable(); });
  $("p_chips").addEventListener("click",e=>{ const b=e.target.closest("[data-g]"); if(b){ PX.g=b.dataset.g; renderPricePage(); } });
  const tb=$("p_table");
  tb.addEventListener("input",e=>{
    const t=e.target, tr=t.closest("tr[data-id]"); if(!tr) return;
    const it=PI[tr.dataset.id]; if(!it) return;
    if(t.dataset.f){ const f=t.dataset.f; it[f]= f==="v" ? Math.max(0,+t.value||0) : t.value; if(f==="v"){ it.upd=today(); tr.classList.toggle("chg",priceChanged(it)); } savePrice(); }
    else if(t.dataset.mf){
      const f=t.dataset.mf;
      if(f==="kind"){ if(!t.value) delete it.m; else it.m=Object.assign({},NEW_MAT[it.g]||{},it.m||{},{kind:t.value,t:(it.m&&it.m.t)||16,css:(it.m&&it.m.css)||"#d8c3a5"}, t.value==="sheet"?{sw:(it.m&&it.m.sw)||2800,sh:(it.m&&it.m.sh)||2070}:{}); savePrice(); renderPriceTable(); return; }
      if(f==="facade"||f==="cut"){ if(t.checked) it.m[f]=1; else delete it.m[f]; }
      else if(f==="css"||f==="edge") it.m[f]=t.value;
      else it.m[f]=Math.max(0,+t.value||0);
      savePrice();
      if(f==="css"){ const d=tb.querySelector(`tr[data-id="${it.id}"] .dot`); if(d) d.style.background=t.value; }
    }
  });
  tb.addEventListener("click",e=>{
    const t=e.target.closest("button"); if(!t) return;
    if(t.dataset.padd) addPriceItem(t.dataset.padd);
    else if(t.dataset.pm){ PX.open = PX.open===t.dataset.pm ? null : t.dataset.pm; renderPriceTable(); }
    else if(t.dataset.pr){ const it=PI[t.dataset.pr]; it.v=defOf(it.id).v; savePrice(); renderPriceTable(); }
    else if(t.dataset.pd){ const it=PI[t.dataset.pd]; confirmBox(`Удалить позицию "${it.name}"?`,"Удалить",()=>{ PRICE=PRICE.filter(x=>x.id!==it.id); savePrice(); renderPriceTable(); }); }
  });
  $("p_add").onclick=()=>addPriceItem(PX.g && PX.g!=="Правила расчёта" ? PX.g : "Фурнитура");
  $("p_import").onclick=openImport;
  $("p_export").onclick=exportPrice;
  $("p_exportFile").onclick=exportPriceFile;
  initRegion();
  $("p_reset").onclick=()=>confirmBox("Вернуть примерные цены у всех стандартных позиций? Свои позиции останутся.","Вернуть",()=>{ PRICE.forEach(it=>{ const d=defOf(it.id); if(d) it.v=d.v; }); savePrice(); renderPriceTable(); toast("Цены возвращены"); });
  $("bk_save").onclick=backupSave;
  $("bk_load").onclick=()=>$("bk_file").click();
  $("bk_file").addEventListener("change",e=>{ const f=e.target.files[0]; if(f) f.text().then(backupLoad); e.target.value=""; });
}
function addPriceItem(g,init){
  const it=Object.assign({id:uid("c_"),g,name:"Новая позиция",u:NEW_UNIT[g]||"шт.",v:0,sku:""},init||{});
  if(NEW_MAT[g] && !it.m) it.m=clone(NEW_MAT[g]);
  // вставить в конец своей группы
  let idx=-1; PRICE.forEach((x,i)=>{ if(x.g===g) idx=i; });
  PRICE.splice(idx<0?PRICE.length:idx+1,0,it); savePrice();
  if(!init){ PX.g = PX.g && PX.g!==g ? g : PX.g; PX.q=""; $("p_search").value=""; renderPricePage();
    const inp=$("p_table").querySelector(`tr[data-id="${it.id}"] input`); if(inp){ inp.focus(); inp.select(); inp.scrollIntoView({block:"center"}); } }
  return it;
}
function priceRows(){ return [["ID","Группа","Название","Артикул","Ед.","Цена, "+CURCODE]].concat(PRICE.map(it=>[it.id,it.g,it.name,it.sku||"",unitLabel(it.u),+it.v||0])); }
async function exportPrice(){
  const rows=priceRows();
  await saveTable(`moj-prajs-${CURCODE.toLowerCase()}.xlsx`,"Прайс",rows,[14,18,52,16,8,12]);
}
// Прайс файлом общего вида (*.mebel-price.json) - для обмена с коллегами и, позже, с прайсами магазинов.
function priceFileObj(){
  return {format:"mebel-price", version:"1.0", currency:CURCODE, country:COUNTRY, supplier:{name:PRICE_META.src||""}, date:PRICE_META.date||new Date().toISOString().slice(0,10),
    items:PRICE.filter(it=>it.g!=="Правила расчёта").map(it=>Object.assign({id:it.id, name:it.name, group:it.g, unit:unitLabel(it.u), price:+it.v||0}, it.sku?{sku:it.sku}:{}, it.m?{mat:it.m}:{}, it.s?{short:it.s}:{}))};
}
function exportPriceFile(){ const txt=JSON.stringify(priceFileObj(),null,1); saveFile(`prajs-${CURCODE.toLowerCase()}.mebel-price.json`,txt,txt); }
// Принять файл прайса: строки идут в обычную сверку цен (шаг 3), колонки уже известны.
function impPriceFile(d,fname){
  const items=Array.isArray(d.items)?d.items:[];
  if(!items.length){ toast("В файле прайса нет позиций"); return; }
  const cur=String(d.currency||"").toUpperCase();
  if(cur && cur!==CURCODE){ toast(`Прайс в валюте ${curInfo(cur).name.toLowerCase()} (${curInfo(cur).sign}), а сейчас выбраны ${curInfo().name.toLowerCase()}. Переключите валюту выше и загрузите снова.`); return; }
  IMP.rows=[["id","name","price","sku","unit"]].concat(items.map(x=>[x.id||"",x.name||"",+x.price||0,x.sku||"",x.unit||""]));
  IMP.name=(d.supplier&&d.supplier.name)||fname; IMP.hdr=0; IMP.cols={id:0,name:1,price:2,sku:3,unit:4}; IMP.k=1; IMP.meta={src:IMP.name,date:d.date||""};
  impBuild(); IMP.step=3; impRender();
}

// ================= СТРАНА И ВАЛЮТА ПРАЙСА =================
function curIn(c){ const i=curInfo(c); return i.inWord||i.name.toLowerCase(); }
function renderRegion(){
  const cs=MO?Object.values(MO.COUNTRIES):[{code:"KZ",name:"Казахстан"}];
  $("rg_country").innerHTML=cs.map(c=>`<option value="${c.code}" ${c.code===COUNTRY?"selected":""}>${esc(c.name)}</option>`).join("");
  $("rg_cur").innerHTML=curList().map(c=>`<option value="${c.code}" ${c.code===CURCODE?"selected":""}>${esc(c.name)}, ${esc(c.sign)}</option>`).join("");
  $("rg_src").value=PRICE_META.src||""; $("rg_date").value=PRICE_META.date||"";
  const others=curList().filter(c=>c.code!==CURCODE && hasPrice(c.code)).map(c=>curIn(c.code));
  const guessed=MO && !MO.region().set;
  $("rg_note").innerHTML=(guessed?`<b>Страна выбрана по часовому поясу этого устройства - проверьте.</b> `:"")+
    `Все цены и суммы калькулятора - в ${curIn()}. У каждой валюты свой прайс: при переключении цены не пересчитываются и не теряются${others.length?` (уже есть прайс в ${others.join(", ")})`:""}. `+
    (PRICE_META.starter?`<b>Сейчас это стартовые примерные цены - впишите свои или загрузите прайс поставщика.</b> `:"")+
    `Страна определяет договор и реквизиты в "КП и договор". Настройка общая для всех инструментов на этом устройстве.`;
  $("hdrSub").textContent=`Шкафы-купе, кухни и любые корпусные изделия: детали, материалы и цена в ${curIn()}`;
}
function initRegion(){
  $("rg_country").addEventListener("input",e=>{
    COUNTRY=e.target.value; const c=MO&&MO.countryInfo(COUNTRY);
    if(MO) MO.setRegion({country:COUNTRY,currency:CURCODE});
    if(c && c.currency!==CURCODE) switchCurrency(c.currency); else renderRegion();
  });
  $("rg_cur").addEventListener("input",e=>switchCurrency(e.target.value));
  $("rg_src").addEventListener("input",e=>{ PRICE_META.src=e.target.value.trim(); savePrice(); });
  $("rg_date").addEventListener("input",e=>{ PRICE_META.date=e.target.value; savePrice(); });
}
function applyCurrency(cur,items,starter){
  if(items){ CURCODE=cur; PRICE=items; PRICE_META=starter?{cur,starter:true}:{cur}; savePrice(starter); }
  loadPrice(cur);
  if(MO) MO.setRegion({country:COUNTRY,currency:CURCODE});
  renderPricePage(); calc();
}
// Перейти на другую валюту. Если прайса в ней ещё нет - спросить, с чего начать.
function switchCurrency(cur){
  if(cur===CURCODE) return renderRegion();
  if(!hasPrice(CURCODE)) savePrice(true);   // текущий прайс (пусть и стартовый) сохраняем, чтобы к нему можно было вернуться
  const to=curInfo(cur), from=curInfo();
  if(hasPrice(cur)){ applyCurrency(cur); toast(`Прайс в ${curIn(cur)}`); return; }
  // курс показываем от "крупной" валюты: 1 ₽ = 6,5 ₸, а не 1 ₸ = 0,15 ₽
  const big=(to.rateKZT||1)>=(from.rateKZT||1)?to:from, small=big===to?from:to;
  const r0=Math.round((big.rateKZT||1)/(small.rateKZT||1)*1000)/1000;
  const starter=cur==="RUB"?"примерные цены для России (2026, средний сегмент)":"примерные цены, пересчитанные из тенге по приблизительному курсу";
  let done=false;
  openModal(`Прайс в ${curIn(cur)}`,`<p style="margin-top:0">В ${curIn(cur)} прайса ещё нет. С чего начать?</p>
    <div class="card" style="margin:0 0 10px"><b>Стартовые цены</b><p class="note" style="margin:4px 0 8px">${starter}. Потом впишите свои или загрузите прайс поставщика.</p><button class="b1" id="rgStarter">Взять стартовые цены</button></div>
    <div class="card" style="margin:0"><b>Мой прайс в ${curIn()}, пересчитанный по курсу</b><p class="note" style="margin:4px 0 8px">Свои позиции и материалы сохранятся. Прайс в ${curIn()} останется как есть.</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>1 ${esc(big.sign)} =</span><input type="number" id="rgRate" step="0.001" min="0" value="${r0}" style="width:110px"><span>${esc(small.sign)}</span><button class="b2" id="rgConvert">Пересчитать</button></div></div>`,
    ()=>{
      $("rgStarter").onclick=()=>{ done=true; closeModal(); applyCurrency(cur,priceDefaults(cur),true); toast(`Стартовые цены в ${curIn(cur)}`); };
      $("rgConvert").onclick=()=>{
        const r=+$("rgRate").value; if(!(r>0)){ toast("Укажите курс"); return; }
        const k=big===to?1/r:r;   // сколько новой валюты за единицу старой
        const items=clone(PRICE).map(it=>{
          if(it.u==="%") return it;
          if(it.id==="round") it.v=MO?MO.roundStep(cur):it.v;
          else { const v=(+it.v||0)*k; it.v=v>=100?Math.round(v):Math.round(v*100)/100; }
          delete it.upd; return it;
        });
        done=true; closeModal(); applyCurrency(cur,items); toast(`Прайс пересчитан в ${curIn(cur)} - проверьте цены`);
      };
      const host=$("modalHost"), obs=new MutationObserver(()=>{ if(!host.innerHTML){ obs.disconnect(); if(!done) renderRegion(); } }); obs.observe(host,{childList:true});
    });
}

// ================= ИМПОРТ ЦЕН ИЗ EXCEL =================
function normTxt(s){ return String(s==null?"":s).toLowerCase().replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/g," ").trim(); }
function parseNum(v){
  if(typeof v==="number") return v;
  const s=String(v==null?"":v).replace(/[\s  ]/g,"").replace(/[₸₽$€тгkztrubруб.р]+$/i,"").replace(",",".");
  return s!=="" && isFinite(+s) ? +s : NaN;
}
function parseTSV(text){
  const lines=text.replace(/\r/g,"").split("\n").filter(l=>l.trim()!=="");
  const tabs=lines.filter(l=>l.includes("\t")).length, sep = tabs>=lines.length/2 ? "\t" : (lines.filter(l=>l.includes(";")).length>=lines.length/2 ? ";" : ",");
  return lines.map(l=>{
    if(sep==="\t") return l.split("\t").map(c=>c.trim());
    const out=[]; let cur="", q=false;
    for(let i=0;i<l.length;i++){ const ch=l[i]; if(ch==='"'){ if(q&&l[i+1]==='"'){ cur+='"'; i++; } else q=!q; } else if(ch===sep&&!q){ out.push(cur.trim()); cur=""; } else cur+=ch; }
    out.push(cur.trim()); return out;
  });
}
const COL_RX = {id:/^id$/i, name:/наимен|назван|товар|номенкл|позиц|материал|name/i, price:/цен|стоим|розн|опт|price|прайс/i, sku:/артик|код|sku|арт\./i, unit:/^ед|ед\.|единиц|unit/i};
function guessCols(rows){
  let hdr=-1, best=0;
  rows.slice(0,30).forEach((r,i)=>{ let sc=0; r.forEach(c=>{ const s=String(c||""); if(s.length<40) for(const k in COL_RX) if(COL_RX[k].test(s)){ sc++; break; } }); if(sc>best){ best=sc; hdr=i; } });
  const cols={id:-1,name:-1,price:-1,sku:-1,unit:-1};
  if(hdr>=0 && best>=2){ rows[hdr].forEach((c,j)=>{ const s=String(c||""); for(const k of ["id","sku","unit","price","name"]) if(cols[k]<0 && COL_RX[k].test(s) && !Object.values(cols).includes(j)){ cols[k]=j; break; } }); }
  else hdr=-1;
  // без заголовка: название - самая "текстовая" колонка, цена - самая "числовая"
  const body=rows.slice(hdr+1,hdr+60), nc=Math.max(0,...body.map(r=>r.length));
  if(cols.name<0||cols.price<0){
    let bt=-1,bn=-1,st=0,sn=0;
    for(let j=0;j<nc;j++){ let t=0,n=0; body.forEach(r=>{ const v=r[j]; if(v==null||v==="") return; if(isFinite(parseNum(v))) n++; else if(String(v).length>3) t+=Math.min(40,String(v).length); });
      if(cols.name<0 && t>st && j!==cols.price){ st=t; bt=j; } if(cols.price<0 && n>=sn && n>0 && j!==cols.name && j!==cols.sku){ sn=n; bn=j; } }
    if(cols.name<0) cols.name=bt; if(cols.price<0) cols.price=bn;
  }
  return {hdr,cols};
}
function guessUnit(s){
  const t=normTxt(s);
  if(/лист/.test(t)) return "лист"; if(/м2|кв/.test(t)) return "м²"; if(/п м|пог|пм/.test(t)) return "п.м."; if(/компл|к т/.test(t)) return "компл."; if(/^м$|метр/.test(t)) return "м"; return "шт.";
}
let IMP=null;
function openImport(){
  IMP={step:1, rows:null, name:"", hdr:-1, cols:null, k:1, links:{}, on:{}, sq:{}, addQ:"", addG:"Фурнитура"};
  openModal("Загрузить цены из Excel",`<div id="impBody"></div>`,()=>impRender(),{wide:true});
}
function impRender(){
  const box=$("impBody"); if(!box) return;
  const steps=`<div class="steps"><span class="${IMP.step===1?"on":""}">1. Файл</span><span class="${IMP.step===2?"on":""}">2. Колонки</span><span class="${IMP.step===3?"on":""}">3. Сверка цен</span></div>`;
  if(IMP.step===1){
    box.innerHTML=steps+`<div class="drop" id="impDrop"><b>Перетащите сюда файл прайса</b><br>Excel (.xlsx, .xls), CSV или файл прайса (.mebel-price.json)<div class="btns" style="justify-content:center"><button class="b1" id="impPick">Выбрать файл</button></div><input type="file" id="impFile" accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt,.json" class="hide"></div>
      <p class="note">Или выделите нужные строки в Excel, скопируйте (Ctrl+C) и вставьте сюда (Ctrl+V):</p>
      <textarea id="impPaste" rows="5" placeholder="Название	Цена&#10;ЛДСП 16 мм белый	21500&#10;Петля с доводчиком	1100"></textarea>
      <div class="btns"><button class="b2" id="impParse">Разобрать вставленное</button></div>
      <p class="note">Подойдёт и прайс поставщика, и ваш собственный файл, скачанный кнопкой "Скачать прайс в Excel". Файл никуда не отправляется - он читается прямо в браузере.</p>`;
    const dz=$("impDrop"), fi=$("impFile");
    $("impPick").onclick=()=>fi.click();
    fi.addEventListener("change",()=>{ if(fi.files[0]) impReadFile(fi.files[0]); });
    ["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{ e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{ e.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop",e=>{ const f=e.dataTransfer.files[0]; if(f) impReadFile(f); });
    $("impParse").onclick=()=>{ const t=$("impPaste").value; if(!t.trim()){ toast("Сначала вставьте строки из Excel"); return; } impSetRows(parseTSV(t),"вставленные строки"); };
  }
  else if(IMP.step===2){
    const rows=IMP.rows, nc=Math.max(...rows.slice(0,200).map(r=>r.length)), c=IMP.cols;
    const colSel=(k,lab,opt)=>`<div><label>${lab}</label><select data-ic="${k}">${opt?`<option value="-1">нет</option>`:""}${Array.from({length:nc},(_,j)=>`<option value="${j}" ${c[k]===j?"selected":""}>${String.fromCharCode(65+j%26)}${IMP.hdr>=0&&rows[IMP.hdr][j]!=null&&rows[IMP.hdr][j]!==""?": "+esc(String(rows[IMP.hdr][j]).slice(0,24)):""}</option>`).join("")}</select></div>`;
    const from=Math.max(0,IMP.hdr), pv=rows.slice(from,from+9);
    box.innerHTML=steps+`<p class="note" style="margin-top:0">Источник: ${esc(IMP.name)}, строк: ${rows.length}.${IMP.sheets&&IMP.sheets.length>1?` Лист: <select id="impSheet" style="width:auto;padding:4px">${IMP.sheets.map(s=>`<option ${s===IMP.sheet?"selected":""}>${esc(s)}</option>`).join("")}</select>`:""} Проверьте, что колонки определены верно.</p>
      <div class="row4">${colSel("name","Название")}${colSel("price","Цена")}${colSel("sku","Артикул / код",1)}${colSel("unit","Ед. изм.",1)}</div>
      <div class="row4" style="margin-top:8px"><div><label>Строка заголовка</label><input type="number" id="impHdr" min="0" value="${IMP.hdr+1}"></div>
        <div><label>Умножить цены на</label><input type="number" id="impK" step="0.01" value="${IMP.k}" title="Например 1.12, если цены в файле без НДС"></div></div>
      <div class="prev"><table>${pv.map((r,i)=>`<tr class="${from+i===IMP.hdr?"hd":""}">${Array.from({length:nc},(_,j)=>`<td style="${j===c.name?"background:#fff8e6":j===c.price?"background:#e3f0ec":""}">${esc(r[j]==null?"":r[j])}</td>`).join("")}</tr>`).join("")}</table></div>
      <div class="btns"><button class="b2" id="impBack">Назад</button><button class="b1" id="impNext">Дальше: сверить цены</button></div>`;
    box.querySelectorAll("[data-ic]").forEach(s=>s.addEventListener("input",()=>{ c[s.dataset.ic]=+s.value; impRender(); }));
    $("impHdr").addEventListener("change",e=>{ IMP.hdr=clamp((+e.target.value||0)-1,-1,rows.length-1); impRender(); });
    $("impK").addEventListener("input",e=>{ IMP.k=+e.target.value||1; });
    const sh=$("impSheet"); if(sh) sh.addEventListener("input",()=>impLoadSheet(sh.value));
    $("impBack").onclick=()=>{ IMP.step=1; impRender(); };
    $("impNext").onclick=()=>{ if(c.name<0||c.price<0){ toast("Укажите колонки с названием и ценой"); return; } impBuild(); IMP.step=3; impRender(); };
  }
  else impRenderMatch(box,steps);
}
async function impReadFile(f){
  IMP.name=f.name;
  try{
    if(/\.(csv|txt)$/i.test(f.name)){ impSetRows(parseTSV(await f.text()),f.name); return; }
    if(/\.json$/i.test(f.name)){ let d=null; try{ d=JSON.parse(await f.text()); }catch(e){} if(d&&d.format==="mebel-price") impPriceFile(d,f.name); else toast("Это не файл прайса (*.mebel-price.json)"); return; }
    toast("Читаю файл...");
    const X=await needXLSX(), wb=X.read(await f.arrayBuffer(),{type:"array"});
    IMP.wb=wb; IMP.sheets=wb.SheetNames;
    // берём лист, где больше всего строк
    let best=wb.SheetNames[0], bn=-1;
    wb.SheetNames.forEach(n=>{ const ref=wb.Sheets[n]["!ref"]; if(!ref) return; const r=X.utils.decode_range(ref); const cnt=r.e.r-r.s.r; if(cnt>bn){ bn=cnt; best=n; } });
    impLoadSheet(best);
  }catch(e){ toast(e&&e.message==="xlsx-load" ? "Не получилось загрузить модуль чтения Excel. Скопируйте строки из Excel и вставьте их в поле ниже." : "Не получилось прочитать файл. Попробуйте сохранить его как .xlsx или вставить строки через буфер."); }
}
function impLoadSheet(name){
  const X=window.XLSX; IMP.sheet=name;
  impSetRows(X.utils.sheet_to_json(IMP.wb.Sheets[name],{header:1,defval:"",blankrows:false,raw:true}),IMP.name);
}
function impSetRows(rows,name){
  rows=rows.filter(r=>r.some(c=>c!==""&&c!=null));
  if(rows.length<1){ toast("В файле не нашлось строк"); return; }
  IMP.rows=rows; IMP.name=name; const g=guessCols(rows); IMP.hdr=g.hdr; IMP.cols=g.cols; IMP.step=2; impRender();
}
// строки файла -> список предложений; авто-сопоставление со своим прайсом
function impBuild(){
  const c=IMP.cols, src=[];
  IMP.rows.forEach((r,i)=>{
    if(i<=IMP.hdr) return;
    const name=String(r[c.name]==null?"":r[c.name]).trim(), price=parseNum(r[c.price]);
    if(!name || !isFinite(price) || price<=0) return;
    src.push({i:src.length, name, n:normTxt(name), price:Math.round(price*IMP.k*100)/100, sku:c.sku>=0?String(r[c.sku]==null?"":r[c.sku]).trim():"", unit:c.unit>=0?String(r[c.unit]||""):"", id:c.id>=0?String(r[c.id]||"").trim():""});
  });
  IMP.src=src; IMP.links={}; IMP.on={}; IMP.sq={};
  const byId={}, bySku={}, byN={};
  src.forEach(s=>{ if(s.id) byId[s.id]=s; if(s.sku) bySku[s.sku.toLowerCase()]=bySku[s.sku.toLowerCase()]||s; byN[s.n]=byN[s.n]||s; });
  PRICE.forEach(it=>{
    const bare=normTxt(String(it.name).replace(/,\s*[^,]{1,24}$/,""));     // название без хвоста ", шт." / ", м²"
    const m = byId[it.id] || (it.sku && bySku[String(it.sku).toLowerCase()]) || (it.link && byN[normTxt(it.link)]) || byN[normTxt(it.name)] || byN[bare] || (it.s && byN[normTxt(it.s)]);
    if(m){ IMP.links[it.id]=m.i; IMP.on[it.id]=Math.abs(m.price-it.v)>0.001; }
  });
}
function impSearch(q,n){
  const tk=normTxt(q).split(" ").filter(t=>t.length>=2); if(!tk.length) return [];
  const res=[];
  IMP.src.forEach(s=>{ let sc=0; tk.forEach(t=>{ if(s.n.includes(t)||s.sku.toLowerCase().includes(t)) sc++; }); if(sc>=Math.ceil(tk.length*0.6)) res.push([sc*1000-s.n.length,s]); });
  return res.sort((a,b)=>b[0]-a[0]).slice(0,n).map(x=>x[1]);
}
function impRenderMatch(box,steps){
  const found=PRICE.filter(it=>IMP.links[it.id]!==undefined), nOn=PRICE.filter(it=>IMP.on[it.id]).length;
  const row=it=>{
    const li=IMP.links[it.id], s=li!==undefined?IMP.src[li]:null, d=s?(s.price-it.v):0, pct=s&&it.v?Math.round(d/it.v*100):0;
    return `<tr data-id="${it.id}"><td style="width:30px"><input type="checkbox" data-on ${IMP.on[it.id]?"checked":""} ${s?"":"disabled"} style="width:18px;height:18px"></td>
      <td><b>${esc(it.s||it.name)}</b><div class="src">${s?`из файла: ${esc(s.name)}${s.sku?" ["+esc(s.sku)+"]":""} <button class="bx" data-unlink title="Отвязать" style="font-size:13px;padding:2px 5px">&times;</button>`
        :`<input type="search" data-find placeholder="найти в файле..." value="${esc(IMP.sq[it.id]||"")}" style="padding:5px 6px;font-size:13px;margin-top:3px"><div class="cands" data-cands></div>`}</div></td>
      <td class="n">${fmt(it.v)}</td><td class="n">${s?`<b>${fmt(s.price)}</b>`:"-"}</td>
      <td class="n ${d>0?"up":d<0?"dn":""}">${s&&d?`${d>0?"+":""}${pct}%`:s?"=":""}</td></tr>`;
  };
  const rest=PRICE.filter(it=>IMP.links[it.id]===undefined && it.g!=="Правила расчёта");
  box.innerHTML=steps+`<p class="note" style="margin-top:0">В файле ${IMP.src.length} позиций с ценой. Найдено совпадений с вашим прайсом: <b>${found.length}</b>. Остальные можно найти вручную - связь запомнится, и в следующий раз цена обновится сама.</p>
    <div class="imp"><table><tr><th></th><th>Моя позиция</th><th class="n">Сейчас</th><th class="n">В файле</th><th class="n"></th></tr>
      ${found.map(row).join("")}
      ${rest.length?`<tr><td colspan="5" style="background:#f3ece2;font-weight:700;color:var(--wood-d)">Не найдены в файле (${rest.length})</td></tr>`:""}${rest.map(row).join("")}</table></div>
    <details style="margin-top:10px"><summary>Добавить в мой прайс новые позиции из файла</summary>
      <div class="row2" style="margin-top:6px"><input type="search" id="impAddQ" placeholder="Что ищем: например, петля blum" value="${esc(IMP.addQ)}"><select id="impAddG">${GROUPS.filter(g=>g!=="Правила расчёта").map(g=>`<option ${g===IMP.addG?"selected":""}>${g}</option>`).join("")}</select></div>
      <div class="cands" id="impAddRes"></div></details>
    <div class="btns"><button class="b2" id="impBack">Назад</button><button class="b1" id="impApply">Обновить цены (${nOn})</button></div>`;
  const tbl=box.querySelector(".imp");
  const showC=(tr)=>{ const id=tr.dataset.id, q=IMP.sq[id]||"", cd=tr.querySelector("[data-cands]"); if(!cd) return;
    cd.innerHTML=impSearch(q,6).map(s=>`<button data-pick="${s.i}">${esc(s.name)}${s.sku?" ["+esc(s.sku)+"]":""}<b>${fmt(s.price)}</b></button>`).join("")||(q.length>1?`<span class="src">ничего похожего</span>`:""); };
  tbl.addEventListener("input",e=>{
    const tr=e.target.closest("tr[data-id]"); if(!tr) return; const id=tr.dataset.id;
    if(e.target.matches("[data-on]")){ IMP.on[id]=e.target.checked; $("impApply").textContent=`Обновить цены (${PRICE.filter(it=>IMP.on[it.id]).length})`; }
    if(e.target.matches("[data-find]")){ IMP.sq[id]=e.target.value; showC(tr); }
  });
  tbl.addEventListener("click",e=>{
    const tr=e.target.closest("tr[data-id]"); if(!tr) return; const id=tr.dataset.id, st=tbl.scrollTop;
    const pk=e.target.closest("[data-pick]");
    if(pk){ IMP.links[id]=+pk.dataset.pick; IMP.on[id]=true; IMP.linked=IMP.linked||{}; IMP.linked[id]=1; impRender(); box.querySelector(".imp").scrollTop=st; }
    else if(e.target.closest("[data-unlink]")){ delete IMP.links[id]; delete IMP.on[id]; IMP.unlinked=IMP.unlinked||{}; IMP.unlinked[id]=1; impRender(); box.querySelector(".imp").scrollTop=st; }
  });
  const addRes=()=>{ $("impAddRes").innerHTML=impSearch(IMP.addQ,12).map(s=>`<button data-add="${s.i}">+ ${esc(s.name)}${s.sku?" ["+esc(s.sku)+"]":""}<b>${fmt(s.price)}</b></button>`).join(""); };
  $("impAddQ").addEventListener("input",e=>{ IMP.addQ=e.target.value; addRes(); });
  $("impAddG").addEventListener("input",e=>{ IMP.addG=e.target.value; });
  $("impAddRes").addEventListener("click",e=>{ const b=e.target.closest("[data-add]"); if(!b) return; const s=IMP.src[+b.dataset.add];
    const it=addPriceItem(IMP.addG,{name:s.name,v:s.price,sku:s.sku,link:s.name,u:s.unit?guessUnit(s.unit):(NEW_UNIT[IMP.addG]||"шт."),upd:today()}); IMP.links[it.id]=s.i; b.remove(); toast("Добавлено в группу "+IMP.addG); });
  if(IMP.addQ) addRes();
  $("impBack").onclick=()=>{ IMP.step=2; impRender(); };
  $("impApply").onclick=()=>{
    let n=0;
    PRICE.forEach(it=>{ const li=IMP.links[it.id]; if(li===undefined){ if(IMP.unlinked&&IMP.unlinked[it.id]) delete it.link; return; }
      const s=IMP.src[li]; it.link=s.name; if(s.sku && !it.sku) it.sku=s.sku;
      if(IMP.on[it.id]){ it.v=s.price; it.upd=today(); n++; } });
    if(n){ const m=IMP.meta||{src:IMP.name&&IMP.name!=="вставленные строки"?IMP.name.replace(/\.(xlsx?|xlsm|ods|csv|txt|json)$/i,""):""}; if(m.src) PRICE_META.src=m.src; PRICE_META.date=m.date||new Date().toISOString().slice(0,10); }
    savePrice(); closeModal(); renderPricePage(); toast(`Обновлено цен: ${n}`);
  };
}

// ================= ЗАГРУЗКА МОДУЛЯ EXCEL (SheetJS) =================
const XLSX_URL="https://cdn.jsdelivr.net/npm/@e965/xlsx@0.20.3/dist/xlsx.full.min.js";
const XLSX_SRI="sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT";
let xlsxP=null;
function needXLSX(){
  if(window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxP || (xlsxP=new Promise((res,rej)=>{
    const s=document.createElement("script"); s.src=XLSX_URL; s.integrity=XLSX_SRI; s.crossOrigin="anonymous";
    s.onload=()=>window.XLSX?res(window.XLSX):rej(new Error("xlsx-load")); s.onerror=()=>{ xlsxP=null; rej(new Error("xlsx-load")); };
    document.head.appendChild(s);
  }));
}
// ================= СОХРАНЕНИЕ ФАЙЛОВ =================
let dlP=null;
function getDL(){ return dlP || (dlP=(window.claude&&window.claude.use ? Promise.resolve(window.claude.use("downloads")).catch(()=>null) : Promise.resolve(null))); }
async function saveFile(name,data,copyText){
  const dl=await getDL();
  if(dl){
    try{ await dl.save({filename:name,data}); toast("Файл сохранён"); return true; }
    catch(e){ if(e && e.code==="declined") return false; }
  } else if(!window.claude){
    try{   // страница открыта как обычный файл - скачиваем напрямую
      const blob=data instanceof Blob?data:new Blob([data]); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href),5000); return true;
    }catch(e){}
  }
  if(copyText!=null){ await copy(copyText,"Скачать файл здесь нельзя - данные скопированы, вставьте их в Excel или в заметки"); return true; }
  toast("Скачать файл здесь не получилось"); return false;
}
async function saveTable(name,sheetName,rows,widths){
  const tsv=rows.map(r=>r.map(c=>String(c==null?"":c).replace(/[\t\n]/g," ")).join("\t")).join("\n");
  try{
    const X=await needXLSX(), ws=X.utils.aoa_to_sheet(rows);
    if(widths) ws["!cols"]=widths.map(w=>({wch:w}));
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,sheetName.slice(0,31));
    const buf=X.write(wb,{bookType:"xlsx",type:"array"});
    return saveFile(name,new Blob([buf]),tsv);
  }catch(e){ await copy(tsv,"Модуль Excel не загрузился - таблица скопирована, вставьте её в Excel"); return true; }
}
