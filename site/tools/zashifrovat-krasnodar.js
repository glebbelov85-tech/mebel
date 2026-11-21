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
   Фото, которые уже зашифрованы, не перешифровываются (то же имя - тот же файл), лишние .bin удаляются. */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto");

const ITER = 600000;
const args = process.argv.slice(2);
function opt(name) { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; }
function flag(name) { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; }
const pinFile = opt("--pin-file") || "/mnt/project-files/krasnodar/pin.txt";
const newSalt = flag("--new-salt");
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

fs.mkdirSync(OUT, { recursive: true });
const metaPath = path.join(OUT, "meta.json");
let meta = fs.existsSync(metaPath) && !newSalt ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;
if (!meta || meta.iter !== ITER) meta = { v: 1, iter: ITER, salt: crypto.randomBytes(16).toString("base64") };

const bits = crypto.pbkdf2Sync(Buffer.from(pin, "utf8"), Buffer.from(meta.salt, "base64"), ITER, 64, "sha256");
const aesKey = bits.subarray(0, 32), macKey = bits.subarray(32);

function seal(buf) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  return Buffer.concat([iv, c.update(buf), c.final(), c.getAuthTag()]);
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
  if (typeof x === "string") return /^foto\/[^\s]+\.(jpe?g|png|webp)$/i.test(x) ? photo(x) : x;
  if (Array.isArray(x)) return x.map(walk);
  if (x && typeof x === "object") { const o = {}; for (const k of Object.keys(x)) o[k] = walk(x[k]); return o; }
  return x;
}
const data = { v: 1, sobrano: new Date().toISOString(), vitrina: walk(V), anketa: Qs };
fs.writeFileSync(path.join(OUT, "d.bin"), seal(Buffer.from(JSON.stringify(data), "utf8")));
used.add("d.bin"); used.add("meta.json");
fs.writeFileSync(metaPath, JSON.stringify(meta) + "\n");

let removed = 0;
for (const n of fs.readdirSync(OUT)) if (!used.has(n)) { fs.unlinkSync(path.join(OUT, n)); removed++; }
console.log("Зашифровано: работ " + V.raboty.length + ", фото " + (used.size - 2) + " (новых " + fresh + ", удалено старых " + removed + "), " + Math.round(bytes / 1024) + " КБ фото.");
