/* kp-docs.js - сборка КП и договора (pdfmake) из заказа.
   Не зависит от страницы: можно подключить в калькулятор и вызвать
   KP.proposal(order, company) или KP.contract(order, company) - вернётся описание документа для pdfMake.createPdf().
   Вход: KP.normalize(что угодно) - JSON заказа или текст "Скопировать для клиента" из калькулятора. */
(function (root) {
  "use strict";
  const KP = {};
  const NBSP = " ";

  // ---------- форматирование ----------
  KP.num = n => String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  // Валюта: справочник в общем модуле заказа (MebelOrder). Без него - тенге, как раньше.
  const MO = () => root.MebelOrder;
  KP.curInfo = c => (MO() ? MO().currencyInfo(c || "KZT") : { code: "KZT", sign: "₸", forms: ["тенге", "тенге", "тенге"], roundTo: 1000 });
  KP.money = (n, cur) => KP.num(n) + NBSP + KP.curInfo(cur).sign;
  KP.curWord = (n, cur) => KP.plural(Math.floor(Math.abs(+n || 0)), ...KP.curInfo(cur).forms);
  KP.region = () => (MO() ? MO().region() : { country: "KZ", currency: "KZT" });
  // Страна исполнителя - от неё шаблон договора и реквизиты.
  KP.COUNTRY = {
    KZ: { name: "Казахстан", taxId: "БИН/ИИН", clientId: "ИИН", clientDoc: "Удостоверение личности", clientDocPh: "№, кем и когда выдано - для договора", account: "ИИК",
      legalPh: 'ИП "..." или ТОО "..."', basisPh: "Устава / талона о регистрации ИП", vatPh: "без НДС или в т.ч. НДС 16%", phonePh: "+7 7__ ___ __ __", cityPh: "Напр. Алматы", namePh: "Как в удостоверении - для договора" },
    RU: { name: "Россия", taxId: "ИНН", clientId: "", clientDoc: "Паспорт", clientDocPh: "серия, номер, кем и когда выдан - для договора", account: "Р/с",
      legalPh: 'ИП Иванов Иван Иванович или ООО "..."', basisPh: "Устава / листа записи ЕГРИП", vatPh: "без НДС или в т.ч. НДС 22%", phonePh: "+7 9__ ___ __ __", cityPh: "Напр. Москва", namePh: "Как в паспорте - для договора" }
  };
  KP.countryOf = co => (co && KP.COUNTRY[co.country] ? co.country : (KP.region().country in KP.COUNTRY ? KP.region().country : "KZ"));
  // НДС: "без НДС" как есть; "в т.ч. НДС 22%" - с суммой налога внутри цены.
  KP.vatText = function (total, vat, cur) {
    const v = String(vat || "").trim(); if (!v) return "";
    const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(v);
    if (!m || /без/i.test(v)) return v;
    const r = +m[1].replace(",", "."), tax = Math.floor(total * r / (100 + r));
    return "в том числе НДС " + m[1] + "% - " + KP.num(tax) + NBSP + KP.curInfo(cur).sign;
  };

  KP.words = function (n) {
    n = Math.round(+n || 0);
    if (n === 0) return "ноль";
    const u = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
    const t = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
    const h = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
    const g = [null, ["тысяча", "тысячи", "тысяч"], ["миллион", "миллиона", "миллионов"], ["миллиард", "миллиарда", "миллиардов"]];
    const out = [];
    let i = 0;
    while (n > 0) {
      const tri = n % 1000; n = Math.floor(n / 1000);
      if (tri) {
        const w = [];
        w.push(h[Math.floor(tri / 100)]);
        const r = tri % 100;
        if (r < 20) { w.push(i === 1 && r === 1 ? "одна" : i === 1 && r === 2 ? "две" : u[r]); }
        else { w.push(t[Math.floor(r / 10)]); const d = r % 10; w.push(i === 1 && d === 1 ? "одна" : i === 1 && d === 2 ? "две" : u[d]); }
        if (i > 0) { const d = r % 10, f = (r > 10 && r < 20) ? 2 : d === 1 ? 0 : (d >= 2 && d <= 4) ? 1 : 2; w.push(g[i][f]); }
        out.unshift(w.filter(Boolean).join(" "));
      }
      i++;
    }
    return out.join(" ");
  };
  KP.plural = (n, a, b, c) => { n = Math.abs(n) % 100; const d = n % 10; return (n > 10 && n < 20) ? c : d === 1 ? a : (d >= 2 && d <= 4) ? b : c; };

  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const parseDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); };
  KP.iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  KP.dateLong = s => { const d = parseDate(s); return d.getDate() + NBSP + MONTHS[d.getMonth()] + NBSP + d.getFullYear() + NBSP + "г."; };
  KP.dateShort = s => { const d = parseDate(s); return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear(); };
  KP.addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + (+n || 0)); return KP.iso(d); };

  // ---------- значения по умолчанию ----------
  KP.DEFAULT_COMPANY = {
    brand: "", legal: "", head: "", basis: "", bin: "", address: "", city: "", phone: "", email: "", site: "",
    bank: "", iik: "", bik: "", kbe: "", manager: "", headSign: "", logo: "", accent: "#2f6f5e", vat: "без НДС",
    country: "", inn: "", kpp: "", ogrn: "", rs: "", ks: ""   // Россия: ИНН, КПП (у ООО), ОГРН/ОГРНИП, расчётный и корр. счёт
  };
  KP.DEFAULT_CONDITIONS = [
    "В стоимость входят доставка, подъём на этаж, сборка и установка.",
    "Замер и эскиз - бесплатно.",
    "Цена фиксируется после внесения предоплаты и не меняется до конца работ.",
    "Материалы и цвет согласуем по образцам до запуска в производство.",
    "Бытовая техника, мойка и смеситель в стоимость не входят, если не указаны отдельно."
  ].join("\n");
  KP.DEFAULT_INTRO = "Благодарим за обращение. Мы подготовили расчёт по вашему проекту - ниже состав, материалы, стоимость и сроки.";

  KP.CONTRACT_TEMPLATE = `{исполнитель}, именуемый в дальнейшем "Исполнитель", в лице {руководитель}, действующего на основании {основание}, с одной стороны, и {заказчик}, именуемый в дальнейшем "Заказчик", с другой стороны, вместе именуемые "Стороны", заключили настоящий Договор о нижеследующем.

## Предмет договора
Исполнитель обязуется изготовить по индивидуальному заказу Заказчика мебель (далее - Изделие), доставить и установить её, а Заказчик обязуется принять Изделие и оплатить его на условиях настоящего Договора.
Наименование, размеры, материалы, комплектация и внешний вид Изделия определены в Спецификации (Приложение 1) и Эскизе (Приложение 2), которые являются неотъемлемой частью Договора.
Адрес доставки и установки: {адрес}.
Изделие изготавливается по индивидуальным размерам и пожеланиям Заказчика и имеет индивидуально-определённые свойства.

## Цена и порядок расчётов
Цена Договора составляет {цена} ({цена_прописью}) {валюта_цены}, {ндс}. Цена включает изготовление, материалы, фурнитуру, доставку и установку Изделия, если иное не указано в Спецификации.
Предоплата в размере {предоплата} ({предоплата_прописью}) {валюта_предоплаты}, что составляет {предоплата_проц}% цены, вносится Заказчиком при подписании Договора.
Оставшаяся сумма {остаток} ({остаток_прописью}) {валюта_остатка} оплачивается {остаток_когда}.
Оплата производится наличными или переводом на счёт Исполнителя. Исполнитель выдаёт Заказчику документ, подтверждающий оплату.
Цена является твёрдой и может быть изменена только по письменному соглашению Сторон при изменении состава заказа.

## Сроки
Срок изготовления Изделия - {срок} {дни} с даты внесения предоплаты и согласования Заказчиком Эскиза и Спецификации.
Доставка и установка производятся в течение {срок_монтажа} рабочих дней после готовности Изделия. Дату и время Стороны согласуют дополнительно.
Сроки продлеваются на время задержки, возникшей по причинам, зависящим от Заказчика: просрочка оплаты, неготовность помещения, отсутствие доступа в помещение, изменение заказа после согласования.
Исполнитель вправе выполнить работы досрочно, согласовав дату установки с Заказчиком.

## Обязанности Сторон
Исполнитель обязуется:
- изготовить Изделие в соответствии со Спецификацией и Эскизом из согласованных материалов;
- доставить и установить Изделие в согласованный срок;
- вывезти упаковку и убрать производственный мусор после установки;
- устранить недостатки, возникшие по его вине, в срок, указанный в разделе о приёмке.
Заказчик обязуется:
- оплатить Изделие в порядке и сроки, установленные Договором;
- к дате установки подготовить помещение: завершить отделочные работы, освободить место установки, обеспечить доступ, освещение и электропитание;
- до начала установки сообщить о расположении скрытой электропроводки, труб и других коммуникаций в стенах и полу;
- принять Изделие и подписать акт приёма-передачи.

## Приёмка
Приёмка Изделия производится Заказчиком после установки и оформляется актом приёма-передачи.
Замечания по качеству, комплектности и внешнему виду указываются в акте. Исполнитель устраняет обоснованные замечания в течение {срок_устранения} рабочих дней, если иной срок не согласован Сторонами.
Если Заказчик без письменных замечаний не подписывает акт в течение 5 (пяти) календарных дней после установки, Изделие считается принятым.
Право собственности на Изделие и риск его случайной гибели переходят к Заказчику с момента подписания акта приёма-передачи.

## Гарантия
Гарантийный срок на Изделие - {гарантия} со дня подписания акта приёма-передачи. На фурнитуру и механизмы действует гарантия их производителя, но не менее гарантийного срока на Изделие.
В течение гарантийного срока Исполнитель бесплатно устраняет недостатки, возникшие по его вине.
Гарантия не распространяется на недостатки, возникшие из-за нарушения правил эксплуатации, механических повреждений, воздействия воды, пара и высокой температуры, самостоятельного ремонта, переноса или переделки Изделия, а также на естественный износ.
Не являются недостатками: незначительные отличия оттенка и текстуры материалов от образцов и изображений на экране, связанные с особенностями партии материала; зазоры и подгонка, вызванные неровностями стен, пола и потолка помещения.

## Изменение заказа и отказ от договора
Изменения в Спецификацию и Эскиз вносятся по письменному согласованию Сторон до запуска Изделия в производство. Изменения после запуска в производство возможны, если они технически выполнимы, с оплатой Заказчиком дополнительных расходов и соразмерным продлением срока.
Заказчик вправе отказаться от Договора до передачи ему Изделия, оплатив Исполнителю часть цены пропорционально выполненной работе и возместив расходы, понесённые для исполнения Договора.

## Ответственность Сторон
За нарушение срока изготовления или установки по вине Исполнителя он уплачивает Заказчику неустойку в размере {пеня}% цены Договора за каждый день просрочки, но не более {пеня_лимит}% цены Договора.
За просрочку оплаты Заказчик уплачивает Исполнителю неустойку в размере {пеня_заказчика}% просроченной суммы за каждый день просрочки, но не более {пеня_заказчика_лимит}% этой суммы.
Стороны освобождаются от ответственности, если неисполнение обязательств вызвано обстоятельствами непреодолимой силы, которые Сторона не могла предвидеть и предотвратить. Сторона обязана сообщить о них другой Стороне в течение 3 (трёх) рабочих дней.

## Заключительные положения
Договор вступает в силу с момента подписания и действует до полного исполнения Сторонами своих обязательств.
Согласование эскизов, размеров, материалов, дат и других рабочих вопросов может вестись в мессенджере WhatsApp и по электронной почте с номеров и адресов, указанных в реквизитах Сторон. Такая переписка признаётся Сторонами надлежащим письменным согласованием.
Споры решаются путём переговоров. Срок ответа на претензию - 10 (десять) календарных дней. Если согласие не достигнуто, спор рассматривается судом в соответствии с законодательством Республики Казахстан.
Во всём, что не предусмотрено Договором, Стороны руководствуются Гражданским кодексом Республики Казахстан и Законом Республики Казахстан "О защите прав потребителей".
Заказчик даёт согласие на сбор и обработку своих персональных данных в объёме, необходимом для исполнения Договора.
Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой Стороны. Приложения: 1 - Спецификация, 2 - Эскиз.`;
  KP.CONTRACT_TEMPLATE_RU = `{исполнитель}, именуемый в дальнейшем "Исполнитель", в лице {руководитель}, действующего на основании {основание}, с одной стороны, и {заказчик}, именуемый в дальнейшем "Заказчик", с другой стороны, вместе именуемые "Стороны", заключили настоящий Договор о нижеследующем.

## Предмет договора
Исполнитель обязуется изготовить по индивидуальному заказу Заказчика мебель (далее - Изделие), доставить и установить её, а Заказчик обязуется принять Изделие и оплатить его на условиях настоящего Договора.
Наименование, размеры, материалы, комплектация и внешний вид Изделия определены в Спецификации (Приложение 1) и Эскизе (Приложение 2), которые являются неотъемлемой частью Договора.
Адрес доставки и установки: {адрес}.
Изделие изготавливается по индивидуальным размерам и пожеланиям Заказчика и имеет индивидуально-определённые свойства.

## Цена и порядок расчётов
Цена Договора составляет {цена} ({цена_прописью}) {валюта_цены}, {ндс}. Цена включает изготовление, материалы, фурнитуру, доставку и установку Изделия, если иное не указано в Спецификации.
Предоплата в размере {предоплата} ({предоплата_прописью}) {валюта_предоплаты}, что составляет {предоплата_проц}% цены, вносится Заказчиком при подписании Договора.
Оставшаяся сумма {остаток} ({остаток_прописью}) {валюта_остатка} оплачивается {остаток_когда}.
Оплата производится наличными, переводом через Систему быстрых платежей (СБП) или на расчётный счёт Исполнителя. Исполнитель выдаёт Заказчику кассовый чек или иной документ, подтверждающий оплату, в соответствии с законодательством.
Цена является твёрдой и может быть изменена только по письменному соглашению Сторон при изменении состава заказа.

## Сроки
Срок изготовления Изделия - {срок} {дни} с даты внесения предоплаты и согласования Заказчиком Эскиза и Спецификации.
Доставка и установка производятся в течение {срок_монтажа} рабочих дней после готовности Изделия. Дату и время Стороны согласуют дополнительно.
Сроки продлеваются на время задержки, возникшей по причинам, зависящим от Заказчика: просрочка оплаты, неготовность помещения, отсутствие доступа в помещение, изменение заказа после согласования.
Исполнитель вправе выполнить работы досрочно, согласовав дату установки с Заказчиком.

## Обязанности Сторон
Исполнитель обязуется:
- изготовить Изделие в соответствии со Спецификацией и Эскизом из согласованных материалов;
- доставить и установить Изделие в согласованный срок;
- вывезти упаковку и убрать производственный мусор после установки;
- устранить недостатки, возникшие по его вине, в срок, указанный в разделе о приёмке.
Заказчик обязуется:
- оплатить Изделие в порядке и сроки, установленные Договором;
- к дате установки подготовить помещение: завершить отделочные работы, освободить место установки, обеспечить доступ, освещение и электропитание;
- до начала установки сообщить о расположении скрытой электропроводки, труб и других коммуникаций в стенах и полу;
- принять Изделие и подписать акт приёма-передачи.

## Приёмка
Приёмка Изделия производится Заказчиком после установки и оформляется актом приёма-передачи.
Замечания по качеству, комплектности и внешнему виду указываются в акте. Исполнитель устраняет обоснованные замечания в течение {срок_устранения} рабочих дней, если иной срок не согласован Сторонами.
Право собственности на Изделие и риск его случайной гибели переходят к Заказчику с момента подписания акта приёма-передачи.

## Гарантия
Гарантийный срок на Изделие - {гарантия} со дня подписания акта приёма-передачи. На фурнитуру и механизмы действует гарантия их производителя, но не менее гарантийного срока на Изделие.
В течение гарантийного срока Исполнитель бесплатно устраняет недостатки, возникшие по его вине.
Гарантия не распространяется на недостатки, возникшие из-за нарушения правил эксплуатации, механических повреждений, воздействия воды, пара и высокой температуры, самостоятельного ремонта, переноса или переделки Изделия, а также на естественный износ.
Не являются недостатками: незначительные отличия оттенка и текстуры материалов от образцов и изображений на экране, связанные с особенностями партии материала; зазоры и подгонка, вызванные неровностями стен, пола и потолка помещения.

## Изменение заказа и отказ от договора
Изменения в Спецификацию и Эскиз вносятся по письменному согласованию Сторон до запуска Изделия в производство. Изменения после запуска в производство возможны, если они технически выполнимы, с оплатой Заказчиком дополнительных расходов и соразмерным продлением срока.
Заказчик вправе в любое время отказаться от Договора, оплатив Исполнителю фактически понесённые им расходы, связанные с исполнением Договора.

## Ответственность Сторон
За нарушение срока изготовления или установки по вине Исполнителя он уплачивает Заказчику неустойку в размере {пеня}% цены Договора за каждый день просрочки, но не более {пеня_лимит}% цены Договора (п. 5 ст. 28 Закона РФ "О защите прав потребителей").
За просрочку оплаты Заказчик уплачивает Исполнителю неустойку в размере {пеня_заказчика}% просроченной суммы за каждый день просрочки, но не более {пеня_заказчика_лимит}% этой суммы.
Стороны освобождаются от ответственности, если неисполнение обязательств вызвано обстоятельствами непреодолимой силы, которые Сторона не могла предвидеть и предотвратить. Сторона обязана сообщить о них другой Стороне в течение 3 (трёх) рабочих дней.

## Заключительные положения
Договор вступает в силу с момента подписания и действует до полного исполнения Сторонами своих обязательств.
Согласование эскизов, размеров, материалов, дат и других рабочих вопросов может вестись в мессенджерах (WhatsApp, Telegram) и по электронной почте с номеров и адресов, указанных в реквизитах Сторон. Такая переписка признаётся Сторонами надлежащим письменным согласованием.
Претензии рассматриваются в течение 10 (десяти) календарных дней. Если согласие не достигнуто, спор рассматривается судом в соответствии с законодательством Российской Федерации, в том числе по выбору Заказчика - по месту его жительства или пребывания.
Во всём, что не предусмотрено Договором, Стороны руководствуются Гражданским кодексом Российской Федерации и Законом РФ "О защите прав потребителей".
Заказчик даёт согласие на обработку своих персональных данных в объёме, необходимом для исполнения Договора, в соответствии с Федеральным законом "О персональных данных".
Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой Стороны. Приложения: 1 - Спецификация, 2 - Эскиз.`;
  KP.TEMPLATES = { KZ: KP.CONTRACT_TEMPLATE, RU: KP.CONTRACT_TEMPLATE_RU };
  // Условия по умолчанию. В России неустойка исполнителя - 3% в день (п. 5 ст. 28 Закона о защите прав потребителей),
  // меньше в договоре с потребителем поставить нельзя.
  KP.CONTRACT_DEFAULTS = { KZ: { penaltyPct: "0,1", penaltyCap: 10, clientPenaltyPct: "0,1", clientPenaltyCap: 10 }, RU: { penaltyPct: "3", penaltyCap: 100, clientPenaltyPct: "0,1", clientPenaltyCap: 10 } };
  // Шаблон договора: свой текст мастера или стандартный для страны (пустая строка = стандартный).
  const djb = t => { let h = 5381; for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h; };
  const OLD_STD = [989297516];   // стандартный текст до ноября 2026 (там слово "тенге" было вписано) - тоже считаем стандартным
  KP.isStdTemplate = t => !t || !String(t).trim() || Object.values(KP.TEMPLATES).includes(t) || OLD_STD.includes(djb(t));
  KP.templateFor = (o, co) => (o.contract && !KP.isStdTemplate(o.contract.template) ? o.contract.template : KP.TEMPLATES[KP.countryOf(co)]);

  KP.newOrder = function () {
    const rg = KP.region();
    return {
      number: "", date: KP.iso(new Date()), validDays: 14, currency: rg.currency,
      client: { name: "", phone: "", address: "", iin: "", idDoc: "" },
      items: [{ title: "", size: "", desc: "", price: 0, image: "", imageW: 0, imageH: 0 }],
      services: [],
      discountPct: 0, discountSum: 0, prepayPct: 50, prepaySum: 0,
      restWhen: "в день установки, после подписания акта приёма-передачи",
      days: 14, dayKind: "рабочих", installDays: 3, warrantyMonths: 12,
      showItemPrices: true,
      intro: KP.DEFAULT_INTRO, conditions: KP.DEFAULT_CONDITIONS,
      contract: Object.assign({ fixDays: 10, template: "" }, KP.CONTRACT_DEFAULTS[rg.country in KP.CONTRACT_DEFAULTS ? rg.country : "KZ"])
    };
  };

  // ---------- расчёт итогов ----------
  KP.totals = function (o) {
    const items = (o.items || []).reduce((s, i) => s + (+i.price || 0), 0);
    const services = (o.services || []).reduce((s, i) => s + (+i.price || 0), 0);
    const subtotal = items + services;
    const discount = Math.min(subtotal, Math.max(0, +o.discountSum || 0));
    const total = subtotal - discount;
    const prepay = Math.min(total, Math.max(0, +o.prepaySum || 0));
    return { subtotal, discount, total, prepay, rest: total - prepay };
  };
  KP.calcDiscount = (o) => { const s = KP.totals(Object.assign({}, o, { discountSum: 0 })).subtotal; return Math.round(s * (+o.discountPct || 0) / 100); };
  KP.calcPrepay = (o) => { const t = KP.totals(o).total, step = KP.curInfo(o.currency).roundTo || 1; const p = t * (+o.prepayPct || 0) / 100; return Math.min(t, Math.ceil(p / step) * step); };

  // ---------- вход: JSON заказа или текст из калькулятора ----------
  const pick = (o, ...keys) => { for (const k of keys) { const v = k.split(".").reduce((a, p) => (a == null ? a : a[p]), o); if (v !== undefined && v !== null && v !== "") return v; } return undefined; };
  const toNum = v => { if (typeof v === "number") return v; const m = String(v == null ? "" : v).replace(/[\s ]/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? +m[0] : 0; };

  KP.fromText = function (text) {
    const o = KP.newOrder();
    const lines = String(text).replace(/\r/g, "").split("\n").map(l => l.trimEnd());
    while (lines.length && !lines[0].trim()) lines.shift();
    if (!lines.length) throw new Error("Текст пустой.");
    const it = o.items[0];
    const head = lines.shift().trim();
    const m = /^(.*?),\s*([\d\s+×xх*]+(?:мм|см|м)(?![а-яё]).*)$/i.exec(head);
    if (m) { it.title = m[1].trim(); it.size = m[2].replace(/\s*[xх*]\s*/g, "×").trim(); } else it.title = head;
    const desc = []; let total = 0, disc = 0, pre = 0, found = false;
    for (const raw of lines) {
      const l = raw.trim(); let x;
      if ((x = /^Стоимость:\s*([\d\s ]+)/i.exec(l))) { total = toNum(x[1]); found = true; o.currency = /₽|руб/i.test(l) ? "RUB" : /₸|тг|тенге/i.test(l) ? "KZT" : o.currency; const d = /скидк\S*\s+(\d+(?:[.,]\d+)?)\s*%/i.exec(l); if (d) disc = toNum(d[1]); }
      else if ((x = /^Предоплата:\s*([\d\s ]+)/i.exec(l))) pre = toNum(x[1]);
      else if ((x = /^Срок изготовления:\s*(\d+)/i.exec(l))) o.days = +x[1];
      else if (/^Доставка и монтаж включены/i.test(l)) { /* это уже есть в условиях */ }
      else desc.push(l);
    }
    if (!found) throw new Error('В тексте нет строки "Стоимость: ...". Скопируйте текст кнопкой "Скопировать для клиента" в калькуляторе.');
    while (desc.length && !desc[desc.length - 1]) desc.pop();
    it.desc = desc.join("\n");
    if (disc > 0 && disc < 100) { it.price = Math.round(total / (1 - disc / 100)); o.discountPct = disc; o.discountSum = it.price - total; }
    else it.price = total;
    o.prepaySum = pre; o.prepayPct = total ? Math.round(pre / total * 100) : 0;
    o.dayKind = "календарных";
    return o;
  };

  // общий формат заказа проекта (mebel-order.js). Понимает и старые сохранённые расчёты калькулятора.
  KP.isMebelOrder = j => !!j && typeof j === "object" && (j.format === "mebel-order" || (Array.isArray(j.products) && (j.quote || j.terms || j.pricing)));
  KP.fromMebelOrder = function (src) {
    const MO = root.MebelOrder; let ord = src;
    if (MO) {
      const r = MO.parse(src); ord = Array.isArray(r) ? (r[0] && r[0].order) : r.order;
      if (!ord) throw new Error("В файле нет ни одного заказа.");
      if (!ord.quote || !Array.isArray(ord.quote.clientLines)) { try { MO.recalc(ord); } catch (e) { } }
    }
    const o = KP.newOrder(), q = ord.quote || {}, t = ord.terms || {}, c = ord.client || {};
    o.currency = MO ? MO.orderCurrency(ord) : (ord.currency || "KZT");
    o.number = String(ord.number || ord.id || "");
    if (/^\d{4}-\d{2}-\d{2}/.test(String(ord.createdAt || ""))) o.date = String(ord.createdAt).slice(0, 10);
    o.client = { name: c.name || "", phone: c.whatsapp || c.phone || "", address: c.address || "", iin: c.iin || "", idDoc: c.doc || "" };
    const lines = Array.isArray(q.clientLines) ? q.clientLines : [];
    const prods = Array.isArray(ord.products) ? ord.products : [];
    if (!prods.length) throw new Error("В заказе нет ни одного изделия.");
    o.items = prods.map((p, i) => {
      let d = [];
      try { d = MO ? MO.productSummary(ord, p) : (p.describe || []); } catch (e) { d = p.describe || []; }
      d = (d || []).slice();
      const name = p.name || "Изделие";
      if (d.length && d[0].indexOf(name) === 0 && !/^[^:]{1,32}:\s/.test(d[0])) d.shift();
      const sz = p.size || {};
      const line = lines.find(l => l.kind === "product" && l.ref === p.id) || lines.filter(l => l.kind === "product")[i];
      const im = p.image || {};
      return { title: name, size: sz.w ? [sz.w, sz.h, sz.d].filter(Boolean).join("×") + " мм" : (line && line.note ? String(line.note).replace(/x/g, "×") : ""), desc: d.join("\n"), price: line ? +line.sum || 0 : 0, image: typeof im === "string" ? im : (im.png || im.svg || ""), imageW: 0, imageH: 0 };
    });
    o.services = lines.filter(l => l.kind !== "product").map(l => ({ name: l.name + (l.qty > 1 ? ", " + l.qty + " " + (l.unit || "шт") : ""), price: +l.sum || 0 }));
    if (!KP.totals(o).subtotal && +q.total) o.items[0].price = +q.subtotal || +q.total;
    o.discountPct = +q.discountPct || 0; o.discountSum = +q.discountSum || 0;
    const sub = KP.totals(Object.assign({}, o, { discountSum: 0 })).subtotal;
    if (+q.total && sub - o.discountSum !== +q.total) o.discountSum = Math.max(0, sub - q.total);
    o.prepayPct = +q.prepayPct || 0; o.prepaySum = +q.prepaySum || KP.calcPrepay(o);
    if (t.days) o.days = +t.days;
    o.dayKind = t.daysKind === "calendar" ? "календарных" : "рабочих";
    if (t.warrantyMonths != null) o.warrantyMonths = +t.warrantyMonths;
    if (t.validDays) o.validDays = +t.validDays;
    const s = ord.seller;
    if (s && typeof s === "object") o._seller = { legal: s.name || "", bin: s.bin || "", inn: s.inn || "", kpp: s.kpp || "", ogrn: s.ogrn || "", address: s.address || "", phone: s.phone || "", iik: s.iban || "", bank: s.bank || "", bik: s.bik || "", headSign: s.director || "", logo: s.logo || "" };
    return o;
  };

  KP.fromJson = function (j) {
    const legacy = root.MebelOrder && j && typeof j === "object" && (Array.isArray(j) ? j[0] && j[0].state : (j.state || (j.mode && (j.secs || j.walls || j.u))));
    if (KP.isMebelOrder(j) || legacy) return KP.fromMebelOrder(j);
    if (Array.isArray(j)) j = { items: j };
    if (j.order && typeof j.order === "object") j = Object.assign({}, j, j.order);
    const o = KP.newOrder();
    const jc = String(pick(j, "currency") || "").toUpperCase(); if (/^[A-Z]{3}$/.test(jc)) o.currency = jc;
    o.number = String(pick(j, "number", "no", "id", "orderId") || "");
    const d = pick(j, "date", "createdAt", "created");
    if (d && /^\d{4}-\d{2}-\d{2}/.test(String(d))) o.date = String(d).slice(0, 10);
    const c = typeof j.client === "string" ? { name: j.client } : (j.client || j.customer || {});
    o.client.name = String(pick(c, "name", "fio", "fullName") || "");
    o.client.phone = String(pick(c, "phone", "tel", "whatsapp") || "");
    o.client.address = String(pick(c, "address", "addr") || pick(j, "address") || "");
    o.client.iin = String(pick(c, "iin") || "");
    o.client.idDoc = String(pick(c, "idDoc", "document", "passport") || "");
    let items = pick(j, "items", "products", "positions");
    if (!Array.isArray(items)) items = (j.title || j.name || j.desc) ? [j] : [];
    o.items = items.map(x => {
      const s = x.size || x.dims || x.dimensions || {};
      let size = typeof s === "string" ? s : "";
      if (!size) { const w = pick(s, "w", "W", "width") || pick(x, "W", "w", "width"), h = pick(s, "h", "H", "height") || pick(x, "H", "h", "height"), dd = pick(s, "d", "D", "depth") || pick(x, "D", "d", "depth"); if (w && h) size = [w, h, dd].filter(Boolean).join("×") + " мм"; }
      let desc = pick(x, "desc", "description", "text") || "";
      if (Array.isArray(desc)) desc = desc.join("\n");
      const specs = pick(x, "specs", "spec", "props");
      if (Array.isArray(specs)) desc = (desc ? desc + "\n" : "") + specs.map(p => (pick(p, "k", "key", "name", "label") || "") + ": " + (pick(p, "v", "value", "text") || "")).join("\n");
      return { title: String(pick(x, "title", "name") || "Изделие"), size, desc: String(desc), price: toNum(pick(x, "price", "total", "sum", "clientPrice")), image: String(pick(x, "image", "img", "sketch", "render", "svg", "sketchSvg") || ""), imageW: 0, imageH: 0 };
    });
    if (!o.items.length) throw new Error("В заказе не нашлось ни одного изделия (ожидается список items).");
    const sv = pick(j, "services", "extras");
    if (Array.isArray(sv)) o.services = sv.map(x => ({ name: String(pick(x, "name", "title") || ""), price: toNum(pick(x, "price", "sum", "total")) })).filter(x => x.name);
    const t = j.totals || j.total_ || j.price || {};
    const T = typeof t === "object" ? t : {};
    const terms = j.terms || j.conditions_ || {};
    const total = toNum(pick(T, "total", "client") || pick(j, "total"));
    const sub0 = KP.totals(o).subtotal;
    if (!sub0 && total) { o.items[0].price = total; }
    const sub = KP.totals(o).subtotal;
    o.discountPct = toNum(pick(T, "discountPct", "discPct") || pick(j, "discountPct", "disc"));
    o.discountSum = toNum(pick(T, "discountSum", "discount"));
    if (!o.discountSum && total && total < sub) o.discountSum = sub - total;
    if (!o.discountSum && o.discountPct) o.discountSum = KP.calcDiscount(o);
    o.prepayPct = toNum(pick(T, "prepayPct") || pick(terms, "prepayPct") || pick(j, "prepayPct", "prepay") || 50);
    o.prepaySum = toNum(pick(T, "prepaySum", "prepay") || pick(terms, "prepaySum")) || KP.calcPrepay(o);
    o.days = toNum(pick(terms, "days", "productionDays") || pick(j, "days") || 14);
    const dk = pick(terms, "dayKind"); if (dk) o.dayKind = /календ/i.test(dk) ? "календарных" : "рабочих";
    o.warrantyMonths = toNum(pick(terms, "warrantyMonths", "warranty") || 12);
    const vd = pick(terms, "validDays") || pick(j, "validDays"); if (vd) o.validDays = toNum(vd);
    return o;
  };

  KP.normalize = function (input) {
    if (typeof input === "string") {
      const s = input.trim();
      if (!s) throw new Error("Ничего не вставлено.");
      if (s[0] === "{" || s[0] === "[") { let j; try { j = JSON.parse(s); } catch (e) { throw new Error("Файл заказа повреждён: это не JSON."); } return KP.fromJson(j); }
      return KP.fromText(s);
    }
    return KP.fromJson(input);
  };

  // ---------- подстановки ----------
  const BLANK = "____________";
  KP.vars = function (o, co) {
    const t = KP.totals(o), b = v => (v && String(v).trim()) || BLANK, cur = o.currency, ct = o.contract || {};
    const cd = KP.CONTRACT_DEFAULTS[KP.countryOf(co)] || KP.CONTRACT_DEFAULTS.KZ;
    const wm = +o.warrantyMonths || 0;
    return {
      "номер": b(o.number), "дата": KP.dateLong(o.date), "город": b(co.city),
      "исполнитель": b(co.legal), "руководитель": b(co.head), "основание": b(co.basis),
      "заказчик": b(o.client.name), "адрес": b(o.client.address),
      "телефон_исполнителя": b(co.phone), "телефон_заказчика": b(o.client.phone),
      "цена": KP.num(t.total), "цена_прописью": KP.words(t.total), "ндс": b(KP.vatText(t.total, co.vat, cur)),
      "валюта_цены": KP.curWord(t.total, cur), "валюта_предоплаты": KP.curWord(t.prepay, cur), "валюта_остатка": KP.curWord(t.rest, cur),
      "предоплата": KP.num(t.prepay), "предоплата_прописью": KP.words(t.prepay),
      "предоплата_проц": t.total ? String(Math.round(t.prepay / t.total * 100)) : "0",
      "остаток": KP.num(t.rest), "остаток_прописью": KP.words(t.rest), "остаток_когда": b(o.restWhen),
      "срок": (+o.days || 0) + " (" + KP.words(+o.days || 0) + ")", "дни": KP.plural(+o.days || 0, o.dayKind === "календарных" ? "календарный день" : "рабочий день", (o.dayKind || "рабочих") + " дня", (o.dayKind || "рабочих") + " дней"),
      "срок_монтажа": String(+o.installDays || 0),
      "гарантия": wm + " (" + KP.words(wm) + ") " + KP.plural(wm, "месяц", "месяца", "месяцев"),
      "пеня": String(ct.penaltyPct), "пеня_лимит": String(ct.penaltyCap), "срок_устранения": String(ct.fixDays),
      "пеня_заказчика": String(ct.clientPenaltyPct != null ? ct.clientPenaltyPct : cd.clientPenaltyPct), "пеня_заказчика_лимит": String(ct.clientPenaltyCap != null ? ct.clientPenaltyCap : cd.clientPenaltyCap)
    };
  };
  KP.fill = (text, vars) => String(text).replace(/\{([^{}\n]+)\}/g, (m, k) => (k.trim() in vars ? vars[k.trim()] : m));

  // "Ключ: значение" и "- пункт" -> строки спецификации
  KP.parseDesc = function (desc) {
    const rows = [];
    String(desc || "").split("\n").forEach(raw => {
      const l = raw.trim(); if (!l) return;
      const last = rows[rows.length - 1];
      if (/^[-•*]\s+/.test(l)) { const txt = l.replace(/^[-•*]\s+/, ""); if (last) last.bullets.push(txt); else rows.push({ k: "", v: "", bullets: [txt] }); return; }
      const m = /^([^:]{1,32}):\s*(.*)$/.exec(l);
      if (m) rows.push({ k: m[1].trim(), v: m[2].trim(), bullets: [] });
      else rows.push({ k: "", v: l, bullets: [] });
    });
    return rows;
  };

  // ---------- общие кусочки вёрстки ----------
  const INK = "#1f2328", MUTED = "#6b7280", LINE = "#d9dee3", SOFT = "#f4f6f7";
  const tint = (hex, k) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return SOFT; const n = parseInt(m[1], 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * k)); return "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""); };
  const hLines = { hLineWidth: () => 0.6, vLineWidth: () => 0, hLineColor: () => LINE, paddingLeft: () => 0, paddingRight: () => 8, paddingTop: () => 5, paddingBottom: () => 5 };
  const noLines = { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 };

  function specTable(desc, keyW) {
    const rows = KP.parseDesc(desc);
    if (!rows.length) return null;
    const body = rows.map(r => {
      const val = [];
      if (r.v) val.push({ text: r.v });
      if (r.bullets.length) val.push({ ul: r.bullets, margin: [0, r.v ? 2 : 0, 0, 0], markerColor: MUTED });
      if (!r.k) return [{ stack: val, colSpan: 2 }, {}];
      return [{ text: r.k, color: MUTED }, { stack: val }];
    });
    return { table: { widths: [keyW || 92, "*"], body }, layout: Object.assign({}, hLines, { hLineWidth: (i) => (i === 0 ? 0 : 0.6) }) };
  }
  const imgNode = (it, maxW, maxH) => ({ image: it.image, fit: [maxW, maxH] });
  const isImg = it => /^data:image\/(png|jpe?g)/i.test(it.image || "");

  function priceRows(o, opts) {
    const t = KP.totals(o), rows = [];
    const many = o.items.length > 1 || (o.services || []).length > 0;
    if (o.showItemPrices !== false || opts.always) {
      o.items.forEach((it, i) => rows.push({ n: i + 1, name: it.title || "Изделие", sub: it.size, sum: +it.price || 0 }));
      (o.services || []).forEach(s => rows.push({ n: rows.length + 1, name: s.name, sub: "", sum: +s.price || 0, incl: !(+s.price) }));
    }
    return { rows, t, many };
  }

  // ---------- КП ----------
  KP.proposal = function (o, co) {
    co = Object.assign({}, KP.DEFAULT_COMPANY, co || {});
    const M = n => KP.money(n, o.currency), CI = KP.COUNTRY[KP.countryOf(co)];
    const A = /^#[0-9a-f]{6}$/i.test(co.accent) ? co.accent : "#2f6f5e";
    const t = KP.totals(o), W = 515;
    const content = [];
    const brand = co.brand || co.legal || "Название компании";
    const contacts = [co.phone, co.email, co.site, co.address].filter(Boolean);
    content.push({
      columns: [
        co.logo ? { image: co.logo, fit: [170, 56], width: 180 } : { text: brand, fontSize: 19, bold: true, color: A, width: "*" },
        { stack: (co.logo && co.brand ? [{ text: co.brand, bold: true, color: INK, fontSize: 10 }] : []).concat(contacts.length ? contacts.map(x => ({ text: x })) : [{ text: "Телефон и адрес компании", color: "#a3a9b1" }]), alignment: "right", fontSize: 8.5, color: MUTED, lineHeight: 1.3, width: "*" }
      ], columnGap: 16
    });
    content.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: W, y2: 0, lineWidth: 1.6, lineColor: A }], margin: [0, 10, 0, 18] });

    content.push({ text: "Коммерческое предложение", fontSize: 22, bold: true, characterSpacing: -0.3 });
    const until = KP.dateLong(KP.addDays(o.date, o.validDays));
    content.push({ text: [(o.number ? "№" + NBSP + o.number + " " : "") + "от " + KP.dateLong(o.date), { text: "   ·   действительно до " + until, color: MUTED }], fontSize: 10, margin: [0, 3, 0, 14] });

    const cl = o.client || {};
    const who = [cl.name ? { text: cl.name, bold: true, fontSize: 11 } : { text: "Имя клиента", color: "#a3a9b1", fontSize: 11 }];
    const sub = [cl.phone, cl.address].filter(Boolean).join("   ·   ");
    if (sub) who.push({ text: sub, color: MUTED, fontSize: 9, margin: [0, 2, 0, 0] });
    content.push({
      table: { widths: ["*", "auto"], body: [[
        { stack: [{ text: "ДЛЯ КОГО", fontSize: 7.5, color: A, bold: true, characterSpacing: 0.6, margin: [0, 0, 0, 3] }].concat(who), border: [false, false, false, false] },
        { stack: [{ text: "СТОИМОСТЬ", fontSize: 7.5, color: A, bold: true, characterSpacing: 0.6, margin: [0, 0, 0, 2], alignment: "right" }, { text: M(t.total), fontSize: 17, bold: true, alignment: "right" }], border: [false, false, false, false] }
      ]] },
      layout: { fillColor: () => tint(A, 0.9), paddingLeft: () => 14, paddingRight: () => 14, paddingTop: () => 11, paddingBottom: () => 11, hLineWidth: () => 0, vLineWidth: () => 0 },
      margin: [0, 0, 0, 12]
    });
    if (o.intro && o.intro.trim()) content.push({ text: o.intro.trim(), margin: [0, 0, 0, 6], color: "#3b424a" });

    o.items.forEach((it, i) => {
      const head = { text: [(o.items.length > 1 ? (i + 1) + ". " : "") + (it.title || "Изделие"), it.size ? { text: "   " + it.size, color: MUTED, bold: false, fontSize: 10.5 } : ""], fontSize: 14, bold: true, margin: [0, 14, 0, 8], headlineLevel: 1 };
      const has = isImg(it), wide = has && it.imageW && it.imageH ? it.imageW / it.imageH > 1.15 : false;
      const spec = specTable(it.desc, 92);
      if (has && wide) {
        content.push({ stack: [head, { table: { widths: ["*"], body: [[{ stack: [Object.assign(imgNode(it, W - 24, 240), { alignment: "center" })], border: [true, true, true, true] }]] }, layout: { hLineColor: () => LINE, vLineColor: () => LINE, hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10 } }], unbreakable: true });
        if (spec) content.push(Object.assign(spec, { margin: [0, 8, 0, 0] }));
      } else if (has) {
        content.push({ stack: [head, { columns: [
          { width: 215, table: { widths: ["*"], body: [[Object.assign(imgNode(it, 195, 260), { alignment: "center" })]] }, layout: { hLineColor: () => LINE, vLineColor: () => LINE, hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 10, paddingBottom: () => 10 } },
          spec ? Object.assign(spec, { width: "*" }) : { text: "", width: "*" }
        ], columnGap: 16 }], unbreakable: KP.parseDesc(it.desc).length < 14 });
      } else {
        content.push(head);
        if (spec) content.push(spec);
      }
    });

    // цена
    const pr = priceRows(o, {});
    const body = [];
    const showRows = pr.rows.length && (pr.many || t.discount > 0);
    if (showRows) {
      pr.rows.forEach(r => body.push([{ text: [r.name, r.sub ? { text: "  " + r.sub, color: MUTED, fontSize: 9 } : ""] }, { text: r.incl ? "включено" : M(r.sum), alignment: "right", color: r.incl ? MUTED : INK, noWrap: true }]));
      if (t.discount > 0) body.push([{ text: "Скидка" + (o.discountPct ? " " + String(o.discountPct).replace(".", ",") + "%" : ""), color: A }, { text: "-" + NBSP + M(t.discount), alignment: "right", color: A, noWrap: true }]);
    }
    const priceBlock = [{ text: "Стоимость и оплата", fontSize: 14, bold: true, margin: [0, 18, 0, 8] }];
    if (body.length) priceBlock.push({ table: { widths: ["*", "auto"], body }, layout: Object.assign({}, hLines, { hLineWidth: (i) => (i === 0 ? 0 : 0.6), paddingRight: () => 0 }) });
    priceBlock.push({
      table: { widths: ["*", "auto"], body: [[{ text: "Итого к оплате", bold: true, fontSize: 11.5, color: "#ffffff", margin: [0, 3, 0, 0] }, { text: M(t.total), bold: true, fontSize: 15, color: "#ffffff", alignment: "right", noWrap: true }]] },
      layout: { fillColor: () => A, hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 14, paddingRight: () => 14, paddingTop: () => 8, paddingBottom: () => 8 }, margin: [0, body.length ? 6 : 0, 0, 10]
    });
    const pct = t.total ? Math.round(t.prepay / t.total * 100) : 0;
    const tile = (label, big, small) => ({ stack: [{ text: label.toUpperCase(), fontSize: 7.5, color: MUTED, bold: true, characterSpacing: 0.5 }, { text: big, fontSize: 12.5, bold: true, margin: [0, 3, 0, 1] }, { text: small, fontSize: 8.5, color: MUTED }] });
    const wm = +o.warrantyMonths || 0;
    const tiles = [];
    if (t.prepay > 0 && t.rest > 0) { tiles.push(tile("Предоплата " + pct + "%", M(t.prepay), "при заключении договора")); tiles.push(tile("Остаток", M(t.rest), "после установки")); }
    else tiles.push(tile("Оплата", M(t.total), t.prepay > 0 ? "при заключении договора" : "после установки"));
    tiles.push(tile("Срок изготовления", (+o.days || 0) + NBSP + KP.plural(+o.days || 0, "день", "дня", "дней"), (o.dayKind === "календарных" ? "календарных" : "рабочих") + ", с даты предоплаты"));
    if (wm) tiles.push(tile("Гарантия", wm + NBSP + KP.plural(wm, "месяц", "месяца", "месяцев"), "на мебель и монтаж"));
    priceBlock.push({ table: { widths: tiles.map(() => "*"), body: [tiles] }, layout: { hLineWidth: () => 0, vLineWidth: (i) => (i > 0 && i < tiles.length ? 0.6 : 0), vLineColor: () => LINE, paddingLeft: (i) => (i === 0 ? 0 : 12), paddingRight: () => 8, paddingTop: () => 2, paddingBottom: () => 2 } });
    content.push({ stack: priceBlock, unbreakable: true });

    const conds = String(o.conditions || "").split("\n").map(s => s.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
    if (conds.length) content.push({ stack: [{ text: "Условия", fontSize: 14, bold: true, margin: [0, 18, 0, 6] }, { ul: conds, markerColor: A, color: "#3b424a", lineHeight: 1.35 }], unbreakable: conds.length < 9 });

    const sign = [co.manager, co.phone].filter(Boolean).join(", ");
    content.push({ stack: [{ text: "Готовы ответить на вопросы и внести изменения в проект.", margin: [0, 18, 0, 2] }, { text: sign ? "С уважением, " + sign : "С уважением, " + brand, bold: true }], unbreakable: true });

    const taxNo = KP.countryOf(co) === "RU" ? co.inn : co.bin;
    const foot = [co.legal, taxNo ? CI.taxId + " " + taxNo : ""].filter(Boolean).join("   ·   ");
    return {
      pageSize: "A4", pageMargins: [40, 38, 40, 48],
      info: { title: "Коммерческое предложение" + (o.number ? " № " + o.number : ""), author: brand },
      defaultStyle: { font: "Inter", fontSize: 10, lineHeight: 1.25, color: INK },
      footer: (p, n) => ({ columns: [{ text: foot, color: "#9aa1a9" }, { text: "Стр. " + p + " из " + n, alignment: "right", color: "#9aa1a9" }], fontSize: 8, margin: [40, 18, 40, 0] }),
      pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0,
      content
    };
  };

  // ---------- договор ----------
  KP.parseTemplate = function (text) {
    const blocks = []; let sec = 0, cl = 0, lastClause = null;
    String(text || "").split("\n").forEach(raw => {
      const l = raw.trim(); if (!l) return;
      if (/^##\s*/.test(l)) { sec++; cl = 0; lastClause = null; blocks.push({ type: "h", n: sec, text: l.replace(/^##\s*/, "") }); return; }
      if (/^[-•*]\s+/.test(l)) { const txt = l.replace(/^[-•*]\s+/, ""); if (lastClause) lastClause.bullets.push(txt); else blocks.push(lastClause = { type: "p", n: "", text: "", bullets: [txt] }); return; }
      if (!sec) { blocks.push({ type: "pre", text: l }); return; }
      cl++; blocks.push(lastClause = { type: "p", n: sec + "." + cl + ".", text: l, bullets: [] });
    });
    return blocks;
  };

  KP.contract = function (o, co) {
    co = Object.assign({}, KP.DEFAULT_COMPANY, co || {});
    const v = KP.vars(o, co), t = KP.totals(o), W = 491, ru = KP.countryOf(co) === "RU", CI = KP.COUNTRY[ru ? "RU" : "KZ"];
    const b = x => (x && String(x).trim()) || BLANK;
    const content = [];
    const title = "ДОГОВОР № " + v["номер"];
    content.push({ text: title, alignment: "center", bold: true, fontSize: 13 });
    content.push({ text: "на изготовление мебели по индивидуальному заказу", alignment: "center", fontSize: 10.5, margin: [0, 2, 0, 12] });
    content.push({ columns: [{ text: "г. " + v["город"] }, { text: v["дата"], alignment: "right" }], margin: [0, 0, 0, 10] });

    const blocks = KP.parseTemplate(KP.templateFor(o, co));
    let secN = 0;
    blocks.forEach(bl => {
      if (bl.type === "pre") content.push({ text: KP.fill(bl.text, v), alignment: "justify", margin: [0, 0, 0, 4] });
      else if (bl.type === "h") { secN = bl.n; content.push({ text: bl.n + ". " + KP.fill(bl.text, v).toUpperCase(), bold: true, alignment: "center", margin: [0, 10, 0, 5], headlineLevel: 1 }); }
      else {
        const st = [];
        if (bl.text) st.push({ columns: [{ text: bl.n, width: 26 }, { text: KP.fill(bl.text, v), alignment: "justify", width: "*" }], columnGap: 4 });
        if (bl.bullets.length) st.push({ ul: bl.bullets.map(x => KP.fill(x, v)), margin: [30, 1, 0, 0], alignment: "justify" });
        content.push({ stack: st, margin: [0, 0, 0, 3] });
      }
    });

    // реквизиты
    const kv = (k, val) => ({ text: [{ text: k + ": ", color: MUTED }, b(val)], margin: [0, 0, 0, 2] });
    const cl = o.client || {};
    const left = [{ text: "Исполнитель", bold: true, margin: [0, 0, 0, 4] }, { text: b(co.legal), bold: true, margin: [0, 0, 0, 3] }].concat(ru
      ? [kv("ИНН", co.inn)].concat(co.kpp ? [kv("КПП", co.kpp)] : []).concat([kv(/^(ООО|АО|ПАО)/i.test(String(co.legal).trim()) ? "ОГРН" : "ОГРНИП", co.ogrn), kv("Адрес", co.address), kv("Банк", co.bank), kv("Р/с", co.rs), kv("К/с", co.ks), kv("БИК", co.bik), kv("Телефон", co.phone)])
      : [kv("БИН/ИИН", co.bin), kv("Адрес", co.address), kv("Банк", co.bank), kv("ИИК", co.iik), kv("БИК", co.bik), kv("Кбе", co.kbe), kv("Телефон", co.phone)]);
    if (co.email) left.push(kv("E-mail", co.email));
    const right = [{ text: "Заказчик", bold: true, margin: [0, 0, 0, 4] }, { text: b(cl.name), bold: true, margin: [0, 0, 0, 3] }].concat(ru ? [] : [kv("ИИН", cl.iin)]).concat([kv(CI.clientDoc, cl.idDoc), kv("Адрес", cl.address), kv("Телефон", cl.phone)]);
    const signRow = (lname, rname) => ({ columns: [{ text: "_______________ / " + (lname || "_______________") + " /", width: "*" }, { text: "_______________ / " + (rname || "_______________") + " /", width: "*" }], columnGap: 20, margin: [0, 16, 0, 0] });
    const short = n => { const p = String(n || "").trim().split(/\s+/); return p.length >= 2 && !/["«]/.test(n) ? p[0] + " " + p.slice(1).map(x => x[0] + ".").join("") : ""; };
    const mp = { columns: [{ text: "М.П.", color: MUTED, fontSize: 8, width: "*" }, { text: "", width: "*" }], margin: [0, 3, 0, 0] };
    content.push({ stack: [
      { text: (secN + 1) + ". РЕКВИЗИТЫ И ПОДПИСИ СТОРОН", bold: true, alignment: "center", margin: [0, 12, 0, 8] },
      { columns: [{ stack: left, width: "*" }, { stack: right, width: "*" }], columnGap: 20, fontSize: 9.5 },
      signRow(co.headSign, short(cl.name)), mp
    ], unbreakable: true });

    // приложение 1
    const apHead = (n, name) => [
      { text: "Приложение " + n, alignment: "right", fontSize: 9, color: MUTED, pageBreak: "before" },
      { text: "к договору № " + v["номер"] + " от " + v["дата"], alignment: "right", fontSize: 9, color: MUTED, margin: [0, 0, 0, 12] },
      { text: name, alignment: "center", bold: true, fontSize: 13, margin: [0, 0, 0, 10] }
    ];
    content.push(...apHead(1, "СПЕЦИФИКАЦИЯ"));
    const th = s => ({ text: s, bold: true, fontSize: 9, color: MUTED });
    const body = [[th("№"), th("Наименование и описание"), Object.assign(th("Цена, " + KP.curInfo(o.currency).sign), { alignment: "right" })]];
    o.items.forEach((it, i) => {
      const st = [{ text: [{ text: it.title || "Изделие", bold: true }, it.size ? { text: "   " + it.size, color: MUTED } : ""] }];
      const sp = specTable(it.desc, 88); if (sp) st.push(Object.assign(sp, { margin: [0, 4, 0, 0], fontSize: 9.5 }));
      body.push([{ text: String(i + 1) }, { stack: st }, { text: KP.num(it.price), alignment: "right", noWrap: true }]);
    });
    (o.services || []).forEach((s, i) => body.push([{ text: String(o.items.length + i + 1) }, { text: s.name }, { text: +s.price ? KP.num(s.price) : "включено", alignment: "right", noWrap: true }]));
    if (t.discount > 0) body.push([{ text: "" }, { text: "Скидка" + (o.discountPct ? " " + String(o.discountPct).replace(".", ",") + "%" : "") }, { text: "-" + NBSP + KP.num(t.discount), alignment: "right", noWrap: true }]);
    body.push([{ text: "" }, { text: "Итого", bold: true }, { text: KP.num(t.total), bold: true, alignment: "right", noWrap: true }]);
    content.push({ table: { headerRows: 1, widths: [18, "*", 70], body }, layout: { hLineWidth: () => 0.6, vLineWidth: () => 0, hLineColor: () => LINE, paddingLeft: () => 0, paddingRight: () => 6, paddingTop: () => 6, paddingBottom: () => 6 } });
    content.push({ text: "Итого: " + KP.num(t.total) + " (" + KP.words(t.total) + ") " + v["валюта_цены"] + ", " + v["ндс"] + ".", margin: [0, 10, 0, 0] });
    content.push({ text: "Заказчик подтверждает, что размеры, материалы, цвета и комплектация Изделия с ним согласованы.", margin: [0, 6, 0, 0] });
    content.push({ stack: [{ columns: [{ text: "Исполнитель", bold: true }, { text: "Заказчик", bold: true }], columnGap: 20, margin: [0, 18, 0, 0] }, signRow(co.headSign, short(cl.name))], unbreakable: true });

    // приложение 2
    content.push(...apHead(2, "ЭСКИЗ"));
    const imgs = o.items.filter(isImg);
    if (imgs.length) {
      const maxH = imgs.length === 1 ? 470 : imgs.length === 2 ? 270 : 200;
      imgs.forEach(it => content.push({ stack: [{ text: [{ text: it.title || "Изделие", bold: true }, it.size ? { text: "   " + it.size, color: MUTED } : ""], margin: [0, 0, 0, 6] }, Object.assign(imgNode(it, W, maxH), { alignment: "center", margin: [0, 0, 0, 14] })], unbreakable: true }));
    } else {
      content.push({ table: { widths: ["*"], heights: [380], body: [[{ text: "Место для эскиза.\nЭскиз прикладывается к договору и подписывается Сторонами.", alignment: "center", color: MUTED, margin: [0, 170, 0, 0] }]] }, layout: { hLineColor: () => LINE, vLineColor: () => LINE, hLineWidth: () => 0.8, vLineWidth: () => 0.8 } });
    }
    content.push({ text: "Эскиз показывает внешний вид, размеры и расположение элементов Изделия. Цвета на изображении могут отличаться от цвета материалов.", color: MUTED, fontSize: 9, margin: [0, 6, 0, 0] });
    content.push({ stack: [{ text: "Эскиз согласован:", margin: [0, 14, 0, 0] }, { columns: [{ text: "Исполнитель", bold: true }, { text: "Заказчик", bold: true }], columnGap: 20, margin: [0, 8, 0, 0] }, signRow(co.headSign, short(cl.name))], unbreakable: true });

    return {
      pageSize: "A4", pageMargins: [56, 44, 48, 58],
      info: { title: "Договор № " + (o.number || ""), author: co.legal || co.brand || "" },
      defaultStyle: { font: "Inter", fontSize: 10, lineHeight: 1.22, color: "#16181b" },
      footer: (p, n) => ({ stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: W, y2: 0, lineWidth: 0.5, lineColor: LINE }] },
        { columns: [{ text: "Исполнитель ___________      Заказчик ___________", width: "*" }, { text: "Договор № " + v["номер"] + "   ·   стр. " + p + " из " + n, alignment: "right", width: "auto" }], margin: [0, 6, 0, 0] }
      ], fontSize: 8, color: "#7b838c", margin: [56, 14, 48, 0] }),
      pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0,
      content
    };
  };

  // что не заполнено (для подсказки в интерфейсе)
  KP.missing = function (o, co, kind) {
    const m = [];
    const need = (ok, label) => { if (!ok || !String(ok).trim()) m.push(label); };
    need(o.client.name, "имя клиента");
    if (!KP.totals(o).total) m.push("цена");
    if (kind === "contract") {
      const ru = KP.countryOf(co) === "RU";
      need(o.number, "номер договора"); need(o.client.address, "адрес установки");
      if (ru) need(o.client.idDoc, "паспорт клиента"); else need(o.client.iin, "ИИН клиента");
      need(co.legal, "название исполнителя"); need(co.head, "руководитель"); need(co.basis, "основание"); need(co.city, "город");
      if (ru) { need(co.inn, "ИНН"); need(co.ogrn, "ОГРН/ОГРНИП"); need(co.rs, "расчётный счёт"); need(co.ks, "корр. счёт"); }
      else { need(co.bin, "БИН/ИИН"); need(co.iik, "ИИК"); }
      need(co.address, "адрес компании"); need(co.bank, "банк"); need(co.bik, "БИК"); need(co.phone, "телефон компании");
    } else {
      need(co.brand || co.legal, "название компании"); need(co.phone, "телефон компании");
    }
    return m;
  };

  root.KP = KP;
})(typeof window !== "undefined" ? window : globalThis);
