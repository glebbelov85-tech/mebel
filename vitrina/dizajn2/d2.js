/* Новые пробные дизайны "Путешествия по дому" (варианты 5-8). Грузится ПЕРЕД puteshestvie.js,
   логику витрины не трогает: только вид, объёмный дом, меню на весь экран, фон (видео) и проявление фото.

   Варианты (window.D2_TEMA): galereya - светлая галерея; kino - видео на фоне (как у Gruppo Euromobil);
   grafit - тёмный, строгий; liniya - дом нарисован тонкими линиями, фото проявляют цвет.
   Данные (необязательные): D.master.logo - знак мастера (svg/png, "foto/..."), D.fon - фон для "Кино":
   { video, video_tel, kadr, kadr_tel } (16:9 для компьютера и 9:16 для телефона). Без видео "Кино" показывает
   медленную смену фото работ.

   Качество под устройство: data-d2q 2 (всё), 1 (без постоянного движения), 0 (без анимаций и видео).
   Сначала считаем по железу и настройкам (экономия трафика, "меньше движения"), потом меряем кадры при входе.
   Весь цикл анимации стоит, когда дом не на экране: в комнате, в работе, при открытом разделе или меню. */
(function () {
  "use strict";
  var H = document.documentElement, B = document.body;
  var $ = function (id) { return document.getElementById(id); };
  var home = $("home"), house = $("house"), roof = $("roof"), floors = $("floors");
  if (!home || !house || !roof || !floors) return;
  var D = window.VITRINA || {}, M = D.master || {}, K = D.kontakty || {};
  var TEMY = { galereya: 1, kino: 1, grafit: 1, liniya: 1 };
  var tema = TEMY[window.D2_TEMA] ? window.D2_TEMA : "galereya";
  H.setAttribute("data-d2", ""); H.setAttribute("data-d2t", tema);

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mm(q) { return window.matchMedia ? matchMedia(q) : { matches: false, addEventListener: function () {} }; }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function url(s) { return !s ? "" : /^(data:|blob:|https?:|\/)/.test(s) ? s : "../" + s; } // как srcOf в puteshestvie.js

  // ---------- качество ----------
  var mqR = mm("(prefers-reduced-motion: reduce)"), FINE = mm("(hover: hover) and (pointer: fine)").matches;
  var cn = navigator.connection || {};
  var Q = (function () {
    var f = (/[?&]kach=(\w+)/.exec(location.search) || [])[1];
    if (f === "max") return 2; if (f === "lite") return 0;
    if (mqR.matches || cn.saveData) return 0;
    var c = navigator.hardwareConcurrency || 4, m = navigator.deviceMemory || 4;
    if (m <= 2 || c <= 2) return 0;
    if (m <= 3 || c <= 4) return 1;
    try { var s = sessionStorage.getItem("d2-q"); if (s != null && s !== "") return Math.min(2, +s); } catch (e) {}
    return 2;
  })();
  function setQ(q) { Q = q; H.setAttribute("data-d2q", q); try { sessionStorage.setItem("d2-q", q); } catch (e) {} }
  H.setAttribute("data-d2q", Q);

  // ---------- знак и название ----------
  var NAME = M.imya || "Мастер";
  var LOGO = null; // готовая разметка svg или <img>
  var brandSlots = [];
  function brand(cls) {
    var b = el("button", "d2-brand" + (cls ? " " + cls : ""), "<i hidden></i><b>" + esc(NAME) + "</b>");
    b.type = "button"; b.setAttribute("aria-label", NAME + " - наверх");
    brandSlots.push(b.firstChild);
    if (LOGO) fillLogo(b.firstChild);
    return b;
  }
  function fillLogo(i) { if (!LOGO) return; i.innerHTML = LOGO; i.hidden = false; }
  function loadLogo(cb) {
    var s = url(M.logo);
    if (!s) return;
    if (/\.(png|jpe?g|webp)(\?|$)/i.test(M.logo) && !/^@/.test(M.logo)) { LOGO = '<img src="' + esc(s) + '" alt="" style="width:100%;height:100%;object-fit:contain">'; cb(); return; }
    fetch(s).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
      if (/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(t)) {
        // свой файл, но на всякий случай без скриптов и обработчиков
        t = t.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<!--[\s\S]*?-->/gi, "").replace(/<(metadata|title|desc|foreignObject)[\s\S]*?<\/\1>/gi, "").replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#").replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");
        LOGO = t.replace(/<svg/i, '<svg aria-hidden="true" focusable="false"');
      } else LOGO = '<img src="' + esc(s) + '" alt="" style="width:100%;height:100%;object-fit:contain">';
      cb();
    }).catch(function () {});
  }

  // шапка: знак + название слева, разделы, "Написать", меню
  var htopIn = home.querySelector(".htop-in");
  var hb = brand();
  hb.onclick = function () { home.scrollTo({ top: 0, behavior: Q ? "smooth" : "auto" }); };
  htopIn.insertBefore(hb, htopIn.firstChild);
  var burger = el("button", "d2-burger", "<i></i>"); burger.type = "button"; burger.setAttribute("aria-label", "Меню"); burger.setAttribute("aria-expanded", "false");
  htopIn.appendChild(burger);

  // вход: знак над названием
  var dui = document.querySelector("#doors .door-ui"), dmark = null;
  if (dui) { dmark = el("div", "d2-dmark"); dmark.hidden = true; dui.insertBefore(dmark, dui.firstChild); }

  // главная: мелкая строка над заголовком
  var h1 = home.querySelector(".hero-t h1");
  if (h1) {
    var city = String(M.gorod || "").split(/\s+и\s+|,/)[0].trim();
    var eye = [M.rol ? String(M.rol).replace(/\s+на заказ$/i, "") : "", city].filter(Boolean).join(" · ");
    if (eye) h1.parentNode.insertBefore(el("span", "d2-eye", esc(eye)), h1);
  }

  loadLogo(function () {
    brandSlots.forEach(fillLogo);
    if (dmark) { dmark.innerHTML = LOGO; dmark.hidden = false; }
  });

  // ---------- меню на весь экран ----------
  var menu = el("div", "d2-menu"); menu.id = "d2menu"; menu.setAttribute("role", "dialog"); menu.setAttribute("aria-modal", "true"); menu.setAttribute("aria-label", "Меню"); menu.inert = true;
  var mtop = el("div", "d2-mtop"), mb = brand(); mtop.appendChild(mb);
  var mx = el("button", "d2-mx", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>'); mx.type = "button"; mx.setAttribute("aria-label", "Закрыть меню");
  mtop.appendChild(mx); menu.appendChild(mtop);
  var mbody = el("div", "d2-mbody"), mnav = el("nav", "d2-mnav"); mnav.setAttribute("aria-label", "Разделы");
  var ITEMS = [["raboty", "Работы"], ["video", "Видео"], ["otzyvy", "Отзывы"], ["master", "О мастере"], ["write", "Написать мастеру"]];
  mbody.appendChild(mnav);
  var side = el("div", "d2-mside"), wa = digits(K.whatsapp), tg = String(K.telegram || "").replace(/^@|^https?:\/\/t\.me\//, ""), tel = digits(K.telefon), vk = String(K.vk || "").trim();
  if (wa) side.innerHTML += '<a class="d2-ln" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">WhatsApp</a>';
  if (tg) side.innerHTML += '<a class="d2-ln" target="_blank" rel="noopener" href="https://t.me/' + esc(tg) + '">Telegram</a>';
  if (tel) side.innerHTML += '<a class="d2-ln" href="tel:+' + tel + '">Позвонить</a>';
  if (vk) side.innerHTML += '<a class="d2-ln" target="_blank" rel="noopener" href="' + esc(/^https?:/.test(vk) ? vk : "https://" + vk) + '">ВКонтакте</a>';
  mbody.appendChild(side);
  var foot = [M.chelovek ? "Мастер - " + M.chelovek : "", M.gorod || ""].filter(Boolean).join(". ");
  if (foot) mbody.appendChild(el("div", "d2-mfoot", esc(foot)));
  menu.appendChild(mbody);
  B.appendChild(menu);
  var MON = false, mFrom = null;
  function drawMenu() {
    var vh = $("tnVideo") && $("tnVideo").hidden;
    mnav.innerHTML = ITEMS.filter(function (x) { return !(x[0] === "video" && vh); }).map(function (x, i) {
      return '<button type="button" data-go="' + x[0] + '" style="--i:' + i + '"><span>' + x[1] + "</span></button>";
    }).join("");
  }
  function openMenu() {
    if (MON) return; drawMenu(); MON = true; mFrom = document.activeElement;
    menu.inert = false; menu.classList.add("on"); burger.setAttribute("aria-expanded", "true");
    setTimeout(function () { if (MON) mx.focus({ preventScroll: true }); }, 60);
    loopCheck();
  }
  function closeMenu(then) {
    if (!MON) return; MON = false;
    menu.classList.remove("on"); menu.inert = true; burger.setAttribute("aria-expanded", "false");
    if (!then && mFrom && mFrom.focus) mFrom.focus({ preventScroll: true });
    if (then) setTimeout(then, Q ? 380 : 0);
    loopCheck();
  }
  burger.onclick = openMenu; mx.onclick = function () { closeMenu(); }; mb.onclick = function () { closeMenu(); };
  mnav.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-go]"); if (!b) return;
    var go = b.getAttribute("data-go");
    closeMenu(function () {
      if (go === "write") { var w = $("writeBtn"); if (w) w.click(); return; }
      var t = $("tnav").querySelector('button[data-p="' + go + '"]'); if (t) t.click();
    });
  });
  addEventListener("keydown", function (e) { if (e.key === "Escape" && MON) { e.stopImmediatePropagation(); closeMenu(); } }, true);

  // ---------- шапка при прокрутке ----------
  var scT = 0;
  home.addEventListener("scroll", function () {
    if (scT) return;
    scT = requestAnimationFrame(function () { scT = 0; home.classList.toggle("d2-sc", home.scrollTop > 8); if (!FINE) kick(); });
  }, { passive: true });

  // ---------- подписи комнат: номер работ рядом с названием ----------
  function decorRooms() {
    [].forEach.call(floors.querySelectorAll(".room"), function (r) {
      var t = r.querySelector(".t"); if (!t || t.querySelector(".d2n")) return;
      var tg = r.querySelector(".tags span"), n = tg ? parseInt(tg.textContent, 10) : 0;
      if (n) t.querySelector("b").insertAdjacentHTML("afterend", '<i class="d2n">' + (n < 10 ? "0" : "") + n + "</i>");
    });
    layout(); build3D();
  }
  new MutationObserver(decorRooms).observe(floors, { childList: true });

  // ---------- другие формы дома (window.D2_DOM, варианты 9-11) ----------
  // razrez - дом в разрезе: ровная сетка одинаковых комнат, в каждой фото висит как картина в раме;
  // okna   - фасад с одинаковыми окнами, фото - за стеклом и чуть сдвигается при повороте (как будто смотришь в комнату);
  // siluet - дом контуром, внутри названия комнат; фото комнаты при наведении (на телефоне - при прокрутке) - на весь фон.
  // Комнаты одного размера, по порядку из dannye.js: на компьютере 4 в ряд, на телефоне 2.
  var DOM = { razrez: 1, okna: 1, siluet: 1 }[window.D2_DOM] ? window.D2_DOM : "";
  if (DOM) H.setAttribute("data-d2dom", DOM);
  var NARROW = mm("(max-width: 640px)");
  function layout() {
    if (!DOM) return;
    var rs = [].slice.call(floors.querySelectorAll(".room")), n = rs.length;
    if (!n) return;
    var cols = NARROW.matches ? 2 : n <= 4 ? n : n % 4 === 0 || n > 9 ? 4 : n % 3 === 0 ? 3 : 4;
    var rem = n % cols, full = n - rem;
    floors.style.gridTemplateColumns = "repeat(" + cols + ",minmax(0,1fr))";
    floors.classList.toggle("r4", Math.ceil(n / cols) > 3);
    rs.forEach(function (r, i) {
      r.style.gridRow = String(Math.floor(i / cols) + 1);
      var span = 1;
      if (rem && i >= full) span = cols % rem === 0 ? cols / rem : (i === n - 1 ? cols - rem + 1 : 1); // неполный последний ряд - без дыр
      r.style.gridColumn = "auto / span " + span;
      r.style.setProperty("--i", i);
    });
  }
  if (NARROW.addEventListener) NARROW.addEventListener("change", function () { layout(); build3D(); });

  // ---------- объёмный дом ----------
  var F = {}; // грани: wl, wr - боковые стены; sl, sr - скаты крыши; gr - тень на земле
  ["gr", "wl", "wr", "sl", "sr"].forEach(function (k) { F[k] = el("i", "d2-f " + k); F[k].setAttribute("aria-hidden", "true"); house.appendChild(F[k]); });
  var GEO = null;
  function px(v) { return Math.round(v * 10) / 10 + "px"; }
  function place(e, l, t, w, h, origin, tr) { var s = e.style; s.left = px(l); s.top = px(t); s.width = px(w); s.height = px(h); s.transformOrigin = origin; s.transform = tr; }
  function build3D() {
    var W = floors.offsetWidth, Hf = floors.offsetHeight, fl = floors.offsetLeft, ft = floors.offsetTop;
    var Wr = roof.offsetWidth, Hr = roof.offsetHeight, rl = roof.offsetLeft, rt = roof.offsetTop;
    if (!W || !Hf) return;
    var Dp = Math.max(56, Math.min(190, W * .24));
    var rows = 1; [].forEach.call(floors.children, function (r) { rows = Math.max(rows, parseInt(r.style.gridRow, 10) || 1); });
    house.style.setProperty("--rh", ((Hf - 4) / rows) + "px");
    place(F.wr, fl + W, ft, Dp, Hf, "0 0", "rotateY(90deg)");
    place(F.wl, fl - Dp, ft, Dp, Hf, "100% 0", "rotateY(-90deg)");
    var th = Math.atan2(Hr, Wr / 2), L = Math.hypot(Wr / 2, Hr);
    place(F.sr, rl + Wr / 2, rt - Dp, L + .5, Dp, "0 100%", "rotateZ(" + th + "rad) rotateX(90deg)");
    place(F.sl, rl, rt + Hr - Dp, L + .5, Dp, "0 100%", "rotateZ(" + (-th) + "rad) rotateX(90deg)");
    place(F.gr, fl - Dp * .9, ft + Hf, W + Dp * 1.8, Dp * 2.4, "50% 0", "translateZ(" + px(Dp * .7) + ") rotateX(-90deg)");
    house.style.transformOrigin = "50% 62% " + px(-Dp / 2);
    GEO = { W: W, D: Dp };
  }
  if (window.ResizeObserver) new ResizeObserver(function () { build3D(); }).observe(house);
  else addEventListener("resize", build3D);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build3D);

  // поворот: мышь (компьютер), лёгкое покачивание и прокрутка (телефон), разворот при входе
  var RY0 = -14, RX0 = -3, AMP = DOM === "okna" ? .45 : DOM === "siluet" ? .5 : 1; // фасад и контур поворачиваются меньше
  if (DOM === "okna") RY0 = -5; else if (DOM === "siluet") RY0 = -8;
  var cur = { ry: RY0, rx: RX0, tz: 0 }, ptr = null, raf = 0, last = 0, intro = null, live = true;
  function ease4(t) { return 1 - Math.pow(1 - t, 4); }
  function target(now) {
    var ry = RY0, rx = RX0, tz = 0;
    if (ptr && FINE) { ry += (ptr.x - .5) * -24 * AMP; rx += (ptr.y - .5) * 7 * AMP; }
    else if (!FINE) {
      var s = Math.min(1.2, home.scrollTop / Math.max(1, innerHeight));
      ry += s * 14 * AMP; rx -= s * 7 * AMP;
      if (Q >= 2) ry += Math.sin(now / 2300) * 5 * AMP;
    } else if (Q >= 2) ry += Math.sin(now / 2600) * 4 * AMP;
    if (intro) {
      var k = Math.min(1, (now - intro.t0) / intro.dur), e = ease4(k);
      ry = -58 + (ry + 58) * e; rx = -14 + (rx + 14) * e; tz = -240 * (1 - e);
      if (k >= 1) intro = null;
    }
    return { ry: ry, rx: rx, tz: tz };
  }
  function apply() {
    house.style.transform = "translateZ(" + cur.tz.toFixed(1) + "px) rotateX(" + cur.rx.toFixed(2) + "deg) rotateY(" + cur.ry.toFixed(2) + "deg)";
    if (DOM === "okna") { // фото за стеклом сдвигается против поворота - глубина комнаты
      house.style.setProperty("--px", Math.max(-1, Math.min(1, (cur.ry - RY0) / 12)).toFixed(3));
      house.style.setProperty("--py", Math.max(-1, Math.min(1, (cur.rx - RX0) / 4)).toFixed(3));
    }
  }
  var slow = 0, frames = 0;
  function frame(now) {
    raf = 0;
    if (!live) return;
    var dt = last ? now - last : 16; last = now;
    if (intro) { frames++; if (dt > 34) slow++; }
    var t = target(now), k = intro ? 1 : 1 - Math.pow(.0016, Math.min(dt, 64) / 1000 * 1.0);
    cur.ry += (t.ry - cur.ry) * k; cur.rx += (t.rx - cur.rx) * k; cur.tz += (t.tz - cur.tz) * k;
    apply();
    var moving = intro || Math.abs(t.ry - cur.ry) > .02 || Math.abs(t.rx - cur.rx) > .02 || (Q >= 2) || (FINE && ptr);
    if (!intro && frames > 40) { // замер кадров во время входа: телефон не успевает - убираем постоянное движение
      if (slow / frames > .3) setQ(Q >= 2 ? 1 : 0);
      frames = 0; slow = 0;
    }
    if (moving && Q > 0) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function kick() { if (!raf && live && Q > 0) { raf = requestAnimationFrame(frame); } else if (Q === 0) { var t = target(performance.now()); cur.ry = t.ry; cur.rx = t.rx; cur.tz = 0; apply(); } }
  if (FINE) {
    addEventListener("pointermove", function (e) { if (e.pointerType !== "mouse") return; ptr = { x: e.clientX / innerWidth, y: e.clientY / innerHeight }; kick(); }, { passive: true });
    document.addEventListener("mouseleave", function () { ptr = null; kick(); });
  }
  function startIntro() { if (Q === 0) { kick(); return; } intro = { t0: performance.now(), dur: 2300 }; frames = 0; slow = 0; cur = { ry: -58, rx: -14, tz: -240 }; apply(); kick(); }
  // puteshestvie.js добавляет #home.enter при входе на главную (после дверей или по прямой ссылке)
  new MutationObserver(function () { if (home.classList.contains("enter") && !home.d2in) { home.d2in = 1; startIntro(); } if (!home.classList.contains("enter")) home.d2in = 0; })
    .observe(home, { attributes: true, attributeFilter: ["class"] });
  // цикл работает только когда дом виден
  function loopCheck() {
    var vis = B.getAttribute("data-vp") === "home" && !B.classList.contains("pn-open") && !MON && !document.hidden;
    live = vis;
    if (vis) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
    video(vis);
  }
  new MutationObserver(loopCheck).observe(B, { attributes: true, attributeFilter: ["data-vp", "class"] });
  document.addEventListener("visibilitychange", loopCheck);
  apply();

  // ---------- "Линия" и "Силуэт": контур фронтона ----------
  if (tema === "liniya" || DOM === "siluet") {
    roof.insertAdjacentHTML("afterbegin", '<svg class="d2-rl" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,0.8 99.6,99.6 0.4,99.6" vector-effect="non-scaling-stroke"/></svg>');
  }

  // ---------- разделы: фото проявляются при прокрутке ----------
  var pnSc = $("pnSc"), io = null;
  function reveal() {
    var av = pnSc.querySelector(".pme .av");
    if (av && LOGO && !av.style.backgroundImage) { av.innerHTML = LOGO; av.classList.add("d2-av"); }
    if (io) io.disconnect();
    var pws = pnSc.querySelectorAll(".pw");
    if (!pws.length) return;
    if (Q === 0 || !window.IntersectionObserver) { [].forEach.call(pws, function (p) { p.classList.add("in"); }); return; }
    var cols = innerWidth > 900 ? 3 : 2;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var p = e.target, i = [].indexOf.call(pws, p);
        p.style.transitionDelay = ""; [].forEach.call(p.querySelectorAll("img,.pt"), function (x) { x.style.transitionDelay = ((i % cols) * 0.09) + "s"; });
        p.classList.add("in"); io.unobserve(p);
      });
    }, { root: pnSc, rootMargin: "0px 0px -6% 0px", threshold: .12 });
    [].forEach.call(pws, function (p) { io.observe(p); });
  }
  if (pnSc) new MutationObserver(reveal).observe(pnSc, { childList: true });

  // ---------- "Кино": видео на фоне первого экрана ----------
  var KV = null;
  function video(on) {
    if (!KV || !KV.v) return;
    if (on && KV.ok) { var p = KV.v.play(); if (p && p.catch) p.catch(function () {}); }
    else if (!on) KV.v.pause();
  }
  if (tema === "kino") {
    var layer = el("div", "d2-kino", '<div class="d2-kbg"></div><i class="d2-veil"></i>'); layer.setAttribute("aria-hidden", "true");
    home.insertBefore(layer, home.firstChild);
    var reels = $("reels"), ft = home.querySelector(".foot");
    if (reels) reels.classList.add("d2-light"); if (ft) ft.classList.add("d2-light");
    var F0 = D.fon || {}, tall = innerHeight > innerWidth * 1.05;
    var vsrc = url(tall ? (F0.video_tel || F0.video) : (F0.video || F0.video_tel));
    var kadr = url(tall ? (F0.kadr_tel || F0.kadr) : (F0.kadr || F0.kadr_tel));
    var bg = layer.firstChild;
    if (vsrc) {
      if (kadr) bg.style.backgroundImage = 'url("' + kadr.replace(/"/g, "%22") + '")';
      if (Q > 0) {
        var v = el("video"); v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.preload = "auto";
        if (kadr) v.poster = kadr;
        KV = { v: v, ok: false };
        // закрытая витрина отдаёт файлы через служебный работник без "кусочных" ответов - Safari такое видео не играет.
        // Поэтому скачиваем целиком (1-1,6 МБ) и играем из памяти.
        fetch(vsrc).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) {
          v.src = URL.createObjectURL(new Blob([buf], { type: "video/mp4" }));
          v.addEventListener("playing", function () { layer.classList.add("vid"); }, { once: true });
          bg.appendChild(v); KV.ok = true; loopCheck();
        }).catch(function () {});
      }
    } else {
      // запасной фон без видео: медленная смена фото работ
      var covers = [];
      (D.raboty || []).forEach(function (w) { var f = (w.foto || [])[0]; if (f && f.src && covers.length < 5) covers.push(url(f.src)); });
      for (var ci = 0; covers.length && covers.length < 5; ci++) covers.push(covers[ci]);
      covers.forEach(function (c, i) { var s = el("i", "d2-ks"); s.style.backgroundImage = 'url("' + c.replace(/"/g, "%22") + '")'; s.style.setProperty("--k", i); bg.appendChild(s); });
      layer.classList.add("vid", "slides");
    }
  }

  // ---------- "Силуэт": фото комнаты на весь фон ----------
  if (DOM === "siluet") {
    var host = home.querySelector(".d2-kino") || home, rph = el("div", "d2-rph"), shown = null, hideT = 0;
    rph.setAttribute("aria-hidden", "true");
    var veil = host.querySelector(".d2-veil"); if (veil) host.insertBefore(rph, veil); else host.appendChild(rph);
    var LAY = {};
    function photoOf(r) { var ph = r.querySelector(".ph"); return ph && ph.style.backgroundImage; }
    function showRoom(r) {
      clearTimeout(hideT);
      if (r === shown) return; shown = r;
      [].forEach.call(floors.querySelectorAll(".room"), function (x) { x.classList.toggle("d2-on", x === r); });
      home.classList.toggle("d2-rph-on", !!r);
      var bgi = r && photoOf(r);
      [].forEach.call(rph.children, function (x) { x.classList.remove("on"); });
      if (!bgi) return;
      var k = r.getAttribute("aria-label") || bgi, lay = LAY[k];
      if (!lay) { lay = LAY[k] = el("i"); lay.style.backgroundImage = bgi; rph.appendChild(lay); }
      void lay.offsetWidth; lay.classList.add("on");
    }
    floors.addEventListener("pointerover", function (e) { if (e.pointerType !== "mouse") return; var r = e.target.closest(".room:not(.empty)"); if (r) showRoom(r); });
    floors.addEventListener("pointerleave", function (e) { if (e.pointerType !== "mouse") return; hideT = setTimeout(function () { showRoom(null); }, 350); });
    floors.addEventListener("focusin", function (e) { var r = e.target.closest(".room:not(.empty)"); if (r) showRoom(r); });
    floors.addEventListener("focusout", function () { hideT = setTimeout(function () { if (!floors.contains(document.activeElement)) showRoom(null); }, 200); });
    // телефон: puteshestvie.js отмечает .lit комнату посередине экрана при прокрутке
    new MutationObserver(function () { if (FINE) return; var l = floors.querySelector(".room.lit"); showRoom(l && home.scrollTop > 40 ? l : null); })
      .observe(floors, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // ---------- пробные страницы: переход между вариантами ----------
  var TRY = window.D2_TRY;
  if (TRY && TRY.list) {
    var i = -1; TRY.list.forEach(function (x, k) { if (x.n === TRY.n) i = k; });
    var pv = TRY.list[(i - 1 + TRY.list.length) % TRY.list.length], nx = TRY.list[(i + 1) % TRY.list.length], me = TRY.list[i] || {};
    var bar = el("nav", "d2-try");
    bar.setAttribute("aria-label", "Пробные варианты");
    bar.innerHTML = '<button type="button" class="d2-tt" aria-expanded="false" title="Другие варианты"><span class="lg">Вариант </span>' + me.n + "</button>" +
      '<div class="d2-tm"><a href="../v' + pv.n + '/" title="' + esc(pv.name) + '">← ' + pv.n + '</a><a href="#" data-x><b>' + me.n + '</b><span class="lg">&nbsp;· ' + esc(me.name) + '</span></a><a href="../v' + nx.n + '/" title="' + esc(nx.name) + '">' + nx.n + ' →</a><a href="../">Все</a><a href="#" data-vhod title="Показать вход ещё раз">Вход</a></div>';
    var tt = bar.querySelector(".d2-tt");
    tt.onclick = function () { var o = bar.classList.toggle("open"); tt.setAttribute("aria-expanded", o); };
    bar.querySelector("[data-x]").onclick = function (e) { e.preventDefault(); bar.classList.remove("open"); tt.setAttribute("aria-expanded", "false"); };
    bar.querySelector("[data-vhod]").onclick = function (e) { e.preventDefault(); try { localStorage.removeItem("vp-byl"); } catch (x) {} location.reload(); };
    B.appendChild(bar);
  }
})();
