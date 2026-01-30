const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const upload = require("../middleware/upload");

router
  .route("/restaurant")
  .get(adminController.getAllRestaurants)
  .post(adminController.createRestaurant);

router.patch("/restaurant-block", adminController.blockRestaurant);
router.patch("/restaurant-unblock", adminController.unblockRestaurant);

router.patch("/user-block", adminController.blockCustomer);
router.patch("/user-unblock", adminController.unblockCustomer);

router.get(
  "/getfoodfromrestaurant/:id",
  adminController.getAllFoodInRestaurant,
);

router
  .route("/ads")
  .get(adminController.getAds)
  .post(upload.single("image"), adminController.createAd)
  .put(upload.single("image"), adminController.updateAd)
  .delete(adminController.deleteAd);

router.route("/customer").get(adminController.getAllCustomer);

router
  .route("/drivers")
  .post(
    upload.fields([
      { name: "driverImage", maxCount: 1 },
      { name: "idImage", maxCount: 1 },
      { name: "drivingLicenseImage", maxCount: 1 },
      { name: "vehicleRegistrationImage", maxCount: 1 },
    ]),
    adminController.createDriver,
  )
  .get(adminController.getAllDrivers);

router.patch("/drivers-verified", adminController.approveDriver);
router.patch("/drivers-suspend", adminController.blockedDriver);

module.exports = router;
