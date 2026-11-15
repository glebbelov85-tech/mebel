// ============================================================
// ПРАВКА ШКАФОВ КУХНИ: выбор, замена, ширина, перестановка, план, голос
// Слот шкафа - "стена:ряд:номер" (ряд lower/upper), "стена:ряд:add" - свободное место в конце ряда.
// Пока клиент только меняет типы, расстановка остаётся автоматической (замены в k.over).
// Перестановка и ширина переводят кухню в ручную расстановку (k.manual).
// ============================================================
let undoStack = [];
function pushUndo() { undoStack.push(JSON.stringify(S.kitchen)); if (undoStack.length > 40) undoStack.shift(); }
function undo() {
  if (!undoStack.length) { toast("Отменять нечего"); return false; }
  S.kitchen = JSON.parse(undoStack.pop()); if (selSlot && !slotInfo(selSlot)) selSlot = null; toast("Отменено"); return true;
}

function slotInfo(slot) {
  if (!slot || S.type !== "kitchen") return null;
  const p = String(slot).split(":"); if (p.length !== 3) return null;
  const k = S.kitchen, wi = +p[0], row = p[1], W = kitchenWalls(k), lay = kitchenLayout(k);
  if (!W[wi] || !lay[wi] || (row !== "lower" && row !== "upper")) return null;
  const list = lay[wi][row];
  if (p[2] === "add") {
    const ghost = (cur && cur.info && cur.info.ghosts || []).find(g => g.slot === slot);
    return ghost ? { wi, row, i: list.length, add: true, free: ghost.w, wall: W[wi], list, m: { t: EMPTY[row].split(":")[0], what: row === "lower" ? "empty" : undefined, w: ghost.w } } : null;
  }
  const i = +p[2], m = list[i];
  return m ? { wi, row, i, m, wall: W[wi], list } : null;
}
// ряд для правки: при ручной расстановке - сам k.manual
function manualRow(wi, row) { return manualize()[wi][row]; }
// верхний ряд следует за нижним, если его не меняли руками (или если появился/пропал пенал)
function followUpper(wi, change) {
  const k = S.kitchen, man = manualize(), wall = kitchenWalls(k)[wi];
  const was = JSON.stringify(man[wi].upper), auto = JSON.stringify(autoUpper(JSON.parse(JSON.stringify(man[wi].lower)), wall));
  const talls0 = man[wi].lower.map(isTall).join();
  change();
  if (k.opts.upper && (was === auto || talls0 !== man[wi].lower.map(isTall).join())) man[wi].upper = autoUpper(JSON.parse(JSON.stringify(man[wi].lower)), wall);
}

// заменить тип шкафа (или поставить шкаф на пустое место); возвращает слот выбранного шкафа
function setType(slot, v) {
  const k = S.kitchen, s = slotInfo(slot); if (!s || !choiceOk(s.row, v)) return slot;
  if (s.add) {   // свободное место в конце ряда
    const row = manualRow(s.wi, s.row), def = (s.row === "lower" ? LOWER : UPPER)[v.split(":")[0]] || {};
    const w = Math.max(150, Math.min(1400, Math.min(s.free, def.w || 600)));
    const m = { t: "shelf", w }; setMod(m, v);
    if (s.row === "lower") followUpper(s.wi, () => row.push(m)); else row.push(m);
    return s.wi + ":" + s.row + ":" + (row.length - 1);
  }
  if (isCorner(s.m) && v !== EMPTY[s.row]) return slot;
  const tallChange = s.row === "lower" && isTall(s.m) !== !!(LOWER[v.split(":")[0]] || {}).tall;
  if (k.manual || isCorner(s.m)) {
    const m = manualRow(s.wi, s.row)[s.i];
    if (s.row === "lower") followUpper(s.wi, () => setMod(m, v)); else setMod(m, v);
  } else {
    k.over = k.over || {};
    if (tallChange) Object.keys(k.over).forEach(key => { if (key.indexOf(s.wi + ":upper:") === 0) delete k.over[key]; });
    k.over[slot] = v;
  }
  return slot;
}

// поменять ширину; разницу забирает или отдаёт сосед в том же ряду
function setWidth(slot, w) {
  const s = slotInfo(slot); if (!s || s.add) return "";
  w = Math.max(150, Math.min(1400, Math.round(w / 10) * 10));
  const d = w - s.m.w; if (!d) return "";
  let msg = "";
  const apply = () => {
    const row = manualRow(s.wi, s.row), m = row[s.i];
    const okN = n => n && !isCorner(n) && !isTall(n) === !isTall(m) && n.w - d >= (isEmptyMod(n) ? 150 : 300) && n.w - d <= 1400;
    const n = [row[s.i + 1], row[s.i - 1]].find(okN);
    if (n) { n.w -= d; msg = (s.i + 1 < row.length && n === row[s.i + 1] ? "Шкаф справа" : "Шкаф слева") + " стал " + cm(n.w); }
    else msg = d < 0 ? "Освободилось место - на нём появился \"+\"" : "Ряд стал длиннее - проверьте, помещается ли";
    m.w = w;
  };
  if (s.row === "lower") followUpper(s.wi, apply); else apply();
  return msg;
}

// поменять два шкафа местами (тот же ряд одной стены - целиком, разные стены - только типы)
function swapSlots(a, b) {
  const A = slotInfo(a), B = slotInfo(b);
  if (!A || !B || A.add || B.add || a === b || A.row !== B.row || isCorner(A.m) || isCorner(B.m)) return null;
  const run = () => {
    const man = manualize();
    if (A.wi === B.wi) { const r = man[A.wi][A.row], t = r[A.i]; r[A.i] = r[B.i]; r[B.i] = t; }
    else { const ma = man[A.wi][A.row][A.i], mb = man[B.wi][B.row][B.i], ka = modKey(ma), kb = modKey(mb); setMod(ma, kb); setMod(mb, ka); }
  };
  if (A.row === "lower") { manualize(); followUpper(A.wi, () => { if (A.wi === B.wi) run(); else followUpper(B.wi, run); }); } else run();
  return b;
}
// сдвинуть на шаг влево (-1) или вправо (+1); возвращает новый слот
function moveStep(slot, dir) {
  const s = slotInfo(slot); if (!s || s.add) return null;
  const j = s.i + dir, n = s.list[j];
  if (!n || isCorner(n)) { toast(dir < 0 ? "Левее двигать некуда" : "Правее двигать некуда"); return null; }
  return swapSlots(slot, s.wi + ":" + s.row + ":" + j);
}

// заполнить пустые места шкафами; rows - ["upper"], ["lower"] или оба. Возвращает, сколько поставили
function fillEmpty(rows) {
  const k = S.kitchen; let n = 0;
  const ghosts = (cur && cur.info && cur.info.ghosts) || [];
  if (!k.manual) {
    Object.keys(k.over || {}).forEach(key => { const r = key.split(":")[1]; if (rows.includes(r) && k.over[key] === EMPTY[r]) { delete k.over[key]; n++; } });
    return n;
  }
  ghosts.forEach(g => {
    const p = g.slot.split(":"); if (!rows.includes(p[1])) return;
    const fill = p[1] === "lower" ? "shelf" : "u_shelf";
    if (p[2] === "add") { const row = k.manual[+p[0]][p[1]]; if (g.w >= 150) { const m = { t: fill, w: Math.min(1400, Math.round(g.w)) }; if (p[1] === "lower") followUpper(+p[0], () => row.push(m)); else row.push(m); n++; } }
    else { const m = k.manual[+p[0]][p[1]][+p[2]]; if (m && isEmptyMod(m)) { if (p[1] === "lower") followUpper(+p[0], () => setMod(m, fill)); else setMod(m, fill); n++; } }
  });
  return n;
}
function setUpper(on, hu) {
  const k = S.kitchen, o = k.opts; pushUndo();
  o.upper = on; if (on && hu >= 600) o.Hu = hu;
  if (k.manual) k.manual.forEach((w, wi) => { if (!on) w.upper = []; else if (!w.upper.length) w.upper = autoUpper(JSON.parse(JSON.stringify(w.lower)), kitchenWalls(k)[wi]); });
}
// ручная расстановка: подогнать ширины шкафов под новую длину стены
function fitManual(k) {
  const W = kitchenWalls(k);
  const fit = (row, len, flexT) => {
    let d = len - row.reduce((a, m) => a + (+m.w || 0), 0);
    const flex = row.filter(m => flexT.includes(m.t) || isEmptyMod(m));
    for (let pass = 0; pass < 3 && Math.abs(d) >= 10 && flex.length; pass++) {
      flex.forEach((m, i) => {
        const left = flex.length - i, want = Math.round(d / left / 10) * 10 || (Math.abs(d) >= 10 ? Math.sign(d) * 10 : 0);
        const nw = Math.max(isEmptyMod(m) ? 150 : 300, Math.min(1400, m.w + want)); d -= nw - m.w; m.w = nw;
      });
    }
  };
  k.manual.forEach((r, wi) => {
    const w = W[wi]; if (!w) return;
    fit(r.lower, w.lowLen, ["shelf", "drawers3", "drawers2"]);
    const talls = r.lower.filter(isTall).reduce((a, m) => a + m.w, 0);
    if (r.upper.length) fit(r.upper, w.upLen - talls, ["u_shelf", "u_open", "u_lift", "u_dryer"]);
  });
}

// ---------- 2D-план: стены, шкафы сверху и снизу, перетаскивание ----------
function planHtml(sel) {
  if (S.type !== "kitchen" || S.lock) return "";
  const k = S.kitchen, W = kitchenWalls(k), lay = kitchenLayout(k), ghosts = (cur && cur.info && cur.info.ghosts) || [];
  return '<div class="plan">' + W.map((w, wi) => {
    const r = lay[wi], len = Math.max(w.len, 1), pc = v => (v / len * 100).toFixed(3) + "%";
    let h = "", x = 0; const talls = [];
    const blk = (slot, m, x0, ww, cls) => '<button class="pb ' + cls + (slot === sel ? " sel" : "") + (isCorner(m) ? " fixed" : "") + '" data-slot="' + slot + '" style="left:' + pc(x0) + ";width:" + pc(ww) + '" title="' + esc(modTitle(m) + ", " + cm(ww)) + '"><span>' + esc(SHORT[modKey(m)] || "Шкаф") + "</span></button>";
    r.lower.forEach((m, i) => {
      const ww = Math.max(150, Math.min(1400, +m.w || 600)), tall = isTall(m);
      if (tall) talls.push([x, x + ww]);
      h += blk(wi + ":lower:" + i, m, x, ww, (tall ? "tall" : "lo") + (isEmptyMod(m) ? " empty" : "") + (m.t === "sink" || m.what === "stove" || m.t === "oven" || m.what === "fridge" || m.t === "fridge" ? " key" : ""));
      x += ww;
    });
    let ux = 0;
    r.upper.forEach((m, i) => {
      const ww = Math.max(150, Math.min(1400, +m.w || 600));
      let mv = true; while (mv) { mv = false; for (const [a, b] of talls) if (ux < b - 0.5 && ux + ww > a + 0.5) { ux = b; mv = true; } }
      h += blk(wi + ":upper:" + i, m, ux, ww, "up" + (isEmptyMod(m) ? " empty" : ""));
      ux += ww;
    });
    ghosts.filter(g => g.slot.indexOf(wi + ":") === 0 && /:add$/.test(g.slot)).forEach(g => {
      const lower = g.slot.indexOf(":lower:") > 0, x0 = lower ? x : Math.min(ux, w.len - g.w);
      h += '<button class="pb ' + (lower ? "lo" : "up") + ' empty' + (g.slot === sel ? " sel" : "") + '" data-slot="' + g.slot + '" style="left:' + pc(x0) + ";width:" + pc(g.w) + '" title="Свободно ' + cm(g.w) + '"><span>+</span></button>';
    });
    if (w.next) h += '<i class="pcorner" style="left:' + pc(w.lowLen) + ";width:" + pc(w.len - w.lowLen) + '" title="Угол: тут стоит угловой шкаф следующей стены"></i>';
    return '<div class="pwall"><div class="pwh">' + WALL_NAME[w.key] + "<span>" + cm(w.len) + "</span></div><div class=\"prow2\">" + h + "</div></div>";
  }).join("") + "</div>";
}
// нажатие и перетаскивание на плане
(function () {
  let drag = null;
  document.addEventListener("pointerdown", e => {
    const b = e.target.closest(".plan .pb"); if (!b || e.button > 0) return;
    drag = { b, slot: b.dataset.slot, x: e.clientX, y: e.clientY, on: false, ghost: null, over: null, id: e.pointerId };
  });
  document.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return;
      const s = slotInfo(drag.slot);
      if (!s || s.add || isCorner(s.m) || isEmptyMod(s.m)) { drag = null; return; }
      drag.on = true; drag.row = s.row; drag.b.classList.add("drag");
      const g = drag.ghost = drag.b.cloneNode(true); g.className += " fly"; g.style.width = drag.b.offsetWidth + "px"; g.style.left = g.style.top = "0"; document.body.appendChild(g);
    }
    e.preventDefault();
    drag.ghost.style.transform = "translate(" + (e.clientX - drag.ghost.offsetWidth / 2) + "px," + (e.clientY - 20) + "px)";
    drag.ghost.style.display = "none"; const el = document.elementFromPoint(e.clientX, e.clientY); drag.ghost.style.display = "";
    const t = el && el.closest(".plan .pb"), ts = t && t.dataset.slot, ti = ts && ts !== drag.slot && slotInfo(ts);
    const ok = ti && !ti.add && ti.row === drag.row && !isCorner(ti.m) ? t : null;
    if (drag.over !== ok) { if (drag.over) drag.over.classList.remove("target"); drag.over = ok; if (ok) ok.classList.add("target"); }
  }, { passive: false });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    if (!d.on) { if (e.type === "pointerup") { selSlot = d.slot; tab = 0; render(); $("body").scrollTop = 0; } return; }
    d.b.classList.remove("drag");
    if (d.over) { pushUndo(); const r = swapSlots(d.slot, d.over.dataset.slot); if (r) { selSlot = r; render(); rebuild(); toast("Поменяли местами"); } else undoStack.pop(); }
  };
  document.addEventListener("pointerup", end); document.addEventListener("pointercancel", end);
  // правый клик мышью и долгое нажатие пальцем на плане - то же меню шкафа
  document.addEventListener("contextmenu", e => {
    const b = e.target.closest(".plan .pb"); if (!b) return;
    e.preventDefault(); if (drag && drag.ghost) drag.ghost.remove(); drag = null;
    selSlot = b.dataset.slot; tab = 0; render(); $("body").scrollTop = 0;
  });
})();

// панель выбранного шкафа (вместо вкладки)
function modPanel() {
  const s = slotInfo(selSlot), k = S.kitchen, m = s.m, empty = s.add || isEmptyMod(m), corner = isCorner(m);
  const kind = s.row === "upper" ? "Верхний шкаф" : isTall(m) ? "Пенал" : "Нижний шкаф";
  const pos = s.add ? "в конце ряда" : (s.i + 1) + "-й слева";
  let h = '<div class="mhead"><button class="linkbtn" data-a="selClose">← Все настройки</button>' + (undoStack.length ? '<button class="linkbtn" data-a="undo">Отменить</button>' : "") + "</div>";
  h += '<div class="mtitle"><b>' + (empty ? "Пустое место" : esc(modTitle(m))) + "</b><span>" + (empty ? (s.row === "upper" ? "сверху" : "снизу") : kind) + ", " + cm(s.add ? s.free : m.w) + " · " + WALL_NAME[s.wall.key].toLowerCase() + ", " + pos + "</span></div>";
  h += planHtml(selSlot);
  const list = s.row === "upper" ? CHOICE.upper : CHOICE.lower;
  if (corner) h += '<div class="info">Это угловой шкаф: он закрывает угол между стенами. Можно поменять ширину или убрать его.</div>';
  else {
    h += sec(empty ? "Что поставить сюда" : "Поменять на", "", chips("modType", list, modKey(m)));
    if (s.row === "lower") h += sec("Высокий пенал до верха", "", chips("modType", CHOICE.tall, modKey(m)));
  }
  if (!s.add) {
    h += sec("Ширина", "", '<div class="slide"><div class="lbl"><span>' + (empty ? "Пустое место" : "Шкаф") + "</span><b>" + cm(m.w) + '</b></div><button data-a="modW" data-d="-50" aria-label="Уже">-</button><div class="wnote">соседний шкаф подстроится</div><button data-a="modW" data-d="50" aria-label="Шире">+</button></div>');
    if (!corner && !empty) {
      const L = s.list[s.i - 1], R = s.list[s.i + 1];
      h += sec("Передвинуть", "", '<div class="chips"><button class="chip" data-a="modMove" data-d="-1"' + (!L || isCorner(L) ? " disabled" : "") + '>← Левее</button><button class="chip" data-a="modMove" data-d="1"' + (!R || isCorner(R) ? " disabled" : "") + '>Правее →</button></div><p class="note">Или перетащите шкаф на плане выше на место другого - они поменяются местами.</p>');
    }
    if (!empty) h += '<button class="chip danger" data-a="modDelSel">Убрать этот шкаф</button>';
  }
  h += '<button class="cta" data-a="selClose">Готово</button>';
  return h;
}

// ---------- голосовые правки (вызывает общий голосовой помощник сайта) ----------
const V_HINT = 'Скажите, например: "добавь верхние шкафы", "заполни пустые места", "сдвинь мойку влево", "поменяй мойку и плиту местами", "убери шкаф над мойкой", "стена 3 метра", "отмени".';
const V_TARGET = [
  [/(?<![а-я])мойк/, m => m.t === "sink", "lower"], [/плит|варочн/, m => m.what === "stove" || m.t === "oven", "lower"], [/духовк/, m => m.t === "oven" || m.t === "tallOven", "lower"],
  [/холодильн/, m => m.t === "fridge" || m.what === "fridge", "lower"], [/посудомо/, m => m.t === "dish", "lower"], [/пенал/, m => isTall(m), "lower"],
  [/вытяжк/, m => m.t === "u_hood", "upper"], [/сушк/, m => m.t === "u_dryer", "upper"], [/ящик/, m => m.t === "drawers3" || m.t === "drawers2", "lower"]
];
function vFindAll(text) {   // все названные шкафы по порядку в фразе, с учётом "над"
  const lay = kitchenLayout(S.kitchen), out = [];
  for (const [re, test, row] of V_TARGET) {
    const mm = text.match(re); if (!mm) continue;
    const above = new RegExp("над\\s+(\\S+\\s+)?" + re.source).test(text);
    let found = null;
    for (let wi = 0; wi < lay.length && !found; wi++) {
      const i = lay[wi][row].findIndex(test); if (i < 0) continue;
      if (!above) { found = wi + ":" + row + ":" + i; break; }
      let x = 0; for (let j = 0; j < i; j++) x += lay[wi].lower[j].w;
      const x1 = x + lay[wi].lower[i].w, talls = []; let tx = 0, ux = 0;
      lay[wi].lower.forEach(m => { if (isTall(m)) talls.push([tx, tx + m.w]); tx += m.w; });
      for (let u = 0; u < lay[wi].upper.length && !found; u++) {
        const w = lay[wi].upper[u].w; let mv = true; while (mv) { mv = false; for (const [a, b] of talls) if (ux < b - 0.5 && ux + w > a + 0.5) { ux = b; mv = true; } }
        if (ux < x1 - 50 && ux + w > x + 50) found = wi + ":upper:" + u;
        ux += w;
      }
    }
    if (found) out.push({ slot: found, pos: mm.index });
  }
  return out.sort((a, b) => a.pos - b.pos);
}
const vFind = text => vFindAll(text)[0] || null;
function vNum(t) {
  t = t.replace(/(\d+)\s+(\d)\s*(?=метр|м(?![а-я]))/, "$1.$2").replace(/(\d+) с половиной/, "$1.5");   // "3,5 метра" после очистки знаков приходит как "3 5 метра"
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(метр|м(?![а-я])|см|санти|мм|милли)?/); if (!m) return null;
  let v = parseFloat(m[1].replace(",", ".")); const u = m[2] || "";
  if (/^м(етр)?/.test(u) && !/мм|милли/.test(u)) v *= 1000; else if (/см|санти/.test(u)) v *= 10; else if (/мм|милли/.test(u)) { /* мм */ } else v = v < 10 ? v * 1000 : v < 300 ? v * 10 : v;
  return Math.round(v);
}
function voiceCmd(t) {
  if (S.type !== "kitchen") return null;
  const k = S.kitchen, o = k.opts, has = re => re.test(t);
  const done = (msg, keepSel) => { if (!keepSel && selSlot && !slotInfo(selSlot)) selSlot = null; render(); rebuild(); return msg; };
  const edit = /(добав|постав|сдела|верн|повес|убер|удал|убра|сдвин|двин|перенес|перемест|передвин|подвин|помен|замен|заполн|закро|расстав|отмен|шире|уже(?![а-я])|ширин|высок|обычн|без |стен|длин|углов|прям|п.образ)/;
  if (!edit.test(t)) return null;
  if (S.lock) return "Шкафы и размеры закрепил дизайнер. Здесь можно менять цвета и материалы.";
  // отмена
  if (has(/^(отмени|отменить|отмена)|верни как было$|верни обратно/)) return undo() ? done("Отменил последнее изменение") : "Отменять нечего";
  // расставить заново
  if (has(/расстав[а-я]* (все )?(заново|автоматич|как было)|верни шкафы как было|сбрось шкафы/)) { pushUndo(); k.manual = null; k.over = {}; selSlot = null; return done("Расставил все шкафы заново автоматически"); }
  // форма
  if (has(/п.образн/)) { pushUndo(); k.shape = "U"; k.manual = null; k.over = {}; return done("Кухня П-образная"); }
  if (has(/углов[а-я]* (кухн[а-я]* )?(справа|вправо)|угол справа/)) { pushUndo(); k.shape = "Lr"; k.manual = null; k.over = {}; return done("Кухня угловая, угол справа"); }
  if (has(/углов[а-я]* (кухн[а-я]* )?(слева|влево)|угол слева/)) { pushUndo(); k.shape = "Ll"; k.manual = null; k.over = {}; return done("Кухня угловая, угол слева"); }
  if (has(/прям[а-я]* кухн|кухн[а-я]* прям|^прямая$|сделай прям/)) { pushUndo(); k.shape = "I"; k.manual = null; k.over = {}; return done("Кухня прямая"); }
  // длина стены
  if (has(/(стен[а-я]*|длин[а-я]*|кухн[а-я]*)[^0-9]*\d/) && !has(/шкаф|мойк|плит|пенал/)) {
    const v = vNum(t); if (!v) return null;
    const W = kitchenWalls(k), key = has(/слева|левая|левую/) && W.some(w => w.key === "left") ? "left" : has(/справа|правая|правую/) && W.some(w => w.key === "right") ? "right" : "back";
    const len = Math.max(W.length === 1 ? 1600 : 1400, Math.min(5000, Math.round(v / 50) * 50));
    pushUndo(); k.len[key] = len; if (k.manual) fitManual(k);
    render(); rebuild(true); return WALL_NAME[key] + ": " + cm(len);
  }
  // верхние шкафы целиком
  const upperWord = has(/верхн|сверху|наверх|вверх|над кухн|навесн|антресол/);
  if (upperWord && has(/(убер|удал|убра|без |не нужн)/) && !vFind(t)) { setUpper(false); selSlot = null; return done("Убрал верхние шкафы"); }
  if (upperWord && has(/высок|92|повыше|до потолка/)) { setUpper(true, 920); return done("Верхние шкафы высокие, 92 см"); }
  if (upperWord && has(/обычн|72|пониже|ниже/)) { setUpper(true, 720); return done("Верхние шкафы обычные, 72 см"); }
  const fillWord = has(/(заполн|закро|закрой|постав|добав|верн|повес)[а-я]*.*(пуст|пробел|дыр|промеж|свободн)|заполни/);
  if ((upperWord && has(/(добав|постав|сдела|верн|повес|нужн|хочу|заполн)/)) || fillWord) {
    const rows = upperWord ? ["upper"] : has(/нижн|снизу|внизу/) ? ["lower"] : ["upper", "lower"];
    if (rows.includes("upper") && !o.upper) { setUpper(true, o.Hu || 720); return done("Добавил верхние шкафы по всей стене"); }
    pushUndo(); const n = fillEmpty(rows);
    if (!n) { undoStack.pop(); return upperWord ? "Сверху уже всё занято шкафами. Скажите \"высокие верхние\", чтобы сделать их выше." : "Пустых мест нет"; }
    return done("Поставил шкафы на пустые места: " + n);
  }
  // шкаф, о котором речь: названный ("мойку", "шкаф над плитой") или выбранный нажатием
  const f = vFind(t), sel = selSlot && slotInfo(selSlot) && !slotInfo(selSlot).add ? selSlot : null;
  // "сделай здесь ящики" при выбранном шкафе - про выбранный, даже если ящики уже есть где-то ещё
  const typeVerb = has(/(сдела|постав|замен|помен)/) && !has(/вместо|на месте|над |мест|шире|уже(?![а-я])|ширин|сдвин|двин|убер|удал/);
  const slot = typeVerb && sel ? sel : f ? f.slot : sel;
  // поменять местами: "поменяй мойку и плиту местами", "мойку на место плиты"
  if (has(/мест/) && has(/помен|замен|перестав|перенес|постав|перемест/)) {
    const L = vFindAll(t), a = L[0], b = L[1];
    if (a && b && a.slot !== b.slot) { pushUndo(); const r = swapSlots(a.slot, b.slot); if (!r) { undoStack.pop(); return "Эти шкафы местами не поменять"; } selSlot = r; return done("Поменял местами", true); }
  }
  if (f && has(/посудомо/) && has(/(добав|нужн)/)) return "Посудомойка уже есть. Чтобы передвинуть, скажите \"сдвинь посудомойку влево\".";
  if (!f && !k.manual && has(/посудомо/) && has(/(добав|постав|нужн)/)) { pushUndo(); o.dish = true; return done("Добавил посудомоечную машину"); }
  if (!slot) return has(/(сдвин|двин|перенес|перемест|убер|удал|шире|уже(?![а-я]))/) ? "Скажите, какой шкаф: например \"сдвинь мойку влево\", или нажмите на шкаф на модели и скажите \"убери\"." : null;
  const s = slotInfo(slot);
  // убрать
  if (has(/(убер|удал|убра)/)) { pushUndo(); setType(slot, EMPTY[s.row]); selSlot = slot; return done("Убрал. На этом месте теперь \"+\" - нажмите, чтобы поставить другой шкаф", true); }
  // сдвинуть
  if (has(/(сдвин|двин|перенес|перемест|передвин|подвин)/)) {
    const steps = Math.min(10, (t.match(/на (\d+)/) || [])[1] ? +(t.match(/на (\d+)/) || [])[1] : has(/на два|на 2/) ? 2 : has(/на три/) ? 3 : 1);
    let dir = has(/лев|налево/) ? -1 : has(/прав|направо/) ? 1 : 0;
    if (has(/в начало|в самое начало|до упора влево/)) { dir = -1; } if (has(/в конец|до упора вправо/)) { dir = 1; }
    const far = has(/в начало|в конец|до упора/) ? 20 : steps;
    if (!dir) return "Куда сдвинуть - влево или вправо?";
    pushUndo(); let cs = slot, moved = 0;
    for (let i = 0; i < far; i++) { const si = slotInfo(cs), n = si.list[si.i + dir]; if (!n || isCorner(n)) break; cs = swapSlots(cs, si.wi + ":" + si.row + ":" + (si.i + dir)); moved++; }
    if (!moved) { undoStack.pop(); return dir < 0 ? "Левее двигать некуда" : "Правее двигать некуда"; }
    selSlot = cs; return done("Сдвинул " + (dir < 0 ? "влево" : "вправо"), true);
  }
  // ширина
  if (has(/шире|уже(?![а-я])|ширин|\d+\s*(см|санти|мм)/)) {
    let w = s.m.w; const v = vNum(t.replace(/на (\d+)/, (a, b) => "+" + b));
    if (has(/шире/)) w += /на \d/.test(t) && v ? Math.min(v, 600) : 100; else if (has(/уже(?![а-я])/)) w -= /на \d/.test(t) && v ? Math.min(v, 600) : 100; else if (v) w = v;
    pushUndo(); const r = setWidth(slot, w); selSlot = slot; return done("Ширина " + cm(slotInfo(slot).m.w) + (r ? ". " + r : ""), true);
  }
  // поменять тип: "сделай здесь ящики", "поставь посудомойку вместо шкафа"
  const TYPE = [[/три ящик|3 ящик/, "drawers3"], [/два ящик|2 ящик/, "drawers2"], [/ящик/, "drawers3"], [/открыт/, s.row === "upper" ? "u_open" : null], [/подъем|подъём/, "u_lift"], [/сушк/, "u_dryer"], [/дверц|полк/, s.row === "upper" ? "u_shelf" : "shelf"], [/посудомо/, "dish"], [/(?<![а-я])мойк/, "sink"], [/духовк/, "oven"], [/пенал/, "tall"]];
  if (has(/(сдела|постав|замен|помен|добав)/)) for (const [re, v] of TYPE) {
    const at = t.search(re); if (!v || at < 0 || (f && slot === f.slot && at === f.pos)) continue;
    if (!choiceOk(s.row, v)) continue;
    pushUndo(); selSlot = setType(slot, v); return done("Готово: " + modTitle(slotInfo(selSlot).m).toLowerCase(), true);
  }
  return null;
}
