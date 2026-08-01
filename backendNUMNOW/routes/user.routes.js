const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const upload = require("../middleware/upload");
const { auth } = require("../middleware/userauth.middlware");

// Auth
// update1.1  forgot-password
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password/:token", userController.resetPassword);
router.post("/register", upload.single("image"), userController.register);
router.post("/loginwithphone", userController.loginWithPhone);
router.post("/verifyphone", userController.verifyPhone);
router.post("/loginwithemail", userController.loginWithEmail);
router.post("/verifyemail", userController.verifyEmail);

router.get("/user-info", auth, userController.getUserInfo);
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
router.get("/search", auth, userController.search); // new1.1
// update1.1
// GET /api/user/restaurant              → افتراضي الاقرب
// GET /api/user/restaurant?sort=rating  → تقييم + قرب
// GET /api/user/restaurant?sort=popular → طلبات + قرب
router.get("/restaurant", auth, userController.getAllRestaurant);
// update1.1
// GET /api/user/food?sort=popular  → الأكل مرتب حسب الأكثر طلباً
// GET /api/user/food?sort=rating   → الأكل مرتب حسب التقييم
// GET /api/user/food               → الترتيب الافتراضي (حسب القرب أو التقييم)
router.get("/food", auth, userController.getAllFood);
router.get("/food/:id", auth, userController.getFood);
// update1.1 اضفنا فلتر اختياري
// GET /food-in-restaurant/:id                          → كل الأكل عادي
// GET /food-in-restaurant/:id?category=xxx             → كاتيغوري معين
// GET /food-in-restaurant/:id?sort=popular             → الأكثر طلباً
// GET /food-in-restaurant/:id?category=xxx&sort=popular → كاتيغوري + الأكثر طلباً
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
router.post("/rate/driver", auth, userController.rateDriver);
router.post("/rate/order", auth, userController.rateOrder);

// cart
router
  .route("/cart")
  .get(auth, userController.getCart)
  .post(auth, userController.addToCart)
  .delete(auth, userController.removeFoodFromCart);

// new DE
// payment
router.post("/payment/create-intent", auth, userController.createPaymentIntent);

// order
router.patch("/order/cancelfromuser", auth, userController.cancelOrderFromUser);
router
  .route("/order")
  .get(auth, userController.getUserOrders)
  .post(auth, userController.createOrder);

// promotions — كل العروض النشطة
// new v2.2
router.get("/promotions", auth, userController.getPromotions);

module.exports = router;

// ads
router.post("/ads/:adId/click", auth, userController.clickAd);
