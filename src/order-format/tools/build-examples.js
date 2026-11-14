// Строит примеры заказов: examples/shkaf-kupe.mebel.json и examples/kuhnya.mebel.json.
// Запуск: node tools/build-examples.js
// Это не "движок" калькулятора, а простой способ получить правдоподобные примеры с настоящими координатами.
const fs = require("fs");
const path = require("path");
const M = require("../mebel-order.js");

const T = 16; // толщина ЛДСП

// Счётчики, чтобы id в примерах были короткими и не менялись от запуска к запуску.
function ids() {
  let p = 0, m = 0;
  return { part: () => "p" + (++p), module: () => "m" + (++m) };
}

// Маленький помощник: складывает детали в список. X - вертикальная боковая, Y - горизонтальная, Z - фронтальная.
function builder(list, id) {
  const add = (o, name, role, x, y, z, a, b, mat, extra) => {
    const part = Object.assign({ id: id.part(), name, role, mat, o, x, y, z, a, b }, extra || {});
    list.push(part);
    return part;
  };
  return {
    X: (name, role, x, y, z, h, d, mat = "@corpus", extra) => add("X", name, role, x, y, z, h, d, mat, extra),
    Y: (name, role, x, y, z, w, d, mat = "@corpus", extra) => add("Y", name, role, x, y, z, w, d, mat, extra),
    Z: (name, role, x, y, z, w, h, mat = "@corpus", extra) => add("Z", name, role, x, y, z, w, h, mat, extra)
  };
}
const FRONT = { edges: { front: "@edge" } };

function finishOrder(o, stamp) {
  M.assignMarks(o);
  o.updatedAt = stamp;
  o.quote = M.quote(o);
  o.quote.calcAt = stamp;
  const rep = M.validate(o);
  if (!rep.ok || rep.warnings.length) { console.log(JSON.stringify(rep.all, null, 1)); throw new Error("Пример не прошёл проверку"); }
  return o;
}

// ================= Шкаф-купе 2400 x 2600 x 600, три двери =================
function kupe() {
  const id = ids();
  const W = 2400, H = 2600, D = 600, PL = 80, BK = 3, DOORZONE = 100;
  const o = M.create({
    id: "o_example_kupe",
    number: "2026-014",
    title: "Шкаф-купе в спальню",
    createdAt: "2026-11-02T05:30:00.000Z",
    stage: "production",
    client: { name: "Айгуль Сериккызы", phone: "+7 701 555 12 34", address: "г. Алматы, ул. Абая 10, кв. 25", note: "Звонить после 18:00" },
    terms: { days: 21, daysKind: "work", warrantyMonths: 12 },
    notes: "Розетка на левой стене на высоте 300 мм - в боковине нужен вырез."
  });
  o.catalog.materials.ldsp16.decor = "Дуб Сонома";
  o.catalog.edges.pvc04.name = "Кромка ПВХ 0.4 мм, Дуб Сонома";

  const pr = M.newProduct({
    id: "pr1", type: "kupe", name: "Шкаф-купе", size: { w: W, h: H, d: D },
    finish: { corpus: "ldsp16", back: "dvp3", edge: "pvc04", doorMirror: "mirror4", doorPanel: "ldsp16" },
    params: { type: "korp", W, H, D, sections: 3, doors: 3, profile: "std" },
    generator: { id: "example-kupe", version: 1 }
  });
  const b = builder(pr.parts, id);
  const depth = D - BK;        // глубина корпуса без задней стенки
  const inner = depth - DOORZONE; // глубина начинки (место под двери - 100 мм)
  b.X("Боковина левая", "side", 0, 0, BK, H, depth, "@corpus", { edges: { front: "@edge" }, grain: "a", note: "Вырез под розетку 80x80 на высоте 300 мм от пола" });
  b.X("Боковина правая", "side", W - T, 0, BK, H, depth, "@corpus", { edges: { front: "@edge" }, grain: "a" });
  b.Y("Крыша", "top", T, H - T, BK, W - 2 * T, depth, "@corpus", FRONT);
  b.Y("Дно", "bottom", T, PL, BK, W - 2 * T, depth, "@corpus", FRONT);
  b.Z("Цоколь", "plinth", T, 0, BK + depth - T, W - 2 * T, PL);
  const secW = [778, 780, 778], y0 = PL + T, secH = H - T - y0;
  let x = T;
  const secX = [];
  secW.forEach((w, i) => {
    secX.push(x); x += w;
    if (i < secW.length - 1) { b.X("Перегородка " + (i + 1), "partition", x, y0, BK, secH, inner, "@corpus", FRONT); x += T; }
  });
  b.Z("Задняя стенка левая", "back", 0, 0, 0, W / 2, H, "@back");
  b.Z("Задняя стенка правая", "back", W / 2, 0, 0, W / 2, H, "@back");

  // Секции - модули. Координаты полок внутри секции считаются от её левого нижнего заднего угла.
  const shelvesAt = [[400, 800, 1200, 1600, 2000], [400, 2000], [300, 2000]];
  const secNames = ["Секция 1 - полки", "Секция 2 - штанга", "Секция 3 - штанга"];
  secW.forEach((w, i) => {
    const m = M.newModule({ id: id.module(), kind: "section", name: secNames[i], pos: { x: secX[i], y: y0, z: BK }, size: { w, h: secH, d: inner } });
    const mb = builder(m.parts, id);
    shelvesAt[i].forEach((y, k) => mb.Y("Полка " + (k + 1), "shelf", 0, y, 0, w, inner, "@corpus", FRONT));
    if (i > 0) m.hardware.push({ item: "rod", qty: +(w / 1000).toFixed(2) });
    m.hardware.push({ name: "Полкодержатели", qty: shelvesAt[i].length * 4, unit: "шт", price: 30 });
    pr.modules.push(m);
  });

  // Двери - тоже модули: наполнение - деталь, профиль - фурнитура.
  const doorW = 806, doorH = 2448, fillW = 770, fillH = 2400;
  const doors = [
    { name: "Дверь 1 - зеркало", x: T, z: 520, mat: "@doorMirror" },
    { name: "Дверь 2 - ЛДСП", x: 797, z: 555, mat: "@doorPanel" },
    { name: "Дверь 3 - зеркало", x: 1578, z: 520, mat: "@doorMirror" }
  ];
  doors.forEach(d => {
    const m = M.newModule({ id: id.module(), kind: "slide-door", name: d.name, pos: { x: d.x, y: y0 + 20, z: d.z }, size: { w: doorW, h: doorH, d: 30 }, params: { profile: "std", fill: d.mat } });
    const part = { id: id.part(), name: "Наполнение двери", role: "facade", mat: d.mat, o: "Z", x: (doorW - fillW) / 2, y: (doorH - fillH) / 2, z: 0, a: fillW, b: fillH, facade: { open: "slide" } };
    if (d.mat === "@doorPanel") part.grain = "b";
    m.parts.push(part);
    m.hardware.push({ item: "prof-std", qty: 1 });
    pr.modules.push(m);
  });
  pr.hardware.push({ item: "fasteners", name: "Крепёж и опоры", qty: 1, price: 6000 });
  o.products.push(pr);

  o.extras.push({ id: "x1", kind: "delivery", name: "Доставка и подъём", qty: 1, unit: "усл", price: 5000 });
  o.extras.push({ id: "x2", kind: "install", name: "Монтаж", qty: 1, unit: "усл", price: 10000 });
  o.pricing.discountPct = 5;
  o.timeline = [
    { stage: "lead", done: "2026-11-02" },
    { stage: "measure", done: "2026-11-04", note: "Ниши нет, стены ровные" },
    { stage: "design", done: "2026-11-06" },
    { stage: "contract", done: "2026-11-09" },
    { stage: "production", done: "2026-11-10", note: "Листы заказаны на распил" },
    { stage: "install", plan: "2026-12-08" }
  ];
  o.deadline = "2026-12-08";
  o.payments.push({ id: "pay1", date: "2026-11-09", amount: 200000, kind: "prepay", method: "kaspi" });
  o.expenses.push({ id: "exp1", date: "2026-11-10", amount: 96500, category: "materials", supplier: "База ЛДСП", note: "4 листа ЛДСП, 2 листа ДВП" });
  o.expenses.push({ id: "exp2", date: "2026-11-10", amount: 12000, category: "cutting" });
  o.reminders.push({ id: "rem1", date: "2026-12-01", text: "Позвонить клиенту, согласовать день монтажа", done: false });
  return finishOrder(o, "2026-11-10T09:00:00.000Z");
}

// ================= Кухня угловая: стена A 3000 мм + левая стена B 1800 мм =================
function kitchen() {
  const id = ids();
  const LH = 720, LD = 560, UH = 720, UD = 300, PLINTH = 100, UY = 1450, BK = 3, FT = 18;
  const o = M.create({
    id: "o_example_kitchen",
    number: "2026-015",
    title: "Кухня угловая",
    createdAt: "2026-11-05T06:00:00.000Z",
    stage: "design",
    client: { name: "Данияр Ахметов", phone: "8 777 123 45 67", address: "г. Астана, пр. Мангилик Ел 20, кв. 101" },
    terms: { days: 30, daysKind: "work", warrantyMonths: 12, validDays: 14 }
  });
  o.catalog.materials.ldsp16.decor = "Белый";
  o.catalog.materials["mdf18-film"].decor = "Графит матовый";
  o.catalog.materials["mdf18-film"].color = "#4a4d52";
  o.catalog.materials.top38.decor = "Дуб Вотан";

  const pr = M.newProduct({
    id: "pr1", type: "kitchen", name: "Кухня угловая", size: { w: 3000, h: UY + UH, d: 1780 },
    finish: { corpus: "ldsp16", facade: "mdf18-film", top: "top38", back: "dvp3", edge: "pvc04" },
    params: { layout: 2, walls: [{ name: "A", len: 3000 }, { name: "B", len: 1800 }], lowerH: LH, upperH: UH, handles: "obychnye" },
    generator: { id: "example-kitchen", version: 1 }
  });

  const fac = (mb, name, x, y, w, h, z, open) => mb.Z(name, "facade", x, y, z, w, h, "@facade", { facade: { open } });

  // Корпус тумбы или навесного шкафа в координатах модуля.
  function box(m, mb, w, h, d, lower) {
    const dk = d - BK;
    mb.X("Боковина левая", "side", 0, 0, BK, h, dk, "@corpus", FRONT);
    mb.X("Боковина правая", "side", w - T, 0, BK, h, dk, "@corpus", FRONT);
    mb.Y("Дно", "bottom", T, 0, BK, w - 2 * T, dk, "@corpus", FRONT);
    if (lower) {
      mb.Y("Царга задняя", "other", T, h - T, BK, w - 2 * T, 100);
      mb.Y("Царга передняя", "other", T, h - T, d - 100, w - 2 * T, 100, "@corpus", FRONT);
      m.hardware.push({ item: "leg", qty: 4 });
    } else {
      mb.Y("Крыша", "top", T, h - T, BK, w - 2 * T, dk, "@corpus", FRONT);
      m.hardware.push({ name: "Навес регулируемый", qty: 2, unit: "шт", price: 600 });
    }
    mb.Z("Задняя стенка", "back", 0, 0, 0, w, h, "@back");
  }
  function doors(m, mb, w, h, d, n, x0 = 0, wDoors = w) {
    const dw = wDoors / n;
    for (let i = 0; i < n; i++) fac(mb, n > 1 ? "Фасад " + (i ? "правый" : "левый") : "Фасад", x0 + i * dw + 2, 2, dw - 4, h - 4, d, n > 1 ? (i ? "right" : "left") : "left");
    m.hardware.push({ item: "hinge", qty: 2 * n }, { item: "handle", qty: n });
  }
  function drawers(m, mb, w, heights, d) {
    let y = 2;
    heights.forEach((fh, k) => {
      fac(mb, "Фасад ящика " + (k + 1), 2, y, w - 4, fh, d, "drawer");
      const bx = T + 13, bw = w - 2 * T - 26, bh = Math.max(60, fh - 60), bd = d - 60, by = y + 30;
      mb.X("Ящик " + (k + 1) + ": бок", "drawer", bx, by, 50, bh, bd, "@corpus", { edges: { top: "@edge" } });
      mb.X("Ящик " + (k + 1) + ": бок", "drawer", bx + bw - T, by, 50, bh, bd, "@corpus", { edges: { top: "@edge" } });
      mb.Z("Ящик " + (k + 1) + ": перед", "drawer", bx + T, by, d - 10 - T, bw - 2 * T, bh, "@corpus", { edges: { top: "@edge" } });
      mb.Z("Ящик " + (k + 1) + ": зад", "drawer", bx + T, by, 50, bw - 2 * T, bh, "@corpus", { edges: { top: "@edge" } });
      mb.Y("Ящик " + (k + 1) + ": дно", "drawer", bx, by - 3, 50, bw, bd, "@back");
      y += fh + 5;
    });
    m.hardware.push({ item: "kguide", qty: heights.length }, { item: "handle", qty: heights.length });
  }
  function lower(kind, name, w, pos, rot, wall, fill) {
    const m = M.newModule({ id: id.module(), kind, name, pos, rot, wall, size: { w, h: LH, d: LD } });
    const mb = builder(m.parts, id);
    box(m, mb, w, LH, LD, true);
    fill(m, mb);
    pr.modules.push(m);
  }
  function upper(kind, name, w, x, nDoors, extra) {
    const m = M.newModule({ id: id.module(), kind, name, pos: { x, y: UY, z: 0 }, rot: 0, wall: "A", size: { w, h: UH, d: UD } });
    const mb = builder(m.parts, id);
    box(m, mb, w, UH, UD, false);
    mb.Y("Полка", "shelf", T, 352, BK, w - 2 * T, UD - BK - 20, "@corpus", FRONT);
    doors(m, mb, w, UH, UD, nDoors);
    if (extra) extra(m, mb);
    pr.modules.push(m);
  }
  const shelf = w => (m, mb) => mb.Y("Полка", "shelf", T, 350, BK, w - 2 * T, LD - BK - 40, "@corpus", FRONT);

  // Стена A: модули стоят вдоль оси X, фасадами к себе (поворот 0).
  lower("lower-corner", "Тумба угловая 1000", 1000, { x: 0, y: PLINTH, z: 0 }, 0, "A", (m, mb) => { shelf(1000)(m, mb); doors(m, mb, 1000, LH, LD, 1, 600, 400); m.note = "Левая часть 600 мм закрыта тумбой стены B. Дверь справа, петли справа."; m.parts[m.parts.length - 1].facade.open = "right"; });
  lower("lower-sink", "Тумба под мойку 800", 800, { x: 1000, y: PLINTH, z: 0 }, 0, "A", (m, mb) => doors(m, mb, 800, LH, LD, 2));
  lower("lower-oven", "Тумба под духовку 600", 600, { x: 1800, y: PLINTH, z: 0 }, 0, "A", (m, mb) => {
    mb.Y("Полка под духовку", "shelf", T, 110, BK, 600 - 2 * T, LD - BK, "@corpus", FRONT);
    fac(mb, "Фасад нижний (глухой)", 2, 2, 596, 96, LD, "fixed");
  });
  lower("lower-drawers3", "Тумба с 3 ящиками 600", 600, { x: 2400, y: PLINTH, z: 0 }, 0, "A", (m, mb) => drawers(m, mb, 600, [283, 283, 140], LD));

  // Стена B (левая): модули повёрнуты на 90 градусов - фасады смотрят вправо, ширина модуля идёт вдоль оси Z.
  // При повороте 90 модуль занимает место от pos.z - ширина до pos.z.
  lower("lower-drawers3", "Тумба с 3 ящиками 600", 600, { x: 0, y: PLINTH, z: 1180 }, 90, "B", (m, mb) => drawers(m, mb, 600, [283, 283, 140], LD));
  lower("lower-shelf", "Тумба с полкой 600", 600, { x: 0, y: PLINTH, z: 1780 }, 90, "B", (m, mb) => { shelf(600)(m, mb); doors(m, mb, 600, LH, LD, 1); });

  // Верх - только на стене A.
  upper("upper-shelf", "Шкаф навесной 400", 400, 0, 1);
  upper("upper-shelf", "Шкаф навесной 600", 600, 400, 1);
  upper("upper-dryer", "Шкаф с сушкой 800", 800, 1000, 2, m => m.hardware.push({ item: "dryer", qty: 1 }));
  upper("upper-hood", "Шкаф под вытяжку 600", 600, 1800, 1);
  upper("upper-shelf", "Шкаф навесной 600", 600, 2400, 1);

  // Общие детали изделия: столешницы и цоколь. Их координаты - от угла кухни.
  const b = builder(pr.parts, id);
  const topY = PLINTH + LH;
  b.Y("Столешница A", "countertop", 0, topY, 0, 3000, 600, "@top", { grain: "a", note: "Вырез под мойку и под варочную панель - по шаблонам техники" });
  b.Y("Столешница B", "countertop", 0, topY, 600, 600, 1180, "@top", { grain: "b", note: "Стык со столешницей A - на планку или еврозапил" });
  b.Z("Цоколь A левый", "plinth", 0, 0, 500, 1500, PLINTH, "@corpus", { edges: { top: "@edge" } });
  b.Z("Цоколь A правый", "plinth", 1500, 0, 500, 1500, PLINTH, "@corpus", { edges: { top: "@edge" } });
  b.X("Цоколь B", "plinth", 500 + T + 2, 0, 580, PLINTH, 1200, "@corpus", { edges: { top: "@edge" } });
  pr.hardware.push({ item: "fasteners", name: "Крепёж", qty: pr.modules.length });
  pr.hardware.push({ name: "Плинтус столешницы", qty: 4.2, unit: "м", price: 2000 });
  o.products.push(pr);

  o.extras.push({ id: "x1", kind: "item", name: "Стеновая панель", qty: 3, unit: "п.м.", price: 10000 });
  o.extras.push({ id: "x2", kind: "item", name: "Вырез под мойку и варочную панель", qty: 2, unit: "шт", price: 5000 });
  o.extras.push({ id: "x3", kind: "delivery", name: "Доставка", qty: 1, unit: "усл", price: 10000 });
  o.extras.push({ id: "x4", kind: "install", name: "Монтаж кухни", qty: 1, unit: "усл", price: 30000 });
  o.timeline = [
    { stage: "lead", done: "2026-11-05" },
    { stage: "measure", done: "2026-11-07" },
    { stage: "design", plan: "2026-11-16" }
  ];
  o.reminders.push({ id: "rem1", date: "2026-11-16", text: "Отправить клиенту проект и цену в WhatsApp", done: false });
  return finishOrder(o, "2026-11-12T10:00:00.000Z");
}

const dir = path.join(__dirname, "..", "examples");
fs.mkdirSync(dir, { recursive: true });
[["shkaf-kupe", kupe()], ["kuhnya", kitchen()]].forEach(([name, order]) => {
  fs.writeFileSync(path.join(dir, name + ".mebel.json"), M.stringify(order) + "\n");
  const n = M.listParts(order).length;
  console.log(name + ": деталей " + n + ", итог " + M.fmtMoney(order.quote.total) + " ₸, себестоимость " + M.fmtMoney(order.quote.cost) + " ₸");
});
