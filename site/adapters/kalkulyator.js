// Калькулятор: отдаёт текущий расчёт в общем формате (toOrder), принимает заказ (importOrder).
MebelSite.register({
  get: function () { return (typeof CUR !== "undefined" && CUR) ? toOrder() : null; },
  put: function (o) { importOrder(o); return false; }, // калькулятор сам пишет "Заказ открыт"
  empty: "Сначала посчитайте изделие",
  voicePanel: true   // у калькулятора свой голосовой помощник, он сам вызывает MebelSite.voiceNav
});
