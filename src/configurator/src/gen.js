// ============================================================
// 1. БИБЛИОТЕКА ОТДЕЛОК, ГЕНЕРАТОРЫ КУХНИ И ШКАФА, СБОРКА ЗАКАЗА
// ============================================================
const MO = MebelOrder;

// Декоры: цвет и рисунок. k: solid | wood | marble | stone | concrete | terrazzo
const DECOR = {
  white:      { n: "Белый",            c: "#f3f3f0" },
  milk:       { n: "Молочный",         c: "#ece6d8" },
  vanilla:    { n: "Ваниль",           c: "#e9dcc0" },
  beige:      { n: "Бежевый",          c: "#d6c6ae" },
  cappuccino: { n: "Капучино",         c: "#b29c85" },
  grey:       { n: "Светло-серый",     c: "#c3c5c2" },
  stonegrey:  { n: "Серый камень",     c: "#8d9192" },
  graphite:   { n: "Графит",           c: "#3c4144" },
  black:      { n: "Чёрный",           c: "#1d1e20" },
  sage:       { n: "Шалфей",           c: "#a7b59f" },
  olive:      { n: "Оливковый",        c: "#7c8663" },
  emerald:    { n: "Изумруд",          c: "#1f5648" },
  bluefog:    { n: "Синий туман",      c: "#71879a" },
  deepblue:   { n: "Глубокий синий",   c: "#263f58" },
  rose:       { n: "Пыльная роза",     c: "#c9a29b" },
  terra:      { n: "Терракота",        c: "#b0694c" },
  mustard:    { n: "Горчичный",        c: "#c79a3a" },
  oaksonoma:  { n: "Дуб сонома",       c: "#d9c5a3", k: "wood", d: "#b59a72", l: "#ead9bd" },
  oaknatur:   { n: "Дуб натуральный",  c: "#c9a877", k: "wood", d: "#a07c4b", l: "#dcc196" },
  oakvotan:   { n: "Дуб вотан",        c: "#b98d5c", k: "wood", d: "#8c623a", l: "#d0a878" },
  ash:        { n: "Ясень светлый",    c: "#e3d8c6", k: "wood", d: "#c4b59d", l: "#f1e9db" },
  walnut:     { n: "Орех",             c: "#7b5438", k: "wood", d: "#523320", l: "#96694a" },
  wenge:      { n: "Венге",            c: "#42302a", k: "wood", d: "#261a16", l: "#5a443b" },
  marblew:    { n: "Мрамор белый",     c: "#eeedea", k: "marble", d: "#8e9296" },
  marbleb:    { n: "Мрамор чёрный",    c: "#232426", k: "marble", d: "#c9c2b4" },
  concrete:   { n: "Бетон серый",      c: "#a5a6a3", k: "concrete", d: "#7f817f", l: "#bfc0bd" },
  stoneblack: { n: "Чёрный камень",    c: "#2b2c2e", k: "stone", d: "#0f0f10", l: "#6d6e70" },
  stonebeige: { n: "Бежевый камень",   c: "#d9cdb9", k: "stone", d: "#a3937a", l: "#f1e9dc" },
  terrazzo:   { n: "Терраццо",         c: "#e4e1da", k: "terrazzo", d: "#6f6a62", l: "#b9856a" },
  mirror:     { n: "Зеркало серебро",  c: "#cfd9de", k: "mirror" },
  mirrorgr:   { n: "Зеркало графит",   c: "#5d666c", k: "mirror" },
  mirrorbr:   { n: "Зеркало бронза",   c: "#a58a6c", k: "mirror" }
};

// Цены в конфигураторе - в валюте проекта (S.cur). Числа ниже - тенге; для рублей свой набор (rub),
// для остальных валют - пересчёт по примерному курсу (MO.starterPrice).
const cp = (S, kzt, rub) => MO.starterPrice(kzt, S && S.cur || "KZT", rub);
const RUB = { "ldsp16-fasad": 2500, "top-compact": 12000, "top-stone": 20000, "apron-panel": 2000, "mirror4-tint": 4000,
  shaker: 1000, slim: 1000, classic: 1500, fluted: 2200, slats: 1800, plinth: 500, cutout: 800, kupeMisc: 1200, kupeInstall: 4000, kitchenInstall: 10000,
  h1: 350, h2: 280, h3: 750, h4: 600, h5: 800, h6: 200, h7: 400, h8: 500 };
// Прайс мастера (S.prices): свои цены вместо стартовых. Ключи - id материалов, кромки и фурнитуры из каталога заказа
// плюс названные позиции (PRICE_NAMED). Попадает сюда из калькулятора, из файла прайса или вносится руками.
let PRICE_OVR = {};
const pz = (id, def) => { const v = PRICE_OVR[id]; return v != null && v !== "" && +v >= 0 ? +v : def; };
const PRICE_NAMED = {
  plinth: ["Цоколь кухни", "м", 2500], cutout: ["Вырез под мойку / варочную панель", "шт", 5000], kupeMisc: ["Крепёж и опоры шкафа-купе", "компл", 6000],
  kupeInstall: ["Доставка и монтаж шкафа", "усл", 15000], kitchenInstall: ["Доставка и монтаж кухни", "усл", 40000],
  cutPerSheet: ["Распил и кромление, за лист", "лист", 3000], workPct: ["Сборка, % от материалов", "%", 15]
};
// позиция прайса калькулятора -> позиция конфигуратора
const CALC_PRICE_MAP = { ldsp16: "ldsp16", ldsp16f: "ldsp16-fasad", dvp: "dvp3", mdf: "mdf18-film", mdf_plastic: "mdf18-plastic", mdf_enamel: "mdf18-enamel", mirror: "mirror4", mirror_t: "mirror4-tint", glass: "lacobel4",
  top38: "top38", top_compact: "top-compact", top_stone: "top-stone", apron: "apron-panel", edge: "pvc04", edge2: "pvc2",
  handle: "handle", hinge: "hinge", kguide: "kguide", guide: "guide", lift: "lift", leg: "leg", push: "push", gola: "gola", rod: "rod", led: "led", ledpow: "ledpow", dryer: "dryer",
  prof_eco: "prof-eco", prof_std: "prof-std", prof_prem: "prof-prem", kmisc: "fasteners", plinth: "plinth", cutout: "cutout", misc: "kupeMisc", install: "kupeInstall", kinstall: "kitchenInstall", cut: "cutPerSheet", work: "workPct" };
// Список позиций для таблицы "Цены": [id, название, единица, стартовая цена]
function priceRows(S) {
  const cat = MO.defaultCatalog(S.cur || "KZT"), out = [];
  const u = m => m.kind === "sheet" ? "лист" : m.kind === "length" ? "п.м." : "м2";
  Object.keys(cat.materials).forEach(id => out.push([id, cat.materials[id].name, u(cat.materials[id]), cat.materials[id].price]));
  Object.keys(EXTRA_MATS).forEach(id => out.push([id, EXTRA_MATS[id].name, u(EXTRA_MATS[id]), cp(S, EXTRA_MATS[id].price, RUB[id])]));
  Object.keys(cat.edges).forEach(id => out.push([id, cat.edges[id].name, "м", cat.edges[id].price]));
  Object.keys(cat.hardware).forEach(id => out.push([id, cat.hardware[id].name, cat.hardware[id].unit, cat.hardware[id].price]));
  Object.keys(PRICE_NAMED).forEach(id => { const n = PRICE_NAMED[id]; out.push([id, n[0], n[1], id === "workPct" ? 15 : cp(S, n[2], id === "cutPerSheet" ? 1200 : RUB[id])]); });
  return out;
}
// Цены из прайса калькулятора: items - позиции [{id, price | v, mat | m}]. Возвращает { prices, n, markup }.
function pricesFromCalc(items) {
  const prices = {}; let n = 0, markup = null;
  (items || []).forEach(it => {
    if (!it || !it.id) return;
    const v = +(it.price != null ? it.price : it.v);
    if (it.id === "markup" && v >= 0) { markup = v; return; }
    if (it.id === "nest") { prices.sheetMode = v ? "nest" : "usage"; return; }
    if (it.id === "usage" && v >= 30) { prices.sheetUsagePct = v; return; }
    if (it.id === "round" && v >= 1) { prices.roundTo = v; return; }
    const to = CALC_PRICE_MAP[it.id]; if (!to || !(v >= 0) || isNaN(v)) return;
    let p = v;
    // фасад ЛДСП: в калькуляторе цена за лист, здесь - за м2 готового фасада
    if (it.id === "ldsp16f") { const m = it.mat || it.m || {}; p = Math.round(v / ((m.sw || 2800) * (m.sh || 2070) / 1e6 * 0.8)); }
    prices[to] = p; n++;
  });
  return { prices, n, markup };
}

// Материалы, которых нет в стандартном каталоге формата заказа (цены примерные, как в калькуляторе)
const EXTRA_MATS = {
  "ldsp16-fasad":  { name: "Фасад ЛДСП 16 мм", group: "ldsp", kind: "area", t: 16, price: 9000, color: "#d9b98f" },
  "top-compact":   { name: "Столешница компакт-плита", group: "top", kind: "length", t: 12, price: 45000, color: "#2b2c2e" },
  "top-stone":     { name: "Столешница искусственный камень", group: "top", kind: "length", t: 38, price: 90000, color: "#eeedea" },
  "apron-panel":   { name: "Стеновая панель", group: "apron", kind: "length", t: 6, price: 10000, color: "#eeedea" },
  "mirror4-tint":  { name: "Зеркало тонированное 4 мм", group: "glass", kind: "area", t: 4, price: 19000, color: "#5d666c" }
};

// Группы выбора: base - id материала в каталоге заказа, gloss - глянец, decors - что показать клиенту
const GROUPS = {
  facade: [
    { base: "ldsp16-fasad",  title: "ЛДСП",           hint: "Практично и недорого", tier: 1, decors: ["white", "grey", "oaksonoma", "oakvotan", "walnut", "graphite"] },
    { base: "mdf18-film",    title: "МДФ в плёнке",   hint: "Матовые, можно с рамкой", tier: 2, decors: ["white", "vanilla", "cappuccino", "sage", "olive", "bluefog", "graphite", "oaknatur"] },
    { base: "mdf18-plastic", title: "МДФ в пластике", hint: "Глянец, не боится воды", tier: 3, gloss: 1, decors: ["white", "beige", "grey", "terra", "graphite", "black"] },
    { base: "mdf18-enamel",  title: "МДФ эмаль",      hint: "Любой цвет, премиум", tier: 4, custom: 1, decors: ["white", "milk", "sage", "rose", "mustard", "deepblue", "emerald", "black"] }
  ],
  corpus: [
    { base: "ldsp16", title: "ЛДСП", hint: "Корпус и полки", tier: 1, decors: ["white", "grey", "ash", "oaksonoma", "oakvotan", "walnut", "wenge", "graphite"] }
  ],
  top: [
    { base: "top38",       title: "ЛДСП 38 мм",          hint: "Недорого, много рисунков", tier: 1, decors: ["oaknatur", "marblew", "concrete", "stoneblack", "walnut", "white"] },
    { base: "top-compact", title: "Компакт-плита",       hint: "Тонкая, не боится воды", tier: 3, decors: ["black", "white", "concrete", "stonebeige"] },
    { base: "top-stone",   title: "Искусственный камень", hint: "Без швов, мойка в цвет", tier: 4, gloss: 1, decors: ["marblew", "terrazzo", "stonebeige", "marbleb", "stonegrey"] }
  ],
  door: [
    { base: "ldsp16-fasad", title: "ЛДСП", hint: "Цвет вставки", tier: 1, decors: ["white", "grey", "ash", "oaksonoma", "oakvotan", "walnut", "wenge", "graphite"] }
  ],
  mirror: [
    { base: "mirror4",      title: "Зеркало", hint: "", tier: 2, decors: ["mirror"] },
    { base: "mirror4-tint", title: "Тонированное", hint: "", tier: 3, decors: ["mirrorgr", "mirrorbr"] }
  ],
  glass: [
    { base: "lacobel4", title: "Цветное стекло", hint: "Глянцевое стекло лакобель", tier: 3, gloss: 1, decors: ["white", "milk", "beige", "graphite", "black", "emerald", "deepblue", "rose"] }
  ]
};
// Ценовой уровень отделки: ₸₸ / ₽₽ / $$ (если знак валюты длинный, например "сум" - точками)
const tierStr = (n, cur) => { const s = MO.currencyInfo(cur || "KZT").sign; return n > 0 ? (s.length === 1 ? s : "●").repeat(n) : ""; };

// Виды фасада (фрезеровка). add - доплата за м2, только для МДФ в плёнке и эмали
const STYLES = {
  flat:    { n: "Гладкие", add: 0 },
  shaker:  { n: "Рамка", add: 4000 },
  slim:    { n: "Тонкая рамка", add: 4000 },
  classic: { n: "Классика", add: 6000 },
  fluted:  { n: "Рифлёные", add: 9000 },
  slats:   { n: "Рейки", add: 7000 }
};
// Каталог ручек: стартовый пример, дизайнер заменяет своим списком из магазина
const HANDLE_KIND = { bar: "скоба", rail: "рейлинг", knob: "кнопка", shell: "ракушка", edge: "торцевая" };
const HANDLES_DEF = [
  { id: "h1", name: "Скоба 160 мм", kind: "bar", color: "black", len: 160, price: 1500 },
  { id: "h2", name: "Скоба 128 мм", kind: "bar", color: "steel", len: 128, price: 1200 },
  { id: "h3", name: "Скоба латунь 192 мм", kind: "bar", color: "gold", len: 192, price: 3200 },
  { id: "h4", name: "Рейлинг 320 мм", kind: "rail", color: "steel", len: 320, price: 2600 },
  { id: "h5", name: "Рейлинг 480 мм", kind: "rail", color: "black", len: 480, price: 3400 },
  { id: "h6", name: "Кнопка", kind: "knob", color: "gold", len: 30, price: 900 },
  { id: "h7", name: "Ракушка 96 мм", kind: "shell", color: "bronze", len: 96, price: 1800 },
  { id: "h8", name: "Торцевая 200 мм", kind: "edge", color: "black", len: 200, price: 2200 }
];
// Свой каталог дизайнера - цены как он вписал (в валюте проекта); стартовый - пересчитан в валюту проекта.
function handleList(S) { return Array.isArray(S.handleCat) && S.handleCat.length ? S.handleCat : HANDLES_DEF.map(h => Object.assign({}, h, { price: cp(S, h.price, RUB[h.id]) })); }
function handleItem(S) { const L = handleList(S); return L.find(h => h.id === S.kitchen.opts.handle) || L[0]; }
// Список из магазина: строка = "Название; цена; вид; цвет". Разделитель - точка с запятой или табуляция (вставка из Excel)
function parseHandles(text) {
  const out = [];
  String(text || "").split(/\r?\n/).forEach(line => {
    const f = line.split(/[;\t]/).map(x => x.trim()); if (!f[0]) return;
    const low = line.toLowerCase(), price = +(String(f[1] || "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
    if (!price && /назв|цена/.test(low)) return;
    const kind = /рейл/.test(low) ? "rail" : /кноп/.test(low) ? "knob" : /ракуш/.test(low) ? "shell" : /торц|профил/.test(low) ? "edge" : "bar";
    const color = /ч[её]рн|графит/.test(low) ? "black" : /бронз|медь/.test(low) ? "bronze" : /зол|латун/.test(low) ? "gold" : /бел/.test(low) ? "white" : "steel";
    const m = /(\d{2,4})\s*мм/.exec(low);
    out.push({ id: "c" + (out.length + 1), name: f[0].slice(0, 60), kind, color, len: m ? +m[1] : kind === "knob" ? 30 : kind === "rail" ? 320 : 160, price });
  });
  return out.slice(0, 60);
}
function handlesText(L) { const C = { black: "чёрный", steel: "хром", gold: "латунь", bronze: "бронза", white: "белый" }; return L.map(h => [h.name, h.price, HANDLE_KIND[h.kind], C[h.color]].join("; ")).join("\n"); }
// Какие модули клиент может менять нажатием на шкаф
const SWAP = {
  lower: [["shelf", "Дверцы и полка"], ["drawers3", "Три ящика"], ["drawers2", "Два больших ящика"]],
  upper: [["u_shelf", "Дверцы"], ["u_lift", "Подъёмная дверца"], ["u_open", "Открытая полка"], ["u_gap", "Убрать шкаф"]]
};

// Выбранная отделка: { base, decor, color? } -> запись материала каталога
function pickMat(catalog, sel) {
  const src = catalog.materials[sel.base] || EXTRA_MATS[sel.base];
  const m = Object.assign({}, src);
  const d = DECOR[sel.decor];
  const grp = Object.values(GROUPS).flat().find(g => g.base === sel.base);
  if (sel.color) { m.color = sel.color; m.decor = "Свой цвет " + sel.color; m.texture = { kind: "solid" }; }
  else if (d) { m.color = d.c; m.decor = d.n; m.texture = { kind: d.k || "solid", dark: d.d, light: d.l }; }
  m.gloss = !!(grp && grp.gloss) || m.group === "glass";
  return m;
}
function selName(sel) {
  const g = Object.values(GROUPS).flat().find(x => x.base === sel.base);
  return (g ? g.title : "") + ", " + (sel.color ? "свой цвет " + sel.color : (DECOR[sel.decor] || {}).n || "");
}

// ---------- Типы модулей кухни (те же ключи, что в калькуляторе) ----------
const LOWER = {
  shelf:    { name: "Шкаф с полкой", w: 600 },
  sink:     { name: "Под мойку", w: 800 },
  drawers3: { name: "Ящики (3)", w: 600 },
  drawers2: { name: "Ящики (2)", w: 800 },
  oven:     { name: "Под духовку", w: 600 },
  corner:   { name: "Угловой", w: 1000 },
  dish:     { name: "Посудомойка (фасад)", w: 600 },
  gap:      { name: "Проём (плита, холодильник)", w: 600 },
  tall:     { name: "Пенал с полками", w: 600, tall: true },
  fridge:   { name: "Пенал под холодильник", w: 600, tall: true },
  tallOven: { name: "Пенал духовка + СВЧ", w: 600, tall: true }
};
const UPPER = {
  u_shelf:  { name: "Шкаф с полками", w: 600 },
  u_dryer:  { name: "С сушкой", w: 800 },
  u_lift:   { name: "С подъёмником", w: 800 },
  u_hood:   { name: "Над вытяжкой", w: 600 },
  u_corner: { name: "Угловой", w: 600 },
  u_open:   { name: "Открытая полка", w: 400 },
  u_gap:    { name: "Пусто (окно, вытяжка)", w: 600 }
};
const KD = { T: 16, PL: 100, Hl: 720, Dl: 560, Du: 300, TOP_Y: 820, GAP: 600, BK: 4, CL: 600, CU: 320 };
const SHAPES = { I: "Прямая", Lr: "Угол справа", Ll: "Угол слева", U: "П-образная" };
const WALL_NAME = { left: "Стена слева", back: "Стена прямо", right: "Стена справа" };

function kitchenWalls(k) {
  const L = k.len, W = [];
  const left = { key: "left", len: L.left, rot: 90, pos: [0, 0, L.left] };
  const back = { key: "back", len: L.back, rot: 0, pos: [0, 0, 0] };
  const right = { key: "right", len: L.right, rot: 270, pos: [L.back, 0, 0] };
  if (k.shape === "I") W.push(back);
  if (k.shape === "Lr") W.push(back, right);
  if (k.shape === "Ll") W.push(left, back);
  if (k.shape === "U") W.push(left, back, right);
  W.forEach((w, i) => { w.next = i < W.length - 1; w.lowLen = w.len - (w.next ? KD.CL : 0); w.upLen = w.len - (w.next ? KD.CU : 0); });
  return W;
}

function fillWall(usable, seq0) {
  const seq = seq0.filter(Boolean).map(s => Object.assign({}, s));
  const fixedSum = () => seq.reduce((a, s) => a + (s.flex ? 0 : s.w), 0);
  while (fixedSum() > usable) {
    const opts = seq.filter(s => s.opt).sort((a, b) => b.opt - a.opt);
    if (!opts.length) break;
    seq.splice(seq.indexOf(opts[0]), 1);
  }
  let R = usable - fixedSum();
  if (R < 0) for (const s of seq.filter(x => !x.flex && x.min).sort((a, b) => b.w - a.w)) {
    const d = Math.min(s.w - s.min, -R); s.w -= d; R += d; if (R >= 0) break;
  }
  const flex = seq.filter(s => s.flex).sort((a, b) => a.flex - b.flex);
  const alloc = new Map(flex.map(f => [f, []]));
  if (flex.length && R >= 150) {
    let n = Math.max(1, Math.round(R / 600));
    while (R / n > 900) n++;
    while (n > 1 && R / n < 300) n--;
    const base = Math.round(R / n / 10) * 10;
    for (let i = 0; i < n; i++) alloc.get(flex[i % flex.length]).push(i === n - 1 ? R - base * (n - 1) : base);
  } else if (R > 0) {
    const s = seq.find(x => !x.flex && x.grow) || seq.find(x => !x.flex);
    if (s) s.w += R;
  }
  const TY = ["drawers3", "shelf", "drawers2", "shelf"]; let ti = 0;
  const out = [];
  seq.forEach(s => {
    if (s.flex) alloc.get(s).forEach(w => out.push({ t: w < 300 ? "shelf" : TY[ti++ % 4], w }));
    else out.push(s.what ? { t: s.t, w: s.w, what: s.what } : { t: s.t, w: s.w });
  });
  return out;
}

function autoUpper(lower, wall) {
  const up = [];
  let talls = 0;
  lower.forEach(m => {
    if (LOWER[m.t].tall) { talls += m.w; return; }
    let t = m.t === "sink" ? (m.w >= 500 ? "u_dryer" : "u_shelf") : m.t === "oven" ? "u_hood" : m.t === "corner" ? "u_corner"
      : m.t === "gap" ? (m.what === "stove" ? "u_hood" : "u_gap") : "u_shelf";
    up.push({ t, w: m.w });
  });
  const rem = wall.upLen - talls - up.reduce((a, m) => a + m.w, 0);
  if (rem >= 150) up.push({ t: "u_shelf", w: rem });
  else if (rem > 0 && up.length) { const last = [...up].reverse().find(m => m.t !== "u_hood" && m.t !== "u_gap") || up[up.length - 1]; last.w += rem; }
  return up;
}

// Автоматическая расстановка модулей по длинам стен
function autoKitchen(k) {
  const W = kitchenWalls(k), o = k.opts, n = W.length;
  const F = o.fridge === "tall" ? { t: "fridge", w: 600, opt: 2 } : o.fridge === "gap" ? { t: "gap", w: 600, what: "fridge", opt: 2 } : null;
  const SINK = { t: "sink", w: 600, min: 450, grow: 1 };
  const DISH = o.dish ? { t: "dish", w: 600, min: 450, opt: 1 } : null;
  const COOK = o.stove === "builtin" ? { t: "oven", w: 600 } : { t: "gap", w: 600, what: "stove" };
  const C = () => ({ t: "corner", w: 1000, min: 800, grow: 1 });
  const fl = p => ({ flex: p });
  let seqs;
  if (n === 1) seqs = [[F, fl(3), SINK, DISH, fl(1), COOK, fl(2)]];
  if (n === 2) seqs = [[F, fl(2), SINK, DISH, fl(1)], [C(), fl(1), COOK, fl(2)]];
  if (n === 3) seqs = [[F, fl(1)], [C(), fl(2), SINK, DISH, fl(1)], [C(), fl(1), COOK, fl(2)]];
  return W.map((w, i) => {
    const lower = fillWall(w.lowLen, seqs[i]);
    return { lower, upper: o.upper ? autoUpper(lower, w) : [] };
  });
}
function kitchenLayout(k) {
  if (k.manual && k.manual.length === kitchenWalls(k).length) return k.manual;
  const lay = autoKitchen(k);
  Object.keys(k.over || {}).forEach(key => {
    const [wi, row, i] = key.split(":"), m = lay[+wi] && lay[+wi][row] && lay[+wi][row][+i];
    if (m && SWAP[row].some(x => x[0] === m.t) && SWAP[row].some(x => x[0] === k.over[key])) m.t = k.over[key];
  });
  return lay;
}

// ---------- Сборщик деталей ----------
function Maker() {
  let pid = 0, mid = 0;
  const hw = {};
  return {
    hw,
    H(item, qty, extra) { if (qty <= 0) return; const key = item || extra.name; if (!hw[key]) hw[key] = Object.assign(item ? { item } : {}, extra || {}, { qty: 0 }); hw[key].qty = Math.round((hw[key].qty + qty) * 100) / 100; },
    module(kind, name, wall, x0, size, params) {
      const r = wall.rot, c = r === 90 ? 0 : r === 180 ? -1 : r === 270 ? 0 : 1, s = r === 90 ? 1 : r === 180 ? 0 : r === 270 ? -1 : 0;
      return { id: "m" + (++mid), kind, name, pos: { x: x0 * c + wall.pos[0], y: 0, z: -x0 * s + wall.pos[2] }, rot: r, size, params: params || {}, parts: [], hardware: [], wall: wall.key };
    },
    P(list, name, role, o, x, y, z, a, b, mat, more) {
      const p = { id: "p" + (++pid), name, role, mat: mat || "@corpus", o, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, z: Math.round(z * 10) / 10, a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10 };
      if (!mat || mat === "@corpus") p.edges = { front: "@edge" };
      if (more) Object.assign(p, more);
      if (p.edges === null || o === "Z") delete p.edges;
      list.push(p); return p;
    }
  };
}
const hingesFor = h => h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5;

function buildKitchen(k, mk, hItem) {
  const { T, PL, Hl, Dl, Du, TOP_Y, GAP, BK, CL, CU } = KD;
  const o = k.opts, Hu = +o.Hu || 720;
  const walls = kitchenWalls(k), lay = kitchenLayout(k);
  const topId = k._topT || 38;
  const upY = TOP_Y + topId + GAP;                 // низ верхних шкафов
  const upTop = upY + Hu;                          // верх кухни
  const Ht = upTop - PL;                           // высота корпуса пенала
  const modules = [], warns = [];
  let handles = 0, golaMM = 0, topMM = 0, plinthMM = 0, ledMM = 0, nMods = 0, hasSink = false, hasHob = false;

  const body = (m, w, y0, h, d, shelves, opt) => {
    opt = opt || {};
    const P = mk.P, L = m.parts, dk = d - BK;
    P(L, "Боковина левая", "side", "X", 0, y0, BK, h, dk);
    P(L, "Боковина правая", "side", "X", w - T, y0, BK, h, dk);
    P(L, "Дно", "bottom", "Y", T, y0, BK, w - 2 * T, dk);
    if (opt.stretch) { P(L, "Планка передняя", "other", "Y", T, y0 + h - T, d - 100, w - 2 * T, 100); P(L, "Планка задняя", "other", "Y", T, y0 + h - T, BK, w - 2 * T, 100, "@corpus", { edges: null }); }
    else P(L, "Крыша", "top", "Y", T, y0 + h - T, BK, w - 2 * T, dk);
    if (!opt.noBack) P(L, "Задняя стенка", "back", "Z", 2, y0 + 2, 0, w - 4, h - 4, "@back");
    for (let i = 1; i <= (shelves || 0); i++) P(L, "Полка", "shelf", "Y", T, Math.round(y0 + T + (h - 2 * T) * i / (shelves + 1) - T / 2), BK, w - 2 * T, dk - 20);
    mk.H("fasteners", 1); nMods++;
  };
  const front = (m, name, x, y, w, h, d, handle) => mk.P(m.parts, name, "facade", "Z", x + 1.5, y + 1.5, d, w - 3, h - 3, "@facade", handle ? { handle } : null);
  // распашные двери: up - ручка сверху (нижние шкафы) или снизу (верхние)
  const doors = (m, x0, y0, w, h, d, at, single) => {
    if (w < 100) return;
    const n = (single || w <= 450) ? 1 : 2;
    for (let i = 0; i < n; i++) front(m, n > 1 ? (i ? "Дверь правая" : "Дверь левая") : "Дверь", x0 + i * w / n, y0, w / n, h, d, { side: n > 1 ? (i ? "l" : "r") : "r", at });
    mk.H("hinge", n * hingesFor(h)); handles += n;
  };
  const drawer = (m, w, y0, hF, idx) => {
    const P = mk.P, L = m.parts, bh = Math.max(50, Math.min(180, hF - 70)), bx = T + 13, bw = w - 2 * T - 26, bd = Dl - 80;
    front(m, "Фасад ящика " + idx, 0, y0, w, hF, Dl, { side: "c", at: "t" });
    P(L, "Ящик " + idx + ": бок", "drawer", "X", bx, y0 + 30, 40, bh, bd);
    P(L, "Ящик " + idx + ": бок", "drawer", "X", bx + bw - T, y0 + 30, 40, bh, bd);
    P(L, "Ящик " + idx + ": перед", "drawer", "Z", bx + T, y0 + 30, 40 + bd - T, bw - 2 * T, bh, "@corpus");
    P(L, "Ящик " + idx + ": зад", "drawer", "Z", bx + T, y0 + 30, 40, bw - 2 * T, bh, "@corpus");
    P(L, "Ящик " + idx + ": дно", "drawer", "Y", bx, y0 + 27, 40, bw, bd, "@back");
    mk.H("kguide", 1); handles++;
  };

  walls.forEach((wall, wi) => {
    const row = lay[wi] || { lower: [], upper: [] };
    let x = 0; const talls = [], spans = [];
    let span = null;
    row.lower.forEach((md, mi) => {
      const def = LOWER[md.t] || LOWER.shelf, w = Math.max(150, Math.min(1400, +md.w || def.w)), t = LOWER[md.t] ? md.t : "shelf";
      const m = mk.module("lower-" + t, def.name + " " + w, wall, x, { w, h: def.tall ? Ht : Hl, d: Dl }, md.what ? { what: md.what } : {});
      m.slot = wi + ":lower:" + mi;
      const isTop = !def.tall && t !== "gap";
      if (isTop) { if (!span) { span = { x0: x, x1: x }; spans.push(span); } span.x1 = x + w; topMM += w; golaMM += w * 1.5; } else span = null;
      if (def.tall) talls.push([x, x + w]);
      if (t !== "gap") plinthMM += w;
      switch (t) {
        case "shelf": body(m, w, PL, Hl, Dl, 1, { stretch: 1 }); doors(m, 0, PL, w, Hl, Dl, "t"); mk.H("leg", 4); break;
        case "sink": body(m, w, PL, Hl, Dl, 0, { stretch: 1, noBack: 1 }); doors(m, 0, PL, w, Hl, Dl, "t"); mk.H("leg", 4); hasSink = true; break;
        case "drawers3": body(m, w, PL, Hl, Dl, 0, { stretch: 1 }); for (let i = 0; i < 3; i++) drawer(m, w, PL + i * Hl / 3, Hl / 3, i + 1); mk.H("leg", 4); break;
        case "drawers2": body(m, w, PL, Hl, Dl, 0, { stretch: 1 }); drawer(m, w, PL, Hl * 0.6, 1); drawer(m, w, PL + Hl * 0.6, Hl * 0.4, 2); mk.H("leg", 4); break;
        case "oven": body(m, w, PL, Hl, Dl, 0, { stretch: 1, noBack: 1 }); drawer(m, w, PL, 120, 1); mk.H("leg", 4); hasHob = true; break;
        case "corner": {
          body(m, w, PL, Hl, Dl, 1, { stretch: 1 });
          const blind = wi > 0 && x === 0 ? CL : 0;
          if (blind) mk.P(m.parts, "Заглушка угла", "filler", "Z", blind - 60, PL + T, Dl - T, 60, Hl - 2 * T, "@corpus");
          doors(m, blind, PL, w - blind, Hl, Dl, "t", w - blind <= 500); mk.H("leg", 4); break;
        }
        case "dish": front(m, "Фасад посудомойки", 0, PL, w, Hl, Dl, { side: "c", at: "t" }); handles++; nMods++; break;
        case "gap": if (md.what === "stove") hasHob = true; break;
        case "tall": { body(m, w, PL, Ht, Dl, 4); const h1 = Math.round(Ht * 0.6); doors(m, 0, PL, w, h1, Dl, "t"); doors(m, 0, PL + h1, w, Ht - h1, Dl, "b"); mk.H("leg", 4); break; }
        case "fridge": { body(m, w, PL, Ht, Dl, 1); const h1 = Math.round(Ht * 0.62);
          front(m, "Фасад холодильника нижний", 0, PL, w, h1, Dl, { side: "r", at: "t" }); front(m, "Фасад холодильника верхний", 0, PL + h1, w, Ht - h1, Dl, { side: "r", at: "b" }); handles += 2; mk.H("leg", 4); break; }
        case "tallOven": { body(m, w, PL, Ht, Dl, 2); drawer(m, w, PL, 250, 1); drawer(m, w, PL + 250, 250, 2);
          doors(m, 0, PL + 1480, w, Ht - 1480, Dl, "b", w <= 600); mk.H("leg", 4); break; }
      }
      if (["shelf", "sink", "corner"].includes(t) && w > 1100 && t !== "corner") warns.push(WALL_NAME[wall.key] + ': "' + def.name + '" шириной ' + w + " мм - двери будут тяжёлыми.");
      modules.push(m);
      x += w;
    });
    const lowSum = x;
    if (lowSum > wall.lowLen + 1) warns.push(WALL_NAME[wall.key] + ": нижний ряд длиннее стены на " + Math.round(lowSum - wall.lowLen) + " мм.");
    else if (wall.lowLen - lowSum >= 50) warns.push(WALL_NAME[wall.key] + ": внизу свободно " + Math.round(wall.lowLen - lowSum) + " мм.");

    // верхний ряд обходит пеналы
    let ux = 0;
    row.upper.forEach((md, mi) => {
      const def = UPPER[md.t] || UPPER.u_shelf, w = Math.max(150, Math.min(1400, +md.w || def.w)), t = UPPER[md.t] ? md.t : "u_shelf";
      let moved = true;
      while (moved) { moved = false; for (const [a, b] of talls) if (ux < b - 0.5 && ux + w > a + 0.5) { ux = b; moved = true; } }
      const m = mk.module("upper-" + t.slice(2), def.name + " " + w, wall, ux, { w, h: t === "u_hood" ? 360 : Hu, d: Du });
      m.slot = wi + ":upper:" + mi;
      switch (t) {
        case "u_shelf": body(m, w, upY, Hu, Du, Hu > 800 ? 2 : 1); doors(m, 0, upY, w, Hu, Du, "b"); break;
        case "u_dryer": body(m, w, upY, Hu, Du, 0); doors(m, 0, upY, w, Hu, Du, "b"); mk.H("dryer", 1); break;
        case "u_lift":
          body(m, w, upY, Hu, Du, 1);
          if (Hu > 800) { front(m, "Фасад подъёмный нижний", 0, upY, w, Hu / 2, Du, { side: "c", at: "b" }); front(m, "Фасад подъёмный верхний", 0, upY + Hu / 2, w, Hu / 2, Du, { side: "c", at: "b" }); mk.H("lift", 2); handles += 2; }
          else { front(m, "Фасад подъёмный", 0, upY, w, Hu, Du, { side: "c", at: "b" }); mk.H("lift", 1); handles++; }
          break;
        case "u_hood": body(m, w, upTop - 360, 360, Du, 0); front(m, "Фасад над вытяжкой", 0, upTop - 360, w, 360, Du, { side: "c", at: "b" }); mk.H("lift", 1); handles++; break;
        case "u_corner": {
          body(m, w, upY, Hu, Du, 1);
          const blind = wi > 0 && ux === 0 ? CU : 0;
          if (blind) mk.P(m.parts, "Заглушка угла", "filler", "Z", blind - 40, upY + T, Du - T, 40, Hu - 2 * T, "@corpus");
          doors(m, blind, upY, w - blind, Hu, Du, "b", w - blind <= 500); break;
        }
        case "u_open": body(m, w, upY, Hu, Du, 1); break;
      }
      if (t !== "u_gap") { ledMM += w; modules.push(m); }
      ux += w;
    });
    if (ux > wall.upLen + 1) warns.push(WALL_NAME[wall.key] + ": верхний ряд выходит за стену на " + Math.round(ux - wall.upLen) + " мм.");

    // столешница и стеновая панель по стене
    if (spans.length) {
      const run = mk.module("wall-run", WALL_NAME[wall.key] + ": столешница", wall, 0, { w: wall.len, h: topId, d: 600 });
      spans.forEach((s, si) => {
        const len = s.x1 - s.x0;
        mk.P(run.parts, "Столешница", "countertop", "Y", s.x0, TOP_Y, 0, len, 600, "@top", { grain: "a" });
        if (o.apron) {
          const ext = wall.next && si === spans.length - 1 && Math.abs(s.x1 - wall.lowLen) < 2 ? CL - 6 : 0;
          mk.P(run.parts, "Стеновая панель", "apron", "Z", s.x0, TOP_Y + topId, 0, len + ext, GAP, "@apron", { grain: "a" });
        }
      });
      modules.push(run);
    }
  });

  if (!hasSink) warns.push("Нет модуля под мойку.");
  // фурнитура
  if (o.handles === "gola") mk.H("gola", Math.ceil((golaMM + ledMM) / 100) / 10);
  else if (o.handles === "push") mk.H("push", handles);
  else if (hItem) mk.H(null, handles, { name: "Ручка: " + hItem.name, unit: "шт", price: hItem.price });
  else mk.H("handle", handles);
  mk.H(null, Math.ceil(plinthMM / 100) / 10, { name: "Цоколь кухни", unit: "м", price: pz("plinth", cp(k, 2500, RUB.plinth)) });
  const cuts = (hasSink ? 1 : 0) + (hasHob && o.stove === "builtin" ? 1 : 0);
  if (cuts) mk.H(null, cuts, { name: "Вырез под мойку / варочную панель", unit: "шт", price: pz("cutout", cp(k, 5000, RUB.cutout)) });
  if (o.led && ledMM) { mk.H("led", Math.ceil(ledMM / 100) / 10); mk.H("ledpow", 1); }

  const bx = walls.some(w => w.key === "right") ? k.len.back : Math.max(k.len.back || 0, 600);
  const size = { w: k.shape === "Ll" ? Math.max(k.len.back, 600) : bx, h: upTop, d: Math.max(600, k.shape !== "I" ? Math.max(walls.find(w => w.key === "left") ? k.len.left : 0, walls.find(w => w.key === "right") ? k.len.right : 0) : 600) };
  return { modules, warns, size, upTop, upY, Ht, walls, lay, topMM };
}

// ---------- Шкаф-купе ----------
const KUPE_FILL = {
  shelves: { name: "Полки", shelves: 5, rod: false, drawers: 0 },
  rod:     { name: "Штанга", shelves: 1, rod: true, drawers: 0 },
  rodDr:   { name: "Штанга и ящики", shelves: 0, rod: true, drawers: 2 },
  shDr:    { name: "Полки и ящики", shelves: 3, rod: false, drawers: 3 }
};
const DOOR_FILL = { ldsp: "ЛДСП", mirror: "Зеркало", glass: "Цветное стекло", combo: "ЛДСП + зеркало" };
const KUPE_KIND = { korp: "Корпусный", semi: "К одной стене", built: "Встроенный в нишу" };
const PROF = { eco: "эконом", std: "стандарт", prem: "премиум" };

function kupeGeom(q) {
  const T = 16, BASE = 80, BK = 4;
  const W = q.W, H = q.H, D = q.D, m = q.doors.length;
  const sides = q.kind === "korp" ? 2 : q.kind === "semi" ? 1 : 0, roof = q.kind !== "built";
  const x0 = sides >= 1 ? T : 0, inW = W - sides * T, Dk = D - 100;
  const n = q.sections.length, secW = (inW - T * (n - 1)) / n;
  const yb = BASE + T, yt = roof ? H - T : H;
  const doorW = m > 1 ? (inW + 25 * (m - 1)) / m : inW, doorY = yb + 6, doorH = yt - yb - 12;
  const doorRects = q.doors.map((f, j) => ({ fill: f, x: x0 + (m > 1 ? j * (inW - doorW) / (m - 1) : 0), y: doorY, w: doorW, h: doorH, z: Dk + BK + 22 + (j % 2) * 38 }));
  return { T, BASE, BK, W, H, D, m, sides, roof, x0, inW, Dk, n, secW, yb, yt, doorRects };
}

function buildKupe(q, mk) {
  const g = kupeGeom(q), { T, BASE, BK, W, H, x0, inW, Dk, n, secW, yb, yt } = g;
  const parts = [], P = (...a) => mk.P(parts, ...a), warns = [], rods = [];
  if (g.sides >= 1) P("Боковина левая", "side", "X", 0, 0, BK, H, Dk);
  if (g.sides >= 2) P("Боковина правая", "side", "X", W - T, 0, BK, H, Dk);
  if (g.roof) P("Крыша", "top", "Y", x0, H - T, BK, inW, Dk);
  P("Дно", "bottom", "Y", x0, BASE, BK, inW, Dk);
  P("Цоколь", "plinth", "Z", x0, 0, Dk - 40, inW, BASE, "@corpus");
  for (let i = 1; i < n; i++) P("Перегородка " + i, "partition", "X", x0 + i * (secW + T) - T, yb, BK, yt - yb, Dk);
  let drawersN = 0, rodM = 0;
  q.sections.forEach((key, i) => {
    const s = KUPE_FILL[key] || KUPE_FILL.shelves, sx = x0 + i * (secW + T), DH = 200;
    let y = yb;
    for (let d = 0; d < s.drawers; d++) {
      const yy = yb + d * DH, bw = secW - 26, bd = Dk - 80;
      P("Фасад ящика", "drawer", "Z", sx + 2, yy + 2, BK + Dk - T - 20, secW - 4, DH - 4, "@corpus");
      P("Ящик: бок", "drawer", "X", sx + 13, yy + 30, BK + 20, DH - 70, bd);
      P("Ящик: бок", "drawer", "X", sx + 13 + bw - T, yy + 30, BK + 20, DH - 70, bd);
      P("Ящик: перед", "drawer", "Z", sx + 13 + T, yy + 30, BK + 20 + bd - T, bw - 2 * T, DH - 70, "@corpus");
      P("Ящик: зад", "drawer", "Z", sx + 13 + T, yy + 30, BK + 20, bw - 2 * T, DH - 70, "@corpus");
      P("Ящик: дно", "drawer", "Y", sx + 13, yy + 27, BK + 20, bw, bd, "@back");
      drawersN++;
    }
    if (s.drawers) { y = yb + s.drawers * DH; P("Полка над ящиками", "shelf", "Y", sx, y, BK, secW, Dk - 20); y += T; }
    let top = yt;
    if (s.rod) {
      const hat = yt - 320;
      P("Полка верхняя", "shelf", "Y", sx, hat, BK, secW, Dk - 20);
      rods.push({ x: sx, y: hat - 70, z: BK + Dk / 2, len: secW }); rodM += secW / 1000;
      top = hat - 1050;
      if (top - y < 0 && s.drawers) warns.push("Секция " + (i + 1) + ": под штангой мало места для одежды.");
    }
    const cnt = s.rod ? Math.min(s.shelves, Math.max(0, Math.floor((top - y) / 300))) : s.shelves;
    for (let j = 1; j <= cnt; j++) P("Полка", "shelf", "Y", sx, Math.round(y + (top - y) * j / (cnt + (s.rod ? 0 : 1)) - (s.rod ? T : T / 2)), BK, secW, Dk - 20);
    if (secW > 1000) warns.push("Секция " + (i + 1) + ": ширина " + Math.round(secW) + " мм - полки будут прогибаться.");
  });
  if (q.back !== false) {
    const nb = Math.ceil((W - 4) / 1690);
    for (let i = 0; i < nb; i++) P("Задняя стенка", "back", "Z", 2 + i * (W - 4) / nb, BASE, 0, (W - 4) / nb, H - BASE - 2, "@back");
  }
  g.doorRects.forEach((d, j) => {
    const px = 26, py = 36, iw = d.w - 2 * px, ih = d.h - 2 * py, nm = "Дверь " + (j + 1) + ": ";
    const fz = t => d.z + (16 - t) / 2;
    if (d.fill === "combo") {
      const h1 = Math.round(ih * 0.5);
      P(nm + "вставка ЛДСП", "facade", "Z", d.x + px, d.y + py, fz(16), iw, h1 - 6, "@facade", { door: j });
      P(nm + "зеркало", "facade", "Z", d.x + px, d.y + py + h1 + 6, fz(4), iw, ih - h1 - 6, "@mirror", { door: j });
    } else P(nm + (d.fill === "mirror" ? "зеркало" : d.fill === "glass" ? "стекло" : "вставка ЛДСП"), "facade", "Z", d.x + px, d.y + py, fz(d.fill === "ldsp" ? 16 : 4), iw, ih, d.fill === "mirror" ? "@mirror" : d.fill === "glass" ? "@glass" : "@facade", { door: j });
    if (d.w > 1050) warns.push("Дверь шире 1 м - тяжело двигать, лучше добавить ещё одну дверь.");
  });
  mk.H("prof-" + (q.prof || "std"), g.m);
  mk.H("guide", drawersN);
  mk.H("rod", Math.ceil(rodM * 10) / 10);
  mk.H(null, 1, { name: "Крепёж и опоры", unit: "компл", price: pz("kupeMisc", cp(q, 6000, RUB.kupeMisc)) });
  return { parts, warns, rods, geom: g, size: { w: W, h: H, d: q.D } };
}

// ---------- Состояние и заказ ----------
function defaultState() {
  return {
    v: 1, type: "kitchen",
    kitchen: {
      shape: "Lr", len: { left: 2200, back: 3000, right: 2200 }, manual: null,
      opts: { upper: true, Hu: 720, fridge: "tall", stove: "builtin", dish: true, apron: true, led: true, handles: "std", handle: "h1", style: "flat" }, over: {},
      fin: { facade: { base: "mdf18-film", decor: "sage" }, corpus: { base: "ldsp16", decor: "white" }, top: { base: "top38", decor: "oaknatur" } }
    },
    kupe: {
      W: 2400, H: 2400, D: 600, kind: "korp", prof: "std", profColor: "silver", back: true,
      doors: ["ldsp", "mirror", "ldsp"], sections: ["shDr", "rod", "shelves"],
      fin: { door: { base: "ldsp16-fasad", decor: "oaksonoma" }, corpus: { base: "ldsp16", decor: "oaksonoma" }, mirror: { base: "mirror4", decor: "mirror" }, glass: { base: "lacobel4", decor: "milk" } }
    },
    room: { wall: "#e9e6df", floor: "oak" },
    studio: { name: "Мебель на заказ", wa: "" },
    lock: false, showPrice: true, markup: 30, cur: MO.region().currency,
    client: { name: "", phone: "", note: "" },
    handleCat: null, prices: null, pricesFrom: "",
    ext: null, extFin: {}
  };
}

const HANDLE_NAME = { std: "ручки-скобы", gola: "без ручек, профиль Gola", push: "без ручек, открывание нажатием" };

function buildOrder(S) {
  const order = MO.create({ title: S.type === "kupe" ? "Шкаф-купе" : "Кухня", currency: S.cur || "KZT" });
  order.id = S.orderId || order.id;
  S.kitchen.cur = S.kupe.cur = order.currency;   // генераторам изделий - для цен фурнитуры
  Object.keys(EXTRA_MATS).forEach(id => { order.catalog.materials[id] = Object.assign({}, EXTRA_MATS[id], { price: cp(S, EXTRA_MATS[id].price, RUB[id]) }); });
  PRICE_OVR = S.prices && typeof S.prices === "object" ? S.prices : {};
  order.catalog.materials.top38.slab = 3000;   // столешница ЛДСП покупается плитами по 3 м
  ["materials", "edges", "hardware"].forEach(g => Object.keys(order.catalog[g]).forEach(id => { order.catalog[g][id].price = pz(id, order.catalog[g][id].price); }));
  order.pricing.workPct = pz("workPct", order.pricing.workPct); order.pricing.cutPerSheet = pz("cutPerSheet", order.pricing.cutPerSheet);
  if (PRICE_OVR.sheetMode === "usage") order.pricing.sheetMode = "usage";
  order.pricing.sheetUsagePct = pz("sheetUsagePct", order.pricing.sheetUsagePct); order.pricing.roundTo = pz("roundTo", order.pricing.roundTo);
  order.pricing.markupPct = +S.markup >= 0 ? +S.markup : 30;
  order.client = { name: S.client.name || "", phone: S.client.phone || "", address: "" };
  if (S.client.note) order.notes = S.client.note;
  const mk = Maker(), cat = order.catalog;
  const use = (role, sel, finish) => { cat.materials[sel.base] = pickMat(cat, sel); finish[role] = sel.base; };
  let product, info;
  if (S.type === "kupe") {
    const q = S.kupe, finish = { back: "dvp3", edge: "pvc04" };
    use("corpus", q.fin.corpus, finish); use("facade", q.fin.door, finish); use("mirror", q.fin.mirror, finish); use("glass", q.fin.glass, finish);
    info = buildKupe(q, mk);
    const fills = q.doors.map(f => DOOR_FILL[f].toLowerCase());
    product = MO.newProduct({
      id: "pr1", type: "kupe", name: "Шкаф-купе", size: info.size, finish, parts: info.parts, hardware: Object.values(mk.hw),
      params: { configurator: 1, kind: q.kind, doors: q.doors, sections: q.sections, prof: q.prof, profColor: q.profColor },
      generator: { id: "configurator-kupe", version: 1 },
      describe: [
        "Шкаф-купе " + KUPE_KIND[q.kind].toLowerCase() + ", " + q.W + "x" + q.H + "x" + q.D + " мм (ШxВxГ)",
        "Корпус: " + selName(q.fin.corpus),
        "Двери: " + g_doorsText(q),
        "Профиль дверей: " + PROF[q.prof] + ", " + PROF_COLOR[q.profColor].n.toLowerCase(),
        "Внутри: " + q.sections.map(s => KUPE_FILL[s].name.toLowerCase()).join(" / ")
      ]
    });
    order.extras.push({ id: "x1", kind: "install", name: "Доставка и монтаж шкафа", qty: 1, unit: "усл", price: pz("kupeInstall", cp(S, 15000, RUB.kupeInstall)) });
  } else {
    const k = S.kitchen, finish = { back: "dvp3", edge: "pvc04" };
    use("corpus", k.fin.corpus, finish); use("facade", k.fin.facade, finish); use("top", k.fin.top, finish);
    cat.materials["apron-panel"] = Object.assign({}, EXTRA_MATS["apron-panel"], { price: pz("apron-panel", cp(S, EXTRA_MATS["apron-panel"].price, RUB["apron-panel"])), color: cat.materials[finish.top].color, decor: cat.materials[finish.top].decor, texture: cat.materials[finish.top].texture, gloss: cat.materials[finish.top].gloss });
    finish.apron = "apron-panel";
    k._topT = cat.materials[finish.top].t;
    const hItem = handleItem(S), stl = STYLES[k.opts.style] ? k.opts.style : "flat";
    info = buildKitchen(k, mk, hItem);
    const walls = info.walls, o = k.opts;
    const facArea = info.modules.reduce((s, m) => s + m.parts.filter(p => p.role === "facade").reduce((a, p) => a + p.a * p.b / 1e6, 0), 0);
    product = MO.newProduct({
      id: "pr1", type: "kitchen", name: "Кухня " + ({ I: "прямая", Lr: "угловая", Ll: "угловая", U: "П-образная" })[k.shape], size: info.size, finish,
      modules: info.modules, hardware: Object.values(mk.hw),
      params: { configurator: 1, shape: k.shape, walls: walls.map((w, i) => ({ name: w.key, len: w.len, lower: info.lay[i].lower, upper: info.lay[i].upper })), lowerH: KD.Hl, upperH: o.Hu, handles: o.handles, handle: o.handles === "std" ? hItem : null, style: stl },
      generator: { id: "configurator-kitchen", version: 1, manual: !!k.manual },
      describe: [
        "Кухня " + ({ I: "прямая", Lr: "угловая", Ll: "угловая", U: "П-образная" })[k.shape] + ", " + walls.map(w => w.len).join(" + ") + " мм",
        "Фасады: " + selName(k.fin.facade) + (stl !== "flat" ? ", " + STYLES[stl].n.toLowerCase() : "") + ", " + (o.handles === "std" ? "ручки: " + hItem.name : HANDLE_NAME[o.handles]),
        "Корпус: " + selName(k.fin.corpus),
        "Столешница: " + selName(k.fin.top) + ", " + (Math.ceil(info.topMM / 100) / 10) + " п.м." + (o.apron ? ", стеновая панель в цвет" : ""),
        "Верхние шкафы: " + (o.upper ? o.Hu + " мм" : "нет") + (o.led && o.upper ? ", подсветка рабочей зоны" : ""),
        "Техника в цену не входит: " + [o.stove === "builtin" ? "духовка и варочная панель" : "плита", o.fridge === "tall" ? "встроенный холодильник" : o.fridge === "gap" ? "холодильник" : "", o.dish ? "посудомойка" : "", "мойка"].filter(Boolean).join(", ")
      ]
    });
    if (STYLES[stl].add && /film|enamel/.test(finish.facade)) order.extras.push({ id: "x2", kind: "item", name: "Фрезеровка фасадов: " + STYLES[stl].n.toLowerCase(), qty: Math.round(facArea * 100) / 100, unit: "м2", price: cp(S, STYLES[stl].add, RUB[stl]) });
    order.extras.push({ id: "x1", kind: "install", name: "Доставка и монтаж кухни", qty: 1, unit: "усл", price: pz("kitchenInstall", cp(S, 40000, RUB.kitchenInstall)) });
  }
  order.products.push(product);
  MO.recalc(order);
  return { order, product, info };
}
const PROF_COLOR = { silver: { n: "Серебро", c: "#c9cdd0" }, black: { n: "Чёрный", c: "#232426" }, champagne: { n: "Шампань", c: "#cdb894" } };
const HANDLE_COLOR = { black: { n: "Чёрные", c: "#1c1d1f" }, steel: { n: "Сталь", c: "#b9bdc1" }, gold: { n: "Латунь", c: "#b8965a" }, bronze: { n: "Бронза", c: "#7a5a3c" }, white: { n: "Белые", c: "#ecebe8" } };
function g_doorsText(q) {
  const cnt = {}; q.doors.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
  return q.doors.length + " шт. - " + Object.keys(cnt).map(f => DOOR_FILL[f].toLowerCase() + (f === "ldsp" || f === "combo" ? " (" + DECOR[q.fin.door.decor].n.toLowerCase() + ")" : f === "glass" ? " (" + (q.fin.glass.color || DECOR[q.fin.glass.decor].n.toLowerCase()) + ")" : f === "mirror" ? " (" + DECOR[q.fin.mirror.decor].n.toLowerCase().replace("зеркало ", "") + ")" : "") + " x" + cnt[f]).join(", ");
}

// Чужой заказ (из калькулятора или файла): переводим материалы деталей на роли, чтобы отделка менялась одним полем
function adoptOrder(order) {
  const roles = {};
  (order.products || []).forEach(pr => {
    pr.finish = pr.finish || {};
    const each = part => {
      if (typeof part.mat !== "string" || part.mat[0] === "@") return;
      const m = order.catalog.materials[part.mat]; if (!m) return;
      let role = null;
      if (part.role === "countertop" || m.group === "top") role = "top";
      else if (part.role === "facade" && m.group !== "glass") role = "facade";
      else if (m.group === "ldsp") role = "corpus";
      if (!role) return;
      if (!pr.finish[role]) pr.finish[role] = part.mat;
      if (pr.finish[role] === part.mat) part.mat = "@" + role;
    };
    (pr.parts || []).forEach(each); (pr.modules || []).forEach(m => (m.parts || []).forEach(each));
    Object.keys(pr.finish).forEach(r => roles[r] = 1);
  });
  return roles;
}
