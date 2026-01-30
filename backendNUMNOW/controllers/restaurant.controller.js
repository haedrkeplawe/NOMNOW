const Restaurant = require("../models/restaurant");
const RestaurantUser = require("../models/restaurantUser");
const Food = require("../models/food");
const Category = require("../models/category");
const bcrypt = require("bcryptjs");
const smsProvider = require("../utils/smsProvider");
const emailProvider = require("../utils/emailProvider");
const jwt = require("jsonwebtoken");
const { generateAccessToken, generateRefreshToken } = require("../utils/token");
const uploadBuffer = require("../utils/cloudUpload");
const cloudinary = require("../config/cloudinary");
const { default: mongoose } = require("mongoose");
const sendResetEmail = require("../utils/sendResetEmail");
const crypto = require("crypto");

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await RestaurantUser.findOne({ email });
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

  const user = await RestaurantUser.findOne({
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
exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) return res.status(401).json({ message: "No refresh token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await RestaurantUser.findById(decoded.id);

    if (!user || user.refreshToken !== token)
      return res.status(403).json({ message: "Invalid refresh token" });

    const newAccessToken = generateAccessToken(user._id);

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ message: "Refresh token expired" });
  }
};

// Login with  --phone-- And verify for all time
exports.loginWithPhone = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ message: "Missing required fields" });

    const user = await RestaurantUser.findOne({ phone });
    if (!user) return res.status(404).json({ message: "Phone not registered" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.phoneOtp = otp;
    user.phoneOtpExpire = Date.now() + 60 * 60 * 1000; // 60 دقائق

    await user.save();

    // await smsProvider.send(user.phone, `Your OTP: ${otp}`);

    res.status(200).json({
      message: "OTP sent successfully :" + ` Your OTP: ${otp}`,
      requiresVerification: true,
    });
  } catch (err) {
    console.log(err.message);

    res.status(500).json({ message: err.message });
  }
};
exports.verifyPhone = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const user = await RestaurantUser.findOne({ phone });

    if (!user) throw new Error(`phone not found`);
    if (user.phoneOtp !== otp) throw new Error("Invalid OTP");
    if (user.phoneOtpExpire < Date.now()) throw new Error("OTP expired");

    user.phoneOtp = undefined;
    user.phoneOtpExpire = undefined;

    // token
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;

    await user.save();

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurantId,
        },
      });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Login with  --email-- And verify for all time
exports.loginWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Missing required fields" });

    const user = await RestaurantUser.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email not registered" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOtp = otp;
    user.emailOtpExpire = Date.now() + 60 * 60 * 1000; // 60 دقائق
    await user.save();

    await emailProvider.send(user.email, `Your OTP: ${otp}`);

    res.status(200).json({
      message: "OTP sent to your email",
      requiresVerification: true,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await RestaurantUser.findOne({ email });

    if (!user) throw new Error(`email not found`);
    if (user.emailOtp !== otp) throw new Error("Invalid OTP");
    if (user.emailOtpExpire < Date.now()) throw new Error("OTP expired");

    // token
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.emailOtp = undefined;
    user.emailOtpExpire = undefined;
    await user.save();

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurantId,
        },
      });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
exports.logout = async (req, res) => {
  req.user.refreshToken = null;
  await req.user.save();

  res.clearCookie("refreshToken").json({ message: "Logged out" });
};

// Category CRUD operations
exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const exists = await Category.findOne({
      name,
      restaurantId: req.user.restaurantId,
    });

    if (exists) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const category = await Category.create({
      restaurantId: req.user.restaurantId,
      name,
    });

    res.status(201).json({ message: "Category created", category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      restaurantId: req.user.restaurantId,
    }).sort({ createdAt: 1 });

    res.json({ categories });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      restaurantId: req.user.restaurantId,
    });

    if (!category)
      return res.status(404).json({ message: "Category not found" });

    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.updateCategory = async (req, res) => {
  try {
    const { name } = req.body;

    const category = await Category.findOne({
      _id: req.params.id,
      restaurantId: req.user.restaurantId,
    });

    if (!category)
      return res.status(404).json({ message: "Category not found" });

    if (name) category.name = name;

    await category.save();

    res.json({ message: "Category updated", category });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      restaurantId: req.user.restaurantId,
    });

    if (!category)
      return res.status(404).json({ message: "Category not found" });

    // 🔥 خيار 1: منع الحذف إذا فيه أطعمة
    const foodCount = await Food.countDocuments({
      categoryId: category._id,
    });

    if (foodCount > 0) {
      return res.status(400).json({
        message: "Cannot delete category with foods",
      });
    }

    await category.deleteOne();

    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// food CRUD operations
exports.getAllFoodsOnRestorant = async (req, res) => {
  try {
    const foods = await Food.find({
      restaurantId: req.user.restaurantId,
    })
      .populate("categoryId")
      .sort({ createdAt: -1 });
    res.status(200).json({ foods });
  } catch (err) {
    console.log(err);
  }
};
exports.createFood = async (req, res) => {
  try {
    const { name, description, price, time, status, categoryId } = req.body;
    const ingredients = JSON.parse(req.body.ingredients || "[]");
    const extras = JSON.parse(req.body.extras || "[]");

    if (!name || !price || !time || !status || !req.file || !categoryId) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (Number(price) <= 0 || Number(time) <= 0) {
      return res
        .status(400)
        .json({ message: "Price and time must be positive numbers" });
    }
    // التحقق من وجود الفئة
    const category = await Category.findOne({
      _id: categoryId,
      restaurantId: req.user.restaurantId,
    });
    if (!category) return res.status(400).json({ message: "Invalid category" });

    const foodData = new Food({
      restaurantId: req.user.restaurantId,
      categoryId,
      name,
      description,
      price: Number(price),
      time: Number(time),
      ingredients, // ✅ Array
      extras, // ✅ Array of objects
      status,
    });
    // إذا رفع المستخدم صورة
    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, "foodimg");
      foodData.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }
    await foodData.save();

    // جلب الـ category كامل قبل الإرسال
    const foodWithCategory = await Food.findById(foodData._id).populate(
      "categoryId",
    );
    res.status(201).json({
      message: "Food created successfully",
      foodData: foodWithCategory,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.updateFood = async (req, res) => {
  try {
    const { foodId, name, description, price, time, status, categoryId } =
      req.body;
    const ingredients = JSON.parse(req.body.ingredients || "[]");
    const extras = JSON.parse(req.body.extras || "[]");

    if (!foodId) {
      return res.status(400).json({ message: "foodId is required" });
    }

    // 1️⃣ جلب الطبق والتأكد من الملكية
    const food = await Food.findOne({
      _id: foodId,
      restaurantId: req.user.restaurantId,
    });

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }
    // 2️⃣ تحديث الحقول (فقط المرسل)
    if (name !== undefined) food.name = name;
    if (description !== undefined) food.description = description;
    if (price !== undefined) food.price = Number(price);
    if (time !== undefined) food.time = Number(time);
    if (ingredients !== undefined) food.ingredients = ingredients;
    if (extras !== undefined) food.extras = extras;
    if (status !== undefined) food.status = status;

    if (categoryId !== undefined) {
      const category = await Category.findOne({
        _id: categoryId,
        restaurantId: req.user.restaurantId,
      });
      if (!category)
        return res.status(400).json({ message: "Invalid category" });
      food.categoryId = categoryId;
    }

    // 3️⃣ تحديث الصورة (إن وُجدت)
    if (req.file) {
      // حذف الصورة القديمة
      if (food.image?.public_id) {
        await cloudinary.uploader.destroy(food.image.public_id);
      }

      // رفع الصورة الجديدة
      const result = await uploadBuffer(req.file.buffer, "foodimg");
      food.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    // 4️⃣ حفظ التعديلات
    await food.save();

    const foodWithCategory = await Food.findById(food._id).populate(
      "categoryId",
    );

    res.status(200).json({
      message: "Food updated successfully",
      food: foodWithCategory,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.deleteFood = async (req, res) => {
  try {
    const { foodId } = req.body;

    // 1️⃣ جلب الأكلة
    const food = await Food.findOne({
      _id: foodId,
      restaurantId: req.user.restaurantId, // حماية
    });

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    // 2️⃣ حذف الصورة من Cloudinary إذا موجودة
    if (food.image && food.image.public_id) {
      await cloudinary.uploader.destroy(food.image.public_id);
    }

    // 3️⃣ حذف الأكلة من قاعدة البيانات
    await food.deleteOne();

    res.status(200).json({ message: "Food deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// setting
exports.getResturantInfo = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.user.restaurantId);
    res.status(200).json({ restaurant });
  } catch (err) {
    console.log(err);
  }
};
exports.updateResturantInfo = async (req, res) => {
  try {
    const { name, description, email, phone, address, location } = req.body;

    const restaurant = await Restaurant.findById(req.user.restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "restaurant not found" });
    }

    if (name !== undefined) restaurant.name = name;
    if (description !== undefined) restaurant.description = description;
    if (email !== undefined) restaurant.email = email;
    if (phone !== undefined) restaurant.phone = phone;

    // تحديث العنوان لو موجود
    if (address !== undefined) {
      try {
        const parsedAddress =
          typeof address === "string" ? JSON.parse(address) : address;
        restaurant.address = {
          fullAddress:
            parsedAddress.fullAddress || restaurant.address.fullAddress,
          country: parsedAddress.country || "",
          city: parsedAddress.city || "",
          area: parsedAddress.area || "",
          street: parsedAddress.street || "",
          building: parsedAddress.building || "",
          notes: parsedAddress.notes || "",
        };
      } catch (err) {
        console.log("Invalid address JSON:", err);
      }
    }

    // تحديث الموقع الجغرافي لو موجود
    if (location !== undefined) {
      try {
        const parsedLocation =
          typeof location === "string" ? JSON.parse(location) : location;
        if (
          parsedLocation.type === "Point" &&
          Array.isArray(parsedLocation.coordinates) &&
          parsedLocation.coordinates.length === 2
        ) {
          restaurant.location = parsedLocation;
        }
      } catch (err) {
        console.log("Invalid location JSON:", err);
      }
    }

    if (req.file) {
      // حذف الصورة القديمة
      if (restaurant.image?.public_id) {
        await cloudinary.uploader.destroy(restaurant.image.public_id);
      }
      // رفع الصورة الجديدة
      const result = await uploadBuffer(req.file.buffer, "restaurantimg");
      restaurant.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    await restaurant.save();

    res.status(200).json({
      message: "Restaurant updated successfully",
      restaurant,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.toggleRestaurantStatus = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    // toggle status
    restaurant.status = restaurant.status === "open" ? "closed" : "open";

    await restaurant.save();

    res.json({
      message: "Restaurant status updated",
      status: restaurant.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// reaing
exports.rateInRestaurant = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurantId" });
    }

    // 1️⃣ جلب كل الوجبات مع تقييماتها
    const foods = await Food.find({ restaurantId })
      .select("name userRatings")
      .populate({
        path: "userRatings.userId",
        select: "name img",
      });

    // 2️⃣ متغيرات الإحصائيات
    let totalReviews = 0;
    let totalRating = 0;

    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    const reviews = [];

    // 3️⃣ المرور على كل التقييمات
    foods.forEach((food) => {
      food.userRatings.forEach((rate) => {
        totalReviews += 1;
        totalRating += rate.rating;
        ratingDistribution[rate.rating] += 1;
        reviews.push({
          foodId: food._id,
          foodName: food.name,
          user: rate.userId,
          rating: rate.rating,
          comment: rate.comment || "",
        });
      });
    });

    // 4️⃣ حساب المتوسط
    const averageRating = totalReviews === 0 ? 0 : totalRating / totalReviews;

    // 5️⃣ إرسال النتيجة
    res.status(200).json({
      success: true,
      averageRating: Number(averageRating.toFixed(1)),
      totalReviews,
      ratingDistribution,
      reviews, // إذا ما بدك ياه احذفه
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
