/* Мастерская закрытой витрины (Краснодар).
   - "О мастере": название, имя, чем занимается, город, опыт, текст о себе, контакты, знак (логотип).
   - "Лента": новая работа или новые фото/видео к готовой работе. Водяной знак впечатывается сам:
       фото - на холсте (canvas), видео - кадр за кадром на холсте с записью MediaRecorder (идёт столько же, сколько
       длится ролик; звук сохраняется). Оригиналы фото храним, чтобы при смене знака пересобрать их.
   - "Водяной знак": что ставить (знак, надпись или оба), где (9 мест или узор по всему фото), размер, прозрачность, цвет.
   - "Отправить": ZIP-пакет pravki.json + foto/*. Его кладут в /mnt/project-files/vitrina-vk/ (pravki-mastera.json + foto/),
       site/tools/zashifrovat-krasnodar.js сам подмешивает правки к данным и шифрует. Публикует человек с доступом к репозиторию.
   Черновик живёт в этом браузере: тексты - localStorage "kr-ms", файлы - IndexedDB "kr-ms". */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var D = window.VITRINA || {}, M0 = D.master || {}, K0 = D.kontakty || {};
  var KEY = "kr-ms";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(t, ms) { var e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, ms || 2600); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function plural(n, f) { n = Math.abs(n) % 100; var d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; }
  var IC_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // ---------- черновик ----------
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  S = S || {};
  S.master = S.master || {}; S.kontakty = S.kontakty || {};
  S.znak = Object.assign({ chto: "oba", pos: "np", razmer: 11, prozr: 70, cvet: "#ffffff", tekst: M0.znak || M0.imya || "" }, S.znak || {});
  if (!/^(uzor|[vcn][lcp])$/.test(S.znak.pos)) S.znak.pos = "np";
  S.novye = S.novye || []; S.k = S.k || []; // k - добавки к готовым работам: [{ rabota, media: [...] }]
  var saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Браузеру не хватило памяти - скачайте пакет"); } counts(); }, 250); }

  // ---------- IndexedDB для файлов ----------
  var DBP = null;
  function db() {
    if (DBP) return DBP;
    DBP = new Promise(function (ok, no) { var r = indexedDB.open(KEY, 1); r.onupgradeneeded = function () { r.result.createObjectStore("f"); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; });
    return DBP;
  }
  function put(id, blob) { return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction("f", "readwrite"); t.objectStore("f").put(blob, id); t.oncomplete = function () { ok(); }; t.onerror = function () { no(t.error); }; }); }); }
  function get(id) { return db().then(function (d) { return new Promise(function (ok) { var q = d.transaction("f").objectStore("f").get(id); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; }); }); }
  function del(id) { return db().then(function (d) { d.transaction("f", "readwrite").objectStore("f").delete(id); }).catch(function () {}); }
  var URLS = {};
  function blobUrl(id) { if (URLS[id]) return Promise.resolve(URLS[id]); return get(id).then(function (b) { if (!b) return ""; URLS[id] = URL.createObjectURL(b); return URLS[id]; }); }

  // ---------- знак мастера (svg) ----------
  var LOGO_SVG = ""; // текст svg с currentColor
  function cleanSvg(t) { return String(t || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<!--[\s\S]*?-->/gi, "").replace(/<(metadata|title|desc|foreignObject)[\s\S]*?<\/\1>/gi, "").replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#").replace(/\son\w+\s*=\s*(["']).*?\1/gi, ""); }
  function loadLogo() {
    var p = S.logo ? get("logo").then(function (b) { return b ? b.text() : ""; }) :
      M0.logo ? fetch(M0.logo).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; }) : Promise.resolve("");
    return p.then(function (t) {
      LOGO_SVG = /<svg[\s>]/i.test(t) ? cleanSvg(t) : "";
      if (!LOGO_SVG && S.logo) return get("logo").then(function (b) { if (b) LOGO_RASTER = b; });
    }).then(function () { logoImgP = null; drawTop(); });
  }
  var LOGO_RASTER = null, logoImgP = null;
  function drawTop() {
    var i = $("logoTop");
    $("nmTop").textContent = val("master", "imya") || "Мастерская";
    if (LOGO_SVG) { i.innerHTML = LOGO_SVG; i.hidden = false; } else i.hidden = true;
  }
  // знак для холста: svg перекрашиваем в выбранный цвет и задаём размер (без него некоторые браузеры не рисуют)
  function logoImg() {
    if (logoImgP) return logoImgP;
    logoImgP = new Promise(function (ok) {
      var src;
      if (LOGO_SVG) {
        var t = LOGO_SVG.replace(/currentColor/g, S.znak.cvet);
        if (!/<svg[^>]*\swidth=/i.test(t)) t = t.replace(/<svg/i, '<svg width="512" height="512"');
        if (!/xmlns=/.test(t)) t = t.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
        src = URL.createObjectURL(new Blob([t], { type: "image/svg+xml" }));
      } else if (LOGO_RASTER) src = URL.createObjectURL(LOGO_RASTER);
      else return ok(null);
      var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src;
    });
    return logoImgP;
  }

  // ---------- водяной знак на холсте ----------
  // Один и тот же рисунок для фото, видео и предпросмотра. Размер - доля короткой стороны кадра.
  function drawWM(ctx, W, H, Z, logo) {
    var base = Math.min(W, H), h = Math.max(14, base * Z.razmer / 100), m = base * .035;
    var txt = Z.chto !== "logo" ? String(Z.tekst || "").trim() : "", useLogo = Z.chto !== "tekst" && logo;
    if (!txt && !useLogo) return;
    var fs = h * (useLogo ? .36 : .5), gap = useLogo && txt ? h * .28 : 0;
    ctx.save();
    ctx.font = "400 " + fs + "px Playfair, Georgia, serif";
    var tw = txt ? ctx.measureText(txt).width : 0, lw = useLogo ? h : 0, bw = lw + gap + tw, bh = Math.max(lw ? h : 0, fs * 1.2);
    ctx.globalAlpha = Z.prozr / 100;
    ctx.fillStyle = Z.cvet; ctx.textBaseline = "middle";
    var dark = Z.cvet.toLowerCase() === "#ffffff";
    ctx.shadowColor = dark ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.3)"; ctx.shadowBlur = h * .08;
    function one(x, y) { if (useLogo) ctx.drawImage(logo, x, y + (bh - h) / 2, h, h); if (txt) ctx.fillText(txt, x + lw + gap, y + bh / 2); }
    if (Z.pos === "uzor") {
      ctx.globalAlpha = Z.prozr / 100 * .55;
      ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 7.5);
      var sx = bw + h * 2.2, sy = bh + h * 2.4, R = Math.hypot(W, H) / 2 + sx;
      for (var y = -R, row = 0; y < R; y += sy, row++) for (var x = -R + (row % 2 ? sx / 2 : 0); x < R; x += sx) one(x - bw / 2, y - bh / 2);
    } else {
      var px = Z.pos.charAt(1), py = Z.pos.charAt(0); // pos: "vl" "vc" "vp" / "cl" ... / "nl" "nc" "np" (верх/центр/низ, лево/центр/право)
      var x0 = px === "l" ? m : px === "c" ? (W - bw) / 2 : W - m - bw;
      var y0 = py === "v" ? m : py === "c" ? (H - bh) / 2 : H - m - bh;
      one(x0, y0);
    }
    ctx.restore();
  }
  function fontsReady() { return document.fonts && document.fonts.load ? document.fonts.load('400 40px Playfair').catch(function () {}) : Promise.resolve(); }

  // ---------- фото ----------
  function loadBitmap(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob).catch(function () { return viaImg(blob); });
    return viaImg(blob);
  }
  function viaImg(blob) { return new Promise(function (ok, no) { var u = URL.createObjectURL(blob), im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error("Не получилось открыть фото (формат HEIC открывается не во всех браузерах - снимите в JPEG или пришлите с телефона)")); }; im.src = u; }); }
  function toBlob(c, q) { return new Promise(function (ok, no) { c.toBlob(function (b) { b ? ok(b) : no(new Error("Не получилось сохранить фото")); }, "image/jpeg", q); }); }
  function fit(w, h, max) { var k = Math.min(1, max / Math.max(w, h)); return { w: Math.round(w * k), h: Math.round(h * k) }; }
  function renderPhoto(orig) {
    return Promise.all([loadBitmap(orig), logoImg(), fontsReady()]).then(function (a) {
      var bm = a[0], s = fit(bm.width, bm.height, 1600), c = document.createElement("canvas"); c.width = s.w; c.height = s.h;
      var x = c.getContext("2d"); x.drawImage(bm, 0, 0, s.w, s.h); drawWM(x, s.w, s.h, S.znak, a[1]);
      return toBlob(c, .86).then(function (b) { return { blob: b, w: s.w, h: s.h }; });
    });
  }
  function addPhoto(file, list, card) {
    var it = { id: uid(), tip: "foto", ext: "jpg", st: "work" }; list.push(it); drawMedia(card, list);
    // оригинал уменьшаем до 2000 px (без знака) - из него пересобираем, если мастер поменяет знак
    return loadBitmap(file).then(function (bm) {
      var s = fit(bm.width, bm.height, 2000), c = document.createElement("canvas"); c.width = s.w; c.height = s.h;
      c.getContext("2d").drawImage(bm, 0, 0, s.w, s.h);
      return toBlob(c, .9);
    }).then(function (o) { return put("o:" + it.id, o).then(function () { return renderPhoto(o); }); })
      .then(function (r) { return put("m:" + it.id, r.blob).then(function () { it.st = "ok"; it.w = r.w; it.h = r.h; it.znak = sig(); }); })
      .catch(function (e) { it.st = "err"; it.err = e.message || String(e); })
      .then(function () { save(); drawMedia(card, list); });
  }
  function sig() { var z = S.znak; return [z.chto, z.pos, z.razmer, z.prozr, z.cvet, z.tekst, S.logoV || 0].join("|"); }

  // ---------- видео: знак кадр за кадром ----------
  var REC = null; // идущая запись (для кнопки "Остановить")
  function recMime() {
    if (!window.MediaRecorder) return "";
    var L = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (var i = 0; i < L.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(L[i])) return L[i];
    return "";
  }
  function videoOk() { var c = document.createElement("canvas"); return !!(c.captureStream && recMime()); }
  function addVideo(file, list, card) {
    if (!videoOk()) { toast("Этот браузер не умеет записывать видео со знаком. Откройте Мастерскую в Chrome или Safari 15+", 5000); return Promise.resolve(); }
    var it = { id: uid(), tip: "video", st: "work", p: 0 }; list.push(it); drawMedia(card, list);
    var v = document.createElement("video"), src = URL.createObjectURL(file);
    v.src = src; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto"; v.crossOrigin = "anonymous";
    var busy = $("busy"), stop = false, actx = null;
    function fin(e) {
      busy.hidden = true; REC = null;
      try { v.pause(); } catch (x) {}
      if (actx) try { actx.close(); } catch (x) {}
      URL.revokeObjectURL(src);
      if (e) { it.st = "err"; it.err = e.message || String(e); }
      save(); drawMedia(card, list);
    }
    return new Promise(function (done) {
      v.onerror = function () { fin(new Error("Не получилось открыть видео: формат не поддерживается этим браузером")); done(); };
      v.onloadedmetadata = function () {
        var dur = v.duration;
        if (!isFinite(dur) || dur <= 0) dur = 0;
        if (dur > 180) { fin(new Error("Ролик длиннее 3 минут - обрежьте его в галерее телефона")); done(); return; }
        Promise.all([logoImg(), fontsReady()]).then(function (a) {
          var s = fit(v.videoWidth, v.videoHeight, innerWidth < 900 ? 1280 : 1920), c = document.createElement("canvas"); c.width = s.w; c.height = s.h;
          var x = c.getContext("2d"), logo = a[0], mime = recMime();
          var stream = c.captureStream(30), tracks = stream.getVideoTracks().slice();
          // звук ролика - через Web Audio в запись (в динамики не идёт)
          try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (AC) { actx = new AC(); var srcN = actx.createMediaElementSource(v), dst = actx.createMediaStreamDestination(); srcN.connect(dst); tracks = tracks.concat(dst.stream.getAudioTracks()); }
          } catch (e) { v.muted = true; }
          var rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: s.w * s.h > 1e6 ? 6e6 : 3.5e6, audioBitsPerSecond: 128000 });
          var parts = [];
          rec.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
          rec.onstop = function () {
            if (stop) { fin(new Error("Остановлено")); list.splice(list.indexOf(it), 1); drawMedia(card, list); done(); return; }
            var type = (mime.split(";")[0]) || "video/webm", blob = new Blob(parts, { type: type });
            it.ext = /mp4/.test(type) ? "mp4" : "webm"; it.w = s.w; it.h = s.h; it.dur = Math.round(dur);
            put("m:" + it.id, blob).then(function () { return put("k:" + it.id, kadr || new Blob()); }).then(function () { it.st = "ok"; it.znak = sig(); it.size = blob.size; fin(); done(); })
              .catch(function (e) { fin(e); done(); });
          };
          var kadr = null, kadrT = Math.min(1, dur / 3);
          function paint() {
            x.drawImage(v, 0, 0, s.w, s.h); drawWM(x, s.w, s.h, S.znak, logo);
            if (!kadr && v.currentTime >= kadrT) { kadr = "wait"; c.toBlob(function (b) { kadr = b; }, "image/jpeg", .82); }
            var p = dur ? Math.min(1, v.currentTime / dur) : 0; it.p = p; $("busyP").style.width = (p * 100).toFixed(1) + "%";
            $("busyS").textContent = "Знак впечатывается в каждый кадр, это занимает столько же, сколько длится ролик (" + Math.round(dur) + " с). Не сворачивайте страницу и не гасите экран.";
          }
          var useRVFC = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
          function loop() { if (v.ended || stop) return; paint(); if (useRVFC) v.requestVideoFrameCallback(loop); else requestAnimationFrame(loop); }
          v.onended = function () { paint(); setTimeout(function () { if (rec.state !== "inactive") rec.stop(); }, 120); };
          REC = { stop: function () { stop = true; try { v.pause(); } catch (e) {} if (rec.state !== "inactive") rec.stop(); } };
          $("busyT").textContent = "Видео со знаком"; $("busyP").style.width = "0"; busy.hidden = false;
          rec.start(1000);
          var pl = v.play();
          if (pl && pl.then) pl.then(loop).catch(function (e) { REC.stop(); fin(new Error("Браузер не дал проиграть ролик: " + (e.message || e))); done(); });
          else loop();
        }).catch(function (e) { fin(e); done(); });
      };
    });
  }
  $("busyX").onclick = function () { if (REC) REC.stop(); };

  // ---------- общие значения: черновик поверх данных витрины ----------
  function val(sec, k) { var s = S[sec] || {}, b = sec === "master" ? M0 : K0; return s[k] != null ? s[k] : (b[k] || ""); }
  function fld(sec, k, label, o) {
    o = o || {}; var v = val(sec, k), ch = S[sec][k] != null && S[sec][k] !== ((sec === "master" ? M0 : K0)[k] || "");
    var inp = o.area ? '<textarea data-s="' + sec + '" data-k="' + k + '" rows="4">' + esc(v) + "</textarea>" :
      '<input data-s="' + sec + '" data-k="' + k + '" value="' + esc(v) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "") + ">";
    return '<div class="f' + (o.w ? " w" : "") + '"><label>' + label + "</label>" + inp + (o.hint ? "<small>" + o.hint + "</small>" : "") + (ch ? '<span class="was">Было: ' + esc((sec === "master" ? M0 : K0)[k] || "пусто") + "</span>" : "") + "</div>";
  }
  document.addEventListener("input", function (e) {
    var t = e.target, sec = t.getAttribute && t.getAttribute("data-s"); if (!sec) return;
    var k = t.getAttribute("data-k"), base = ((sec === "master" ? M0 : K0)[k] || "");
    if (t.value === base) delete S[sec][k]; else S[sec][k] = t.value;
    if (k === "imya") drawTop();
    if (k === "znak" && sec === "master") { S.znak.tekst = t.value; }
    save();
  });

  // ---------- вкладки ----------
  var TAB = "master";
  [].forEach.call(document.querySelectorAll(".tabs button"), function (b) { b.onclick = function () { go(b.getAttribute("data-t")); }; });
  function go(t) {
    TAB = t;
    [].forEach.call(document.querySelectorAll(".tabs button"), function (b) { b.setAttribute("aria-selected", b.getAttribute("data-t") === t); });
    ({ master: vMaster, lenta: vLenta, znak: vZnak, paket: vPaket })[t]();
    scrollTo(0, 0);
  }
  function counts() {
    var n = 0; S.novye.concat(S.k).forEach(function (w) { n += (w.media || []).filter(function (m) { return m.st === "ok"; }).length; });
    $("cntL").textContent = n || "";
    var ch = Object.keys(S.master).length + Object.keys(S.kontakty).length + (S.logo ? 1 : 0) + n;
    $("cntP").textContent = ch || "";
  }

  // ---------- О мастере ----------
  function vMaster() {
    $("main").innerHTML = '<section role="tabpanel"><h1>О мастере</h1><p class="lead">Что видит клиент на витрине: название, кто вы, чем занимаетесь, контакты и знак. Меняйте прямо здесь - всё сохраняется в этом браузере, пока вы не отправите пакет.</p>' +
      '<div class="eyebrow">Знак</div><div class="card"><div class="logo-row"><div class="logo-box" id="lgBox"></div><div><p style="margin-bottom:10px;max-width:420px">Лучше SVG (чёткий при любом размере). Подойдёт и PNG с прозрачным фоном. Знак стоит в шапке витрины и в водяном знаке.</p>' +
      '<div class="btns" style="margin-top:0"><span class="btn l sm file">Загрузить знак<input type="file" id="lgIn" accept=".svg,image/svg+xml,image/png"></span>' + (S.logo ? '<button type="button" class="btn l sm" id="lgDel">Вернуть прежний</button>' : "") + "</div></div></div></div>" +
      '<div class="eyebrow">Мастерская</div><div class="card g2">' +
      fld("master", "imya", "Название (главное на витрине)") + fld("master", "chelovek", "Имя мастера", { hint: "Мелко внизу страницы" }) +
      fld("master", "rol", "Чем занимаетесь") + fld("master", "gorod", "Город, район") +
      fld("master", "opyt", "Опыт", { ph: "7+ лет" }) + fld("master", "rabot", "Сколько работ сделано", { ph: "300+" }) +
      fld("master", "o_sebe", "О себе", { area: 1, w: 1, hint: "2-4 предложения простыми словами: что делаете и чем удобно работать с вами" }) +
      fld("master", "znak", "Надпись водяного знака", { w: 1, hint: "Для новых фото и видео. Где и как стоит знак - во вкладке «Водяной знак»" }) + "</div>" +
      '<div class="eyebrow">Контакты</div><div class="card g2">' +
      fld("kontakty", "whatsapp", "WhatsApp (номер)", { mode: "tel", ph: "79990000000" }) + fld("kontakty", "telegram", "Telegram", { ph: "@имя" }) +
      fld("kontakty", "max", "Max (ссылка)", { ph: "max.ru/...", hint: "В приложении Max: профиль - поделиться - скопировать ссылку" }) +
      fld("kontakty", "telefon", "Телефон для звонка", { mode: "tel" }) + fld("kontakty", "vk", "ВКонтакте", { ph: "vk.ru/..." }) +
      fld("kontakty", "adres", "Адрес или район") + fld("kontakty", "chasy", "Часы работы", { ph: "Пн-Сб 9-19" }) + "</div></section>";
    var box = $("lgBox"); box.innerHTML = LOGO_SVG || (LOGO_RASTER ? "" : '<span style="color:var(--muted);font-size:12px">нет</span>');
    if (!LOGO_SVG && LOGO_RASTER) { var im = new Image(); im.src = URL.createObjectURL(LOGO_RASTER); box.appendChild(im); }
    $("lgIn").onchange = function () {
      var f = this.files[0]; if (!f) return;
      if (f.size > 600 * 1024) { toast("Файл знака больше 600 КБ - нужен попроще"); return; }
      put("logo", f).then(function () { S.logo = { name: f.name, type: f.type || (/\.svg$/i.test(f.name) ? "image/svg+xml" : "image/png") }; S.logoV = (S.logoV || 0) + 1; LOGO_RASTER = null; save(); return loadLogo(); })
        .then(function () { toast("Знак загружен"); vMaster(); });
    };
    if ($("lgDel")) $("lgDel").onclick = function () { del("logo"); delete S.logo; S.logoV = (S.logoV || 0) + 1; LOGO_RASTER = null; save(); loadLogo().then(vMaster); };
  }

  // ---------- Лента ----------
  function ordRooms() { return (D.komnaty || []).slice(); }
  function workCard(w, isNew, i) {
    var rs = ordRooms(), title = isNew ? (w.nazvanie || "Новая работа") : ((D.raboty || []).filter(function (r) { return r.id === w.rabota; })[0] || {}).nazvanie || w.rabota;
    var h = '<div class="card" data-card="' + (isNew ? "n" : "k") + i + '">';
    if (isNew) {
      h += '<div class="g2"><div class="f"><label>Название работы</label><input data-w="nazvanie" value="' + esc(w.nazvanie || "") + '" placeholder="Кухня с островом в ЖК ..."></div>' +
        '<div class="f"><label>Комната на витрине</label><select data-w="komnata">' + rs.map(function (k) { return '<option value="' + esc(k.id) + '"' + (w.komnata === k.id ? " selected" : "") + ">" + esc(k.nazvanie) + "</option>"; }).join("") + "</select></div>" +
        '<div class="f w"><label>Рассказ о работе</label><textarea data-w="rasskaz" rows="3" placeholder="Что хотел заказчик, что придумали, сроки, материалы">' + esc(w.rasskaz || "") + "</textarea></div></div>";
    } else h += '<b style="font-weight:500">К работе: ' + esc(title) + "</b>";
    h += '<div class="media"></div><div class="btns"><span class="btn sm file">Добавить фото и видео<input type="file" accept="image/*,video/*" multiple data-add></span>' +
      '<button type="button" class="btn l sm" data-rm>' + (isNew ? "Убрать работу" : "Убрать") + "</button></div></div>";
    return h;
  }
  function vLenta() {
    var opts = (D.raboty || []).map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.nazvanie) + "</option>"; }).join("");
    $("main").innerHTML = '<section role="tabpanel"><h1>Лента</h1><p class="lead">Добавляйте фото и видео с телефона - водяной знак впечатается сам. Фото уменьшаются до 1600 px, видео - до 1280 px на телефоне и 1920 px на компьютере.</p>' +
      (videoOk() ? "" : '<p class="note">Этот браузер не умеет записывать видео со знаком - фото добавляются как обычно. Для видео откройте Мастерскую в <b>Chrome</b> или <b>Safari 15+</b>.</p>') +
      '<div class="eyebrow">Новые работы</div><div id="nw">' + S.novye.map(function (w, i) { return workCard(w, true, i); }).join("") + "</div>" +
      '<div class="btns"><button type="button" class="btn" id="addW">Новая работа</button></div>' +
      '<div class="eyebrow">Добавить к готовой работе</div><div id="kw">' + S.k.map(function (w, i) { return workCard(w, false, i); }).join("") + "</div>" +
      '<div class="card"><div class="f"><label>Работа на витрине</label><select id="kSel"><option value="">Выберите работу</option>' + opts + "</select></div></div></section>";
    S.novye.forEach(function (w, i) { bindCard(document.querySelector('[data-card="n' + i + '"]'), w, true, i); });
    S.k.forEach(function (w, i) { bindCard(document.querySelector('[data-card="k' + i + '"]'), w, false, i); });
    $("addW").onclick = function () { var k = (ordRooms()[0] || {}).id || ""; S.novye.push({ id: "ms-" + uid(), nazvanie: "", komnata: k, rasskaz: "", media: [] }); save(); vLenta(); var c = document.querySelector('[data-card="n' + (S.novye.length - 1) + '"] input'); if (c) c.focus(); };
    $("kSel").onchange = function () { if (!this.value) return; var id = this.value; var ex = S.k.filter(function (w) { return w.rabota === id; })[0]; if (!ex) { S.k.push({ rabota: id, media: [] }); save(); } vLenta(); };
  }
  function bindCard(card, w, isNew, i) {
    if (!card) return;
    w.media = w.media || [];
    drawMedia(card, w.media);
    [].forEach.call(card.querySelectorAll("[data-w]"), function (e) { e.addEventListener(e.tagName === "SELECT" ? "change" : "input", function () { w[e.getAttribute("data-w")] = e.value; save(); }); });
    card.querySelector("[data-add]").onchange = function () {
      var fs = [].slice.call(this.files); this.value = "";
      // по одному: видео пишутся в реальном времени, фото - быстро
      fs.reduce(function (p, f) { return p.then(function () { return /^video\//.test(f.type) ? addVideo(f, w.media, card) : addPhoto(f, w.media, card); }); }, Promise.resolve())
        .then(function () { var bad = w.media.filter(function (m) { return m.st === "err"; }).length; toast(bad ? "Готово, но не всё получилось - см. отметки" : "Добавлено со знаком"); });
    };
    card.querySelector("[data-rm]").onclick = function () {
      if (w.media.length && !confirm("Убрать вместе с " + w.media.length + " " + plural(w.media.length, ["файлом", "файлами", "файлами"]) + "?")) return;
      w.media.forEach(function (m) { del("m:" + m.id); del("o:" + m.id); del("k:" + m.id); });
      (isNew ? S.novye : S.k).splice(i, 1); save(); vLenta();
    };
  }
  function drawMedia(card, list) {
    var box = card && card.querySelector(".media"); if (!box) return;
    box.innerHTML = list.map(function (m, j) {
      var st = m.st === "work" ? (m.tip === "video" ? "Видео: впечатываю знак..." : "Фото: впечатываю знак...") : m.st === "err" ? esc(m.err || "Ошибка") : m.tip === "video" ? (m.dur || 0) + " с, " + Math.round((m.size || 0) / 1048576 * 10) / 10 + " МБ" : "";
      return '<div class="m' + (m.st === "err" ? " err" : "") + '" data-j="' + j + '"><span class="tip">' + (m.tip === "video" ? "Видео" : "Фото") + "</span>" +
        (m.st === "work" ? "" : '<button type="button" class="x" aria-label="Убрать">' + IC_X + "</button>") + (st ? '<span class="st">' + st + "</span>" : "") + "</div>";
    }).join("");
    list.forEach(function (m, j) {
      var el = box.querySelector('[data-j="' + j + '"]'); if (!el) return;
      if (m.st === "ok") blobUrl(m.tip === "video" ? "k:" + m.id : "m:" + m.id).then(function (u) { if (u && el.isConnected) el.insertAdjacentHTML("afterbegin", '<img src="' + u + '" alt="">'); });
      var x = el.querySelector(".x"); if (x) x.onclick = function () { del("m:" + m.id); del("o:" + m.id); del("k:" + m.id); list.splice(j, 1); save(); drawMedia(card, list); };
    });
  }

  // ---------- Водяной знак ----------
  var PV = null; // картинка для предпросмотра
  function pvImage() {
    if (PV) return Promise.resolve(PV);
    var src = ""; (D.raboty || []).some(function (w) { var f = (w.foto || [])[0]; if (f && f.src) { src = f.src; return true; } return false; });
    return new Promise(function (ok) {
      if (!src) { var c = document.createElement("canvas"); c.width = 1200; c.height = 900; var x = c.getContext("2d"); var g = x.createLinearGradient(0, 0, 1200, 900); g.addColorStop(0, "#8a8173"); g.addColorStop(1, "#3c3a36"); x.fillStyle = g; x.fillRect(0, 0, 1200, 900); PV = c; return ok(c); }
      var im = new Image(); im.onload = function () { PV = im; ok(im); }; im.onerror = function () { PV = null; ok(null); }; im.src = src;
    });
  }
  function vZnak() {
    var Z = S.znak, POS = [["vl", "вверху слева"], ["vc", "вверху"], ["vp", "вверху справа"], ["cl", "слева"], ["cc", "в центре"], ["cp", "справа"], ["nl", "внизу слева"], ["nc", "внизу"], ["np", "внизу справа"]];
    $("main").innerHTML = '<section role="tabpanel"><h1>Водяной знак</h1><p class="lead">Ставится на все новые фото и видео сам. Защищает от того, чтобы ваши работы выдавали за свои.</p>' +
      '<div class="wm-grid"><div><div class="pv"><canvas id="pvC" width="1200" height="900"></canvas></div><p class="note">Так знак ляжет на фото. На видео - так же, в каждом кадре.</p></div><div>' +
      '<div class="eyebrow" style="margin-top:0">Что ставить</div><div class="seg" id="zChto">' + [["oba", "Знак и надпись"], ["logo", "Только знак"], ["tekst", "Только надпись"]].map(function (o) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (Z.chto === o[0]) + '">' + o[1] + "</button>"; }).join("") + "</div>" +
      '<div class="f" style="margin-top:12px"><label>Надпись</label><input id="zTekst" value="' + esc(Z.tekst) + '"></div>' +
      '<div class="eyebrow">Где</div><div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap"><div class="pos" id="zPos">' + POS.map(function (p) { return '<button type="button" data-v="' + p[0] + '" aria-label="' + p[1] + '" aria-pressed="' + (Z.pos === p[0]) + '"></button>'; }).join("") + "</div>" +
      '<div class="seg"><button type="button" id="zUzor" aria-pressed="' + (Z.pos === "uzor") + '">Узор по всему фото</button></div></div>' +
      '<div class="eyebrow">Размер</div><div class="rng"><input type="range" id="zR" min="5" max="40" step="1" value="' + Z.razmer + '"><output id="zRo">' + Z.razmer + "%</output></div>" +
      '<div class="eyebrow">Прозрачность</div><div class="rng"><input type="range" id="zP" min="10" max="100" step="5" value="' + Z.prozr + '"><output id="zPo">' + Z.prozr + "%</output></div>" +
      '<div class="eyebrow">Цвет</div><div class="seg" id="zCv"><button type="button" data-v="#ffffff" aria-pressed="' + (Z.cvet === "#ffffff") + '">Белый</button><button type="button" data-v="#1d1c1a" aria-pressed="' + (Z.cvet === "#1d1c1a") + '">Тёмный</button></div>' +
      '<div id="zRe"></div></div></div></section>';
    function redraw() {
      pvImage().then(function (im) {
        var c = $("pvC"); if (!c) return;
        var w = im ? (im.naturalWidth || im.width) : 1200, h = im ? (im.naturalHeight || im.height) : 900, s = fit(w, h, 1400);
        c.width = s.w; c.height = s.h; var x = c.getContext("2d");
        if (im) x.drawImage(im, 0, 0, s.w, s.h);
        return Promise.all([logoImg(), fontsReady()]).then(function (a) { drawWM(x, s.w, s.h, S.znak, a[0]); });
      });
      var old = 0; S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { if (m.st === "ok" && m.tip === "foto" && m.znak !== sig()) old++; }); });
      $("zRe").innerHTML = old ? '<p class="note">Уже добавлено ' + old + " " + plural(old, ["фото", "фото", "фото"]) + ' со старым знаком.</p><button type="button" class="btn l sm" id="zReB">Наложить новый знак на них</button>' : "";
      if ($("zReB")) $("zReB").onclick = rewm;
    }
    function set(k, v) { S.znak[k] = v; if (k === "cvet") logoImgP = null; save(); redraw(); }
    function seg(id, k) { var g = $(id); g.onclick = function (e) { var b = e.target.closest("button[data-v]"); if (!b) return; [].forEach.call(g.querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", x === b); }); if (k === "pos") $("zUzor").setAttribute("aria-pressed", "false"); set(k, b.getAttribute("data-v")); }; }
    seg("zChto", "chto"); seg("zPos", "pos"); seg("zCv", "cvet");
    $("zUzor").onclick = function () { [].forEach.call($("zPos").querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", "false"); }); this.setAttribute("aria-pressed", "true"); set("pos", "uzor"); };
    $("zTekst").oninput = function () { S.znak.tekst = this.value; save(); redraw(); };
    $("zR").oninput = function () { $("zRo").textContent = this.value + "%"; set("razmer", +this.value); };
    $("zP").oninput = function () { $("zPo").textContent = this.value + "%"; set("prozr", +this.value); };
    redraw();
  }
  function rewm() {
    var L = []; S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { if (m.st === "ok" && m.tip === "foto" && m.znak !== sig()) L.push(m); }); });
    var i = 0; $("busy").hidden = false; $("busyT").textContent = "Новый знак на фото"; $("busyX").hidden = true;
    (function next() {
      if (i >= L.length) { $("busy").hidden = true; $("busyX").hidden = false; save(); toast("Готово"); vZnak(); return; }
      var m = L[i++]; $("busyP").style.width = (i / L.length * 100) + "%"; $("busyS").textContent = i + " из " + L.length;
      get("o:" + m.id).then(function (o) { if (!o) return; return renderPhoto(o).then(function (r) { return put("m:" + m.id, r.blob).then(function () { m.znak = sig(); if (URLS["m:" + m.id]) { URL.revokeObjectURL(URLS["m:" + m.id]); delete URLS["m:" + m.id]; } }); }); })
        .catch(function () {}).then(next);
    })();
  }

  // ---------- Отправить: пакет ----------
  function changes() {
    var nm = 0, nv = 0;
    S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { if (m.st !== "ok") return; if (m.tip === "video") nv++; else nm++; }); });
    return { m: Object.keys(S.master).length, k: Object.keys(S.kontakty).length, logo: !!S.logo, foto: nm, video: nv, raboty: S.novye.filter(function (w) { return (w.media || []).some(function (m) { return m.st === "ok"; }) || w.nazvanie; }).length };
  }
  function vPaket() {
    var c = changes(), any = c.m + c.k + (c.logo ? 1 : 0) + c.foto + c.video;
    var L = [];
    if (c.m) L.push("Данные мастера: " + c.m + " " + plural(c.m, ["поле", "поля", "полей"]));
    if (c.k) L.push("Контакты: " + c.k + " " + plural(c.k, ["поле", "поля", "полей"]));
    if (c.logo) L.push("Новый знак");
    if (c.raboty) L.push("Новые работы: " + c.raboty);
    if (c.foto) L.push("Фото со знаком: " + c.foto);
    if (c.video) L.push("Видео со знаком: " + c.video);
    var share = !!(navigator.canShare && navigator.share);
    $("main").innerHTML = '<section role="tabpanel"><h1>Отправить</h1><p class="lead">Сайт закрытый и статический: сам он файлы не принимает. Мастерская собирает всё в один файл - его нужно передать Александру, он выложит на витрину.</p>' +
      '<div class="card">' + (any ? '<div class="list">' + L.map(function (t) { return '<div class="row"><span class="sp">' + esc(t) + "</span></div>"; }).join("") + "</div>" : '<p class="lead" style="margin:0">Пока нечего отправлять: правок и новых файлов нет.</p>') +
      '<div class="btns"><button type="button" class="btn" id="pDl"' + (any ? "" : " disabled") + ">Скачать файл</button>" + (share ? '<button type="button" class="btn l" id="pSh"' + (any ? "" : " disabled") + ">Отправить файлом</button>" : "") + "</div>" +
      '<p class="note">Как это работает: файл <b>pravki-…zip</b> - внутри правки (pravki.json) и фото/видео уже со знаком. Отправьте его в WhatsApp или Telegram Александру. После публикации нажмите «Очистить черновик».</p></div>' +
      '<div class="eyebrow">Черновик</div><div class="card"><p style="margin-bottom:10px">Всё хранится только в этом браузере на этом устройстве. Если почистить браузер - черновик пропадёт, поэтому лучше отправлять сразу.</p><button type="button" class="btn l sm" id="pClr">Очистить черновик</button></div></section>';
    $("pDl").onclick = function () { pack().then(function (r) { var a = document.createElement("a"); a.href = URL.createObjectURL(r.blob); a.download = r.name; document.body.appendChild(a); a.click(); a.remove(); toast("Файл скачан: " + r.name); }).catch(err); };
    if ($("pSh")) $("pSh").onclick = function () {
      pack().then(function (r) {
        var f = new File([r.blob], r.name, { type: "application/zip" });
        if (!navigator.canShare({ files: [f] })) { toast("Этот телефон не умеет отправлять файл - нажмите «Скачать файл»"); return; }
        return navigator.share({ files: [f], title: "Правки витрины", text: "Правки витрины из Мастерской" }).catch(function (e) { if (e && e.name !== "AbortError") throw e; });
      }).catch(err);
    };
    $("pClr").onclick = function () {
      if (!confirm("Стереть все правки и файлы из этого браузера? Отправленное останется у Александра.")) return;
      S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { del("m:" + m.id); del("o:" + m.id); del("k:" + m.id); }); });
      if (S.logo) del("logo");
      localStorage.removeItem(KEY); location.reload();
    };
  }
  function err(e) { $("busy").hidden = true; toast("Не получилось: " + (e && e.message || e), 5000); }
  function pack() {
    $("busy").hidden = false; $("busyT").textContent = "Собираю файл"; $("busyX").hidden = true; $("busyS").textContent = ""; $("busyP").style.width = "10%";
    var files = [], P = { v: 1, sobrano: new Date().toISOString(), master: S.master, kontakty: S.kontakty, znak: S.znak, novye_raboty: [], k_rabotam: [] };
    function media(list) {
      var out = { foto: [], video: [] };
      list.forEach(function (m) {
        if (m.st !== "ok") return;
        if (m.tip === "video") { var n = "foto/ms-" + m.id + "." + m.ext, k = "foto/ms-" + m.id + "-kadr.jpg"; files.push([n, "m:" + m.id], [k, "k:" + m.id]); out.video.push({ fajl: n, oblozhka: k, w: m.w, h: m.h, sek: m.dur }); }
        else { var f = "foto/ms-" + m.id + ".jpg"; files.push([f, "m:" + m.id]); out.foto.push({ src: f, znak: true }); }
      });
      return out;
    }
    S.novye.forEach(function (w) { var md = media(w.media || []); if (!md.foto.length && !md.video.length && !w.nazvanie) return; P.novye_raboty.push({ id: w.id, nazvanie: w.nazvanie || "Новая работа", komnata: w.komnata, rasskaz: w.rasskaz || "", foto: md.foto, video: md.video }); });
    S.k.forEach(function (w) { var md = media(w.media || []); if (md.foto.length || md.video.length) P.k_rabotam.push({ rabota: w.rabota, foto: md.foto, video: md.video }); });
    var lg = S.logo ? get("logo").then(function (b) { if (b) { var n = "foto/logo-" + (S.logoV || 1) + (/svg/.test(S.logo.type) ? ".svg" : ".png"); P.logo = n; files.push([n, "logo"]); } }) : Promise.resolve();
    return lg.then(function () {
      return Promise.all(files.map(function (f) { return get(f[1]).then(function (b) { return b ? b.arrayBuffer() : new ArrayBuffer(0); }).then(function (ab) { return [f[0], new Uint8Array(ab)]; }); }));
    }).then(function (arr) {
      $("busyP").style.width = "70%";
      arr.unshift(["pravki.json", new TextEncoder().encode(JSON.stringify(P, null, 2))]);
      var d = new Date(), name = "pravki-" + d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + "-" + ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2) + ".zip";
      var blob = zip(arr); $("busy").hidden = true; $("busyX").hidden = false;
      return { blob: blob, name: name };
    });
  }
  // ZIP без сжатия (фото и видео уже сжаты): локальные заголовки + центральный каталог
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = -1; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
  function zip(files) {
    var parts = [], cd = [], off = 0, enc = new TextEncoder();
    function u16(v) { return [v & 255, (v >>> 8) & 255]; } function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var nm = enc.encode(f[0]), data = f[1], crc = crc32(data);
      var h = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0));
      parts.push(new Uint8Array(h), nm, data);
      cd.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += h.length + nm.length + data.length;
    });
    var cdl = cd.reduce(function (s, p) { return s + p.length; }, 0);
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdl), u32(off), u16(0)));
    return new Blob(parts.concat(cd, [end]), { type: "application/zip" });
  }

  // ---------- старт ----------
  // незаконченные записи (закрыли страницу посреди обработки) - помечаем ошибкой
  S.novye.concat(S.k).forEach(function (w) { (w.media || []).forEach(function (m) { if (m.st === "work") { m.st = "err"; m.err = "Обработка прервалась - добавьте файл ещё раз"; } }); });
  loadLogo().then(function () { counts(); go("master"); });
  addEventListener("beforeunload", function (e) { if (REC) { e.preventDefault(); e.returnValue = ""; } });
})();
