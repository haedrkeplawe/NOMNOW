module.exports = ({ io, driverNS, restaurantNS, userNS }) => {
  require("./user.socket")(io, userNS);
  require("./restaurant.socket")(io, restaurantNS);
  require("./driver.socket")(io, driverNS);
};
