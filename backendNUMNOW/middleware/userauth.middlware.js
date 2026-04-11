const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // لازم يكون بالشكل: Bearer TOKEN
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // new
    // تعليمات فريق الموبايل:
    // عند استقبال 403 من أي endpoint — يعرضون رسالة "Your account has been blocked. Please contact support." ويسجلون خروج المستخدم تلقائياً.
    if (user.status === "blocked") {
      return res
        .status(403)
        .json({
          message: "Your account has been blocked. Please contact support.",
        });
    }

    req.user = user; // ⭐️ المهم
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
