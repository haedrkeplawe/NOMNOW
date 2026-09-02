const jwt = require("jsonwebtoken");
const RestaurantUser = require("../../models/restaurantUser");

module.exports = async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) return next(new Error("Unauthorized"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await RestaurantUser.findById(decoded.id).select(
      "restaurantId",
    );

    if (!user) return next(new Error("Unauthorized"));

    socket.userId = user.restaurantId.toString();
    socket.staffId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
};
