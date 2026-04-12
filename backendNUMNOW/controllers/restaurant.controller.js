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
const Order = require("../models/Order");
const Settlement = require("../models/Settlement");

exports.forgotPassword = async (req, res) => {
  let user;
  try {
    const { email } = req.body;

    user = await RestaurantUser.findOne({ email });
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
  } catch (err) {
    // لو فشل الإيميل بعد حفظ الـ token → نمسحه من DB
    if (user?.resetPasswordToken) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
    }
    res
      .status(500)
      .json({ message: "Failed to send reset email. Please try again." });
  }
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

    res.json({
      accessToken: newAccessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        img: user.img || null,
      },
    });
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
        sameSite: "none",
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          img: user.img || null,
          restaurantId: user.restaurantId,
        },
      });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
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
        sameSite: "none",
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          img: user.img || null,
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
    res.status(500).json({ message: "Server error" });
  }
};
exports.createFood = async (req, res) => {
  try {
    const { name, description, price, time, status, categoryId } = req.body;
    const ingredients = JSON.parse(req.body.ingredients || "[]");
    const extras = JSON.parse(req.body.extras || "[]");
    const sizes = JSON.parse(req.body.sizes || "[]");

    // إذا في أحجام → price اختياري، وإلا إلزامي
    const hasSize = sizes.length > 0;
    if (
      !name ||
      (!hasSize && !price) ||
      !time ||
      !status ||
      !req.file ||
      !categoryId
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!hasSize && Number(price) <= 0) {
      return res
        .status(400)
        .json({ message: "Price must be a positive number" });
    }
    if (Number(time) <= 0) {
      return res
        .status(400)
        .json({ message: "Time must be a positive number" });
    }

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
      price: hasSize ? 0 : Number(price),
      time: Number(time),
      ingredients,
      extras,
      sizes,
      status,
    });

    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, "foodimg");
      foodData.image = { url: result.secure_url, public_id: result.public_id };
    }
    await foodData.save();

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
    const sizes =
      req.body.sizes !== undefined ? JSON.parse(req.body.sizes) : undefined;

    if (!foodId) {
      return res.status(400).json({ message: "foodId is required" });
    }

    const food = await Food.findOne({
      _id: foodId,
      restaurantId: req.user.restaurantId,
    });

    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    if (name !== undefined) food.name = name;
    if (description !== undefined) food.description = description;
    if (time !== undefined) food.time = Number(time);
    if (ingredients !== undefined) food.ingredients = ingredients;
    if (extras !== undefined) food.extras = extras;
    if (status !== undefined) food.status = status;
    if (sizes !== undefined) {
      food.sizes = sizes;
      // إذا أضاف أحجام → price يصير 0، وإذا أزالها → price إلزامي
      if (sizes.length > 0) {
        food.price = 0;
      } else if (price !== undefined) {
        food.price = Number(price);
      }
    } else if (price !== undefined) {
      food.price = Number(price);
    }

    if (categoryId !== undefined) {
      const category = await Category.findOne({
        _id: categoryId,
        restaurantId: req.user.restaurantId,
      });
      if (!category)
        return res.status(400).json({ message: "Invalid category" });
      food.categoryId = categoryId;
    }

    if (req.file) {
      if (food.image?.public_id) {
        await cloudinary.uploader.destroy(food.image.public_id);
      }
      const result = await uploadBuffer(req.file.buffer, "foodimg");
      food.image = { url: result.secure_url, public_id: result.public_id };
    }

    await food.save();

    const foodWithCategory = await Food.findById(food._id).populate(
      "categoryId",
    );

    res
      .status(200)
      .json({ message: "Food updated successfully", food: foodWithCategory });
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
    res.status(500).json({ message: "Server error" });
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

    if (restaurant.status === "blocked") {
      return res
        .status(403)
        .json({ message: "Restaurant is blocked and cannot change status" });
    }

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
          createdAt: rate.createdAt,
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

// orders

exports.getOrders = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [restaurant, orders] = await Promise.all([
      Restaurant.findById(restaurantId).select("commission"),
      Order.find({
        restaurantId,
        orderStatus: { $ne: "not_confirmed" },
        createdAt: { $gte: since },
      })
        .populate("userId", "name phone")
        .populate("driverId", "name phone vehicletype vehicleplate rating")
        .sort({ createdAt: -1 }),
    ]);

    const commissionRate = restaurant?.commission || 0;

    const enrichedOrders = orders.map((o) => ({
      ...o.toObject(),
      commission:
        o.orderStatus === "delivered"
          ? Math.round(o.itemsPrice * (commissionRate / 100) * 100) / 100
          : null,
      netProfit:
        o.orderStatus === "delivered"
          ? Math.round(o.itemsPrice * (1 - commissionRate / 100) * 100) / 100
          : null,
    }));

    res.status(200).json({
      success: true,
      total: enrichedOrders.length,
      orders: enrichedOrders,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.getFinancialOrders = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    // ── Query params ──────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 30);
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";
    const settlement = req.query.settlementStatus || "";

    const restaurant =
      await Restaurant.findById(restaurantId).select("commission");
    const commissionRate = restaurant?.commission || 0;

    // ── Aggregation pipeline ──────────────────────────────────
    const pipeline = [];

    // 1) فلتر أساسي على المطعم والحالة
    pipeline.push({
      $match: {
        restaurantId: new mongoose.Types.ObjectId(restaurantId),
        orderStatus: { $ne: "not_confirmed" },
      },
    });

    // 2) lookup المستخدم
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "userId",
        pipeline: [{ $project: { name: 1, phone: 1 } }],
      },
    });
    pipeline.push({
      $unwind: { path: "$userId", preserveNullAndEmptyArrays: true },
    });

    // 3) lookup السائق
    pipeline.push({
      $lookup: {
        from: "drivers",
        localField: "driverId",
        foreignField: "_id",
        as: "driverId",
        pipeline: [
          {
            $project: {
              name: 1,
              phone: 1,
              vehicletype: 1,
              vehicleplate: 1,
              rating: 1,
            },
          },
        ],
      },
    });
    pipeline.push({
      $unwind: { path: "$driverId", preserveNullAndEmptyArrays: true },
    });

    // 4) فلتر البحث — orderNumber أو customer name
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { orderNumber: { $regex: search, $options: "i" } },
            { "userId.name": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // 5) فلتر settlementStatus
    if (settlement && settlement !== "all") {
      pipeline.push({ $match: { settlementStatus: settlement } });
    }

    // 6) $facet — بيانات + عدد كلي في query وحدة
    pipeline.push({
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $addFields: {
              commission: {
                $cond: {
                  if: { $eq: ["$orderStatus", "delivered"] },
                  then: {
                    $round: [
                      {
                        $multiply: [
                          "$itemsPrice",
                          { $divide: [commissionRate, 100] },
                        ],
                      },
                      2,
                    ],
                  },
                  else: null,
                },
              },
              netProfit: {
                $cond: {
                  if: { $eq: ["$orderStatus", "delivered"] },
                  then: {
                    $round: [
                      {
                        $multiply: [
                          "$itemsPrice",
                          {
                            $subtract: [1, { $divide: [commissionRate, 100] }],
                          },
                        ],
                      },
                      2,
                    ],
                  },
                  else: null,
                },
              },
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    });

    const [result] = await Order.aggregate(pipeline);
    const orders = result?.data || [];
    const total = result?.totalCount?.[0]?.count || 0;

    res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      orders,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.getDashboardStats = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    // ── نطاقات الوقت ────────────────────────────────────────
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    // الحالات المعتبرة (مش ملغية / غير مؤكدة)
    const validStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
      "on_the_way",
      "delivered_by_driver",
      "delivered",
    ];

    // ── جلب البيانات كلها دفعة وحدة ─────────────────────────
    const [
      todayOrders,
      yesterdayOrders,
      todayAllOrders,
      yesterdayAllOrders,
      recentOrders,
    ] = await Promise.all([
      // أوردرات اليوم (المعتبرة)
      Order.find({
        restaurantId,
        orderStatus: { $in: validStatuses },
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),

      // أوردرات أمس (المعتبرة)
      Order.find({
        restaurantId,
        orderStatus: { $in: validStatuses },
        createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
      }),

      // كل أوردرات اليوم (لحساب acceptance rate)
      Order.find({
        restaurantId,
        orderStatus: { $ne: "not_confirmed" },
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }).select("orderStatus"),

      // كل أوردرات أمس
      Order.find({
        restaurantId,
        orderStatus: { $ne: "not_confirmed" },
        createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
      }).select("orderStatus"),

      // آخر 10 أوردرات للـ Recent Orders
      Order.find({
        restaurantId,
        orderStatus: { $ne: "not_confirmed" },
      })
        .populate("userId", "name")
        .populate("driverId", "name")
        .sort({ createdAt: -1 })
        .limit(10)
        .select(
          "orderNumber createdAt orderType items driverId userId orderStatus totalPrice",
        ),
    ]);

    // ── helper: إحصائيات ──────────────────────────────────────
    const calcStats = (orders, allOrders) => {
      const totalSales = orders.reduce((s, o) => s + o.itemsPrice, 0);
      const totalOrders = orders.length;

      const prepTimes = orders
        .filter((o) => o.updatedAt && o.createdAt)
        .map((o) => (new Date(o.updatedAt) - new Date(o.createdAt)) / 60000);
      const avgPrepTime =
        prepTimes.length > 0
          ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length
          : 0;

      const accepted = allOrders.filter(
        (o) => o.orderStatus !== "cancelled",
      ).length;
      const acceptanceRate =
        allOrders.length > 0
          ? Math.round((accepted / allOrders.length) * 100)
          : 0;

      return { totalSales, totalOrders, avgPrepTime, acceptanceRate };
    };

    const calcChange = (today, yesterday) => {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    const todayStats = calcStats(todayOrders, todayAllOrders);
    const yesterdayStats = calcStats(yesterdayOrders, yesterdayAllOrders);

    // ── مبيعات بالساعات ───────────────────────────────────────
    const salesByHour = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      sales: 0,
      orders: 0,
    }));
    todayOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      salesByHour[h].sales += o.itemsPrice;
      salesByHour[h].orders += 1;
    });
    salesByHour.forEach((h) => {
      h.sales = parseFloat(h.sales.toFixed(2));
    });

    // ── Order Types (delivery / pickup / dine_in) ─────────────
    // ── Order Status Distribution ─────────────────────────────
    const statusList = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
      "on_the_way",
      "delivered_by_driver",
      "delivered",
      "cancelled",
    ];
    const statusCounts = {};
    statusList.forEach((s) => {
      statusCounts[s] = 0;
    });
    todayAllOrders.forEach((o) => {
      if (statusCounts[o.orderStatus] !== undefined)
        statusCounts[o.orderStatus]++;
    });
    const totalStatuses = Object.values(statusCounts).reduce(
      (a, b) => a + b,
      0,
    );
    const orderTypes = statusList.map((s) => ({
      type: s,
      count: statusCounts[s],
      percentage:
        totalStatuses > 0
          ? Math.round((statusCounts[s] / totalStatuses) * 100)
          : 0,
    }));

    // ── Top & Bottom Selling ──────────────────────────────────
    const itemMap = {};
    todayOrders.forEach((o) => {
      o.items.forEach((item) => {
        const key = `${item.foodId?.toString() || item.name}_${item.size?.name || "default"}`;
        if (!itemMap[key]) {
          itemMap[key] = {
            foodId: item.foodId,
            name: item.size?.name
              ? `${item.name} (${item.size.name})`
              : item.name,
            image: item.image || null,
            quantity: 0,
            revenue: 0,
          };
        }
        itemMap[key].quantity += item.quantity;
        itemMap[key].revenue += item.totalPrice;
      });
    });
    const allItems = Object.values(itemMap).sort(
      (a, b) => b.quantity - a.quantity,
    );
    const topSelling = allItems.slice(0, 10);
    const bottomSelling = allItems.slice(-10).reverse();

    // ── Recent Orders (منسّقة للفرونت) ───────────────────────
    const formatTimeAgo = (date) => {
      const diff = Math.floor((Date.now() - new Date(date)) / 60000);
      if (diff < 1) return "Just now";
      if (diff < 60) return `${diff} min ago`;
      const h = Math.floor(diff / 60);
      return `${h} hr ago`;
    };

    const recentOrdersFormatted = recentOrders.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      timeAgo: formatTimeAgo(o.createdAt),
      orderType: o.orderType || "delivery",
      itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
      driverName: o.driverId?.name || null,
      customerName: o.userId?.name || "Unknown",
      orderStatus: o.orderStatus,
      totalPrice: o.totalPrice,
    }));

    // ── Response ──────────────────────────────────────────────
    res.status(200).json({
      success: true,
      summary: {
        dailySales: {
          value: todayStats.totalSales,
          change: calcChange(todayStats.totalSales, yesterdayStats.totalSales),
        },
        dailyOrders: {
          value: todayStats.totalOrders,
          change: calcChange(
            todayStats.totalOrders,
            yesterdayStats.totalOrders,
          ),
        },
        avgPrepTime: {
          value: Math.round(todayStats.avgPrepTime),
          change: calcChange(
            todayStats.avgPrepTime,
            yesterdayStats.avgPrepTime,
          ),
        },
        acceptanceRate: {
          value: todayStats.acceptanceRate,
          change: calcChange(
            todayStats.acceptanceRate,
            yesterdayStats.acceptanceRate,
          ),
        },
      },
      charts: {
        salesByHour,
        orderTypes,
        topSelling,
        bottomSelling,
      },
      recentOrders: recentOrdersFormatted,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
const SETTLEMENT_DAYS = 2;

const syncSettlementStatuses = async (restaurantId) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SETTLEMENT_DAYS);

  // الأوردرات الملغية → not_applicable دائماً بدون استثناء
  await Order.updateMany(
    {
      restaurantId,
      orderStatus: "cancelled",
      settlementStatus: { $ne: "not_applicable" },
    },
    { $set: { settlementStatus: "not_applicable" } },
  );

  // أوردر delivered قديم (تجاوز الـ cutoff) → available
  await Order.updateMany(
    {
      restaurantId,
      orderStatus: "delivered",
      $or: [
        { settlementStatus: { $in: ["not_applicable", "pending_settlement"] } },
        { settlementStatus: { $exists: false } },
        { settlementStatus: null },
      ],
      createdAt: { $lte: cutoff },
    },
    { $set: { settlementStatus: "available" } },
  );

  // أوردر delivered جديد (لسه في فترة الانتظار) → pending_settlement
  await Order.updateMany(
    {
      restaurantId,
      orderStatus: "delivered",
      $or: [
        { settlementStatus: "not_applicable" },
        { settlementStatus: { $exists: false } },
        { settlementStatus: null },
      ],
      createdAt: { $gt: cutoff },
    },
    { $set: { settlementStatus: "pending_settlement" } },
  );
};
exports.getFinancialOverview = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    const restaurant = await Restaurant.findById(restaurantId).select(
      "commission currency",
    );
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    const commissionRate = restaurant.commission / 100;
    const currency = restaurant.currency || "SYP";
    const round = (n) => Math.round(n * 100) / 100;

    // sync أولاً
    await syncSettlementStatuses(restaurantId);

    // جلب الأوردرات حسب settlementStatus
    const [
      pendingSettlementOrders,
      availableOrders,
      withdrawalPendingOrders,
      withdrawnOrders,
      cancelledOrders,
    ] = await Promise.all([
      Order.find({
        restaurantId,
        settlementStatus: "pending_settlement",
      }).select("itemsPrice"),
      Order.find({ restaurantId, settlementStatus: "available" }).select(
        "itemsPrice",
      ),
      Order.find({
        restaurantId,
        settlementStatus: "withdrawal_pending",
      }).select("itemsPrice"),
      Order.find({ restaurantId, settlementStatus: "withdrawn" }).select(
        "itemsPrice",
      ),
      Order.find({ restaurantId, orderStatus: "cancelled" }).select(
        "itemsPrice",
      ),
    ]);

    const calcNet = (orders) =>
      orders.reduce((s, o) => s + o.itemsPrice * (1 - commissionRate), 0);
    const calcRev = (orders) => orders.reduce((s, o) => s + o.itemsPrice, 0);

    const totalRevenue = calcRev([
      ...pendingSettlementOrders,
      ...availableOrders,
      ...withdrawalPendingOrders,
      ...withdrawnOrders,
    ]);
    const totalCommission = totalRevenue * commissionRate;
    const netProfit = totalRevenue - totalCommission;

    // طلب السحب المعلق الحالي
    const pendingRequest = await Settlement.findOne({
      restaurantId,
      status: "pending",
    }).select("_id amount createdAt");

    res.status(200).json({
      success: true,
      currency,
      commissionRate: restaurant.commission,
      settlementDays: SETTLEMENT_DAYS,
      overview: {
        totalRevenue: round(totalRevenue),
        totalCommission: round(totalCommission),
        netProfit: round(netProfit),
        pendingSettlementNet: round(calcNet(pendingSettlementOrders)),
        availableNet: round(calcNet(availableOrders)),
        withdrawalPendingNet: round(calcNet(withdrawalPendingOrders)),
        withdrawnNet: round(calcNet(withdrawnOrders)),
        cancelledLoss: round(calcRev(cancelledOrders)),
      },
      counts: {
        pendingSettlementOrders: pendingSettlementOrders.length,
        availableOrders: availableOrders.length,
        withdrawalPendingOrders: withdrawalPendingOrders.length,
        withdrawnOrders: withdrawnOrders.length,
        cancelledOrders: cancelledOrders.length,
        deliveredOrders:
          pendingSettlementOrders.length +
          availableOrders.length +
          withdrawalPendingOrders.length +
          withdrawnOrders.length,
      },
      pendingWithdrawalRequest: pendingRequest
        ? {
            _id: pendingRequest._id,
            amount: pendingRequest.amount,
            createdAt: pendingRequest.createdAt,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.requestSettlement = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { note } = req.body; // لا يوجد amount — يُحسب تلقائياً

    const restaurant = await Restaurant.findById(restaurantId).select(
      "commission currency",
    );
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    const commissionRate = restaurant.commission / 100;
    const round = (n) => Math.round(n * 100) / 100;

    // sync
    await syncSettlementStatuses(restaurantId);

    // التحقق من وجود طلب pending مسبق
    const existingPending = await Settlement.findOne({
      restaurantId,
      status: "pending",
    });
    if (existingPending) {
      return res.status(400).json({
        message:
          "You already have a pending withdrawal request. Please wait for admin approval.",
      });
    }

    // الأوردرات المتاحة للسحب
    const availableOrders = await Order.find({
      restaurantId,
      settlementStatus: "available",
    }).select("itemsPrice _id");

    if (availableOrders.length === 0) {
      return res
        .status(400)
        .json({ message: "No available balance to withdraw." });
    }

    // المبلغ = كامل الأرباح المتاحة
    const totalAmount = round(
      availableOrders.reduce(
        (s, o) => s + o.itemsPrice * (1 - commissionRate),
        0,
      ),
    );

    // إنشاء طلب السحب
    let settlement;
    try {
      settlement = await Settlement.create({
        restaurantId,
        amount: totalAmount,
        note: note || null,
      });
    } catch (createErr) {
      // duplicate key — طلب pending وصل في نفس اللحظة من طلب آخر
      if (createErr.code === 11000) {
        return res.status(400).json({
          message:
            "You already have a pending withdrawal request. Please wait for admin approval.",
        });
      }
      throw createErr;
    }

    // تحديث الأوردرات → withdrawal_pending
    await Order.updateMany(
      { _id: { $in: availableOrders.map((o) => o._id) } },
      {
        $set: {
          settlementStatus: "withdrawal_pending",
          settlementId: settlement._id,
        },
      },
    );

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      settlement,
      ordersUpdated: availableOrders.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.getMySettlements = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [settlements, total] = await Promise.all([
      Settlement.find({ restaurantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Settlement.countDocuments({ restaurantId }),
    ]);

    res.status(200).json({
      success: true,
      settlements,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.getSalesReports = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const period = req.query.period || "week"; // week | month | year

    // ── جلب بيانات المطعم ────────────────────────────────────
    const restaurant = await Restaurant.findById(restaurantId).select(
      "commission currency",
    );
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    const commissionRate = restaurant.commission / 100;
    const currency = restaurant.currency || "SYP";
    const round = (n) => Math.round(n * 100) / 100;

    // ── نطاقات الوقت ─────────────────────────────────────────
    const now = new Date();

    const getRanges = (period) => {
      const currentStart = new Date(now);
      const currentEnd = new Date(now);
      const prevStart = new Date(now);
      const prevEnd = new Date(now);

      if (period === "week") {
        // الأسبوع الحالي: آخر 7 أيام
        currentStart.setDate(now.getDate() - 6);
        currentStart.setHours(0, 0, 0, 0);
        currentEnd.setHours(23, 59, 59, 999);
        // الأسبوع السابق
        prevStart.setDate(now.getDate() - 13);
        prevStart.setHours(0, 0, 0, 0);
        prevEnd.setDate(now.getDate() - 7);
        prevEnd.setHours(23, 59, 59, 999);
      } else if (period === "month") {
        // الشهر الحالي
        currentStart.setDate(1);
        currentStart.setHours(0, 0, 0, 0);
        currentEnd.setHours(23, 59, 59, 999);
        // الشهر السابق
        prevStart.setMonth(now.getMonth() - 1, 1);
        prevStart.setHours(0, 0, 0, 0);
        prevEnd.setMonth(now.getMonth(), 0);
        prevEnd.setHours(23, 59, 59, 999);
      } else {
        // السنة الحالية
        currentStart.setMonth(0, 1);
        currentStart.setHours(0, 0, 0, 0);
        currentEnd.setHours(23, 59, 59, 999);
        // السنة السابقة
        prevStart.setFullYear(now.getFullYear() - 1, 0, 1);
        prevStart.setHours(0, 0, 0, 0);
        prevEnd.setFullYear(now.getFullYear() - 1, 11, 31);
        prevEnd.setHours(23, 59, 59, 999);
      }

      return { currentStart, currentEnd, prevStart, prevEnd };
    };

    const { currentStart, currentEnd, prevStart, prevEnd } = getRanges(period);

    // ── جلب الأوردرات ─────────────────────────────────────────
    const validStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
      "on_the_way",
      "delivered",
    ];

    const [currentOrders, prevOrders, allPeriodOrders] = await Promise.all([
      // أوردرات الفترة الحالية (المكتملة فقط للحسابات المالية)
      Order.find({
        restaurantId,
        orderStatus: "delivered",
        createdAt: { $gte: currentStart, $lte: currentEnd },
      }).select("itemsPrice createdAt"),

      // أوردرات الفترة السابقة (للمقارنة)
      Order.find({
        restaurantId,
        orderStatus: "delivered",
        createdAt: { $gte: prevStart, $lte: prevEnd },
      }).select("itemsPrice createdAt"),

      // كل أوردرات الفترة الحالية (لتوزيع الحالات والرسوم)
      Order.find({
        restaurantId,
        orderStatus: { $ne: "not_confirmed" },
        createdAt: { $gte: currentStart, $lte: currentEnd },
      }).select("orderStatus itemsPrice items createdAt"),
    ]);

    // ── helper: حساب إجماليات ─────────────────────────────────
    const calcSummary = (orders) => {
      const totalRevenue = orders.reduce((s, o) => s + o.itemsPrice, 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const netProfit = totalRevenue * (1 - commissionRate);
      return { totalRevenue, totalOrders, avgOrderValue, netProfit };
    };

    const calcChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const curr = calcSummary(currentOrders);
    const prev = calcSummary(prevOrders);

    // ── Summary Cards ─────────────────────────────────────────
    const summary = {
      totalRevenue: {
        value: round(curr.totalRevenue),
        change: calcChange(curr.totalRevenue, prev.totalRevenue),
      },
      totalOrders: {
        value: curr.totalOrders,
        change: calcChange(curr.totalOrders, prev.totalOrders),
      },
      avgOrderValue: {
        value: round(curr.avgOrderValue),
        change: calcChange(curr.avgOrderValue, prev.avgOrderValue),
      },
      netProfit: {
        value: round(curr.netProfit),
        change: calcChange(curr.netProfit, prev.netProfit),
      },
    };

    // ── Sales & Orders Chart ──────────────────────────────────
    const buildSalesChart = () => {
      if (period === "week") {
        // 7 أيام
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(currentStart);
          d.setDate(d.getDate() + i);
          return {
            label: d.toLocaleDateString("en-US", { weekday: "short" }),
            date: d.toDateString(),
            revenue: 0,
            orders: 0,
          };
        });
        currentOrders.forEach((o) => {
          const key = new Date(o.createdAt).toDateString();
          const slot = days.find((d) => d.date === key);
          if (slot) {
            slot.revenue += o.itemsPrice;
            slot.orders += 1;
          }
        });
        return days.map(({ label, revenue, orders }) => ({
          label,
          revenue: round(revenue),
          orders,
        }));
      } else if (period === "month") {
        // أيام الشهر الحالي
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
        ).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => ({
          label: String(i + 1),
          day: i + 1,
          revenue: 0,
          orders: 0,
        }));
        currentOrders.forEach((o) => {
          const day = new Date(o.createdAt).getDate();
          days[day - 1].revenue += o.itemsPrice;
          days[day - 1].orders += 1;
        });
        return days.map(({ label, revenue, orders }) => ({
          label,
          revenue: round(revenue),
          orders,
        }));
      } else {
        // 12 شهر
        const months = Array.from({ length: 12 }, (_, i) => ({
          label: new Date(now.getFullYear(), i, 1).toLocaleDateString("en-US", {
            month: "short",
          }),
          month: i,
          revenue: 0,
          orders: 0,
        }));
        currentOrders.forEach((o) => {
          const m = new Date(o.createdAt).getMonth();
          months[m].revenue += o.itemsPrice;
          months[m].orders += 1;
        });
        return months.map(({ label, revenue, orders }) => ({
          label,
          revenue: round(revenue),
          orders,
        }));
      }
    };

    // ── Orders by Hour Chart ──────────────────────────────────
    const hourMap = Array.from({ length: 24 }, (_, h) => ({
      label: `${String(h).padStart(2, "0")}:00`,
      orders: 0,
    }));
    currentOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      hourMap[h].orders += 1;
    });

    // ── Order Statuses Distribution ───────────────────────────
    const statusList = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
      "on_the_way",
      "delivered_by_driver",
      "delivered",
      "cancelled",
    ];
    const statusMap = {};
    statusList.forEach((s) => (statusMap[s] = 0));
    allPeriodOrders.forEach((o) => {
      if (statusMap[o.orderStatus] !== undefined) statusMap[o.orderStatus]++;
    });
    const totalStatusCount = Object.values(statusMap).reduce(
      (a, b) => a + b,
      0,
    );
    const orderStatuses = statusList
      .map((s) => ({
        status: s,
        count: statusMap[s],
        percentage:
          totalStatusCount > 0
            ? Math.round((statusMap[s] / totalStatusCount) * 100)
            : 0,
      }))
      .filter((s) => s.count > 0);

    // ── Top Selling Items ─────────────────────────────────────
    const itemMap = {};

    // نجيب أوردرات delivered مع items كاملة
    const deliveredWithItems = await Order.find({
      restaurantId,
      orderStatus: "delivered",
      createdAt: { $gte: currentStart, $lte: currentEnd },
    }).select("items itemsPrice");

    deliveredWithItems.forEach((o) => {
      o.items.forEach((item) => {
        const key = `${item.foodId?.toString() || item.name}_${item.size?.name || "default"}`;
        if (!itemMap[key]) {
          itemMap[key] = {
            name: item.size?.name
              ? `${item.name} (${item.size.name})`
              : item.name,
            image: item.image || null,
            quantity: 0,
            revenue: 0,
          };
        }
        itemMap[key].quantity += item.quantity;
        itemMap[key].revenue += item.totalPrice;
      });
    });

    const topSellingItems = Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((item) => ({ ...item, revenue: round(item.revenue) }));

    // ── Response ──────────────────────────────────────────────
    res.status(200).json({
      success: true,
      period,
      currency,
      commissionRate: restaurant.commission,
      summary,
      charts: {
        salesAndOrders: buildSalesChart(),
        ordersByHour: hourMap,
        orderStatuses,
        topSellingItems,
      },
      netProfitTotal: round(curr.netProfit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.deleteAllOrders = async (req, res) => {
  try {
    const result = await Order.deleteMany({
      restaurantId: req.user.restaurantId,
    });
    res
      .status(200)
      .json({ message: "All orders deleted", count: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await RestaurantUser.findById(
      req.user._id ?? req.user.id,
    ).select("name email phone role img");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;
    const { name } = req.body;

    const updateData = {};
    if (name && name.trim()) updateData.name = name.trim();

    // رفع الصورة لـ Cloudinary إذا وجدت
    if (req.file) {
      const uploaded = await uploadBuffer(req.file.buffer, "restaurant-users");
      updateData.img = {
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      };
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const user = await RestaurantUser.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true },
    ).select("name email phone role img");

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
