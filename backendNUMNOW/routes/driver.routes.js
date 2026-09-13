const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driver.controller");
const upload = require("../middleware/upload");
const {
  auth,
  authAllowPending,
} = require("../middleware/driverauth.middleware");

// حقول رفع الصور — نفس المجموعة مستخدمة بـ/register و/update-info
const driverDocFields = upload.fields([
  { name: "driverImage", maxCount: 1 },
  { name: "idImage", maxCount: 1 },
  { name: "drivingLicenseImage", maxCount: 1 },
  { name: "vehicleRegistrationImage", maxCount: 1 },
]);

// AUTH
// v2.0 — B3: upload.safe يحوّل أخطاء multer (حجم/نوع الملف) إلى ردود
// مترجمة 400/413 بدل ما تصل كـ500 عام
router.post(
  "/register",
  upload.safe(driverDocFields),
  driverController.register,
);
router.post("/loginwithphone", driverController.loginWithPhone);
router.post("/verifyphone", driverController.verifyPhone);
router.post("/forgot-password", driverController.forgotPassword);
router.post("/reset-password/:token", driverController.resetPassword);

// v2.0 — B2: authAllowPending بدل auth — السائق pending هو بالذات
// المحتاج يشوف حالة وثائقه وسبب الرفض، وما كان قادر يوصلها أبداً
router.get("/dirver-info", authAllowPending, driverController.getDriverInfo);
router.patch(
  "/update-info",
  authAllowPending,
  upload.safe(driverDocFields),
  driverController.updateDriverInfo,
);
router.patch("/change-password", auth, driverController.changePassword);
router.post("/logout", auth, driverController.logout);

// restaurant
router.get("/restaurants", auth, driverController.findRestaurants);

// Driver orders
router.get("/active-order", auth, driverController.getActiveOrder);

// money
router.get("/wallet", auth, driverController.getWallet);
router.get("/cash-orders", auth, driverController.getDriverCashOrders);
router.get(
  "/financial-transactions",
  auth,
  driverController.getFinancialTransactions,
);

// GET /driver/orders-history?status=all|completed|cancelled&date=YYYY-MM-DD
// status=all|completed|cancelled&date=YYYY-MM-DD الفلتر حسب الحالة والتاريخ
router.get("/orders-history", auth, driverController.getOrdersHistory);
router.get("/orders/:orderId", auth, driverController.getOrderDetails);

// new DE
// FCM Token update - to send push notifications to the driver about new orders and updates on their current order
router.patch("/fcm-token", auth, driverController.updateFcmToken);

module.exports = router;
