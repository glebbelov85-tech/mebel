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
const LS = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
};

// ================= ПРАЙС =================
// Позиция прайса: id, g - группа, name - полное название, s - короткое название для расчёта,
// u - единица, v - цена, sku - артикул поставщика, m - свойства материала (если это материал для деталей)
const GROUPS = ["Плиты","Фасады","Стекло и зеркало","Столешницы","Кромка","Фурнитура","Двери-купе","Услуги","Правила расчёта"];
const UNITS = ["лист","м²","п.м.","м","шт.","компл.","мод.","%","₸"];
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
  {id:"top38",      g:"Столешницы", name:"Столешница ЛДСП 38 мм, п.м.", s:"Столешница 38", u:"п.м.", v:12000, m:{kind:"length",t:38,css:"#8a6a4a"}},
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
  {id:"install", g:"Услуги", name:"Доставка и монтаж шкафа-купе", s:"Доставка и монтаж", u:"₸", v:15000},
  {id:"kinstall",g:"Услуги", name:"Доставка и монтаж кухни", s:"Доставка и монтаж кухни", u:"₸", v:40000},
  {id:"uinstall",g:"Услуги", name:"Доставка и сборка прочих изделий", s:"Доставка и сборка", u:"₸", v:10000},
  {id:"work",   g:"Правила расчёта", name:"Сборка, % от материалов", u:"%", v:15},
  {id:"markup", g:"Правила расчёта", name:"Наценка, %", u:"%", v:30},
  {id:"usage",  g:"Правила расчёта", name:"Использование листа, % (остальное - отходы)", u:"%", v:80},
  {id:"round",  g:"Правила расчёта", name:"Округлять итог до, ₸", u:"₸", v:1000},
  {id:"pm",     g:"Правила расчёта", name:"Цена кухни за погонный метр - для сравнения (0 - не показывать)", u:"₸", v:0}
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

function priceDefaults(){ return clone(PRICE_DEF).map(x=>Object.assign(x,{sys:1,sku:""})); }
function reindexPrice(){
  P={}; PI={}; MATS={};
  PRICE.forEach(it=>{ P[it.id]=+it.v||0; PI[it.id]=it; if(it.m) MATS[it.id]=Object.assign({id:it.id,name:it.s||it.name},it.m); });
  for(const k in VIRT) MATS[k]=Object.assign({id:k},VIRT[k]);
}
function loadPrice(){
  const def=priceDefaults();
  const st=LS.get("mk2_price",null);
  if(st && Array.isArray(st.items)){
    const ids=new Set(st.items.map(x=>x.id));
    PRICE=st.items.filter(x=>x&&x.id);
    // новые стандартные позиции (после обновления программы) добавляются в конец своей группы
    def.forEach(d=>{ if(!ids.has(d.id)) PRICE.push(d); else { const it=PRICE.find(x=>x.id===d.id); it.sys=1; if(d.m && !it.m) it.m=d.m; if(!it.s && d.s) it.s=d.s; } });
  }else{
    PRICE=def;
    const old=LS.get("kupe_prices",null);   // цены из прошлой версии калькулятора
    if(old) for(const k in old){ const it=PRICE.find(x=>x.id===(OLD_PRICE_KEYS[k]||k)); if(it && isFinite(+old[k])) it.v=+old[k]; }
  }
  reindexPrice();
}
function savePrice(){ LS.set("mk2_price",{v:2,items:PRICE}); reindexPrice(); }
function defOf(id){ return PRICE_DEF.find(x=>x.id===id); }
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
