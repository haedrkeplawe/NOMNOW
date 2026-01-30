const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurant.controller");
const upload = require("../middleware/upload"); // استدعاء Multer
const { authMiddleware } = require("../middleware/auth.middleware");

router.post("/forgot-password", restaurantController.forgotPassword);
router.post("/reset-password/:token", restaurantController.resetPassword);

router.post("/loginwithphone", restaurantController.loginWithPhone);
router.post("/verifyphone", restaurantController.verifyPhone);

router.post("/loginwithemail", restaurantController.loginWithEmail);
router.post("/verifyemail", restaurantController.verifyEmail);

router.post("/refreshtoken", restaurantController.refreshToken);

router.post("/logout", authMiddleware, restaurantController.logout);

// category routes
router
  .route("/category")
  .post(
    authMiddleware,
    upload.single("image"),
    restaurantController.createCategory
  )
  .get(authMiddleware, restaurantController.getCategories);
router
  .route("/category/:id")
  .get(authMiddleware, restaurantController.getCategoryById)
  .patch(
    authMiddleware,
    upload.single("image"),
    restaurantController.updateCategory
  )
  .delete(authMiddleware, restaurantController.deleteCategory);

// food routes
router
  .route("/food")
  .get(authMiddleware, restaurantController.getAllFoodsOnRestorant)
  .post(authMiddleware, upload.single("image"), restaurantController.createFood)
  .patch(
    authMiddleware,
    upload.single("image"),
    restaurantController.updateFood
  )
  .delete(authMiddleware, restaurantController.deleteFood);

// setting
router
  .route("/setting/restorant-info")
  .get(authMiddleware, restaurantController.getResturantInfo)
  .patch(
    authMiddleware,
    upload.single("image"),
    restaurantController.updateResturantInfo
  );

// rate
router.get(
  "/rate-in-restaurant",
  authMiddleware,
  restaurantController.rateInRestaurant
);

// status
router.patch(
  "/toggle-status",
  authMiddleware,
  restaurantController.toggleRestaurantStatus
);
module.exports = router;
