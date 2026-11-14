// Учёт заказов: передаёт открытый заказ; принятый добавляет (или обновляет, если такой уже есть) и открывает.
MebelSite.register({
  get: function () { return (openId && ORD[openId]) ? toShared(ORD[openId]) : null; },
  put: function (o) {
    importJson(JSON.stringify(o));
    if (o.id && ORD[o.id]) { setTab("orders"); openOrder(o.id); }
    return false; // importJson сам пишет, сколько добавлено
  },
  empty: "Откройте заказ, который нужно передать"
});
