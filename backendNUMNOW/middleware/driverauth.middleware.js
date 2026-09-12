const jwt = require("jsonwebtoken");
const Driver = require("../models/Driver");
const { getMessages } = require("../utils/messages");

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

    // v2.0 — B8: السبب و code ثابت جوا جسم الـ403 نفسه — السائق
    // المحظور/المرفوض/قيد المراجعة ممنوع أصلاً يعدي هالحاجز، فلازم
    // كل معلومة يحتاجها تكون هون مباشرة مش بمكان بعده ما رح يوصله
    const m = getMessages(req).driver;

    if (user.status === "blocked")
      return res.status(403).json({
        code: "ACCOUNT_BLOCKED",
        message: m.auth.accountBlocked,
        reasonForSuspension: user.reasonForSuspension || null,
      });

    if (user.status === "rejected")
      return res.status(403).json({
        code: "ACCOUNT_REJECTED",
        message: m.auth.accountRejected,
      });

    if (user.status === "pending")
      return res.status(403).json({
        code: "ACCOUNT_PENDING",
        message: m.auth.accountPending,
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

    // v2.0 — B8: نفس معالجة auth() فوق للحالتين الممنوعتين هون
    const m = getMessages(req).driver;

    if (user.status === "blocked")
      return res.status(403).json({
        code: "ACCOUNT_BLOCKED",
        message: m.auth.accountBlocked,
        reasonForSuspension: user.reasonForSuspension || null,
      });

    if (user.status === "rejected")
      return res.status(403).json({
        code: "ACCOUNT_REJECTED",
        message: m.auth.accountRejected,
      });

    // pending مسموح — السائق يحتاج رفع وثائقه
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
