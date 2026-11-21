/* Витрина мастера: показ работ и отзывов + режим "Для мастера".
 * Что видят все - из dannye.js (window.VITRINA). Черновики мастера (новые работы, отзывы, профиль) - в IndexedDB этого
 * браузера, пока он не выгрузит "Файл для сайта". Голос: один вопрос - ответ - "Стоп" - "Я понял так" - "Да" (как просил мастер). */
(function () {
  "use strict";
  var D = window.VITRINA || { master: {}, works: [], reviews: [], points: [] };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var tT = 0;
  function toast(t) { var el = $("toast"); el.textContent = t; el.className = "on"; clearTimeout(tT); tT = setTimeout(function () { el.className = ""; }, 3200); }
  function copy(text, msg) {
    var ok = function () { toast(msg || "Скопировано"); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, function () { fb(); ok(); }); else { fb(); ok(); }
    function fb() { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); }
  }

  // ======================= память мастера (IndexedDB) =======================
  var LOC = { master: {}, works: [], reviews: [] };
  function idb(fn) {
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise(function (res) {
      var rq = indexedDB.open("vitrina", 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("kv"); };
      rq.onsuccess = function () { try { fn(rq.result, res); } catch (e) { res(null); } };
      rq.onerror = function () { res(null); };
    });
  }
  function load() { return idb(function (db, res) { var g = db.transaction("kv").objectStore("kv").get("data"); g.onsuccess = function () { res(g.result || null); }; g.onerror = function () { res(null); }; }); }
  function save() { return idb(function (db, res) { var tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(JSON.parse(JSON.stringify(LOC)), "data"); tx.oncomplete = function () { res(true); }; tx.onerror = function () { toast("Не хватило памяти браузера"); res(false); }; }); }
  function M() { var m = {}, k; for (k in D.master) m[k] = D.master[k]; for (k in LOC.master) if (LOC.master[k] !== "" && LOC.master[k] != null) m[k] = LOC.master[k]; return m; }
  function works() { return LOC.works.map(function (w) { w.local = true; return w; }).concat(D.works || []); }
  function reviews() { return LOC.reviews.map(function (r) { r.local = true; return r; }).concat(D.reviews || []); }
  function waUrl(text) { var n = String(M().wa || "").replace(/\D/g, ""); return "https://wa.me/" + n + "?text=" + encodeURIComponent(text); }

  // ======================= картинки-примеры (пока нет настоящих фото) =======================
  function demoImg(kind) {
    var W = 800, H = 600, s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '"><defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe7dc"/><stop offset="1" stop-color="#d9cdbd"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9b8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9b8" stop-opacity="0"/></linearGradient></defs><rect width="800" height="600" fill="url(#w)"/><rect y="500" width="800" height="100" fill="#b99c7c"/>';
    var slats = function (x, y, w, h, c) { var o = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>'; for (var i = x + 8; i < x + w - 4; i += 12) o += '<rect x="' + i + '" y="' + (y + 4) + '" width="6" height="' + (h - 8) + '" fill="rgba(0,0,0,.08)"/>'; return o; };
    if (/кухня/.test(kind)) {
      var two = /2/.test(kind);
      s += '<rect x="60" y="110" width="680" height="160" fill="#6d4c33"/>' + slats(60, 110, 680, 160, two ? "#8a6446" : "#7b593d");
      s += '<rect x="60" y="270" width="680" height="16" fill="url(#g)"/><rect x="60" y="270" width="680" height="70" fill="url(#g)" opacity=".5"/>';
      s += '<rect x="40" y="330" width="720" height="18" fill="#e8e4dd"/>';
      for (var i = 0; i < 4; i++) s += '<rect x="' + (60 + i * 170) + '" y="350" width="166" height="140" fill="' + (two ? "#3c4a48" : "#efeae2") + '" stroke="#c9bfb2"/><rect x="' + (60 + i * 170) + '" y="350" width="166" height="6" fill="#999"/>';
      s += '<rect x="60" y="488" width="680" height="10" fill="url(#g)" transform="rotate(180 400 493)"/><rect x="330" y="300" width="80" height="30" rx="6" fill="#bbb"/>';
    } else if (/кровать/.test(kind)) {
      s += slats(220, 90, 360, 300, "#6b5a7d") + '<rect x="230" y="100" width="340" height="12" fill="url(#g)"/>';
      s += '<rect x="170" y="370" width="460" height="70" rx="10" fill="#f1ece4"/><rect x="190" y="340" width="120" height="40" rx="16" fill="#fff"/><rect x="490" y="340" width="120" height="40" rx="16" fill="#fff"/>';
      s += '<rect x="160" y="430" width="480" height="70" fill="#d6c8b6" stroke="#b9a68f"/><rect x="175" y="445" width="215" height="44" fill="#e6dacb"/><rect x="410" y="445" width="215" height="44" fill="#e6dacb"/>';
      s += '<rect x="80" y="400" width="70" height="100" fill="#d6c8b6"/><rect x="650" y="400" width="70" height="100" fill="#d6c8b6"/>';
    } else {
      s += '<rect x="120" y="60" width="560" height="440" fill="#e2d6c5" stroke="#bba98f"/>';
      s += '<rect x="130" y="70" width="175" height="420" fill="#efe6d8" stroke="#cdbba3"/><rect x="495" y="70" width="175" height="420" fill="#efe6d8" stroke="#cdbba3"/>';
      s += '<rect x="312" y="70" width="176" height="420" fill="#9fb6c4" stroke="#fff3cf" stroke-width="8"/><rect x="330" y="90" width="40" height="380" fill="rgba(255,255,255,.35)"/>';
      s += '<rect x="290" y="270" width="8" height="60" rx="3" fill="#8a7a66"/><rect x="502" y="270" width="8" height="60" rx="3" fill="#8a7a66"/>';
    }
    s += '<text x="780" y="585" text-anchor="end" font-family="sans-serif" font-size="18" fill="rgba(0,0,0,.35)">пример - здесь будет фото мастера</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  }
  function src(p) { return /^demo:/.test(p) ? demoImg(p.slice(5)) : p; }

  // ======================= страница =======================
  var tagOn = "";
  function render() {
    var m = M();
    document.title = (m.name || "Мебель на заказ") + (m.city ? ", " + m.city : "") + " - работы мастера";
    $("logoName").textContent = m.name || "Мебель на заказ"; $("fName").textContent = m.name || "";
    $("fCity").textContent = [m.who, m.city].filter(Boolean).join(", ");
    $("hWho").textContent = [m.who, m.city].filter(Boolean).join(" · ");
    $("hSlogan").textContent = m.slogan || ""; $("hAbout").textContent = m.about || "";
    $("hWa").href = waUrl("Здравствуйте! Видел ваши работы на сайте, хочу узнать про мебель на заказ.");
    $("demo").classList.toggle("hide", !D.demo);
    var W = works(), R = reviews().filter(function (r) { return !r.example; });
    $("hNums").innerHTML = '<div><b>' + W.length + "</b><span>" + plur(W.length, "работа", "работы", "работ") + " на витрине</span></div>" + (R.length ? "<div><b>" + R.length + "</b><span>" + plur(R.length, "отзыв", "отзыва", "отзывов") + "</span></div>" : "") + "<div><b>Под ключ</b><span>замер, проект, сборка</span></div>";
    // фильтр по тегам
    var tags = {}; W.forEach(function (w) { (w.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var tl = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; }).slice(0, 10);
    $("tags").innerHTML = tl.length > 1 ? ['<button type="button" class="chip' + (tagOn ? "" : " on") + '" data-tag="">Все</button>'].concat(tl.map(function (t) { return '<button type="button" class="chip' + (tagOn === t ? " on" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + "</button>"; })).join("") : "";
    $("grid").innerHTML = W.filter(function (w) { return !tagOn || (w.tags || []).indexOf(tagOn) >= 0; }).map(function (w) {
      var ph = (w.photos || [])[0];
      return '<button type="button" class="wk" data-work="' + esc(w.id) + '"><div class="ph">' + (ph ? '<img loading="lazy" alt="' + esc(w.t) + '" src="' + esc(src(ph)) + '">' : "") + (w.local ? '<span class="loc">Только у вас</span>' : "") + ((w.photos || []).length > 1 ? '<span class="n">' + w.photos.length + " фото</span>" : "") + '</div><div class="tx"><b>' + esc(w.t) + '</b><div class="pl">' + esc(w.place || "") + "</div>" + (w.task ? '<div class="q">' + esc(w.task) + "</div>" : "") + "</div></button>";
    }).join("") || '<p class="muted">Работ пока нет.</p>';
    $("pts").innerHTML = (D.points || []).map(function (p, i) { return '<div class="pt"><i>' + (i + 1) + "</i><b>" + esc(p.t) + "</b><p>" + esc(p.d) + "</p></div>"; }).join("");
    $("rvs").innerHTML = reviews().map(function (r) {
      return '<div class="rv' + (r.example ? " ex" : "") + '"><div class="hd"><span class="av">' + esc((r.name || "?").charAt(0).toUpperCase()) + "</span><div><b>" + esc(r.name) + (r.local ? ' <span class="tag">только у вас</span>' : "") + "</b><span>" + esc([r.work, r.city, r.date].filter(Boolean).join(" · ")) + "</span></div></div><p>" + esc(r.text) + "</p>" + (r.link ? '<a class="lk" href="' + esc(r.link) + '" target="_blank" rel="noopener nofollow">Страница автора отзыва →</a>' : "") + "</div>";
    }).join("");
    var L = (m.links || []).filter(function (l) { return l && l.u; });
    $("fLinks").innerHTML = '<a class="btn wa sm" target="_blank" rel="noopener" href="' + esc(waUrl("Здравствуйте!")) + '">WhatsApp</a>' + (m.tg ? '<a class="btn sm" target="_blank" rel="noopener" href="https://t.me/' + esc(String(m.tg).replace(/^@/, "")) + '">Telegram</a>' : "") + L.map(function (l) { return '<a class="btn sm" target="_blank" rel="noopener" href="' + esc(l.u) + '">' + esc(l.n || "Ссылка") + "</a>"; }).join("");
  }
  function plur(n, a, b, c) { n = Math.abs(n) % 100; var k = n % 10; return n > 10 && n < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; }

  // ======================= история работы =======================
  var ST = null;
  function openWork(id) {
    var w = works().filter(function (x) { return x.id === id; })[0]; if (!w) return;
    var el = document.createElement("div"); el.className = "st"; el.id = "st";
    ST = { w: w, i: 0, el: el };
    el.innerHTML = '<div class="st-box"><div class="st-ph"><div class="st-bars" id="stBars"></div><img id="stImg" alt=""><button type="button" class="st-nav l" data-st="-1" aria-label="Назад"></button><button type="button" class="st-nav r" data-st="1" aria-label="Дальше"></button><button type="button" class="st-x" data-st="x" aria-label="Закрыть">×</button></div>' +
      '<div class="st-tx"><h3>' + esc(w.t) + '</h3><div class="pl">' + esc([w.place, w.year].filter(Boolean).join(" · ")) + "</div>" +
      (w.task ? "<h4>Что хотел заказчик</h4><p>" + esc(w.task) + "</p>" : "") + (w.done ? "<h4>Что сделали</h4><p>" + esc(w.done) + "</p>" : "") +
      (w.why ? "<h4>Почему так</h4><p>" + esc(w.why) + "</p>" : "") + (w.mat ? "<h4>Материалы</h4><p>" + esc(w.mat) + "</p>" : "") +
      '<div class="btns"><a class="btn wa" target="_blank" rel="noopener" href="' + esc(waUrl("Здравствуйте! Понравилась работа \"" + w.t + "\" на вашем сайте. Хочу что-то похожее.")) + '">Хочу так же</a><a class="btn" href="#cena" data-st="x">Узнать цену</a></div></div></div>';
    document.body.appendChild(el); document.body.style.overflow = "hidden"; stShow();
  }
  function stShow() { var w = ST.w, n = (w.photos || []).length; $("stImg").src = n ? src(w.photos[ST.i]) : ""; $("stBars").innerHTML = n > 1 ? w.photos.map(function (_, j) { return '<i class="' + (j <= ST.i ? "on" : "") + '"></i>'; }).join("") : ""; }
  function stClose() { if (ST) { ST.el.remove(); ST = null; document.body.style.overflow = ""; } }

  // ======================= голос: один ответ целиком, до "Стоп" =======================
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, DI = null;
  function dictStop() { if (DI) { DI.want = false; try { DI.rec.stop(); } catch (e) {} } }
  function dictate(btn, live, done) {
    if (!SR) { toast("Этот браузер не распознаёт речь - нажмите микрофон на клавиатуре телефона и надиктуйте в поле"); return; }
    if (DI && DI.btn === btn) { dictStop(); return; }
    dictStop();
    var st = { btn: btn, want: true }, acc = "", lab = btn.textContent;
    var spawn = function () {
      var r = new SR(); st.rec = r; r.lang = "ru-RU"; r.interimResults = true; r.continuous = !/android/i.test(navigator.userAgent);
      r.onresult = function (ev) { var lv = ""; for (var i = ev.resultIndex; i < ev.results.length; i++) { var x = ev.results[i]; if (x.isFinal) { var t = x[0].transcript.trim(), stop = /(^|\s)стоп[.!]?$/i.test(t); t = t.replace(/(^|\s)стоп[.!]?$/i, "").trim(); if (t) acc = (acc + " " + t).trim(); if (stop) dictStop(); } else lv += x[0].transcript; } live((acc + " " + lv).trim()); };
      r.onerror = function (e) { if (/not-allowed|service-not-allowed|audio-capture|network/.test(e.error)) { st.want = false; toast(e.error === "network" ? "Для распознавания речи нужен интернет" : "Нет доступа к микрофону - разрешите его или пишите текстом"); } };
      r.onend = function () { if (st.want && DI === st) { try { spawn(); } catch (e) { off(); } } else off(); };
      try { r.start(); } catch (e) { off(); }
    };
    var off = function () { if (DI === st) DI = null; btn.classList.remove("on"); btn.textContent = lab; var a = acc; acc = ""; if (a) done(a); else live(""); };
    DI = st; btn.classList.add("on"); btn.textContent = "Стоп"; live(""); spawn();
  }
  function liveTxt(el) { return function (t) { el.innerHTML = t ? "Слышу: " + esc(t) + ' <span style="opacity:.6">- закончили? нажмите "Стоп"</span>' : ""; }; }

  // ======================= отзыв и запрос цены - в WhatsApp мастеру =======================
  function reviewForm() {
    var h = '<p class="muted" style="margin:0 0 10px">Напишите как есть. Отзыв уйдёт мастеру в WhatsApp, он опубликует его здесь с вашим именем. Ссылка на вашу страницу в соцсети или видео - чтобы другие видели, что отзыв настоящий.</p>' +
      '<div class="g2"><label class="f">Ваше имя <input class="t" id="rN"></label><label class="f">Город <input class="t" id="rC"></label><label class="f">Что делали <input class="t" id="rW" placeholder="Кухня, шкаф, кровать..."></label><label class="f">Когда <input class="t" id="rD" placeholder="Например: весна 2026"></label></div>' +
      '<label class="f" style="margin-top:8px">Отзыв <textarea class="t" id="rT" rows="4"></textarea></label><label class="f" style="margin-top:8px">Ссылка на вашу страницу или видео-отзыв (необязательно) <input class="t" id="rL" placeholder="https://"></label>' +
      '<div class="btns"><button type="button" class="btn mic sm" id="rMic">Сказать голосом</button><button type="button" class="btn wa" id="rSend">Отправить</button></div><div class="live" id="rLive"></div>';
    modal("Оставить отзыв", h, function (box) {
      $("rMic").onclick = function () { var ta = $("rT"); dictate(this, liveTxt($("rLive")), function (t) { ta.value = (ta.value ? ta.value.trim() + " " : "") + t; $("rLive").textContent = "Проверьте текст и нажмите \"Отправить\""; }); };
      $("rSend").onclick = function () {
        var n = $("rN").value.trim(), t = $("rT").value.trim(); if (!n || !t) { toast("Напишите имя и отзыв"); return; }
        var msg = "Отзыв для сайта\nИмя: " + n + ($("rC").value.trim() ? "\nГород: " + $("rC").value.trim() : "") + ($("rW").value.trim() ? "\nЧто делали: " + $("rW").value.trim() : "") + ($("rD").value.trim() ? "\nКогда: " + $("rD").value.trim() : "") + "\n\n" + t + ($("rL").value.trim() ? "\n\nМоя страница: " + $("rL").value.trim() : "");
        window.open(waUrl(msg), "_blank"); closeModal(); toast("Спасибо! Отзыв ушёл мастеру");
      };
    });
  }

  // ======================= окно =======================
  function modal(title, html, init) {
    closeModal();
    var el = document.createElement("div"); el.className = "md"; el.id = "md";
    el.innerHTML = '<div class="md-box"><div class="md-hd"><b>' + esc(title) + '</b><button type="button" class="x" data-close aria-label="Закрыть">×</button></div><div class="md-bd" id="mdBd">' + html + "</div></div>";
    el.addEventListener("click", function (e) { if (e.target === el || e.target.closest("[data-close]")) closeModal(); });
    document.body.appendChild(el); document.body.style.overflow = "hidden"; if (init) init(el);
  }
  function closeModal() { dictStop(); var m = $("md"); if (m) { m.remove(); document.body.style.overflow = ""; } }

  // ======================= режим мастера =======================
  // новая работа: вопросы по одному, как просил мастер
  var QS = [
    { k: "t", q: "Что сделали? Коротко, как название", ex: "Например: угловая кухня с рейкой и подсветкой" },
    { k: "place", q: "Где и для кого?", ex: "Например: квартира в новостройке, молодая семья с ребёнком" },
    { k: "task", q: "Что хотел заказчик?", ex: "Например: хотели светлую кухню без ручек и много места под посуду" },
    { k: "done", q: "Что сделали и какие решения применили?", ex: "Например: фасады с рейкой, профиль Gola, подсветка в цоколе, ящики у мойки" },
    { k: "why", q: "Почему именно так?", ex: "Например: рейка не показывает отпечатки, без ручек безопасно для ребёнка" },
    { k: "mat", q: "Материалы и фурнитура (можно пропустить)", ex: "Например: МДФ эмаль, Blum с доводчиком" }
  ];
  var NW = null;   // черновик новой работы
  function newDraft() { NW = { id: "l" + Date.now().toString(36), photos: [], ans: {}, step: 0, tags: [], big: false }; }
  function fixText(t) { t = String(t || "").trim().replace(/\s+/g, " "); if (!t) return ""; t = t.charAt(0).toUpperCase() + t.slice(1); if (!/[.!?]$/.test(t)) t += "."; return t; }
  function autoTags(w) {
    var s = (w.t + " " + w.done + " " + w.place).toLowerCase(), out = [];
    [["кухн", "кухня"], ["шкаф", "шкаф"], ["купе", "купе"], ["кроват", "кровать"], ["спальн", "спальня"], ["прихож", "прихожая"], ["гардероб", "гардероб"], ["детск", "детская"], ["ванн", "ванная"], ["рейк", "рейка"], ["подсвет", "подсветка"], ["зеркал", "зеркало"], ["тумб", "тумба"], ["стол", "стол"]].forEach(function (p) { if (s.indexOf(p[0]) >= 0 && out.indexOf(p[1]) < 0) out.push(p[1]); });
    return out.slice(0, 5);
  }
  function workFromDraft() {
    var a = NW.ans, w = { id: NW.id, t: String(a.t || "").trim().replace(/[.]$/, "") || "Новая работа", place: String(a.place || "").trim().replace(/[.]$/, ""), year: String(new Date().getFullYear()),
      task: fixText(a.task), done: fixText(a.done), why: fixText(a.why), mat: String(a.mat || "").trim().replace(/[.]$/, ""), photos: NW.photos.slice() };
    w.t = w.t.charAt(0).toUpperCase() + w.t.slice(1); w.tags = autoTags(w); return w;
  }
  function postText(w) {
    var m = M(), tags = ["мебельназаказ", "корпуснаямебель"].concat(w.tags.map(function (t) { return t.replace(/\s+/g, ""); }), m.city ? [String(m.city).toLowerCase().replace(/[^а-яa-z0-9]/gi, "")] : []);
    return [w.t + (w.place ? " - " + w.place.charAt(0).toLowerCase() + w.place.slice(1) : ""), "",
      w.task ? "Задача: " + w.task : "", w.done ? "Что сделали: " + w.done : "", w.why ? "Почему так: " + w.why : "", w.mat ? "Материалы: " + w.mat + "." : "", "",
      "Хотите так же - пишите в личные сообщения" + (m.wa ? " или в WhatsApp" : "") + ". Замер, проект, сборка под ключ.", "",
      tags.map(function (t) { return "#" + t; }).join(" ")].filter(function (x, i, arr) { return x !== "" || (arr[i - 1] !== "" && i > 0); }).join("\n").trim();
  }
  function aiPrompt(w) {
    return "Напиши живой пост для Instagram и ВКонтакте от лица мастера корпусной мебели. Без пафоса и канцелярита, коротко, 5-8 предложений, в конце призыв написать и 5-7 хэштегов.\n" +
      "Работа: " + w.t + "\nГде и для кого: " + w.place + "\nЧто хотел заказчик: " + w.task + "\nЧто сделали: " + w.done + "\nПочему так: " + w.why + (w.mat ? "\nМатериалы: " + w.mat : "") + (M().city ? "\nГород: " + M().city : "");
  }
  // водяной знак: текст внизу справа, по желанию - крупно по диагонали
  function markText() { var m = M(); return m.mark || [m.name, m.wa ? "+" + String(m.wa).replace(/\D/g, "") : ""].filter(Boolean).join(" · ") || "Мебель на заказ"; }
  function watermark(file, big) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var k = Math.min(1, 1600 / Math.max(img.width, img.height)), W = Math.round(img.width * k), H = Math.round(img.height * k);
          var c = document.createElement("canvas"); c.width = W; c.height = H; var g = c.getContext("2d");
          g.drawImage(img, 0, 0, W, H);
          var txt = markText(), fs = Math.max(16, Math.round(W / 38));
          g.font = "600 " + fs + "px system-ui, sans-serif"; g.textAlign = "right"; g.textBaseline = "bottom";
          g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = fs / 3; g.fillStyle = "rgba(255,255,255,.88)"; g.fillText(txt, W - fs * 0.8, H - fs * 0.6);
          if (big) { g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.atan2(H, W)); g.textAlign = "center"; g.textBaseline = "middle"; var bf = Math.round(Math.min(W, H) / 9); g.font = "700 " + bf + "px system-ui, sans-serif"; g.shadowBlur = 0; g.fillStyle = "rgba(255,255,255,.22)"; g.fillText(txt, 0, 0); g.restore(); }
          res(c.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = function () { rej(new Error("Не получилось открыть фото")); };
        img.src = fr.result;
      };
      fr.onerror = function () { rej(new Error("Не получилось прочитать файл")); };
      fr.readAsDataURL(file);
    });
  }
  var tab = "new";
  function master() {
    if (!NW) newDraft();
    modal("Для мастера", '<div class="tabs" id="mTabs"></div><div id="mBody"></div>', function () { mRender(); });
  }
  function mRender() {
    var T = [["new", "Новая работа"], ["mine", "Мои работы (" + LOC.works.length + ")"], ["rev", "Отзывы"], ["prof", "О себе"]];
    $("mTabs").innerHTML = T.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '">' + esc(t[1]) + "</button>"; }).join("");
    var b = $("mBody");
    if (tab === "new") b.innerHTML = mNew(); else if (tab === "mine") b.innerHTML = mMine(); else if (tab === "rev") b.innerHTML = mRev(); else b.innerHTML = mProf();
    if (tab === "new") bindNew();
  }
  function mNew() {
    var h = '<div class="card"><h3>1. Фото работы</h3><p class="muted" style="margin:0;font-size:14px">На каждое фото сразу ставится водяной знак: <b>' + esc(markText()) + '</b> (поменять - во вкладке "О себе").</p>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:14px"><input type="checkbox" id="bigMark"' + (NW.big ? " checked" : "") + '> Крупный знак по диагонали (сильнее защищает от копирования)</label>' +
      '<div class="btns"><label class="btn p sm" style="cursor:pointer">+ Добавить фото<input type="file" id="phIn" accept="image/*" multiple hidden></label></div>' +
      '<div class="ph-list">' + NW.photos.map(function (p, i) { return '<figure><img src="' + esc(p) + '" alt=""><button type="button" data-delph="' + i + '" aria-label="Убрать">×</button></figure>'; }).join("") + "</div></div>";
    var i = NW.step;
    if (i < QS.length) {
      var q = QS[i];
      h += '<div class="card ask"><div class="n">2. Рассказ · вопрос ' + (i + 1) + " из " + QS.length + '</div><div class="qq">' + esc(q.q) + '</div><div class="muted" style="font-size:13.5px">' + esc(q.ex) + "</div>" +
        '<div class="btns"><button type="button" class="btn mic" id="aMic">Сказать</button><input class="t" id="aIn" style="flex:1 1 200px;width:auto" placeholder="Или напишите"><button type="button" class="btn" id="aGo">Проверить</button>' + (i > 0 ? '<button type="button" class="btn l" id="aBack">Назад</button>' : "") + (q.k === "mat" ? '<button type="button" class="btn l" id="aSkip">Пропустить</button>' : "") + "</div>" +
        '<div class="live" id="aLive"></div><div id="aCf"></div></div>';
    }
    var done = QS.filter(function (q) { return NW.ans[q.k]; });
    if (done.length) h += '<div class="ans">' + done.map(function (q) { return "<div><span>" + esc(q.q.replace(/\?.*$/, "?").replace(/ \(.*\)$/, "")) + "</span> " + esc(NW.ans[q.k]) + ' <button type="button" class="btn l sm" data-redo="' + QS.indexOf(q) + '">изменить</button></div>'; }).join("") + "</div>";
    if (i >= QS.length) {
      var w = workFromDraft();
      h += '<div class="card" style="margin-top:14px"><h3>3. Готовый пост</h3><div class="post" id="postTx">' + esc(postText(w)) + "</div>" +
        '<div class="btns"><button type="button" class="btn p" data-a="copyPost">Скопировать текст поста</button><button type="button" class="btn" data-a="dlPh"' + (NW.photos.length ? "" : " disabled") + '>Скачать фото со знаком</button><button type="button" class="btn" data-a="copyAi">Запрос для ИИ (красивее текст)</button></div>' +
        '<div class="btns"><button type="button" class="btn ok" data-a="saveWork">Поставить на витрину</button><button type="button" class="btn l" data-a="resetNew">Начать заново</button></div>' +
        '<p class="muted" style="font-size:13px;margin:8px 0 0">На витрине работа сначала видна только в этом браузере. Чтобы её видели все - во вкладке "Мои работы" нажмите "Файл для сайта" и отправьте файл Александру.</p></div>';
    }
    return h;
  }
  function bindNew() {
    var inp = $("phIn"); if (inp) inp.onchange = function () {
      var fs = [].slice.call(inp.files || []); inp.value = ""; if (!fs.length) return; toast("Ставлю водяной знак...");
      fs.reduce(function (p, f) { return p.then(function () { return watermark(f, NW.big).then(function (d) { NW.photos.push(d); }, function (e) { toast(e.message); }); }); }, Promise.resolve()).then(function () { mRender(); toast("Фото добавлены"); });
    };
    var bm = $("bigMark"); if (bm) bm.onchange = function () { NW.big = bm.checked; if (NW.photos.length) toast("Новый знак встанет на фото, которые добавите дальше"); };
    var q = QS[NW.step]; if (!q) return;
    var propose = function (t) {
      var cf = $("aCf"); $("aLive").textContent = "";
      cf.innerHTML = '<div class="cf"><b>Я понял так:</b>' + esc(t) + '<span class="h">Можно поправить текст перед тем, как записать</span><textarea class="t" id="aFix" rows="2" style="margin-top:6px">' + esc(t) + '</textarea><div class="btns"><button type="button" class="btn ok" id="aOk">Да, дальше</button><button type="button" class="btn" id="aAgain">Нет, сказать заново</button></div></div>';
      $("aOk").onclick = function () { var v = $("aFix").value.trim(); if (!v) { toast("Ответ пустой"); return; } NW.ans[q.k] = v; NW.step++; while (NW.step < QS.length && NW.ans[QS[NW.step].k] && NW.redo) NW.step++; NW.redo = false; mRender(); };
      $("aAgain").onclick = function () { cf.innerHTML = ""; $("aMic").click(); };
    };
    $("aMic").onclick = function () { dictate(this, liveTxt($("aLive")), propose); };
    $("aGo").onclick = function () { var v = $("aIn").value.trim(); if (v) propose(v); else toast("Скажите или напишите ответ"); };
    $("aIn").onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); $("aGo").click(); } };
    if ($("aBack")) $("aBack").onclick = function () { NW.step--; mRender(); };
    if ($("aSkip")) $("aSkip").onclick = function () { NW.step++; mRender(); };
  }
  function mMine() {
    if (!LOC.works.length) return '<p class="muted">Своих работ пока нет. Добавьте во вкладке "Новая работа".</p>';
    return '<div class="lst">' + LOC.works.map(function (w, i) { return '<div class="it">' + (w.photos[0] ? '<img src="' + esc(w.photos[0]) + '" alt="">' : "") + "<div><b>" + esc(w.t) + '</b><span class="muted" style="font-size:13px">' + esc(w.place) + '</span></div><button type="button" class="btn sm" data-copyw="' + i + '">Текст поста</button><button type="button" class="btn l sm" data-delw="' + i + '">Убрать</button></div>'; }).join("") + "</div>" +
      '<div class="btns"><button type="button" class="btn p" data-a="export">Файл для сайта</button></div><p class="muted" style="font-size:13px">Файл со всеми вашими работами, отзывами и данными "О себе". Отправьте его Александру - он поставит работы на сайт, и их увидят все.</p>';
  }
  function mRev() {
    return '<p class="muted" style="margin:0 0 10px;font-size:14px">Клиенты оставляют отзыв кнопкой на витрине - он приходит вам в WhatsApp. Перенесите его сюда (можно вставить сообщение целиком).</p>' +
      '<div class="g2"><label class="f">Имя <input class="t" id="mrN"></label><label class="f">Город <input class="t" id="mrC"></label><label class="f">Что делали <input class="t" id="mrW"></label><label class="f">Когда <input class="t" id="mrD"></label></div>' +
      '<label class="f" style="margin-top:8px">Отзыв <textarea class="t" id="mrT" rows="4"></textarea></label><label class="f" style="margin-top:8px">Ссылка на страницу или видео <input class="t" id="mrL"></label>' +
      '<div class="btns"><button type="button" class="btn ok" data-a="addRev">Добавить на витрину</button></div>' +
      (LOC.reviews.length ? '<div class="lst" style="margin-top:12px">' + LOC.reviews.map(function (r, i) { return '<div class="it"><div><b>' + esc(r.name) + '</b><span class="muted" style="font-size:13px">' + esc(r.text.slice(0, 80)) + '</span></div><button type="button" class="btn l sm" data-delr="' + i + '">Убрать</button></div>'; }).join("") + "</div>" : "");
  }
  function mProf() {
    var m = M(), f = function (k, l, ph) { return '<label class="f">' + l + ' <input class="t" data-pf="' + k + '" value="' + esc(m[k] || "") + '" placeholder="' + esc(ph || "") + '"></label>'; };
    return '<div class="g2">' + f("name", "Имя или мастерская", "Мастерская Ивана") + f("city", "Город", "Алматы") + f("who", "Чем занимаетесь", "Корпусная мебель на заказ") + f("wa", "WhatsApp (цифрами)", "77011234567") + f("tg", "Telegram (ник)", "") + f("mark", "Водяной знак на фото", markText()) + "</div>" +
      '<label class="f" style="margin-top:8px">Главная фраза <input class="t" data-pf="slogan" value="' + esc(m.slogan || "") + '"></label>' +
      '<label class="f" style="margin-top:8px">О себе <textarea class="t" data-pf="about" rows="3">' + esc(m.about || "") + "</textarea></label>" +
      '<div class="g2" style="margin-top:8px">' + [0, 1, 2].map(function (i) { var l = (m.links || [])[i] || {}; return '<label class="f">Соцсеть ' + (i + 1) + ' <input class="t" data-lk="' + i + '" value="' + esc(l.u || "") + '" placeholder="https://instagram.com/..."></label>'; }).join("") + "</div>" +
      '<div class="btns"><button type="button" class="btn ok" data-a="saveProf">Сохранить</button></div>';
  }
  function linkName(u) { return /instagram/.test(u) ? "Instagram" : /vk\.com|vk\.ru/.test(u) ? "ВКонтакте" : /t\.me/.test(u) ? "Telegram" : /youtube|youtu\.be/.test(u) ? "YouTube" : /tiktok/.test(u) ? "TikTok" : /ok\.ru/.test(u) ? "Одноклассники" : /2gis/.test(u) ? "2ГИС" : "Ссылка"; }
  function download(name, url) { var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  // ======================= нажатия =======================
  document.addEventListener("click", function (e) {
    var t = e.target, b;
    if ((b = t.closest("[data-work]"))) { openWork(b.dataset.work); return; }
    if ((b = t.closest("[data-tag]"))) { tagOn = b.dataset.tag; render(); return; }
    if ((b = t.closest("[data-st]"))) { var k = b.dataset.st; if (k === "x") { stClose(); return; } var n = (ST.w.photos || []).length; if (n) { ST.i = (ST.i + (+k) + n) % n; stShow(); } return; }
    if (ST && t === ST.el) { stClose(); return; }
    if (t.id === "meBtn") { master(); return; }
    if (t.id === "rvBtn") { reviewForm(); return; }
    if ((b = t.closest("[data-tab]"))) { tab = b.dataset.tab; mRender(); return; }
    if ((b = t.closest("[data-delph]"))) { NW.photos.splice(+b.dataset.delph, 1); mRender(); return; }
    if ((b = t.closest("[data-redo]"))) { NW.step = +b.dataset.redo; NW.redo = true; mRender(); return; }
    if ((b = t.closest("[data-copyw]"))) { var w0 = LOC.works[+b.dataset.copyw]; copy(postText(w0), "Текст поста скопирован"); return; }
    if ((b = t.closest("[data-delw]"))) { LOC.works.splice(+b.dataset.delw, 1); save(); render(); mRender(); return; }
    if ((b = t.closest("[data-delr]"))) { LOC.reviews.splice(+b.dataset.delr, 1); save(); render(); mRender(); return; }
    if ((b = t.closest("[data-a]"))) {
      var a = b.dataset.a;
      if (a === "copyPost") copy($("postTx").textContent, "Текст поста скопирован - вставьте под фото в соцсети");
      else if (a === "copyAi") { copy(aiPrompt(workFromDraft()), "Запрос скопирован - вставьте в ChatGPT или другой ИИ"); }
      else if (a === "dlPh") NW.photos.forEach(function (p, i) { setTimeout(function () { download("rabota-" + (i + 1) + ".jpg", p); }, i * 300); });
      else if (a === "saveWork") { var w = workFromDraft(); if (!w.photos.length && !confirm("Работа без фото. Всё равно поставить?")) return; LOC.works.unshift(w); save(); newDraft(); render(); tab = "mine"; mRender(); toast("Работа на витрине (пока только у вас)"); }
      else if (a === "resetNew") { newDraft(); mRender(); }
      else if (a === "export") { var data = { master: LOC.master, works: LOC.works, reviews: LOC.reviews, at: new Date().toISOString() }; download("vitrina-" + new Date().toISOString().slice(0, 10) + ".json", URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }))); toast("Файл сохранён - отправьте его Александру"); }
      else if (a === "addRev") { var r = { name: $("mrN").value.trim(), city: $("mrC").value.trim(), work: $("mrW").value.trim(), date: $("mrD").value.trim(), text: $("mrT").value.trim(), link: $("mrL").value.trim() }; if (!r.name || !r.text) { toast("Нужны имя и текст отзыва"); return; } LOC.reviews.unshift(r); save(); render(); mRender(); toast("Отзыв на витрине (пока только у вас)"); }
      else if (a === "saveProf") { [].forEach.call(document.querySelectorAll("[data-pf]"), function (i) { LOC.master[i.dataset.pf] = i.value.trim(); }); LOC.master.links = [].map.call(document.querySelectorAll("[data-lk]"), function (i) { var u = i.value.trim(); return u ? { n: linkName(u), u: u } : null; }).filter(Boolean); save(); render(); toast("Сохранено"); }
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (ST) stClose(); else closeModal(); } if (ST && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { var n = (ST.w.photos || []).length; if (n) { ST.i = (ST.i + (e.key === "ArrowRight" ? 1 : -1) + n) % n; stShow(); } } });
  // запрос цены
  $("rqMic").onclick = function () { var ta = $("rqText"); dictate(this, liveTxt($("rqLive")), function (t) { ta.value = (ta.value ? ta.value.trim() + " " : "") + t; $("rqLive").textContent = "Проверьте текст и нажмите \"Отправить\""; }); };
  $("rqSend").onclick = function () { var t = $("rqText").value.trim(); if (!t) { toast("Опишите, что нужно"); return; } window.open(waUrl("Здравствуйте! Хочу узнать примерную цену.\n" + t + ($("rqCity").value.trim() ? "\nГород: " + $("rqCity").value.trim() : "") + ($("rqName").value.trim() ? "\nМеня зовут: " + $("rqName").value.trim() : "")), "_blank"); };

  render();
  load().then(function (v) { if (v) { LOC = { master: v.master || {}, works: v.works || [], reviews: v.reviews || [] }; render(); } if (/[?&]master=1/.test(location.search)) master(); });
  window.Vitrina = { postText: postText, workFromDraft: function () { return workFromDraft(); }, draft: function () { return NW; } };
})();
