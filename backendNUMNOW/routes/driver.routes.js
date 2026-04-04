const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driver.controller");
const upload = require("../middleware/upload");
const { auth } = require("../middleware/driverauth.middleware");

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
  auth,
  upload.fields([
    { name: "driverImage", maxCount: 1 },
    { name: "idImage", maxCount: 1 },
    { name: "drivingLicenseImage", maxCount: 1 },
    { name: "vehicleRegistrationImage", maxCount: 1 },
  ]),
  driverController.updateDriverInfo,
);

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

// new
// GET /driver/orders-history?status=all|completed|cancelled&date=YYYY-MM-DD
// status=all|completed|cancelled&date=YYYY-MM-DD الفلتر حسب الحالة والتاريخ
router.get("/orders-history", auth, driverController.getOrdersHistory);
router.get("/orders/:orderId", auth, driverController.getOrderDetails);

module.exports = router;
