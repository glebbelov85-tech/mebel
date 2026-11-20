/*
 * Блокнот мастера - второй продукт сайта "Мебельный конструктор".
 * Для мастера, который работает по эскизу: описал изделие голосом, сфотографировал эскиз и комнату,
 * ответил на вопросы (нажатием или голосом), записывает правки клиента - и отдаёт в цех ТЗ
 * с картинкой и пометками "Внимание". Без бухгалтерии и документов.
 *
 * Данные: localStorage "bk1" (заказы, настройки), IndexedDB "bk-photos" (фото, сжатые до 1600 px).
 * Вопросы - в voprosy.js (window.BkQ). Валюта и суммы - общий модуль заказа (MebelOrder),
 * голосовой помощник и подпись автора - общий site.js.
 */
(function () {
  "use strict";
  var MO = window.MebelOrder, Q = window.BkQ, S = window.MebelSite;
  var KEY = "bk1", NA = "-"; // NA - ответ "не нужно"
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var uid = function (p) { return (p || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  var STATUS = [["talk", "Обсуждаем"], ["ok", "Утверждено"], ["work", "В цеху"], ["done", "Сдан"]];
  var KINDS = ["Эскиз", "Комната", "Рендер ИИ", "Пример"];
  var PRESETS = [["Корпус", "шт"], ["Фасады", "м²"], ["Столешница", "пог. м"], ["Фурнитура", "компл"], ["Подсветка", "компл"], ["Стекло/зеркало", "шт"], ["Обивка", "шт"], ["Ножки/цоколь", "компл"], ["Монтаж", "усл"], ["Доставка", "усл"]];
  var SIZE_LABELS = ["Ширина", "Высота", "Глубина", "Выступ", "Ниша", "От пола", "До потолка", "Спальное место"];
  // части и нюансы изделия: не модули фабрики, а что угодно своё - выступ, ящик длиннее, панель за стену
  var PART_KINDS = ["Выступ", "Ниша", "Ящик", "Дверь", "Полка", "Панель", "Тайник", "Подсветка", "Изголовье", "Зеркало", "Щит", "Ножки"];
  var svg = function (p, s) { return '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" aria-hidden="true"><path fill="currentColor" d="' + p + '"/></svg>'; };
  var IC = {
    mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 19 12z",
    wa: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.6-.1 1.2z",
    copy: "M8 3h11a2 2 0 0 1 2 2v11h-2V5H8zM5 7h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z",
    print: "M7 3h10v4H7zM5 8h14a3 3 0 0 1 3 3v6h-4v4H6v-4H2v-6a3 3 0 0 1 3-3zm3 8v3h8v-3z",
    plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",
    cam: "M9 3h6l2 3h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3zm3 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"
  };

  // ======================= хранение =======================
  var DB;
  function load() {
    try { DB = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { DB = null; }
    if (!DB || !Array.isArray(DB.projects)) DB = { v: 1, projects: [], cur: "", set: {}, custom: {} };
    if (!DB.set) DB.set = {};
    if (!DB.custom) DB.custom = {};
    if (!DB.ui) DB.ui = {};
  }
  function save() {
    var p = proj(); if (p) p.updated = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(DB)); }
    catch (e) { toast("Память браузера переполнена - скачайте копию блокнота и удалите старые заказы"); }
  }
  // фото - в IndexedDB, чтобы не упираться в 5 МБ localStorage
  var idb = null, urls = {};
  function idbOpen() {
    if (idb) return idb;
    idb = new Promise(function (ok, bad) {
      if (!window.indexedDB) return bad(new Error("Браузер не хранит фото"));
      var r = indexedDB.open("bk-photos", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("p"); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { bad(r.error); };
    });
    return idb;
  }
  function idbDo(mode, fn) {
    return idbOpen().then(function (db) {
      return new Promise(function (ok, bad) {
        var tx = db.transaction("p", mode), st = tx.objectStore("p"), req = fn(st);
        tx.oncomplete = function () { ok(req && req.result); };
        tx.onerror = function () { bad(tx.error); };
      });
    });
  }
  function photoPut(id, blob) { return idbDo("readwrite", function (s) { return s.put(blob, id); }); }
  function photoGet(id) { return idbDo("readonly", function (s) { return s.get(id); }); }
  function photoDel(id) { if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } return idbDo("readwrite", function (s) { return s.delete(id); }).catch(function () {}); }
  function photoUrl(id) {
    if (urls[id]) return Promise.resolve(urls[id]);
    return photoGet(id).then(function (b) { if (!b) return ""; urls[id] = URL.createObjectURL(b); return urls[id]; }).catch(function () { return ""; });
  }
  // картинки в разметке ставим с data-ph, адрес подставляется после отрисовки
  function fillPhotos(root) {
    [].forEach.call((root || document).querySelectorAll("img[data-ph]"), function (img) {
      photoUrl(img.dataset.ph).then(function (u) { if (u) img.src = u; else img.alt = "Фото не найдено"; });
    });
  }
  function shrink(file, max) {
    return new Promise(function (ok, bad) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, (max || 1600) / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? ok(b) : bad(new Error("Не получилось сжать фото")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(u); bad(new Error("Это не фото или формат не поддерживается")); };
      img.src = u;
    });
  }

  // ======================= модель =======================
  function cur() { var p = proj(); return (p && p.cur) || DB.set.cur || (MO ? MO.region().currency : "KZT"); }
  function money(n, c) { return MO ? MO.money(Math.round(n || 0), c || cur()) : String(Math.round(n || 0)); }
  function signed(n, c) { return (n > 0 ? "+" : n < 0 ? "-" : "") + money(Math.abs(n), c); }
  function proj() { for (var i = 0; i < DB.projects.length; i++) if (DB.projects[i].id === DB.cur) return DB.projects[i]; return null; }
  function item(p) { p = p || proj(); if (!p || !p.items.length) return null; for (var i = 0; i < p.items.length; i++) if (p.items[i].id === p.curItem) return p.items[i]; p.curItem = p.items[0].id; return p.items[0]; }
  function itemById(p, id) { for (var i = 0; i < p.items.length; i++) if (p.items[i].id === id) return p.items[i]; return null; }
  function typeOf(id) { for (var i = 0; i < Q.TYPES.length; i++) if (Q.TYPES[i].id === id) return Q.TYPES[i]; return Q.TYPES[Q.TYPES.length - 1]; }
  function newItem(type) {
    var t = typeOf(type || "shkaf");
    return { id: uid("i"), type: t.id, name: t.n, qty: 1, desc: "", sizes: [{ l: "Ширина", v: "" }, { l: "Высота", v: "" }, { l: "Глубина", v: "" }], parts: [], ans: {}, notes: {}, est: [], photos: [] };
  }
  function newProject() {
    var p = { id: uid("p"), client: "", phone: "", addr: "", status: "talk", created: new Date().toISOString(), updated: new Date().toISOString(), cur: cur(), items: [newItem("shkaf")], changes: [] };
    p.curItem = p.items[0].id;
    DB.projects.unshift(p); DB.cur = p.id; save();
    return p;
  }
  function projTitle(p) {
    var names = p.items.map(function (i) { return i.name || typeOf(i.type).n; });
    return (p.client || "Без имени") + (names.length ? " - " + names.slice(0, 3).join(", ") + (names.length > 3 ? " и ещё " + (names.length - 3) : "") : "");
  }
  function statusName(s) { for (var i = 0; i < STATUS.length; i++) if (STATUS[i][0] === s) return STATUS[i][1]; return ""; }

  // ---- вопросы изделия ----
  function customQ(type) {
    return (DB.custom[type] || []).map(function (c) { return { id: c.id, g: "Особое", s: c.t, t: c.t, ty: "*", free: "Ответ", custom: true }; });
  }
  function allQ(it) { return Q.forType(it.type).concat(customQ(it.type)); }
  function fromDesc(it) {
    var d = String(it.desc || "").toLowerCase().replace(/ё/g, "е");
    return d ? allQ(it).filter(function (q) { return q.kw && q.kw.test(d); }).map(function (q) { return q.id; }) : [];
  }
  function visibleQ(it) {
    var A = it.ans, fd = fromDesc(it);
    var list = allQ(it).filter(function (q) { return !q.when || q.when(A); });
    // сначала то, о чём мастер сам сказал в описании (кроме "Главного" - оно всегда первое)
    return list.filter(function (q) { return q.g === "Главное"; })
      .concat(list.filter(function (q) { return q.g !== "Главное" && fd.indexOf(q.id) >= 0; }))
      .concat(list.filter(function (q) { return q.g !== "Главное" && fd.indexOf(q.id) < 0; }));
  }
  function answered(it, q) { var v = it.ans[q.id]; return v !== undefined && v !== "" && !(Array.isArray(v) && !v.length); }
  function val(v) { return v === NA ? "не нужно" : Q.txt(v); }
  function photoOf(it, kind) { return (it.photos || []).filter(function (f) { return f.kind === kind; }); }
  function warnings(it) {
    var out = [], A = it.ans;
    visibleQ(it).forEach(function (q) {
      if (!q.w || !answered(it, q) || A[q.id] === NA) return;
      var r = q.w(A[q.id], A); if (r) out.push({ q: q.id, t: r });
    });
    (it.parts || []).forEach(function (x) { if (x.w) out.push({ t: "Нюанс: " + partLine(x) }); });
    if (!photoOf(it, "Эскиз").length && A.g_eskiz !== "Да, но фото нет" && A.g_eskiz !== "Ещё обсуждаем") out.push({ t: "Нет фото эскиза - добавьте его в разделе \"Изделие\", цех сверяется по картинке." });
    if (!(it.sizes || []).some(function (s) { return String(s.v).trim(); })) out.push({ t: "Размеры не заполнены." });
    return out;
  }
  function partsSum(it) { return (it.parts || []).reduce(function (s, x) { return s + (+x.q || 1) * (+x.p || 0); }, 0); }
  function estSum(it) { return ((it.est || []).reduce(function (s, l) { return s + (+l.q || 0) * (+l.p || 0); }, 0) + partsSum(it)) * Math.max(1, +it.qty || 1); }
  function partLine(x) { return (x.n || "Нюанс") + (x.q > 1 ? " x" + x.q : "") + (x.sz ? " - " + x.sz + (/^\d+([.,]\d+)?$/.test(String(x.sz).trim()) ? " мм" : "") : "") + (x.t ? ": " + x.t : ""); }
  // нюанс из фразы: "выступ 50 мм слева, внимание, плюс 8 тысяч"
  function partFromText(text) {
    var r = parseChange(text), t = (r.text || "").trim(), w = /внимани|важно|не забыть|обязательно|осторожно/i.test(t);
    t = t.replace(/[,.]?\s*(внимание|важно|не забыть|обязательно|осторожно)[,.!]?/gi, " ").replace(/\s+/g, " ").trim();
    var szs = [], m, re = /\d{2,4}(?:[.,]\d+)?\s*(?:(?:на|x|х|\*)\s*\d{2,4}(?:\s*(?:на|x|х|\*)\s*\d{2,4})?)?\s*(?:мм|см|миллиметр\w*|сантиметр\w*)?/gi;
    while ((m = re.exec(t))) szs.push(m[0].trim().replace(/\s*(миллиметр\w*)$/i, " мм").replace(/\s*(сантиметр\w*)$/i, " см"));
    var cut = t.search(/[,\d]/), name = (cut > 0 ? t.slice(0, cut) : cut === 0 ? "" : t).replace(/\s+(на|в|с)$/i, "").trim();
    if (name.split(" ").length > 5) name = name.split(" ").slice(0, 4).join(" ");
    var note = t.slice(name.length);
    szs.forEach(function (z) { note = note.replace(z, " "); });
    note = note.replace(/^[\s,.\-]+|[\s,.\-]+$/g, "").replace(/\s+/g, " ").replace(/^(на|в)\s+/i, "");
    return { id: uid("n"), n: name ? name.charAt(0).toUpperCase() + name.slice(1) : "Нюанс", sz: szs.join(", "), t: note, q: 1, p: r.d ? Math.abs(r.d) : "", w: w };
  }
  function totals(p) {
    var base = p.items.reduce(function (s, i) { return s + estSum(i); }, 0), ok = 0, wait = 0, nWait = 0;
    p.changes.forEach(function (c) { if (c.st === "ok") ok += +c.d || 0; else if (c.st === "wait") { wait += +c.d || 0; nWait++; } });
    return { base: base, ok: ok, wait: wait, nWait: nWait, total: base + ok };
  }

  // ======================= мелочи =======================
  var tT = 0;
  function toast(t) { var el = $("toast"); el.textContent = t; el.className = "on"; clearTimeout(tT); tT = setTimeout(function () { el.className = ""; }, 3200); }
  function dshort(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.getDate() + " " + MON[d.getMonth()]; }
  function dfull(iso) { var d = new Date(iso || Date.now()); return d.toLocaleDateString("ru-RU"); }
  function copy(text, msg) {
    var done = function () { toast(msg || "Скопировано"); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) { var t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e) {} t.remove(); }
  function waOpen(phone, text) {
    var ph = String(phone || "").replace(/\D/g, "");
    if (ph.length === 11 && ph[0] === "8") ph = "7" + ph.slice(1);
    window.open("https://wa.me/" + ph + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  }
  function download(name, text, type) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "application/json" })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function num(s) { var n = parseFloat(String(s == null ? "" : s).replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; }
  function vn(t) { return String(t || "").toLowerCase().replace(/ё/g, "е").replace(/[.,!?;:"«»()]/g, " ").replace(/\s+/g, " ").trim(); }

  // ======================= голос: диктовка в поле =======================
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, DICT = null;
  function dictStop() { if (DICT) { DICT.want = false; try { DICT.rec.stop(); } catch (e) {} } }
  // btn - кнопка микрофона, cb.final(text) - фраза распознана, cb.live(text) - пока говорит
  function dictate(btn, cb) {
    if (!SR) { toast("Этот браузер не распознаёт речь - нажмите микрофон на клавиатуре телефона"); return; }
    if (DICT && DICT.btn === btn) { dictStop(); return; }
    dictStop();
    var st = { btn: btn, want: true };
    var spawn = function () {
      var r = new SR(); st.rec = r; r.lang = "ru-RU"; r.interimResults = true; r.continuous = !/android/i.test(navigator.userAgent);
      r.onresult = function (ev) {
        var live = "";
        for (var i = ev.resultIndex; i < ev.results.length; i++) { var x = ev.results[i]; if (x.isFinal) cb.final(x[0].transcript.trim()); else live += x[0].transcript; }
        if (cb.live) cb.live(live);
      };
      r.onerror = function (e) { if (/not-allowed|service-not-allowed|audio-capture/.test(e.error)) { st.want = false; toast("Нет доступа к микрофону - разрешите его для сайта или пишите текстом"); } else if (e.error === "network") { st.want = false; toast("Для распознавания речи нужен интернет"); } };
      r.onend = function () { if (st.want && DICT === st) { try { spawn(); } catch (e) { off(); } } else off(); };
      try { r.start(); } catch (e) { off(); }
    };
    var off = function () { if (DICT === st) DICT = null; btn.classList.remove("on"); if (cb.live) cb.live(""); if (cb.end) cb.end(); };
    DICT = st; btn.classList.add("on"); spawn();
  }
  function micBtn(id, label) { return '<button type="button" class="btn mic' + (label ? "" : " sm") + '" id="' + id + '" title="Сказать голосом">' + svg(IC.mic) + (label ? "<span>" + label + "</span>" : "") + "</button>"; }

  // ======================= разбор фраз =======================
  // размеры из описания: "ширина 1800", "высота 2400 мм", "1800 на 2400 на 600"
  function sizesFromText(t) {
    t = vn(t); var out = [], m;
    var re = /(ширин\w*|высот\w*|глубин\w*|выступ\w*|длин\w*|ниш\w*)\s*(?:на\s*)?(\d{2,4})/g;
    while ((m = re.exec(t))) {
      var l = { шир: "Ширина", выс: "Высота", глу: "Глубина", выс2: "", вст: "", выт: "", дли: "Длина", ниш: "Ниша" }[m[1].slice(0, 3)] || (/^выступ/.test(m[1]) ? "Выступ" : m[1]);
      out.push({ l: l, v: m[2] });
    }
    if (!out.length && (m = t.match(/(\d{3,4})\s*(?:на|x|х|\*)\s*(\d{3,4})(?:\s*(?:на|x|х|\*)\s*(\d{2,4}))?/))) {
      out.push({ l: "Ширина", v: m[1] }, { l: "Высота", v: m[2] }); if (m[3]) out.push({ l: "Глубина", v: m[3] });
    }
    return out;
  }
  var WNUM = { "одна": 1, "один": 1, "две": 2, "два": 2, "три": 3, "четыре": 4, "пять": 5, "шесть": 6, "семь": 7, "восемь": 8, "девять": 9, "десять": 10, "пятнадцать": 15, "двадцать": 20, "тридцать": 30, "сорок": 40, "пятьдесят": 50, "сто": 100 };
  // сумма правки из фразы: "плюс 5 тысяч", "дешевле на 3000", "+15000 тг". Числа без денежных слов (мм) не берём.
  function parseChange(text) {
    var t = String(text || "").replace(/(одна|один|две|два|три|четыре|пять|шесть|семь|восемь|девять|десять|пятнадцать|двадцать|тридцать|сорок|пятьдесят|сто)\s+(тысяч\w*|тыс)/gi, function (m, a, b) { return WNUM[a.toLowerCase()] + " " + b; });
    var re = /(плюс|минус|дороже\s+на|дешевле\s+на|скидк\w*|доплат\w*|(?:^|\s)[+\-−])?\s*(\d[\d  ]*(?:[.,]\d+)?)\s*(тысяч\w*|тыс\.?|т\.р\.?|к(?![а-яё]))?\s*(тенге|тг\.?|₸|рубл\w*|руб\.?|р\.|₽)?/gi;
    var m, best = null;
    while ((m = re.exec(t))) {
      if (!m[2]) continue;
      var pre = (m[1] || "").trim().toLowerCase(), th = m[3], curw = m[4];
      if (!pre && !th && !curw) continue;
      var v = num(m[2]) * (th ? 1000 : 1);
      var sign = /минус|дешевле|скидк|^[\-−]$/.test(pre) ? -1 : 1;
      best = { d: sign * Math.round(v), at: m.index, len: m[0].length };
    }
    if (!best) return { text: String(text || "").trim(), d: null };
    var rest = (t.slice(0, best.at) + " " + t.slice(best.at + best.len)).replace(/\s+([,.])/g, "$1").replace(/\s+/g, " ").replace(/[,\s]+$/, "").trim();
    return { text: rest, d: best.d };
  }
  // ответ на вопрос голосом: какие варианты названы
  function stem(w) { return w.length > 5 ? w.slice(0, w.length > 7 ? 5 : 4) : w; }
  function matchOpts(text, opts) {
    var words = vn(text).split(" ");
    var hasW = function (tok) { var s = stem(tok); return words.some(function (w) { return tok.length <= 3 ? w === tok : w.indexOf(s) === 0; }); };
    return (opts || []).map(function (o) {
      var toks = vn(o).split(" ").filter(function (w) { return w.length >= 2 && !/^(на|по|в|с|и|из|от|до|за|для)$/.test(w); });
      if (!toks.length) return { o: o, s: 0 };
      var hit = toks.filter(hasW).length;
      return { o: o, s: hit / toks.length + (hit ? 0.01 * hit : 0) };
    }).filter(function (x) { return x.s >= 0.5; }).sort(function (a, b) { return b.s - a.s; });
  }

  // ======================= маршрут =======================
  var VIEWS = ["glavnoe", "izdelie", "voprosy", "pravki", "ceh"], view = "glavnoe";
  function route() {
    var h = (location.hash || "").replace("#", "");
    var was = view;
    view = VIEWS.indexOf(h) >= 0 ? h : "glavnoe";
    if (was !== view) window.scrollTo(0, 0);
    document.body.className = "v-" + (view === "glavnoe" ? "home" : view);
    VIEWS.forEach(function (v) { $("v-" + v).classList.toggle("on", v === view); });
    [].forEach.call(document.querySelectorAll("#nav a"), function (a) { a.classList.toggle("on", a.dataset.v === view); });
    render();
  }
  function go(v) { if (location.hash === "#" + v) route(); else location.hash = v; window.scrollTo(0, 0); }
  function render() {
    dictStop();
    ctx(); navBadges();
    if (view === "glavnoe") rHome();
    else if (view === "izdelie") rItem();
    else if (view === "voprosy") rQ();
    else if (view === "pravki") rCh();
    else if (view === "ceh") rTz();
  }
  function ctx() {
    var p = proj(), el = $("ctx");
    if (view === "glavnoe" || !p) { el.classList.add("hide"); return; }
    var t = totals(p);
    el.innerHTML = "<span>Заказ:</span><b>" + esc(projTitle(p)) + "</b>" + '<span class="tag gray" style="background:rgba(255,255,255,.12);color:#fff">' + esc(statusName(p.status)) + "</span>" +
      (t.total ? '<span class="sum">' + esc(money(t.total)) + "</span>" : "") + '<button type="button" data-go="glavnoe">Другой заказ</button>';
    el.classList.remove("hide");
  }
  function navBadges() {
    var p = proj(), t = p ? totals(p) : null, att = 0;
    if (p) p.items.forEach(function (i) { att += warnings(i).length; });
    $("navCh").textContent = t ? t.nWait : ""; $("navCh").classList.toggle("hide", !(t && t.nWait));
    $("navAtt").textContent = att; $("navAtt").classList.toggle("hide", !att);
  }
  function noProject(where) {
    return '<section><div class="card empty"><b>Сначала выберите или начните заказ</b><p>' + esc(where) + "</p>" +
      '<div class="btns" style="justify-content:center"><button class="btn p" type="button" data-a="new">' + svg(IC.plus) + 'Новый заказ</button><button class="btn" type="button" data-a="demo">Показать на примере</button></div></div></section>';
  }
  function itemChips(p, addBtn) {
    if (p.items.length < 2 && !addBtn) return "";
    var it = item(p);
    return '<div class="items" role="tablist">' + p.items.map(function (i) {
      return '<button type="button" class="chip' + (i.id === it.id ? " on" : "") + '" data-item="' + i.id + '">' + esc(i.name || typeOf(i.type).n) + (i.qty > 1 ? " x" + i.qty : "") + "</button>";
    }).join("") + (addBtn ? '<button type="button" class="chip add" data-a="addItem">+ Изделие</button>' : "") + "</div>";
  }

  // ======================= ГЛАВНОЕ =======================
  var REQ = [
    { said: "90% мебельщиков нужна простота. Сложная программа - для крупных контор.", ans: "Блокнот - одна страница: описание, фото, вопросы, правки, ТЗ. Без деталировки, бухгалтерии и документов.", st: "Сделано", go: "izdelie" },
    { said: "Рисую эскиз от руки, фотографирую комнату, ИИ делает фото-рендер. Всё утверждаем на эскизе.", ans: "Фото эскиза, комнаты и рендера лежат в заказе. На эскизе ставите номера-пометки. Готовый запрос для ИИ-рендера собирается из ваших ответов - копируете в ChatGPT или Gemini вместе с фото.", st: "Сделано", go: "izdelie" },
    { said: "Клиент всё время меняет заказ. В WhatsApp-памятке поправить просто, в программе долго.", ans: "Правка - одна строка голосом: \"клиент хочет ящик длиннее, плюс 5 тысяч\". Дата, статус и как менялась цена видны сразу, памятка клиенту уходит в WhatsApp одной кнопкой.", st: "Сделано", go: "pravki" },
    { said: "Почти никто не умеет рисовать. Выручает голосовое описание и Pinterest для идей.", ans: "Описание голосом в каждом изделии, кнопка \"Идеи на Pinterest\" по типу изделия и вашим ответам. Примерка готовой мебели на фото - в конфигураторе сайта.", st: "Сделано", go: "izdelie" },
    { said: "Каждая вещь нестандартная: щиты на батарею, выступы, арт-объекты, кривые зеркала, изголовья. Трёх размеров мало.", ans: "Изделие - не набор фабричных модулей. Сколько угодно замеров со своими названиями (кривая стена - несколько замеров), а любые части и нюансы - строкой или голосом: \"выступ 50 мм слева, внимание, плюс 8 тысяч\". У каждого - размер, цена и пометка для цеха. 11 типов изделий и \"Другое\".", st: "Сделано", go: "izdelie" },
    { said: "Нюансы: декоративный бок без сверлений, отступ под дефлектор сушилки, подсветка со вторым дном и трансформатором, присадка под фурнитуру, ножки.", ans: "Вопросы под каждое изделие спрашивают именно это. Ответ сам становится пометкой \"Внимание\" в ТЗ - например, \"Петли на декоративный бок не сверлить\".", st: "Сделано", go: "voprosy" },
    { said: "На фрезеровке фасады сделали не так - полоска (выборка) не передалась.", ans: "Вопрос про фрезеровку просит образец и размеры выборки, в ТЗ это крупно в \"Внимание\" вместе с фото эскиза и пометками.", st: "Сделано", go: "ceh" },
    { said: "Простое считается легко, а 3D с разной фурнитурой, толщинами и фактурой - нет.", ans: "Не делаем вид, что посчитаем всё: здесь примерная смета строками по вашим ценам. Если нужен точный расчёт шкафа или кухни - одна кнопка передаст заказ в калькулятор.", st: "Честно", go: "izdelie" },
    { said: "Бухгалтерией и документами заниматься не хочу - будет только больше путаницы.", ans: "Их здесь нет. Если когда-нибудь понадобится КП или договор - заказ передаётся в основной конструктор, там это уже есть.", st: "Не навязываем", go: "ceh" }
  ];
  function rHome() {
    var name = DB.set.name ? ", " + DB.set.name : "", h = new Date().getHours();
    $("hello").textContent = (h >= 5 && h < 12 ? "Доброе утро" : h >= 12 && h < 18 ? "Добрый день" : h >= 18 && h < 23 ? "Добрый вечер" : "Доброй ночи") + name + "!";
    var list = DB.projects.slice().sort(function (a, b) { return a.updated < b.updated ? 1 : -1; });
    var hp = "";
    if (!list.length) {
      hp = '<div class="card empty"><b>Заказов пока нет</b><p>Начните новый - опишите изделие голосом. Или посмотрите, как это выглядит, на примере спальни с кроватью и тумбами.</p>' +
        '<div class="btns" style="justify-content:center"><button class="btn p" type="button" data-a="new">' + svg(IC.plus) + 'Новый заказ</button><button class="btn" type="button" data-a="demo">Показать на примере</button></div></div>';
    } else {
      hp = '<div class="plist">' + list.map(function (p) {
        var t = totals(p), att = 0; p.items.forEach(function (i) { att += warnings(i).length; });
        var meta = [statusName(p.status), p.items.length + " " + (MO ? MO.plural(p.items.length, ["изделие", "изделия", "изделий"]) : "изд."), t.nWait ? t.nWait + " правки ждут ответа" : "", att ? "внимание: " + att : ""].filter(Boolean).join(" · ");
        return '<button type="button" class="pi' + (p.id === DB.cur ? " cur" : "") + '" data-open="' + p.id + '"><span class="ic">' + esc((p.client || "?").charAt(0).toUpperCase()) + '</span><span class="x"><b>' + esc(projTitle(p)) + "</b><span>" + esc(meta) + '</span></span><span class="r">' + (t.total ? "<b>" + esc(money(t.total, p.cur)) + "</b>" : "") + esc(dshort(p.updated)) + "</span></button>";
      }).join("") + '</div><div class="btns"><button class="btn p" type="button" data-a="new">' + svg(IC.plus) + "Новый заказ</button>" + (DB.projects.some(function (p) { return p.demo; }) ? "" : '<button class="btn" type="button" data-a="demo">Показать на примере</button>') + "</div>";
    }
    $("plist").innerHTML = hp;
    $("req").innerHTML = REQ.map(function (r) {
      return '<div class="rq"><div class="said">"' + esc(r.said) + '"</div><div class="ans">' + esc(r.ans) + '</div><div class="ft"><span class="tag ' + (r.st === "Сделано" ? "ok" : "gray") + '">' + esc(r.st) + '</span><a href="#' + r.go + '" data-go="' + r.go + '">Посмотреть →</a></div></div>';
    }).join("");
    $("setName").value = DB.set.name || "";
    $("setCeh").value = DB.set.ceh || "";
    if (MO) {
      var c = DB.set.cur || MO.region().currency;
      $("setCur").innerHTML = Object.keys(MO.CURRENCIES).map(function (k) { var x = MO.CURRENCIES[k]; return '<option value="' + k + '"' + (k === c ? " selected" : "") + ">" + esc(x.name) + ", " + esc(x.sign) + "</option>"; }).join("");
    }
  }

  // ======================= ИЗДЕЛИЕ =======================
  function rItem() {
    var p = proj(), el = $("v-izdelie");
    if (!p) { el.innerHTML = noProject("Изделие всегда внутри заказа: клиент, его изделия, фото и правки."); return; }
    var it = item(p);
    var h = '<section><div class="sh"><h2>Заказ</h2></div><div class="card">' +
      '<div class="g3"><label class="f">Клиент <input class="t" data-pf="client" value="' + esc(p.client) + '" placeholder="Имя клиента"></label>' +
      '<label class="f">Телефон (WhatsApp) <input class="t" data-pf="phone" value="' + esc(p.phone) + '" placeholder="+7 ..." inputmode="tel"></label>' +
      '<label class="f">Адрес <input class="t" data-pf="addr" value="' + esc(p.addr) + '" placeholder="Улица, дом, квартира"></label></div>' +
      '<div class="chips" style="margin-top:12px">' + STATUS.map(function (s) { return '<button type="button" class="chip' + (p.status === s[0] ? " on" : "") + '" data-status="' + s[0] + '">' + s[1] + "</button>"; }).join("") + "</div></div></section>";
    h += '<section><div class="sh"><h2>Изделия</h2><p>Каждая вещь - отдельно: свои размеры, вопросы и фото.</p></div>' + itemChips(p, true) + "</section>";
    if (!it) { el.innerHTML = h; return; }
    var fd = fromDesc(it).map(function (id) { for (var i = 0, a = allQ(it); i < a.length; i++) if (a[i].id === id) return a[i].s; return ""; }).filter(Boolean);
    // что делаем
    h += '<section class="blk"><div class="card"><h3>Что делаем</h3><div class="chips" id="types">' + Q.TYPES.map(function (t) { return '<button type="button" class="chip' + (it.type === t.id ? " on" : "") + '" data-type="' + t.id + '">' + esc(t.n) + "</button>"; }).join("") + "</div>" +
      '<div class="g2" style="margin-top:12px;grid-template-columns:minmax(0,3fr) minmax(0,1fr)"><label class="f">Название <input class="t" data-if="name" value="' + esc(it.name) + '"></label><label class="f">Сколько штук <input class="t" data-if="qty" type="number" min="1" inputmode="numeric" value="' + esc(it.qty) + '"></label></div>' +
      '<label class="f" style="margin-top:12px">Описание - как рассказали бы клиенту или в голосовом <textarea class="t" id="desc" data-if="desc" rows="4" placeholder="Например: кровать 180 на 200, мягкое изголовье до потолка с подсветкой, тайник в изголовье, ящики снизу, один длиннее">' + esc(it.desc) + "</textarea></label>" +
      '<div class="btns" style="margin-top:8px">' + micBtn("descMic", "Сказать") + '<button type="button" class="btn" data-a="parseDesc">Найти размеры в описании</button></div>' +
      '<div class="muted" id="descLive" style="font-size:13px;margin-top:6px"></div>' +
      (fd.length ? '<div class="hl">Из описания: <b>' + esc(fd.join(", ")) + '</b> - эти вопросы будут первыми. <a href="#voprosy" data-go="voprosy">К вопросам →</a></div>' : "") + "</div></section>";
    // части и нюансы
    var P = it.parts || (it.parts = []);
    h += '<section class="blk"><div class="card"><h3>Части и нюансы</h3><p class="muted" style="font-size:13.5px;margin:0 0 10px">Всё нестандартное - отдельной строкой: выступ, ящик длиннее, панель за стену, тайник. Скажите одной фразой: "выступ 50 мм слева, внимание, плюс 8 тысяч". "!" - пометка "Внимание" для цеха, цена идёт в смету.</p>' +
      (P.length ? '<div class="parthd"><span>Что</span><span>Размер</span><span>Как, где, зачем</span><span>Шт</span><span>Цена</span><span></span></div><div class="parts">' + P.map(function (x, i) {
        return '<div class="part' + (x.w ? " w" : "") + '"><input class="pn" data-part="' + i + '" data-k="n" value="' + esc(x.n) + '" placeholder="Что"><input class="ps" data-part="' + i + '" data-k="sz" value="' + esc(x.sz) + '" placeholder="Размер, мм"><input class="pt" data-part="' + i + '" data-k="t" value="' + esc(x.t) + '" placeholder="Как, где, зачем"><label class="pq"><span>шт</span><input data-part="' + i + '" data-k="q" value="' + esc(x.q || 1) + '" inputmode="numeric" title="Сколько штук"></label><input class="pp" data-part="' + i + '" data-k="p" value="' + esc(x.p) + '" inputmode="decimal" placeholder="Цена"><span class="ac"><button type="button" class="' + (x.w ? "on" : "") + '" data-partw="' + i + '" title="Внимание для цеха">!</button><button type="button" class="x" data-delpart="' + i + '" aria-label="Убрать">×</button></span></div>';
      }).join("") + "</div>" : "") +
      '<div class="btns" style="margin-top:' + (P.length ? 10 : 0) + 'px">' + micBtn("partMic", "Нюанс голосом") + '<input class="t" id="partText" style="flex:1 1 200px;width:auto" placeholder="Или напишите: ящик левый длиннее на 100, внимание"><button type="button" class="btn" data-a="addPart">Добавить</button></div><div class="muted" id="partLive" style="font-size:13px;margin-top:4px"></div>' +
      '<div class="chips" style="margin-top:8px">' + PART_KINDS.map(function (k) { return '<button type="button" class="chip add" data-addpart="' + esc(k) + '">+ ' + esc(k) + "</button>"; }).join("") + "</div></div></section>";
    // размеры
    h += '<section class="blk"><div class="card"><h3>Размеры и замеры, мм</h3><p class="muted" style="font-size:13.5px;margin:0 0 10px">Сколько угодно размеров со своими названиями. Стена кривая - впишите несколько замеров: "1800 / 1795 / 1790".</p><div class="sizes">' + it.sizes.map(function (s, i) {
      return '<div class="sz"><input class="t" data-size="' + i + '" data-k="l" value="' + esc(s.l) + '" placeholder="Что меряем"><input class="t" data-size="' + i + '" data-k="v" value="' + esc(s.v) + '" placeholder="мм" inputmode="decimal"><button type="button" class="x" data-delsize="' + i + '" aria-label="Убрать размер">×</button></div>';
    }).join("") + '</div><div class="chips" style="margin-top:10px">' + SIZE_LABELS.map(function (l) { return '<button type="button" class="chip add" data-addsize="' + esc(l) + '">+ ' + esc(l) + "</button>"; }).join("") + '<button type="button" class="chip add" data-addsize3="1">+ 3 замера (низ, середина, верх)</button><button type="button" class="chip add" data-addsize="">+ свой</button></div></div></section>';
    // фото
    h += '<section class="blk"><div class="card"><h3>Эскиз и фото</h3><p class="muted" style="font-size:13.5px;margin:0 0 10px">Нажмите на фото, чтобы поставить пометки для цеха: "здесь выборка", "тайник", "блок питания".</p>' +
      '<div class="photos">' + (it.photos || []).map(function (f, i) {
        return '<button type="button" class="ph" data-photo="' + i + '"><img data-ph="' + f.id + '" alt="' + esc(f.kind) + '"><span class="k">' + esc(f.kind) + "</span>" + (f.marks && f.marks.length ? '<span class="n">' + f.marks.length + "</span>" : "") + "</button>";
      }).join("") + KINDS.map(function (k) { return '<button type="button" class="ph addp" data-addphoto="' + esc(k) + '">' + svg(IC.cam, 22) + "+ " + esc(k) + "</button>"; }).join("") + "</div></div></section>";
    // рендер
    var t = typeOf(it.type);
    h += '<section class="blk"><div class="card"><h3>Рендер в комнате и идеи</h3><p class="muted" style="font-size:13.5px;margin:0 0 10px">Запрос собран из описания, размеров и ответов на вопросы. Скопируйте, откройте ИИ, приложите фото комнаты и эскиза - и вставьте.</p>' +
      '<div class="ai" id="aiText">' + esc(aiPrompt(it)) + "</div>" +
      '<div class="btns"><button type="button" class="btn p" data-a="copyAi">' + svg(IC.copy) + 'Скопировать запрос</button><a class="btn" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a><a class="btn" href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a></div>' +
      '<div class="g2" style="margin-top:12px;grid-template-columns:minmax(0,1fr) auto;align-items:end"><label class="f">Идеи для клиента на Pinterest <input class="t" id="pinQ" value="' + esc(pinQuery(it)) + '"></label><button type="button" class="btn" data-a="pin">Открыть Pinterest</button></div></div></section>';
    // смета
    h += '<section class="blk"><div class="card"><h3>Примерная смета' + (it.qty > 1 ? " на 1 шт" : "") + '</h3><div class="est">' + (it.est || []).map(function (l, i) {
      return '<div class="er"><input class="en" data-est="' + i + '" data-k="n" value="' + esc(l.n) + '" placeholder="Что"><label class="eq"><input data-est="' + i + '" data-k="q" value="' + esc(l.q) + '" inputmode="decimal" title="Количество"><span>' + esc(l.u || "шт") + '</span></label><input class="ep" data-est="' + i + '" data-k="p" value="' + esc(l.p) + '" inputmode="decimal" placeholder="Цена за ' + esc(l.u || "шт") + '"><b class="sm">' + esc(money((+l.q || 0) * (+l.p || 0))) + '</b><button type="button" class="ed" data-delest="' + i + '" aria-label="Убрать строку">×</button></div>';
    }).join("") + "</div>" +
      '<div class="chips" style="margin-top:10px">' + PRESETS.map(function (pr) { return '<button type="button" class="chip add" data-addest="' + esc(pr[0]) + '" data-u="' + esc(pr[1]) + '">+ ' + esc(pr[0]) + "</button>"; }).join("") + '<button type="button" class="chip add" data-addest="" data-u="шт">+ своя строка</button></div>' +
      '<div class="tot"><span class="muted">Цены ваши: блокнот запоминает последнюю цену каждой строки.' + (partsSum(it) ? " Нюансы с ценой: " + esc(money(partsSum(it))) + "." : "") + '</span><span>Итого' + (it.qty > 1 ? " за " + it.qty + " шт" : "") + ': <b id="estTot">' + esc(money(estSum(it))) + "</b></span></div></div></section>";
    h += '<div class="btns noprint" style="margin-top:16px"><a class="btn p" href="#voprosy" data-go="voprosy">Дальше: вопросы по изделию →</a><button type="button" class="btn l" data-a="dupItem">Копия изделия</button><button type="button" class="btn l" data-a="delItem" id="delItem">Удалить изделие</button><button type="button" class="btn l" data-a="delProj" id="delProj">Удалить заказ</button></div>';
    el.innerHTML = h;
    fillPhotos(el);
    $("partMic").onclick = function () {
      dictate(this, { final: function (t) { it.parts.push(partFromText(t)); save(); rItem(); toast("Нюанс добавлен - проверьте"); }, live: function (t) { var l = $("partLive"); if (l) l.textContent = t ? "Слышу: " + t : ""; } });
    };
    $("partText").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); document.querySelector('[data-a="addPart"]').click(); } };
    $("descMic").onclick = function () {
      var ta = $("desc"), base = ta.value;
      dictate(this, {
        final: function (t) { base = (base ? base.replace(/\s+$/, "") + (/[.!?]$/.test(base.trim()) ? " " : ". ") : "") + t; ta.value = base; it.desc = base; save(); },
        live: function (t) { $("descLive").textContent = t ? "Слышу: " + t : ""; },
        end: function () { autoSizes(it, true); rItem(); }
      });
    };
  }
  function autoSizes(it, quiet) {
    var found = sizesFromText(it.desc), n = 0;
    found.forEach(function (f) {
      var ex = it.sizes.filter(function (s) { return s.l.toLowerCase() === f.l.toLowerCase(); })[0];
      if (ex && !String(ex.v).trim()) { ex.v = f.v; n++; } else if (!ex) { it.sizes.push(f); n++; }
    });
    if (n) save();
    if (!quiet || n) toast(n ? "Нашёл размеров: " + n + " - проверьте" : "Размеров в описании не нашёл. Скажите, например: \"ширина 1800, высота 2400\"");
  }
  function aiPrompt(it) {
    var t = typeOf(it.type), A = it.ans, parts = [];
    var sz = (it.sizes || []).filter(function (s) { return String(s.v).trim(); }).map(function (s) { return s.l.toLowerCase() + " " + s.v + " мм"; });
    var pick = function (id, label) { var v = A[id]; if (v && v !== NA && !(Array.isArray(v) && (!v.length || (v.length === 1 && v[0] === "Нет")))) parts.push(label + ": " + Q.txt(v).toLowerCase()); };
    pick("k_mat", "корпус"); pick("f_type", "фасады"); pick("f_frez", "фрезеровка"); pick("f_steklo", "стекло витрин"); pick("f_ruchki", "ручки"); pick("l_type", "подсветка"); pick("l_cvet", "свет"); pick("kr_izgol", "изголовье"); pick("kr_osn", "основание кровати"); pick("ku_stol", "столешница"); pick("ku_fartuk", "фартук"); pick("z_forma", "зеркало"); pick("z_svet", "подсветка зеркала"); pick("p_vid", "панели"); pick("sh_resh", "решётка"); pick("n_type", "низ");
    if (it.notes && it.notes.k_mat) parts.push("цвет и декор: " + it.notes.k_mat);
    if (it.notes && it.notes.f_type) parts.push("цвет фасадов: " + it.notes.f_type);
    var L = [];
    L.push("Сделай фотореалистичную визуализацию интерьера.");
    L.push("Фото 1 - комната клиента. Фото 2 - эскиз мебели от руки.");
    L.push("Поставь в комнату с фото 1 " + t.ai + (it.name && it.name !== t.n ? " (" + it.name + ")" : "") + " точно по эскизу с фото 2: те же пропорции, количество дверей, ящиков, полок и ниш.");
    if (sz.length) L.push("Размеры: " + sz.join(", ") + ".");
    if (it.desc) L.push("Описание: " + it.desc.trim());
    if ((it.parts || []).length) L.push("Особенности: " + it.parts.map(partLine).join("; ") + ".");
    if (parts.length) L.push("Материалы и детали: " + parts.join("; ") + ".");
    L.push("Комнату не меняй: стены, пол, окна, потолок, свет и ракурс камеры остаются как на фото 1. Мебель в реальном масштабе, с естественными тенями и отражениями. Без людей и надписей.");
    return L.join("\n");
  }
  function pinQuery(it) {
    var t = typeOf(it.type), A = it.ans, w = [t.pin];
    if (Q.has(A.f_type, "Рейка (фрезеровка)") || A.f_frez === "Рейка") w.push("рейка");
    if (A.l_type && !Q.no(A.l_type) && A.l_type !== NA) w.push("подсветка");
    if (Q.has(A.kr_izgol, "Мягкое")) w.push("мягкое изголовье");
    if (Q.has(A.f_type, "Стекло в алюм. профиле")) w.push("витрина стекло");
    return w.join(" ").split(" ").filter(function (x, i, a) { return a.indexOf(x) === i; }).join(" ");
  }

  // ======================= ВОПРОСЫ =======================
  var qcur = null; // id вопроса, открытого в режиме "по одному"
  function rQ() {
    var p = proj(), el = $("v-voprosy");
    if (!p) { el.innerHTML = noProject("Вопросы подбираются под конкретное изделие заказа."); return; }
    var it = item(p);
    if (!it) { el.innerHTML = noProject("В заказе нет изделий."); return; }
    var L = visibleQ(it), done = L.filter(function (q) { return answered(it, q); }).length, W = warnings(it), mode = DB.ui.qmode || "one", fd = fromDesc(it);
    var h = '<section><div class="sh"><h2>Вопросы: ' + esc(it.name || typeOf(it.type).n) + "</h2><p>Под " + esc(typeOf(it.type).n.toLowerCase()) + ": " + L.length + " " + (MO ? MO.plural(L.length, ["вопрос", "вопроса", "вопросов"]) : "") + ". Отвечайте нажатием или голосом, лишнее пропускайте.</p></div>" + itemChips(p) +
      '<div class="card" style="margin-top:8px"><div class="prog"><span>Отвечено <b>' + done + "</b> из " + L.length + '</span><span class="bar"><i style="width:' + (L.length ? Math.round(done / L.length * 100) : 0) + '%"></i></span>' + (W.length ? '<a href="#ceh" data-go="ceh" class="tag bad" style="text-decoration:none">Внимание для цеха: ' + W.length + "</a>" : "") + "</div>" +
      '<div class="chips" style="margin-top:10px"><button type="button" class="chip' + (mode === "one" ? " on" : "") + '" data-qmode="one">По одному</button><button type="button" class="chip' + (mode === "list" ? " on" : "") + '" data-qmode="list">Списком</button></div></div>';
    if (mode === "one") {
      var idx = -1;
      for (var i = 0; i < L.length; i++) if (L[i].id === qcur) idx = i;
      if (idx < 0) { for (i = 0; i < L.length; i++) if (!answered(it, L[i])) { idx = i; break; } }
      if (idx < 0 && qcur !== "__end") idx = L.length; // все отвечены
      if (qcur === "__end") idx = L.length;
      if (idx >= L.length) {
        h += '<div class="card qc empty"><b>Вопросы пройдены</b><p>' + (W.length ? "Для цеха собралось пометок \"Внимание\": " + W.length + ". Проверьте ТЗ." : "Пометок для цеха нет.") + '</p><div class="btns" style="justify-content:center"><a class="btn p" href="#ceh" data-go="ceh">Открыть ТЗ для цеха</a><button type="button" class="btn" data-qgo="0">Пройти ещё раз</button><button type="button" class="btn" data-qmode="list">Списком</button></div></div>';
      } else {
        var q = L[idx]; qcur = q.id;
        h += qCard(it, q, idx, L.length, fd.indexOf(q.id) >= 0);
      }
    } else {
      h += '<div class="ql">' + Q.GROUPS.map(function (g) {
        var qs = L.filter(function (q) { return q.g === g; }); if (!qs.length) return "";
        var dn = qs.filter(function (q) { return answered(it, q); }).length;
        return "<details" + (dn < qs.length ? " open" : "") + "><summary>" + esc(g) + ' <span class="tag ' + (dn === qs.length ? "ok" : "gray") + '">' + dn + "/" + qs.length + "</span></summary>" + qs.map(function (q) { return qRow(it, q, fd.indexOf(q.id) >= 0); }).join("") + "</details>";
      }).join("") + "</div>";
    }
    h += '<div class="card" style="margin-top:12px"><h3>Свой вопрос</h3><p class="muted" style="font-size:13.5px;margin:0 0 8px">Чего не хватает? Вопрос запомнится для всех изделий типа "' + esc(typeOf(it.type).n) + '".</p><div class="g2" style="grid-template-columns:minmax(0,1fr) auto"><input class="t" id="cq" placeholder="Например: Цвет ткани изголовья?"><button type="button" class="btn" data-a="addCq">Добавить</button></div>' +
      ((DB.custom[it.type] || []).length ? '<div class="chips" style="margin-top:8px">' + DB.custom[it.type].map(function (c) { return '<button type="button" class="chip" data-delcq="' + c.id + '" title="Убрать вопрос">' + esc(c.t) + " ×</button>"; }).join("") + "</div>" : "") + "</div></section>";
    el.innerHTML = h;
    var m = $("qMic");
    if (m) m.onclick = function () { var q = qById(it, qcur); dictate(m, { final: function (t) { voiceAnswer(it, q, t); }, live: function (t) { var l = $("qLive"); if (l) l.textContent = t ? "Слышу: " + t : ""; } }); };
  }
  function qById(it, id) { var a = allQ(it); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function chipsFor(it, q, big) {
    var v = it.ans[q.id];
    return '<div class="chips">' + (q.o || []).map(function (o) {
      var on = q.m ? Q.has(v, o) : v === o;
      return '<button type="button" class="chip' + (on ? " on" : "") + '" data-ans="' + esc(q.id) + '" data-o="' + esc(o) + '">' + esc(o) + "</button>";
    }).join("") + '<button type="button" class="chip na' + (v === NA ? " on" : "") + '" data-ans="' + esc(q.id) + '" data-o="' + NA + '">Не нужно</button></div>';
  }
  function qCard(it, q, idx, n, fromD) {
    var v = it.ans[q.id], w = answered(it, q) && v !== NA && q.w ? q.w(v, it.ans) : null;
    var freeVal = q.o ? (it.notes[q.id] || "") : (typeof v === "string" && v !== NA ? v : "");
    return '<div class="card qc"><div class="grp">' + esc(q.g) + " · " + (idx + 1) + " из " + n + (fromD ? ' <span class="tag">из описания</span>' : "") + (q.custom ? ' <span class="tag gray">ваш вопрос</span>' : "") + "</div>" +
      "<h3>" + esc(q.t) + "</h3>" + (q.hint ? '<p class="hint">' + esc(q.hint) + "</p>" : '<p class="hint"></p>') +
      (q.o ? chipsFor(it, q, true) : "") +
      '<input class="t" style="margin-top:10px" data-free="' + esc(q.id) + '" value="' + esc(freeVal) + '" placeholder="' + esc(q.o ? (q.free || "Уточнение - попадёт в ТЗ") : q.free || "Ответ") + '">' +
      (w ? '<div class="w"><b>Внимание для цеха:</b> ' + esc(w) + "</div>" : "") +
      '<div class="qnav">' + micBtn("qMic", "Ответить голосом") + '<span class="sp"></span>' + (idx > 0 ? '<button type="button" class="btn" data-qstep="-1">Назад</button>' : "") + '<button type="button" class="btn ' + (answered(it, q) ? "p" : "") + '" data-qstep="1">' + (answered(it, q) ? "Дальше" : "Пропустить") + "</button></div>" +
      '<div class="muted" id="qLive" style="font-size:13px;margin-top:6px"></div></div>';
  }
  function qRow(it, q, fromD) {
    var v = it.ans[q.id], w = answered(it, q) && v !== NA && q.w ? q.w(v, it.ans) : null;
    var freeVal = q.o ? (it.notes[q.id] || "") : (typeof v === "string" && v !== NA ? v : "");
    return '<div class="qr"><div class="qt">' + esc(q.t) + (fromD ? ' <span class="tag">из описания</span>' : "") + "</div>" + (q.o ? chipsFor(it, q) : "") +
      '<input class="t" data-free="' + esc(q.id) + '" value="' + esc(freeVal) + '" placeholder="' + esc(q.o ? "Уточнение" : q.free || "Ответ") + '">' + (w ? '<div class="w">Внимание: ' + esc(w) + "</div>" : "") + "</div>";
  }
  function setAns(it, q, o) {
    if (o === NA) it.ans[q.id] = it.ans[q.id] === NA ? undefined : NA;
    else if (q.m) {
      var a = Array.isArray(it.ans[q.id]) ? it.ans[q.id].slice() : [];
      var i = a.indexOf(o);
      if (i >= 0) a.splice(i, 1); else {
        if (o === "Нет" || o === "Ничего" || o === "Не нужно") a = []; else a = a.filter(function (x) { return x !== "Нет" && x !== "Ничего" && x !== "Не нужно"; });
        a.push(o);
      }
      it.ans[q.id] = a.length ? a : undefined;
    } else it.ans[q.id] = it.ans[q.id] === o ? undefined : o;
    if (it.ans[q.id] === undefined) delete it.ans[q.id];
    save();
  }
  function qStep(it, d) {
    var L = visibleQ(it), i = 0;
    for (var k = 0; k < L.length; k++) if (L[k].id === qcur) i = k;
    var j = i + d;
    qcur = j >= L.length ? "__end" : L[Math.max(0, j)].id;
    rQ();
  }
  function voiceAnswer(it, q, text) {
    if (!q) return;
    var t = vn(text);
    if (/^(дальше|следующ|пропус|далее)/.test(t)) { qStep(it, 1); return; }
    if (/^(назад|предыдущ)/.test(t)) { qStep(it, -1); return; }
    if (/^(не нужно|не надо|нет такого|не относится)$/.test(t)) { setAns(it, q, NA); qStep(it, 1); return; }
    var hits = q.o ? matchOpts(text, q.o) : [];
    if (hits.length) {
      if (q.m) { var a = []; hits.forEach(function (h) { a.push(h.o); }); it.ans[q.id] = a; save(); toast("Отмечено: " + a.join(", ")); rQ(); }
      else { it.ans[q.id] = hits[0].o; save(); toast("Ответ: " + hits[0].o); setTimeout(function () { qStep(it, 1); }, 600); rQ(); }
      return;
    }
    if (q.o) { it.notes[q.id] = (it.notes[q.id] ? it.notes[q.id] + "; " : "") + text; toast("Записал как уточнение"); }
    else { it.ans[q.id] = text; toast("Записал ответ"); }
    save(); rQ();
  }

  // ======================= ПРАВКИ =======================
  var chDraft = { text: "", d: "", item: "", st: "ok", auto: true };
  function rCh() {
    var p = proj(), el = $("v-pravki");
    if (!p) { el.innerHTML = noProject("Правки записываются в заказ: что поменял клиент и как изменилась цена."); return; }
    var t = totals(p), c = p.cur;
    var h = '<section><div class="sh"><h2>Правки клиента</h2><p>Клиент передумал - запишите одной строкой. Цена пересчитается, история останется.</p></div>' +
      '<div class="sumrow"><div><b>' + esc(money(t.base, c)) + '</b><span>смета</span></div><div><b>' + esc(signed(t.ok, c)) + '</b><span>согласованные правки</span></div><div class="main"><b>' + esc(money(t.total, c)) + '</b><span>итого сейчас</span></div><div><b>' + esc(t.nWait ? signed(t.wait, c) : "-") + "</b><span>ждут ответа" + (t.nWait ? " (" + t.nWait + ")" : "") + "</span></div></div>";
    // история цены
    var okList = p.changes.filter(function (x) { return x.st === "ok" && +x.d; }).sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    if (okList.length) {
      var run = t.base;
      h += '<div class="hist"><i>Как менялась цена:</i><span>смета ' + esc(money(run, c)) + "</span>" + okList.map(function (x) { run += +x.d; return "<i>→</i><span>" + esc(dshort(x.at)) + " " + esc(signed(+x.d, c)) + " = " + esc(money(run, c)) + "</span>"; }).join("") + "</div>";
    }
    // форма
    h += '<div class="card" style="margin-top:12px"><h3>Новая правка</h3><div class="chform">' +
      '<textarea class="t" id="chText" rows="2" placeholder="Например: изголовье выше на 100 мм, плюс 15 тысяч">' + esc(chDraft.text) + "</textarea>" +
      '<div class="dl"><label class="f">К чему относится <select class="t" id="chItem"><option value="">Весь заказ</option>' + p.items.map(function (i) { return '<option value="' + i.id + '"' + ((chDraft.item || item(p) && item(p).id) === i.id ? " selected" : "") + ">" + esc(i.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="f">Цена изменится на <input class="t" id="chD" inputmode="text" placeholder="+5000 или -3000" value="' + esc(chDraft.d) + '"></label></div>' +
      '<div class="chips"><button type="button" class="chip' + (chDraft.st === "ok" ? " on" : "") + '" data-chst="ok">Клиент согласен</button><button type="button" class="chip' + (chDraft.st === "wait" ? " on" : "") + '" data-chst="wait">Ждём ответа</button></div>' +
      '<div class="btns" style="margin-top:0">' + micBtn("chMic", "Сказать") + '<button type="button" class="btn p" data-a="addCh">Записать правку</button></div><div class="muted" id="chLive" style="font-size:13px"></div></div></div>';
    // список
    var list = p.changes.slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    h += '<section class="blk"><div class="sh"><h2 style="font-size:18px">История правок</h2></div>' + (list.length ? '<ul class="chl">' + list.map(function (x) {
      var d = new Date(x.at), it = x.item ? itemById(p, x.item) : null, dv = +x.d || 0;
      return '<li class="' + (x.st === "no" ? "no" : "") + '"><div class="d"><b>' + d.getDate() + "</b><small>" + MON[d.getMonth()] + '</small></div><div><div class="tx">' + esc(x.text) + '</div><div class="meta">' + esc([it ? it.name : "весь заказ", d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })].join(" · ")) + "</div></div>" +
        '<div class="rt"><span class="dv ' + (dv > 0 ? "up" : dv < 0 ? "dn" : "") + '">' + (dv ? esc(signed(dv, c)) : "без доплаты") + '</span><span class="st3">' +
        [["ok", "Согласовано"], ["wait", "Ждём"], ["no", "Отказ"]].map(function (s) { return '<button type="button" class="' + s[0] + (x.st === s[0] ? " on" : "") + '" data-setst="' + x.id + '" data-st="' + s[0] + '">' + s[1] + "</button>"; }).join("") +
        '</span><button type="button" class="btn l sm" data-delch="' + x.id + '">Удалить</button></div></li>';
    }).join("") + "</ul>" : '<div class="card empty"><b>Правок пока нет</b><p>Когда клиент что-то поменяет - запишите здесь. Цех увидит согласованные правки в ТЗ.</p></div>') + "</section>";
    h += '<div class="btns"><button type="button" class="btn ok" data-a="waClient">' + svg(IC.wa) + 'Памятка клиенту в WhatsApp</button><button type="button" class="btn" data-a="copyClient">' + svg(IC.copy) + "Скопировать памятку</button></div>";
    el.innerHTML = h;
    var ta = $("chText");
    ta.oninput = function () { chDraft.text = ta.value; autoAmount(); };
    $("chD").oninput = function () { chDraft.d = this.value; chDraft.auto = !this.value; };
    $("chItem").onchange = function () { chDraft.item = this.value; };
    $("chMic").onclick = function () {
      var base = ta.value;
      dictate(this, { final: function (t) { base = (base ? base.trim() + ". " : "") + t; ta.value = base; chDraft.text = base; autoAmount(); }, live: function (t) { $("chLive").textContent = t ? "Слышу: " + t : ""; } });
    };
  }
  function autoAmount() {
    if (!chDraft.auto && chDraft.d) return;
    var r = parseChange(chDraft.text);
    if (r.d !== null) { chDraft.d = (r.d > 0 ? "+" : "") + r.d; chDraft.auto = true; var f = $("chD"); if (f) f.value = chDraft.d; }
  }
  function addChange(text, d, itemId, st) {
    var p = proj(); if (!p) return null;
    var c = { id: uid("c"), at: new Date().toISOString(), text: text, d: d || 0, item: itemId || "", st: st || "ok" };
    p.changes.push(c); save(); return c;
  }
  function clientMemo(p) {
    var t = totals(p), c = p.cur, L = [];
    L.push((p.client ? p.client + ", з" : "З") + "дравствуйте! Памятка по вашему заказу на " + dfull() + ":");
    p.items.forEach(function (it) {
      var sz = it.sizes.filter(function (s) { return String(s.v).trim(); }).map(function (s) { return s.l.toLowerCase() + " " + s.v; }).join(", ");
      L.push("");
      L.push("*" + (it.name || typeOf(it.type).n) + (it.qty > 1 ? " x" + it.qty : "") + "*" + (sz ? " - " + sz + " мм" : ""));
      if (it.desc) L.push(it.desc.trim());
    });
    var ch = p.changes.slice().sort(function (a, b) { return a.at < b.at ? -1 : 1; }).filter(function (x) { return x.st !== "no"; });
    if (ch.length) {
      L.push(""); L.push("*Изменения:*");
      ch.forEach(function (x, i) { L.push((i + 1) + ". " + dshort(x.at) + " - " + x.text + (+x.d ? ": " + signed(+x.d, c) : "") + (x.st === "wait" ? " (ждём вашего ответа)" : " (согласовано)")); });
    }
    if (t.total) { L.push(""); L.push("*Итого сейчас: " + money(t.total, c) + "*" + (t.nWait ? "\nЕсли согласуете ожидающие правки: " + money(t.total + t.wait, c) : "")); }
    L.push(""); L.push("Если что-то не так - напишите, поправлю.");
    return L.join("\n");
  }

  // ======================= ЦЕХ =======================
  function itemSpec(it) {
    var out = [];
    Q.GROUPS.forEach(function (g) {
      var rows = visibleQ(it).filter(function (q) { return q.g === g && answered(it, q) && it.ans[q.id] !== NA && q.id !== "g_render"; }).map(function (q) {
        return { s: q.s, v: val(it.ans[q.id]) + (q.o && it.notes[q.id] ? " (" + it.notes[q.id] + ")" : "") };
      });
      // уточнения без выбранного варианта
      visibleQ(it).forEach(function (q) { if (q.g === g && q.o && !answered(it, q) && it.notes[q.id]) rows.push({ s: q.s, v: it.notes[q.id] }); });
      if (rows.length) out.push({ g: g, rows: rows });
    });
    return out;
  }
  function pinsHTML(f) {
    return (f.marks || []).map(function (m, i) { return '<span class="pin" style="left:' + m.x + "%;top:" + m.y + '%">' + (i + 1) + "</span>"; }).join("");
  }
  function rTz() {
    var p = proj(), el = $("v-ceh");
    if (!p) { el.innerHTML = noProject("ТЗ собирается из изделий заказа: размеры, фото эскиза, ответы на вопросы и правки."); return; }
    var h = '<section class="noprint"><div class="sh"><h2>ТЗ для цеха и сборщиков</h2><p>Без цен. Пометки "Внимание" - из ваших ответов, правки - только согласованные.</p></div>' +
      '<div class="btns" style="margin-top:0"><button type="button" class="btn p" data-a="print">' + svg(IC.print) + 'Печать или PDF</button><button type="button" class="btn ok" data-a="waCeh">' + svg(IC.wa) + 'В WhatsApp цеху</button><button type="button" class="btn" data-a="copyTz">' + svg(IC.copy) + "Скопировать текстом</button></div>" +
      '<p class="muted" style="font-size:13px;margin:8px 0 12px">В WhatsApp уходит текст. Картинки с пометками - через "Печать или PDF": сохраните PDF и отправьте файлом.</p></section>';
    h += '<div class="tz" id="tz"><div class="hd"><div><h2>ТЗ на изготовление</h2><small>' + esc(p.client || "Клиент не указан") + (p.addr ? " · " + esc(p.addr) : "") + "</small></div><div style=\"text-align:right\"><small>от " + esc(dfull()) + "</small><small>" + esc(statusName(p.status)) + "</small></div></div>";
    p.items.forEach(function (it) {
      var W = warnings(it), spec = itemSpec(it), pics = (it.photos || []).filter(function (f) { return f.tz !== false; });
      var chg = p.changes.filter(function (x) { return x.st === "ok" && (x.item === it.id || (!x.item && p.items.length === 1)); }).sort(function (a, b) { return a.at < b.at ? -1 : 1; });
      var sz = it.sizes.filter(function (s) { return String(s.l).trim() || String(s.v).trim(); });
      h += '<div class="item"><h3>' + esc(it.name || typeOf(it.type).n) + (it.qty > 1 ? " - " + it.qty + " шт" : "") + "</h3>";
      if (W.length) h += '<div class="att"><b class="h">ВНИМАНИЕ</b><ol>' + W.map(function (w) { return "<li>" + esc(w.t) + "</li>"; }).join("") + "</ol></div>";
      if (chg.length) h += '<div class="chg"><b class="h">ИЗМЕНЕНО КЛИЕНТОМ</b><ul>' + chg.map(function (x) { return "<li>" + esc(dshort(x.at)) + ": " + esc(x.text) + "</li>"; }).join("") + "</ul></div>";
      if (pics.length) {
        h += '<div class="pics">' + pics.map(function (f) {
          return '<figure><span class="pin-wrap"><img data-ph="' + f.id + '" alt="' + esc(f.kind) + '">' + pinsHTML(f) + "</span><figcaption>" + esc(f.kind) + "</figcaption>" +
            (f.marks && f.marks.length ? '<ol class="pinl">' + f.marks.map(function (m) { return "<li>" + esc(m.t) + "</li>"; }).join("") + "</ol>" : "") + "</figure>";
        }).join("") + "</div>";
      }
      h += "<table>";
      if (sz.length) h += sz.map(function (s) { return "<tr><td>" + esc(s.l) + "</td><td><b>" + esc(s.v) + (/^\d+([.,]\d+)?$/.test(String(s.v).trim()) ? " мм" : "") + "</b></td></tr>"; }).join("");
      spec.forEach(function (g) { h += g.rows.map(function (r) { return "<tr><td>" + esc(r.s) + "</td><td>" + esc(r.v) + "</td></tr>"; }).join(""); });
      h += "</table>";
      if ((it.parts || []).length) h += '<p style="font-size:14px;margin:12px 0 4px"><b>Части и нюансы:</b></p><table>' + it.parts.map(function (x) { return "<tr><td>" + (x.w ? '<b style="color:var(--bad)">! </b>' : "") + esc(x.n || "Нюанс") + (x.q > 1 ? " x" + esc(x.q) : "") + "</td><td>" + esc([x.sz && x.sz + (/^\d+([.,]\d+)?$/.test(String(x.sz).trim()) ? " мм" : ""), x.t].filter(Boolean).join(" - ")) + "</td></tr>"; }).join("") + "</table>";
      if (it.desc) h += '<p style="font-size:14px;margin:10px 0 0"><b>Описание мастера:</b> ' + esc(it.desc) + "</p>";
      h += "</div>";
    });
    var common = p.changes.filter(function (x) { return x.st === "ok" && !x.item && p.items.length > 1; });
    if (common.length) h += '<div class="chg"><b class="h">ИЗМЕНЕНО ПО ВСЕМУ ЗАКАЗУ</b><ul>' + common.map(function (x) { return "<li>" + esc(dshort(x.at)) + ": " + esc(x.text) + "</li>"; }).join("") + "</ul></div>";
    h += '<h3>Сборщикам перед выездом</h3><ul class="chk"><li>Все пометки "Внимание" прочитаны</li><li>Фурнитура и подсветка - на руках, по списку</li><li>Размеры сверены по месту (стены, потолок, розетки)</li><li>Фото готового изделия - мастеру</li></ul>';
    h += '<div class="ft"><span>Блокнот мастера · мастер: ' + esc(DB.set.name || "-") + "</span><span>Автор разработки: Александр Наумов, 2026</span></div></div>";
    // шпаргалка и передача - не печатаются
    h += '<section class="noprint"><div class="sh"><h2>Шпаргалка: что чаще всего забывают</h2></div><div class="card"><ul class="cheat">' +
      ["Декоративный бок - петли и полки на него не сверлить, ставить доп. бок", "Стиралка и сушилка - отступ сзади под шланги и дефлектор", "Холодильник встроенный - вентиляция в цоколе и сверху", "Подсветка - второе дно или паз, место и доступ к блоку питания", "Присадка - только по выбранной фурнитуре, она на руках", "Фрезеровка - образец и размеры выборки, первый фасад сверить", "Ножки - модель и высота, декоративные заказать заранее", "Ящики разной длины - направляющие под каждый", "Щит на батарею - доступ к кранам, эмаль вместо плёнки", "Криволинейное зеркало - шаблон 1:1", "Панели - что за стеной (проводка, трубы)", "Детская - крепление к стене от опрокидывания"].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div></section>";
    h += '<section class="noprint"><div class="sh"><h2>Нужны КП, договор или учёт?</h2><p>В блокноте их нет специально. Если понадобятся - заказ переходит в основной Мебельный конструктор: изделия, смета и согласованные правки.</p></div><div class="btns" style="margin-top:0"><button type="button" class="btn" data-export="kp">В КП и договор</button><button type="button" class="btn" data-export="zakazy">В учёт заказов</button><button type="button" class="btn" data-export="file">Скачать файл заказа</button></div></section>';
    el.innerHTML = h;
    fillPhotos(el);
  }
  function tzText(p) {
    var L = ["*ТЗ на изготовление* от " + dfull(), (p.client || "Клиент не указан") + (p.addr ? ", " + p.addr : "")];
    p.items.forEach(function (it) {
      L.push(""); L.push("*" + (it.name || typeOf(it.type).n) + (it.qty > 1 ? " - " + it.qty + " шт" : "") + "*");
      var W = warnings(it);
      if (W.length) { L.push("ВНИМАНИЕ:"); W.forEach(function (w, i) { L.push("!" + (i + 1) + ". " + w.t); }); }
      var chg = p.changes.filter(function (x) { return x.st === "ok" && (x.item === it.id || !x.item); });
      if (chg.length) { L.push("ИЗМЕНЕНО КЛИЕНТОМ:"); chg.forEach(function (x) { L.push("- " + dshort(x.at) + ": " + x.text); }); }
      var sz = it.sizes.filter(function (s) { return String(s.v).trim(); });
      if (sz.length) L.push("Размеры: " + sz.map(function (s) { return s.l.toLowerCase() + " " + s.v; }).join(", ") + " мм");
      itemSpec(it).forEach(function (g) { g.rows.forEach(function (r) { L.push(r.s + ": " + r.v); }); });
      (it.parts || []).forEach(function (x) { if (!x.w) L.push("Нюанс: " + partLine(x)); });
      (it.photos || []).forEach(function (f) { (f.marks || []).forEach(function (m, i) { L.push("Пометка " + (i + 1) + " на фото \"" + f.kind + "\": " + m.t); }); });
      if (it.desc) L.push("Описание: " + it.desc.trim());
    });
    return L.join("\n");
  }
  // заказ в общем формате - для КП, учёта или файла
  function toOrder(p) {
    if (!MO) throw new Error("Модуль заказа не загрузился");
    var o = MO.create({ currency: p.cur || cur(), title: p.items.map(function (i) { return i.name; }).join(", "), client: { name: p.client, phone: p.phone, address: p.addr } });
    o.products = p.items.map(function (it) {
      var g = function (re) { var s = it.sizes.filter(function (x) { return re.test(String(x.l).toLowerCase()); })[0]; return s ? num(s.v) : 0; };
      return MO.newProduct({ type: "univ", name: it.name || typeOf(it.type).n, qty: Math.max(1, +it.qty || 1), size: { w: g(/шир|длин/), h: g(/выс/), d: g(/глуб/) }, params: { bloknot: { type: it.type, desc: it.desc } } });
    });
    o.extras = [];
    p.items.forEach(function (it) {
      (it.est || []).forEach(function (l) {
        if (!(+l.q) || !(+l.p)) return;
        var kind = /монтаж/i.test(l.n) ? "install" : /доставк/i.test(l.n) ? "delivery" : "item";
        o.extras.push({ id: MO.uid("x"), kind: kind, name: (p.items.length > 1 ? it.name + ": " : "") + l.n, qty: (+l.q) * Math.max(1, +it.qty || 1), unit: l.u || "шт", price: +l.p });
      });
    });
    p.items.forEach(function (it) { (it.parts || []).forEach(function (x) { if (+x.p) o.extras.push({ id: MO.uid("x"), kind: "item", name: (p.items.length > 1 ? it.name + ": " : "") + partLine(x), qty: (+x.q || 1) * Math.max(1, +it.qty || 1), unit: "шт", price: +x.p }); }); });
    p.changes.forEach(function (c) { if (c.st === "ok" && +c.d) o.extras.push({ id: MO.uid("x"), kind: "item", name: "Правка: " + c.text, qty: 1, unit: "шт", price: +c.d }); });
    Object.assign(o.pricing, { workPct: 0, markupPct: 0, discountPct: 0 });
    o.notes = tzText(p).replace(/\*/g, "");
    o.x = { bloknot: { project: p.id } };
    o.quote = MO.quote(o);
    return o;
  }

  // ======================= окно фото: пометки =======================
  var modalPhoto = null;
  function openPhoto(it, idx) {
    var f = it.photos[idx]; if (!f) return;
    modalPhoto = { it: it, f: f };
    var w = document.createElement("div"); w.className = "modal"; w.id = "phModal";
    document.body.appendChild(w);
    drawModal();
  }
  function drawModal(pending) {
    var w = $("phModal"); if (!w || !modalPhoto) return;
    var f = modalPhoto.f;
    w.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-label="Фото и пометки"><div class="hd"><b>Фото: ' + esc(f.kind) + '</b><button type="button" class="x" data-mx aria-label="Закрыть">×</button></div>' +
      '<div class="chips" style="margin-bottom:10px">' + KINDS.map(function (k) { return '<button type="button" class="chip' + (f.kind === k ? " on" : "") + '" data-mkind="' + esc(k) + '">' + esc(k) + "</button>"; }).join("") + "</div>" +
      '<span class="pin-wrap" id="mImg"><img data-ph="' + f.id + '" alt="">' + pinsHTML(f) + (pending ? '<span class="pin" style="left:' + pending.x + "%;top:" + pending.y + '%;background:#1d1a17">' + ((f.marks || []).length + 1) + "</span>" : "") + "</span>" +
      '<p class="muted" style="font-size:13px;margin:8px 0 0">' + (pending ? "Напишите пометку и нажмите \"Сохранить\"." : "Нажмите на фото, где нужна пометка.") + "</p>" +
      (pending ? '<div class="g2" style="grid-template-columns:minmax(0,1fr) auto auto;margin-top:8px"><input class="t" id="mText" placeholder="Например: выборка 10 мм по краю"><button type="button" class="btn mic sm" id="mMic" title="Сказать">' + svg(IC.mic) + '</button><button type="button" class="btn p" data-msave>Сохранить</button></div>' : "") +
      '<ol class="pl">' + (f.marks || []).map(function (m, i) { return "<li><i>" + (i + 1) + "</i><span>" + esc(m.t) + '</span><button type="button" data-mdel="' + i + '" aria-label="Убрать пометку">×</button></li>'; }).join("") + "</ol>" +
      '<div class="btns"><label class="chip' + (f.tz !== false ? " on" : "") + '" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="mTz" ' + (f.tz !== false ? "checked" : "") + ' style="margin:0"> Показывать в ТЗ</label><span style="flex:1"></span><button type="button" class="btn l" data-mdelphoto id="mDelPh">Удалить фото</button><button type="button" class="btn p" data-mx>Готово</button></div></div>';
    fillPhotos(w);
    var img = $("mImg");
    img.onclick = function (e) {
      if (e.target.closest(".pin")) return;
      var r = img.getBoundingClientRect();
      drawModal({ x: Math.round((e.clientX - r.left) / r.width * 1000) / 10, y: Math.round((e.clientY - r.top) / r.height * 1000) / 10 });
    };
    if (pending) {
      var inp = $("mText"); inp.focus();
      var saveMark = function () { var t = inp.value.trim(); if (!t) { toast("Напишите, что отметить"); return; } f.marks = f.marks || []; f.marks.push({ x: pending.x, y: pending.y, t: t }); save(); drawModal(); };
      inp.onkeydown = function (e) { if (e.key === "Enter") saveMark(); };
      w.querySelector("[data-msave]").onclick = saveMark;
      $("mMic").onclick = function () { dictate(this, { final: function (t) { inp.value = (inp.value ? inp.value + " " : "") + t; } }); };
    }
    $("mTz").onchange = function () { f.tz = this.checked; save(); drawModal(); };
  }
  function closeModal() { dictStop(); var w = $("phModal"); if (w) w.remove(); modalPhoto = null; render(); }

  // ======================= пример =======================
  function sketch() {
    // карандашный эскиз спальни для примера: кровать с изголовьем, тумбы, ящики
    var c = document.createElement("canvas"); c.width = 1200; c.height = 800;
    var g = c.getContext("2d");
    g.fillStyle = "#fbf8f1"; g.fillRect(0, 0, 1200, 800);
    g.strokeStyle = "rgba(40,50,80,.12)"; g.lineWidth = 1;
    for (var y = 40; y < 800; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1200, y); g.stroke(); }
    var seed = 7, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; };
    var line = function (x1, y1, x2, y2) { for (var k = 0; k < 2; k++) { g.beginPath(); g.moveTo(x1 + rnd() * 4, y1 + rnd() * 4); g.quadraticCurveTo((x1 + x2) / 2 + rnd() * 6, (y1 + y2) / 2 + rnd() * 6, x2 + rnd() * 4, y2 + rnd() * 4); g.stroke(); } };
    var rect = function (x, y, w, h) { line(x, y, x + w, y); line(x + w, y, x + w, y + h); line(x + w, y + h, x, y + h); line(x, y + h, x, y); };
    g.strokeStyle = "#2b3550"; g.lineWidth = 2.2; g.lineCap = "round";
    rect(330, 120, 540, 330);           // изголовье
    for (var i = 1; i < 6; i++) line(330 + i * 90, 130, 330 + i * 90, 440); // мягкие секции
    g.strokeStyle = "#d29a3a"; g.lineWidth = 3; line(340, 112, 860, 112); line(322, 125, 322, 445); line(878, 125, 878, 445); // подсветка
    g.strokeStyle = "#2b3550"; g.lineWidth = 2.2;
    rect(360, 450, 480, 120);           // царга
    rect(375, 470, 215, 80); rect(610, 470, 215, 80); // ящики
    line(450, 510, 515, 510); line(685, 510, 750, 510);
    rect(140, 360, 170, 210); rect(890, 360, 170, 210); // тумбы
    line(140, 450, 310, 450); line(890, 450, 1060, 450);
    line(200, 405, 250, 405); line(950, 405, 1000, 405); line(200, 510, 250, 510); line(950, 510, 1000, 510);
    g.fillStyle = "#2b3550"; g.font = "italic 30px 'Segoe Print','Comic Sans MS',cursive";
    g.fillText("1800", 570, 610); line(360, 595, 840, 595);
    g.fillText("h 1350", 210, 250); line(300, 120, 300, 450);
    g.fillText("спальня, кровать 180х200", 400, 700);
    g.fillText("тумба 450", 135, 620); g.fillText("тумба 450", 885, 620);
    return new Promise(function (ok) { c.toBlob(ok, "image/jpeg", 0.85); });
  }
  function demo() {
    var p = newProject();
    p.demo = true; p.client = "Айгерим (пример)"; p.phone = ""; p.addr = "ЖК Нурлы, кв. 45"; p.status = "ok";
    var bed = newItem("krovat"), tb = newItem("tumba");
    bed.name = "Кровать с мягким изголовьем";
    bed.desc = "Кровать 180 на 200, мягкое изголовье до 1350 с подсветкой по контуру, тайник в изголовье на push, снизу два ящика, левый длиннее на 100.";
    bed.sizes = [{ l: "Ширина", v: "1960" }, { l: "Высота изголовья", v: "1350" }, { l: "Длина", v: "2150" }, { l: "Спальное место", v: "1800 x 2000" }, { l: "Ящик левый, глубина", v: "650" }, { l: "Ящик правый, глубина", v: "550" }];
    bed.ans = { g_eskiz: "Да, фото эскиза есть", g_render: "Да, утвердил", k_mat: "ЛДСП 18", kr_razm: "180x200", kr_izgol: ["Мягкое", "С подсветкой"], kr_osn: "С ящиками", kr_tajnik: "В изголовье", h_napr: "Скрытые с доводчиком", h_brand: "Blum", h_raznye: "Есть разные - размеры каждого", l_type: ["В изголовье"], l_dno: "За панелью", l_trans: "У розетки, выносной", l_cvet: "Тёплый 3000K", n_type: "Цоколь" };
    bed.parts = [{ id: uid("n"), n: "Тайник в изголовье", sz: "600 x 300", t: "открывание push, без ручки", q: 1, p: 12000, w: true }, { id: uid("n"), n: "Ящик левый", sz: "650", t: "длиннее правого на 100, своя направляющая", q: 1, p: "", w: true }, { id: uid("n"), n: "Изголовье заходит за тумбы", sz: "по 80 с каждой стороны", t: "", q: 1, p: "", w: false }];
    bed.notes = { k_mat: "Кашемир серый", kr_izgol: "велюр, 6 вертикальных секций" };
    bed.est = [{ n: "Корпус и царга", q: 1, u: "шт", p: 180000 }, { n: "Обивка изголовья", q: 1, u: "шт", p: 95000 }, { n: "Фурнитура", q: 1, u: "компл", p: 40000 }, { n: "Подсветка", q: 1, u: "компл", p: 25000 }, { n: "Монтаж", q: 1, u: "усл", p: 20000 }];
    tb.name = "Тумба прикроватная"; tb.qty = 2;
    tb.desc = "Две тумбы в цвет кровати, рейка на фасадах, ножки декоративные чёрные, подсветка снизу.";
    tb.sizes = [{ l: "Ширина", v: "450" }, { l: "Высота", v: "500" }, { l: "Глубина", v: "400" }];
    tb.ans = { g_eskiz: "Да, фото эскиза есть", tu_vid: "Прикроватная тумба", k_mat: "ЛДСП 18", f_type: ["МДФ эмаль"], f_frez: "Рейка", f_ruchki: "Push-to-open (без ручек)", h_napr: "Push-to-open", n_type: "Декоративные ножки", l_type: ["Снизу (парящая мебель)"], l_dno: "Паз в задней стенке", l_trans: "В соседнем модуле" };
    tb.parts = [{ id: uid("n"), n: "Ящик для зарядки", sz: "", t: "отверстие под провод в задней стенке", q: 1, p: 3000, w: false }];
    tb.notes = { f_frez: "шаг рейки 20, глубина 4" };
    tb.est = [{ n: "Корпус", q: 1, u: "шт", p: 38000 }, { n: "Фасады", q: 0.4, u: "м²", p: 60000 }, { n: "Ножки/цоколь", q: 1, u: "компл", p: 9000 }];
    p.items = [bed, tb]; p.curItem = bed.id;
    var day = 864e5, now = Date.now();
    p.changes = [
      { id: uid("c"), at: new Date(now - 5 * day).toISOString(), text: "Изголовье выше на 100 мм (было 1250)", d: 15000, item: bed.id, st: "ok" },
      { id: uid("c"), at: new Date(now - 3 * day).toISOString(), text: "Убрать подсветку в тумбах", d: -6000, item: tb.id, st: "no" },
      { id: uid("c"), at: new Date(now - 2 * day).toISOString(), text: "Левый ящик длиннее на 100 мм", d: 0, item: bed.id, st: "ok" },
      { id: uid("c"), at: new Date(now - 3600e3).toISOString(), text: "Ткань велюр вместо рогожки", d: 8000, item: bed.id, st: "wait" }
    ];
    save();
    return sketch().then(function (b) {
      var id = uid("f");
      return photoPut(id, b).then(function () {
        bed.photos.push({ id: id, kind: "Эскиз", tz: true, marks: [{ x: 50, y: 22, t: "Тайник в изголовье, открывание push - без ручки" }, { x: 30, y: 63, t: "Левый ящик длиннее на 100 мм - своя направляющая" }, { x: 72, y: 10, t: "Подсветка по контуру: лента за панелью, вывод провода за тумбой" }] });
        tb.photos.push({ id: id, kind: "Эскиз", tz: true, marks: [{ x: 19, y: 60, t: "Рейка на фасаде, шаг 20 мм" }] });
        save();
      });
    }).catch(function () {}).then(function () { toast("Пример готов: спальня с кроватью и тумбами"); });
  }

  // ======================= резервная копия =======================
  function blobToData(b) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsDataURL(b); }); }
  function backup() {
    var ids = []; DB.projects.forEach(function (p) { p.items.forEach(function (i) { (i.photos || []).forEach(function (f) { if (ids.indexOf(f.id) < 0) ids.push(f.id); }); }); });
    Promise.all(ids.map(function (id) { return photoGet(id).then(function (b) { return b ? blobToData(b).then(function (d) { return [id, d]; }) : null; }).catch(function () { return null; }); })).then(function (list) {
      var ph = {}; list.forEach(function (x) { if (x) ph[x[0]] = x[1]; });
      download("bloknot-mastera-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ format: "bloknot-mastera", v: 1, at: new Date().toISOString(), db: DB, photos: ph }));
      toast("Копия скачана - откройте её на другом телефоне в Настройках");
    });
  }
  function restore(text) {
    var d = JSON.parse(text);
    if (!d || d.format !== "bloknot-mastera" || !d.db) throw new Error("Это не копия блокнота");
    var jobs = Object.keys(d.photos || {}).map(function (id) { return fetch(d.photos[id]).then(function (r) { return r.blob(); }).then(function (b) { return photoPut(id, b); }); });
    return Promise.all(jobs).then(function () {
      var n = 0;
      (d.db.projects || []).forEach(function (p) { var i = DB.projects.findIndex(function (x) { return x.id === p.id; }); if (i >= 0) DB.projects[i] = p; else DB.projects.push(p); n++; });
      Object.keys(d.db.custom || {}).forEach(function (k) { DB.custom[k] = d.db.custom[k]; });
      if (!DB.set.name && d.db.set) DB.set = d.db.set;
      save(); return n;
    });
  }

  // ======================= события =======================
  var pendingKind = "Эскиз", armed = {};
  function arm(id, btn, label, fn) {
    // удаление - вторым нажатием (без системных окон)
    if (armed[id]) { delete armed[id]; fn(); return; }
    armed[id] = true; btn.textContent = label; btn.style.color = "var(--bad)";
    setTimeout(function () { if (armed[id]) { delete armed[id]; render(); } }, 3000);
  }
  document.addEventListener("click", function (e) {
    var t = e.target, b, p = proj(), it = p ? item(p) : null;
    if ((b = t.closest("[data-go]"))) { e.preventDefault(); go(b.dataset.go); return; }
    if ((b = t.closest("[data-open]"))) { DB.cur = b.dataset.open; save(); go("izdelie"); return; }
    if ((b = t.closest("[data-item]"))) { p.curItem = b.dataset.item; qcur = null; save(); render(); return; }
    if ((b = t.closest("[data-status]"))) { p.status = b.dataset.status; save(); render(); return; }
    if ((b = t.closest("[data-type]"))) {
      var old = typeOf(it.type), nt = typeOf(b.dataset.type);
      it.type = nt.id; if (!it.name || it.name === old.n) it.name = nt.n; qcur = null; save(); render(); return;
    }
    if ((b = t.closest("[data-addsize]"))) { it.sizes.push({ l: b.dataset.addsize, v: "" }); save(); rItem(); var ins = document.querySelectorAll('[data-size="' + (it.sizes.length - 1) + '"]'); if (ins.length) ins[b.dataset.addsize ? 1 : 0].focus(); return; }
    if ((b = t.closest("[data-addsize3]"))) { ["низ", "середина", "верх"].forEach(function (z) { it.sizes.push({ l: "Ширина, " + z, v: "" }); }); save(); rItem(); return; }
    if ((b = t.closest("[data-addpart]"))) { it.parts.push({ id: uid("n"), n: b.dataset.addpart, sz: "", t: "", q: 1, p: "", w: false }); save(); rItem(); var pr = document.querySelectorAll('[data-part="' + (it.parts.length - 1) + '"]'); if (pr.length) pr[1].focus(); return; }
    if ((b = t.closest("[data-partw]"))) { var px = it.parts[+b.dataset.partw]; px.w = !px.w; save(); rItem(); navBadges(); return; }
    if ((b = t.closest("[data-delpart]"))) { it.parts.splice(+b.dataset.delpart, 1); save(); rItem(); return; }
    if ((b = t.closest("[data-delsize]"))) { it.sizes.splice(+b.dataset.delsize, 1); save(); rItem(); return; }
    if ((b = t.closest("[data-addest]"))) {
      var n = b.dataset.addest, lp = (DB.set.prices || {})[n];
      it.est.push({ n: n, q: 1, u: b.dataset.u, p: lp || "" }); save(); rItem();
      var r = document.querySelectorAll('[data-est="' + (it.est.length - 1) + '"]'); if (r.length) r[n ? 2 : 0].focus(); return;
    }
    if ((b = t.closest("[data-delest]"))) { it.est.splice(+b.dataset.delest, 1); save(); rItem(); return; }
    if ((b = t.closest("[data-addphoto]"))) { pendingKind = b.dataset.addphoto; $("fPhoto").value = ""; $("fPhoto").click(); return; }
    if ((b = t.closest("[data-photo]"))) { openPhoto(it, +b.dataset.photo); return; }
    if ((b = t.closest("[data-ans]"))) {
      var q = qById(it, b.dataset.ans); if (!q) return;
      setAns(it, q, b.dataset.o);
      var oneMode = (DB.ui.qmode || "one") === "one" && view === "voprosy";
      if (oneMode && !q.m && it.ans[q.id] !== undefined) { rQ(); setTimeout(function () { if (qcur === q.id) qStep(it, 1); }, 450); }
      else render();
      return;
    }
    if ((b = t.closest("[data-qmode]"))) { DB.ui.qmode = b.dataset.qmode; save(); if (b.dataset.qmode === "one") qcur = null; rQ(); return; }
    if ((b = t.closest("[data-qstep]"))) { qStep(it, +b.dataset.qstep); return; }
    if ((b = t.closest("[data-qgo]"))) { var L = visibleQ(it); qcur = L.length ? L[0].id : null; rQ(); return; }
    if ((b = t.closest("[data-delcq]"))) { DB.custom[it.type] = (DB.custom[it.type] || []).filter(function (c) { return c.id !== b.dataset.delcq; }); save(); rQ(); return; }
    if ((b = t.closest("[data-chst]"))) { chDraft.st = b.dataset.chst; rCh(); return; }
    if ((b = t.closest("[data-setst]"))) { p.changes.forEach(function (c) { if (c.id === b.dataset.setst) c.st = b.dataset.st; }); save(); render(); return; }
    if ((b = t.closest("[data-delch]"))) { var cid = b.dataset.delch; arm("ch" + cid, b, "Точно удалить?", function () { p.changes = p.changes.filter(function (c) { return c.id !== cid; }); save(); render(); }); return; }
    if ((b = t.closest("[data-export]"))) { exportTo(b.dataset.export); return; }
    // окно фото
    if ((b = t.closest("[data-mx]")) || t.id === "phModal") { closeModal(); return; }
    if ((b = t.closest("[data-mkind]"))) { modalPhoto.f.kind = b.dataset.mkind; save(); drawModal(); return; }
    if ((b = t.closest("[data-mdel]"))) { modalPhoto.f.marks.splice(+b.dataset.mdel, 1); save(); drawModal(); return; }
    if ((b = t.closest("[data-mdelphoto]"))) {
      arm("ph", b, "Точно удалить фото?", function () {
        var mp = modalPhoto, id = mp.f.id; mp.it.photos = mp.it.photos.filter(function (f) { return f !== mp.f; });
        var used = DB.projects.some(function (pp) { return pp.items.some(function (ii) { return (ii.photos || []).some(function (f) { return f.id === id; }); }); });
        if (!used) photoDel(id);
        save(); closeModal();
      });
      return;
    }
    if (!(b = t.closest("[data-a]"))) return;
    var a = b.dataset.a;
    if (a === "new") { newProject(); qcur = null; go("izdelie"); setTimeout(function () { var d = $("desc"); if (d) d.focus(); }, 80); }
    else if (a === "demo") { demo().then(function () { go("izdelie"); }); }
    else if (a === "addItem") { var ni = newItem(it ? it.type : "shkaf"); p.items.push(ni); p.curItem = ni.id; qcur = null; save(); rItem(); }
    else if (a === "dupItem") { var cp = JSON.parse(JSON.stringify(it)); cp.id = uid("i"); cp.name = it.name + " (копия)"; p.items.push(cp); p.curItem = cp.id; save(); rItem(); toast("Копия изделия - поменяйте отличия"); }
    else if (a === "delItem") arm("it", b, "Точно удалить изделие?", function () { p.items = p.items.filter(function (x) { return x !== it; }); p.curItem = p.items.length ? p.items[0].id : ""; save(); render(); });
    else if (a === "delProj") arm("pr", b, "Точно удалить заказ?", function () { DB.projects = DB.projects.filter(function (x) { return x !== p; }); DB.cur = DB.projects.length ? DB.projects[0].id : ""; save(); go("glavnoe"); toast("Заказ удалён"); });
    else if (a === "addPart") { var pt = $("partText").value.trim(); if (!pt) { toast("Напишите или скажите нюанс"); return; } it.parts.push(partFromText(pt)); save(); rItem(); toast("Нюанс добавлен"); }
    else if (a === "parseDesc") { autoSizes(it); rItem(); }
    else if (a === "copyAi") copy(aiPrompt(it), "Запрос скопирован - вставьте в ИИ вместе с фото комнаты и эскиза");
    else if (a === "pin") window.open("https://www.pinterest.com/search/pins/?q=" + encodeURIComponent($("pinQ").value || pinQuery(it)), "_blank", "noopener");
    else if (a === "addCq") { var v = $("cq").value.trim(); if (!v) { toast("Напишите вопрос"); return; } (DB.custom[it.type] = DB.custom[it.type] || []).push({ id: uid("cq"), t: v }); save(); rQ(); toast("Вопрос добавлен для всех: " + typeOf(it.type).n); }
    else if (a === "addCh") {
      var tx = $("chText").value.trim(); if (!tx) { toast("Напишите или скажите, что поменял клиент"); return; }
      var pc = parseChange(tx), dv = $("chD").value.trim() ? num($("chD").value) : (pc.d || 0);
      addChange((pc.d !== null && chDraft.auto && pc.text) ? pc.text : tx, dv, $("chItem").value, chDraft.st);
      chDraft = { text: "", d: "", item: $("chItem").value, st: "ok", auto: true };
      render(); toast("Правка записана");
    }
    else if (a === "waClient") waOpen(p.phone, clientMemo(p));
    else if (a === "copyClient") copy(clientMemo(p), "Памятка скопирована");
    else if (a === "print") window.print();
    else if (a === "waCeh") waOpen(DB.set.ceh, tzText(p));
    else if (a === "copyTz") copy(tzText(p), "ТЗ скопировано текстом");
    else if (a === "backup") backup();
    else if (a === "restore") { $("fRestore").value = ""; $("fRestore").click(); }
  });
  function exportTo(where) {
    var p = proj(), o;
    try { o = toOrder(p); } catch (er) { toast(er.message); return; }
    if (where === "file") { download((MO.fileName ? MO.fileName(o) : "zakaz.mebel.json"), JSON.stringify(o, null, 1)); return; }
    if (S && S.write(o, "bloknot")) location.href = "../" + where + "/?from=bloknot";
  }
  // поля ввода
  document.addEventListener("input", function (e) {
    var t = e.target, p = proj(), it = p ? item(p) : null;
    if (t.dataset.pf) { p[t.dataset.pf] = t.value; save(); ctx(); return; }
    if (t.dataset.if) {
      it[t.dataset.if] = t.dataset.if === "qty" ? Math.max(1, parseInt(t.value, 10) || 1) : t.value; save();
      if (t.dataset.if === "qty") { var et = $("estTot"); if (et) et.textContent = money(estSum(it)); }
      if (t.dataset.if === "desc") { var ai = $("aiText"); if (ai) ai.textContent = aiPrompt(it); }
      return;
    }
    if (t.dataset.size !== undefined) { it.sizes[+t.dataset.size][t.dataset.k] = t.value; save(); var a2 = $("aiText"); if (a2) a2.textContent = aiPrompt(it); return; }
    if (t.dataset.part !== undefined) {
      var xp = it.parts[+t.dataset.part]; xp[t.dataset.k] = t.dataset.k === "q" ? Math.max(1, parseInt(t.value, 10) || 1) : t.dataset.k === "p" ? t.value.replace(",", ".").replace(/\s/g, "") : t.value; save();
      var et2 = $("estTot"); if (et2) et2.textContent = money(estSum(it)); return;
    }
    if (t.dataset.est !== undefined) {
      var l = it.est[+t.dataset.est], k = t.dataset.k;
      l[k] = k === "n" ? t.value : t.value.replace(",", ".").replace(/\s/g, "");
      if (k === "p" && l.n) { DB.set.prices = DB.set.prices || {}; DB.set.prices[l.n] = +l.p || ""; }
      save();
      var row = t.closest(".er"); if (row) row.querySelector(".sm").textContent = money((+l.q || 0) * (+l.p || 0));
      $("estTot").textContent = money(estSum(it)); return;
    }
    if (t.dataset.free) {
      var q = qById(it, t.dataset.free); if (!q) return;
      if (q.o) { if (t.value.trim()) it.notes[q.id] = t.value; else delete it.notes[q.id]; }
      else { if (t.value.trim()) it.ans[q.id] = t.value; else delete it.ans[q.id]; }
      save(); navBadges(); return;
    }
    if (t.id === "setName") { DB.set.name = t.value.trim(); save(); var h = new Date().getHours(); $("hello").textContent = (h >= 5 && h < 12 ? "Доброе утро" : h >= 12 && h < 18 ? "Добрый день" : h >= 18 && h < 23 ? "Добрый вечер" : "Доброй ночи") + (DB.set.name ? ", " + DB.set.name : "") + "!"; return; }
    if (t.id === "setCeh") { DB.set.ceh = t.value.trim(); save(); return; }
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.free && view === "voprosy") rQ(); // обновить "Внимание" после свободного ответа
    if (t.id === "setCur") { DB.set.cur = t.value; var p = proj(); if (p && !p.changes.length && !p.items.some(function (i) { return i.est.length; })) p.cur = t.value; save(); toast("Валюта для новых заказов: " + t.value); }
  });
  $("fPhoto").onchange = function (e) {
    var p = proj(), it = item(p), files = [].slice.call(e.target.files || []);
    if (!it || !files.length) return;
    toast("Сохраняю фото...");
    files.reduce(function (pr, f) {
      return pr.then(function () { return shrink(f, 1600); }).then(function (b) { var id = uid("f"); return photoPut(id, b).then(function () { it.photos.push({ id: id, kind: pendingKind, tz: true, marks: [] }); save(); }); });
    }, Promise.resolve()).then(function () {
      rItem(); toast(files.length > 1 ? "Фото добавлены" : "Фото добавлено - нажмите на него, чтобы поставить пометки");
      if (files.length === 1 && (pendingKind === "Эскиз" || pendingKind === "Рендер ИИ")) openPhoto(it, it.photos.length - 1);
    }).catch(function (er) { toast(er.message || "Не получилось сохранить фото"); rItem(); });
  };
  $("fRestore").onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(restore).then(function (n) { toast("Открыто заказов: " + n); render(); }).catch(function (er) { toast(er.message || "Не получилось открыть копию"); });
  };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("phModal")) closeModal(); });
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", function (e) { if (e.key === KEY) { load(); render(); } });

  // ======================= голосовой помощник сайта =======================
  // Общая кнопка "Голосом" (site.js): здесь - команды блокнота, остальное (переходы по сайту) - общий разбор.
  function voice(t) {
    var p = proj(), m;
    if ((m = t.match(/^(?:правка|запиши правку|новая правка|клиент (?:хочет|просит|передумал|решил))[\s,:]*(.*)$/))) {
      if (!p) return "Сначала откройте заказ";
      var txt = m[0].replace(/^(правка|запиши правку|новая правка)[\s,:]*/, "");
      txt = txt.charAt(0).toUpperCase() + txt.slice(1);
      var r = parseChange(txt), it = item(p);
      addChange(r.text || txt, r.d || 0, it ? it.id : "", "ok");
      go("pravki");
      return "Записал правку" + (r.d ? ": " + signed(r.d) : "");
    }
    if ((m = t.match(/^(?:нюанс|добавь нюанс|особенность|деталь)[\s,:]+(.+)$/))) {
      var it2 = p && item(p); if (!it2) return "Сначала откройте заказ";
      (it2.parts = it2.parts || []).push(partFromText(m[1])); save(); go("izdelie"); return "Добавил нюанс в " + it2.name;
    }
    if (/^(открой |покажи )?(вопрос|чек.?лист)/.test(t)) { go("voprosy"); return "Открываю вопросы"; }
    if (/^(открой |покажи )?(правк|изменени|историю правок)/.test(t)) { go("pravki"); return "Открываю правки"; }
    if (/^(открой |покажи )?(тз|техзадани|цех|для цеха|сборщик)/.test(t)) { go("ceh"); return "Открываю ТЗ для цеха"; }
    if (/^(открой |покажи )?(изделие|описание|эскиз|размеры|смет)/.test(t)) { go("izdelie"); return "Открываю изделие"; }
    if (/^(новый заказ|начни заказ|новое изделие)$/.test(t)) { if (/изделие/.test(t) && p) { var ni = newItem("shkaf"); p.items.push(ni); p.curItem = ni.id; save(); } else newProject(); go("izdelie"); return "Начинаю: опишите изделие"; }
    if (/^(мои заказы|блокнот|главная блокнота|список заказов)$/.test(t)) { go("glavnoe"); return "Открываю заказы"; }
    if (/^(пример|покажи пример|показать на примере)$/.test(t)) { demo().then(function () { go("izdelie"); }); return "Делаю пример"; }
    return null;
  }

  // ======================= запуск =======================
  load();
  if (S) S.register({ voice: voice, voiceHint: "Скажите: \"клиент хочет ящик длиннее, плюс 5 тысяч\", \"открой вопросы\", \"ТЗ для цеха\"." });
  if (!location.hash && DB.projects.length && DB.ui.last && VIEWS.indexOf(DB.ui.last) >= 0) { /* открываем главное - мастер сам выберет */ }
  route();
  window.BK = { partFromText: partFromText, parseChange: parseChange, matchOpts: matchOpts, sizesFromText: sizesFromText, toOrder: function () { return toOrder(proj()); }, warnings: function () { return warnings(item()); }, demo: demo };
})();
