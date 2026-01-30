// controllers/auth.controller.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const uploadBuffer = require("../utils/cloudUpload");
const smsProvider = require("../utils/smsProvider");
const emailProvider = require("../utils/emailProvider");
const Restaurant = require("../models/restaurant");
const Food = require("../models/food");
const { default: mongoose } = require("mongoose");
const sendResetEmail = require("../utils/sendResetEmail");
const crypto = require("crypto");
const Cart = require("../models/cart");

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  // إنشاء token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // تشفيره قبل التخزين
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // صلاحية 15 دقيقة
  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL_RES}/reset-password/${resetToken}`;

  // إرسال إيميل
  await sendResetEmail({
    to: user.email,
    subject: "Reset your password",
    html: `
      <p>You requested a password reset</p>
      <a href="${resetUrl}">Reset Password</a>
    `,
  });

  res.json({ message: "Reset link sent to email" });
};
exports.resetPassword = async (req, res) => {
  const resetToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user)
    return res.status(400).json({ message: "Invalid or expired token" });

  user.password = await bcrypt.hash(req.body.password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  res.json({ message: "Password reset successful" });
};

exports.register = async (req, res) => {
  try {
    const { name, email, phone, dateOfBirth, gender, password } = req.body;
    if (!name || !email || !phone || !dateOfBirth || !gender || !password)
      return res.status(400).json({ message: "Missing required fields" });

    const existEmail = await User.findOne({ email });
    const existPhone = await User.findOne({ phone });
    if (existEmail)
      return res.status(400).json({ message: "Email  already used" });
    if (existPhone)
      return res.status(400).json({ message: "phone already used" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
      phone,
      dateOfBirth,
      gender,
      password: hashedPassword,
    };

    // إذا رفع المستخدم صورة
    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, "usersimg");
      userData.img = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    const user = await User.create(userData);

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        img: user.img || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
// Login with --phone--  And verify for first time
exports.loginWithPhone = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ message: "Missing required fields" });

    const user = await User.findOne({ phone });
    if (!user)
      return res.status(404).json({ message: "Invalid phone or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid phone or password" });

    // 📌 إذا الرقم غير مفعّل → OTP
    if (!user.isVerifiedPhone) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      user.phoneOtp = otp;
      user.phoneOtpExpire = Date.now() + 60 * 60 * 1000;
      await user.save();

      return res.status(200).json({
        message: "OTP sent",
        requiresVerification: true,
        otp, // بس للتجربة
      });
    }

    // ✅ تسجيل دخول مباشر
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
      },
      requiresVerification: false,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.verifyPhone = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone });
    if (!user) throw new Error("Phone not found");

    if (user.phoneOtp !== otp) throw new Error("Invalid OTP");

    if (user.phoneOtpExpire < Date.now()) throw new Error("OTP expired");

    user.isVerifiedPhone = true;
    user.phoneOtp = undefined;
    user.phoneOtpExpire = undefined;

    await user.save();

    // ✅ توكن واحد فقط
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
// Login with  --email-- And verify for first time
exports.loginWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Missing required fields" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });
    if (!user.isVerifiedEmail) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.emailOtp = otp;
      user.emailOtpExpire = Date.now() + 60 * 60 * 1000; // 60 دقائق
      await user.save();

      await emailProvider.send(user.email, `Your OTP: ${otp}`);

      res.status(200).json({
        message: "OTP sent to your email",
        requiresVerification: true,
      });
    } else {
      // ✅ توكن واحد فقط
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.status(200).json({
        token,
        user: {
          id: user._id,
          name: user.name,
        },
        requiresVerification: false,
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) throw new Error(`email not found`);
    if (String(user.emailOtp) !== String(otp)) throw new Error("Invalid OTP");
    if (user.emailOtpExpire < Date.now()) throw new Error("OTP expired");

    user.isVerifiedEmail = true;
    user.emailOtp = undefined;
    user.emailOtpExpire = undefined;
    await user.save();

    // ✅ توكن واحد فقط
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, gender, dateOfBirth } = req.body;

    const updateData = {};

    if (name) updateData.name = name;
    if (gender) updateData.gender = gender;
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;

    // إذا رفع صورة جديدة
    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, "usersimg");

      updateData.img = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getUserInof = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found" })
        .select("-password");
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: err.message });
  }
};

//Address
exports.GetAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("addresses");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ترتيب: الافتراضي أولًا
    const addresses = user.addresses.sort((a, b) => b.isDefault - a.isDefault);

    res.status(200).json({ addresses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.AddAddresses = async (req, res) => {
  try {
    const {
      name,
      fullAddress,
      country,
      city,
      area,
      street,
      building,
      notes,
      lng,
      lat,
      isDefault,
    } = req.body;

    // تحقق من الحقول الأساسية
    if (
      !fullAddress ||
      !city ||
      !area ||
      !street ||
      !building ||
      !lng ||
      !lat
    ) {
      return res.status(400).json({
        message: "Missing required address or location fields",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // إذا العنوان افتراضي → نلغي الافتراضي عن البقية
    if (isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    // إذا أول عنوان → يكون افتراضي تلقائي
    const defaultStatus =
      user.addresses.length === 0 ? true : isDefault || false;

    const newAddress = {
      name,
      fullAddress,
      country,
      city,
      area,
      street,
      building,
      notes,
      isDefault: defaultStatus,
      location: {
        type: "Point",
        coordinates: [lng, lat], // [longitude, latitude]
      },
    };

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      message: "Address added successfully",
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.updateAddress = async (req, res) => {
  try {
    const {
      addressId,
      name,
      fullAddress,
      country,
      city,
      area,
      street,
      building,
      notes,
      lng,
      lat,
      isDefault,
    } = req.body;

    if (!addressId) {
      return res.status(400).json({ message: "Address ID is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // إذا بدنا نخلي العنوان افتراضي
    if (isDefault === true) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
      address.isDefault = true;
    }

    // تحديث الحقول فقط إذا أُرسلت
    if (name !== undefined) address.name = name;
    if (fullAddress !== undefined) address.fullAddress = fullAddress;
    if (country !== undefined) address.country = country;
    if (city !== undefined) address.city = city;
    if (area !== undefined) address.area = area;
    if (street !== undefined) address.street = street;
    if (building !== undefined) address.building = building;
    if (notes !== undefined) address.notes = notes;

    // تحديث الموقع الجغرافي
    if (lng !== undefined && lat !== undefined) {
      address.location = {
        type: "Point",
        coordinates: [lng, lat],
      };
    }

    await user.save();

    res.status(200).json({
      message: "Address updated successfully",
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.setDefaultAddress = async (req, res) => {
  try {
    const addressId = req.params.id;

    if (!addressId) {
      return res.status(400).json({ message: "Address ID is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // إلغاء الافتراضي عن جميع العناوين
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });

    // تعيين العنوان الجديد كافتراضي
    address.isDefault = true;

    await user.save();

    res.status(200).json({
      message: "Default address updated successfully",
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.body;

    if (!addressId) {
      return res.status(400).json({ message: "Address ID is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    const wasDefault = address.isDefault;

    // حذف العنوان
    address.remove();

    // إذا العنوان المحذوف كان افتراضي
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      message: "Address deleted successfully",
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Restaurant & food
exports.getAllRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.find().select("-owner");
    res.status(200).json({ restaurant });
  } catch (err) {
    console.log(err);
  }
};
exports.getAllFood = async (req, res) => {
  try {
    const foods = await Food.find();
    res.status(200).json({ foods });
  } catch (err) {
    console.log(err);
  }
};
exports.getFood = async (req, res) => {
  try {
    const foodId = req.params.id;
    const food = await Food.findById(foodId);
    res.status(200).json({ food });
  } catch (err) {
    console.log(err);
  }
};
exports.getAllFoodInRestaurant = async (req, res) => {
  try {
    const foods = await Food.find({ restaurantId: req.params.id }).populate(
      "restaurantId"
    );
    res.status(200).json({ foods });
  } catch (err) {
    console.log(err);
  }
};
exports.toggleFavoriteFood = async (req, res) => {
  try {
    const userId = req.user.id;
    const { foodId } = req.body;

    if (!foodId) {
      return res.status(400).json({ message: "foodId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isFav = user.favoritesfood.some((id) => id.toString() === foodId);

    if (isFav) {
      user.favoritesfood.pull(foodId);
    } else {
      user.favoritesfood.push(foodId);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: isFav
        ? "Food removed from favorites"
        : "Food added to favorites",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.toggleFavoriteRestaurant = async (req, res) => {
  try {
    const userId = req.user.id;
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const user = await User.findById(userId);

    const isFav = user.favoritesres.some(
      (id) => id.toString() === restaurantId
    );

    if (isFav) {
      user.favoritesres.pull(restaurantId);
    } else {
      user.favoritesres.push(restaurantId);
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: isFav
        ? "Restaurant removed from favorites"
        : "Restaurant added to favorites",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
exports.getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("favoritesfood")
      .populate("favoritesres");

    res.status(200).json({
      favoritesfood: user.favoritesfood,
      favoritesres: user.favoritesres,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// rate
async function updateRestaurantRating(restaurantId) {
  const foods = await Food.find({ restaurantId });

  if (!foods.length) return;

  const total = foods.reduce((sum, food) => sum + food.rating, 0);
  const avg = total / foods.length;

  await Restaurant.findByIdAndUpdate(restaurantId, {
    rating: Number(avg.toFixed(1)),
  });
}

exports.rateFood = async (req, res) => {
  try {
    const { foodId, rating, comment } = req.body;

    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(foodId)) {
      return res.status(400).json({ message: "Invalid foodId" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    const existingRating = food.userRatings.find(
      (r) => r.userId.toString() === userId
    );

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.comment = comment;
    } else {
      food.userRatings.push({
        userId,
        rating,
        comment,
      });
    }

    const avgRating =
      food.userRatings.reduce((sum, r) => sum + r.rating, 0) /
      food.userRatings.length;

    food.rating = Number(avgRating.toFixed(1));

    await food.save();

    await updateRestaurantRating(food.restaurantId);

    res.status(200).json({
      success: true,
      message: "Food rated successfully",
      rating: food.rating,
      userRatings: food.userRatings,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Cart
exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId }).populate(
      "restaurants.items.foodId",
      "name image"
    );

    if (!cart) {
      return res.status(200).json({
        success: true,
        cart: {
          restaurants: [],
          totalCartPrice: 0,
        },
      });
    }

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch cart" });
  }
};
function areExtrasEqual(a, b) {
  if (a.length !== b.length) return false;
  a.sort((x, y) => x.name.localeCompare(y.name));
  b.sort((x, y) => x.name.localeCompare(y.name));
  return a.every((e, i) => e.name === b[i].name && e.price === b[i].price);
}
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { foodId, quantity = 1, extras = [] } = req.body;

    // 1️⃣ جلب الوجبة
    const food = await Food.findById(foodId);
    if (!food || food.status !== "available") {
      return res.status(400).json({ message: "Food not available" });
    }

    // 2️⃣ حساب سعر الإضافات
    const extrasTotal = extras.reduce((sum, e) => sum + e.price, 0);
    const totalItemPrice = (food.price + extrasTotal) * quantity;

    // 3️⃣ جلب أو إنشاء السلة
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({
        userId,
        restaurants: [],
        totalCartPrice: 0,
      });
    }

    // 4️⃣ البحث عن مطعم داخل السلة
    let restaurantCart = cart.restaurants.find(
      (r) => r.restaurantId.toString() === food.restaurantId.toString()
    );

    // 5️⃣ إذا المطعم غير موجود، نضيفه مباشرة مع العنصر
    if (!restaurantCart) {
      cart.restaurants.push({
        restaurantId: food.restaurantId,
        items: [
          {
            foodId,
            name: food.name,
            image: food.image?.url,
            basePrice: food.price,
            quantity,
            extras,
            totalItemPrice,
          },
        ],
        restaurantTotalPrice: totalItemPrice,
      });
    } else {
      // البحث عن عنصر مطابق داخل المطعم
      const existingItem = restaurantCart.items.find(
        (item) =>
          item.foodId.toString() === foodId &&
          areExtrasEqual(item.extras, extras)
      );

      if (existingItem) {
        // زيادة الكمية
        existingItem.quantity += quantity;
        existingItem.totalItemPrice += totalItemPrice;
      } else {
        // إضافة عنصر جديد
        restaurantCart.items.push({
          foodId,
          name: food.name,
          image: food.image?.url,
          basePrice: food.price,
          quantity,
          extras,
          totalItemPrice,
        });
      }

      // إعادة حساب سعر المطعم بعد أي تعديل
      restaurantCart.restaurantTotalPrice = restaurantCart.items.reduce(
        (sum, item) => sum + item.totalItemPrice,
        0
      );
    }

    // 6️⃣ إعادة حساب سعر السلة الكلي
    cart.totalCartPrice = cart.restaurants.reduce(
      (sum, r) => sum + r.restaurantTotalPrice,
      0
    );

    // 7️⃣ حفظ السلة
    await cart.save();

    res.status(200).json({
      message: "Added to cart successfully",
      cart,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.removeFoodFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { restaurantId, foodId } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const restaurantCart = cart.restaurants.find(
      (r) => r.restaurantId.toString() === restaurantId
    );

    if (!restaurantCart) {
      return res.status(404).json({ message: "Restaurant not found in cart" });
    }

    // 🔥 حذف كل العناصر التي تملك نفس foodId
    const itemsToRemove = restaurantCart.items.filter(
      (item) => item.foodId.toString() === foodId
    );

    if (itemsToRemove.length === 0) {
      return res.status(404).json({ message: "Food not found in cart" });
    }

    // طرح السعر
    itemsToRemove.forEach((item) => {
      restaurantCart.restaurantTotalPrice -= item.totalItemPrice;
    });

    // حذف العناصر
    restaurantCart.items = restaurantCart.items.filter(
      (item) => item.foodId.toString() !== foodId
    );

    // لو المطعم فاضي
    if (restaurantCart.items.length === 0) {
      cart.restaurants = cart.restaurants.filter(
        (r) => r.restaurantId.toString() !== restaurantId
      );
    }

    // إعادة حساب إجمالي السلة
    cart.totalCartPrice = cart.restaurants.reduce(
      (sum, r) => sum + r.restaurantTotalPrice,
      0
    );

    // لو السلة فاضية بالكامل
    if (cart.restaurants.length === 0) {
      await Cart.findByIdAndDelete(cart._id);
      return res.status(200).json({
        success: true,
        message: "Cart cleared",
        cart: null,
      });
    }

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Food removed completely from cart",
      cart,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to remove food from cart" });
  }
};
