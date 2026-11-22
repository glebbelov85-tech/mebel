/* Закрытая витрина: главная = путешествие по дому (krasnodar/index.html).
   Этот файл грузится перед puteshestvie.js и добавляет только то, что нужно в закрытой витрине:
   полоску "Черновик" с переходом к вопросам и правкам для мастера (master/) и кнопку "Выйти".
   Клиенты эту полоску не увидят: в открытой витрине файла нет. */
(function () {
  "use strict";
  window.VP_PREVIEW = true; // показать место под видео, даже пока роликов нет
  var home = document.getElementById("home"), top = document.getElementById("htop");
  if (!home || !top) return;
  var css = document.createElement("style");
  css.textContent = [
    ".krbar{max-width:1240px;margin:0 auto;padding:calc(8px + env(safe-area-inset-top,0px)) clamp(14px,3vw,32px) 8px;display:flex;align-items:center;gap:8px 12px;font-size:13px;color:#BDB2A2}",
    ".krbar .t{flex:1;min-width:0;line-height:1.3}",
    ".krbar .t b{color:#E0B47E;font-weight:700}",
    ".krbar a,.krbar button{flex:none;display:inline-flex;align-items:center;min-height:34px;padding:0 13px;border-radius:999px;font:700 13px/1 Manrope,system-ui,sans-serif;text-decoration:none;white-space:nowrap}",
    ".krbar a{background:#E0B47E;color:#1C140B}",
    ".krbar a.dz{background:none;color:#E0B47E;border:1px solid rgba(224,180,126,.5)}",
    ".krbar button{border:1px solid rgba(244,238,228,.25);color:#BDB2A2;background:none;cursor:pointer}",
    "#home.enter .krbar{animation:rise .8s cubic-bezier(.22,1,.36,1) .2s both}",
    "@media (max-width:600px){.krbar .t span{display:none}.krbar{gap:6px}.krbar a,.krbar button{padding:0 10px}}",
    "@media (max-width:380px){.krbar .t{display:none}}"
  ].join("\n");
  document.head.appendChild(css);
  var bar = document.createElement("div");
  bar.className = "krbar";
  bar.innerHTML = '<div class="t"><b>Черновик витрины.</b> <span>Видите только вы - вход по пин-коду.</span></div>' +
    '<a href="dizajn/" class="dz">Дизайн</a><a href="master/">Вопросы и правки</a><button type="button" id="krOut">Выйти</button>';
  home.insertBefore(bar, top);
  document.getElementById("krOut").onclick = function () { if (window.KrZamok) KrZamok.logout(); };
})();
