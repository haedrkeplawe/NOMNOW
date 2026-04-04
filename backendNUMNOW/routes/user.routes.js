const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const upload = require("../middleware/upload");
const { auth } = require("../middleware/userauth.middlware");

// Auth
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password/:token", userController.resetPassword);
router.post("/register", upload.single("image"), userController.register);
router.post("/loginwithphone", userController.loginWithPhone);
router.post("/verifyphone", userController.verifyPhone);
router.post("/loginwithemail", userController.loginWithEmail);
router.post("/verifyemail", userController.verifyEmail);

router.get("/user-info", auth, userController.getUserInof);
router.patch(
  "/update-profile",
  auth,
  upload.single("image"),
  userController.updateProfile,
);

// Addresses
router
  .route("/user-addresses")
  .get(auth, userController.GetAddresses)
  .post(auth, userController.AddAddresses)
  .patch(auth, userController.updateAddress)
  .delete(auth, userController.deleteAddress);

router
  .route("/user-addresses/:id")
  .patch(auth, userController.setDefaultAddress);

// Restaurant and foods
router.get("/restaurant", auth, userController.getAllRestaurant);
router.get("/food", auth, userController.getAllFood);
router.get("/food/:id", auth, userController.getFood);
router.get(
  "/food-in-restaurant/:id",
  auth,
  userController.getAllFoodInRestaurant,
);

// favorite
router.get("/favorite", auth, userController.getFavorites);
router.patch("/favorite/food", auth, userController.toggleFavoriteFood);
router.patch(
  "/favorite/restaurant",
  auth,
  userController.toggleFavoriteRestaurant,
);

// stars
router.post("/rate/food", auth, userController.rateFood);

// cart
router
  .route("/cart")
  .get(auth, userController.getCart)
  .post(auth, userController.addToCart)
  .delete(auth, userController.removeFoodFromCart);

// order
router.patch("/order/cancelfromuser", auth, userController.cancelOrderFromUser);
router
  .route("/order")
  .get(auth, userController.getUserOrders)
  .post(auth, userController.createOrder);

module.exports = router;

// ads
router.post("/ads/:adId/click", auth, userController.clickAd);
