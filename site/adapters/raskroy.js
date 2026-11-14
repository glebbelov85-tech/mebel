// Карта раскроя: принимает заказ (список на распил через MebelOrder.cutList); дальше передаёт пришедший заказ.
MebelSite.register({
  get: null, fallback: true,
  put: function (o) { applyImport(JSON.stringify(o)); return false; }, // сообщение покажет сам раскрой
  empty: "Сюда заказ пока не передавали. Откройте его в калькуляторе и нажмите \"Передать заказ\""
});
