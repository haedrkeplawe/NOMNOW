const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driver.controller");
const upload = require("../middleware/upload");
const {
  auth,
  authAllowPending,
} = require("../middleware/driverauth.middleware");

// AUTH
router.post(
  "/register",
  upload.fields([
    { name: "driverImage", maxCount: 1 },
    { name: "idImage", maxCount: 1 },
    { name: "drivingLicenseImage", maxCount: 1 },
    { name: "vehicleRegistrationImage", maxCount: 1 },
  ]),
  driverController.register,
);
router.post("/loginwithphone", driverController.loginWithPhone);
router.post("/verifyphone", driverController.verifyPhone);
router.post("/forgot-password", driverController.forgotPassword);
router.post("/reset-password/:token", driverController.resetPassword);

router.get("/dirver-info", auth, driverController.getDriverInfo);
router.patch(
  "/update-info",
  authAllowPending,
  upload.fields([
    { name: "driverImage", maxCount: 1 },
    { name: "idImage", maxCount: 1 },
    { name: "drivingLicenseImage", maxCount: 1 },
    { name: "vehicleRegistrationImage", maxCount: 1 },
  ]),
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
