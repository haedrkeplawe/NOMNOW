const jwt = require("jsonwebtoken");
const RestaurantUser = require("../models/restaurantUser");

exports.authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ message: "Not authenticated" });

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await RestaurantUser.findById(decoded.id).select(
      "-password -refreshToken -emailOtp -emailOtpExpire -phoneOtp -phoneOtpExpire"
    );

    if (!user)
      return res.status(401).json({ message: "User no longer exists" });

    req.user = user; // ⭐ مهم جداً
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

exports.allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: "Access denied" });

    next();
  };
};
