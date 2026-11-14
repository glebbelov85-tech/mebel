/*!
 * mebel-order.js - общий формат заказа "Мебельный конструктор", версия 1.1
 *
 * Один файл без зависимостей. Работает в браузере (<script src> или вставить целиком
 * в <script> одной HTML-страницы - появится глобальный объект MebelOrder) и в Node (require).
 *
 * Главное:
 *   MebelOrder.create()            - новый пустой заказ с настройками по умолчанию
 *   MebelOrder.parse(text)         - прочитать JSON (в том числе старый расчёт калькулятора)
 *   MebelOrder.validate(order)     - проверка: ошибки и предупреждения по-русски
 *   MebelOrder.migrate(obj)        - привести любой старый вариант к текущей версии
 *   MebelOrder.stringify(order)    - JSON для файла *.mebel.json
 *   MebelOrder.toLink / fromLink   - заказ в ссылке (для WhatsApp)
 *   MebelOrder.forClient(order)    - копия без себестоимости и наценки
 *   MebelOrder.listParts(order)    - все детали заказа плоским списком
 *   MebelOrder.cutList(order)      - список на распил (длина, ширина, текстура, кромка по 4 сторонам)
 *   MebelOrder.facadeList(order)   - фасады по размерам для заказа на фабрике
 *   MebelOrder.bom(order)          - расход материалов, кромки, фурнитуры
 *   MebelOrder.quote(order)        - расчёт цены; recalc(order) записывает его в order.quote
 *   MebelOrder.balance(order)      - оплачено, остаток, расходы, прибыль
 *   MebelOrder.region / setRegion  - страна и валюта мастера (одна настройка на все инструменты)
 *   MebelOrder.money(n, "RUB")     - "354 000 ₽"; moneyWords - сумма прописью в нужной валюте
 *
 * Подробное описание - README.md рядом с этим файлом.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MebelOrder = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FORMAT = "mebel-order";
  var VERSION = "1.1";
  var FILE_EXT = ".mebel.json";

  // ---------- Справочники ----------

  var STAGES = [
    { key: "lead", name: "Заявка" },
    { key: "measure", name: "Замер" },
    { key: "design", name: "Проект" },
    { key: "contract", name: "Договор и предоплата" },
    { key: "production", name: "Производство" },
    { key: "install", name: "Доставка и монтаж" },
    { key: "done", name: "Завершён" },
    { key: "cancelled", name: "Отменён" }
  ];

  var PRODUCT_TYPES = { kupe: "Шкаф-купе", kitchen: "Кухня", univ: "Изделие" };

  // Положение детали. Ось в названии - это ось, вдоль которой идёт ТОЛЩИНА листа.
  // a и b - два размера детали; sidesA - стороны, кромка которых идёт вдоль a; sidesB - вдоль b.
  var ORIENT = {
    X: { name: "Вертикальная боковая", a: "Высота", b: "Глубина", sidesA: ["front", "back"], sidesB: ["top", "bottom"] },
    Y: { name: "Горизонтальная", a: "Ширина", b: "Глубина", sidesA: ["front", "back"], sidesB: ["left", "right"] },
    Z: { name: "Фронтальная / задняя", a: "Ширина", b: "Высота", sidesA: ["top", "bottom"], sidesB: ["left", "right"] }
  };
  var SIDE_NAMES = { front: "спереди", back: "сзади", left: "слева", right: "справа", top: "сверху", bottom: "снизу" };

  var ROLES = {
    side: "Боковина", top: "Крыша", bottom: "Дно", shelf: "Полка", partition: "Перегородка",
    back: "Задняя стенка", plinth: "Цоколь", facade: "Фасад", drawer: "Деталь ящика",
    countertop: "Столешница", apron: "Стеновая панель", filler: "Планка / добор", other: "Другое"
  };

  var MATERIAL_KINDS = { sheet: "лист", area: "м2", length: "п.м." };
  var EXTRA_KINDS = { item: "Своя позиция", delivery: "Доставка", install: "Монтаж", service: "Услуга" };
  var PAYMENT_KINDS = { prepay: "Предоплата", payment: "Оплата", refund: "Возврат" };
  var PAYMENT_METHODS = { cash: "Наличные", kaspi: "Kaspi", sbp: "СБП", card: "Карта", transfer: "Перевод на счёт", other: "Другое" };
  var EXPENSE_CATEGORIES = {
    materials: "Плитные материалы", facades: "Фасады", hardware: "Фурнитура", cutting: "Распил и кромление",
    countertop: "Столешница", delivery: "Доставка", install: "Монтаж / сборка", other: "Другое"
  };

  // ---------- Страна и валюта ----------
  // Валюта заказа - order.currency (код ISO 4217), страна - order.country (KZ, RU).
  // Страна задаёт шаблон договора, реквизиты, способы оплаты и НДС по умолчанию; валюта - знак,
  // слова для сумм прописью и шаг округления. Добавить валюту = добавить строку в CURRENCIES.
  // inWord - для фраз "цены в рублях". rateKZT - сколько тенге стоит единица валюты, очень примерно: нужен только чтобы получить
  // стартовые цены там, где нет своего набора. Настоящие цены мастер задаёт сам.
  var CURRENCIES = {
    KZT: { code: "KZT", sign: "₸", name: "Тенге", forms: ["тенге", "тенге", "тенге"], roundTo: 1000, inWord: "тенге", rateKZT: 1 },
    RUB: { code: "RUB", sign: "₽", name: "Рубли", forms: ["рубль", "рубля", "рублей"], roundTo: 100, inWord: "рублях", rateKZT: 6.5 },
    BYN: { code: "BYN", sign: "Br", name: "Белорусские рубли", forms: ["белорусский рубль", "белорусских рубля", "белорусских рублей"], roundTo: 10, inWord: "белорусских рублях", rateKZT: 170 },
    UZS: { code: "UZS", sign: "сум", name: "Сумы", forms: ["сум", "сума", "сумов"], roundTo: 10000, inWord: "сумах", rateKZT: 0.043 },
    KGS: { code: "KGS", sign: "сом", name: "Сомы", forms: ["сом", "сома", "сомов"], roundTo: 100, inWord: "сомах", rateKZT: 6 },
    USD: { code: "USD", sign: "$", name: "Доллары США", forms: ["доллар США", "доллара США", "долларов США"], roundTo: 10, inWord: "долларах США", rateKZT: 520 },
    EUR: { code: "EUR", sign: "€", name: "Евро", forms: ["евро", "евро", "евро"], roundTo: 10, inWord: "евро", rateKZT: 600 }
  };
  // vatPct - ставка НДС с 2026 года (РК - 16%, РФ - 22%). Многие мастера работают без НДС,
  // поэтому в документах по умолчанию "без НДС", ставка подставляется, если мастер плательщик.
  var COUNTRIES = {
    KZ: {
      code: "KZ", name: "Казахстан", currency: "KZT", vatPct: 16, phonePrefix: "7",
      payMethods: ["cash", "kaspi", "card", "transfer", "other"],
      law: "Республики Казахстан"
    },
    RU: {
      code: "RU", name: "Россия", currency: "RUB", vatPct: 22, phonePrefix: "7",
      payMethods: ["cash", "sbp", "card", "transfer", "other"],
      law: "Российской Федерации"
    }
  };
  var DEFAULT_COUNTRY = "KZ";
  var REGION_KEY = "mebel-region";

  function currencyInfo(code) {
    var c = CURRENCIES[String(code || "").toUpperCase()];
    if (c) return c;
    var s = isStr(code) && code ? code.toUpperCase() : "KZT";
    return CURRENCIES[s] || { code: s, sign: s, name: s, forms: [s, s, s], roundTo: 1, rateKZT: 0 };
  }
  function countryInfo(code) { return COUNTRIES[String(code || "").toUpperCase()] || COUNTRIES[DEFAULT_COUNTRY]; }
  function countryOfCurrency(cur) { for (var k in COUNTRIES) if (COUNTRIES[k].currency === cur) return k; return null; }

  // Страна по настройкам браузера: часовой пояс надёжнее языка (в Казахстане браузеры часто на русском).
  function guessCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (/^Asia\/(Almaty|Qyzylorda|Aqtobe|Aqtau|Oral|Atyrau|Qostanay)$/.test(tz)) return "KZ";
      if (/^(Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Saratov|Ulyanovsk|Astrakhan|Kirov)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr))$/.test(tz)) return "RU";
      var lang = (typeof navigator !== "undefined" && (navigator.languages || [navigator.language]).join(",")) || "";
      if (/\bkk\b|-KZ\b/i.test(lang)) return "KZ";
      if (/-RU\b/i.test(lang)) return "RU";
    } catch (e) { }
    return DEFAULT_COUNTRY;
  }
  // Настройка "страна и валюта" одна на все инструменты сайта (общий localStorage).
  // { country, currency, set } - set: true, если мастер выбрал сам, а не угадано.
  function region() {
    var r = null;
    try { r = JSON.parse(localStorage.getItem(REGION_KEY) || "null"); } catch (e) { }
    if (isObj(r) && COUNTRIES[r.country]) return { country: r.country, currency: currencyInfo(r.currency || COUNTRIES[r.country].currency).code, set: true };
    var c = guessCountry();
    return { country: c, currency: COUNTRIES[c].currency, set: false };
  }
  function setRegion(r) {
    var cur = region(), next = { country: countryInfo(r && r.country || cur.country).code };
    next.currency = currencyInfo(r && r.currency || (r && r.country ? COUNTRIES[next.country].currency : cur.currency)).code;
    try { localStorage.setItem(REGION_KEY, JSON.stringify({ country: next.country, currency: next.currency, at: nowIso() })); } catch (e) { }
    try { if (typeof window !== "undefined" && window.dispatchEvent && typeof CustomEvent === "function") window.dispatchEvent(new CustomEvent("mebel-region", { detail: next })); } catch (e) { }
    next.set = true;
    return next;
  }
  // Страна заказа: своя, иначе по валюте, иначе настройка.
  function orderCountry(order) {
    if (isObj(order) && COUNTRIES[order.country]) return order.country;
    var byCur = isObj(order) && order.currency ? countryOfCurrency(order.currency) : null;
    return byCur || region().country;
  }
  function orderCurrency(order) { return currencyInfo(isObj(order) && order.currency ? order.currency : region().currency).code; }

  function plural(n, forms) {
    n = Math.abs(Math.round(n)) % 100; var d = n % 10;
    return (n > 10 && n < 20) ? forms[2] : d === 1 ? forms[0] : (d >= 2 && d <= 4) ? forms[1] : forms[2];
  }
  // 354 000 ₸ / 354 000 ₽ / 1 200 $ - знак после числа, через неразрывный пробел.
  function money(n, cur) { return fmtMoney(n) + " " + currencyInfo(cur || "KZT").sign; }
  // Число прописью (именительный падеж, мужской род, тысячи - женский).
  function numWords(n) {
    n = Math.floor(Math.abs(num(n)));
    if (n === 0) return "ноль";
    var u = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
    var t = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
    var h = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
    var g = [null, ["тысяча", "тысячи", "тысяч"], ["миллион", "миллиона", "миллионов"], ["миллиард", "миллиарда", "миллиардов"]];
    var out = [], i = 0;
    while (n > 0) {
      var tri = n % 1000; n = Math.floor(n / 1000);
      if (tri && g[i] !== undefined) {
        var w = [h[Math.floor(tri / 100)]], r = tri % 100, fem = i === 1;
        var one = function (k) { return fem && k === 1 ? "одна" : fem && k === 2 ? "две" : u[k]; };
        if (r < 20) w.push(one(r)); else { w.push(t[Math.floor(r / 10)]); w.push(one(r % 10)); }
        if (i > 0) w.push(plural(tri, g[i]));
        out.unshift(w.filter(Boolean).join(" "));
      }
      i++;
    }
    return out.join(" ");
  }
  // "сто двадцать тысяч рублей" - сумма прописью с названием валюты в нужной форме.
  function moneyWords(n, cur) { var c = currencyInfo(cur || "KZT"); return numWords(n) + " " + plural(Math.floor(Math.abs(num(n))), c.forms); }
  // Только название валюты, согласованное с числом: 5 -> "рублей", 21 -> "рубль".
  function currencyWord(n, cur) { return plural(Math.floor(Math.abs(num(n))), currencyInfo(cur || "KZT").forms); }
  function roundStep(cur) { return currencyInfo(cur).roundTo || 1; }
  // Красивое округление стартовой цены после пересчёта по курсу: 2 значащие цифры (3 для больших).
  function niceRound(v) {
    v = num(v); if (v <= 0) return 0;
    var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - (v >= 10000 ? 2 : 1)));
    return Math.round(v / p) * p;
  }
  // Пересчёт суммы между валютами по примерному курсу (или по своему: rate = сколько "to" за 1 "from").
  function convert(v, from, to, rate) {
    if (from === to) return num(v);
    var r = isNum(rate) && rate > 0 ? rate : (currencyInfo(from).rateKZT / (currencyInfo(to).rateKZT || 1));
    return num(v) * r;
  }

  // Стартовые цены в рублях (Россия, 2026, примерно - средний сегмент). Ключи как в defaultCatalog.
  var STARTER_RUB = {
    materials: { ldsp16: 4200, dvp3: 700, "mdf18-film": 5000, "mdf18-plastic": 7000, "mdf18-enamel": 9500, mirror4: 2800, lacobel4: 4500, top38: 2500 },
    edges: { pvc04: 15, pvc2: 35 },
    hardware: { handle: 250, hinge: 350, kguide: 1500, guide: 600, lift: 2500, leg: 80, push: 250, gola: 1200, rod: 500, led: 700, ledpow: 1500, dryer: 1500, "prof-eco": 2500, "prof-std": 3500, "prof-prem": 6000, fasteners: 300 },
    pricing: { cutPerSheet: 1200 }
  };
  // Стартовая цена в нужной валюте: тенге - как есть, рубли - свой набор, остальное - по примерному курсу.
  function starterPrice(kzt, cur, rub) {
    cur = currencyInfo(cur || "KZT").code;
    if (cur === "KZT") return kzt;
    if (cur === "RUB" && isNum(rub)) return rub;
    return niceRound(convert(kzt, "KZT", cur));
  }

  // Примерные цены из калькулятора. Это стартовый набор, настоящие цены задаёт мастер.
  // currency - в какой валюте нужны цены (по умолчанию тенге, как в версии 1.0).
  function defaultCatalog(currency) {
    var c = kztCatalog();
    if (currency && currencyInfo(currency).code !== "KZT") ["materials", "edges", "hardware"].forEach(function (g) {
      for (var id in c[g]) c[g][id].price = starterPrice(c[g][id].price, currency, STARTER_RUB[g][id]);
    });
    return c;
  }
  function kztCatalog() {
    return {
      materials: {
        ldsp16: { name: "ЛДСП 16 мм", group: "ldsp", kind: "sheet", t: 16, sheet: { w: 2800, h: 2070 }, grain: true, price: 22000, cut: true, color: "#e9d3b5" },
        dvp3: { name: "ДВП 3 мм", group: "dvp", kind: "sheet", t: 3, sheet: { w: 2750, h: 1700 }, grain: false, price: 5500, usagePct: 90, color: "#c9b8a3" },
        "mdf18-film": { name: "Фасад МДФ плёнка", group: "mdf", kind: "area", t: 18, price: 22000, color: "#f3ede4" },
        "mdf18-plastic": { name: "Фасад МДФ пластик", group: "mdf", kind: "area", t: 18, price: 30000, color: "#e8e4dc" },
        "mdf18-enamel": { name: "Фасад МДФ эмаль", group: "mdf", kind: "area", t: 18, price: 38000, color: "#fafafa" },
        mirror4: { name: "Зеркало 4 мм", group: "glass", kind: "area", t: 4, price: 15000, color: "#b9d3df" },
        lacobel4: { name: "Стекло лакобель 4 мм", group: "glass", kind: "area", t: 4, price: 22000, color: "#3d4a52" },
        top38: { name: "Столешница ЛДСП 38 мм", group: "top", kind: "length", t: 38, price: 12000, color: "#8a6a4a" }
      },
      edges: {
        pvc04: { name: "Кромка ПВХ 0.4 мм", t: 0.4, w: 19, price: 150, color: "#e9d3b5" },
        pvc2: { name: "Кромка ПВХ 2 мм", t: 2, w: 19, price: 350, color: "#e9d3b5" }
      },
      hardware: {
        handle: { name: "Ручка", unit: "шт", price: 1500 },
        hinge: { name: "Петля с доводчиком", unit: "шт", price: 1200 },
        kguide: { name: "Направляющие полного выдвижения", unit: "компл", price: 7000 },
        guide: { name: "Направляющие ящика", unit: "компл", price: 4500 },
        lift: { name: "Подъёмный механизм", unit: "шт", price: 12000 },
        leg: { name: "Опора кухонная", unit: "шт", price: 400 },
        push: { name: "Толкатель push-to-open", unit: "шт", price: 1200 },
        gola: { name: "Профиль Gola", unit: "м", price: 6000 },
        rod: { name: "Штанга", unit: "м", price: 3000 },
        led: { name: "LED-лента с профилем", unit: "м", price: 3500 },
        ledpow: { name: "Блок питания и выключатель", unit: "шт", price: 6000 },
        dryer: { name: "Сушилка для посуды", unit: "шт", price: 7000 },
        "prof-eco": { name: "Профиль купе эконом", unit: "дверь", price: 14000 },
        "prof-std": { name: "Профиль купе стандарт", unit: "дверь", price: 18000 },
        "prof-prem": { name: "Профиль купе премиум", unit: "дверь", price: 28000 },
        fasteners: { name: "Крепёж", unit: "компл", price: 1500 }
      }
    };
  }

  function defaultPricing(currency) {
    var p = kztPricing();
    if (currency && currencyInfo(currency).code !== "KZT") {
      p.roundTo = roundStep(currency);
      p.cutPerSheet = starterPrice(p.cutPerSheet, currency, STARTER_RUB.pricing.cutPerSheet);
    }
    return p;
  }
  function kztPricing() {
    return {
      workPct: 15,          // сборка, % от материалов
      markupPct: 30,        // наценка, % от себестоимости
      discountPct: 0,       // скидка клиенту, %
      prepayPct: 50,        // предоплата, %
      roundTo: 1000,        // округлять итог вверх до, в валюте заказа
      sheetUsagePct: 80,    // использование листа, % (остальное - отходы); при sheetMode "nest" - только для деталей больше листа
      edgeReservePct: 10,   // запас кромки, %
      cutPerSheet: 3000     // распил и кромление, за лист
    };
  }

  function defaultProduction() {
    return { kerf: 4, sheetTrim: 10, subtractEdge: true };
  }

  // ---------- Мелкие помощники ----------

  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function isStr(v) { return typeof v === "string"; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function r0(n) { return Math.round(n); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function nowIso() { return new Date().toISOString(); }
  function today() { return nowIso().slice(0, 10); }
  function fmtMoney(n) { return String(r0(num(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }

  var _seq = 0;
  function uid(prefix) {
    _seq = (_seq + 1) % 1296;
    var rnd = Math.floor(Math.random() * 60466176).toString(36); // до 5 знаков
    var t = (Date.now() % 46656).toString(36);
    return (prefix || "id") + "_" + ("00000" + rnd).slice(-5) + ("00" + t).slice(-3) + ("0" + _seq.toString(36)).slice(-2);
  }

  var DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  function isDate(v) { return isStr(v) && DATE_RE.test(v) && !isNaN(Date.parse(v)); }

  // ---------- Создание и значения по умолчанию ----------

  function create(init) {
    var t = nowIso(), reg = region();
    var cur = isObj(init) && init.currency ? currencyInfo(init.currency).code : reg.currency;
    var country = isObj(init) && COUNTRIES[init.country] ? init.country : (isObj(init) && init.currency ? (countryOfCurrency(cur) || reg.country) : reg.country);
    var o = {
      format: FORMAT,
      version: VERSION,
      id: uid("o"),
      number: "",
      title: "",
      createdAt: t,
      updatedAt: t,
      currency: cur,
      country: country,
      units: "mm",
      stage: "lead",
      client: { name: "", phone: "", address: "" },
      products: [],
      catalog: defaultCatalog(cur),
      extras: [],
      pricing: Object.assign(defaultPricing(cur), { sheetMode: "nest" }), // новые заказы: листы раскладкой; старые без этого поля считаются как раньше
      production: defaultProduction(),
      terms: { days: 30, daysKind: "work", warrantyMonths: 12 },
      timeline: [{ stage: "lead", done: t.slice(0, 10) }],
      payments: [],
      expenses: [],
      reminders: [],
      files: [],
      notes: ""
    };
    if (isObj(init)) for (var k in init) o[k] = clone(init[k]);
    return normalize(o);
  }

  function newProduct(init) {
    var p = { id: uid("pr"), type: "univ", name: "", qty: 1, size: { w: 0, h: 0, d: 0 }, finish: {}, params: {}, modules: [], parts: [], hardware: [] };
    if (isObj(init)) for (var k in init) p[k] = clone(init[k]);
    return p;
  }
  function newModule(init) {
    var m = { id: uid("m"), kind: "", name: "", pos: { x: 0, y: 0, z: 0 }, rot: 0, size: { w: 0, h: 0, d: 0 }, params: {}, parts: [], hardware: [] };
    if (isObj(init)) for (var k in init) m[k] = clone(init[k]);
    return m;
  }
  function newPart(init) {
    var p = { id: uid("p"), name: "", mat: "@corpus", o: "X", x: 0, y: 0, z: 0, a: 0, b: 0 };
    if (isObj(init)) for (var k in init) p[k] = clone(init[k]);
    return p;
  }

  // Дополняет недостающие разделы, ничего не удаляя. Незнакомые поля сохраняются как есть.
  function normalize(o) {
    if (!isObj(o)) return o;
    if (!o.format) o.format = FORMAT;
    if (!o.version) o.version = VERSION;
    if (!o.id) o.id = uid("o");
    if (!o.createdAt) o.createdAt = nowIso();
    if (!o.updatedAt) o.updatedAt = o.createdAt;
    if (!o.currency) o.currency = "KZT";
    if (!o.units) o.units = "mm";
    if (!o.stage) o.stage = "lead";
    if (!isObj(o.client)) o.client = { name: "", phone: "", address: "" };
    if (!Array.isArray(o.products)) o.products = [];
    if (!isObj(o.catalog)) o.catalog = {};
    ["materials", "edges", "hardware"].forEach(function (k) { if (!isObj(o.catalog[k])) o.catalog[k] = {}; });
    var dp = defaultPricing(o.currency);
    if (!isObj(o.pricing)) o.pricing = {};
    for (var k in dp) if (!isNum(o.pricing[k])) o.pricing[k] = dp[k];
    var dpr = defaultProduction();
    if (!isObj(o.production)) o.production = {};
    for (var k2 in dpr) if (o.production[k2] === undefined) o.production[k2] = dpr[k2];
    if (!isObj(o.terms)) o.terms = {};
    ["extras", "timeline", "payments", "expenses", "reminders", "files"].forEach(function (k) { if (!Array.isArray(o[k])) o[k] = []; });
    o.products.forEach(function (p) {
      if (!isObj(p)) return;
      if (!p.id) p.id = uid("pr");
      if (!p.type) p.type = "univ";
      if (!isNum(p.qty)) p.qty = 1;
      if (!isObj(p.finish)) p.finish = {};
      ["modules", "parts", "hardware"].forEach(function (k) { if (!Array.isArray(p[k])) p[k] = []; });
      p.parts.forEach(function (pt) { if (isObj(pt) && !pt.id) pt.id = uid("p"); });
      p.modules.forEach(function (m) {
        if (!isObj(m)) return;
        if (!m.id) m.id = uid("m");
        if (!isObj(m.pos)) m.pos = { x: 0, y: 0, z: 0 };
        if (!isNum(m.rot)) m.rot = 0;
        ["parts", "hardware"].forEach(function (k) { if (!Array.isArray(m[k])) m[k] = []; });
        m.parts.forEach(function (pt) { if (isObj(pt) && !pt.id) pt.id = uid("p"); });
      });
    });
    return o;
  }

  function touch(o) { o.updatedAt = nowIso(); return o; }

  // ---------- Материалы и кромка ----------

  // Ссылка на материал: "ldsp16" - ключ в catalog.materials, "@facade" - роль из product.finish.
  function resolveRef(ref, product) {
    if (!isStr(ref)) return null;
    if (ref.charAt(0) === "@") {
      var id = product && isObj(product.finish) ? product.finish[ref.slice(1)] : null;
      return isStr(id) ? id : null;
    }
    return ref;
  }
  function getMaterial(order, product, ref) {
    var id = resolveRef(ref, product);
    var m = id && order.catalog && order.catalog.materials ? order.catalog.materials[id] : null;
    if (!isObj(m)) return null;
    var out = clone(m); out.id = id; return out;
  }
  function getEdge(order, product, ref) {
    var id = resolveRef(ref, product);
    var e = id && order.catalog && order.catalog.edges ? order.catalog.edges[id] : null;
    if (!isObj(e)) return null;
    var out = clone(e); out.id = id; return out;
  }
  function getHardware(order, line) {
    var item = line && line.item && order.catalog && order.catalog.hardware ? order.catalog.hardware[line.item] : null;
    return {
      item: line.item || null,
      name: line.name || (item && item.name) || "",
      unit: line.unit || (item && item.unit) || "шт",
      price: isNum(line.price) ? line.price : (item && isNum(item.price) ? item.price : 0),
      qty: num(line.qty)
    };
  }

  // ---------- Геометрия ----------

  // Размеры детали по осям [по X, по Y, по Z] при толщине t.
  function partDims(part, t) {
    return part.o === "X" ? [t, part.a, part.b] : part.o === "Y" ? [part.a, t, part.b] : [part.a, part.b, t];
  }
  function hasPos(part) { return isNum(part.x) && isNum(part.y) && isNum(part.z); }

  // Поворот вокруг вертикальной оси Y на 0/90/180/270 градусов и сдвиг.
  // Точка (x, z) переходит в (x*cos + z*sin, -x*sin + z*cos).
  function placeBox(b, pos, rot) {
    var r = ((num(rot) % 360) + 360) % 360;
    var c = r === 90 ? 0 : r === 180 ? -1 : r === 270 ? 0 : 1;
    var s = r === 90 ? 1 : r === 180 ? 0 : r === 270 ? -1 : 0;
    var xa = b.x0 * c + b.z0 * s, xb = b.x1 * c + b.z1 * s;
    var za = -b.x0 * s + b.z0 * c, zb = -b.x1 * s + b.z1 * c;
    var px = pos ? num(pos.x) : 0, py = pos ? num(pos.y) : 0, pz = pos ? num(pos.z) : 0;
    return {
      x0: Math.min(xa, xb) + px, x1: Math.max(xa, xb) + px,
      y0: b.y0 + py, y1: b.y1 + py,
      z0: Math.min(za, zb) + pz, z1: Math.max(za, zb) + pz
    };
  }

  // Коробка детали в координатах изделия (с учётом положения и поворота модуля). null - если у детали нет координат.
  function partBox(order, product, module, part) {
    if (!hasPos(part) || !ORIENT[part.o]) return null;
    var m = getMaterial(order, product, part.mat);
    var d = partDims(part, m && isNum(m.t) ? m.t : 16);
    var b = { x0: part.x, y0: part.y, z0: part.z, x1: part.x + d[0], y1: part.y + d[1], z1: part.z + d[2] };
    if (module) b = placeBox(b, module.pos, module.rot);
    return b;
  }
  // То же, но в координатах помещения (с учётом положения самого изделия).
  function partWorldBox(order, product, module, part) {
    var b = partBox(order, product, module, part);
    return b && (product.pos || product.rot) ? placeBox(b, product.pos, product.rot) : b;
  }

  function productBounds(order, product) {
    var bb = null;
    eachPart({ products: [product], catalog: order.catalog }, function (e) {
      var b = partBox(order, product, e.module, e.part);
      if (!b) return;
      if (!bb) bb = clone(b);
      else {
        bb.x0 = Math.min(bb.x0, b.x0); bb.y0 = Math.min(bb.y0, b.y0); bb.z0 = Math.min(bb.z0, b.z0);
        bb.x1 = Math.max(bb.x1, b.x1); bb.y1 = Math.max(bb.y1, b.y1); bb.z1 = Math.max(bb.z1, b.z1);
      }
    });
    if (!bb) return null;
    bb.w = r0(bb.x1 - bb.x0); bb.h = r0(bb.y1 - bb.y0); bb.d = r0(bb.z1 - bb.z0);
    return bb;
  }

  // ---------- Обход деталей ----------

  function eachPart(order, cb) {
    arr(order.products).forEach(function (product) {
      if (!isObj(product)) return;
      arr(product.parts).forEach(function (part, i) { if (isObj(part)) cb({ product: product, module: null, part: part, index: i }); });
      arr(product.modules).forEach(function (module) {
        if (!isObj(module)) return;
        arr(module.parts).forEach(function (part, i) { if (isObj(part)) cb({ product: product, module: module, part: part, index: i }); });
      });
    });
  }
  function listParts(order) { var out = []; eachPart(order, function (e) { out.push(e); }); return out; }

  function eachHardware(order, cb) {
    arr(order.products).forEach(function (product) {
      if (!isObj(product)) return;
      arr(product.hardware).forEach(function (line) { if (isObj(line)) cb({ product: product, module: null, line: line }); });
      arr(product.modules).forEach(function (module) {
        if (!isObj(module)) return;
        arr(module.hardware).forEach(function (line) { if (isObj(line)) cb({ product: product, module: module, line: line }); });
      });
    });
  }

  function findPart(order, id) {
    var found = null;
    eachPart(order, function (e) { if (!found && e.part.id === id) found = e; });
    return found;
  }

  // Маркировка для наклеек: "1.3-07" = изделие 1, модуль 3, деталь 7. Детали без модуля: "1-07".
  function assignMarks(order) {
    arr(order.products).forEach(function (product, pi) {
      var n = 0;
      arr(product.parts).forEach(function (part) { n++; part.mark = (pi + 1) + "-" + ("0" + n).slice(-2); });
      arr(product.modules).forEach(function (module, mi) {
        var k = 0;
        arr(module.parts).forEach(function (part) { k++; part.mark = (pi + 1) + "." + (mi + 1) + "-" + ("0" + k).slice(-2); });
      });
    });
    return order;
  }

  // ---------- Текстура и кромка детали ----------

  // Направление текстуры: "a" - вдоль размера a, "b" - вдоль b, "any" - не важно.
  // Если не указано: у материала без рисунка - "any"; с рисунком - вдоль большей стороны детали.
  function partGrain(part, material) {
    if (part.grain === "a" || part.grain === "b" || part.grain === "any") return part.grain;
    if (!material || !material.grain) return "any";
    return part.a >= part.b ? "a" : "b";
  }

  // Кромка детали по сторонам: { front: {id,name,t,...} | null, ... } - только стороны, которые есть у этого положения.
  function partEdges(order, product, part) {
    var o = ORIENT[part.o], out = {};
    if (!o) return out;
    o.sidesA.concat(o.sidesB).forEach(function (s) {
      var ref = isObj(part.edges) ? part.edges[s] : null;
      out[s] = ref ? getEdge(order, product, ref) : null;
    });
    return out;
  }
  // Длина кромки детали в мм по каждому виду кромки: { pvc04: 1234, ... }
  function partEdgeLength(order, product, part) {
    var o = ORIENT[part.o], out = {};
    if (!o || !isObj(part.edges)) return out;
    for (var s in part.edges) {
      var id = resolveRef(part.edges[s], product);
      if (!id) continue;
      var len = o.sidesA.indexOf(s) >= 0 ? part.a : o.sidesB.indexOf(s) >= 0 ? part.b : 0;
      out[id] = (out[id] || 0) + num(len);
    }
    return out;
  }

  // ---------- Список на распил ----------

  // opts.kinds - какие материалы включать (по умолчанию только листовые: ["sheet"]); opts.group - склеить одинаковые детали.
  // Каждая строка: длина и ширина ГОТОВОЙ детали (с кромкой), cutLength/cutWidth - размер пиления (минус толстая кромка),
  // grain: "length" (текстура вдоль длины) или "any", canRotate, кромка по сторонам L1, L2 (вдоль длины) и W1, W2 (вдоль ширины).
  function cutList(order, opts) {
    opts = opts || {};
    var kinds = opts.kinds || ["sheet"];
    var subtract = !order.production || order.production.subtractEdge !== false;
    var rows = [];
    eachPart(order, function (e) {
      var part = e.part, product = e.product, o = ORIENT[part.o];
      var mat = getMaterial(order, product, part.mat);
      if (!o || !mat || kinds.indexOf(mat.kind) < 0) return;
      if (!(part.a > 0 && part.b > 0)) return;
      var g = partGrain(part, mat);
      var alongA = g === "a" ? true : g === "b" ? false : part.a >= part.b;
      var ed = partEdges(order, product, part);
      var eA = o.sidesA.map(function (s) { return ed[s]; }), eB = o.sidesB.map(function (s) { return ed[s]; });
      var L = alongA ? part.a : part.b, W = alongA ? part.b : part.a;
      var eL = alongA ? eA : eB, eW = alongA ? eB : eA;
      var slim = function (x) { return x ? { id: x.id, name: x.name, t: x.t } : null; };
      var cut = function (x) { return subtract && x && x.t >= 1 ? x.t : 0; };
      rows.push({
        id: part.id,
        mark: part.mark || "",
        name: part.name || "",
        role: part.role || "",
        product: { id: product.id, name: product.name || "" },
        module: e.module ? { id: e.module.id, name: e.module.name || "" } : null,
        material: { id: mat.id, name: mat.name, t: mat.t, decor: mat.decor || "", sheet: mat.sheet ? clone(mat.sheet) : null, grain: !!mat.grain, kind: mat.kind || "", price: num(mat.price, 0) },
        length: L,
        width: W,
        cutLength: r2(L - cut(eW[0]) - cut(eW[1])),
        cutWidth: r2(W - cut(eL[0]) - cut(eL[1])),
        qty: Math.max(1, num(part.qty, 1)) * Math.max(1, num(product.qty, 1)),
        grain: g === "any" ? "any" : "length",
        canRotate: g === "any",
        edges: { L1: slim(eL[0]), L2: slim(eL[1]), W1: slim(eW[0]), W2: slim(eW[1]) },
        note: part.note || ""
      });
    });
    if (!opts.group) return rows;
    var map = {}, out = [];
    rows.forEach(function (r) {
      var ek = ["L1", "L2", "W1", "W2"].map(function (k) { return r.edges[k] ? r.edges[k].id : "-"; }).join(",");
      var key = [r.material.id, r.length, r.width, r.grain, ek].join("|");
      if (map[key]) { map[key].qty += r.qty; map[key].ids.push(r.id); }
      else { var c = clone(r); c.ids = [r.id]; map[key] = c; out.push(c); }
    });
    return out;
  }

  // Список фасадов для заказа на фабрике: по материалу и размеру (ширина x высота), с количеством.
  function facadeList(order) {
    var map = {}, out = [];
    eachPart(order, function (e) {
      var part = e.part;
      if (part.role !== "facade" || !(part.a > 0 && part.b > 0)) return;
      var mat = getMaterial(order, e.product, part.mat);
      if (!mat) return;
      var w = part.o === "X" ? part.b : part.a, h = part.o === "Y" ? part.b : part.o === "X" ? part.a : part.b;
      var q = Math.max(1, num(part.qty, 1)) * Math.max(1, num(e.product.qty, 1));
      var key = mat.id + "|" + w + "|" + h;
      if (map[key]) { map[key].qty += q; map[key].ids.push(part.id); }
      else { map[key] = { material: { id: mat.id, name: mat.name, t: mat.t, decor: mat.decor || "" }, width: w, height: h, qty: q, area: 0, ids: [part.id] }; out.push(map[key]); }
    });
    out.forEach(function (r) { r.area = r2(r.width * r.height / 1e6 * r.qty); });
    return out;
  }

  // ---------- Раскладка деталей на листы ----------

  // Сколько листов нужно на самом деле: детали раскладываются на лист сквозными резами (как на форматном станке),
  // с пропилом и обрезкой края. items: [{ w, h, rot }] - w вдоль длины листа (вдоль рисунка), rot - можно повернуть.
  // Перебирает несколько порядков и правил, берёт лучший. Результат не зависит от порядка деталей.
  // Возвращает { sheets, unplaced (не помещаются в лист), area (м2 деталей), usedPct (заполнение листов) }.
  var NEST_SPLITS = [
    function (W, H, w, h) { return (W - w) < (H - h); },
    function (W, H, w, h) { return (W - w) >= (H - h); },
    function () { return true; },
    function () { return false; },
    function (W, H, w, h) { return w * (H - h) <= h * (W - w); },
    function (W, H, w, h) { return w * (H - h) > h * (W - w); }
  ];
  var NEST_SCORES = [
    function (W, H, w, h) { return W * H - w * h; },
    function (W, H, w, h) { return Math.min(W - w, H - h); },
    function (W, H, w, h) { return Math.max(W - w, H - h); }
  ];
  var NEST_ORDERS = [
    function (a, b) { return b.w * b.h - a.w * a.h; },
    function (a, b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h) || Math.min(b.w, b.h) - Math.min(a.w, a.h); },
    function (a, b) { return Math.min(b.w, b.h) - Math.min(a.w, a.h) || Math.max(b.w, b.h) - Math.max(a.w, a.h); },
    function (a, b) { return (b.w + b.h) - (a.w + a.h); },
    function (a, b) { return b.h - a.h || b.w - a.w; },
    function (a, b) { return b.w - a.w || b.h - a.h; }
  ];
  function nestOnce(seq, W, H, kerf, score, split, limit) {
    var sheets = [];
    for (var i = 0; i < seq.length; i++) {
      var it = seq[i], best = null, bs = 0, si, fi, f, sc;
      for (si = 0; si < sheets.length; si++) for (fi = 0; fi < sheets[si].length; fi++) {
        f = sheets[si][fi];
        if (it.w <= f.w && it.h <= f.h) { sc = score(f.w, f.h, it.w, it.h); if (!best || sc < bs) { best = { s: si, f: fi, w: it.w, h: it.h }; bs = sc; } }
        if (it.rot && it.w !== it.h && it.h <= f.w && it.w <= f.h) { sc = score(f.w, f.h, it.h, it.w); if (!best || sc < bs) { best = { s: si, f: fi, w: it.h, h: it.w }; bs = sc; } }
      }
      if (!best) {
        if (sheets.length + 1 >= limit) return limit;
        sheets.push([{ w: W, h: H }]);
        best = it.w <= W && it.h <= H ? { s: sheets.length - 1, f: 0, w: it.w, h: it.h } : { s: sheets.length - 1, f: 0, w: it.h, h: it.w };
      }
      var free = sheets[best.s]; f = free[best.f]; free.splice(best.f, 1);
      var dw = f.w - best.w - kerf, dh = f.h - best.h - kerf;
      if (split(f.w, f.h, best.w, best.h)) {
        if (dw > 0) free.push({ w: dw, h: best.h });
        if (dh > 0) free.push({ w: f.w, h: dh });
      } else {
        if (dh > 0) free.push({ w: best.w, h: dh });
        if (dw > 0) free.push({ w: dw, h: f.h });
      }
    }
    return sheets.length;
  }
  function nestSheets(items, sheet, opt) {
    opt = opt || {};
    var kerf = Math.max(0, num(opt.kerf, 4)), trim = Math.max(0, num(opt.trim, 10));
    var W = num(sheet && sheet.w, 2800) - 2 * trim, H = num(sheet && sheet.h, 2070) - 2 * trim;
    var fit = [], unplaced = [], area = 0;
    arr(items).forEach(function (it) {
      var w = num(it.w), h = num(it.h);
      if (!(w > 0 && h > 0)) return;
      var x = { w: w, h: h, rot: !!it.rot };
      if ((w <= W && h <= H) || (x.rot && h <= W && w <= H)) { fit.push(x); area += w * h; } else unplaced.push(x);
    });
    fit.sort(function (a, b) { return b.w - a.w || b.h - a.h || (a.rot ? 1 : 0) - (b.rot ? 1 : 0); });
    var lower = Math.ceil(area / (W * H) - 1e-9), best = fit.length ? fit.length + 1 : 0;
    for (var o = 0; o < NEST_ORDERS.length && best > lower; o++) {
      var seq = fit.slice().sort(NEST_ORDERS[o]);
      for (var k = 0; k < NEST_SPLITS.length && best > lower; k++) for (var c = 0; c < NEST_SCORES.length && best > lower; c++) {
        var n = nestOnce(seq, W, H, kerf, NEST_SCORES[c], NEST_SPLITS[k], best);
        if (n < best) best = n;
      }
    }
    var full = best * num(sheet && sheet.w, 2800) * num(sheet && sheet.h, 2070);
    return { sheets: best, unplaced: unplaced, area: r2(area / 1e6), usedPct: full ? Math.round(area / full * 100) : 0 };
  }

  // Сколько плит длиной slab нужно на отрезки lens (столешницы): отрезки раскладываются по плитам, длинные - из нескольких плит.
  function packLengths(lens, slab, kerf) {
    slab = num(slab); kerf = Math.max(0, num(kerf, 4));
    if (!(slab > 0)) return 0;
    var rest = [], count = 0;
    arr(lens).forEach(function (l) { l = num(l); if (!(l > 0)) return; while (l > slab) { count++; l -= slab; } if (l > 0) rest.push(l); });
    rest.sort(function (a, b) { return b - a; });
    var bins = [];
    rest.forEach(function (l) {
      for (var i = 0; i < bins.length; i++) if (bins[i] >= l) { bins[i] -= l + kerf; return; }
      bins.push(slab - l - kerf);
    });
    return count + bins.length;
  }

  // ---------- Расход материалов ----------

  function bom(order) {
    var pr = order.pricing || defaultPricing();
    var mats = {}, edges = {}, hw = {}, byProduct = {};
    var pb = function (id) { return byProduct[id] || (byProduct[id] = { materials: {}, edges: {}, hardware: 0 }); };
    eachPart(order, function (e) {
      var part = e.part, product = e.product;
      var mat = getMaterial(order, product, part.mat);
      if (!mat || !(part.a > 0 && part.b > 0)) return;
      var q = Math.max(1, num(part.qty, 1)) * Math.max(1, num(product.qty, 1));
      var m = mats[mat.id] || (mats[mat.id] = { id: mat.id, name: mat.name, kind: mat.kind, price: num(mat.price), count: 0, area: 0, length: 0 });
      var area = part.a * part.b / 1e6 * q, len = Math.max(part.a, part.b) / 1000 * q;
      if (mat.kind === "length" && mat.slab > 0) { m.lens = m.lens || []; for (var qi = 0; qi < q; qi++) m.lens.push(Math.max(part.a, part.b)); }
      m.count += q; m.area += area; m.length += len;
      var share = pb(product.id).materials;
      share[mat.id] = (share[mat.id] || 0) + (mat.kind === "length" ? len : area);
      var el = partEdgeLength(order, product, part);
      for (var id in el) {
        var ed = getEdge(order, product, id);
        if (!ed) continue;
        var x = edges[id] || (edges[id] = { id: id, name: ed.name, price: num(ed.price), net: 0 });
        x.net += el[id] / 1000 * q;
        var es = pb(product.id).edges; es[id] = (es[id] || 0) + el[id] / 1000 * q;
      }
    });
    // pricing.sheetMode "nest" - листы считаются раскладкой деталей, иначе по площади и проценту использования
    var nestItems = null;
    if (pr.sheetMode === "nest") {
      nestItems = {};
      cutList(order, { kinds: ["sheet"] }).forEach(function (r) {
        var list = nestItems[r.material.id] || (nestItems[r.material.id] = []);
        for (var i = 0; i < r.qty; i++) list.push({ w: r.length, h: r.width, rot: r.canRotate });
      });
    }
    var prod = order.production || defaultProduction();
    var sheetsCut = 0;
    Object.keys(mats).forEach(function (id) {
      var m = mats[id], src = order.catalog.materials[id];
      m.area = r2(m.area); m.length = r2(m.length);
      if (m.kind === "sheet") {
        var sh = src.sheet || { w: 2800, h: 2070 };
        var use = Math.min(100, Math.max(30, num(src.usagePct, num(pr.sheetUsagePct, 80)))) / 100;
        if (nestItems && nestItems[id]) {
          var ns = nestSheets(nestItems[id], sh, { kerf: prod.kerf, trim: prod.sheetTrim });
          // детали больше листа раскладкой не посчитать - на них лист берётся по площади
          var over = ns.unplaced.reduce(function (a, x) { return a + x.w * x.h / 1e6; }, 0);
          m.sheets = ns.sheets + (over > 0 ? Math.ceil(over / (sh.w * sh.h / 1e6 * use) - 1e-9) : 0);
          m.nest = { usedPct: ns.usedPct, unplaced: ns.unplaced.length };
        } else m.sheets = Math.ceil(m.area / (sh.w * sh.h / 1e6 * use) - 1e-9);
        m.qty = m.sheets; m.unit = "лист";
        if (src.cut) sheetsCut += m.sheets;
      } else if (m.kind === "length") {
        // материал с длиной плиты (slab): в цену идут целые плиты
        if (src.slab > 0 && m.lens) { m.slabs = packLengths(m.lens, src.slab, prod.kerf); m.slab = src.slab; m.qty = r2(m.slabs * src.slab / 1000); delete m.lens; }
        else m.qty = m.length;
        m.unit = "п.м.";
      }
      else { m.qty = m.area; m.unit = "м2"; }
      m.sum = r0(m.qty * m.price);
    });
    Object.keys(edges).forEach(function (id) {
      var x = edges[id];
      x.net = r2(x.net);
      x.qty = Math.ceil(x.net * (1 + num(pr.edgeReservePct, 10) / 100) - 1e-9);
      x.unit = "м"; x.sum = r0(x.qty * x.price);
    });
    eachHardware(order, function (e) {
      var h = getHardware(order, e.line);
      var q = h.qty * Math.max(1, num(e.product.qty, 1));
      if (!q) return;
      var key = (h.item || "") + "|" + h.name + "|" + h.price;
      var x = hw[key] || (hw[key] = { item: h.item, name: h.name, unit: h.unit, price: h.price, qty: 0, sum: 0 });
      x.qty = r2(x.qty + q); x.sum = r0(x.qty * x.price);
      pb(e.product.id).hardware += q * h.price;
    });
    return {
      materials: Object.keys(mats).map(function (k) { return mats[k]; }),
      edges: Object.keys(edges).map(function (k) { return edges[k]; }),
      hardware: Object.keys(hw).map(function (k) { return hw[k]; }),
      sheetsCut: sheetsCut,
      cutting: { qty: sheetsCut, unit: "лист", price: num(pr.cutPerSheet), sum: r0(sheetsCut * num(pr.cutPerSheet)) },
      byProduct: byProduct
    };
  }

  // ---------- Цена ----------

  function ceilTo(n, step) { step = Math.max(1, num(step, 1)); return Math.ceil(n / step - 1e-9) * step || 0; }

  // Делит сумму total по долям weights целыми числами, остаток - в самую большую долю.
  function splitSum(total, weights, step) {
    var sum = weights.reduce(function (s, w) { return s + w; }, 0);
    if (!weights.length) return [];
    step = step || 1;
    var out = weights.map(function (w) { return sum > 0 ? Math.floor(total * w / sum / step) * step : 0; });
    var rest = total - out.reduce(function (s, v) { return s + v; }, 0), big = 0;
    weights.forEach(function (w, i) { if (w > weights[big]) big = i; });
    out[big] += rest;
    return out;
  }

  // Расчёт цены по правилам калькулятора. Ничего не меняет в заказе, возвращает объект quote.
  // lines - подробные строки для мастера (себестоимость), clientLines - строки для клиента (КП, договор).
  function quote(order) {
    var pr = order.pricing || defaultPricing(), b = bom(order), lines = [];
    b.materials.forEach(function (m) { if (m.sum > 0) lines.push({ group: "material", ref: m.id, name: m.name + (m.kind === "sheet" ? " (" + m.area + " м2)" : m.slabs ? " (" + m.length + " п.м., плит по " + m.slab / 1000 + " м: " + m.slabs + ")" : ""), qty: m.qty, unit: m.unit, price: m.price, sum: m.sum }); });
    b.edges.forEach(function (x) { if (x.sum > 0) lines.push({ group: "edge", ref: x.id, name: x.name, qty: x.qty, unit: x.unit, price: x.price, sum: x.sum }); });
    if (b.cutting.sum > 0) lines.push({ group: "cutting", name: "Распил и кромление", qty: b.cutting.qty, unit: "лист", price: b.cutting.price, sum: b.cutting.sum });
    b.hardware.forEach(function (h) { if (h.sum > 0) lines.push({ group: "hardware", ref: h.item || undefined, name: h.name, qty: h.qty, unit: h.unit, price: h.price, sum: h.sum }); });
    var items = [], services = [];
    arr(order.extras).forEach(function (x) {
      if (!isObj(x)) return;
      var sum = r0(num(x.qty, 1) * num(x.price));
      if (!sum) return;
      var line = { group: x.kind && x.kind !== "item" ? "service" : "extra", ref: x.id, name: x.name || EXTRA_KINDS[x.kind] || "Своя позиция", qty: num(x.qty, 1), unit: x.unit || "шт", price: num(x.price), sum: sum };
      lines.push(line);
      (line.group === "service" ? services : items).push(line);
    });

    var servicesSum = services.reduce(function (s, l) { return s + l.sum; }, 0);
    var materials = lines.reduce(function (s, l) { return s + l.sum; }, 0) - servicesSum;
    var work = r0(materials * num(pr.workPct) / 100);
    var cost = materials + work + servicesSum;
    // pricing.markupServices === false - наценка не берётся с услуг (доставка, монтаж идут клиенту по своей цене)
    var markup = r0((pr.markupServices === false ? cost - servicesSum : cost) * num(pr.markupPct) / 100);
    var d = Math.min(90, Math.max(0, num(pr.discountPct))) / 100;
    var total = ceilTo((cost + markup) * (1 - d), pr.roundTo);
    var step = total % 100 === 0 ? 100 : 1; // строки для клиента - ровными суммами
    var subtotal = d > 0 ? ceilTo(total / (1 - d), step) : total;
    var prepayPct = Math.min(100, Math.max(0, num(pr.prepayPct)));
    var prepaySum = Math.min(total, ceilTo(total * prepayPct / 100, pr.roundTo));

    // Доля каждого изделия в общих материалах - по площади (длине) деталей и по своей фурнитуре.
    var clientLines = [], weights = [];
    var matSum = {}, matQty = {}, edgeSum = {}, edgeQty = {};
    b.materials.forEach(function (m) { matSum[m.id] = m.sum; matQty[m.id] = m.kind === "length" ? m.length : m.area; });
    b.edges.forEach(function (x) { edgeSum[x.id] = x.sum; edgeQty[x.id] = x.net; });
    var cutBase = 0;
    b.materials.forEach(function (m) { if (m.kind === "sheet" && order.catalog.materials[m.id].cut) cutBase += m.area; });
    arr(order.products).forEach(function (p) {
      var bp = b.byProduct[p.id] || { materials: {}, edges: {}, hardware: 0 }, base = bp.hardware, id;
      for (id in bp.materials) {
        if (matQty[id] > 0) base += matSum[id] * bp.materials[id] / matQty[id];
        if (cutBase > 0 && order.catalog.materials[id].kind === "sheet" && order.catalog.materials[id].cut) base += b.cutting.sum * bp.materials[id] / cutBase;
      }
      for (id in bp.edges) if (edgeQty[id] > 0) base += edgeSum[id] * bp.edges[id] / edgeQty[id];
      var sz = p.size || {};
      clientLines.push({ kind: "product", ref: p.id, name: p.name || PRODUCT_TYPES[p.type] || "Изделие", note: sz.w ? sz.w + "x" + sz.h + "x" + sz.d + " мм" : "", qty: Math.max(1, num(p.qty, 1)), unit: "шт" });
      weights.push(base * (1 + num(pr.workPct) / 100));
    });
    items.forEach(function (l) { clientLines.push({ kind: "extra", ref: l.ref, name: l.name, qty: l.qty, unit: l.unit }); weights.push(l.sum * (1 + num(pr.workPct) / 100)); });
    // Услуги (доставка, монтаж) клиент видит по своей цене, вся наценка сидит в изделиях и своих позициях.
    var showServices = servicesSum < subtotal && weights.some(function (w) { return w > 0; });
    if (showServices) {
      splitSum(subtotal - servicesSum, weights, step).forEach(function (s, i) { clientLines[i].sum = s; });
      services.forEach(function (l) { clientLines.push({ kind: "service", ref: l.ref, name: l.name, qty: l.qty, unit: l.unit, sum: l.sum }); });
    } else {
      services.forEach(function (l) { clientLines.push({ kind: "service", ref: l.ref, name: l.name, qty: l.qty, unit: l.unit }); weights.push(l.sum); });
      splitSum(subtotal, weights, step).forEach(function (s, i) { clientLines[i].sum = s; });
    }
    clientLines = clientLines.filter(function (l) { return l.sum > 0; });

    return {
      calcAt: nowIso(),
      currency: orderCurrency(order),
      lines: lines,
      materials: materials,
      work: work,
      services: servicesSum,
      cost: cost,
      markup: markup,
      clientLines: clientLines,
      subtotal: subtotal,
      discountPct: r2(d * 100),
      discountSum: subtotal - total,
      total: total,
      prepayPct: prepayPct,
      prepaySum: prepaySum,
      profit: total - cost
    };
  }
  function recalc(order) { order.quote = quote(order); return touch(order); }

  // ---------- Оплаты и прибыль ----------

  function balance(order) {
    var paid = 0, spent = 0;
    arr(order.payments).forEach(function (p) { if (isObj(p)) paid += (p.kind === "refund" ? -1 : 1) * Math.abs(num(p.amount)); });
    arr(order.expenses).forEach(function (x) { if (isObj(x)) spent += num(x.amount); });
    var q = isObj(order.quote) ? order.quote : {};
    var total = num(q.total);
    return {
      total: total,
      paid: paid,
      due: Math.max(0, total - paid),
      overpaid: Math.max(0, paid - total),
      prepayDue: Math.max(0, num(q.prepaySum) - paid),
      expenses: spent,
      profitPlan: isNum(q.profit) ? q.profit : (isNum(q.cost) ? total - q.cost : null),
      profitFact: paid - spent
    };
  }

  // ---------- Этапы ----------

  function stageName(key) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i].name; return key; }
  function setStage(order, key, date) {
    order.stage = key;
    var d = date || today(), row = null;
    order.timeline = arr(order.timeline);
    order.timeline.forEach(function (t) { if (t.stage === key) row = t; });
    if (!row) { row = { stage: key }; order.timeline.push(row); }
    row.done = d;
    return touch(order);
  }
  // Ближайшая дата, к которой что-то надо сделать: напоминание или план по этапу.
  function nextDue(order) {
    var list = [];
    arr(order.reminders).forEach(function (r) { if (isObj(r) && !r.done && isDate(r.date)) list.push({ date: r.date.slice(0, 10), text: r.text || "Напоминание" }); });
    arr(order.timeline).forEach(function (t) { if (isObj(t) && !t.done && isDate(t.plan)) list.push({ date: t.plan.slice(0, 10), text: stageName(t.stage) }); });
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return list[0] || null;
  }

  // ---------- Тексты для клиента ----------

  function productSummary(order, product) {
    if (Array.isArray(product.describe) && product.describe.length) return product.describe.slice();
    var sz = product.size && product.size.w ? product.size : null, bb = sz ? null : productBounds(order, product);
    var head = (product.name || PRODUCT_TYPES[product.type] || "Изделие");
    if (sz) head += ", " + sz.w + "x" + sz.h + "x" + sz.d + " мм (ШxВxГ)";
    else if (bb) head += ", " + bb.w + "x" + bb.h + "x" + bb.d + " мм (ШxВxГ)";
    var corpus = {}, fac = {}, tops = {};
    eachPart({ products: [product] }, function (e) {
      var m = getMaterial(order, product, e.part.mat);
      if (!m || m.group === "dvp") return;
      var label = m.name + (m.decor ? ", " + m.decor : "");
      (e.part.role === "facade" ? fac : e.part.role === "countertop" ? tops : corpus)[label] = 1;
    });
    var hw = {};
    eachHardware({ products: [product] }, function (e) { var h = getHardware(order, e.line); if (h.qty > 0 && h.name && !/^крепёж|^крепеж/i.test(h.name)) hw[h.name.toLowerCase()] = 1; });
    var out = [head];
    if (Object.keys(corpus).length) out.push("Корпус: " + Object.keys(corpus).join("; "));
    if (Object.keys(fac).length) out.push("Фасады: " + Object.keys(fac).join("; "));
    if (Object.keys(tops).length) out.push("Столешница: " + Object.keys(tops).join("; "));
    if (Object.keys(hw).length) out.push("Фурнитура: " + Object.keys(hw).join(", "));
    return out;
  }

  function clientText(order) {
    var q = isObj(order.quote) ? order.quote : quote(order), t = order.terms || {}, out = [];
    arr(order.products).forEach(function (p) { out.push(productSummary(order, p).join("\n")); });
    var ex = arr(q.clientLines).filter(function (l) { return l.kind !== "product"; }).map(function (l) { return "- " + l.name; });
    if (ex.length) out.push("Дополнительно:\n" + ex.join("\n"));
    var cur = orderCurrency(order);
    var tail = ["Стоимость: " + money(q.total, cur) + (q.discountPct ? " (со скидкой " + q.discountPct + "%)" : "")];
    if (q.prepaySum) tail.push("Предоплата: " + money(q.prepaySum, cur));
    if (t.days) tail.push("Срок изготовления: " + t.days + (t.daysKind === "calendar" ? " календарных дн." : " рабочих дн."));
    if (t.warrantyMonths) tail.push("Гарантия: " + t.warrantyMonths + " мес.");
    out.push(tail.join("\n"));
    return out.join("\n\n");
  }

  // Телефон для wa.me: только цифры, казахстанская "8" в начале заменяется на "7".
  function waPhone(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "8") d = "7" + d.slice(1);
    if (d.length === 10) d = "7" + d;
    return d;
  }
  function whatsappLink(order, text) {
    var c = order.client || {};
    return "https://wa.me/" + waPhone(c.whatsapp || c.phone) + "?text=" + encodeURIComponent(text === undefined ? clientText(order) : text);
  }

  // Копия заказа для клиента: без себестоимости, наценки, расходов и закупочных цен.
  function forClient(order) {
    var o = clone(order);
    o.audience = "client";
    if (isObj(o.quote)) ["lines", "materials", "work", "services", "cost", "markup", "profit"].forEach(function (k) { delete o.quote[k]; });
    if (isObj(o.pricing)) o.pricing = { discountPct: o.pricing.discountPct, prepayPct: o.pricing.prepayPct, roundTo: o.pricing.roundTo };
    delete o.expenses; delete o.history; delete o.reminders; delete o.x;
    if (isObj(o.catalog)) ["materials", "edges", "hardware"].forEach(function (g) {
      for (var id in (o.catalog[g] || {})) { delete o.catalog[g][id].price; delete o.catalog[g][id].supplier; delete o.catalog[g][id].code; }
    });
    eachHardware(o, function (e) { delete e.line.price; });
    arr(o.extras).forEach(function (x) { if (isObj(x)) { delete x.price; delete x.cost; } });
    return o;
  }

  // ---------- Проверка ----------

  function validate(order, opts) {
    opts = opts || {};
    var errors = [], warnings = [];
    var E = function (path, msg) { errors.push({ level: "error", path: path, msg: msg }); };
    var W = function (path, msg) { warnings.push({ level: "warn", path: path, msg: msg }); };
    var done = function () { return { ok: errors.length === 0, errors: errors, warnings: warnings, all: errors.concat(warnings) }; };

    if (!isObj(order)) { E("", "Заказ должен быть объектом JSON."); return done(); }
    if (order.format !== FORMAT) E("format", 'Поле format должно быть "' + FORMAT + '".');
    if (!isStr(order.version) || !/^\d+\.\d+$/.test(order.version)) E("version", 'Поле version должно быть строкой вида "1.0".');
    else if (order.version.split(".")[0] !== VERSION.split(".")[0]) E("version", "Версия " + order.version + " не поддерживается этим модулем (нужна " + VERSION.split(".")[0] + ".x). Сначала вызовите migrate().");
    if (!isStr(order.id) || !order.id) E("id", "У заказа нет id.");
    ["createdAt", "updatedAt"].forEach(function (k) { if (order[k] !== undefined && !isDate(order[k])) E(k, "Дата " + k + " должна быть в виде 2026-11-14 или 2026-11-14T10:30:00Z."); });
    if (order.currency !== undefined && !CURRENCIES[order.currency]) W("currency", 'Незнакомая валюта "' + order.currency + '". Известные: ' + Object.keys(CURRENCIES).join(", ") + ".");
    if (order.country !== undefined && !COUNTRIES[order.country]) W("country", 'Незнакомая страна "' + order.country + '". Известные: ' + Object.keys(COUNTRIES).join(", ") + ".");
    if (isObj(order.quote) && order.quote.currency && order.currency && order.quote.currency !== order.currency) W("quote.currency", "Расчёт сделан в " + order.quote.currency + ", а валюта заказа " + order.currency + ". Пересчитайте заказ.");
    if (order.units !== undefined && order.units !== "mm") E("units", 'Размеры должны быть в миллиметрах (units: "mm").');
    var stageKeys = STAGES.map(function (s) { return s.key; });
    if (order.stage !== undefined && stageKeys.indexOf(order.stage) < 0) E("stage", 'Неизвестный этап "' + order.stage + '". Возможные: ' + stageKeys.join(", ") + ".");

    if (!isObj(order.client)) E("client", "Нет раздела client.");
    else {
      if (!order.client.name) W("client.name", "Не указано имя клиента.");
      if (!order.client.phone && !order.client.whatsapp) W("client.phone", "Не указан телефон клиента - не получится отправить в WhatsApp.");
      else if (waPhone(order.client.whatsapp || order.client.phone).length !== 11) W("client.phone", "Телефон клиента похож на неполный.");
    }

    var cat = isObj(order.catalog) ? order.catalog : {};
    var mats = isObj(cat.materials) ? cat.materials : {}, edges = isObj(cat.edges) ? cat.edges : {}, hws = isObj(cat.hardware) ? cat.hardware : {};
    if (!isObj(order.catalog)) E("catalog", "Нет раздела catalog (материалы, кромка, фурнитура).");
    Object.keys(mats).forEach(function (id) {
      var m = mats[id], p = "catalog.materials." + id;
      if (!isObj(m)) return E(p, "Материал должен быть объектом.");
      if (!m.name) W(p + ".name", "У материала нет названия.");
      if (!MATERIAL_KINDS[m.kind]) E(p + ".kind", 'Вид материала должен быть "sheet" (лист), "area" (м2) или "length" (п.м.).');
      if (!(isNum(m.t) && m.t > 0)) E(p + ".t", "Не указана толщина материала, мм.");
      if (m.kind === "sheet" && !(isObj(m.sheet) && m.sheet.w > 0 && m.sheet.h > 0)) E(p + ".sheet", "У листового материала нужен размер листа: sheet: { w, h }.");
      if (m.price !== undefined && !(isNum(m.price) && m.price >= 0)) E(p + ".price", "Цена должна быть числом.");
    });
    Object.keys(edges).forEach(function (id) {
      var e = edges[id], p = "catalog.edges." + id;
      if (!isObj(e)) return E(p, "Кромка должна быть объектом.");
      if (!(isNum(e.t) && e.t > 0)) E(p + ".t", "Не указана толщина кромки, мм.");
      if (e.price !== undefined && !(isNum(e.price) && e.price >= 0)) E(p + ".price", "Цена должна быть числом.");
    });

    var ids = {};
    var checkId = function (id, path, what) {
      if (!isStr(id) || !id) return E(path + ".id", "Нет id (" + what + ").");
      if (ids[id]) E(path + ".id", 'Повторяется id "' + id + '" (' + what + "). Каждый id в заказе должен быть уникальным.");
      ids[id] = 1;
    };
    var checkHardware = function (list, path) {
      if (list === undefined) return;
      if (!Array.isArray(list)) return E(path, "Фурнитура должна быть списком.");
      list.forEach(function (h, i) {
        var p = path + "[" + i + "]";
        if (!isObj(h)) return E(p, "Строка фурнитуры должна быть объектом.");
        if (h.item !== undefined && !hws[h.item]) E(p + ".item", 'Фурнитуры "' + h.item + '" нет в catalog.hardware.');
        if (!h.item && !h.name) E(p + ".name", "У фурнитуры нет названия.");
        if (!isNum(h.qty) || h.qty < 0) E(p + ".qty", "Количество должно быть числом.");
        if (h.price !== undefined && !isNum(h.price)) E(p + ".price", "Цена должна быть числом.");
      });
    };
    var boxes = [];
    var checkPart = function (part, path, product, module) {
      if (!isObj(part)) return E(path, "Деталь должна быть объектом.");
      checkId(part.id, path, "деталь");
      var label = 'Деталь "' + (part.name || part.id || "?") + '"';
      var o = ORIENT[part.o];
      if (!o) E(path + ".o", label + ': положение o должно быть "X", "Y" или "Z".');
      if (!(isNum(part.a) && isNum(part.b))) E(path, label + ": размеры a и b должны быть числами.");
      else if (part.a <= 0 || part.b <= 0) W(path, label + ": нулевой размер.");
      var coords = ["x", "y", "z"].filter(function (k) { return part[k] !== undefined; });
      if (coords.length && (coords.length < 3 || !hasPos(part))) E(path, label + ": координаты x, y, z должны быть числами (либо все три, либо ни одной).");
      if (part.qty !== undefined && !(isNum(part.qty) && part.qty >= 1 && part.qty % 1 === 0)) E(path + ".qty", label + ": количество должно быть целым числом от 1.");
      else if (part.qty > 1 && hasPos(part)) W(path + ".qty", label + ": количество больше 1, но координаты только у одной. В 3D будет видна одна деталь.");
      if (part.role !== undefined && !ROLES[part.role]) W(path + ".role", label + ': незнакомая роль "' + part.role + '".');
      if (part.grain !== undefined && ["a", "b", "any"].indexOf(part.grain) < 0) E(path + ".grain", label + ': направление текстуры grain должно быть "a", "b" или "any".');
      var mat = null;
      if (!isStr(part.mat) || !part.mat) E(path + ".mat", label + ": не указан материал.");
      else {
        var mid = resolveRef(part.mat, product);
        if (!mid) E(path + ".mat", label + ': роль материала "' + part.mat + '" не задана в finish изделия.');
        else if (!isObj(mats[mid])) E(path + ".mat", label + ': материала "' + mid + '" нет в catalog.materials.');
        else mat = mats[mid];
      }
      if (part.edges !== undefined) {
        if (!isObj(part.edges)) E(path + ".edges", label + ": кромка должна быть объектом вида { front: \"pvc04\" }.");
        else if (o) Object.keys(part.edges).forEach(function (s) {
          if (!part.edges[s]) return;
          if (o.sidesA.indexOf(s) < 0 && o.sidesB.indexOf(s) < 0) return E(path + ".edges." + s, label + ': у детали с положением "' + part.o + '" нет стороны "' + s + '". Есть: ' + o.sidesA.concat(o.sidesB).join(", ") + ".");
          var eid = resolveRef(part.edges[s], product);
          if (!eid) E(path + ".edges." + s, label + ': роль кромки "' + part.edges[s] + '" не задана в finish изделия.');
          else if (!isObj(edges[eid])) E(path + ".edges." + s, label + ': кромки "' + eid + '" нет в catalog.edges.');
        });
      }
      if (mat && mat.kind === "sheet" && isObj(mat.sheet) && part.a > 0 && part.b > 0) {
        var sw = mat.sheet.w, sh = mat.sheet.h, g = partGrain(part, mat);
        var L = g === "b" ? part.b : part.a, S = g === "b" ? part.a : part.b; // L - вдоль текстуры
        var fitsAlong = L <= Math.max(sw, sh) && S <= Math.min(sw, sh), fitsAny = fitsAlong || (S <= Math.max(sw, sh) && L <= Math.min(sw, sh));
        if (!fitsAny) W(path, label + " " + part.a + "x" + part.b + " не выходит из листа " + sw + "x" + sh + ".");
        else if (g !== "any" && !fitsAlong) W(path, label + " " + part.a + "x" + part.b + " выходит из листа только поперёк текстуры.");
      }
      if (mat && o && hasPos(part)) boxes.push({ label: label, path: path, product: product, box: partBox(order, product, module, part) });
    };

    if (!Array.isArray(order.products)) E("products", "Нет списка изделий products.");
    else {
      if (!order.products.length) W("products", "В заказе пока нет изделий.");
      order.products.forEach(function (p, pi) {
        var pp = "products[" + pi + "]";
        if (!isObj(p)) return E(pp, "Изделие должно быть объектом.");
        checkId(p.id, pp, "изделие");
        if (!PRODUCT_TYPES[p.type]) E(pp + ".type", 'Тип изделия должен быть "kupe", "kitchen" или "univ".');
        if (!p.name) W(pp + ".name", "У изделия нет названия.");
        if (p.qty !== undefined && !(isNum(p.qty) && p.qty >= 1)) E(pp + ".qty", "Количество изделий должно быть числом от 1.");
        if (p.finish !== undefined && !isObj(p.finish)) E(pp + ".finish", "finish должен быть объектом вида { corpus: \"ldsp16\" }.");
        else Object.keys(p.finish || {}).forEach(function (role) {
          var id = p.finish[role];
          if (!isStr(id) || (!mats[id] && !edges[id])) E(pp + ".finish." + role, 'Отделка "' + role + '": материала или кромки "' + id + '" нет в catalog.');
        });
        if (p.parts !== undefined && !Array.isArray(p.parts)) E(pp + ".parts", "parts должен быть списком.");
        arr(p.parts).forEach(function (part, i) { checkPart(part, pp + ".parts[" + i + "]", p, null); });
        checkHardware(p.hardware, pp + ".hardware");
        if (p.modules !== undefined && !Array.isArray(p.modules)) E(pp + ".modules", "modules должен быть списком.");
        var count = arr(p.parts).length;
        arr(p.modules).forEach(function (m, mi) {
          var mp = pp + ".modules[" + mi + "]";
          if (!isObj(m)) return E(mp, "Модуль должен быть объектом.");
          checkId(m.id, mp, "модуль");
          if (m.pos !== undefined && !(isObj(m.pos) && isNum(m.pos.x) && isNum(m.pos.y) && isNum(m.pos.z))) E(mp + ".pos", "Положение модуля: pos: { x, y, z } числами.");
          if (m.rot !== undefined && [0, 90, 180, 270].indexOf(m.rot) < 0) E(mp + ".rot", "Поворот модуля rot может быть 0, 90, 180 или 270.");
          arr(m.parts).forEach(function (part, i) { checkPart(part, mp + ".parts[" + i + "]", p, m); });
          checkHardware(m.hardware, mp + ".hardware");
          count += arr(m.parts).length;
        });
        if (!count && !(isObj(p.generator) && p.generator.id)) W(pp, 'В изделии "' + (p.name || p.id) + '" нет деталей.');
        else if (!count) W(pp, 'В изделии "' + (p.name || p.id) + '" пока нет деталей - только параметры. Откройте его в калькуляторе, чтобы построить детали.');
      });
    }

    // Пересечения деталей (внутри одного изделия). Касание и заход до 1 мм не считаются.
    if (opts.geometry !== false && boxes.length <= (opts.maxGeometryParts || 800)) {
      var hits = 0, max = opts.maxOverlaps || 10, e = 1;
      for (var i = 0; i < boxes.length && hits < max; i++) for (var j = i + 1; j < boxes.length && hits < max; j++) {
        if (boxes[i].product !== boxes[j].product) continue;
        var a = boxes[i].box, c = boxes[j].box;
        if (a.x0 < c.x1 - e && c.x0 < a.x1 - e && a.y0 < c.y1 - e && c.y0 < a.y1 - e && a.z0 < c.z1 - e && c.z0 < a.z1 - e) {
          W(boxes[i].path, boxes[i].label + " и " + boxes[j].label.replace(/^Д/, "д") + " пересекаются."); hits++;
        }
      }
    }

    if (order.extras !== undefined && !Array.isArray(order.extras)) E("extras", "extras должен быть списком.");
    arr(order.extras).forEach(function (x, i) {
      var p = "extras[" + i + "]";
      if (!isObj(x)) return E(p, "Позиция должна быть объектом.");
      if (x.kind !== undefined && !EXTRA_KINDS[x.kind]) E(p + ".kind", 'Вид позиции: "item", "delivery", "install" или "service".');
      if (!x.name && !x.kind) W(p + ".name", "У позиции нет названия.");
      if (x.price !== undefined && !isNum(x.price)) E(p + ".price", "Цена должна быть числом.");
      if (x.qty !== undefined && !isNum(x.qty)) E(p + ".qty", "Количество должно быть числом.");
    });

    if (order.pricing !== undefined) {
      if (!isObj(order.pricing)) E("pricing", "pricing должен быть объектом.");
      else {
        var pr = order.pricing, pct = function (k, lo, hi) { if (pr[k] !== undefined && !(isNum(pr[k]) && pr[k] >= lo && pr[k] <= hi)) E("pricing." + k, k + " должно быть числом от " + lo + " до " + hi + "."); };
        pct("workPct", 0, 500); pct("markupPct", 0, 1000); pct("discountPct", 0, 90); pct("prepayPct", 0, 100); pct("sheetUsagePct", 30, 100); pct("edgeReservePct", 0, 100);
        if (pr.roundTo !== undefined && !(isNum(pr.roundTo) && pr.roundTo >= 1)) E("pricing.roundTo", "roundTo должно быть числом от 1.");
      }
    }
    if (order.terms !== undefined) {
      if (!isObj(order.terms)) E("terms", "terms должен быть объектом.");
      else if (order.terms.daysKind !== undefined && ["work", "calendar"].indexOf(order.terms.daysKind) < 0) E("terms.daysKind", 'daysKind: "work" (рабочие дни) или "calendar" (календарные).');
    }

    arr(order.timeline).forEach(function (t, i) {
      var p = "timeline[" + i + "]";
      if (!isObj(t)) return E(p, "Запись этапа должна быть объектом.");
      if (stageKeys.indexOf(t.stage) < 0) E(p + ".stage", 'Неизвестный этап "' + t.stage + '".');
      ["plan", "done"].forEach(function (k) { if (t[k] !== undefined && t[k] !== null && !isDate(t[k])) E(p + "." + k, "Дата должна быть в виде 2026-11-14."); });
    });
    arr(order.payments).forEach(function (x, i) {
      var p = "payments[" + i + "]";
      if (!isObj(x)) return E(p, "Оплата должна быть объектом.");
      if (!(isNum(x.amount) && x.amount > 0)) E(p + ".amount", "Сумма оплаты должна быть числом больше нуля.");
      if (!isDate(x.date)) E(p + ".date", "Дата оплаты должна быть в виде 2026-11-14.");
      if (x.kind !== undefined && !PAYMENT_KINDS[x.kind]) E(p + ".kind", 'Вид оплаты: "prepay", "payment" или "refund".');
      if (x.method !== undefined && !PAYMENT_METHODS[x.method]) W(p + ".method", 'Незнакомый способ оплаты "' + x.method + '".');
    });
    arr(order.expenses).forEach(function (x, i) {
      var p = "expenses[" + i + "]";
      if (!isObj(x)) return E(p, "Расход должен быть объектом.");
      if (!isNum(x.amount)) E(p + ".amount", "Сумма расхода должна быть числом.");
      if (x.date !== undefined && !isDate(x.date)) E(p + ".date", "Дата расхода должна быть в виде 2026-11-14.");
      if (x.category !== undefined && !EXPENSE_CATEGORIES[x.category]) W(p + ".category", 'Незнакомая статья расхода "' + x.category + '".');
    });
    arr(order.reminders).forEach(function (x, i) {
      if (!isObj(x)) return E("reminders[" + i + "]", "Напоминание должно быть объектом.");
      if (!isDate(x.date)) E("reminders[" + i + "].date", "Дата напоминания должна быть в виде 2026-11-14.");
    });

    if (order.quote !== undefined) {
      if (!isObj(order.quote)) E("quote", "quote должен быть объектом.");
      else {
        if (!isNum(order.quote.total)) E("quote.total", "В расчёте нет итоговой суммы total.");
        else {
          var bal = balance(order);
          if (bal.overpaid > 0) W("payments", "Оплачено больше, чем стоит заказ: переплата " + money(bal.overpaid, orderCurrency(order)) + ".");
          if (order.stage === "production" && bal.paid === 0) W("payments", "Заказ в производстве, а оплат нет.");
        }
        if (order.audience !== "client" && isDate(order.quote.calcAt) && isDate(order.updatedAt) && Date.parse(order.updatedAt) - Date.parse(order.quote.calcAt) > 60000) W("quote", "Заказ менялся после расчёта цены. Пересчитайте, чтобы цена была актуальной.");
      }
    }
    return done();
  }

  // ---------- Миграция ----------

  // Соответствие старых цен калькулятора (localStorage "kupe_prices") новому каталогу.
  var LEGACY_PRICE = {
    ldsp: ["materials", "ldsp16"], dvp: ["materials", "dvp3"], mirror: ["materials", "mirror4"], lacobel: ["materials", "lacobel4"],
    fac_film: ["materials", "mdf18-film"], fac_plastic: ["materials", "mdf18-plastic"], fac_enamel: ["materials", "mdf18-enamel"], top_ldsp: ["materials", "top38"],
    edge: ["edges", "pvc04"],
    handle: ["hardware", "handle"], hinge: ["hardware", "hinge"], kguide: ["hardware", "kguide"], guide: ["hardware", "guide"], lift: ["hardware", "lift"],
    leg: ["hardware", "leg"], push: ["hardware", "push"], gola: ["hardware", "gola"], rod: ["hardware", "rod"], led: ["hardware", "led"], ledpow: ["hardware", "ledpow"],
    dryer: ["hardware", "dryer"], prof_eco: ["hardware", "prof-eco"], prof_std: ["hardware", "prof-std"], prof_prem: ["hardware", "prof-prem"]
  };
  var LEGACY_PRICING = { work: "workPct", markup: "markupPct", usage: "sheetUsagePct", round: "roundTo", cut: "cutPerSheet" };
  var LEGACY_MAT = { ldsp16: "ldsp16", ldsp16f: "ldsp16", dvp: "dvp3", mdf: "mdf18-film", mirror: "mirror4", glass: "lacobel4", top38: "top38" };
  var LEGACY_FACADE = { ldsp16f: 1, mdf: 1, mirror: 1, glass: 1 };
  var LEGACY_TPL = { cabinet: "Шкаф распашной", tumba: "Тумба", komod: "Комод", shelf: "Стеллаж", bed: "Кровать", hall: "Прихожая", table: "Стол", empty: "Изделие" };

  function guessRole(name, facade) {
    if (facade) return "facade";
    var n = String(name || "").toLowerCase();
    if (n.indexOf("ящик") >= 0) return "drawer";
    if (n.indexOf("боков") >= 0 || n.indexOf("стойк") >= 0) return "side";
    if (n.indexOf("крыш") >= 0) return "top";
    if (n.indexOf("дно") >= 0) return "bottom";
    if (n.indexOf("полк") >= 0) return "shelf";
    if (n.indexOf("перегород") >= 0) return "partition";
    if (n.indexOf("задн") >= 0) return "back";
    if (n.indexOf("цокол") >= 0) return "plinth";
    if (n.indexOf("столешн") >= 0) return "countertop";
    return "other";
  }

  // Старый код кромки 0-4 (сколько сторон) в кромку по сторонам.
  function legacyEdges(o, a, b, code, edgeId) {
    var or = ORIENT[o], n = Math.max(0, Math.min(4, num(code)));
    if (!or || !n) return undefined;
    var longS = a >= b ? or.sidesA : or.sidesB, shortS = a >= b ? or.sidesB : or.sidesA;
    var order = [longS[0], longS[1], shortS[0], shortS[1]], out = {};
    for (var i = 0; i < n; i++) out[order[i]] = edgeId;
    return out;
  }

  function isLegacyState(o) { return isObj(o) && !o.format && ["kupe", "kitchen", "univ"].indexOf(o.mode) >= 0; }
  function isLegacySaved(o) { return isObj(o) && !o.format && isLegacyState(o.state); }

  function fromLegacy(src, opts, notes) {
    var saved = isLegacySaved(src) ? src : null, s = saved ? saved.state : src;
    var o = create();
    o.title = saved && saved.name ? String(saved.name) : "";
    o.client.name = s.client ? String(s.client) : "";
    if (saved && /^\d{2}\.\d{2}\.\d{4}$/.test(saved.date || "")) {
      var d = saved.date.split(".");
      o.createdAt = o.updatedAt = d[2] + "-" + d[1] + "-" + d[0] + "T00:00:00.000Z";
      o.timeline = [{ stage: "lead", done: o.createdAt.slice(0, 10) }];
    }
    var prices = isObj(opts.prices) ? opts.prices : null;
    if (prices) {
      for (var k in prices) {
        if (LEGACY_PRICE[k]) o.catalog[LEGACY_PRICE[k][0]][LEGACY_PRICE[k][1]].price = num(prices[k]);
        else if (LEGACY_PRICING[k]) o.pricing[LEGACY_PRICING[k]] = num(prices[k]);
      }
    } else notes.push("Цены взяты примерные. Чтобы перенести свои, передайте их в migrate(obj, { prices }).");
    o.pricing.discountPct = Math.min(90, Math.max(0, num(s.disc)));
    o.pricing.prepayPct = Math.min(100, Math.max(0, num(s.prepay, 50)));
    o.terms.days = Math.max(1, num(s.days, 30));
    arr(s.extras).forEach(function (x) { if (isObj(x)) o.extras.push({ id: uid("x"), kind: "item", name: String(x.name || "Своя позиция"), qty: num(x.q, 1), unit: "шт", price: num(x.p) }); });
    var decor = s.decor ? String(s.decor) : "";
    if (decor) o.catalog.materials.ldsp16.decor = decor;

    var pr = newProduct({ type: s.mode, finish: { corpus: "ldsp16", back: "dvp3", edge: "pvc04" } });
    if (s.mode === "univ") {
      var u = isObj(s.u) ? s.u : {};
      pr.name = LEGACY_TPL[u.tpl] || "Изделие";
      pr.template = u.tpl || "empty";
      pr.params = isObj(u.prms) && isObj(u.prms[u.tpl]) ? clone(u.prms[u.tpl]) : {};
      pr.generator = { id: "calc-univ-" + (u.tpl || "empty"), version: 0, manual: !!u.manual };
      arr(u.panels).forEach(function (p) {
        if (!isObj(p)) return;
        var matId = LEGACY_MAT[p.mat] || "ldsp16", facade = !!LEGACY_FACADE[p.mat];
        var m = o.catalog.materials[matId];
        var part = { id: uid("p"), name: String(p.name || ""), role: guessRole(p.name, facade), mat: matId, o: ORIENT[p.o] ? p.o : "X", x: num(p.x), y: num(p.y), z: num(p.z), a: num(p.a), b: num(p.b) };
        if (m.kind === "sheet" && matId !== "dvp3") { var ed = legacyEdges(part.o, part.a, part.b, p.edge, "pvc04"); if (ed) part.edges = ed; }
        pr.parts.push(part);
      });
      arr(u.hw).forEach(function (h) { if (isObj(h) && num(h.q) > 0) pr.hardware.push({ name: String(h.name || "Фурнитура"), qty: num(h.q), unit: "шт", price: num(h.p) }); });
      var bb = productBounds(o, pr);
      if (bb) pr.size = { w: bb.w, h: bb.h, d: bb.d };
      o.extras.push({ id: uid("x"), kind: "install", name: "Доставка и сборка", qty: 1, unit: "усл", price: prices && isNum(prices.uinstall) ? prices.uinstall : 10000 });
      o.products.push(pr);
      recalc(o);
      if (saved && isNum(saved.total) && saved.total !== o.quote.total) notes.push("Цена пересчитана по правилам формата: было " + money(saved.total, "KZT") + ", стало " + money(o.quote.total, "KZT") + ". Проверьте цены и позиции.");
    } else {
      var keysKupe = ["type", "W", "H", "D", "N", "DH", "ant", "back", "led", "M", "prof"];
      var keysKitchen = ["k_layout", "k_fac", "k_Hl", "k_Hu", "k_Ht", "k_handles", "k_top", "k_cutSink", "k_cutHob", "k_apron", "k_tplinth", "k_led"];
      pr.params = { decor: decor };
      (s.mode === "kupe" ? keysKupe : keysKitchen).forEach(function (k) { if (s[k] !== undefined) pr.params[k] = s[k]; });
      if (s.mode === "kupe") {
        pr.name = "Шкаф-купе";
        pr.size = { w: num(s.W), h: num(s.H), d: num(s.D) };
        pr.params.secs = clone(arr(s.secs)); pr.params.doors = clone(arr(s.doors));
      } else {
        pr.name = "Кухня";
        pr.params.walls = clone(arr(s.walls)).slice(0, Math.max(1, num(s.k_layout, 1)));
      }
      pr.generator = { id: "calc-" + s.mode, version: 0 };
      o.products.push(pr);
      if (saved && isNum(saved.total)) o.quote = { calcAt: o.updatedAt, currency: "KZT", total: saved.total, subtotal: saved.total, discountPct: o.pricing.discountPct, discountSum: 0, prepayPct: o.pricing.prepayPct, prepaySum: ceilTo(saved.total * o.pricing.prepayPct / 100, o.pricing.roundTo), clientLines: [{ kind: "product", ref: pr.id, name: pr.name, qty: 1, unit: "шт", sum: saved.total }], source: "legacy" };
      notes.push('Старый расчёт "' + pr.name + '" перенесён параметрами, без списка деталей. Детали появятся, когда калькулятор построит изделие на общем движке.');
    }
    return o;
  }

  // Приводит объект к текущей версии формата. Возвращает { order, from, changed, notes }.
  // Понимает: заказ текущей версии, состояние старого калькулятора (getState) и запись из его списка "Сохранённые".
  function migrate(src, opts) {
    opts = opts || {};
    var notes = [];
    if (isLegacySaved(src) || isLegacyState(src)) return { order: fromLegacy(src, opts, notes), from: "calc-legacy", changed: true, notes: notes };
    if (!isObj(src) || src.format !== FORMAT) throw new Error("Это не заказ в формате " + FORMAT + ".");
    var major = parseInt(String(src.version).split(".")[0], 10);
    if (!(major >= 1)) throw new Error("Непонятная версия заказа: " + src.version + ".");
    if (major > parseInt(VERSION, 10)) throw new Error("Заказ сохранён в более новой версии формата (" + src.version + "). Обновите инструмент.");
    var order = clone(src), from = String(src.version);
    // Здесь будут шаги вида: if (major === 1) { ...перевод в 2.0...; major = 2; }
    // Младшая версия (1.0 -> 1.1) только добавляет необязательные поля и миграции не требует.
    normalize(order);
    return { order: order, from: from, changed: false, notes: notes };
  }

  // ---------- Импорт и экспорт ----------

  // Читает текст JSON: заказ, старый расчёт или список старых расчётов. Возвращает { order, report, notes } или список таких объектов для массива.
  function parse(text, opts) {
    var data;
    try { data = typeof text === "string" ? JSON.parse(text) : text; }
    catch (e) { throw new Error("Файл не читается: это не JSON."); }
    var one = function (obj) {
      var m = migrate(obj, opts);
      return { order: m.order, report: validate(m.order, opts), notes: m.notes, from: m.from };
    };
    return Array.isArray(data) ? data.map(one) : one(data);
  }

  function stringify(order, pretty) { return JSON.stringify(order, null, pretty === false ? 0 : 2); }

  function fileName(order) {
    var name = [order.number, (order.client && order.client.name) || order.title || "zakaz"].filter(Boolean).join(" ");
    name = name.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "zakaz";
    return name + FILE_EXT;
  }

  // Только в браузере: скачать заказ файлом.
  function download(order) {
    var blob = new Blob([stringify(order)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = fileName(order);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  // Только в браузере: прочитать файл из <input type="file">. Возвращает Promise с результатом parse().
  function readFile(file, opts) {
    return file.text().then(function (t) { return parse(t, opts); });
  }

  // --- Заказ в ссылке: сжатый JSON в хвосте адреса после "#order=" ---
  function b64urlEncode(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(str) {
    var s = atob(str.replace(/-/g, "+").replace(/_/g, "/")), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function pipe(bytes, stream) {
    var w = stream.writable.getWriter();
    w.write(bytes); w.close();
    return new Response(stream.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  // Возвращает Promise со строкой "m1.xxxxx" (сжато) или "j1.xxxxx" (без сжатия, если браузер старый).
  function encode(order) {
    var bytes = new TextEncoder().encode(JSON.stringify(order));
    if (typeof CompressionStream === "undefined") return Promise.resolve("j1." + b64urlEncode(bytes));
    return pipe(bytes, new CompressionStream("deflate-raw")).then(function (z) { return "m1." + b64urlEncode(z); });
  }
  function decode(code, opts) {
    code = String(code || "");
    var done = function (bytes) { return parse(new TextDecoder().decode(bytes), opts); };
    if (code.indexOf("j1.") === 0) return Promise.resolve(done(b64urlDecode(code.slice(3))));
    if (code.indexOf("m1.") === 0) {
      if (typeof DecompressionStream === "undefined") return Promise.reject(new Error("Этот браузер не умеет открывать сжатые ссылки. Обновите браузер."));
      return pipe(b64urlDecode(code.slice(3)), new DecompressionStream("deflate-raw")).then(done);
    }
    return Promise.reject(new Error("В ссылке нет заказа."));
  }
  // Ссылка на страницу инструмента с заказом внутри: toLink(order, "https://.../configurator.html").
  function toLink(order, baseUrl) {
    return encode(order).then(function (c) { return String(baseUrl || "").split("#")[0] + "#order=" + c; });
  }
  // Достаёт заказ из ссылки или из location.hash. Promise с результатом parse() либо null, если заказа в ссылке нет.
  function fromLink(url) {
    var m = /[#&]order=([A-Za-z0-9._-]+)/.exec(String(url === undefined && typeof location !== "undefined" ? location.hash : url || ""));
    return m ? decode(m[1]) : Promise.resolve(null);
  }

  return {
    FORMAT: FORMAT, VERSION: VERSION, FILE_EXT: FILE_EXT,
    STAGES: STAGES, PRODUCT_TYPES: PRODUCT_TYPES, ORIENT: ORIENT, SIDE_NAMES: SIDE_NAMES, ROLES: ROLES,
    CURRENCIES: CURRENCIES, COUNTRIES: COUNTRIES,
    currencyInfo: currencyInfo, countryInfo: countryInfo, countryOfCurrency: countryOfCurrency, guessCountry: guessCountry,
    region: region, setRegion: setRegion, orderCountry: orderCountry, orderCurrency: orderCurrency,
    money: money, moneyWords: moneyWords, numWords: numWords, currencyWord: currencyWord, plural: plural, roundStep: roundStep, convert: convert, niceRound: niceRound, starterPrice: starterPrice,
    MATERIAL_KINDS: MATERIAL_KINDS, EXTRA_KINDS: EXTRA_KINDS, PAYMENT_KINDS: PAYMENT_KINDS, PAYMENT_METHODS: PAYMENT_METHODS, EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    defaultCatalog: defaultCatalog, defaultPricing: defaultPricing, defaultProduction: defaultProduction,
    create: create, newProduct: newProduct, newModule: newModule, newPart: newPart, normalize: normalize, touch: touch, uid: uid, clone: clone,
    resolveRef: resolveRef, getMaterial: getMaterial, getEdge: getEdge, getHardware: getHardware,
    partDims: partDims, partBox: partBox, partWorldBox: partWorldBox, placeBox: placeBox, productBounds: productBounds,
    nestSheets: nestSheets, packLengths: packLengths, eachPart: eachPart, listParts: listParts, eachHardware: eachHardware, findPart: findPart, assignMarks: assignMarks,
    partGrain: partGrain, partEdges: partEdges, partEdgeLength: partEdgeLength, legacyEdges: legacyEdges,
    cutList: cutList, facadeList: facadeList, bom: bom, quote: quote, recalc: recalc, balance: balance,
    stageName: stageName, setStage: setStage, nextDue: nextDue,
    productSummary: productSummary, clientText: clientText, waPhone: waPhone, whatsappLink: whatsappLink, forClient: forClient, fmtMoney: fmtMoney,
    validate: validate, migrate: migrate,
    parse: parse, stringify: stringify, fileName: fileName, download: download, readFile: readFile,
    encode: encode, decode: decode, toLink: toLink, fromLink: fromLink
  };
});
