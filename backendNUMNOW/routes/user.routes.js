const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const upload = require("../middleware/upload");
const { auth } = require("../middleware/userauth.middleware");

// Auth
router.post("/forgot-password", userController.forgotPassword);
router.post("/reset-password/:token", userController.resetPassword);

router.post("/register", userController.register); // done

router.post("/loginwithphone", userController.loginWithPhone); //done
router.post("/verifyphone", userController.verifyPhone); //done

router.post("/loginwithemail", userController.loginWithEmail); //done
router.post("/verifyemail", userController.verifyEmail); // done

router.get("/user-info", auth, userController.getUserInof); // done
router.patch(
  "/update-profile",
  auth,
  upload.single("image"),
  userController.updateProfile
); // done

// Addresses
router
  .route("/user-addresses")
  .get(auth, userController.GetAddresses) // update
  .post(auth, userController.AddAddresses) // update
  .patch(auth, userController.updateAddress) // update
  .delete(auth, userController.deleteAddress); // update

router
  .route("/user-addresses/:id")
  .patch(auth, userController.setDefaultAddress); // done

// Restaurant and foods
router.get("/restaurant", auth, userController.getAllRestaurant); // done
router.get("/food", auth, userController.getAllFood); // done
router.get("/food/:id", auth, userController.getFood); // done
router.get(
  "/food-in-restaurant/:id",
  auth,
  userController.getAllFoodInRestaurant
); // done

// favorite
router.get("/favorite", auth, userController.getFavorites); // done
router.patch("/favorite/food", auth, userController.toggleFavoriteFood); // done
router.patch(
  "/favorite/restaurant",
  auth,
  userController.toggleFavoriteRestaurant
);

// stars
router.post("/rate/food", auth, userController.rateFood);

// cart
router
  .route("/cart")
  .get(auth, userController.getCart) //done
  .post(auth, userController.addToCart) //done
  .delete(auth, userController.removeFoodFromCart); //done

module.exports = router;
