// Проверка модуля на примерах. Запуск: node tools/test.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const M = require("../mebel-order.js");
const ex = f => fs.readFileSync(path.join(__dirname, "..", "examples", f), "utf8");
let n = 0;
const test = (name, fn) => Promise.resolve().then(fn).then(() => { n++; console.log("ok  " + name); }, e => { console.log("FAIL " + name + "\n", e); process.exitCode = 1; });

(async () => {
  for (const f of ["shkaf-kupe.mebel.json", "kuhnya.mebel.json"]) {
    await test(f + ": читается без ошибок и предупреждений", () => {
      const r = M.parse(ex(f));
      assert.strictEqual(r.report.ok, true);
      assert.deepStrictEqual(r.report.warnings, []);
      assert.deepStrictEqual(r.order, JSON.parse(ex(f)), "parse не должен менять правильный заказ");
    });
    await test(f + ": расчёт цены сходится", () => {
      const o = JSON.parse(ex(f)), q = M.quote(o);
      ["materials", "work", "services", "cost", "markup", "subtotal", "discountSum", "total", "prepaySum", "profit"].forEach(k => assert.strictEqual(q[k], o.quote[k], k));
      assert.strictEqual(q.subtotal - q.discountSum, q.total);
      assert.strictEqual(q.clientLines.reduce((s, l) => s + l.sum, 0), q.subtotal);
      assert.strictEqual(q.lines.reduce((s, l) => s + l.sum, 0), q.materials + q.services);
      assert.strictEqual(q.total % o.pricing.roundTo, 0);
    });
    await test(f + ": список на распил", () => {
      const o = JSON.parse(ex(f)), rows = M.cutList(o), grouped = M.cutList(o, { group: true });
      assert.ok(rows.length > 10);
      rows.forEach(r => {
        assert.ok(r.length > 0 && r.width > 0 && r.material.sheet);
        assert.ok(r.cutLength <= r.length && r.cutWidth <= r.width);
        assert.strictEqual(r.canRotate, r.grain === "any");
        if (r.grain === "length") assert.ok(r.length <= r.material.sheet.w, r.name + " длиннее листа");
      });
      assert.strictEqual(grouped.reduce((s, r) => s + r.qty, 0), rows.reduce((s, r) => s + r.qty, 0));
    });
    await test(f + ": ссылка туда и обратно", async () => {
      const o = JSON.parse(ex(f));
      const link = await M.toLink(o, "https://example.com/tool.html#old");
      assert.ok(link.startsWith("https://example.com/tool.html#order=m1."));
      const back = await M.fromLink(link);
      assert.deepStrictEqual(back.order, o);
      assert.strictEqual(await M.fromLink("https://example.com/"), null);
    });
    await test(f + ": копия для клиента без себестоимости", () => {
      const o = JSON.parse(ex(f)), c = M.forClient(o), text = JSON.stringify(c);
      assert.strictEqual(c.quote.total, o.quote.total);
      ["cost", "markup", "profit", "lines"].forEach(k => assert.ok(!(k in c.quote)));
      assert.ok(!/"markupPct"|"expenses"|"price"/.test(text));
      assert.strictEqual(M.validate(c).ok, true);
      assert.ok(o.quote.cost > 0, "исходный заказ не изменился");
    });
  }

  await test("кухня: поворот модуля на 90 градусов", () => {
    const o = JSON.parse(ex("kuhnya.mebel.json")), pr = o.products[0];
    const m = pr.modules.find(x => x.rot === 90), side = m.parts[0];
    const b = M.partBox(o, pr, m, side);
    // тумба 600 у левой стены: pos.z = 1180, занимает z от 580 до 1180, глубина идёт по X
    assert.deepStrictEqual(b, { x0: 3, x1: 560, y0: 100, y1: 820, z0: 1164, z1: 1180 });
    const bb = M.productBounds(o, pr);
    assert.deepStrictEqual([bb.w, bb.h, bb.d], [3000, 2170, 1780]);
  });
  await test("кухня: фасады для фабрики и отделка одним полем", () => {
    const o = JSON.parse(ex("kuhnya.mebel.json"));
    const before = M.quote(o).total, fl = M.facadeList(o);
    assert.strictEqual(fl.reduce((s, r) => s + r.qty, 0), 17);
    o.products[0].finish.facade = "mdf18-enamel";
    const after = M.recalc(o).quote.total;
    assert.ok(after > before);
    assert.ok(M.facadeList(o).every(r => r.material.id === "mdf18-enamel"));
  });
  await test("купе: оплаты, этапы, текст для клиента", () => {
    const o = JSON.parse(ex("shkaf-kupe.mebel.json")), b = M.balance(o);
    assert.strictEqual(b.paid, 200000);
    assert.strictEqual(b.due, o.quote.total - 200000);
    assert.strictEqual(b.profitFact, 200000 - 108500);
    assert.deepStrictEqual(M.nextDue(o), { date: "2026-12-01", text: "Позвонить клиенту, согласовать день монтажа" });
    M.setStage(o, "install", "2026-12-08");
    assert.strictEqual(o.stage, "install");
    assert.strictEqual(o.timeline.filter(t => t.stage === "install").length, 1);
    assert.ok(M.clientText(o).replace(/\u00a0/g, " ").includes("Стоимость: 354 000 ₸ (со скидкой 5%)"));
    assert.ok(M.whatsappLink(o, "Здравствуйте").startsWith("https://wa.me/77015551234?text="));
    assert.strictEqual(M.waPhone("8 (777) 123-45-67"), "77771234567");
  });

  await test("валюта и страна: рубли", () => {
    const o = M.create({ currency: "RUB" });
    assert.strictEqual(o.currency, "RUB");
    assert.strictEqual(o.country, "RU");
    assert.strictEqual(o.pricing.roundTo, 100);
    assert.strictEqual(o.catalog.materials.ldsp16.price, 4200);
    assert.strictEqual(M.validate(o).warnings.filter(w => w.path === "currency").length, 0);
    const k = JSON.parse(ex("shkaf-kupe.mebel.json"));
    k.currency = "RUB"; delete k.quote; M.recalc(k);
    assert.strictEqual(k.quote.currency, "RUB");
    assert.ok(M.clientText(k).includes("\u00a0₽"));
    assert.strictEqual(M.money(354000, "RUB"), "354 000\u00a0₽");
    assert.strictEqual(M.moneyWords(121000, "RUB"), "сто двадцать одна тысяча рублей");
    assert.strictEqual(M.moneyWords(2001, "RUB"), "две тысячи один рубль");
    assert.strictEqual(M.moneyWords(352000, "KZT"), "триста пятьдесят две тысячи тенге");
    assert.strictEqual(M.moneyWords(3, "RUB"), "три рубля");
    assert.strictEqual(M.validate(Object.assign(M.create(), { currency: "XYZ" })).warnings.some(w => w.path === "currency"), true);
    assert.strictEqual(M.orderCountry({ currency: "RUB" }), "RU");
    assert.strictEqual(M.orderCountry({ currency: "KZT" }), "KZ");
    assert.strictEqual(M.create({ currency: "USD" }).catalog.materials.ldsp16.price, 42);
  });

  await test("проверка ловит ошибки", () => {
    const o = JSON.parse(ex("shkaf-kupe.mebel.json")), pr = o.products[0];
    pr.parts[0].mat = "@net-takoj";           // роль не задана
    pr.parts[1].edges = { left: "pvc04" };    // у боковины нет стороны left
    pr.parts[2].id = pr.parts[3].id;          // повтор id
    pr.parts[4].a = 3500;                     // не выходит из листа
    pr.modules[0].parts[0].y = 80;            // полка врезалась в дно
    pr.modules[0].parts[1].mat = "ldsp99";    // нет в каталоге
    o.payments.push({ date: "вчера", amount: -5 });
    o.stage = "sdelano";
    const r = M.validate(o), has = (list, s) => assert.ok(list.some(e => e.msg.includes(s)), "нет сообщения: " + s);
    assert.strictEqual(r.ok, false);
    has(r.errors, 'роль материала "@net-takoj"');
    has(r.errors, 'нет стороны "left"');
    has(r.errors, "Повторяется id");
    has(r.errors, '"ldsp99" нет в catalog.materials');
    has(r.errors, "Сумма оплаты");
    has(r.errors, "Неизвестный этап");
    has(r.warnings, "не выходит из листа");
    has(r.warnings, "пересекаются");
    assert.strictEqual(M.validate(null).ok, false);
    assert.strictEqual(M.validate({}).ok, false);
  });

  await test("новый пустой заказ правильный", () => {
    const o = M.create({ client: { name: "Тест", phone: "+7 701 000 00 00" } });
    const r = M.validate(o);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(M.quote(o).total, 0);
    assert.notStrictEqual(M.uid("p"), M.uid("p"));
    assert.ok(M.fileName(o).endsWith(".mebel.json"));
  });

  await test("старый расчёт калькулятора переносится", () => {
    const r = M.parse(ex("staryj-raschet-kalkulyatora.json"), { prices: { ldsp: 25000, markup: 35 } });
    const o = r.order, pr = o.products[0];
    assert.strictEqual(r.from, "calc-legacy");
    assert.strictEqual(r.report.ok, true, JSON.stringify(r.report.errors));
    assert.strictEqual(o.client.name, "Марат");
    assert.strictEqual(o.createdAt.slice(0, 10), "2026-11-10");
    assert.strictEqual(pr.parts.length, 9);
    assert.strictEqual(pr.parts[6].role, "facade");
    assert.deepStrictEqual(pr.parts[0].edges, { front: "pvc04" });
    assert.deepStrictEqual(Object.keys(pr.parts[6].edges).sort(), ["bottom", "left", "right", "top"]);
    assert.strictEqual(pr.parts[8].mat, "dvp3");
    assert.deepStrictEqual(pr.size, { w: 600, h: 716, d: 450 });
    assert.strictEqual(o.catalog.materials.ldsp16.price, 25000);
    assert.strictEqual(o.pricing.markupPct, 35);
    assert.strictEqual(o.terms.days, 14);
    assert.ok(o.quote.total > 0);
    // старые режимы "купе" и "кухня" переносятся параметрами
    const k = M.migrate({ name: "Купе", date: "01.11.2026", total: 480000, state: { mode: "kupe", client: "Анна", W: "2400", H: "2600", D: "600", N: "3", M: "3", prof: "std", secs: [{}], doors: ["mirror"], extras: [], disc: "0", prepay: "50", days: "21" } });
    assert.strictEqual(k.order.products[0].type, "kupe");
    assert.strictEqual(k.order.quote.total, 480000);
    assert.strictEqual(M.validate(k.order).ok, true);
    assert.throws(() => M.migrate({ foo: 1 }), /не заказ/);
    assert.throws(() => M.migrate({ format: "mebel-order", version: "2.0" }), /более новой/);
    assert.throws(() => M.parse("{oops"), /не JSON/);
  });

  await test("незнакомые поля сохраняются", () => {
    const o = JSON.parse(ex("shkaf-kupe.mebel.json"));
    o.version = "1.3"; o.futureField = { a: 1 }; o.products[0].parts[0].futureProp = "x"; o.x = { tracker: { color: "red" } };
    const r = M.parse(JSON.stringify(o));
    assert.strictEqual(r.report.ok, true);
    assert.deepStrictEqual(r.order, o);
  });

  await test("JSON Schema: примеры подходят (если установлен ajv)", () => {
    let Ajv;
    try { Ajv = require("ajv/dist/2020"); } catch (e) { console.log("    ajv не установлен - пропущено"); return; }
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "mebel-order.schema.json"), "utf8"));
    const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
    for (const f of ["shkaf-kupe.mebel.json", "kuhnya.mebel.json"]) {
      const o = JSON.parse(ex(f));
      assert.ok(validate(o), f + ": " + JSON.stringify(validate.errors, null, 1));
      assert.ok(validate(M.forClient(o)), "forClient " + f);
    }
    assert.ok(validate(M.create()), JSON.stringify(validate.errors));
    assert.ok(validate(M.parse(ex("staryj-raschet-kalkulyatora.json")).order), JSON.stringify(validate.errors));
    const bad = JSON.parse(ex("shkaf-kupe.mebel.json")); bad.products[0].parts[0].o = "W"; delete bad.products[0].parts[1].z;
    assert.ok(!validate(bad));
  });

  await test("листы по раскладке деталей", () => {
    const sheet = { w: 2800, h: 2070 };
    // 4 детали 1380x1000 помещаются на один лист, пятая - уже второй
    const four = Array.from({ length: 4 }, () => ({ w: 1380, h: 1000, rot: false }));
    assert.strictEqual(M.nestSheets(four, sheet).sheets, 1);
    assert.strictEqual(M.nestSheets(four.concat([{ w: 1380, h: 1000, rot: false }]), sheet).sheets, 2);
    // длинные боковины: по площади хватило бы 1 листа, на деле нужно 2
    const sides = Array.from({ length: 4 }, () => ({ w: 2500, h: 600, rot: false }));
    assert.strictEqual(M.nestSheets(sides, sheet).sheets, 2);
    // деталь больше листа не раскладывается; порядок деталей на результат не влияет
    assert.strictEqual(M.nestSheets([{ w: 3000, h: 500, rot: true }], sheet).unplaced.length, 1);
    const mix = four.concat(sides, [{ w: 700, h: 300, rot: true }, { w: 2000, h: 450, rot: false }]);
    assert.strictEqual(M.nestSheets(mix, sheet).sheets, M.nestSheets(mix.slice().reverse(), sheet).sheets);
    const o = JSON.parse(ex("shkaf-kupe.mebel.json")); o.pricing.sheetMode = "nest";
    const m = M.bom(o).materials.find(x => x.id === "ldsp16");
    assert.ok(m.sheets >= Math.ceil(m.area / 5.796) && m.nest.unplaced === 0);
    assert.strictEqual(M.create().pricing.sheetMode, "nest");
    // столешница плитами по 3 м: 3300 - две плиты, 1800 + 1100 - одна, 2000 + 1800 - две
    assert.strictEqual(M.packLengths([3300], 3000), 2);
    assert.strictEqual(M.packLengths([1800, 1100], 3000), 1);
    assert.strictEqual(M.packLengths([2000, 1800], 3000), 2);
    const k = JSON.parse(ex("kuhnya.mebel.json")), was = M.bom(k).materials.find(x => x.kind === "length");
    k.catalog.materials[was.id].slab = 3000;
    const now = M.bom(k).materials.find(x => x.id === was.id);
    assert.ok(now.slabs >= 1 && now.qty === now.slabs * 3 && now.qty >= was.qty);
  });

  console.log(process.exitCode ? "\nЕСТЬ ОШИБКИ" : "\nВсе проверки прошли: " + n);
})();
