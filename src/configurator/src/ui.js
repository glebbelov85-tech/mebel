// ============================================================
// 3. ЭКРАН: ВКЛАДКИ, ВЫБОР ОТДЕЛКИ, ЦЕНА, ЗАЯВКА, РЕЖИМ ДИЗАЙНЕРА
// ============================================================
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Валюта: у своего проекта - S.cur (валюта дизайнера), у открытого чужого заказа - его собственная.
const curCode = () => (S.type === "ext" && S.ext ? MO.orderCurrency(S.ext) : S.cur || "KZT");
const money = n => MO.money(n, curCode());
const cm = mm => (Math.round(mm / 10)) + " см";
const LSKEY = "mebel-configurator-1";

let S = defaultState(), cur = null, tab = 0, selDoor = 0, openDoors = false, sheetKind = null, selSlot = null;

function merge(base, add) {
  if (!add || typeof add !== "object") return base;
  Object.keys(add).forEach(k => {
    if (add[k] && typeof add[k] === "object" && !Array.isArray(add[k]) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], add[k]);
    else base[k] = add[k];
  });
  return base;
}
function loadState() {
  try { const t = localStorage.getItem(LSKEY); if (t) { const o = JSON.parse(t); if (o && o.v === 1) { S = merge(defaultState(), o); if (!o.cur) S.cur = "KZT"; } } } catch (e) {}
  if (!S.orderId) S.orderId = MO.uid("o");
  sanitize();
}
function save() { try { localStorage.setItem(LSKEY, JSON.stringify(S)); } catch (e) {} }
function sanitize() {
  const k = S.kitchen, q = S.kupe, cl = (v, a, b, d) => Math.max(a, Math.min(b, Math.round(+v) || d));
  if (!SHAPES[k.shape]) k.shape = "Lr";
  ["left", "back", "right"].forEach(w => k.len[w] = cl(k.len[w], 1000, 8000, 2400));
  q.W = cl(q.W, 800, 6000, 2400); q.H = cl(q.H, 1800, 3000, 2400); q.D = cl(q.D, 400, 900, 600);
  if (!Array.isArray(q.doors) || !q.doors.length) q.doors = ["ldsp", "mirror"];
  q.doors = q.doors.slice(0, 6).map(f => DOOR_FILL[f] ? f : "ldsp");
  if (!Array.isArray(q.sections) || !q.sections.length) q.sections = ["shelves", "rod"];
  q.sections = q.sections.slice(0, 6).map(f => KUPE_FILL[f] ? f : "shelves");
  if (S.type === "ext" && !S.ext) S.type = "kitchen";
  if (!["kitchen", "kupe", "ext"].includes(S.type)) S.type = "kitchen";
}

// ---------- сборка модели и цены ----------
function viewCtx() {
  const base = { room: S.room, showInside: true, handles: "none" };
  if (S.type === "kitchen") {
    const k = S.kitchen, o = k.opts;
    return Object.assign(base, {
      type: "kitchen", showInside: false, style: /film|enamel/.test(k.fin.facade.base) && STYLES[o.style] ? o.style : "flat", handles: o.handles, handle: handleItem(S),
      topT: k._topT || 38, upTop: cur.info.upTop, upY: cur.info.upY, led: o.led && o.upper, ghosts: S.lock ? [] : cur.info.ghosts,
      wallL: k.shape === "Ll" || k.shape === "U", wallR: k.shape === "Lr" || k.shape === "U",
      view: { I: { az: 0.42, el: 0.17 }, Lr: { az: -0.5, el: 0.24 }, Ll: { az: 0.5, el: 0.24 }, U: { az: 0, el: 0.42 } }[k.shape],
      fitKey: ["k", k.shape, k.len.left, k.len.back, k.len.right, o.upper, o.Hu].join()
    });
  }
  if (S.type === "kupe") {
    const q = S.kupe;
    return Object.assign(base, {
      type: "kupe", geom: cur.info.geom, rods: cur.info.rods, profColor: (PROF_COLOR[q.profColor] || PROF_COLOR.silver).c, selDoor: tab === 1 && !openDoors ? selDoor : -1,
      wallL: q.kind !== "korp", wallR: q.kind === "built", view: { az: 0.5, el: 0.13 }, fitKey: ["q", q.W, q.H, q.D].join()
    });
  }
  return Object.assign(base, { type: "ext", view: { az: 0.5, el: 0.2 }, fitKey: "e" + S.ext.id });
}
function rebuild(refit) {
  try {
    if (S.type === "ext") {
      const order = S.ext;
      Object.keys(S.extFin || {}).forEach(role => {
        const sel = S.extFin[role], old = order.catalog.materials[sel.base], m = pickMat(order.catalog, sel);
        if (old && typeof old.price === "number") m.price = old.price; else if (order.audience === "client") delete m.price;
        order.catalog.materials[sel.base] = m;
        order.products.forEach(p => { if (p.finish && p.finish[role]) p.finish[role] = sel.base; });
      });
      if (order.audience !== "client") MO.recalc(order);
      cur = { order, product: order.products[0], info: { warns: [] } };
    } else cur = buildOrder(S);
  } catch (e) { console.error(e); toast("Не получилось собрать модель: " + e.message); return; }
  View.update({ order: cur.order, ctx: viewCtx() }, refit);
  const q = cur.order.quote || {}, show = S.showPrice && q.total > 0;
  $("price").textContent = show ? "≈ " + money(q.total) : "По запросу";
  $("priceNote").textContent = show ? "Примерная цена с монтажом" : "Цену назовёт дизайнер";
  $("brand").textContent = S.studio.name || "Мебель на заказ";
  save();
}
let raf = 0;
function rebuildSoon() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; rebuild(); }); }

// ---------- кусочки интерфейса ----------
function sec(title, right, html) { return '<div class="sec"><h3>' + title + (right ? "<span>" + right + "</span>" : "") + "</h3>" + html + "</div>"; }
function chips(act, list, curV, cls) { return '<div class="chips">' + list.map(c => '<button class="chip ' + (cls || "") + (String(c[0]) === String(curV) ? " on" : "") + '" data-a="' + act + '" data-v="' + esc(c[0]) + '">' + (c[2] || "") + esc(c[1]) + "</button>").join("") + "</div>"; }
function toggle(act, label, on) { return '<button class="chip' + (on ? " on" : "") + '" data-a="' + act + '">' + (on ? "✓ " : "") + esc(label) + "</button>"; }
function slider(key, label, val, min, max, step) {
  return '<div class="slide"><div class="lbl"><span>' + esc(label) + '</span><b id="v_' + key + '">' + cm(val) + '</b></div><button data-a="step" data-k="' + key + '" data-d="-' + step + '" aria-label="Меньше">-</button><input type="range" id="r_' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" data-k="' + key + '" aria-label="' + esc(label) + '"><button data-a="step" data-k="' + key + '" data-d="' + step + '" aria-label="Больше">+</button></div>';
}
function palette(role, groups, sel) {
  return groups.map(g => '<div class="grp"><div class="gh"><b>' + g.title + "</b><small>" + g.hint + "</small><em>" + tierStr(g.tier, curCode()) + '</em></div><div class="sws">' +
    g.decors.map(d => { const D = DECOR[d], on = sel && sel.base === g.base && sel.decor === d && !sel.color; return '<button class="sw' + (on ? " on" : "") + '" data-a="fin" data-role="' + role + '" data-base="' + g.base + '" data-v="' + d + '"><i style="' + swatchCss({ color: D.c, texture: { kind: D.k || "solid", dark: D.d, light: D.l } }) + '"></i>' + D.n + "</button>"; }).join("") +
    (g.custom ? '<label class="sw' + (sel && sel.base === g.base && sel.color ? " on" : "") + '"><i class="rainbow"' + (sel && sel.base === g.base && sel.color ? ' style="background:' + sel.color + '"' : "") + '><input type="color" data-c="' + role + '" data-base="' + g.base + '" value="' + (sel && sel.color || "#7a8f7b") + '" aria-label="Свой цвет"></i>Свой цвет</label>' : "") +
    "</div></div>").join("");
}
const SHAPE_SVG = {
  I: '<svg viewBox="0 0 34 26"><rect x="3" y="4" width="28" height="7" rx="1.5" fill="currentColor"/></svg>',
  Lr: '<svg viewBox="0 0 34 26"><path d="M3 4h28v19h-7V11H3z" fill="currentColor"/></svg>',
  Ll: '<svg viewBox="0 0 34 26"><path d="M31 4H3v19h7V11h21z" fill="currentColor"/></svg>',
  U: '<svg viewBox="0 0 34 26"><path d="M3 4h28v19h-7V11H10v12H3z" fill="currentColor"/></svg>'
};
function roomSec() {
  return sec("Комната", "для наглядности", '<div class="chips">' + Object.keys(WALLS).map(c => '<button class="chip' + (S.room.wall === c ? " on" : "") + '" data-a="wallc" data-v="' + c + '"><i style="background:' + c + '"></i>' + WALLS[c] + "</button>").join("") + "</div>" +
    chips("floor", Object.keys(FLOORS).map(f => [f, FLOORS[f].n, '<i style="background:' + FLOORS[f].c + '"></i>']), S.room.floor));
}
function typeSec() {
  if (S.lock) return "";
  return sec("Что собираем", "", chips("type", [["kitchen", "Кухня"], ["kupe", "Шкаф-купе"]], S.type));
}
function lockInfo(text) { return '<div class="info">Размеры задал дизайнер: ' + text + ". Выбирайте цвета и материалы - модель и цена обновятся сразу.</div>"; }

const TABS = { kitchen: ["Форма", "Фасады", "Столешница", "Детали"], kupe: ["Размер", "Двери", "Внутри", "Детали"], ext: ["Отделка", "Комната"] };

function render() {
  const names = TABS[S.type]; if (tab >= names.length) tab = 0;
  $("tabs").innerHTML = names.map((n, i) => '<button role="tab" class="' + (i === tab ? "on" : "") + '" data-tab="' + i + '">' + n + "</button>").join("");
  const body = $("body"), st = body.scrollTop;
  if (selSlot && !(S.type === "kitchen" && !S.lock && slotInfo(selSlot))) selSlot = null;
  body.innerHTML = selSlot ? modPanel() : S.type === "kitchen" ? kitchenTab() : S.type === "kupe" ? kupeTab() : extTab();
  View.select(selSlot);
  body.scrollTop = st;
  const wantOpen = S.type === "kupe" && (tab === 2 || openDoors);
  $("tOpen").classList.toggle("hide", S.type !== "kupe");
  $("tOpen").textContent = (S.type === "kupe" && (openDoors || tab === 2)) ? "Закрыть двери" : "Открыть двери";
  View.setOpenQuiet(wantOpen);
}

function kitchenTab() {
  const k = S.kitchen, o = k.opts, W = kitchenWalls(k);
  if (tab === 0) {
    if (S.lock) return lockInfo("кухня " + ({ I: "прямая", Lr: "угловая", Ll: "угловая", U: "П-образная" })[k.shape] + ", " + W.map(w => cm(w.len)).join(" + "));
    let h = typeSec();
    h += sec("Форма кухни", "", chips("shape", Object.keys(SHAPES).map(s => [s, SHAPES[s], SHAPE_SVG[s]]), k.shape, "shape"));
    h += sec("Длина стен", "", W.map(w => slider("k." + w.key, WALL_NAME[w.key], w.len, W.length === 1 ? 1600 : 1400, 5000, 50)).join(""));
    h += sec("Расстановка шкафов", undoStack.length ? '<button class="linkbtn" data-a="undo">Отменить</button>' : "", planHtml() +
      '<p class="note">Нажмите на шкаф - здесь или на 3D-модели (можно и правой кнопкой мыши или долгим нажатием), - чтобы поменять его, убрать или сдвинуть. Убранный шкаф оставляет пустое место "+": нажмите на него, чтобы поставить шкаф обратно, или "Отменить". Перетащите шкаф на другое место, чтобы поменять их местами. Пустое место с "+" - туда можно поставить шкаф.</p>' +
      (k.manual ? '<button class="linkbtn" data-a="modAuto">Расставить все шкафы заново автоматически</button>' : (Object.keys(k.over || {}).length ? '<button class="linkbtn" data-a="overReset">Вернуть шкафы как было</button>' : "")));
    h += sec("Верхние шкафы", "", chips("upper", [["0", "Без верхних"], ["720", "Обычные, 72 см"], ["920", "Высокие, 92 см"]], o.upper ? o.Hu : 0));
    if (!k.manual) {
      h += sec("Плита", "", chips("stove", [["builtin", "Духовка и варочная панель"], ["free", "Отдельная плита"]], o.stove));
      h += sec("Холодильник", "", chips("fridge", [["tall", "Встроенный"], ["gap", "Отдельный"], ["none", "Не на кухне"]], o.fridge));
      h += sec("Посудомойка", "", '<div class="chips">' + toggle("dish", "Посудомоечная машина", o.dish) + "</div>");
    }
    return h;
  }
  if (tab === 1) {
    const mdf = /film|enamel/.test(k.fin.facade.base);
    return sec("Вид фасада", mdf && STYLES[o.style] && STYLES[o.style].add ? "+" + money(cp(S, STYLES[o.style].add, RUB[o.style])) + " за м2" : "", chips("style", Object.keys(STYLES).map(s => [s, STYLES[s].n]), mdf ? o.style : "flat") + (mdf ? "" : '<p class="note">Рамки, рифление и рейки делаются на фасадах МДФ в плёнке и в эмали. Выберите такой материал ниже.</p>')) +
      sec("Материал и цвет", selName(k.fin.facade), palette("facade", GROUPS.facade, k.fin.facade));
  }
  if (tab === 2) return sec("Столешница", selName(k.fin.top), palette("top", GROUPS.top, k.fin.top)) +
    sec("Стена над столешницей", "", '<div class="chips">' + toggle("apron", "Стеновая панель в цвет столешницы", o.apron) + "</div>");
  return sec("Ручки", "", chips("handles", [["std", "С ручками"], ["gola", "Профиль Gola"], ["push", "Без ручек, от нажатия"]], o.handles) +
      (o.handles === "std" ? '<div class="hlist">' + handleList(S).map(h => '<button class="hcard' + (handleItem(S).id === h.id ? " on" : "") + '" data-a="hsel" data-v="' + esc(h.id) + '"><i style="background:' + (HANDLE_COLOR[h.color] || HANDLE_COLOR.steel).c + '"></i><span>' + esc(h.name) + "<small>" + HANDLE_KIND[h.kind] + '</small></span><b>' + money(h.price) + "</b></button>").join("") + "</div>" : "")) +
    (o.upper ? sec("Подсветка", "", '<div class="chips">' + toggle("led", "Подсветка рабочей зоны", o.led) + "</div>") : "") +
    sec("Корпус и полки", selName(k.fin.corpus), palette("corpus", GROUPS.corpus, k.fin.corpus)) + roomSec();
}

function kupeTab() {
  const q = S.kupe;
  if (tab === 0) {
    if (S.lock) return lockInfo("шкаф " + cm(q.W) + " x " + cm(q.H) + " x " + cm(q.D));
    const minD = Math.max(1, Math.ceil(q.W / 1100)), maxD = Math.min(6, Math.max(minD, Math.floor(q.W / 500)));
    const cnt = []; for (let i = Math.max(2, minD); i <= maxD; i++) cnt.push([i, i + " " + (i < 5 ? "двери" : "дверей")]);
    return typeSec() + sec("Размеры шкафа", "", slider("q.W", "Ширина", q.W, 1000, 5000, 50) + slider("q.H", "Высота", q.H, 2000, 2800, 50) + slider("q.D", "Глубина", q.D, 450, 700, 50)) +
      sec("Сколько дверей", "", chips("doorsN", cnt, q.doors.length));
  }
  if (tab === 1) {
    const used = f => q.doors.some(d => d === f || (d === "combo" && (f === "ldsp" || f === "mirror")));
    selDoor = Math.min(selDoor, q.doors.length - 1);
    return sec("Какая дверь", "можно нажать на дверь на модели", chips("door", q.doors.map((f, i) => [i, (i + 1) + " - " + DOOR_FILL[f]]), selDoor)) +
      sec("Дверь " + (selDoor + 1), "", chips("fill", Object.keys(DOOR_FILL).map(f => [f, DOOR_FILL[f]]), q.doors[selDoor]) + '<button class="linkbtn" data-a="fillAll">Сделать все двери такими</button>') +
      (used("ldsp") ? sec("Цвет ЛДСП на дверях", selName(q.fin.door), palette("door", GROUPS.door, q.fin.door)) : "") +
      (used("mirror") ? sec("Зеркало", "", palette("mirror", GROUPS.mirror, q.fin.mirror)) : "") +
      (used("glass") ? sec("Цвет стекла", "", palette("glass", GROUPS.glass, q.fin.glass)) : "");
  }
  if (tab === 2) {
    const n = []; for (let i = Math.max(1, Math.ceil(q.W / 1100)); i <= Math.min(6, Math.floor(q.W / 400)); i++) n.push([i, String(i)]);
    return (S.lock ? "" : sec("Сколько секций", "", chips("secN", n, q.sections.length))) +
      q.sections.map((s, i) => sec("Секция " + (i + 1), i ? "" : "считаем слева направо", '<div class="chips">' + Object.keys(KUPE_FILL).map(f => '<button class="chip' + (s === f ? " on" : "") + '" data-a="sec" data-i="' + i + '" data-v="' + f + '">' + KUPE_FILL[f].name + "</button>").join("") + "</div>")).join("") +
      sec("Корпус и полки", selName(q.fin.corpus), palette("corpus", GROUPS.corpus, q.fin.corpus));
  }
  return sec("Профиль дверей", "", chips("prof", [["eco", "Эконом"], ["std", "Стандарт"], ["prem", "Премиум"]], q.prof) +
    chips("pcol", Object.keys(PROF_COLOR).map(c => [c, PROF_COLOR[c].n, '<i style="background:' + PROF_COLOR[c].c + '"></i>']), q.profColor)) + roomSec();
}

function extRoles() { const r = {}; (S.ext.products || []).forEach(p => Object.keys(p.finish || {}).forEach(k => r[k] = p.finish[k])); return r; }
function extSel(role) {
  if (S.extFin[role]) return S.extFin[role];
  return null;
}
function extTab() {
  const o = S.ext, p = o.products[0] || {}, roles = extRoles();
  if (tab === 1) return roomSec();
  const sz = p.size && p.size.w ? p.size.w + " x " + p.size.h + " x " + p.size.d + " мм" : "";
  let h = '<div class="info">Проект дизайнера: ' + esc(p.name || o.title || "изделие") + (sz ? ", " + sz : "") + ". Размеры менять нельзя - выбирайте отделку.</div>";
  if (roles.facade) h += sec("Фасады", extSel("facade") ? selName(extSel("facade")) : "как в проекте", palette("facade", GROUPS.facade, extSel("facade")));
  if (roles.top) h += sec("Столешница", extSel("top") ? selName(extSel("top")) : "как в проекте", palette("top", GROUPS.top, extSel("top")));
  if (roles.corpus) h += sec("Корпус", extSel("corpus") ? selName(extSel("corpus")) : "как в проекте", palette("corpus", GROUPS.corpus, extSel("corpus")));
  h += '<button class="linkbtn" data-a="leaveExt">Собрать свою кухню или шкаф с нуля</button>';
  return h;
}

// ---------- действия ----------
function setVal(key, v) {
  const [a, b] = key.split(".");
  if (a === "k") { S.kitchen.len[b] = v; if (S.kitchen.manual) fitManual(S.kitchen); }
  else { S.kupe[b] = v; if (b === "W") fitKupe(); }
}
function fitKupe() {
  const q = S.kupe, minD = Math.max(2, Math.ceil(q.W / 1100)), maxD = Math.min(6, Math.max(minD, Math.floor(q.W / 500)));
  setDoors(Math.max(minD, Math.min(maxD, q.doors.length)));
  const minS = Math.max(1, Math.ceil(q.W / 1100)), maxS = Math.min(6, Math.floor(q.W / 400));
  setSecs(Math.max(minS, Math.min(maxS, q.sections.length)));
}
function setDoors(n) { const d = S.kupe.doors; while (d.length > n) d.pop(); while (d.length < n) d.push(d[d.length - 2] || d[0] || "ldsp"); }
function setSecs(n) { const s = S.kupe.sections, pat = ["shDr", "rod", "shelves", "rodDr"]; while (s.length > n) s.pop(); while (s.length < n) s.push(pat[s.length % 4]); }
function finTarget() { return S.type === "kitchen" ? S.kitchen.fin : S.type === "kupe" ? S.kupe.fin : S.extFin; }

document.addEventListener("click", e => {
  const t = e.target.closest("[data-tab]"); if (t) { tab = +t.dataset.tab; selSlot = null; render(); rebuild(); return; }
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, v = b.dataset.v, k = S.kitchen, o = k.opts, q = S.kupe;
  let refit = false;
  switch (a) {
    case "type": S.type = v; tab = 0; openDoors = false; refit = true; break;
    case "shape": pushUndo(); k.shape = v; k.manual = null; k.over = {}; selSlot = null; refit = true; break;
    case "step": { const r = $("r_" + b.dataset.k); const nv = Math.max(+r.min, Math.min(+r.max, +r.value + +b.dataset.d)); r.value = nv; setVal(b.dataset.k, nv); break; }
    case "upper": setUpper(v !== "0", +v); break;
    case "stove": o.stove = v; break;
    case "fridge": o.fridge = v; break;
    case "dish": o.dish = !o.dish; break;
    case "style": o.style = v; break;
    case "apron": o.apron = !o.apron; break;
    case "led": o.led = !o.led; break;
    case "handles": o.handles = v; break;
    case "hsel": o.handle = v; break;
    case "overReset": pushUndo(); k.over = {}; break;
    case "modType": pushUndo(); if (selSlot) selSlot = setType(selSlot, v); break;
    case "modDelSel": pushUndo(); setType(selSlot, EMPTY[slotInfo(selSlot).row]); break;
    case "modW": { pushUndo(); const r = setWidth(selSlot, slotInfo(selSlot).m.w + +b.dataset.d); if (r) toast(r); break; }
    case "modMove": { pushUndo(); const r = moveStep(selSlot, +b.dataset.d); if (r) selSlot = r; break; }
    case "selClose": selSlot = null; break;
    case "undo": undo(); break;
    case "fin": finTarget()[b.dataset.role] = { base: b.dataset.base, decor: v }; if (S.type === "kitchen" && b.dataset.role === "facade" && !/film|enamel/.test(b.dataset.base)) o.style = "flat"; break;
    case "wallc": S.room.wall = v; break;
    case "floor": S.room.floor = v; break;
    case "doorsN": { const same = q.sections.length === q.doors.length; setDoors(+v); if (same) setSecs(Math.max(Math.ceil(q.W / 1100), Math.min(Math.floor(q.W / 400), +v))); break; }
    case "door": selDoor = +v; openDoors = false; break;
    case "fill": q.doors[selDoor] = v; break;
    case "fillAll": q.doors = q.doors.map(() => q.doors[selDoor]); break;
    case "secN": setSecs(+v); break;
    case "sec": q.sections[+b.dataset.i] = v; break;
    case "prof": q.prof = v; break;
    case "pcol": q.profColor = v; break;
    case "leaveExt": S.type = "kitchen"; S.ext = null; S.extFin = {}; S.lock = false; tab = 0; refit = true; break;
    default: return sheetAction(a, b);
  }
  render(); rebuild(refit);
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.type === "range" && t.dataset.k) { setVal(t.dataset.k, +t.value); $("v_" + t.dataset.k).textContent = cm(+t.value); rebuildSoon(); }
  if (t.dataset.c) { finTarget()[t.dataset.c] = { base: t.dataset.base, color: t.value }; rebuildSoon(); }
  if (t.dataset.f) sheetField(t);
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.type === "range" && t.dataset.k) render();
  if (t.dataset.c) render();
  if (t.id === "priceFile" && t.files[0]) { t.files[0].text().then(loadPriceFile); return; }
  if (t.dataset.p) proField(t);
});

// ---------- окна ----------
function openSheet(kind, html, wide) { sheetKind = kind; $("card").className = "card" + (wide ? " wide" : ""); $("card").innerHTML = html; $("sheet").classList.add("on"); $("card").scrollTop = 0; }
function closeSheet() { $("sheet").classList.remove("on"); sheetKind = null; }
$("sheet").addEventListener("click", e => { if (e.target === $("sheet")) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
function head(t) { return "<h2>" + t + '<button class="x" data-a="close" aria-label="Закрыть">×</button></h2>'; }
let toastT = 0;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2200); }
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg || "Скопировано"); }
  catch (e) { openSheet("copy", head("Скопируйте текст") + '<p class="note">Выделите текст и скопируйте его.</p><div class="f"><textarea id="copyArea" style="min-height:220px" readonly>' + esc(text) + "</textarea></div>"); const ta = $("copyArea"); ta.focus(); ta.select(); }
}

// сжатый код проекта (без сервера): JSON -> deflate -> base64url
function b64u(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64u(str) { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/")), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
async function pipe(bytes, stream) { const w = stream.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
async function pack(prefix, obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === "undefined") return prefix + "0." + b64u(bytes);
  return prefix + "1." + b64u(await pipe(bytes, new CompressionStream("deflate-raw")));
}
async function unpack(code) {
  const z = code[1] === "1", bytes = unb64u(code.slice(3));
  if (z && typeof DecompressionStream === "undefined") throw new Error("Этот браузер не умеет открывать коды. Обновите браузер.");
  return JSON.parse(new TextDecoder().decode(z ? await pipe(bytes, new DecompressionStream("deflate-raw")) : bytes));
}
function cfgOf(withClient) {
  if (S.type === "ext") return null;
  const o = { v: 1, type: S.type, room: S.room, studio: S.studio, lock: S.lock, showPrice: S.showPrice, markup: S.markup, cur: S.cur, orderId: S.orderId };
  o[S.type] = JSON.parse(JSON.stringify(S[S.type])); delete o[S.type]._topT;
  if (S.handleCat) o.handleCat = S.handleCat;
  if (S.prices && Object.keys(S.prices).length) o.prices = S.prices;
  if (withClient) o.client = S.client;
  return o;
}
async function projectCode(withClient) {
  if (S.type === "ext") return withClient ? pack("e", { id: S.ext.id, fin: S.extFin, client: S.client }) : MO.encode(S.ext);
  return pack("c", cfgOf(withClient));
}
function adopt(order) {
  adoptOrder(order);
  S.ext = order; S.extFin = {}; S.type = "ext"; S.lock = true; tab = 0;
}
async function openCode(text) {
  text = String(text || "").trim();
  if (!text) throw new Error("Вставьте код или текст заказа.");
  if (text[0] === "{" || text[0] === "[") {
    const data = JSON.parse(text);
    if (data && data.v === 1 && data.type && !data.format) { applyCfg(data); return "Проект открыт"; }
    const res = MO.parse(data), one = Array.isArray(res) ? res[0] : res;
    if (!one.order.products.length || !MO.listParts(one.order).some(e => typeof e.part.x === "number")) throw new Error("В этом заказе нет деталей с координатами - показать его в 3D не получится.");
    adopt(one.order); return "Заказ открыт";
  }
  const m = /(?:^|[^A-Za-z0-9])([cemj][01]\.[A-Za-z0-9_-]{8,})/.exec(" " + text);
  if (!m) throw new Error("Не нашли код проекта. Он начинается с c1. или m1.");
  const code = m[1];
  if (code[0] === "c") { applyCfg(await unpack(code)); return "Проект открыт"; }
  if (code[0] === "e") {
    const d = await unpack(code);
    if (S.type !== "ext" || S.ext.id !== d.id) throw new Error("Сначала откройте заказ, к которому относится этот код.");
    S.extFin = d.fin || {}; if (d.client) S.client = merge(S.client, d.client); return "Выбор клиента применён";
  }
  const res = await MO.decode(code); adopt(res.order); return "Заказ открыт";
}
function applyCfg(d) {
  const keep = { studio: S.studio, markup: S.markup, showPrice: S.showPrice, cur: S.cur, prices: S.prices, pricesFrom: S.pricesFrom };
  const fromClient = !!d.client && pro.me;
  S = merge(defaultState(), d); S.ext = null; S.extFin = {};
  if (!d.cur) S.cur = "KZT";   // коды до ноября 2026 - в тенге
  if (fromClient) { S.prices = null; merge(S, keep); }
  if (!S.orderId) S.orderId = MO.uid("o");
  sanitize(); tab = S.lock ? 1 : 0; openDoors = false;
}
const pro = { get me() { try { return localStorage.getItem(LSKEY + "-pro") === "1"; } catch (e) { return false; } }, set me(v) { try { localStorage.setItem(LSKEY + "-pro", v ? "1" : "0"); } catch (e) {} } };

// --- заявка ---
function requestText(code) {
  const q = cur.order.quote || {}, lines = MO.productSummary(cur.order, cur.product);
  if (S.type === "ext") Object.keys(S.extFin).forEach(r => lines.push(({ facade: "Фасады", top: "Столешница", corpus: "Корпус" }[r] || r) + ": " + selName(S.extFin[r])));
  const c = S.client, out = ["Здравствуйте! Хочу заказать мебель.", "", lines.join("\n")];
  if (S.showPrice && q.total > 0) out.push("", "Примерная цена: " + money(q.total));
  if (c.name || c.phone) out.push("", [c.name ? "Имя: " + c.name : "", c.phone ? "Телефон: " + c.phone : ""].filter(Boolean).join("\n"));
  if (c.note) out.push("Комментарий: " + c.note);
  if (code) out.push("", "Код проекта: " + code);
  return out.join("\n");
}
let reqCode = "";
async function sendSheet() {
  const shot = View.snapshot();
  openSheet("send", head("Заявка дизайнеру") +
    (shot ? '<img class="shot sm" src="' + shot + '" alt="Ваш проект"><p class="note">Чтобы приложить картинку к сообщению, нажмите на неё и удерживайте - "Сохранить" или "Поделиться".</p>' : "") +
    '<div class="sum" id="reqSum"></div>' +
    '<div class="row2"><label class="f">Ваше имя<input id="c_name" data-f="name" autocomplete="name" value="' + esc(S.client.name) + '"></label><label class="f">Телефон<input id="c_phone" data-f="phone" type="tel" autocomplete="tel" placeholder="+7 7.." value="' + esc(S.client.phone) + '"></label></div>' +
    '<label class="f">Пожелания<textarea id="c_note" data-f="note" placeholder="Например: когда удобно приехать на замер">' + esc(S.client.note) + "</textarea></label>" +
    '<div class="btns"><a class="cta wa" id="waLink" target="_blank" rel="noopener" href="#">Написать в WhatsApp</a><button class="cta sec2" data-a="copyReq">Скопировать заявку</button></div>' +
    '<p class="note">' + (S.studio.wa ? "Откроется WhatsApp с готовым сообщением для дизайнера (" + esc(S.studio.wa) + "). Останется нажать \"Отправить\"." : "Откроется WhatsApp с готовым сообщением - выберите в нём своего дизайнера.") + " Цена примерная: точную дизайнер назовёт после замера.</p>");
  await refreshReq();
}
async function refreshReq() {
  try { reqCode = await projectCode(true); } catch (e) { reqCode = ""; }
  if (reqCode.length > 1800) reqCode = "";
  const text = requestText(reqCode);
  if (!$("reqSum")) return;
  $("reqSum").textContent = requestText("");
  $("waLink").href = "https://wa.me/" + MO.waPhone(S.studio.wa) + "?text=" + encodeURIComponent(text);
}
let reqT = 0;
function sheetField(t) {
  if (sheetKind === "send") { S.client[t.dataset.f] = t.value; save(); clearTimeout(reqT); reqT = setTimeout(refreshReq, 250); }
}

// --- код от дизайнера ---
function codeSheet() {
  openSheet("code", head("Открыть проект") + '<p class="note">Вставьте сообщение или код, который прислал дизайнер. Можно вставить и файл заказа из калькулятора.</p>' +
    '<label class="f">Код или сообщение целиком<textarea id="codeIn" style="min-height:110px" placeholder="c1.xxxxx"></textarea></label>' +
    '<label class="f">Или файл заказа (*.mebel.json)<input type="file" id="codeFile" accept=".json,application/json"></label>' +
    '<div class="btns"><button class="cta" data-a="codeGo">Открыть</button></div>');
}

// --- дизайнеру ---
function proSheet() {
  pro.me = true;
  const q = cur.order.quote || {}, k = S.kitchen, kq = S.kupe;
  let h = head("Настройки дизайнера");
  h += sec("Ваши данные", "", '<div class="row2"><label class="f">Название студии<input data-p="studio.name" value="' + esc(S.studio.name) + '"></label><label class="f">Ваш WhatsApp<input data-p="studio.wa" type="tel" placeholder="+7 701 000 00 00" value="' + esc(S.studio.wa) + '"></label></div>' +
    '<div class="row2"><label class="f">Наценка, %<input data-p="markup" type="number" min="0" max="300" value="' + S.markup + '"></label><label class="f">Цена для клиента<select data-p="showPrice"><option value="1"' + (S.showPrice ? " selected" : "") + '>Показывать</option><option value="0"' + (S.showPrice ? "" : " selected") + ">Скрыть</option></select></label></div>" +
    '<div class="row2"><label class="f">Валюта цен<select data-p="cur">' + Object.values(MO.CURRENCIES).map(c => '<option value="' + c.code + '"' + (c.code === S.cur ? " selected" : "") + '>' + esc(c.name) + ', ' + esc(c.sign) + '</option>').join("") + '</select></label><p class="note" style="align-self:end;margin:0">Цены материалов - стартовые для этой валюты. Код для клиента передаёт и валюту.</p></div>');
  if (S.type === "kitchen") {
    const W = kitchenWalls(k), lay = kitchenLayout(k);
    h += sec("Точные размеры, мм", "", '<div class="row3">' + W.map(w => '<label class="f">' + WALL_NAME[w.key] + '<input type="number" data-p="k.len.' + w.key + '" value="' + w.len + '"></label>').join("") + "</div>");
    h += sec("Модули", k.manual ? "расставлены вручную" : "расставлены автоматически", W.map((w, wi) => {
      const row = lay[wi], lo = row.lower.reduce((s, m) => s + (+m.w || 0), 0);
      const talls = row.lower.filter(m => (LOWER[m.t] || {}).tall).reduce((s, m) => s + m.w, 0), up = row.upper.reduce((s, m) => s + (+m.w || 0), 0) + talls;
      const mods = (list, defs, kind) => '<div class="mods">' + list.map((m, i) => '<div class="mod"><select data-p="mod.' + wi + "." + kind + "." + i + '.t" aria-label="Тип модуля">' + Object.keys(defs).map(t => '<option value="' + t + '"' + (t === m.t ? " selected" : "") + ">" + defs[t].name + "</option>").join("") + '</select><input type="number" data-p="mod.' + wi + "." + kind + "." + i + '.w" value="' + m.w + '" aria-label="Ширина, мм"><button class="x" data-a="modDel" data-w="' + wi + '" data-kind="' + kind + '" data-i="' + i + '" aria-label="Удалить модуль">×</button></div>').join("") + '<button class="linkbtn" data-a="modAdd" data-w="' + wi + '" data-kind="' + kind + '">+ модуль</button></div>';
      return '<div class="wallbox"><div class="wh">' + WALL_NAME[w.key] + ", низ<span class=\"" + (Math.abs(lo - w.lowLen) >= 50 ? "bad" : "") + '">занято ' + lo + " из " + w.lowLen + (w.next ? " (угол 600 занимает следующая стена)" : "") + "</span></div>" + mods(row.lower, LOWER, "lower") +
        '<div class="wh">' + WALL_NAME[w.key] + ", верх<span class=\"" + (up > w.upLen + 1 ? "bad" : "") + '">занято ' + up + " из " + w.upLen + "</span></div>" + mods(row.upper, UPPER, "upper") + "</div>";
    }).join("") + (k.manual ? '<button class="linkbtn" data-a="modAuto">Расставить автоматически заново</button>' : '<p class="note">Измените любой модуль - расстановка станет ручной и перестанет подстраиваться под длину стен. Угловой модуль в начале стены: первые 600 мм закрыты соседней стеной.</p>'));
  } else if (S.type === "kupe") {
    h += sec("Точные размеры, мм", "", '<div class="row3"><label class="f">Ширина<input type="number" data-p="q.W" value="' + kq.W + '"></label><label class="f">Высота<input type="number" data-p="q.H" value="' + kq.H + '"></label><label class="f">Глубина<input type="number" data-p="q.D" value="' + kq.D + '"></label></div>' +
      '<div class="row2"><label class="f">Тип шкафа<select data-p="q.kind">' + Object.keys(KUPE_KIND).map(t => '<option value="' + t + '"' + (t === kq.kind ? " selected" : "") + ">" + KUPE_KIND[t] + "</option>").join("") + '</select></label><label class="f">Задняя стенка<select data-p="q.back"><option value="1"' + (kq.back !== false ? " selected" : "") + '>Есть (ДВП)</option><option value="0"' + (kq.back === false ? " selected" : "") + ">Нет</option></select></label></div>");
  }
  if (S.type === "kitchen") h += sec("Каталог ручек", handleList(S).length + " шт.", '<p class="note">Одна строка - одна ручка: название; цена; вид (скоба, рейлинг, кнопка, ракушка, торцевая); цвет (чёрный, хром, латунь, бронза, белый). Можно скопировать столбцы прямо из прайса магазина в Excel. Длину берём из названия ("160 мм").</p><label class="f">Список ручек<textarea id="catIn" style="min-height:150px;font-size:13px">' + esc(handlesText(handleList(S))) + '</textarea></label><div class="btns"><button class="cta sec2" data-a="catSave">Обновить каталог</button><button class="cta sec2" data-a="catReset">Вернуть пример</button></div>');
  const warns = (cur.info.warns || []).concat(MO.validate(cur.order).errors.map(e => e.msg));
  if (warns.length) h += '<div class="warn"><b>Проверьте:</b><ul>' + warns.slice(0, 8).map(w => "<li>" + esc(w) + "</li>").join("") + "</ul></div>";
  if (S.type !== "ext") {
    const np = S.prices ? Object.keys(S.prices).length : 0, calcSt = calcPriceState();
    h += sec("Цены", np ? "ваш прайс: " + Object.keys(S.prices).filter(k => k !== "sheetMode").length + " поз." : "стартовые, примерные",
      '<p class="note">' + (np ? "Клиент видит цену по вашим ценам" + (S.pricesFrom ? " (" + esc(S.pricesFrom) + ")" : "") + ". Они же уходят в ссылку и код для клиента." : "Пока цена для клиента считается по примерным ценам. Возьмите свой прайс из калькулятора, загрузите файлом или впишите руками - тогда цена здесь и в калькуляторе совпадёт.") + "</p>" +
      '<div class="btns">' + (calcSt ? '<button class="cta" data-a="priceCalc">Взять цены из калькулятора</button>' : "") + '<button class="cta sec2" data-a="priceFilePick">Загрузить файл прайса</button></div>' +
      '<input type="file" id="priceFile" accept=".json,application/json" hidden>' +
      (calcSt ? "" : '<p class="note">Файл прайса: в калькуляторе откройте "Прайс" и сохраните прайс файлом (*.mebel-price.json) или резервную копию.</p>') +
      '<button class="linkbtn" data-a="priceToggle">' + (priceOpen ? "Скрыть таблицу цен" : "Показать и поправить цены руками") + "</button>" + (np ? ' <button class="linkbtn" data-a="priceReset">Вернуть стартовые цены</button>' : "") +
      (priceOpen ? '<div class="ptable">' + priceRows(S).map(r => '<label class="prow"><span>' + esc(r[1]) + ", " + esc(r[2] === "%" ? "%" : curSign() + " за " + r[2]) + '</span><input type="number" min="0" inputmode="decimal" data-p="price.' + r[0] + '" placeholder="' + r[3] + '" value="' + (S.prices && S.prices[r[0]] != null ? S.prices[r[0]] : "") + '"></label>').join("") + '</div><p class="note">Пустое поле - стартовая цена (серым). Наценка задаётся выше, в "Ваши данные".</p>' : ""));
  }
  if (q.total) h += '<div class="info">Себестоимость ' + money(q.cost || 0) + " · наценка " + money(q.markup || 0) + " · клиенту " + money(q.total) + (S.prices ? ". Посчитано по вашим ценам." : ". Цены материалов примерные - задайте свои в разделе \"Цены\".") + "</div>";
  h += sec("Работа вместе с клиентом", "", (S.type === "ext" ? "" : '<div class="chips">' + toggle("lock", "Закрепить размеры: клиент меняет только отделку", S.lock) + "</div>") +
    '<p class="note">Задайте размеры, закрепите их и отправьте клиенту код. Клиент на этой же странице нажмёт "Есть код", подберёт цвета и пришлёт заявку вам в WhatsApp. Можно и проще: закрепить размеры и дать клиенту свой телефон или планшет.</p>' +
    '<div class="code" id="proCode">...</div><div class="btns"><button class="cta" data-a="copyCode">Скопировать код для клиента</button><button class="cta sec2" data-a="copyOrder">Скопировать заказ (JSON)</button></div>' +
    '<p class="note">Заказ (JSON) - это общий формат проекта: его открывают калькулятор, КП, раскрой и учёт заказов.</p>');
  h += sec("Открыть чужой проект", "", '<p class="note">Заявка клиента, заказ из калькулятора или файл *.mebel.json - кнопка "Есть код" вверху страницы.</p><button class="linkbtn" data-a="resetAll">Сбросить всё и начать заново</button>');
  const st = $("card").scrollTop, was = sheetKind === "pro";
  openSheet("pro", h, true); if (was) $("card").scrollTop = st;
  projectCode(false).then(c => { if ($("proCode")) $("proCode").textContent = c; });
}
// --- прайс мастера ---
let priceOpen = false;
const curSign = () => MO.currencyInfo(curCode()).sign;
// прайс калькулятора на этом же устройстве (тот же сайт): mk2_price для тенге, mk2_price_RUB для рублей
function calcPriceState() {
  try { const c = S.cur || "KZT", t = localStorage.getItem(c === "KZT" ? "mk2_price" : "mk2_price_" + c); const st = t && JSON.parse(t); return st && Array.isArray(st.items) && !(st.meta && st.meta.starter) ? st : null; } catch (e) { return null; }
}
function applyPrices(items, from) {
  const r = pricesFromCalc(items);
  if (!r.n) { toast("В этом прайсе не нашлось знакомых позиций"); return; }
  S.prices = Object.assign({}, S.prices || {}, r.prices); S.pricesFrom = from;
  if (r.markup != null) S.markup = Math.max(0, Math.min(300, r.markup));
  render(); rebuild(); proSheet(); toast("Цены обновлены: " + r.n + " поз." + (r.markup != null ? ", наценка " + S.markup + "%" : ""));
}
function loadPriceFile(text) {
  let d; try { d = JSON.parse(text); } catch (e) { toast("Это не файл прайса"); return; }
  const c = S.cur || "KZT", date = new Date().toISOString().slice(0, 10);
  if (d && d.format === "mebel-price" && Array.isArray(d.items)) {
    if (d.currency && d.currency !== c) { toast("Прайс в другой валюте (" + d.currency + "). Сначала выберите эту валюту выше"); return; }
    applyPrices(d.items, "файл прайса от " + (d.date || date));
  } else if (d && d.app === "mebel-calc") {   // резервная копия калькулятора
    const st = d.prices && d.prices[c] ? d.prices[c] : ((d.cur || "KZT") === c && Array.isArray(d.price) ? { items: d.price } : null);
    if (!st) { toast("В копии нет прайса в нужной валюте"); return; }
    applyPrices(st.items, "копия калькулятора от " + String(d.date || date).slice(0, 10));
  } else toast("Это не файл прайса. Нужен *.mebel-price.json или резервная копия калькулятора");
}
function manualize() { const k = S.kitchen; if (!k.manual) k.manual = JSON.parse(JSON.stringify(kitchenLayout(k))); return k.manual; }
function proField(t) {
  const p = t.dataset.p.split("."), v = t.value;
  if (p[0] === "studio") S.studio[p[1]] = v;
  else if (p[0] === "markup") S.markup = Math.max(0, Math.min(300, +v || 0));
  else if (p[0] === "showPrice") S.showPrice = v === "1";
  else if (p[0] === "price") { S.prices = S.prices || {}; if (v === "" || !(+v >= 0)) delete S.prices[p[1]]; else S.prices[p[1]] = +v; if (!Object.keys(S.prices).length) S.prices = null; S.pricesFrom = S.prices ? (S.pricesFrom || "внесены вручную") : ""; }
  else if (p[0] === "cur") { if (S.prices) { S.prices = null; S.pricesFrom = ""; toast("Валюта другая - ваши цены сброшены, загрузите прайс в новой валюте"); } S.cur = v; if (S.handleCat) toast("Цены в вашем каталоге ручек остались как были - проверьте их"); }
  else if (p[0] === "k") { S.kitchen.len[p[2]] = Math.max(1000, Math.min(8000, Math.round(+v) || 2400)); if (S.kitchen.manual) fitManual(S.kitchen); }
  else if (p[0] === "q") { if (p[1] === "kind") S.kupe.kind = v; else if (p[1] === "back") S.kupe.back = v === "1"; else { S.kupe[p[1]] = +v; sanitize(); fitKupe(); } }
  else if (p[0] === "mod") { pushUndo(); const m = manualize()[+p[1]][p[2]][+p[3]]; if (p[4] === "t") { m.t = v; delete m.what; } else m.w = Math.max(150, Math.min(1400, Math.round(+v) || 600)); }
  render(); rebuild(p[0] === "k" || p[0] === "q"); proSheet();
}
function sheetAction(a, b) {
  switch (a) {
    case "close": closeSheet(); break;
    case "copyReq": copyText(requestText(reqCode), "Заявка скопирована"); break;
    case "codeGo": {
      const f = $("codeFile").files[0];
      (f ? f.text() : Promise.resolve($("codeIn").value)).then(openCode).then(msg => { closeSheet(); render(); rebuild(true); toast(msg); }).catch(e => toast(e.message || "Не получилось открыть"));
      break;
    }
    case "lock": S.lock = !S.lock; render(); rebuild(); proSheet(); break;
    case "copyCode": projectCode(false).then(c => copyText(c, "Код скопирован - отправьте его клиенту")); break;
    case "priceCalc": { const st = calcPriceState(); if (st) applyPrices(st.items, "из калькулятора, " + new Date().toISOString().slice(0, 10)); break; }
    case "priceFilePick": $("priceFile").click(); break;
    case "priceToggle": priceOpen = !priceOpen; proSheet(); break;
    case "priceReset": S.prices = null; S.pricesFrom = ""; render(); rebuild(); proSheet(); toast("Цены снова стартовые"); break;
    case "copyOrder": copyText(MO.stringify(cur.order), "Заказ скопирован"); break;
    case "modDel": pushUndo(); manualize()[+b.dataset.w][b.dataset.kind].splice(+b.dataset.i, 1); render(); rebuild(); proSheet(); break;
    case "modAdd": pushUndo(); manualize()[+b.dataset.w][b.dataset.kind].push(b.dataset.kind === "lower" ? { t: "shelf", w: 600 } : { t: "u_shelf", w: 600 }); render(); rebuild(); proSheet(); break;
    case "catSave": { const L = parseHandles($("catIn").value); if (!L.length) { toast("Не нашли ни одной ручки с ценой"); break; } S.handleCat = L; S.kitchen.opts.handle = L[0].id; render(); rebuild(); proSheet(); toast("В каталоге " + L.length + " ручек"); break; }
    case "catReset": S.handleCat = null; S.kitchen.opts.handle = "h1"; render(); rebuild(); proSheet(); break;
    case "modAuto": pushUndo(); S.kitchen.manual = null; S.kitchen.over = {}; selSlot = null; render(); rebuild(); if (sheetKind === "pro") proSheet(); break;
    case "resetAll": { const st = S.studio; S = defaultState(); S.studio = st; S.orderId = MO.uid("o"); tab = 0; closeSheet(); render(); rebuild(true); toast("Начали заново"); break; }
  }
}

// ---------- кнопки сцены ----------
$("btnSend").onclick = sendSheet;
$("btnCode").onclick = codeSheet;
$("btnPro").onclick = proSheet;
$("tFit").onclick = () => View.fit(null, true);
$("tOpen").onclick = () => { if (tab === 2) tab = 1; else openDoors = !openDoors; render(); rebuild(); };
$("tShot").onclick = () => { const s = View.snapshot(); if (!s) return toast("3D ещё загружается"); openSheet("shot", head("Картинка проекта") + '<img class="shot" src="' + s + '" alt="Ваш проект"><p class="note">Нажмите на картинку и удерживайте, чтобы сохранить её или отправить. На компьютере - правая кнопка мыши, "Сохранить картинку".</p>'); };
$("tPan").onclick = () => { View.panMode = !View.panMode; $("tPan").classList.toggle("on", View.panMode); $("tPan").textContent = View.panMode ? "Двигаем" : "Двигать"; };
$("tPhoto").onclick = () => {
  if (View.hasPhoto) { View.setPhoto(null); View.hasPhoto = false; View.panMode = false; $("tPhoto").textContent = "Примерить на фото"; $("tPhoto").classList.remove("on"); $("tPan").classList.add("hide"); return; }
  $("photoFile").value = ""; $("photoFile").click();
};
$("photoFile").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    View.setPhoto(img); View.hasPhoto = true; $("tPhoto").textContent = "Убрать фото"; $("tPhoto").classList.add("on"); $("tPan").classList.remove("hide"); $("tPan").classList.remove("on"); $("tPan").textContent = "Двигать";
    const hint = $("hint"); hint.textContent = "Поверните и подвиньте мебель на её место на фото"; hint.classList.remove("off"); hintArmed = performance.now() + 1500;
  };
  img.onerror = () => toast("Не получилось открыть фото");
  img.src = URL.createObjectURL(f);
};
let hintArmed = 0;
View.onMove = () => { if (performance.now() > hintArmed) $("hint").classList.add("off"); };
View.onPickMod = slot => {
  if (S.type !== "kitchen") return;
  if (!slot) { if (selSlot) { selSlot = null; render(); } return; }
  if (slot === "top") { selSlot = null; tab = 2; render(); rebuild(); return; }
  if (S.lock) { toast("Шкафы расставил дизайнер - здесь меняются цвета и материалы"); return; }
  selSlot = slot; tab = 0; render();
  if (selSlot) { $("body").scrollTop = 0; if (window.innerWidth < 900) $("body").scrollIntoView({ block: "nearest" }); }
};
View.canPick = slot => S.type === "kitchen" && !S.lock && (slot === "top" || !!slotInfo(slot));
View.onPick = j => { if (S.type !== "kupe") return; selDoor = j; tab = 1; openDoors = false; render(); rebuild(); };

// ---------- запуск ----------
loadState();
if (/[#&](order|cfg)=/.test(location.hash)) {
  const m = /[#&](?:order|cfg)=([A-Za-z0-9._-]+)/.exec(location.hash);
  openCode(m[1]).then(() => { render(); rebuild(true); }).catch(() => {});
}
cur = S.type === "ext" ? null : buildOrder(S);
render();
rebuild(true);
View.init($("stage")).then(() => { $("load").remove(); rebuild(true); }).catch(e => {
  console.error(e);
  $("load").innerHTML = "3D-модель не загрузилась. Проверьте интернет и обновите страницу.<br>Цвета, цену и заявку можно собрать и без неё.";
});
