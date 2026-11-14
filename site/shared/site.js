/*
 * Общая часть сайта "Мебельный конструктор".
 * Подключается в каждый инструмент перед его адаптером.
 *
 * Что делает:
 *  - рисует верхнюю полоску: на главную, название инструмента, кнопка "Передать заказ";
 *  - передаёт заказ (общий формат mebel-order) между инструментами через память браузера
 *    (localStorage, один сайт - одна память), без копирования текста;
 *  - когда инструмент открыт с ?from=..., сам открывает в нём переданный заказ.
 *
 * Инструмент сообщает о себе так:
 *   MebelSite.register({
 *     get(),      // текущий заказ инструмента в общем формате, или null
 *     put(order), // открыть переданный заказ (можно бросить Error с понятным текстом)
 *     empty,      // что сказать, если get() вернул null
 *     extra       // [{label, run}] - дополнительные пункты меню
 *   });
 */
(function () {
  "use strict";
  var KEY = "mebel-site-order";      // {order, from, at}
  var STAFF = "mebel-site-staff";    // "1" - этим браузером пользуется мастер, а не клиент

  var TOOLS = [
    { id: "kalkulyator", name: "Калькулятор", full: "Калькулятор мебели", desc: "Шкафы-купе, кухни и любые корпусные изделия: детали, материалы и цена в рублях, тенге или другой валюте. Можно описать заказ голосом." },
    { id: "konfigurator", name: "Конфигуратор", full: "Конфигуратор для клиента", desc: "Клиент сам подбирает размеры, цвета фасадов и столешницу в 3D и отправляет заявку в WhatsApp." },
    { id: "kp", name: "КП и договор", full: "КП и договор в PDF", desc: "Коммерческое предложение и договор с вашими реквизитами - готовый PDF для клиента." },
    { id: "raskroy", name: "Раскрой", full: "Карта раскроя", desc: "Раскладка деталей по листам ЛДСП с учётом пропила, текстуры и остатков. Этикетки на детали." },
    { id: "zakazy", name: "Учёт заказов", full: "Учёт заказов", desc: "Все заказы по этапам: замер, договор, производство, монтаж. Оплаты, расходы и напоминания." }
  ];

  var me = window.MEBEL_TOOL || "home";
  var adapter = null, queued = [];

  // --- память ---
  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.order ? v : null; } catch (e) { return null; } }
  function write(order, from) {
    var rec = { order: order, from: from, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(rec)); return true; }
    catch (e) { toast("Не хватило памяти браузера, чтобы передать заказ. Сохраните его файлом."); return false; }
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function isStaff() { try { return localStorage.getItem(STAFF) === "1"; } catch (e) { return false; } }
  function setStaff() { try { localStorage.setItem(STAFF, "1"); } catch (e) {} }

  // --- мелочи ---
  function tool(id) { for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) return TOOLS[i]; return null; }
  function toolName(id) { var t = tool(id); return t ? t.name : id === "home" ? "Главная" : id === "file" ? "Файл" : id; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function root() { return me === "home" ? "./" : "../"; }
  function urlOf(id) { return root() + id + "/"; }
  function money(n, cur) {
    if (window.MebelOrder) return MebelOrder.money(n, cur || MebelOrder.region().currency);
    n = Math.round(+n || 0); return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
  }
  function summary(order) {
    if (!order) return null;
    var p = (order.products || [])[0] || {};
    var title = order.title || p.name || "Заказ";
    if (order.number) title = "№ " + order.number + " - " + title;
    var q = order.quote || {};
    return { title: title, client: (order.client && order.client.name) || "", total: q.total || 0, cur: order.currency || "KZT", products: (order.products || []).length };
  }
  function ago(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (!(d >= 0)) return "";
    if (d < 1) return "только что";
    if (d < 60) return Math.round(d) + " мин. назад";
    if (d < 60 * 24) return Math.round(d / 60) + " ч. назад";
    return new Date(iso).toLocaleDateString("ru-RU");
  }
  var toastT = 0;
  function toast(text) {
    var el = document.getElementById("msToast");
    if (!el) { el = document.createElement("div"); el.id = "msToast"; document.body.appendChild(el); }
    el.textContent = text; el.className = "on";
    clearTimeout(toastT); toastT = setTimeout(function () { el.className = ""; }, 3200);
  }

  // --- передача ---
  function currentOrder() {
    // свежий заказ из инструмента; если инструмент сам заказ не собирает - тот, что в него пришёл
    if (adapter && adapter.get) {
      var o = adapter.get();
      if (o) return o;
      if (!adapter.fallback) return null;
    }
    var rec = read();
    return rec ? rec.order : null;
  }
  function send(target) {
    var o;
    try { o = currentOrder(); } catch (e) { toast(e.message || "Не получилось собрать заказ"); return; }
    if (!o) { toast((adapter && adapter.empty) || "Здесь пока нет заказа, который можно передать"); return; }
    if (!write(o, me)) return;
    location.href = urlOf(target) + "?from=" + encodeURIComponent(me);
  }
  function download() {
    var o;
    try { o = currentOrder(); } catch (e) { toast(e.message); return; }
    if (!o) { toast((adapter && adapter.empty) || "Здесь пока нет заказа"); return; }
    saveFile(o);
  }
  function saveFile(o) {
    var name = window.MebelOrder && MebelOrder.fileName ? MebelOrder.fileName(o) : "zakaz.mebel.json";
    var blob = new Blob([JSON.stringify(o, null, 1)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function receive(rec, quiet) {
    if (!adapter || !adapter.put) return;
    try {
      var r = adapter.put(rec.order);
      Promise.resolve(r).then(function (res) {
        if (res !== false && !quiet) toast("Открыт заказ из инструмента \"" + toolName(rec.from) + "\"");
      }, function (e) { toast(e && e.message ? e.message : "Не получилось открыть заказ"); });
    } catch (e) { toast(e && e.message ? e.message : "Не получилось открыть заказ"); }
  }
  function incoming() {
    var m = /[?&]from=([^&#]*)/.exec(location.search);
    if (!m) return;
    // убираем ?from= из адреса, чтобы обновление страницы не открывало заказ ещё раз
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    var rec = read();
    if (!rec) return;
    // даём инструменту закончить свой запуск
    setTimeout(function () { receive(rec); }, 60);
  }

  // --- полоска сверху и меню ---
  function bar() {
    var t = tool(me);
    var el = document.createElement("div");
    el.id = "msBar";
    var host = adapter && adapter.mount ? document.querySelector(adapter.mount) : null;
    if (host) el.className = "inline";
    el.innerHTML =
      '<a class="ms-home" href="' + root() + '" title="Все инструменты"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 4h8v7H3zM13 4h8v4h-8zM13 10h8v10h-8zM3 13h8v7H3z"/></svg><span>Все инструменты</span></a>' +
      '<span class="ms-name">' + esc(t ? t.full : "") + "</span>" +
      '<button type="button" class="ms-send" id="msSend" title="Передать заказ в другой инструмент"><svg class="ms-ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M14 4l7 7-7 7v-4c-5 0-8.5 1.6-11 5 1-5 4-10 11-11z"/></svg><span>Передать заказ</span><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg></button>';
    if (host) host.insertBefore(el, host.firstChild); else document.body.insertBefore(el, document.body.firstChild);
    document.getElementById("msSend").onclick = openMenu;
  }
  function openMenu() {
    closeMenu();
    var rec = read();
    var h = '<div class="ms-card" role="dialog" aria-label="Передать заказ"><div class="ms-head"><b>Передать заказ</b><button type="button" class="ms-x" data-x aria-label="Закрыть">×</button></div>';
    h += '<p class="ms-note">Заказ откроется в выбранном инструменте. Копировать ничего не нужно.</p><div class="ms-list">';
    TOOLS.forEach(function (t) {
      if (t.id === me) return;
      h += '<button type="button" data-to="' + t.id + '"><b>' + esc(t.full) + "</b><span>" + esc(t.desc) + "</span></button>";
    });
    h += "</div>";
    var extra = (adapter && adapter.extra) || [];
    h += '<div class="ms-more">';
    extra.forEach(function (x, i) { h += '<button type="button" data-extra="' + i + '">' + esc(x.label) + "</button>"; });
    h += '<button type="button" data-dl>Скачать файл заказа (.mebel.json)</button>';
    if (rec && rec.from !== me && adapter && adapter.put) {
      var s = summary(rec.order);
      h += '<button type="button" data-last>Открыть здесь последний переданный заказ: ' + esc(s.title) + (s.client ? ", " + esc(s.client) : "") + " (" + esc(toolName(rec.from)) + ", " + esc(ago(rec.at)) + ")</button>";
    }
    h += "</div></div>";
    var wrap = document.createElement("div");
    wrap.id = "msMenu"; wrap.innerHTML = h;
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap || e.target.closest("[data-x]")) return closeMenu();
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.to) { closeMenu(); send(b.dataset.to); }
      else if (b.hasAttribute("data-dl")) { closeMenu(); download(); }
      else if (b.hasAttribute("data-last")) { closeMenu(); receive(read()); }
      else if (b.dataset.extra) { closeMenu(); try { Promise.resolve(extra[+b.dataset.extra].run()).catch(function (er) { toast(er.message || String(er)); }); } catch (er) { toast(er.message || String(er)); } }
    });
    document.body.appendChild(wrap);
    document.addEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") closeMenu(); }
  function closeMenu() { var m = document.getElementById("msMenu"); if (m) m.remove(); document.removeEventListener("keydown", escClose); }

  // --- запуск ---
  function start() {
    if (me === "home") { setStaff(); return; }
    var fromHub = /[?&]from=/.test(location.search);
    // конфигуратор - страница для клиента: полоску видит только мастер (кто уже заходил на сайт)
    if (me !== "konfigurator" || isStaff() || fromHub) { setStaff(); bar(); }
    incoming();
  }

  window.MebelSite = {
    TOOLS: TOOLS, tool: tool, toolName: toolName, read: read, write: write, clear: clear,
    summary: summary, ago: ago, money: money, toast: toast, saveFile: saveFile, urlOf: urlOf, isStaff: isStaff,
    register: function (a) {
      adapter = a || {};
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
      else start();
    }
  };
  // страница без адаптера (главная) запускается сама
  if (me === "home") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  }
})();
