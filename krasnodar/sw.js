/* Служебный работник закрытой витрины: отдаёт расшифрованные фото по адресу f/<id>.jpg.
   Берёт зашифрованный enc/<id>.bin и ключ из IndexedDB (его кладёт zamok.js после ввода пин-кода).
   Нет ключа - нет фото. Все остальные запросы не трогает. */
"use strict";
var BASE = self.registration.scope; // .../krasnodar/
var memo = new Map(), MAX = 60;

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

function getKey() {
  return new Promise(function (ok) {
    var r = indexedDB.open("kr-zamok", 1);
    r.onupgradeneeded = function () { r.result.createObjectStore("k"); };
    r.onerror = function () { ok(null); };
    r.onsuccess = function () {
      try {
        var q = r.result.transaction("k").objectStore("k").get("aes");
        q.onsuccess = function () { ok(q.result || null); };
        q.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    };
  });
}
function mime(buf) {
  var u = new Uint8Array(buf, 0, 12);
  if (u[0] === 0x89 && u[1] === 0x50) return "image/png";
  if (u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50) return "image/webp";
  return "image/jpeg";
}
function photo(id) {
  // ключ читаем каждый раз заново: после "Выйти" или нового пина старый не должен работать
  return getKey().then(function (rec) {
    if (!rec || !rec.key) { memo.clear(); throw new Error("нет ключа"); }
    var c = memo.get(id);
    if (c && c.salt === rec.salt) return c;
    return fetch(BASE + "enc/" + id + ".bin").then(function (r) {
      if (!r.ok) throw new Error("нет файла");
      return r.arrayBuffer();
    }).then(function (buf) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(buf, 0, 12) }, rec.key, new Uint8Array(buf, 12));
    }).then(function (plain) {
      var it = { body: plain, type: mime(plain), salt: rec.salt };
      memo.set(id, it);
      if (memo.size > MAX) memo.delete(memo.keys().next().value);
      return it;
    });
  });
}

self.addEventListener("message", function (e) { if (e.data === "kr-forget") { memo.clear(); } });

self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (u.href.indexOf(BASE + "f/") !== 0) return;
  var m = /f\/([0-9a-f]{8,})\.jpg$/.exec(u.pathname);
  if (!m) return;
  e.respondWith(photo(m[1]).then(function (it) {
    return new Response(it.body.slice(0), { headers: { "Content-Type": it.type, "Cache-Control": "no-store" } });
  }).catch(function () {
    return new Response("", { status: 403 });
  }));
});
