// v4.1 — استعادة أي بحث عن سائق كان شغال وقت ما السيرفر عمل ريستارت
const { startSearchRecoverySweep } = require("./services/order.service");

module.exports = ({ io, driverNS, restaurantNS, userNS }) => {
  require("./user.socket")(io, userNS);
  require("./restaurant.socket")(io, restaurantNS);
  require("./driver.socket")(io, driverNS);

  startSearchRecoverySweep(io);
};
