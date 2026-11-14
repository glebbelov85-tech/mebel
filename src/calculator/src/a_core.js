"use strict";
// ================= УТИЛИТЫ =================
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString("ru-RU").replace(/[  ]/g," ");
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const r1 = v => Math.round(v*10)/10;
const clone = o => JSON.parse(JSON.stringify(o));
const uid = p => p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const today = () => new Date().toLocaleDateString("ru-RU");
// 1 полка, 2 полки, 5 полок
const plur = (n,one,few,many) => { n=Math.abs(Math.round(n))%100; const d=n%10; return (n>10&&n<20)?many : d===1?one : (d>=2&&d<=4)?few : many; };
const LS = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
};

// ================= СТРАНА И ВАЛЮТА =================
// Справочник валют и настройка "страна и валюта" - в общем модуле заказа (MebelOrder, вклеивается при сборке).
// Без него (тесты в node) калькулятор считает в тенге, как раньше.
const MO = typeof MebelOrder!=="undefined" ? MebelOrder : null;
let CURCODE = "KZT";       // валюта текущего прайса и всех сумм калькулятора
let COUNTRY = "KZ";
const KZT_INFO = {code:"KZT",sign:"₸",name:"Тенге",forms:["тенге","тенге","тенге"],roundTo:1000,inWord:"тенге",rateKZT:1};
function curInfo(c){ return MO ? MO.currencyInfo(c||CURCODE) : KZT_INFO; }
function curList(){ return MO ? Object.values(MO.CURRENCIES) : [KZT_INFO]; }
const CS = () => curInfo().sign;
const money = (n,c) => fmt(n)+"\u00a0"+curInfo(c).sign;
// "¤" в единице позиции = сумма в валюте прайса (услуга одной суммой, правило округления)
const unitLabel = u => u==="¤" ? CS() : u;

// ================= ПРАЙС =================
// Позиция прайса: id, g - группа, name - полное название, s - короткое название для расчёта,
// u - единица, v - цена, sku - артикул поставщика, m - свойства материала (если это материал для деталей)
const GROUPS = ["Плиты","Фасады","Стекло и зеркало","Столешницы","Кромка","Фурнитура","Двери-купе","Услуги","Правила расчёта"];
const UNITS = ["лист","м²","п.м.","м","шт.","компл.","мод.","%","¤"];
const SHEET = {kind:"sheet",sw:2800,sh:2070};
const PRICE_DEF = [
  {id:"ldsp16", g:"Плиты", name:"ЛДСП 16 мм (корпус), лист 2800×2070", s:"ЛДСП 16", u:"лист", v:22000, m:{...SHEET,t:16,css:"#e9d3b5",edge:"edge",cut:1}},
  {id:"ldsp16f",g:"Плиты", name:"ЛДСП 16 мм декор (фасады), лист 2800×2070", s:"ЛДСП 16 декор", u:"лист", v:26000, m:{...SHEET,t:16,css:"#d2ab7c",edge:"edge2",cut:1,facade:1}},
  {id:"ldsp10", g:"Плиты", name:"ЛДСП 10 мм (вставки дверей-купе), лист 2800×2070", s:"ЛДСП 10", u:"лист", v:19000, m:{...SHEET,t:10,css:"#d9b98f",cut:1,facade:1}},
  {id:"dvp",    g:"Плиты", name:"ДВП / ХДФ 3 мм, лист 2750×1700", s:"ДВП 3", u:"лист", v:5500, m:{kind:"sheet",sw:2750,sh:1700,t:3,css:"#c9b8a3",usage:90}},
  {id:"mdf",        g:"Фасады", name:"Фасад МДФ в плёнке, м²", s:"МДФ плёнка", u:"м²", v:22000, m:{kind:"area",t:18,css:"#ece4d8",facade:1}},
  {id:"mdf_plastic",g:"Фасады", name:"Фасад МДФ в пластике, м²", s:"МДФ пластик", u:"м²", v:30000, m:{kind:"area",t:18,css:"#dfe8ec",facade:1}},
  {id:"mdf_enamel", g:"Фасады", name:"Фасад МДФ эмаль, м²", s:"МДФ эмаль", u:"м²", v:38000, m:{kind:"area",t:18,css:"#f7f4ef",facade:1}},
  {id:"mirror",  g:"Стекло и зеркало", name:"Зеркало серебро 4 мм, м²", s:"Зеркало", u:"м²", v:15000, m:{kind:"area",t:4,css:"#b9d3df",facade:1}},
  {id:"mirror_t",g:"Стекло и зеркало", name:"Зеркало тонированное (бронза, графит), м²", s:"Зеркало тонир.", u:"м²", v:19000, m:{kind:"area",t:4,css:"#9a8b78",facade:1}},
  {id:"glass",   g:"Стекло и зеркало", name:"Стекло лакобель 4 мм, м²", s:"Лакобель", u:"м²", v:22000, m:{kind:"area",t:4,css:"#3d4a52",facade:1}},
  {id:"top38",      g:"Столешницы", name:"Столешница ЛДСП 38 мм, п.м.", s:"Столешница 38", u:"п.м.", v:12000, m:{kind:"length",t:38,css:"#8a6a4a",slab:3000}},
  {id:"top_compact",g:"Столешницы", name:"Столешница компакт-плита 12 мм, п.м.", s:"Столешница компакт", u:"п.м.", v:45000, m:{kind:"length",t:12,css:"#4a4a4a"}},
  {id:"top_stone",  g:"Столешницы", name:"Столешница искусственный камень, п.м.", s:"Столешница камень", u:"п.м.", v:90000, m:{kind:"length",t:38,css:"#cfcac2"}},
  {id:"apron",   g:"Столешницы", name:"Стеновая панель (фартук), п.м.", s:"Стеновая панель", u:"п.м.", v:10000},
  {id:"tplinth", g:"Столешницы", name:"Плинтус столешницы, п.м.", s:"Плинтус столешницы", u:"п.м.", v:2000},
  {id:"edge",  g:"Кромка", name:"Кромка ПВХ 0.4-1 мм (корпус), м", s:"Кромка ПВХ корпус", u:"м", v:150},
  {id:"edge2", g:"Кромка", name:"Кромка ПВХ 2 мм (фасады, видимые торцы), м", s:"Кромка ПВХ 2 мм", u:"м", v:300},
  {id:"handle", g:"Фурнитура", name:"Ручка, шт.", s:"Ручки", u:"шт.", v:1500},
  {id:"hinge",  g:"Фурнитура", name:"Петля с доводчиком, шт.", s:"Петли с доводчиком", u:"шт.", v:1200},
  {id:"kguide", g:"Фурнитура", name:"Направляющие полного выдвижения, компл.", s:"Направляющие полного выдвижения", u:"компл.", v:7000},
  {id:"guide",  g:"Фурнитура", name:"Направляющие шариковые, компл.", s:"Направляющие шариковые", u:"компл.", v:4500},
  {id:"lift",   g:"Фурнитура", name:"Подъёмный механизм, шт.", s:"Подъёмные механизмы", u:"шт.", v:12000},
  {id:"leg",    g:"Фурнитура", name:"Опора кухонная / мебельная, шт.", s:"Опоры", u:"шт.", v:400},
  {id:"plinth", g:"Фурнитура", name:"Цоколь кухни, п.м.", s:"Цоколь кухни", u:"п.м.", v:2500},
  {id:"gola",   g:"Фурнитура", name:"Профиль Gola, м", s:"Профиль Gola", u:"м", v:6000},
  {id:"push",   g:"Фурнитура", name:"Толкатель push-to-open, шт.", s:"Толкатели push-to-open", u:"шт.", v:1200},
  {id:"dryer",  g:"Фурнитура", name:"Сушилка для посуды, шт.", s:"Сушилки для посуды", u:"шт.", v:7000},
  {id:"cargo",  g:"Фурнитура", name:"Бутылочница (карго), шт.", s:"Бутылочница (карго)", u:"шт.", v:18000},
  {id:"kmisc",  g:"Фурнитура", name:"Крепёж и навесы, на модуль кухни", s:"Крепёж и навесы", u:"мод.", v:1500},
  {id:"rod",    g:"Фурнитура", name:"Штанга с держателями, м", s:"Штанги", u:"м", v:3000},
  {id:"led",    g:"Фурнитура", name:"LED-лента с профилем, м", s:"LED-лента с профилем", u:"м", v:3500},
  {id:"ledpow", g:"Фурнитура", name:"Блок питания и выключатель, компл.", s:"Блок питания, выключатель", u:"компл.", v:6000},
  {id:"umisc",  g:"Фурнитура", name:"Крепёж (конфирматы, эксцентрики), на 1 деталь", s:"Крепёж (конфирматы, эксцентрики)", u:"шт.", v:150},
  {id:"hook",   g:"Фурнитура", name:"Крючок, шт.", s:"Крючки", u:"шт.", v:500},
  {id:"lamels", g:"Фурнитура", name:"Основание кровати с ламелями, шт.", s:"Основание с ламелями", u:"шт.", v:20000},
  {id:"bedlift",g:"Фурнитура", name:"Подъёмный механизм кровати, компл.", s:"Подъёмный механизм кровати", u:"компл.", v:25000},
  {id:"prof_eco", g:"Двери-купе", name:"Профиль эконом, комплект на 1 дверь", s:"Профиль дверей (эконом)", u:"шт.", v:14000},
  {id:"prof_std", g:"Двери-купе", name:"Профиль стандарт, комплект на 1 дверь", s:"Профиль дверей (стандарт)", u:"шт.", v:18000},
  {id:"prof_prem",g:"Двери-купе", name:"Профиль премиум, комплект на 1 дверь", s:"Профиль дверей (премиум)", u:"шт.", v:28000},
  {id:"misc",     g:"Двери-купе", name:"Крепёж и опоры, на шкаф", s:"Крепёж, опоры", u:"компл.", v:6000},
  {id:"cut",     g:"Услуги", name:"Распил и кромление, за лист", s:"Распил и кромление", u:"лист", v:3000},
  {id:"cutout",  g:"Услуги", name:"Вырез под мойку / варочную, шт.", s:"Вырезы под мойку и варку", u:"шт.", v:5000},
  {id:"topjoin", g:"Услуги", name:"Стык столешниц в углу, шт.", s:"Стык столешниц в углу", u:"шт.", v:8000},
  {id:"install", g:"Услуги", name:"Доставка и монтаж шкафа-купе", s:"Доставка и монтаж", u:"¤", v:15000},
  {id:"kinstall",g:"Услуги", name:"Доставка и монтаж кухни", s:"Доставка и монтаж кухни", u:"¤", v:40000},
  {id:"uinstall",g:"Услуги", name:"Доставка и сборка прочих изделий", s:"Доставка и сборка", u:"¤", v:10000},
  {id:"work",   g:"Правила расчёта", name:"Сборка, % от материалов", u:"%", v:15},
  {id:"markup", g:"Правила расчёта", name:"Наценка, %", u:"%", v:30},
  {id:"nest",   g:"Правила расчёта", name:"Листы считать по раскрою (детали раскладываются на лист)", u:"да/нет", v:1},
  {id:"usage",  g:"Правила расчёта", name:"Использование листа, % - если листы считаются не по раскрою", u:"%", v:80},
  {id:"round",  g:"Правила расчёта", name:"Округлять итог до", u:"¤", v:1000},
  {id:"pm",     g:"Правила расчёта", name:"Цена кухни за погонный метр - для сравнения (0 - не показывать)", u:"¤", v:0}
];
// служебные "материалы" только для картинки: техника, металл, цоколь - в цену и распил не идут
const VIRT = {
  _appl:  {name:"Техника", t:20, kind:"virt", virt:1, css:"#3a3a3a"},
  _metal: {name:"Металл", t:20, kind:"virt", virt:1, css:"#8f9499"},
  _plinth:{name:"Цоколь", t:16, kind:"virt", virt:1, css:"#5a4b3e"},
  _apron: {name:"Фартук", t:4, kind:"virt", virt:1, css:"#e6ddd2"}
};
const OLD_PRICE_KEYS = {ldsp:"ldsp16", fac_film:"mdf", fac_plastic:"mdf_plastic", fac_enamel:"mdf_enamel", lacobel:"glass", top_ldsp:"top38"};

let PRICE = [];        // рабочий прайс (массив позиций)
let P = {};            // id -> цена
let PI = {};           // id -> позиция
let MATS = {};         // id -> материал

// Стартовые цены в рублях (Россия, 2026, средний сегмент, примерно). Остальные валюты - пересчёт тенге по примерному курсу.
const PRICE_RUB = {ldsp16:4200, ldsp16f:5200, ldsp10:3800, dvp:700, mdf:5000, mdf_plastic:7000, mdf_enamel:9500, mirror:2800, mirror_t:4000, glass:4500,
  top38:2500, top_compact:12000, top_stone:20000, apron:2000, tplinth:500, edge:15, edge2:35, handle:250, hinge:350, kguide:1500, guide:600, lift:2500,
  leg:80, plinth:500, gola:1200, push:250, dryer:1500, cargo:4000, kmisc:300, rod:500, led:700, ledpow:1500, umisc:30, hook:100, lamels:4000, bedlift:5000,
  prof_eco:2500, prof_std:3500, prof_prem:6000, misc:1200, cut:1200, cutout:800, topjoin:1500, install:4000, kinstall:10000, uinstall:2500, round:100, pm:0};
let PRICE_META = {};   // о прайсе: валюта, откуда цены (поставщик), дата
function starterV(d,cur){
  if(d.u==="%" || d.u==="да/нет") return d.v;
  if(d.id==="round") return MO ? MO.roundStep(cur) : d.v;
  if(!MO || cur==="KZT") return d.v;
  return MO.starterPrice(d.v,cur,PRICE_RUB[d.id]);
}
function priceDefaults(cur){ cur=cur||CURCODE; return clone(PRICE_DEF).map(x=>Object.assign(x,{v:starterV(x,cur),sys:1,sku:""})); }
function priceKey(cur){ return cur==="KZT" ? "mk2_price" : "mk2_price_"+cur; }
function hasPrice(cur){ const st=LS.get(priceKey(cur),null); return !!(st && Array.isArray(st.items)); }
function reindexPrice(){
  P={}; PI={}; MATS={};
  PRICE.forEach(it=>{ P[it.id]=+it.v||0; PI[it.id]=it; if(it.m) MATS[it.id]=Object.assign({id:it.id,name:it.s||it.name},it.m); });
  for(const k in VIRT) MATS[k]=Object.assign({id:k},VIRT[k]);
}
function loadPrice(cur){
  if(!cur){ const r=MO?MO.region():null; cur=r?r.currency:"KZT"; COUNTRY=r?r.country:"KZ"; }
  CURCODE=curInfo(cur).code;
  const def=priceDefaults(CURCODE);
  const st=LS.get(priceKey(CURCODE),null);
  PRICE_META=Object.assign({cur:CURCODE}, st&&st.meta||{}, st?{}:{starter:true});
  if(st && Array.isArray(st.items)){
    const ids=new Set(st.items.map(x=>x.id));
    PRICE=st.items.filter(x=>x&&x.id);
    // новые стандартные позиции (после обновления программы) добавляются в конец своей группы
    def.forEach(d=>{ if(!ids.has(d.id)) PRICE.push(d); else { const it=PRICE.find(x=>x.id===d.id); it.sys=1; if(d.m && !it.m) it.m=d.m; if(d.m && d.m.slab && it.m && it.m.slab===undefined) it.m.slab=d.m.slab; if(!it.s && d.s) it.s=d.s; if(d.g==="Правила расчёта"){ it.name=d.name; it.u=d.u; } } });
    PRICE.forEach(it=>{ if(it.u==="₸") it.u="¤"; });   // до 2026-11: единица "₸" = сумма
  }else{
    PRICE=def;
    const old=CURCODE==="KZT" && LS.get("kupe_prices",null);   // цены из прошлой версии калькулятора
    if(old) for(const k in old){ const it=PRICE.find(x=>x.id===(OLD_PRICE_KEYS[k]||k)); if(it && isFinite(+old[k])) it.v=+old[k]; }
  }
  reindexPrice();
}
// keepStarter - сохранить, но оставить пометку "стартовые цены" (мастер их ещё не правил)
function savePrice(keepStarter){ if(!keepStarter) delete PRICE_META.starter; LS.set(priceKey(CURCODE),{v:3,cur:CURCODE,meta:PRICE_META,items:PRICE}); reindexPrice(); }
function defOf(id){ const d=PRICE_DEF.find(x=>x.id===id); return d ? Object.assign({},d,{v:starterV(d,CURCODE)}) : d; }
function MAT(id){ return MATS[id]||MATS.ldsp16; }
function matName(id){ return MAT(id).name; }
function hwName(id){ const it=PI[id]; return it ? (it.s||it.name) : id; }
function hwUnit(id){ const it=PI[id]; return it ? it.u : "шт."; }
function useK(){ return clamp((P.usage||80)/100,0.5,0.98); }
// списки материалов для выпадающих списков
function matList(filter){ return PRICE.filter(it=>it.m && filter(it.m,it)).map(it=>it.id); }
const bodyMats  = () => matList(m=>m.kind==="sheet" && m.t>=12);
const facMats   = () => matList(m=>m.facade && m.t>=12);
const doorMats  = () => matList(m=>m.facade && m.t<=10);
const topMats   = () => matList(m=>m.kind==="length");
const matOpts = (ids,sel) => ids.map(id=>`<option value="${id}" ${id===sel?"selected":""}>${esc(matName(id))}</option>`).join("");
