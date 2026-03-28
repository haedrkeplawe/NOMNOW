const Restaurant = require("../models/restaurant");
const RestaurantUser = require("../models/restaurantUser");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Ads = require("../models/ads");
const uploadBuffer = require("../utils/cloudUpload");
const cloudinary = require("../config/cloudinary");
const Driver = require("../models/Driver");
const Food = require("../models/food");
const Order = require("../models/Order");
const Settlement = require("../models/Settlement");

exports.createRestaurant = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      restaurantname,
      address,
      location,
      commission,
      country,
    } = req.body;

    // تحقق من الحقول المطلوبة
    if (
      !name ||
      !email ||
      !phone ||
      !password ||
      !restaurantname ||
      !address ||
      !location ||
      !location.coordinates?.length ||
      !commission
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (commission < 0 || commission > 100) {
      return res
        .status(400)
        .json({ message: "Commission must be in range 0 to 100" });
    }
    // التحقق من رقم الهاتف حسب الدولة
    if (country === "DE") {
      const dePhoneRegex = /^\+49[1-9][0-9]{9,13}$/;
      if (!dePhoneRegex.test(phone)) {
        return res.status(400).json({
          message: "Invalid German phone number. Must start with +49",
        });
      }
    } else if (country === "SY") {
      const syPhoneRegex = /^\+963[9][0-9]{8}$/;
      if (!syPhoneRegex.test(phone)) {
        return res.status(400).json({
          message: "Invalid Syrian phone number. Must start with +963",
        });
      }
    }

    // تحقق من وجود البريد أو الهاتف
    const existEmail = await RestaurantUser.findOne({ email });
    const existPhone = await RestaurantUser.findOne({ phone });

    if (existEmail)
      return res.status(400).json({ message: "Email already used" });
    if (existPhone)
      return res.status(400).json({ message: "Phone already used" });

    // إنشاء صاحب المطعم
    const hashedPassword = await bcrypt.hash(password, 10);
    const restaurantUser = await RestaurantUser.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "owner",
    });

    // إنشاء المطعم وربطه بالمالك
    const restaurant = await Restaurant.create({
      name: restaurantname,
      owner: restaurantUser._id,
      email,
      phone,
      address,
      location,
      paymentMethods:
        country === "DE"
          ? ["visa", "mastercard", "paypal", "apple_pay"]
          : ["cash"],
      commission: commission || 15,
      status: "closed",
      // ← أضف هذا
      country: country || "SY",
      currency: country === "DE" ? "EUR" : "SYP",
      taxRate: country === "DE" ? 19 : 0,
    });

    // ربط المطعم بالمالك
    restaurantUser.restaurantId = restaurant._id;
    await restaurantUser.save();

    res.status(201).json({
      message: "Restaurant and owner created successfully",
      restaurant,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.updateResturant = async (req, res) => {
  try {
    const { restaurantId, commission } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "restaurant not found" });
    }

    if (commission < 0 || commission > 100) {
      return res
        .status(400)
        .json({ message: "Commission must be in range 0 to 100" });
    }
    restaurant.commission = commission || restaurant.commission;
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
exports.getAllRestaurants = async (req, res) => {
  try {
    const filter = {};
    if (req.query.country) filter.country = req.query.country;

    const restaurants = await Restaurant.find(filter)
      .populate("owner")
      .sort({ createdAt: -1 });

    const restaurantIds = restaurants.map((r) => r._id);

    const orderCounts = await Order.aggregate([
      {
        $match: {
          restaurantId: { $in: restaurantIds },
          orderStatus: {
            $in: [
              "pending",
              "accepted",
              "preparing",
              "ready",
              "picked_up",
              "on_the_way",
              "delivered",
            ],
          },
        },
      },
      { $group: { _id: "$restaurantId", totalOrders: { $sum: 1 } } },
    ]);

    const ordersMap = {};
    orderCounts.forEach((item) => {
      ordersMap[item._id.toString()] = item.totalOrders;
    });

    const restaurantsWithStats = restaurants.map((r) => ({
      ...r.toObject(),
      totalOrders: ordersMap[r._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      restaurants: restaurantsWithStats,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch restaurants" });
  }
};
exports.blockRestaurant = async (req, res) => {
  try {
    const { restaurantId, reasonForBlock } = req.body;
    if (!restaurantId || !reasonForBlock) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    restaurant.status = "blocked";
    restaurant.reasonForBlock = reasonForBlock;
    await restaurant.save();
    res
      .status(200)
      .json({ message: "Restaurant blocked successfully", restaurant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.unblockRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.body;
    if (!restaurantId) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (restaurant.status !== "blocked") {
      return res
        .status(400)
        .json({ message: "Restaurant is already unblocked" });
    }

    restaurant.status = "closed";
    restaurant.reasonForBlock = "";

    await restaurant.save();

    res
      .status(200)
      .json({ message: "Restaurant unblocked successfully", restaurant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.getRestaurantStats = async (req, res) => {
  try {
    const { id } = req.params;

    const validStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
      "on_the_way",
      "delivered",
    ];

    const [orders, foodCount, restaurant] = await Promise.all([
      Order.find({
        restaurantId: id,
        orderStatus: { $in: validStatuses },
      }),
      Food.countDocuments({ restaurantId: id }),
      Restaurant.findById(id).select("rating commission currency"),
    ]);

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // إجمالي الطلبات والمبيعات
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.orderStatus === "delivered")
      .reduce((sum, o) => sum + o.itemsPrice, 0);

    const commission = (totalRevenue * restaurant.commission) / 100;

    // متوسط وقت التحضير
    const prepTimes = orders
      .filter(
        (o) => o.orderStatus === "delivered" && o.updatedAt && o.createdAt,
      )
      .map((o) => (new Date(o.updatedAt) - new Date(o.createdAt)) / 60000);

    const avgPrepTime =
      prepTimes.length > 0
        ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
        : 0;

    // طلبات هاليوم
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(
      (o) => new Date(o.createdAt) >= todayStart,
    ).length;

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        commission: Number(commission.toFixed(2)),
        avgPrepTime,
        todayOrders,
        foodCount,
        rating: restaurant.rating,
        currency: restaurant.currency,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// food
exports.getAllFoodInRestaurant = async (req, res) => {
  try {
    const foods = await Food.find({ restaurantId: req.params.id }).populate(
      "categoryId",
    );
    res.status(200).json({ foods });
  } catch (err) {
    console.log(err);
  }
};

// ads
exports.getAds = async (req, res) => {
  try {
    const ads = await Ads.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      ads,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.message,
    });
  }
};
exports.createAd = async (req, res) => {
  try {
    const { title, adtype, target, startDate, endDate, priority } = req.body;

    // ✅ تحقق الحقول المطلوبة
    if (!title || !adtype || !target || !startDate || !endDate || !priority) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // ✅ تحقق التاريخ
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        message: "Start date must be before end date",
      });
    }

    // ✅ تحقق priority
    if (Number(priority) < 1 || Number(priority) > 10) {
      return res.status(400).json({
        message: "Priority must be between 1 and 10",
      });
    }

    const adData = new Ads({
      title: title,
      adtype: adtype,
      target,
      startDate,
      endDate,
      priority: Number(priority),
    });

    // ✅ رفع الصورة (اختياري)
    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, "ads");
      adData.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    await adData.save();

    res.status(201).json({
      message: "Ad campaign created successfully",
      ad: adData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};
exports.updateAd = async (req, res) => {
  try {
    const { adId, title, adtype, target, startDate, endDate, priority } =
      req.body;

    if (!adId) {
      return res.status(400).json({ message: "Missing ad ID" });
    }

    const ad = await Ads.findById(adId);
    if (!ad) {
      return res.status(404).json({ message: "Ad not found" });
    }

    // ✅ تحقق الحقول المطلوبة
    if (!title || !adtype || !target || !startDate || !endDate || !priority) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // ✅ تحقق التاريخ
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        message: "Start date must be before end date",
      });
    }

    // ✅ تحقق priority
    if (Number(priority) < 1 || Number(priority) > 10) {
      return res.status(400).json({
        message: "Priority must be between 1 and 10",
      });
    }

    // تحديث الحقول
    ad.title = title.trim();
    ad.adtype = adtype.trim();
    ad.target = target;
    ad.startDate = startDate;
    ad.endDate = endDate;
    ad.priority = Number(priority);

    if (req.file) {
      // حذف الصورة القديمة
      if (ad.image?.public_id) {
        await cloudinary.uploader.destroy(ad.image.public_id);
      }

      // رفع الصورة الجديدة
      const result = await uploadBuffer(req.file.buffer, "ads");
      ad.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    await ad.save();

    res.status(200).json({
      message: "Ad campaign updated successfully",
      ad,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.deleteAd = async (req, res) => {
  try {
    const { adId } = req.body;

    if (!adId) {
      return res.status(400).json({ message: "Missing ad ID" });
    }

    const ad = await Ads.findById(adId);
    if (!ad) {
      return res.status(404).json({ message: "Ad not found" });
    }

    // حذف الصورة من السيرفر / السحابة إذا موجودة
    if (ad.image?.public_id) {
      await cloudinary.uploader.destroy(ad.image.public_id);
    }

    await ad.deleteOne();

    res.status(200).json({ message: "Ad deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Customer
exports.getAllCustomer = async (req, res) => {
  try {
    const filter = {};
    if (req.query.country) filter.country = req.query.country;

    const customers = await User.find(filter)
      .select("-password -emailOtp -phoneOtp -resetPasswordToken")
      .sort({ createdAt: -1 });

    const userIds = customers.map((u) => u._id);

    // ── aggregate: طلبات وإنفاق لكل زبون دفعة وحدة ───────────
    const orderStats = await Order.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          orderStatus: "delivered",
        },
      },
      {
        $group: {
          _id: "$userId",
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totalPrice" },
          lastOrderAt: { $max: "$createdAt" },
        },
      },
    ]);

    const statsMap = {};
    orderStats.forEach((s) => {
      statsMap[s._id.toString()] = {
        totalOrders: s.totalOrders,
        totalSpent: Math.round(s.totalSpent * 100) / 100,
        lastOrderAt: s.lastOrderAt,
      };
    });

    // ── Summary ───────────────────────────────────────────────
    const totalUsers = await User.countDocuments(filter);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const usersLast7Days = await User.countDocuments({
      ...filter,
      createdAt: { $gte: last7Days },
    });

    // active this month = أول طلب delivered لهم خلال آخر 30 يوم
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const activeThisMonth = await Order.distinct("userId", {
      orderStatus: "delivered",
      createdAt: { $gte: last30Days },
      ...(userIds.length ? { userId: { $in: userIds } } : {}),
    });

    // متوسط قيمة الطلب
    const allDelivered = await Order.aggregate([
      {
        $match: {
          orderStatus: "delivered",
          ...(userIds.length ? { userId: { $in: userIds } } : {}),
        },
      },
      { $group: { _id: null, avg: { $avg: "$totalPrice" } } },
    ]);
    const avgOrderValue = allDelivered[0]
      ? Math.round(allDelivered[0].avg * 100) / 100
      : 0;

    // ── إضافة الإحصائيات لكل زبون ────────────────────────────
    const customersWithStats = customers.map((u) => {
      const s = statsMap[u._id.toString()] || {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
      };
      return { ...u.toObject(), ...s };
    });

    res.status(200).json({
      success: true,
      summary: {
        totalUsers,
        usersThisWeek: usersLast7Days,
        activeThisMonth: activeThisMonth.length,
        avgOrderValue,
      },
      customer: customersWithStats,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
exports.getCustomerStats = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "Customer not found" });

    const deliveredOrders = await Order.find({
      userId: id,
      orderStatus: "delivered",
    })
      .sort({ createdAt: -1 })
      .select("totalPrice createdAt restaurantId")
      .populate("restaurantId", "name");

    const totalOrders = deliveredOrders.length;
    const totalSpent =
      Math.round(
        deliveredOrders.reduce((s, o) => s + (o.totalPrice || 0), 0) * 100,
      ) / 100;
    const lastOrder = deliveredOrders[0] || null;

    // أكثر مطعم طلب منه
    const restaurantCount = {};
    deliveredOrders.forEach((o) => {
      const name = o.restaurantId?.name || "Unknown";
      restaurantCount[name] = (restaurantCount[name] || 0) + 1;
    });
    const favoriteRestaurant =
      Object.entries(restaurantCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      null;

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        totalSpent,
        lastOrderAt: lastOrder?.createdAt || null,
        lastOrderRestaurant: lastOrder?.restaurantId?.name || null,
        favoriteRestaurant,
        currency: user.country === "DE" ? "EUR" : "SYP",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.blockCustomer = async (req, res) => {
  try {
    const { userId, reasonForBlock } = req.body;

    if (!userId || !reasonForBlock) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.status === "blocked") {
      return res.status(400).json({ message: "User is already blocked" });
    }

    user.status = "blocked";
    user.reasonForBlock = reasonForBlock;
    await user.save();
    res.status(200).json({ message: "User blocked successfully", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.unblockCustomer = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status !== "blocked") {
      return res.status(400).json({ message: "User is already unblocked" });
    }

    user.status = "active";
    user.reasonForBlock = "";
    await user.save();

    res.status(200).json({ message: "User unblocked successfully", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Driver
exports.createDriver = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      vehicletype,
      vehicleplate,
      password,
      zone,
      country,
    } = req.body;

    // ✅ تحقق من الحقول المطلوبة
    if (
      !name ||
      !email ||
      !phone ||
      !vehicletype ||
      !vehicleplate ||
      !password ||
      !zone
    ) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    if (country === "DE") {
      const dePhoneRegex = /^\+49[1-9][0-9]{9,13}$/;
      if (!dePhoneRegex.test(phone)) {
        return res.status(400).json({ message: "Invalid German phone number" });
      }
    } else {
      const syPhoneRegex = /^\+963[9][0-9]{8}$/;
      if (!syPhoneRegex.test(phone)) {
        return res.status(400).json({ message: "Invalid Syrian phone number" });
      }
    }

    if (!["Bicycle", "Motorcycle", "Car"].includes(vehicletype)) {
      return res.status(400).json({
        message: "Invalid vehicle type",
      });
    }

    // ✅ تحقق هل الإيميل أو الهاتف مستخدم
    const exists = await Driver.findOne({
      $or: [{ email }, { phone }],
    });

    if (exists) {
      return res.status(400).json({
        message: "Email or phone already exists",
      });
    }

    // ✅ تشفير كلمة السر
    const hashedPassword = await bcrypt.hash(password, 12);

    const driver = new Driver({
      name,
      email,
      phone,
      vehicletype,
      vehicleplate,
      zone,
      password: hashedPassword,
      country: country || "SY",
      documents: [],
    });

    // ✅ رفع الصور (اختياري لكن غالبًا مطلوبة)
    if (req.files?.idImage) {
      const result = await uploadBuffer(req.files.idImage[0].buffer, "drivers");

      driver.documents.push({
        type: "id", // 🔥 ملاحظة: نوع المستند
        image: {
          url: result.secure_url,
          public_id: result.public_id,
        },
      });
    }

    if (req.files?.drivingLicenseImage) {
      const result = await uploadBuffer(
        req.files.drivingLicenseImage[0].buffer,
        "drivers",
      );

      driver.documents.push({
        type: "driving_license", // 🔥 ملاحظة: نوع المستند
        image: {
          url: result.secure_url,
          public_id: result.public_id,
        },
      });
    }

    if (req.files?.vehicleRegistrationImage) {
      const result = await uploadBuffer(
        req.files.vehicleRegistrationImage[0].buffer,
        "drivers",
      );

      driver.documents.push({
        type: "vehicle_registration", // 🔥 ملاحظة: نوع المستند
        image: {
          url: result.secure_url,
          public_id: result.public_id,
        },
      });
    }

    await driver.save();

    res.status(201).json({
      message: "Driver created successfully",
      driver,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};
exports.getAllDrivers = async (req, res) => {
  try {
    const driverFilter = {};
    if (req.query.country) driverFilter.country = req.query.country;

    const drivers = await Driver.find(driverFilter)
      .select("-password -emailOtp -phoneOtp -resetPasswordToken")
      .sort({ createdAt: -1 });

    const driverIds = drivers.map((d) => d._id);

    const orderStats = await Order.aggregate([
      { $match: { driverId: { $in: driverIds }, orderStatus: "delivered" } },
      {
        $group: {
          _id: "$driverId",
          totalOrders: { $sum: 1 },
          totalEarnings: { $sum: "$totalPrice" },
        },
      },
    ]);

    const statsMap = {};
    orderStats.forEach((s) => {
      statsMap[s._id.toString()] = {
        totalOrders: s.totalOrders,
        totalEarnings: Math.round(s.totalEarnings * 100) / 100,
      };
    });

    const activeNow = drivers.filter(
      (d) => d.status === "approved" && d.availability !== "offline",
    ).length;
    const onDelivery = drivers.filter(
      (d) => d.status === "approved" && d.availability === "busy",
    ).length;
    const ratedDrivers = drivers.filter((d) => d.rating > 0);
    const averageRating =
      ratedDrivers.length > 0
        ? Number(
            (
              ratedDrivers.reduce((s, d) => s + d.rating, 0) /
              ratedDrivers.length
            ).toFixed(1),
          )
        : 0;

    const driversWithStats = drivers.map((d) => {
      const s = statsMap[d._id.toString()] || {
        totalOrders: 0,
        totalEarnings: 0,
      };
      const ratings = d.userRatings || [];
      const computedRating =
        ratings.length > 0
          ? Number(
              (
                ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
              ).toFixed(1),
            )
          : d.rating || 0;
      return {
        ...d.toObject(),
        totalOrders: s.totalOrders,
        totalEarnings: s.totalEarnings,
        rating: computedRating,
      };
    });

    res.status(200).json({
      success: true,
      summary: { total: drivers.length, activeNow, onDelivery, averageRating },
      drivers: driversWithStats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.updateDriverDocumentStatus = async (req, res) => {
  try {
    const { driverId, documentId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status value",
      });
    }

    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    const document = driver.documents.id(documentId);

    if (!document) {
      return res.status(404).json({
        message: "Document not found",
      });
    }

    // تحديث الحالة
    document.status = status;
    document.verifiedAt = new Date();

    if (status === "rejected") {
      document.rejectionReason = rejectionReason || "No reason provided";
      driver.status = "pending";
    } else {
      document.rejectionReason = undefined;
    }

    // 🔥 تحقق هل كل المستندات Approved
    const allApproved = driver.documents.every(
      (doc) => doc.status === "approved",
    );

    driver.isDocumentsVerified = allApproved;
    await driver.save();

    res.json({
      message: "Document status updated successfully",
      driver,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.approveDriver = async (req, res) => {
  try {
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: "Driver ID is required" });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (driver.status === "approved") {
      return res.status(400).json({
        message: "Driver is already approved",
      });
    }

    // 🔥 تحقق أن كل المستندات موجودة
    if (driver.documents.length < 3) {
      return res.status(400).json({
        message: "Driver documents are incomplete",
      });
    }

    // 🔥 تحقق أن كل المستندات Approved
    const allApproved = driver.documents.every(
      (doc) => doc.status === "approved",
    );

    if (!allApproved) {
      return res.status(400).json({
        message: "All documents must be approved first",
      });
    }

    driver.status = "approved";
    driver.reasonForSuspension = undefined;
    await driver.save();

    res.status(200).json({
      message: "Driver approved successfully",
      driver,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.blockedDriver = async (req, res) => {
  try {
    const { driverId, reasonForSuspension } = req.body;

    if (!driverId || !reasonForSuspension) {
      return res.status(400).json({ message: "forget required filed" });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (driver.status === "blocked") {
      return res.status(400).json({
        message: "Driver is already blocked",
      });
    }

    driver.status = "blocked";
    driver.reasonForSuspension = reasonForSuspension;

    await driver.save();

    res.status(200).json({
      message: "Driver blocked successfully",
      driver,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getDriverStats = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id).select(
      "-password -emailOtp -phoneOtp -resetPasswordToken",
    );
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    const deliveredOrders = await Order.find({
      driverId: id,
      orderStatus: "delivered",
    }).select("totalPrice createdAt");

    const totalOrders = deliveredOrders.length;
    const totalEarnings =
      Math.round(
        deliveredOrders.reduce((s, o) => s + (o.totalPrice || 0), 0) * 100,
      ) / 100;

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        totalEarnings,
        rating: driver.rating,
        currency: driver.country === "DE" ? "EUR" : "SYP",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  أضف هذا السطر في أعلى admin_controller.js مع باقي الـ imports
// ─────────────────────────────────────────────────────────────
// const Settlement = require("../models/Settlement");
// ─────────────────────────────────────────────────────────────
//  دوال جديدة تُضاف في admin_controller.js
// ─────────────────────────────────────────────────────────────
// جلب كل طلبات السحب (مع فلتر اختياري بالحالة)
exports.getAllSettlements = async (req, res) => {
  try {
    const { status, restaurantId, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status))
      filter.status = status;
    if (restaurantId) filter.restaurantId = restaurantId;

    // فلتر البلد عبر المطاعم — فقط لو ما في restaurantId محدد
    if (req.query.country && !restaurantId) {
      const ids = await Restaurant.find({ country: req.query.country }).select(
        "_id",
      );
      filter.restaurantId = { $in: ids.map((r) => r._id) };
    }

    const [settlements, total] = await Promise.all([
      Settlement.find(filter)
        .populate("restaurantId", "name currency commission")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Settlement.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      settlements,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// الأدمن يوافق على طلب سحب
exports.approveSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolvedBy } = req.body; // اسم الأدمن (اختياري)

    const settlement = await Settlement.findById(id);
    if (!settlement)
      return res.status(404).json({ message: "Settlement not found" });

    if (settlement.status !== "pending") {
      return res.status(400).json({
        message: `Settlement is already ${settlement.status}`,
      });
    }

    settlement.status = "approved";
    settlement.resolvedAt = new Date();
    settlement.resolvedBy = resolvedBy || "admin";
    await settlement.save();

    res.status(200).json({
      success: true,
      message: "Settlement approved successfully",
      settlement,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// الأدمن يرفض طلب سحب
exports.rejectSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason, resolvedBy } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const settlement = await Settlement.findById(id);
    if (!settlement)
      return res.status(404).json({ message: "Settlement not found" });

    if (settlement.status !== "pending") {
      return res.status(400).json({
        message: `Settlement is already ${settlement.status}`,
      });
    }

    settlement.status = "rejected";
    settlement.rejectionReason = rejectionReason;
    settlement.resolvedAt = new Date();
    settlement.resolvedBy = resolvedBy || "admin";
    await settlement.save();

    res.status(200).json({
      success: true,
      message: "Settlement rejected",
      settlement,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// ─────────────────────────────────────────────────────────────
//  أضف هذا في admin_controller.js
//  (مع الـ imports الموجودة، أضف):
//  const Settlement = require("../models/Settlement");
// ─────────────────────────────────────────────────────────────

exports.getRestaurantFinancialSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const SETTLEMENT_DAYS = 2;

    const restaurant = await Restaurant.findById(id).select(
      "commission currency",
    );
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    const commissionRate = restaurant.commission / 100;
    const round = (n) => Math.round(n * 100) / 100;

    const now = new Date();
    const settlementCutoff = new Date(now);
    settlementCutoff.setDate(settlementCutoff.getDate() - SETTLEMENT_DAYS);

    const [deliveredOrders, settlements] = await Promise.all([
      Order.find({ restaurantId: id, orderStatus: "delivered" }).select(
        "itemsPrice createdAt",
      ),
      Settlement.find({ restaurantId: id }).select("amount status"),
    ]);

    const totalRevenue = deliveredOrders.reduce((s, o) => s + o.itemsPrice, 0);
    const totalCommission = totalRevenue * commissionRate;
    const netProfit = totalRevenue - totalCommission;

    let grossAvailable = 0;
    deliveredOrders.forEach((o) => {
      if (new Date(o.createdAt) <= settlementCutoff) {
        grossAvailable += o.itemsPrice * (1 - commissionRate);
      }
    });

    let totalWithdrawn = 0;
    let pendingWithdrawal = 0;
    let pendingCount = 0;

    settlements.forEach((s) => {
      if (s.status === "approved") totalWithdrawn += s.amount;
      else if (s.status === "pending") {
        pendingWithdrawal += s.amount;
        pendingCount++;
      }
    });

    const availableToSettle = Math.max(
      0,
      round(grossAvailable - totalWithdrawn - pendingWithdrawal),
    );

    res.status(200).json({
      success: true,
      currency: restaurant.currency || "SYP",
      financial: {
        totalRevenue: round(totalRevenue),
        totalCommission: round(totalCommission),
        netProfit: round(netProfit),
        availableToSettle,
        totalWithdrawn: round(totalWithdrawn),
        pendingWithdrawal: round(pendingWithdrawal),
        pendingCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  أضف في admin_controller.js
//  تأكد إن هذه الـ imports موجودة في أعلى الملف:
//  const Settlement = require("../models/Settlement");
//  const Driver     = require("../models/Driver");      ← موجود
//  const User       = require("../models/User");        ← موجود
//  const Restaurant = require("../models/restaurant");  ← موجود
//  const Order      = require("../models/Order");       ← موجود
// ─────────────────────────────────────────────────────────────
exports.getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const countryFilter = req.query.country
      ? { country: req.query.country }
      : {};

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);

    // جيب IDs المطاعم المفلترة بالبلد
    const filteredRestaurantIds = req.query.country
      ? (
          await Restaurant.find({ country: req.query.country }).select("_id")
        ).map((r) => r._id)
      : null;
    const orderFilter = filteredRestaurantIds
      ? { restaurantId: { $in: filteredRestaurantIds } }
      : {};

    const [
      totalRestaurants,
      openRestaurants,
      activeDrivers,
      onlineDrivers,
      totalCustomers,
      todayOrders,
      yesterdayOrders,
      allDeliveredOrders,
      pendingSettlements,
      recentOrders,
    ] = await Promise.all([
      Restaurant.countDocuments({ ...countryFilter }),
      Restaurant.countDocuments({ status: "open", ...countryFilter }),
      Driver.countDocuments({
        status: "approved",
        availability: { $in: ["online", "busy"] },
        ...countryFilter,
      }),
      Driver.countDocuments({
        status: "approved",
        availability: "online",
        ...countryFilter,
      }),
      User.countDocuments({ ...countryFilter }),
      Order.find({
        ...orderFilter,
        createdAt: { $gte: todayStart },
        orderStatus: { $ne: "not_confirmed" },
      }).select("itemsPrice totalPrice orderStatus createdAt"),
      Order.find({
        ...orderFilter,
        createdAt: { $gte: yesterdayStart, $lt: yesterdayEnd },
        orderStatus: "delivered",
      }).select("itemsPrice"),
      Order.find({ ...orderFilter, orderStatus: "delivered" }).select(
        "itemsPrice createdAt",
      ),
      Settlement.countDocuments({ status: "pending" }),
      Order.find({ ...orderFilter, orderStatus: { $ne: "not_confirmed" } })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("restaurantId", "name")
        .populate("userId", "name")
        .select(
          "orderNumber orderStatus totalPrice createdAt restaurantId userId",
        ),
    ]);

    const round = (n) => Math.round(n * 100) / 100;
    const calcChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const todayDelivered = todayOrders.filter(
      (o) => o.orderStatus === "delivered",
    );
    const todayRevenue = todayDelivered.reduce((s, o) => s + o.itemsPrice, 0);
    const yesterdayRevenue = yesterdayOrders.reduce(
      (s, o) => s + o.itemsPrice,
      0,
    );

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - (6 - i));
      return {
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.toDateString(),
        revenue: 0,
        orders: 0,
      };
    });
    allDeliveredOrders.forEach((o) => {
      const key = new Date(o.createdAt).toDateString();
      const slot = last7.find((d) => d.date === key);
      if (slot) {
        slot.revenue = round(slot.revenue + o.itemsPrice);
        slot.orders += 1;
      }
    });

    const statusMap = {};
    todayOrders.forEach((o) => {
      statusMap[o.orderStatus] = (statusMap[o.orderStatus] || 0) + 1;
    });
    const orderStatusDist = Object.entries(statusMap)
      .map(([status, count]) => ({
        status,
        count,
        percentage:
          todayOrders.length > 0
            ? Math.round((count / todayOrders.length) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const timeAgo = (date) => {
      const diff = Math.floor((now - new Date(date)) / 1000);
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    };

    res.status(200).json({
      success: true,
      stats: {
        totalRestaurants,
        openRestaurants,
        activeDrivers,
        onlineDrivers,
        totalCustomers,
        pendingSettlements,
        todayRevenue: round(todayRevenue),
        todayOrders: todayOrders.length,
        revenueChange: calcChange(todayRevenue, yesterdayRevenue),
        ordersChange: calcChange(todayOrders.length, yesterdayOrders.length),
      },
      charts: { revenueLastWeek: last7, orderStatusDist },
      recentOrders: recentOrders.map((o) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        restaurantName: o.restaurantId?.name || "—",
        customerName: o.userId?.name || "—",
        orderStatus: o.orderStatus,
        amount: round(o.totalPrice),
        timeAgo: timeAgo(o.createdAt),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  أضف في admin_controller.js
// ─────────────────────────────────────────────────────────────
exports.getAdminOrders = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { orderStatus: { $ne: "not_confirmed" } };
    if (status && status !== "all") filter.orderStatus = status;
    if (search)
      filter.$or = [{ orderNumber: { $regex: search, $options: "i" } }];

    // فلتر البلد عبر المطاعم
    if (req.query.country) {
      const restaurantIds = await Restaurant.find({
        country: req.query.country,
      }).select("_id");
      filter.restaurantId = { $in: restaurantIds.map((r) => r._id) };
    }

    const countryRestaurantFilter = req.query.country
      ? {
          restaurantId: {
            $in: (
              await Restaurant.find({ country: req.query.country }).select(
                "_id",
              )
            ).map((r) => r._id),
          },
        }
      : {};

    const [
      orders,
      total,
      totalOrders,
      preparing,
      inTransit,
      delivered,
      cancelled,
    ] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("userId", "name phone")
        .populate("restaurantId", "name currency")
        .populate("driverId", "name phone rating vehicletype vehicleplate"),
      Order.countDocuments(filter),
      Order.countDocuments({
        orderStatus: { $ne: "not_confirmed" },
        ...countryRestaurantFilter,
      }),
      Order.countDocuments({
        orderStatus: "preparing",
        ...countryRestaurantFilter,
      }),
      Order.countDocuments({
        orderStatus: {
          $in: ["picked_up", "on_the_way", "delivered_by_driver"],
        },
        ...countryRestaurantFilter,
      }),
      Order.countDocuments({
        orderStatus: "delivered",
        ...countryRestaurantFilter,
      }),
      Order.countDocuments({
        orderStatus: "cancelled",
        ...countryRestaurantFilter,
      }),
    ]);

    res.status(200).json({
      success: true,
      summary: { totalOrders, preparing, inTransit, delivered, cancelled },
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
