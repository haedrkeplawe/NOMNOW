const jwt = require("jsonwebtoken");
const Driver = require("../models/Driver");

exports.auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // لازم يكون بالشكل: Bearer TOKEN
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await Driver.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    if (user.status === "blocked")
      return res.status(403).json({ message: "Your account has been blocked" });

    if (user.status === "rejected")
      return res
        .status(403)
        .json({ message: "Your account has been rejected" });

    if (user.status === "pending")
      return res.status(403).json({
        message: "Your account is under review. Please wait for approval.",
      });

    req.user = user; // ⭐️ المهم
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// middleware خاص بـ update-info فقط
// يسمح لـ pending و approved — يمنع blocked و rejected
// السائق يحتاج رفع وثائقه حتى وهو pending ليخرج من هذه الحالة
exports.authAllowPending = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await Driver.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.status === "blocked")
      return res.status(403).json({ message: "Your account has been blocked" });

    if (user.status === "rejected")
      return res
        .status(403)
        .json({ message: "Your account has been rejected" });

    // pending مسموح — السائق يحتاج رفع وثائقه
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
