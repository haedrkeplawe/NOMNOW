const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const upload = require("../middleware/upload");

// dashboard
router.get("/dashboard", adminController.getAdminDashboard);

// restaurant
router
  .route("/restaurant")
  .get(adminController.getAllRestaurants)
  .post(adminController.createRestaurant)
  .patch(adminController.updateResturant);
router.get("/restaurant/:id/stats", adminController.getRestaurantStats);
router.patch("/restaurant-block", adminController.blockRestaurant);
router.patch("/restaurant-unblock", adminController.unblockRestaurant);
router.get(
  "/restaurant/:id/financial-summary",
  adminController.getRestaurantFinancialSummary,
);

// drivers
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
router.get("/drivers/:id/stats", adminController.getDriverStats);
router.patch(
  "/drivers/:driverId/documents/:documentId",
  adminController.updateDriverDocumentStatus,
);
router.patch("/drivers-verified", adminController.approveDriver);
router.patch("/drivers-suspend", adminController.blockedDriver);
// cash system (Syrian drivers only)
router.patch("/drivers/:id/cash-limit", adminController.updateDriverCashLimit);
router.patch("/drivers/:id/cash-settle", adminController.settlDriverCash);
router.get("/drivers/:id/cash-orders", adminController.getDriverCashOrders);
// DE earnings system (German drivers only)
router.patch(
  "/drivers/:id/earnings-settle",
  adminController.settleDriverEarnings,
);

// orders
router.get("/orders", adminController.getAdminOrders);
router.get("/orders/map", adminController.getOrdersMapData);
router.get("/orders/:id/details", adminController.getOrderFullDetails);

// user
router.route("/customer").get(adminController.getAllCustomer);
router.get("/customers/:id/stats", adminController.getCustomerStats);
router.patch("/user-block", adminController.blockCustomer);
router.patch("/user-unblock", adminController.unblockCustomer);

router.get(
  "/getfoodfromrestaurant/:id",
  adminController.getAllFoodInRestaurant,
);

// ads
router
  .route("/ads")
  .get(adminController.getAds)
  .post(upload.single("image"), adminController.createAd)
  .put(upload.single("image"), adminController.updateAd)
  .delete(adminController.deleteAd);

// Settlement
router.get("/settlements/summary", adminController.getSettlementsSummary);
router.get("/settlements", adminController.getAllSettlements);
router.patch("/settlements/:id/approve", adminController.approveSettlement);
router.patch("/settlements/:id/reject", adminController.rejectSettlement);

// ─── Promotions ───────────────────────────────────────────────
router
  .route("/promotions")
  .get(adminController.getPromotions)
  .post(adminController.createPromotion)
  .patch(adminController.updatePromotion)
  .delete(adminController.deletePromotion);

// ─── Coupons (v3.9) ─────────────────────────────────────────
router
  .route("/coupons")
  .get(adminController.getCoupons)
  .post(adminController.createCoupon)
  .patch(adminController.updateCoupon)
  .delete(adminController.deleteCoupon);

// ─── Main Categories ──────────────────────────────────────────
router
  .route("/main-categories")
  .get(adminController.getMainCategories)
  .post(upload.single("image"), adminController.createMainCategory);
router
  .route("/main-categories/:id")
  .patch(upload.single("image"), adminController.updateMainCategory)
  .delete(adminController.deleteMainCategory);
router.get("/restaurants/:id/foods", adminController.getFoodsByRestaurant);

module.exports = router;
