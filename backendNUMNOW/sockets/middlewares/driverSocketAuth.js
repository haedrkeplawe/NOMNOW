const jwt = require("jsonwebtoken");
const Driver = require("../../models/Driver");

module.exports = async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ تحقق إنه فعلاً سائق
    const driver = await Driver.findById(decoded.id).select("_id availability");
    if (!driver) return next(new Error("Unauthorized - Not a driver"));

    socket.userId = driver._id.toString();
    socket.availability = driver.availability;
    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
};
