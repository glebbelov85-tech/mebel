// Конфигуратор (вклеивается внутрь его модуля, поэтому видит S, cur, adopt, render...).
if (window.MebelSite) MebelSite.register({
  mount: "header",
  get: function () { return cur && cur.order ? cur.order : (S.type === "ext" ? S.ext : null); },
  put: function (o) {
    if (!o.products || !o.products.length || !MO.listParts(o).some(function (e) { return typeof e.part.x === "number"; }))
      throw new Error("В этом заказе нет деталей с координатами - показать его в 3D не получится");
    closeSheet(); adopt(o); render(); rebuild(true);
  },
  empty: "Проект ещё собирается, попробуйте через секунду",
  extra: [{
    label: "Скопировать ссылку для клиента (с этим проектом)",
    run: async function () {
      // чужой заказ отдаём клиенту без себестоимости и закупочных цен
      const code = S.type === "ext" ? await MO.encode(MO.forClient(S.ext)) : await projectCode(false);
      copyText(location.origin + location.pathname + "#cfg=" + code, "Ссылка скопирована - отправьте её клиенту в WhatsApp");
    }
  }, {
    label: "Скопировать ссылку на чистый конфигуратор",
    run: function () { copyText(location.origin + location.pathname, "Ссылка скопирована"); }
  }]
});
