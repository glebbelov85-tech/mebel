// КП и договор: принимает заказ; дальше передаёт тот заказ, что пришёл в него.
MebelSite.register({
  get: null, fallback: true,
  put: function (o) {
    return doImport(JSON.stringify(o)).then(function () {
      // у заказа из калькулятора номера ещё нет - не показываем клиенту служебный id, берём следующий номер КП
      if (order && (!o.number || order.number === o.id)) { order.number = nextNumber(); fillForm(); changed(); }
      return false;
    });
  },
  empty: "Сюда заказ пока не передавали. Откройте его в калькуляторе и нажмите \"Передать заказ\""
});
