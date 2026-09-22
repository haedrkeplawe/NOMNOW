const jwt = require("jsonwebtoken");
const RestaurantUser = require("../models/restaurantUser");
const Restaurant = require("../models/restaurant");

exports.authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ message: "Not authenticated" });

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await RestaurantUser.findById(decoded.id).select(
      "-password -refreshToken -emailOtp -emailOtpExpire -phoneOtp -phoneOtpExpire -passwordResetOtp -passwordResetOtpExpire -previousRefreshToken -previousRefreshTokenExpiresAt",
    );

    if (!user)
      return res.status(401).json({ message: "User no longer exists" });

    // v4.8 — قطع فوري لأي توكن صادر مسبقاً (صلاحيته لحد 15 دقيقة) لمطعم
    // صار محظور من الأدمن، بدل ما نستنى انتهاءه طبيعياً أو محاولة refresh
    if (user.restaurantId) {
      const restaurant = await Restaurant.findById(user.restaurantId).select(
        "status",
      );
      if (restaurant?.status === "blocked") {
        return res
          .status(403)
          .json({ message: "Your account has been blocked" });
      }
    }

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
