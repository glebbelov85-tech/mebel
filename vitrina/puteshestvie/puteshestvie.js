/* Витрина мастера, вариант 4 - "Путешествие по дому".
   Экраны: двери (первый заход) -> дом в разрезе -> комната (3D-лента работ) -> работа на весь экран.
   Данные - ../dannye.js (window.VITRINA), те же, что у варианта 3. Новые поля необязательные:
     komnaty[] {id, nazvanie, hint, col, span, row} - комнаты дома; если нет - строятся из vid работ;
     raboty[].komnata - id комнаты (если нет - по vid), raboty[].tochki[] {x, y, nazvanie, tekst} - точки на 1-м фото в %;
     raboty[].panorama - на будущее (обзор 360), сейчас только метка "обзор" на комнате.
   Ссылки: #komnata=<id>, #rabota=<id>. История браузера повторяет путь по дому: дом -> комната -> работа,
   поэтому "назад" и Esc всегда возвращают на шаг вверх.
   Черновик из Мастерской: ?chernovik=1 (данные и фото из памяти этого браузера), полоска мастера: ?master. */
(function () {
  "use strict";
  var D = window.VITRINA || {};
  var $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search);
  var DRAFT = Q.get("chernovik") === "1";
  var STAFF = Q.has("master") || DRAFT || (window.MebelSite && MebelSite.isStaff && MebelSite.isStaff());
  var PH = {}; // фото черновика: id -> адрес
  var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduce = !!(mq && mq.matches);
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { reduce = mq.matches; });
  function T(ms) { return reduce ? 0 : ms; }
  var SWIFT = "cubic-bezier(.7,0,.2,1)", EASE = "cubic-bezier(.22,1,.36,1)";
  function eSwift(t) { return bez(.7, 0, .2, 1, t); }
  function eEase(t) { return bez(.22, 1, .36, 1, t); }
  // кубическая Безье для своих анимаций (те же кривые, что в CSS)
  function bez(x1, y1, x2, y2, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var t = x;
    for (var i = 0; i < 8; i++) {
      var cx = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t - x;
      var d = 3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(cx) < 1e-5 || !d) break; t -= cx / d; t = Math.max(0, Math.min(1, t));
    }
    return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  }

  var IC = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    open: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>'
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function toast(t) { var e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 2200); }
  function plural(n, f) { n = Math.abs(n) % 100; var d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; }
  function initials(n) { return String(n || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(""); }
  var MON2 = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function day(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? +m[3] + " " + MON2[+m[2] - 1] + " " + m[1] : (s || ""); }
  function low(s) { return String(s || "").trim().toLowerCase(); }
  var TR = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya" };
  function slug(s) { return low(s).replace(/[а-яё]/g, function (c) { return TR[c]; }).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "komnata"; }

  // ---------- контакты ----------
  var K = {};
  var digits = function (s) { return String(s || "").replace(/\D/g, ""); };
  function waUrl(text) { var n = digits(K.whatsapp); return n ? "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "") : ""; }
  function tgUrl() { var u = String(K.telegram || "").replace(/^@|^https?:\/\/t\.me\//, ""); return u ? "https://t.me/" + u : ""; }

  // ---------- фото ----------
  function ris(v) { return window.VitrinaRis ? VitrinaRis(v || "detal") : ""; }
  // адреса фото в dannye.js - от папки vitrina/, а эта страница лежит на уровень глубже
  function srcOf(f) {
    if (!f) return ris("detal");
    var s = f.src;
    if (s && /^idb:/.test(s)) return PH[s.slice(4)] || ris(f.ris);
    if (s) return /^(data:|blob:|https?:|\/)/.test(s) ? s : "../" + s;
    return ris(f.ris);
  }
  function fotos(w) { return (w.foto && w.foto.length) ? w.foto : [null]; }
  function cover(w) { return srcOf(fotos(w)[0]); }
  var WM = "";
  function makeWM() {
    var t = esc((D.master && D.master.znak) || (D.master && D.master.imya) || "");
    if (!t) return "";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260"><g transform="rotate(-24 210 130)" font-family="system-ui,sans-serif" font-size="19" font-weight="600" text-anchor="middle">' +
      '<text x="210" y="138" fill="rgba(0,0,0,.18)">' + t + '</text><text x="209" y="137" fill="rgba(255,255,255,.3)">' + t + "</text></g></svg>";
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22") + '")';
  }
  function wmHTML(f) { return WM && !(f && f.znak) ? '<i class="wm" style="background-image:' + WM.replace(/"/g, "&quot;") + '"></i>' : ""; }
  // размеры картинки (нужны для "как cover" в анимациях); кэш по адресу
  var SIZE = {};
  function loadImg(src, cb) {
    if (SIZE[src]) return cb(SIZE[src]);
    var im = new Image(); var done = false;
    var fin = function () { if (done) return; done = true; SIZE[src] = { w: im.naturalWidth || 1200, h: im.naturalHeight || 900 }; cb(SIZE[src]); };
    im.onload = fin; im.onerror = fin; im.src = src;
    if (im.complete && im.naturalWidth) fin();
  }
  document.addEventListener("contextmenu", function (e) { if (e.target.closest && e.target.closest(".stage,.wcard,.room,.thumbs")) { e.preventDefault(); toast("Фото защищены - напишите мастеру, если нужно"); } });

  // ---------- комнаты и работы ----------
  var ROOMS = [], WORKS = [], BYID = {}, ROOMBY = {}, ROWS = 3;
  function otzyvy(w) { return (D.otzyvy || []).filter(function (o) { return o && o.rabota === w.id; }); }
  function prep() {
    var R = (D.raboty || []).filter(function (w) { return w && w.id; });
    var src = Array.isArray(D.komnaty) && D.komnaty.length ? D.komnaty : null;
    ROOMS = [];
    if (src) src.forEach(function (k) { if (k && (k.id || k.nazvanie)) ROOMS.push({ id: String(k.id || slug(k.nazvanie)), nazvanie: k.nazvanie || k.id, hint: k.hint || "", col: +k.col || 0, span: +k.span || 1, row: +k.row || 0, works: [] }); });
    ROOMBY = {}; ROOMS.forEach(function (k) { ROOMBY[k.id] = k; });
    R.forEach(function (w) {
      var k = (w.komnata && ROOMBY[w.komnata]) || null;
      if (!k && w.vid) for (var i = 0; i < ROOMS.length; i++) if (low(ROOMS[i].nazvanie) === low(w.vid)) { k = ROOMS[i]; break; }
      if (!k) { var id = slug(w.vid || "Работы"); k = ROOMBY[id]; if (!k) { k = { id: id, nazvanie: w.vid || "Работы", hint: "", col: 0, span: 1, row: 0, works: [] }; ROOMS.push(k); ROOMBY[id] = k; } }
      k.works.push(w); w._k = k;
    });
    // раскладка по умолчанию: по две комнаты на этаж, широкая то слева, то справа; нечётная последняя - во весь этаж
    var bad = ROOMS.some(function (k) { return !k.col || !k.row || k.col + k.span - 1 > 3; });
    if (bad) ROOMS.forEach(function (k, i) {
      var r = Math.floor(i / 2), first = i % 2 === 0, alone = first && i === ROOMS.length - 1;
      k.row = r + 1;
      if (alone) { k.col = 1; k.span = 3; }
      else if (r % 2 === 0) { k.col = first ? 1 : 3; k.span = first ? 2 : 1; }
      else { k.col = first ? 1 : 2; k.span = first ? 1 : 2; }
    });
    ROWS = Math.max.apply(null, ROOMS.map(function (k) { return k.row; }).concat([1]));
    // порядок обхода: по этажам сверху вниз, слева направо
    var ord = ROOMS.slice().sort(function (a, b) { return a.row - b.row || a.col - b.col; });
    WORKS = []; BYID = {};
    ord.forEach(function (k) { k.works.forEach(function (w) { WORKS.push(w); BYID[w.id] = w; }); });
  }
  function firstRoom() { var o = ROOMS.slice().sort(function (a, b) { return a.row - b.row || a.col - b.col; }); for (var i = 0; i < o.length; i++) if (o[i].works.length) return o[i]; return null; }

  // ---------- экраны ----------
  var SCREENS = ["doors", "home", "room", "work"], cur = "", S = { room: null, work: null, foto: 0 };
  var kbd = false;
  addEventListener("keydown", function () { kbd = true; }, true);
  addEventListener("pointerdown", function () { kbd = false; }, true);
  function show(id, inst) {
    SCREENS.forEach(function (s) {
      var e = $(s), on = s === id;
      if (inst) e.classList.add("inst");
      e.classList.toggle("on", on);
      e.inert = !on; if (!on) e.setAttribute("aria-hidden", "true"); else e.removeAttribute("aria-hidden");
      if (inst) requestAnimationFrame(function () { requestAnimationFrame(function () { e.classList.remove("inst"); }); });
    });
    cur = id;
  }
  function restart(e, cls) { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }

  // ---------- мастер ----------
  function renderMaster() {
    var m = D.master || {};
    var role = [m.rol, m.gorod].filter(Boolean).join(", ");
    $("dName").textContent = m.imya || "Мастер";
    $("dRole").textContent = role.toLowerCase();
    $("hName").textContent = m.imya || "Мастер";
    $("hRole").textContent = role;
    var av = $("hAv");
    if (m.foto) { av.style.backgroundImage = 'url("' + srcOf({ src: m.foto }).replace(/"/g, "%22") + '")'; av.textContent = ""; }
    else av.textContent = initials(m.imya);
    $("roofT").textContent = m.imya ? "дом мастера " + m.imya : "дом мастера";
    var n = WORKS.length;
    $("hLead").textContent = "Каждая комната - раздел работ. Наведите или нажмите: в комнате включится свет. Войдите - и смотрите мебель вблизи, с деталями и отзывами хозяев.";
    var kod = (D.otzyvy || []).filter(function (o) { return o && o.kod; }).length;
    var t = [];
    if (m.opyt) t.push("<div><b>" + esc(m.opyt) + "</b>делаю мебель</div>");
    t.push("<div><b>" + esc(m.rabot || n) + "</b>" + (m.rabot ? "работ" : plural(n, ["работа", "работы", "работ"]) + " на сайте") + "</div>");
    if (kod) t.push("<div><b>" + kod + "</b>" + plural(kod, ["отзыв", "отзыва", "отзывов"]) + " с кодом заказа</div>");
    $("trust").innerHTML = t.join("");
    var hasRv = WORKS.some(function (w) { return otzyvy(w).length; }), hasPn = WORKS.some(function (w) { return w.panorama; });
    $("legend").innerHTML = '<span><i></i>есть работы</span>' + (hasRv ? '<span><i class="rv"></i>отзывы внутри</span>' : "") + (hasPn ? '<span><i class="pn"></i>есть обзор</span>' : "");
    $("fUpd").textContent = D.obnovleno ? "Сайт обновлён " + day(D.obnovleno) + "." : "";
    if (STAFF) {
      $("staff").hidden = false;
      $("staffNote").innerHTML = DRAFT ? "<b>Черновик</b> из Мастерской - так увидит клиент после публикации." :
        D.shablon ? "<b>Вариант 4, путешествие по дому.</b> Шаблон: фото нарисованы, тексты - пример. Клиент эту полоску не видит." :
        "<b>Витрина: путешествие по дому.</b> Клиент эту полоску не видит.";
    }
  }

  // ---------- 0. двери ----------
  var SEEN = "vp-byl";
  function seen() { try { return localStorage.getItem(SEEN) === "1"; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN, "1"); } catch (e) {} }
  function openDoors() {
    var d = $("doors");
    if (d.classList.contains("open")) return;
    markSeen();
    // дом виден сразу за створками: "шагаем" внутрь, пока они разъезжаются
    $("home").classList.add("on"); $("home").inert = false; $("home").removeAttribute("aria-hidden");
    restart($("home"), "enter");
    d.classList.add("open");
    setTimeout(function () { show("home", true); d.classList.remove("open"); if (kbd) $("tourBtn").focus({ preventScroll: true }); }, T(1450));
  }
  $("enterBtn").onclick = openDoors;

  // ---------- 1. дом ----------
  var TILES = {};
  function renderHouse() {
    var f = $("floors"); f.innerHTML = ""; TILES = {}; f.classList.toggle("r4", ROWS > 3);
    ROOMS.forEach(function (k) {
      var ws = k.works, b = el("button", "room" + (ws.length ? "" : " empty"));
      b.type = "button";
      b.style.gridColumn = k.col + " / span " + k.span; b.style.gridRow = String(k.row);
      var rv = ws.some(function (w) { return otzyvy(w).length; }), pn = ws.some(function (w) { return w.panorama; });
      b.innerHTML = '<div class="ph"' + (ws.length ? ' style="background-image:url(&quot;' + esc(cover(ws[0])) + '&quot;)"' : "") + '></div><div class="dark"></div><div class="lamp"></div>' +
        (ws.length ? '<div class="tags"><span>' + ws.length + " " + plural(ws.length, ["работа", "работы", "работ"]) + "</span>" + (rv ? '<span class="rv">отзыв</span>' : "") + (pn ? '<span class="pn">обзор</span>' : "") + "</div>" : "") +
        '<div class="t"><b>' + esc(k.nazvanie) + "</b><span>" + esc(ws.length ? (k.hint || "") : "скоро здесь появятся работы") + "</span></div>";
      b.setAttribute("aria-label", k.nazvanie + (ws.length ? ", " + ws.length + " " + plural(ws.length, ["работа", "работы", "работ"]) : ", пока пусто"));
      b.onclick = function () { if (!ws.length) { toast("В этой комнате работы появятся позже"); return; } nav({ s: "room", k: k }); };
      f.appendChild(b); TILES[k.id] = b;
    });
    if (!WORKS.length) { $("tourBtn").hidden = true; $("hintTap").textContent = "Работы скоро появятся"; }
  }
  $("tourBtn").onclick = function () { var k = firstRoom(); if (k) nav({ s: "room", k: k }); };
  $("writeBtn").onclick = function () { openModal(null); };
  // на телефоне нет наведения: свет включается в комнате, которая сейчас посередине экрана
  var touch = window.matchMedia && matchMedia("(hover: none)").matches;
  function litByScroll() {
    if (!touch || cur !== "home") return;
    var mid = innerHeight * 0.5, best = null, bd = 1e9;
    ROOMS.forEach(function (k) { if (!k.works.length) return; var r = TILES[k.id].getBoundingClientRect(); var d = Math.abs((r.top + r.bottom) / 2 - mid); if (r.bottom > 0 && r.top < innerHeight && d < bd) { bd = d; best = k.id; } });
    ROOMS.forEach(function (k) { TILES[k.id].classList.toggle("lit", k.id === best); });
  }
  var litT = 0;
  $("home").addEventListener("scroll", function () { if (!litT) litT = requestAnimationFrame(function () { litT = 0; litByScroll(); }); }, { passive: true });

  // влёт: плитка растёт на весь экран, фото на ходу светлеет
  function coverBox(sz, x, y, w, h) { var s = Math.max(w / sz.w, h / sz.h); return { s: s, x: x + (w - sz.w * s) / 2, y: y + (h - sz.h * s) / 2 }; }
  function insetOf(r) { return "inset(" + r.top + "px " + (innerWidth - r.right) + "px " + (innerHeight - r.bottom) + "px " + r.left + "px round 4px)"; }
  function makeFly(src, sz) {
    var f = el("div", "fly"), im = new Image(); im.src = src; im.alt = ""; im.style.width = sz.w + "px"; im.style.height = sz.h + "px";
    f.appendChild(im); f.appendChild(el("i")); document.body.appendChild(f); return f;
  }
  function flyInto(k, done) {
    var tile = TILES[k.id], src = cover(k.works[0]);
    loadImg(src, function (sz) {
      if (reduce || !tile || !tile.animate) { done(); return; }
      var r = tile.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) { done(); return; }
      // плитка под светом чуть приближена (scale 1.1) - начинаем ровно с того кадра, что виден в окне
      var a = coverBox(sz, r.left - r.width * .05, r.top - r.height * .05, r.width * 1.1, r.height * 1.1);
      var b = coverBox(sz, 0, 0, innerWidth, innerHeight);
      var f = makeFly(src, sz), im = f.firstChild, dk = f.lastChild, dur = 900;
      f.animate([{ clipPath: insetOf(r) }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: dur, easing: SWIFT, fill: "forwards" });
      im.animate([{ transform: "translate(" + a.x + "px," + a.y + "px) scale(" + a.s + ")" }, { transform: "translate(" + b.x + "px," + b.y + "px) scale(" + b.s + ")" }], { duration: dur, easing: SWIFT, fill: "forwards" });
      dk.animate([{ opacity: .1 }, { opacity: 0 }], { duration: dur, easing: SWIFT, fill: "forwards" }).onfinish = function () {
        done();
        f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 550, easing: EASE, fill: "forwards" }).onfinish = function () { f.remove(); };
      };
    });
  }
  // обратно: комната сжимается в свою плитку на доме, свет гаснет
  function flyOut(k, done) {
    var src = cover(k.works[0]);
    loadImg(src, function (sz) {
      var tile = TILES[k.id];
      done();
      if (reduce || !tile || !tile.animate) return;
      var hm = $("home"), r0 = tile.getBoundingClientRect();
      if (r0.top < 0 || r0.bottom > innerHeight) hm.scrollTop += r0.top - (innerHeight - r0.height) / 2;
      var r = tile.getBoundingClientRect();
      var a = coverBox(sz, 0, 0, innerWidth, innerHeight), b = coverBox(sz, r.left, r.top, r.width, r.height);
      var f = makeFly(src, sz), im = f.firstChild, dk = f.lastChild, dur = 750;
      f.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: insetOf(r) }], { duration: dur, easing: SWIFT, fill: "forwards" });
      im.animate([{ transform: "translate(" + a.x + "px," + a.y + "px) scale(" + a.s + ")" }, { transform: "translate(" + b.x + "px," + b.y + "px) scale(" + b.s + ")" }], { duration: dur, easing: SWIFT, fill: "forwards" });
      dk.animate([{ opacity: .7 }, { opacity: .62 }], { duration: dur, easing: SWIFT, fill: "forwards" }).onfinish = function () {
        f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).onfinish = function () { f.remove(); };
      };
    });
  }

  // ---------- мини-карта и крошки ----------
  function mini(box) {
    box.innerHTML = "";
    var here = S.work ? S.work._k : S.room;
    box.style.gridTemplateRows = "repeat(" + ROWS + "," + (ROWS > 3 ? 11 : 15) + "px)";
    ROOMS.forEach(function (k) {
      var b = el("button", k === here ? "on" : (k.works.length ? "has" : ""));
      b.type = "button"; b.style.gridColumn = k.col + " / span " + k.span; b.style.gridRow = String(k.row);
      b.setAttribute("aria-label", k.nazvanie + (k === here ? " - вы здесь" : k.works.length ? "" : " - пока пусто"));
      b.title = k.nazvanie;
      b.onclick = function () { if (!k.works.length) { toast(k.nazvanie + ": работы появятся позже"); return; } if (k === here && cur === "room") return; nav({ s: "room", k: k }); };
      box.appendChild(b);
    });
  }
  function crumbs(box, lvl) {
    var k = lvl > 1 ? S.work._k : S.room;
    box.innerHTML = "";
    var home = el("button", "", "Весь дом"); home.type = "button"; home.onclick = function () { nav({ s: "home" }); }; box.appendChild(home);
    if (lvl > 1) { var rb = el("button", "", esc(k.nazvanie)); rb.type = "button"; rb.onclick = function () { nav({ s: "room", k: k }); }; box.appendChild(rb); }
    box.appendChild(el("span", "", esc(lvl > 1 ? S.work.nazvanie : k.nazvanie)));
  }

  // ---------- 2. комната: 3D-лента ----------
  var deckP = 0, deckT = 0, deckEls = [], deckN = 0, deckList = [], deckRaf = 0, deckLast = 0, deckCenter = -1;
  function renderRoom(k, idx, sweep) {
    S.room = k; S.work = null;
    var ws = k.works;
    $("roomTitle").textContent = k.nazvanie;
    $("roomSub").textContent = ws.length + " " + plural(ws.length, ["работа", "работы", "работ"]) + " - листайте и открывайте";
    var d = $("deck"); d.innerHTML = ""; deckEls = [];
    deckList = ws.map(function (w) { return { w: w }; });
    if (ws.length < 3) {
      deckList.push({ ph: "Здесь будет следующая работа", sub: "Портфолио пополняется" });
      if (ws.length < 2) deckList.push({ ph: "И ещё одна", sub: "Мастер добавит её после сдачи заказа" });
    }
    deckList.forEach(function (it, i) {
      var c;
      if (it.w) {
        var w = it.w, f0 = fotos(w)[0], nt = (w.tochki || []).length, nf = (w.foto || []).length, rv = otzyvy(w).length;
        c = el("button", "wcard");
        c.type = "button";
        c.innerHTML = '<img src="' + esc(cover(w)) + '" alt="" draggable="false" decoding="async">' + wmHTML(f0) + '<i class="shade"></i>' +
          '<div class="tag">' + (nf > 1 ? "<span>" + nf + " фото</span>" : "") + (nt ? "<span>" + nt + " " + plural(nt, ["деталь", "детали", "деталей"]) + "</span>" : "") + (rv ? "<span>отзыв</span>" : "") + "</div>" +
          '<div class="meta"><b>' + esc(w.nazvanie) + "</b><span>" + esc(w.gde || "") + '</span></div><span class="open">' + IC.open + "</span>";
        c.setAttribute("aria-label", w.nazvanie);
        c.addEventListener("click", function (e) { if (e.detail === 0) deckAct(i); });
        c.addEventListener("focus", function () { if (kbd && Math.round(deckT) !== i) { deckT = i; kick(); } });
      } else {
        c = el("div", "wcard ph", "<div><b>" + esc(it.ph) + '</b><span style="font-size:13px">' + esc(it.sub) + "</span></div>");
        c.setAttribute("aria-hidden", "true");
      }
      d.appendChild(c); deckEls.push(c);
    });
    deckN = deckList.length;
    deckT = Math.max(0, Math.min(ws.length - 1, idx || 0));
    deckP = sweep && !reduce ? deckT - 1.6 : deckT;
    deckCenter = -1;
    $("dots").innerHTML = deckList.map(function () { return "<i></i>"; }).join("");
    crumbs($("crumbsR"), 1); mini($("miniR"));
    deckRender(); kick();
  }
  function setRoomBg(src) {
    var a = $("roomBgA"), b = $("roomBgB"), on = a.classList.contains("on") ? a : b.classList.contains("on") ? b : null, off = on === a ? b : a;
    if (on && on._src === src) return;
    off._src = src; off.style.backgroundImage = 'url("' + src.replace(/"/g, "%22") + '")';
    off.classList.add("on"); if (on) on.classList.remove("on");
  }
  function deckRender() {
    deckEls.forEach(function (c, i) {
      var d = i - deckP, ad = Math.abs(d);
      c.style.transform = "translateX(" + (-50 + d * 68) + "%) translateZ(" + (-ad * 220) + "px) rotateY(" + Math.max(-50, Math.min(50, -d * 32)) + "deg)";
      c.style.opacity = ad < 1.4 ? 1 : Math.max(0, 1 - (ad - 1.4) / 1);
      c.style.zIndex = 100 - Math.round(ad * 10);
      c.style.visibility = ad > 2.6 ? "hidden" : "visible";
      var sh = c.querySelector(".shade"); if (sh) sh.style.opacity = Math.min(ad, 2) * .3;
      c.classList.toggle("center", ad < .3);
      if (c.tagName === "BUTTON") c.tabIndex = Math.round(deckT) === i ? 0 : -1;
    });
    var ci = Math.max(0, Math.min(deckN - 1, Math.round(deckP)));
    [].forEach.call($("dots").children, function (e, i) { e.classList.toggle("on", i === ci); });
    if (ci !== deckCenter) {
      deckCenter = ci;
      var it = deckList[ci];
      if (it && it.w) { setRoomBg(cover(it.w)); $("deckLive").textContent = it.w.nazvanie + ", " + (ci + 1) + " из " + S.room.works.length; }
    }
  }
  function kick() { if (!deckRaf) { deckLast = performance.now(); deckRaf = requestAnimationFrame(deckFrame); } }
  function deckFrame(now) {
    deckRaf = 0;
    var dt = Math.min(64, now - deckLast); deckLast = now;
    if (!deckDrag) {
      var k = reduce ? 1 : 1 - Math.pow(1 - 0.13, dt / 16.7);
      deckP += (deckT - deckP) * k;
      if (Math.abs(deckT - deckP) < 0.0015) deckP = deckT;
    }
    deckRender();
    if (cur === "room" && (deckDrag || deckP !== deckT)) deckRaf = requestAnimationFrame(deckFrame);
  }
  function deckGo(i) { deckT = Math.max(0, Math.min(deckN - 1, i)); kick(); }
  function deckAct(i) {
    var it = deckList[i]; if (!it) return;
    if (!it.w) { deckGo(i); return; }
    if (Math.round(deckT) === i && Math.abs(deckP - i) < .35) nav({ s: "work", w: it.w });
    else deckGo(i);
  }
  var deckDrag = false, dSX = 0, dSP = 0, dMoved = false, dV = 0, dLX = 0, dLT = 0, dDown = null, dId = null;
  $("deck").addEventListener("pointerdown", function (e) {
    if (e.button > 0) return;
    deckDrag = true; dMoved = false; dSX = dLX = e.clientX; dSP = deckP; dV = 0; dLT = performance.now(); dDown = e.target; dId = e.pointerId;
    kick();
  });
  addEventListener("pointermove", function (e) {
    if (!deckDrag || e.pointerId !== dId) return;
    var dx = e.clientX - dSX;
    if (!dMoved && Math.abs(dx) > 7) { dMoved = true; $("deck").classList.add("drag"); try { $("deck").setPointerCapture(dId); } catch (er) {} }
    if (!dMoved) return;
    var now = performance.now(); dV = (e.clientX - dLX) / Math.max(1, now - dLT); dLX = e.clientX; dLT = now;
    var w = Math.min(innerWidth * .6, 320);
    deckP = deckT = Math.max(-.4, Math.min(deckN - .6, dSP - dx / w));
  });
  function deckUp(e) {
    if (!deckDrag || (e && e.pointerId !== dId)) return;
    deckDrag = false; $("deck").classList.remove("drag");
    if (dMoved) { var fl = performance.now() - dLT > 90 ? 0 : dV; deckGo(Math.round(deckP - fl * 1.6)); }
    else if (e && e.type === "pointerup") { var c = dDown && dDown.closest ? dDown.closest(".wcard") : null; var i = deckEls.indexOf(c); if (i >= 0) deckAct(i); kick(); }
  }
  addEventListener("pointerup", deckUp); addEventListener("pointercancel", deckUp);
  var wheelAcc = 0, wheelT = 0;
  $("deck").addEventListener("wheel", function (e) {
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    e.preventDefault();
    var now = performance.now(); if (now - wheelT > 260) wheelAcc = 0;
    wheelAcc += d;
    if (Math.abs(wheelAcc) > 50 && now - wheelT > 260) { deckGo(Math.round(deckT) + (wheelAcc > 0 ? 1 : -1)); wheelAcc = 0; wheelT = now; }
  }, { passive: false });
  $("dPrev").onclick = function () { deckGo(Math.round(deckT) - 1); };
  $("dNext").onclick = function () { deckGo(Math.round(deckT) + 1); };
  $("roomBack").onclick = function () { up(); };

  // ---------- 3. работа: сцена, точки, наезд ----------
  var st = { s: 1, x: 0, y: 0, base: 1, iw: 1200, ih: 900 }, note = -1, pano = false, tw = null, glide = null, wRaf = 0;
  var stage = $("stage"), wImg = $("wImg");
  function pts() { var w = S.work; if (!w) return []; return S.foto === 0 ? (w.tochki || []) : ((fotos(w)[S.foto] || {}).tochki || []); }
  function clampSt(o) {
    var W = innerWidth, H = innerHeight, w = st.iw * o.s, h = st.ih * o.s;
    o.x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, o.x));
    o.y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, o.y));
    return o;
  }
  function applySt() {
    var tilt = 0;
    if (pano) { var W = innerWidth, w = st.iw * st.s; tilt = w > W ? ((st.x - (W - w) / 2) / ((w - W) / 2)) * -9 : 0; }
    stage.style.transform = (tilt ? "perspective(1400px) rotateY(" + tilt.toFixed(2) + "deg) " : "") + "translate(" + st.x + "px," + st.y + "px) scale(" + st.s + ")";
    var P = pts();
    [].forEach.call($("spots").children, function (b, i) {
      var t = P[i]; if (!t) return;
      b.style.transform = "translate(" + (st.x + st.iw * st.s * t.x / 100) + "px," + (st.y + st.ih * st.s * t.y / 100) + "px)";
    });
  }
  function wKick() { if (!wRaf) wRaf = requestAnimationFrame(wFrame); }
  function wFrame(now) {
    wRaf = 0;
    if (tw) {
      var p = tw.dur ? Math.min(1, (now - tw.t0) / tw.dur) : 1, e = tw.ease(p);
      st.s = tw.a.s + (tw.b.s - tw.a.s) * e; st.x = tw.a.x + (tw.b.x - tw.a.x) * e; st.y = tw.a.y + (tw.b.y - tw.a.y) * e;
      if (p >= 1) { var cb = tw.done; tw = null; if (cb) cb(); }
    } else if (glide) {
      glide.vx *= 0.92; glide.vy *= 0.92;
      var o = clampSt({ s: st.s, x: st.x + glide.vx * 16, y: st.y + glide.vy * 16 });
      if (o.x !== st.x + glide.vx * 16) glide.vx = 0; if (o.y !== st.y + glide.vy * 16) glide.vy = 0;
      st.x = o.x; st.y = o.y;
      if (Math.abs(glide.vx) + Math.abs(glide.vy) < 0.02) glide = null;
    }
    applySt();
    if (tw || glide) wKick();
  }
  function animTo(o, dur, ease, done, noClamp) {
    glide = null;
    var b = noClamp ? o : clampSt({ s: o.s, x: o.x, y: o.y });
    if (!dur || reduce) { st.s = b.s; st.x = b.x; st.y = b.y; tw = null; applySt(); if (done) done(); return; }
    tw = { t0: performance.now(), dur: dur, a: { s: st.s, x: st.x, y: st.y }, b: b, ease: ease || eEase, done: done };
    wKick();
  }
  function restSt() { var W = innerWidth, H = innerHeight; st.base = Math.max(W / st.iw, H / st.ih) * (pano ? 1.35 : 1); return clampSt({ s: st.base, x: (W - st.iw * st.base) / 2, y: (H - st.ih * st.base) / 2 }); }
  function setFotoImg(f, cb) {
    var src = srcOf(f);
    loadImg(src, function (sz) {
      st.iw = sz.w; st.ih = sz.h;
      stage.style.width = sz.w + "px"; stage.style.height = sz.h + "px";
      wImg.src = src; wImg.alt = (f && f.podpis) || (S.work && S.work.nazvanie) || "";
      var wm = $("wWm"); wm.style.backgroundImage = WM && !(f && f.znak) ? WM : "none";
      wm.style.backgroundSize = (420 / Math.max(.3, Math.max(innerWidth / sz.w, innerHeight / sz.h))) + "px auto";
      cb && cb(sz);
    });
  }
  function renderSpots() {
    var sp = $("spots"); sp.innerHTML = ""; $("sDetails").innerHTML = "";
    var P = pts();
    P.forEach(function (t, i) {
      var b = el("button", "spot", "<i></i>" + IC.plus); b.type = "button"; b.setAttribute("aria-label", "Деталь: " + t.nazvanie);
      b.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      b.onclick = function (e) { e.stopPropagation(); focusSpot(i); };
      sp.appendChild(b);
      var d = el("button", "", "<i>" + (i + 1) + "</i>" + esc(t.nazvanie)); d.type = "button"; d.onclick = function () { focusSpot(i); };
      $("sDetails").appendChild(d);
    });
    $("sDetWrap").hidden = !P.length;
    sp.classList.toggle("off", pano);
  }
  function renderSheet(w) {
    $("sheetSc").scrollTop = 0;
    $("sVid").textContent = w._k.nazvanie;
    $("sTitle").textContent = w.nazvanie;
    $("sChips").innerHTML = [w.gde, w.material, w.srok ? "Срок: " + w.srok : ""].filter(Boolean).map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("");
    $("sStory").textContent = w.rasskaz || ""; $("sStoryWrap").hidden = !w.rasskaz;
    var rs = w.resheniya || [];
    $("sSol").innerHTML = rs.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join(""); $("sSolWrap").hidden = !rs.length;
    var ov = otzyvy(w);
    $("sRevWrap").hidden = !ov.length;
    $("sRev").innerHTML = ov.map(function (o) {
      var n = Math.max(1, Math.min(5, Math.round(+o.ocenka || 5)));
      return '<div class="review"><q>' + esc(o.tekst) + '</q><div class="by"><span><b>' + esc(o.imya || "") + '</b> <span class="st" aria-label="Оценка ' + n + ' из 5">' + "★★★★★".slice(0, n) + "</span></span>" + (o.kod && o.zakaz ? '<span class="ok">по заказу ' + esc(o.zakaz) + "</span>" : "") + "</div></div>";
    }).join("");
    var F = w.foto || [];
    $("sFotoWrap").hidden = F.length < 2;
    $("sThumbs").innerHTML = F.length < 2 ? "" : F.map(function (f, i) { return '<button type="button" data-foto="' + i + '" aria-label="Фото ' + (i + 1) + (f && f.podpis ? ": " + esc(f.podpis) : "") + '"><img src="' + esc(srcOf(f)) + '" alt="" loading="lazy" draggable="false"></button>'; }).join("");
    markThumbs();
  }
  function markThumbs() {
    [].forEach.call($("sThumbs").children, function (b, i) { b.classList.toggle("on", i === S.foto); });
    var f = fotos(S.work)[S.foto];
    $("sCap").textContent = (S.work.foto || []).length > 1 ? "Фото " + (S.foto + 1) + " из " + S.work.foto.length + (f && f.podpis ? ": " + f.podpis : "") : "";
  }
  $("sThumbs").addEventListener("click", function (e) { var b = e.target.closest("[data-foto]"); if (b) showFoto(+b.getAttribute("data-foto")); });
  function showFoto(i) {
    var F = fotos(S.work); i = (i + F.length) % F.length; if (i === S.foto) return;
    closeNote(true);
    stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(220), fill: "forwards" }).onfinish = function (ev) {
      S.foto = i;
      setFotoImg(F[i], function () {
        var r = restSt(); st.s = r.s; st.x = r.x; st.y = r.y; renderSpots(); applySt(); markThumbs();
        stage.getAnimations().forEach(function (a) { a.cancel(); });
        stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(420), easing: EASE });
      });
    };
  }
  function sheetVisible() { return !$("sheet").classList.contains("hide") && !pano; }
  function focusSpot(i) {
    var t = pts()[i]; if (!t) return;
    if (note === i) { closeNote(); return; }
    note = i;
    $("noteT").textContent = t.nazvanie; $("noteD").textContent = t.tekst || "";
    $("note").classList.add("on");
    [].forEach.call($("spots").children, function (b, j) { b.classList.toggle("on", j === i); });
    [].forEach.call($("sDetails").children, function (b, j) { b.classList.toggle("on", j === i); });
    var W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2, sr = $("sheet").getBoundingClientRect(), wide = W > 860;
    if (sheetVisible()) { if (wide) cx = sr.left / 2; else { var nb = $("note").getBoundingClientRect().bottom; cy = (nb + sr.top) / 2; } }
    else if (!wide) { cy = ($("note").getBoundingClientRect().bottom + H) / 2; }
    var s = st.base * 2.1;
    animTo({ s: s, x: cx - st.iw * s * t.x / 100, y: cy - st.ih * s * t.y / 100 }, 900, eEase);
    $("dragHint").classList.add("gone");
  }
  function closeNote(quiet) {
    if (note < 0 && !$("note").classList.contains("on")) return;
    note = -1; $("note").classList.remove("on");
    [].forEach.call($("spots").children, function (b) { b.classList.remove("on"); });
    [].forEach.call($("sDetails").children, function (b) { b.classList.remove("on"); });
    if (cur === "work" && !quiet) animTo(restSt(), 800, eEase);
  }
  $("noteX").onclick = function () { closeNote(); };

  // перетаскивание = осмотреться (с инерцией и упором в края)
  var pd = null;
  $("area").addEventListener("pointerdown", function (e) {
    if (e.button > 0 || cur !== "work") return;
    pd = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y, m: false, id: e.pointerId, lt: performance.now(), vx: 0, vy: 0 };
    tw = null; glide = null;
    try { $("area").setPointerCapture(e.pointerId); } catch (er) {}
  });
  $("area").addEventListener("pointermove", function (e) {
    if (!pd || e.pointerId !== pd.id) return;
    var dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (!pd.m && Math.abs(dx) + Math.abs(dy) > 6) { pd.m = true; $("work").classList.add("dragging"); $("dragHint").classList.add("gone"); }
    if (!pd.m) return;
    var now = performance.now(), o = clampSt({ s: st.s, x: pd.sx + dx, y: pd.sy + dy }), dtt = Math.max(1, now - pd.lt);
    pd.vx = (o.x - st.x) / dtt; pd.vy = (o.y - st.y) / dtt; pd.lt = now;
    st.x = o.x; st.y = o.y; applySt();
  });
  function areaUp(e) {
    if (!pd || e.pointerId !== pd.id) return;
    var p = pd; pd = null; $("work").classList.remove("dragging");
    if (p.m) { if (!reduce && performance.now() - p.lt < 90) { glide = { vx: p.vx, vy: p.vy }; wKick(); } }
    else if (e.type === "pointerup" && note >= 0) closeNote();
  }
  $("area").addEventListener("pointerup", areaUp); $("area").addEventListener("pointercancel", areaUp);
  addEventListener("resize", function () {
    if (cur === "work") { var r = restSt(); tw = null; st.s = r.s; st.x = r.x; st.y = r.y; if (note >= 0) { var n = note; note = -1; focusSpot(n); } else applySt(); }
    if (cur === "room") deckRender();
  });

  function fillWork(w) {
    S.work = w; S.room = w._k; S.foto = 0; note = -1; pano = false;
    $("work").classList.remove("pano"); $("note").classList.remove("on");
    renderSheet(w); renderSpots(); crumbs($("crumbsW"), 2); mini($("miniW"));
    $("wantBtn").textContent = "Хочу так же";
  }
  // открыть работу: из карточки ленты (разворот рамки на весь экран) или просто проявлением
  function openWork(w, fromCard, done) {
    fillWork(w);
    setFotoImg(fotos(w)[0], function (sz) {
      var r = restSt();
      if (fromCard && !reduce && $("work").animate) {
        var c = fromCard.getBoundingClientRect(), a = coverBox(sz, c.left, c.top, c.width, c.height);
        st.s = a.s; st.x = a.x; st.y = a.y; st.base = r.s; applySt();
        $("spots").style.opacity = 0;
        show("work", true);
        $("work").animate([{ clipPath: "inset(" + c.top + "px " + (innerWidth - c.right) + "px " + (innerHeight - c.bottom) + "px " + c.left + "px round 22px)" }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 800, easing: SWIFT });
        [].forEach.call(document.querySelectorAll("#work .fade-ui"), function (e) { e.animate([{ opacity: 0 }, { opacity: 0, offset: .45 }, { opacity: 1 }], { duration: 900, easing: EASE }); });
        animTo(r, 800, eSwift, function () { $("spots").style.opacity = ""; $("spots").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); done && done(); }, true);
      } else {
        st.s = r.s; st.x = r.x; st.y = r.y; applySt();
        show("work");
        stage.animate([{ opacity: 0, transform: stage.style.transform + " scale(1.04)" }, { opacity: 1, transform: stage.style.transform }], { duration: T(700), easing: EASE });
        done && done();
      }
    });
  }
  // назад в комнату: кадр сжимается обратно в свою карточку
  function closeWorkToRoom(k, done) {
    var w = S.work, i = k.works.indexOf(w);
    renderRoom(k, i < 0 ? 0 : i, false);
    var card = i >= 0 ? deckEls[i] : null;
    closeNote(true);
    if (!card || reduce || !$("work").animate) { show("room"); done && done(); return; }
    // комната уже под кадром, а кадр сворачивается в карточку
    $("room").classList.add("inst"); $("room").classList.add("on"); $("room").inert = false; $("room").removeAttribute("aria-hidden");
    var c = card.getBoundingClientRect(), a = coverBox({ w: st.iw, h: st.ih }, c.left, c.top, c.width, c.height);
    $("work").classList.add("closing");
    $("spots").style.opacity = 0;
    var an = $("work").animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: "inset(" + c.top + "px " + (innerWidth - c.right) + "px " + (innerHeight - c.bottom) + "px " + c.left + "px round 22px)" }], { duration: 700, easing: SWIFT, fill: "forwards" });
    animTo(a, 700, eSwift, null, true);
    an.onfinish = function () {
      show("room", true); an.cancel(); $("work").classList.remove("closing"); $("spots").style.opacity = "";
      done && done();
    };
  }
  function switchWork(w, dir) {
    closeNote(true);
    var sg = stage;
    sg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(260), fill: "forwards" }).onfinish = function () {
      fillWork(w);
      setFotoImg(fotos(w)[0], function () {
        var r = restSt(); st.s = r.s; st.x = r.x; st.y = r.y; applySt();
        sg.getAnimations().forEach(function (a) { a.cancel(); });
        var dx = (dir || 1) * 40;
        sg.animate([{ opacity: 0, transform: "translateX(" + dx + "px) " + sg.style.transform }, { opacity: 1, transform: sg.style.transform }], { duration: T(520), easing: EASE });
        $("sheetSc").animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(400) });
      });
    };
  }
  function stepWork(dir) { if (!S.work || WORKS.length < 2) return; var i = WORKS.indexOf(S.work); nav({ s: "work", w: WORKS[(i + dir + WORKS.length) % WORKS.length] }, { dir: dir }); }
  $("wNext").onclick = function () { stepWork(1); };
  $("wPrev").onclick = function () { stepWork(-1); };
  $("workBack").onclick = function () { up(); };
  function setSheet(hide) {
    $("sheet").classList.toggle("hide", hide); $("workUi").classList.toggle("full", hide);
    $("sheetTg").setAttribute("aria-pressed", hide ? "true" : "false");
    $("sheetTg").setAttribute("aria-label", hide ? "Показать описание" : "Скрыть описание");
  }
  $("sheetTg").onclick = function () { setSheet(!$("sheet").classList.contains("hide")); if (note >= 0) { var n = note; note = -1; setTimeout(function () { focusSpot(n); }, 30); } };

  // обзор: пока демо на обычном фото (честно подписано). Настоящие панорамы 360 - следующий шаг.
  function setPano(on) {
    var d = $("dive");
    closeNote(true);
    if (!reduce) restart(d, "go");
    setTimeout(function () {
      pano = on; $("work").classList.toggle("pano", on); $("spots").classList.toggle("off", on);
      var r = restSt(); st.s = r.s; st.x = r.x; st.y = r.y; applySt();
      if (on && kbd) $("exitPano").focus({ preventScroll: true });
    }, T(450));
  }
  $("panoBtn").onclick = function () { setPano(true); };
  $("exitPano").onclick = function () { setPano(false); };

  // ---------- "Хочу так же" ----------
  var lastFocus = null;
  function openModal(w) {
    var t = "Здравствуйте! Посмотрел(а) вашу витрину.";
    if (w) {
      t += '\nХочу так же, как в работе "' + w.nazvanie + '".';
      if (note >= 0 && pts()[note]) t += "\nОсобенно понравилось: " + pts()[note].nazvanie.toLowerCase() + ".";
      t += "\nСсылка: " + location.origin + location.pathname + "#rabota=" + encodeURIComponent(w.id);
    }
    t += "\nМой город: ...\nПримерные размеры: ...";
    $("mT").textContent = w ? "Хочу так же" : "Написать мастеру";
    $("mMsg").textContent = t;
    var wa = waUrl(t);
    $("mWa").href = wa || "#"; $("mWa").hidden = !wa;
    $("mTg").hidden = !tgUrl();
    $("mTg").onclick = function () {
      var go = function () { window.open(tgUrl(), "_blank", "noopener"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast("Текст скопирован - вставьте его в чат"); setTimeout(go, 600); }, go);
      else go();
    };
    // быстрый расчёт - в витрине варианта 3 (та же страница данных)
    $("mCalc").href = "../#raschet";
    $("mCalc").hidden = !((D.raschet && D.raschet.izdeliya) || []).length; // цен ещё нет - кнопку не показываем
    lastFocus = document.activeElement;
    $("modal").classList.add("on");
    setTimeout(function () { (wa ? $("mWa") : $("mX")).focus({ preventScroll: true }); }, 60);
  }
  function closeModal() { if (!$("modal").classList.contains("on")) return false; $("modal").classList.remove("on"); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); return true; }
  $("wantBtn").onclick = function () { openModal(S.work); };
  $("mX").onclick = closeModal;
  $("modal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
  $("modal").addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var f = [].filter.call(this.querySelectorAll("a[href],button"), function (x) { return !x.hidden && x.offsetParent; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  // ---------- навигация: история = путь по дому ----------
  // Уровень 0 - дом, 1 - комната, 2 - работа. В истории браузера всегда лежит ровно этот путь,
  // поэтому "назад" (кнопка браузера, стрелка, Esc) поднимает на уровень выше.
  function lvl(t) { return t.s === "work" ? 2 : t.s === "room" ? 1 : 0; }
  function hashOf(t) { return t.s === "work" ? "#rabota=" + encodeURIComponent(t.w.id) : t.s === "room" ? "#komnata=" + encodeURIComponent(t.k.id) : ""; }
  function urlOf(t) { return location.pathname + location.search + hashOf(t); }
  function parse(h) {
    var m; try { h = decodeURIComponent(h || ""); } catch (e) {}
    if ((m = /^#rabota=(.+)$/.exec(h)) && BYID[m[1]]) return { s: "work", w: BYID[m[1]] };
    if ((m = /^#komnata=(.+)$/.exec(h)) && ROOMBY[m[1]] && ROOMBY[m[1]].works.length) return { s: "room", k: ROOMBY[m[1]] };
    return { s: "home" };
  }
  function curLvl() { return cur === "work" ? 2 : cur === "room" ? 1 : 0; }
  var PENDING = null, BUSY = false, QUEUE = null;
  function nav(t, o) {
    var L = lvl(t), C = (history.state && typeof history.state.vp === "number") ? history.state.vp : curLvl();
    if (L > C) {
      if (L === 2 && C === 0) history.pushState({ vp: 1 }, "", urlOf({ s: "room", k: t.w._k }));
      history.pushState({ vp: L }, "", urlOf(t));
      go(t, o);
    } else if (L === C) { history.replaceState({ vp: L }, "", urlOf(t)); go(t, o); }
    else { PENDING = { t: t, o: o }; history.go(L - C); }
  }
  function up() {
    if (cur === "work") nav({ s: "room", k: S.work._k });
    else if (cur === "room") nav({ s: "home" });
  }
  addEventListener("popstate", function (e) {
    var t, o = {};
    if (PENDING) { t = PENDING.t; o = PENDING.o || {}; PENDING = null; history.replaceState({ vp: lvl(t) }, "", urlOf(t)); }
    else {
      t = parse(location.hash);
      // шаг назад из работы - в комнату этой работы (даже если по пути листали работы других комнат)
      if (t.s === "room" && cur === "work" && S.work && S.work._k !== t.k) { t = { s: "room", k: S.work._k }; history.replaceState({ vp: 1 }, "", urlOf(t)); }
      else if (!e.state || typeof e.state.vp !== "number") history.replaceState({ vp: lvl(t) }, "", urlOf(t));
    }
    go(t, o);
  });
  // переходы между экранами (во время анимации следующий шаг ждёт её конца)
  function go(t, o) {
    if (BUSY) { QUEUE = [t, o]; return; }
    o = o || {};
    closeModal();
    var fin = function () {
      BUSY = false;
      if (kbd) { var f = cur === "room" ? deckEls[Math.round(deckT)] : cur === "work" ? $("workBack") : null; if (f && f.focus) f.focus({ preventScroll: true }); }
      if (QUEUE) { var q = QUEUE; QUEUE = null; go(q[0], q[1]); }
    };
    BUSY = true;
    if (t.s === "home") {
      closeNote(true);
      if (cur === "home") return fin();
      if (cur === "room" && S.room) { var k = S.room; flyOut(k, function () { show("home", true); litByScroll(); }); setTimeout(fin, T(760)); }
      else { show("home"); litByScroll(); fin(); }
    } else if (t.s === "room") {
      if (cur === "home") {
        flyInto(t.k, function () { renderRoom(t.k, 0, true); show("room", true); restart($("room"), "enter"); fin(); });
      } else if (cur === "work" && S.work && S.work._k === t.k) {
        closeWorkToRoom(t.k, fin);
      } else if (cur === "room" && S.room === t.k) { fin(); }
      else {
        renderRoom(t.k, 0, true); show("room"); restart($("room"), "enter"); fin();
      }
    } else if (t.s === "work") {
      if (cur === "work" && S.work === t.w) return fin();
      if (cur === "work") { switchWork(t.w, o.dir); setTimeout(fin, T(300)); }
      else if (cur === "room" && deckList[Math.round(deckT)] && deckList[Math.round(deckT)].w === t.w) openWork(t.w, deckEls[Math.round(deckT)], fin);
      else openWork(t.w, null, fin);
    } else fin();
  }

  // ---------- клавиатура ----------
  addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    if (k === "Escape") {
      if (closeModal()) return;
      if (cur === "doors") { openDoors(); return; }
      if (cur === "work" && note >= 0) { closeNote(); return; }
      if (cur === "work" && pano) { setPano(false); return; }
      up(); return;
    }
    if ($("modal").classList.contains("on")) return;
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (cur === "room") {
      if (k === "ArrowRight") { deckGo(Math.round(deckT) + 1); e.preventDefault(); }
      else if (k === "ArrowLeft") { deckGo(Math.round(deckT) - 1); e.preventDefault(); }
      else if ((k === "Enter" || k === " ") && tag !== "BUTTON") { deckAct(Math.round(deckT)); e.preventDefault(); }
    } else if (cur === "work") {
      if (k === "ArrowRight") stepWork(1);
      else if (k === "ArrowLeft") stepWork(-1);
      else if (k === "ArrowDown" && (S.work.foto || []).length > 1 && !e.target.closest(".sheet-sc")) { showFoto(S.foto + 1); e.preventDefault(); }
      else if (k === "ArrowUp" && (S.work.foto || []).length > 1 && !e.target.closest(".sheet-sc")) { showFoto(S.foto - 1); e.preventDefault(); }
    }
  });

  // ---------- черновик из Мастерской ----------
  function loadDraft() {
    if (!DRAFT) return Promise.resolve();
    try { var d = JSON.parse(localStorage.getItem("vt-draft") || "null"); if (d) D = d; } catch (e) {}
    return new Promise(function (ok) {
      if (!window.indexedDB) return ok();
      var rq = indexedDB.open("vt-photos", 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("p"); };
      rq.onerror = function () { ok(); };
      rq.onsuccess = function () {
        try {
          var c = rq.result.transaction("p").objectStore("p").openCursor();
          c.onsuccess = function () { var r = c.result; if (!r) return ok(); PH[r.key] = URL.createObjectURL(r.value); r.continue(); };
          c.onerror = function () { ok(); };
        } catch (e) { ok(); }
      };
    });
  }

  // ---------- запуск ----------
  function start() {
    K = D.kontakty || {};
    WM = makeWM();
    prep(); renderMaster(); renderHouse();
    var t0 = parse(location.hash), st0 = history.state;
    // по ссылке на работу или комнату - сразу туда, без дверей; путь по дому кладём в историю,
    // чтобы "назад" вёл в комнату и дом, а не прочь с сайта
    if (!st0 || typeof st0.vp !== "number") {
      if (t0.s === "work") { history.replaceState({ vp: 0 }, "", urlOf({ s: "home" })); history.pushState({ vp: 1 }, "", urlOf({ s: "room", k: t0.w._k })); history.pushState({ vp: 2 }, "", urlOf(t0)); }
      else if (t0.s === "room") { history.replaceState({ vp: 0 }, "", urlOf({ s: "home" })); history.pushState({ vp: 1 }, "", urlOf(t0)); }
      else history.replaceState({ vp: 0 }, "", urlOf(t0));
    } else if (st0.vp !== lvl(t0)) history.replaceState({ vp: lvl(t0) }, "", urlOf(t0));
    if (t0.s === "work") { renderRoom(t0.w._k, t0.w._k.works.indexOf(t0.w), false); openWork(t0.w, null); markSeen(); }
    else if (t0.s === "room") { renderRoom(t0.k, 0, true); show("room"); restart($("room"), "enter"); markSeen(); }
    else if (!seen() && !DRAFT) { show("doors"); if (!reduce) setTimeout(function () { $("enterBtn").focus({ preventScroll: true }); }, 50); }
    else { show("home"); restart($("home"), "enter"); litByScroll(); }
  }
  loadDraft().then(start);
})();
