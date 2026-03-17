const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driver.controller");
const upload = require("../middleware/upload");
const { auth } = require("../middleware/driverauth.middleware");

//  مسار تسجيل السائق مع رفع الصور المطلوبة
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

// تم اصلاح العطل
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

module.exports = router;
