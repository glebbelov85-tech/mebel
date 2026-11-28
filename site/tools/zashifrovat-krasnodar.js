#!/usr/bin/env node
/* Шифрует закрытую витрину для Краснодара (site/krasnodar/enc/).

     KR_PIN=12345678 node site/tools/zashifrovat-krasnodar.js [ПАПКА_ВИТРИНЫ] [ФАЙЛ_ВОПРОСОВ]
     node site/tools/zashifrovat-krasnodar.js --pin-file /mnt/project-files/krasnodar/pin.txt

   ПАПКА_ВИТРИНЫ - dannye.js (window.VITRINA, как у варианта 3) и foto/ рядом.
                   По умолчанию /mnt/project-files/vitrina-vk
   ФАЙЛ_ВОПРОСОВ - вопросы мастеру и текст приветствия. По умолчанию /mnt/project-files/krasnodar/voprosy.json

   Пин-код НЕ хранится в репозитории: его берут из KR_PIN или из файла (--pin-file,
   по умолчанию /mnt/project-files/krasnodar/pin.txt). В репозиторий попадают только:
     enc/meta.json  - соль и число повторов (не секрет, без них браузер не выведет ключ);
     enc/d.bin      - все тексты (данные витрины, вопросы), зашифрованы;
     enc/<id>.bin   - каждое фото отдельно, зашифровано; имя файла - HMAC от фото, по нему фото не узнать.
   Ключ: PBKDF2-SHA256 (600 000 повторов) из пин-кода и соли -> 64 байта: первые 32 - ключ AES-256-GCM,
   вторые 32 - ключ HMAC для имён фото. Файл .bin = 12 байт IV + шифротекст с меткой GCM.
   Тот же вывод ключа делает браузер (krasnodar/zamok.js) через Web Crypto.

   Соль не меняется между сборками, если не указать --new-salt (тогда мастер введёт пин заново).
   Фото, которые уже зашифрованы, не перешифровываются (то же имя - тот же файл), лишние .bin удаляются.
   Открытый вход (с 2026-11-28, по просьбе Александра): скрипт кладёт enc/otkryto.json - готовый ключ AES (тот же,
   что выводится из пин-кода), и витрина открывается без пин-кода. Вернуть пин-код: запустить с --zakryto
   (файл удалится; лучше вместе с --new-salt, чтобы старый ключ перестал работать у всех).
   Правки, которые мастер опубликовал сам (enc/m.bin, enc/p.json и фото из m.bin), не удаляются - см. ниже. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");

const ITER = 600000;
const args = process.argv.slice(2);
function opt(name) { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; }
function flag(name) { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; }
const pinFile = opt("--pin-file") || "/mnt/project-files/krasnodar/pin.txt";
const newSalt = flag("--new-salt");
const zakryto = flag("--zakryto");
const SRC = path.resolve(args[0] || "/mnt/project-files/vitrina-vk");
const QF = path.resolve(args[1] || "/mnt/project-files/krasnodar/voprosy.json");
const OUT = path.join(__dirname, "..", "krasnodar", "enc");

let pin = process.env.KR_PIN || (fs.existsSync(pinFile) ? fs.readFileSync(pinFile, "utf8") : "");
pin = String(pin).replace(/\s+/g, "");
if (!/^\d{6,}$/.test(pin)) { console.error("Нужен пин-код из 6+ цифр (KR_PIN или --pin-file)."); process.exit(1); }

// данные витрины: dannye.js выполняется в песочнице и отдаёт window.VITRINA
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SRC, "dannye.js"), "utf8"), box, { filename: "dannye.js" });
const V = box.window.VITRINA;
if (!V || !Array.isArray(V.raboty)) { console.error("В dannye.js нет window.VITRINA.raboty"); process.exit(1); }
const Qs = JSON.parse(fs.readFileSync(QF, "utf8"));

// правки из Мастерской (masterskaya/): pravki.json из ZIP-пакета кладут в папку витрины как pravki-mastera.json
// (или pravki-ГГГГММДД-ЧЧММ.json - несколько пакетов применяются по порядку имён), фото и видео - в foto/.
// dannye.js при этом не меняется: правки подмешиваются только в зашифрованную копию.
const Sloj = require(path.join(__dirname, "..", "krasnodar", "sloj.js"));
const pravki = fs.readdirSync(SRC).filter((n) => /^pravki.*\.json$/i.test(n)).sort();
for (const n of pravki) {
  let P;
  try { P = JSON.parse(fs.readFileSync(path.join(SRC, n), "utf8")); } catch (e) { console.error("Не читается " + n + ": " + e.message); process.exit(1); }
  const c = Sloj.apply(V, P, (t) => console.warn(n + ": " + t));
  console.log(n + ": новых работ " + c.raboty + ", фото " + c.foto + ", видео " + c.video + (c.skryto ? ", скрыто " + c.skryto : ""));
}

fs.mkdirSync(OUT, { recursive: true });
const metaPath = path.join(OUT, "meta.json");
const oldMeta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;
let meta = oldMeta && !newSalt ? oldMeta : null;
if (!meta || meta.iter !== ITER) meta = { v: 1, iter: ITER, salt: crypto.randomBytes(16).toString("base64") };

const bits = crypto.pbkdf2Sync(Buffer.from(pin, "utf8"), Buffer.from(meta.salt, "base64"), ITER, 64, "sha256");
const aesKey = bits.subarray(0, 32), macKey = bits.subarray(32);

function seal(buf, key) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key || aesKey, iv);
  return Buffer.concat([iv, c.update(buf), c.final(), c.getAuthTag()]);
}
function unseal(buf, key) {
  const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]);
}

// Слой мастера: enc/m.bin (что мастер опубликовал сам из Мастерской) и его фото enc/<id>.bin, настройка публикации
// enc/p.json. Их пишет в репозиторий сама Мастерская - сборка их не трогает и не удаляет. Если сменился пин или соль,
// слой и фото мастера перешифровываются новым ключом (старый пин - KR_OLD_PIN, если он тоже сменился).
const keepSloj = new Set(["p.json"]);
const mPath = path.join(OUT, "m.bin");
if (fs.existsSync(mPath) && oldMeta) {
  const oldPin = String(process.env.KR_OLD_PIN || pin).replace(/\s+/g, "");
  const oldKey = crypto.pbkdf2Sync(Buffer.from(oldPin, "utf8"), Buffer.from(oldMeta.salt, "base64"), oldMeta.iter, 64, "sha256").subarray(0, 32);
  let sloj;
  try { sloj = JSON.parse(unseal(fs.readFileSync(mPath), oldKey).toString("utf8")); }
  catch (e) { console.error("enc/m.bin (правки мастера) не расшифровывается. Если пин сменили - запустите с KR_OLD_PIN=<старый пин>."); process.exit(1); }
  const ids = Object.keys(Sloj.refs(sloj));
  const same = oldKey.equals(aesKey);
  if (!same) {
    fs.writeFileSync(mPath, seal(Buffer.from(JSON.stringify(sloj), "utf8")));
    ids.forEach((id) => { const f = path.join(OUT, id + ".bin"); if (fs.existsSync(f)) fs.writeFileSync(f, seal(unseal(fs.readFileSync(f), oldKey))); });
  }
  keepSloj.add("m.bin"); ids.forEach((id) => keepSloj.add(id + ".bin"));
  console.log("Правки мастера (m.bin): работ " + (sloj.novye_raboty || []).length + ", файлов " + ids.length + (same ? "" : " - перешифрованы новым ключом"));
}

// фото: каждая строка вида "foto/..." в данных -> "@<id>", файл шифруется в enc/<id>.bin
const used = new Set();
let fresh = 0, bytes = 0;
function photo(rel) {
  const file = path.join(SRC, rel);
  if (!fs.existsSync(file)) { console.warn("нет файла", rel, "- пропускаю"); return ""; }
  const buf = fs.readFileSync(file);
  const id = crypto.createHmac("sha256", macKey).update(buf).digest("hex").slice(0, 24);
  const out = path.join(OUT, id + ".bin");
  if (!fs.existsSync(out)) { fs.writeFileSync(out, seal(buf)); fresh++; }
  used.add(id + ".bin"); bytes += buf.length;
  return "@" + id;
}
function walk(x) {
  if (typeof x === "string") return /^foto\/[^\s]+\.(jpe?g|png|webp|svg|mp4|webm)$/i.test(x) ? photo(x) : x; // фото, знак (svg), фоновое видео
  if (Array.isArray(x)) return x.map(walk);
  if (x && typeof x === "object") { const o = {}; for (const k of Object.keys(x)) o[k] = walk(x[k]); return o; }
  return x;
}
const data = { v: 1, sobrano: new Date().toISOString(), vitrina: walk(V), anketa: Qs };
fs.writeFileSync(path.join(OUT, "d.bin"), seal(Buffer.from(JSON.stringify(data), "utf8")));
used.add("d.bin"); used.add("meta.json");
if (!zakryto) { fs.writeFileSync(path.join(OUT, "otkryto.json"), JSON.stringify({ v: 1, salt: meta.salt, k: aesKey.toString("base64") }) + "\n"); used.add("otkryto.json"); }
keepSloj.forEach((n) => used.add(n));
fs.writeFileSync(metaPath, JSON.stringify(meta) + "\n");

let removed = 0;
for (const n of fs.readdirSync(OUT)) if (!used.has(n)) { fs.unlinkSync(path.join(OUT, n)); removed++; }
console.log("Зашифровано: работ " + V.raboty.length + ", фото " + (used.size - 2 - (zakryto ? 0 : 1) - keepSloj.size) + " (новых " + fresh + ", удалено старых " + removed + "), " + Math.round(bytes / 1024) + " КБ фото.");
