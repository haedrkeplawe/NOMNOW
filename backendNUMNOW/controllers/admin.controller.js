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
const { default: mongoose } = require("mongoose");
const Promotion = require("../models/Promotion");
const MainCategory = require("../models/mainCategory");

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
      taxRate: country === "DE" ? 7 : 0,
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
    const { restaurantId, commission, taxRate } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ message: "restaurant not found" });
    }

    if (commission !== undefined) {
      if (commission < 0 || commission > 100) {
        return res
          .status(400)
          .json({ message: "Commission must be in range 0 to 100" });
      }
      restaurant.commission = commission;
    }

    // DE — تعديل نسبة الضريبة للمطعم الألماني فقط
    if (taxRate !== undefined) {
      if (restaurant.country !== "DE") {
        return res.status(400).json({
          message: "Tax rate can only be updated for German restaurants",
        });
      }
      if (taxRate < 0 || taxRate > 100) {
        return res
          .status(400)
          .json({ message: "Tax rate must be in range 0 to 100" });
      }
      restaurant.taxRate = taxRate;
    }

    await restaurant.save();

    await restaurant.populate("owner", "name email phone");

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
      .populate("owner", "name email phone")
      .sort({ createdAt: -1 });

    const restaurantIds = restaurants.map((r) => r._id);

    const [orderCounts, ratingsAgg] = await Promise.all([
      Order.aggregate([
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
      ]),
      Food.aggregate([
        { $match: { restaurantId: { $in: restaurantIds } } },
        { $unwind: "$userRatings" },
        {
          $group: {
            _id: "$restaurantId",
            totalRating: { $sum: "$userRatings.rating" },
            totalCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ordersMap = {};
    orderCounts.forEach((item) => {
      ordersMap[item._id.toString()] = item.totalOrders;
    });

    const ratingsMap = {};
    ratingsAgg.forEach((item) => {
      ratingsMap[item._id.toString()] =
        item.totalCount > 0
          ? Number((item.totalRating / item.totalCount).toFixed(1))
          : 0;
    });

    const restaurantsWithStats = restaurants.map((r) => ({
      ...r.toObject(),
      totalOrders: ordersMap[r._id.toString()] || 0,
      rating: ratingsMap[r._id.toString()] ?? 0,
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

    const restaurant = await Restaurant.findById(id).select(
      "rating commission currency",
    );
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const validStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
      "on_the_way",
      "delivered",
    ];

    const [statsResult, foodCount, restaurantFoods] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            restaurantId: new mongoose.Types.ObjectId(id),
            orderStatus: { $in: validStatuses },
          },
        },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalRevenue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$orderStatus", "delivered"] },
                        "$itemsPrice",
                        0,
                      ],
                    },
                  },
                  avgPrepTime: {
                    $avg: {
                      $cond: [
                        { $eq: ["$orderStatus", "delivered"] },
                        {
                          $divide: [
                            { $subtract: ["$updatedAt", "$createdAt"] },
                            60000,
                          ],
                        },
                        null,
                      ],
                    },
                  },
                },
              },
            ],
            todayOrders: [
              {
                $match: { createdAt: { $gte: todayStart } },
              },
              { $count: "count" },
            ],
          },
        },
      ]),
      Food.countDocuments({ restaurantId: id }),
      Food.find({ restaurantId: id }).select("rating userRatings"),
    ]);

    const totals = statsResult?.[0]?.totals?.[0] || {};
    const totalOrders = totals.totalOrders || 0;
    const totalRevenue = totals.totalRevenue || 0;
    const avgPrepTime = totals.avgPrepTime ? Math.round(totals.avgPrepTime) : 0;
    const todayOrders = statsResult?.[0]?.todayOrders?.[0]?.count || 0;
    const commission = (totalRevenue * restaurant.commission) / 100;

    // حساب التقييم من userRatings مباشرة (نفس طريقة صفحة المطعم)
    let ratingTotal = 0;
    let ratingCount = 0;
    restaurantFoods.forEach((food) => {
      food.userRatings.forEach((r) => {
        ratingTotal += r.rating;
        ratingCount += 1;
      });
    });
    const computedRating =
      ratingCount === 0 ? 0 : Number((ratingTotal / ratingCount).toFixed(1));

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        commission: Number(commission.toFixed(2)),
        avgPrepTime,
        todayOrders,
        foodCount,
        rating: computedRating,
        currency: restaurant.currency,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.getRestaurantStats = async (req, res) => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id).select(
      "rating commission currency",
    );
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const validStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
      "on_the_way",
      "delivered",
    ];

    const [statsResult, foodCount, restaurantFoods] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            restaurantId: new mongoose.Types.ObjectId(id),
            orderStatus: { $in: validStatuses },
          },
        },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalOrders: { $sum: 1 },
                  totalRevenue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$orderStatus", "delivered"] },
                        "$itemsPrice",
                        0,
                      ],
                    },
                  },
                  avgPrepTime: {
                    $avg: {
                      $cond: [
                        { $eq: ["$orderStatus", "delivered"] },
                        {
                          $divide: [
                            { $subtract: ["$updatedAt", "$createdAt"] },
                            60000,
                          ],
                        },
                        null,
                      ],
                    },
                  },
                },
              },
            ],
            todayOrders: [
              {
                $match: { createdAt: { $gte: todayStart } },
              },
              { $count: "count" },
            ],
          },
        },
      ]),
      Food.countDocuments({ restaurantId: id }),
      Food.find({ restaurantId: id }).select("rating userRatings"),
    ]);

    const totals = statsResult?.[0]?.totals?.[0] || {};
    const totalOrders = totals.totalOrders || 0;
    const totalRevenue = totals.totalRevenue || 0;
    const avgPrepTime = totals.avgPrepTime ? Math.round(totals.avgPrepTime) : 0;
    const todayOrders = statsResult?.[0]?.todayOrders?.[0]?.count || 0;
    const commission = (totalRevenue * restaurant.commission) / 100;

    // حساب التقييم من userRatings مباشرة (نفس طريقة صفحة المطعم)
    let ratingTotal = 0;
    let ratingCount = 0;
    restaurantFoods.forEach((food) => {
      food.userRatings.forEach((r) => {
        ratingTotal += r.rating;
        ratingCount += 1;
      });
    });
    const computedRating =
      ratingCount === 0 ? 0 : Number((ratingTotal / ratingCount).toFixed(1));

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        commission: Number(commission.toFixed(2)),
        avgPrepTime,
        todayOrders,
        foodCount,
        rating: computedRating,
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

// order
exports.getAdminOrders = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 30 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = { orderStatus: { $ne: "not_confirmed" } };

    // قراءة الحالات سواء جاءت كـ status أو status[]
    const rawStatuses = req.query["status[]"] || status;
    if (rawStatuses && rawStatuses !== "all") {
      const statuses = Array.isArray(rawStatuses)
        ? rawStatuses
        : typeof rawStatuses === "string" && rawStatuses.includes(",")
          ? rawStatuses.split(",")
          : [rawStatuses];
      filter.orderStatus =
        statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = { $regex: escapedSearch, $options: "i" };

      // بحث متوازي في User / Driver / Restaurant
      const [matchedUsers, matchedDrivers, matchedRestaurants] =
        await Promise.all([
          User.find({ name: searchRegex }).select("_id"),
          Driver.find({ name: searchRegex }).select("_id"),
          Restaurant.find({ name: searchRegex }).select("_id"),
        ]);

      filter.$or = [
        { orderNumber: searchRegex },
        { userId: { $in: matchedUsers.map((u) => u._id) } },
        { driverId: { $in: matchedDrivers.map((d) => d._id) } },
        { restaurantId: { $in: matchedRestaurants.map((r) => r._id) } },
      ];
    }

    // فلتر مطعم محدد — يُستخدم عند عرض طلبات مطعم معين من صفحة Analytics
    if (req.query.restaurantId) {
      filter.restaurantId = req.query.restaurantId;
    }

    // فلتر البلد عبر المطاعم — لا يُطبَّق إذا كان restaurantId محدداً
    if (req.query.country && !req.query.restaurantId) {
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
        orderStatus: { $in: ["pending", "accepted", "preparing", "ready"] },
        ...countryRestaurantFilter,
      }),
      Order.countDocuments({
        // v3.0 — حذفنا "delivered_by_driver" من هنا لأن الحالة اتلغت
        orderStatus: {
          $in: ["picked_up", "on_the_way"],
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
      summary: {
        totalOrders,
        active: preparing,
        inTransit,
        delivered,
        cancelled,
      },
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
// v3.6 — نقطة "خريطة توزيع الطلبات الجغرافي"
// الهدف: عرض كل الطلبات (وليس النشطة فقط) على الخريطة حسب موقع
// التوصيل (deliveryAddress) — أي مكان صدور الطلب فعلياً — لتحليل
// المناطق الأكثر طلباً، مع إمكانية فلترة حسب فترة زمنية وحالة الطلب.
// الحمولة مقصودة تكون خفيفة (بدون items) لأنها ممكن ترجع مئات/آلاف
// النقاط دفعة وحدة ليتم تجميعها (clustering) على الخريطة بالفرونت.
exports.getOrdersMapData = async (req, res) => {
  try {
    const { startDate, endDate, status, country, restaurantId, search } =
      req.query;

    const filter = {};
    let dateRange = null;

    if (search && search.trim()) {
      // ── وضع البحث: يستبدل فلاتر الفترة الزمنية/الحالة بالكامل ──
      // بيدور بكل أرشيف الطلبات (بدون حدود تاريخ) عبر رقم الطلب،
      // اسم/هاتف المستخدم، اسم/هاتف السائق، أو اسم المطعم
      const escapedSearch = search
        .trim()
        .replace(/^#/, "")
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = { $regex: escapedSearch, $options: "i" };

      const [matchedUsers, matchedDrivers, matchedRestaurants] =
        await Promise.all([
          User.find({
            $or: [{ name: searchRegex }, { phone: searchRegex }],
          }).select("_id"),
          Driver.find({
            $or: [{ name: searchRegex }, { phone: searchRegex }],
          }).select("_id"),
          Restaurant.find({ name: searchRegex }).select("_id"),
        ]);

      filter.orderStatus = { $ne: "not_confirmed" };
      filter.$or = [
        { orderNumber: searchRegex },
        { userId: { $in: matchedUsers.map((u) => u._id) } },
        { driverId: { $in: matchedDrivers.map((d) => d._id) } },
        { restaurantId: { $in: matchedRestaurants.map((r) => r._id) } },
      ];
    } else {
      // ── الوضع العادي: فلترة الحالة + الفترة الزمنية ──
      // "all" أو عدم الإرسال = كل الحالات ما عدا not_confirmed
      const rawStatuses = req.query["status[]"] || status;
      if (rawStatuses && rawStatuses !== "all") {
        const statuses = Array.isArray(rawStatuses)
          ? rawStatuses
          : typeof rawStatuses === "string" && rawStatuses.includes(",")
            ? rawStatuses.split(",")
            : [rawStatuses];
        filter.orderStatus =
          statuses.length === 1 ? statuses[0] : { $in: statuses };
      } else {
        filter.orderStatus = { $ne: "not_confirmed" };
      }

      // افتراضياً آخر 30 يوم لتفادي تحميل كامل تاريخ الطلبات دفعة وحدة
      const from = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = endDate ? new Date(endDate) : new Date();
      to.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: from, $lte: to };
      dateRange = { from, to };
    }

    // لازم يكون عند الطلب موقع توصيل فعلي حتى يظهر على الخريطة —
    // ينطبق على الوضعين
    filter["deliveryAddress.location.coordinates"] = { $exists: true, $ne: [] };

    // فلتر البلد يبقى مطبّق حتى بوضع البحث — قسم بيانات أساسي على
    // مستوى النظام، مو فلتر ضمن شريط الفترة/الحالة
    if (restaurantId) {
      filter.restaurantId = restaurantId;
    } else if (country) {
      const restaurantIds = await Restaurant.find({ country }).select("_id");
      filter.restaurantId = { $in: restaurantIds.map((r) => r._id) };
    }

    const MAX_POINTS = 3000;

    const [orders, totalMatching] = await Promise.all([
      Order.find(filter)
        .select(
          "orderNumber orderStatus totalPrice createdAt deliveryAddress restaurantId driverId userId",
        )
        .sort({ createdAt: -1 })
        .limit(MAX_POINTS)
        .populate("restaurantId", "name location")
        .populate("driverId", "name currentLocation")
        .populate("userId", "name phone"),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      orders,
      meta: {
        totalMatching,
        returned: orders.length,
        truncated: totalMatching > orders.length,
        range: dateRange,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
// v3.6 — تفاصيل طلب واحد كاملة لصفحة الخريطة (بانل التفاصيل الجانبي)
// يرجّع كل شيء: العناصر، بيانات الدفع، عنوان التوصيل، وبيانات موسّعة
// عن المطعم (موقعه + عنوانه) والسائق (موقعه الحالي) والعميل.
exports.getOrderFullDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate("userId", "name phone gender")
      .populate(
        "restaurantId",
        "name phone address location currency country rating",
      )
      .populate(
        "driverId",
        "name phone vehicletype vehicleplate rating currentLocation availability",
      );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
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

    if (
      !["bicycle", "motorcycle", "car"].includes(vehicletype?.toLowerCase())
    ) {
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

    // ✅ رفع صورة السائق الشخصية (اختياري)
    if (req.files?.driverImage) {
      const result = await uploadBuffer(
        req.files.driverImage[0].buffer,
        "drivers",
      );
      driver.driverImage = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

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
    driver.password = undefined;
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

exports.updateDriverCashLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { cashCreditLimit } = req.body;

    if (cashCreditLimit === undefined || cashCreditLimit < 0) {
      return res
        .status(400)
        .json({ message: "cashCreditLimit must be a non-negative number" });
    }

    const driver = await Driver.findById(id).select(
      "-password -emailOtp -phoneOtp -resetPasswordToken",
    );
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (driver.country !== "SY") {
      return res
        .status(400)
        .json({ message: "Cash limit is only applicable for Syrian drivers" });
    }

    driver.cashCreditLimit = cashCreditLimit;
    await driver.save();

    res.status(200).json({ success: true, driver });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.settlDriverCash = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id).select(
      "-password -emailOtp -phoneOtp -resetPasswordToken",
    );
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (driver.country !== "SY") {
      return res
        .status(400)
        .json({ message: "Cash settlement is only for Syrian drivers" });
    }

    if (driver.cashCollected === 0) {
      return res
        .status(400)
        .json({ message: "No cash to settle — balance is already zero" });
    }

    // تحديث الطلبات المعلقة → settled
    await Order.updateMany(
      { driverId: id, driverPaymentStatus: "pending" },
      { $set: { driverPaymentStatus: "settled", settledAt: new Date() } },
    );

    // reset الكاش
    driver.cashCollected = 0;
    await driver.save();

    res.status(200).json({
      success: true,
      message: "Cash settled successfully",
      driver,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// DE
// تسوية أجرة السائق الألماني — يُستدعى بعد أن يحوّل الأدمن المبلغ بنكياً خارج المنصة
// الفرونت (لوحة الأدمن): اعرض زر "تسوية" فقط إذا كان country === "DE" وعنده pending orders
//   بعد نجاح الطلب اعرض: settledOrdersCount و totalEarningsSettled من الـ response
//   ثم أعد تحميل بيانات السائق لتجد driverPaymentStatus = "settled" على كل أوردراته
exports.settleDriverEarnings = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id).select(
      "-password -emailOtp -phoneOtp -resetPasswordToken",
    );
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (driver.country !== "DE") {
      return res
        .status(400)
        .json({ message: "Earnings settlement is only for German drivers" });
    }

    // الأجرة تُحسب من الأوردرات مباشرة — لا نعتمد على حقل مخزّن
    const pendingOrders = await Order.find({
      driverId: id,
      driverPaymentStatus: "pending",
    }).select("deliveryFee");

    if (pendingOrders.length === 0) {
      return res
        .status(400)
        .json({ message: "No earnings to settle — balance is already zero" });
    }

    const totalEarnings = pendingOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );

    // تحديث الطلبات المعلقة → settled
    await Order.updateMany(
      { driverId: id, driverPaymentStatus: "pending" },
      { $set: { driverPaymentStatus: "settled", settledAt: new Date() } },
    );

    res.status(200).json({
      success: true,
      message: "Driver earnings settled successfully",
      settledOrdersCount: pendingOrders.length,
      totalEarningsSettled: totalEarnings,
      driver,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.getDriverCashOrders = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id).select("country name");
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    // DE
    // هذا الـ endpoint يعمل لكلا البلدين بنفس أسماء الحقول لكن بقيم مختلفة:
    // السوري:  totalPending/totalSettled = مجموع totalPrice — لم يتغير شيء
    //          + pendingDeliveryFee و settledDeliveryFee كما كانا
    // الألماني: totalPending/totalSettled = مجموع deliveryFee فقط
    //           pendingDeliveryFee/settledDeliveryFee = 0 (لا معنى له للألماني)
    // الفرونت: استخدم حقل country لتحديد طريقة العرض — السوري يعرض كاش، الألماني يعرض أجرة
    const isSyrian = driver.country === "SY";

    const orders = await Order.find({
      driverId: id,
      orderStatus: "delivered",
      driverPaymentStatus: { $in: ["pending", "settled"] },
    })
      .select(
        "orderNumber totalPrice itemsPrice deliveryFee taxPrice driverPaymentStatus createdAt restaurantId userId items paymentMethod notes deliveryAddress",
      )
      .populate("restaurantId", "name address")
      .populate("userId", "name phone")
      .sort({ createdAt: -1 });

    const pendingOrders = orders.filter(
      (o) => o.driverPaymentStatus === "pending",
    );
    const settledOrders = orders.filter(
      (o) => o.driverPaymentStatus === "settled",
    );

    // السوري: يحسب بـ totalPrice — الألماني: يحسب بـ deliveryFee فقط
    const totalPending = isSyrian
      ? pendingOrders.reduce((sum, o) => sum + o.totalPrice, 0)
      : pendingOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    const totalSettled = isSyrian
      ? settledOrders.reduce((sum, o) => sum + o.totalPrice, 0)
      : settledOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    const pendingDeliveryFee = isSyrian
      ? pendingOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0)
      : 0;

    const settledDeliveryFee = isSyrian
      ? settledOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0)
      : 0;

    res.status(200).json({
      success: true,
      country: driver.country,
      summary: {
        totalPending,
        totalSettled,
        pendingDeliveryFee,
        settledDeliveryFee,
        pendingCount: pendingOrders.length,
        settledCount: settledOrders.length,
      },
      // DE — نُضيف taxBreakdown لكل أوردر للألماني فقط للعرض في الفاتورة
      // foodTaxRate: لا نملكه هنا مباشرة — نحسب foodTax من الفرق
      // deliveryTaxRate: 19% ثابت قانونياً في ألمانيا
      orders: isSyrian
        ? orders
        : orders.map((o) => {
            const obj = o.toObject ? o.toObject() : o;
            const dFee = obj.deliveryFee || 0;
            const tPrice = obj.taxPrice || 0;
            const deliveryTax = parseFloat(((dFee * 19) / 100).toFixed(2));
            const foodTax = parseFloat((tPrice - deliveryTax).toFixed(2));
            return {
              ...obj,
              taxBreakdown: {
                foodTax,
                deliveryTax,
                deliveryTaxRate: 19,
                totalTax: tPrice,
              },
            };
          }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Settlements
exports.getAllSettlements = async (req, res) => {
  try {
    const { status, restaurantId, page = 1, limit = 100 } = req.query;
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

    // إضافة ordersCount لكل settlement
    const settlementIds = settlements.map((s) => s._id);
    const orderCounts = await Order.aggregate([
      {
        $match: {
          settlementId: { $in: settlementIds },
          settlementStatus: {
            $in: ["withdrawal_pending", "withdrawn"],
          },
        },
      },
      { $group: { _id: "$settlementId", count: { $sum: 1 } } },
    ]);

    const countsMap = {};
    orderCounts.forEach((o) => {
      countsMap[o._id.toString()] = o.count;
    });

    const enriched = settlements.map((s) => ({
      ...s.toObject(),
      ordersCount: countsMap[s._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      settlements: enriched,
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
exports.getSettlementsSummary = async (req, res) => {
  try {
    const filter = {};

    if (req.query.country) {
      const ids = await Restaurant.find({ country: req.query.country }).select(
        "_id",
      );
      filter.restaurantId = { $in: ids.map((r) => r._id) };
    }

    const results = await Settlement.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "restaurants",
          localField: "restaurantId",
          foreignField: "_id",
          as: "restaurant",
        },
      },
      { $unwind: { path: "$restaurant", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          byCurrency: {
            $push: {
              currency: { $ifNull: ["$restaurant.currency", "SYP"] },
              amount: "$amount",
            },
          },
        },
      },
    ]);

    const summary = {
      pending: { count: 0, byCurrency: {} },
      approved: { count: 0, byCurrency: {} },
      rejected: { count: 0, byCurrency: {} },
    };

    results.forEach((r) => {
      if (!summary[r._id]) return;
      summary[r._id].count = r.count;
      r.byCurrency.forEach(({ currency, amount }) => {
        summary[r._id].byCurrency[currency] =
          (summary[r._id].byCurrency[currency] || 0) + amount;
      });
    });

    res.status(200).json({ success: true, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.approveSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolvedBy } = req.body;

    const settlement = await Settlement.findById(id);
    if (!settlement)
      return res.status(404).json({ message: "Settlement not found" });
    if (settlement.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Settlement is already ${settlement.status}` });
    }

    const settlementObjectId = settlement._id;
    const restaurantId = settlement.restaurantId;

    // ── تحديث الأوردرات أولاً → withdrawn ────────────────────
    const updateResult = await Order.updateMany(
      {
        settlementId: settlementObjectId,
        settlementStatus: "withdrawal_pending",
      },
      { $set: { settlementStatus: "withdrawn" } },
    );

    // ── تحديث Settlement ──────────────────────────────────────
    settlement.status = "approved";
    settlement.resolvedAt = new Date();
    settlement.resolvedBy = resolvedBy || "admin";
    await settlement.save();

    res.status(200).json({
      success: true,
      message: `Settlement approved — ${updateResult.modifiedCount} orders marked as paid out`,
      settlement,
      ordersUpdated: updateResult.modifiedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
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
      return res
        .status(400)
        .json({ message: `Settlement is already ${settlement.status}` });
    }

    const settlementObjectId = settlement._id;
    const restaurantId = settlement.restaurantId;

    // ── إرجاع الأوردرات أولاً قبل تحديث Settlement ───────────
    // نبحث بـ settlementId أو بـ restaurantId + withdrawal_pending كـ fallback
    const updateResult = await Order.updateMany(
      {
        $or: [
          {
            settlementId: settlementObjectId,
            settlementStatus: "withdrawal_pending",
          },
          { restaurantId, settlementStatus: "withdrawal_pending" },
        ],
      },
      {
        $set: {
          settlementStatus: "available",
          settlementId: null,
        },
      },
    );

    // ── تحديث Settlement ──────────────────────────────────────
    settlement.status = "rejected";
    settlement.rejectionReason = rejectionReason;
    settlement.resolvedAt = new Date();
    settlement.resolvedBy = resolvedBy || "admin";
    await settlement.save();

    res.status(200).json({
      success: true,
      message: `Settlement rejected — ${updateResult.modifiedCount} orders returned to available balance`,
      settlement,
      ordersReturned: updateResult.modifiedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
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

    const [deliveredOrders, availableOrders, settlements] = await Promise.all([
      Order.find({ restaurantId: id, orderStatus: "delivered" }).select(
        "itemsPrice",
      ),
      Order.find({ restaurantId: id, settlementStatus: "available" }).select(
        "itemsPrice",
      ),
      Settlement.find({ restaurantId: id }).select("amount status"),
    ]);

    const totalRevenue = deliveredOrders.reduce((s, o) => s + o.itemsPrice, 0);
    const totalCommission = totalRevenue * commissionRate;
    const netProfit = totalRevenue - totalCommission;

    const availableToSettle = round(
      availableOrders.reduce(
        (s, o) => s + o.itemsPrice * (1 - commissionRate),
        0,
      ),
    );

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

    // بداية آخر 7 أيام للـ chart
    const last7Start = new Date(todayStart);
    last7Start.setDate(last7Start.getDate() - 6);

    const [
      totalRestaurants,
      openRestaurants,
      activeDrivers,
      onlineDrivers,
      totalCustomers,
      todayOrders,
      yesterdayOrders,
      last7Aggregate,
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
      // aggregate بدل find — يرجع مجاميع يومية فقط بدل كل الأوردرات
      Order.aggregate([
        {
          $match: {
            ...orderFilter,
            orderStatus: "delivered",
            createdAt: { $gte: last7Start },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            revenue: { $sum: "$itemsPrice" },
            orders: { $sum: 1 },
          },
        },
      ]),
      Settlement.countDocuments({ status: "pending" }),
      Order.find({ ...orderFilter, orderStatus: { $ne: "not_confirmed" } })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("restaurantId", "name address country currency taxRate")
        .populate("userId", "name phone")
        .populate("driverId", "name phone")
        .select(
          "orderNumber orderStatus totalPrice itemsPrice deliveryFee taxPrice createdAt restaurantId userId driverId items paymentMethod paymentStatus notes deliveryAddress",
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

    // بناء last7 من نتيجة الـ aggregate مباشرة
    const aggregateMap = {};
    last7Aggregate.forEach((row) => {
      aggregateMap[row._id] = { revenue: row.revenue, orders: row.orders };
    });

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const data = aggregateMap[key] || { revenue: 0, orders: 0 };
      return {
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        revenue: round(data.revenue),
        orders: data.orders,
      };
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
      recentOrders: recentOrders.map((o) => {
        const currency = o.restaurantId?.currency || "SYP";
        const isGerman = o.restaurantId?.country === "DE";
        const deliveryTax = isGerman
          ? parseFloat((((o.deliveryFee || 0) * 19) / 100).toFixed(2))
          : 0;
        const foodTax = isGerman
          ? parseFloat(((o.taxPrice || 0) - deliveryTax).toFixed(2))
          : 0;
        return {
          _id: o._id,
          orderNumber: o.orderNumber,
          orderStatus: o.orderStatus,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt,
          timeAgo: timeAgo(o.createdAt),
          currency,
          // المبالغ
          itemsPrice: round(o.itemsPrice || 0),
          deliveryFee: round(o.deliveryFee || 0),
          taxPrice: round(o.taxPrice || 0),
          amount: round(o.totalPrice),
          // DE — تفصيل الضريبة
          ...(isGerman && {
            taxBreakdown: {
              foodTax,
              foodTaxRate: o.restaurantId?.taxRate || 7,
              deliveryTax,
              deliveryTaxRate: 19,
            },
          }),
          // الأطراف
          restaurantName: o.restaurantId?.name || "—",
          restaurantAddress: o.restaurantId?.address?.fullAddress || "—",
          customerName: o.userId?.name || "—",
          customerPhone: o.userId?.phone || "—",
          driverName: o.driverId?.name || null,
          driverPhone: o.driverId?.phone || null,
          // التوصيل
          deliveryAddress: o.deliveryAddress?.fullAddress || "—",
          notes: o.notes || null,
          // الأصناف
          items: (o.items || []).map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice,
            size: item.size?.name || null,
            extras: (item.extras || []).map((e) => ({
              name: e.name,
              price: e.price,
            })),
          })),
        };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /admin/promotions — جلب كل العروض
exports.getPromotions = async (req, res) => {
  try {
    const { country, type, active } = req.query;

    const filter = {};
    if (country) filter.country = country;
    if (type) filter.type = type;
    if (active === "true") {
      const now = new Date();
      filter.isActive = true;
      filter.startDate = { $lte: now };
      filter.endDate = { $gte: now };
    }

    const promotions = await Promotion.find(filter)
      .populate("foodId", "name image price restaurantId")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, promotions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// POST /admin/promotions — إنشاء عرض جديد
exports.createPromotion = async (req, res) => {
  try {
    const { foodId, type, discountValue, startDate, endDate, country } =
      req.body;

    // ── التحقق من الحقول المطلوبة ──
    if (!foodId || !type || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!mongoose.Types.ObjectId.isValid(foodId)) {
      return res.status(400).json({ message: "Invalid food ID" });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res
        .status(400)
        .json({ message: "Start date must be before end date" });
    }

    // ── discount يجب أن يكون معه discountValue ──
    if (type === "discount") {
      const val = Number(discountValue);
      if (!discountValue || isNaN(val) || val < 1 || val > 99) {
        return res.status(400).json({
          message: "Discount value must be between 1 and 99",
        });
      }
    }

    // ── التحقق من وجود الطعام ──
    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    // ── منع تكرار نفس نوع العرض على نفس الطعام في نفس الفترة ──
    const overlapping = await Promotion.findOne({
      foodId,
      type,
      isActive: true,
      startDate: { $lt: new Date(endDate) },
      endDate: { $gt: new Date(startDate) },
    });

    if (overlapping) {
      return res.status(400).json({
        message: `A ${type} promotion already exists for this food in the selected period`,
      });
    }

    const promotionData = {
      foodId,
      type,
      startDate,
      endDate,
      country: country || "ALL",
      discountValue: type === "discount" ? Number(discountValue) : null,
    };

    const promotion = await Promotion.create(promotionData);
    await promotion.populate("foodId", "name image price restaurantId");

    res.status(201).json({
      success: true,
      message: "Promotion created successfully",
      promotion,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// PATCH /admin/promotions — تعديل عرض
exports.updatePromotion = async (req, res) => {
  try {
    const {
      promotionId,
      discountValue,
      startDate,
      endDate,
      country,
      isActive,
    } = req.body;

    if (!promotionId) {
      return res.status(400).json({ message: "Missing promotion ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({ message: "Invalid promotion ID" });
    }

    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).json({ message: "Promotion not found" });
    }

    // ── التحقق من التواريخ ──
    const newStart = startDate ? new Date(startDate) : promotion.startDate;
    const newEnd = endDate ? new Date(endDate) : promotion.endDate;
    if (newStart >= newEnd) {
      return res
        .status(400)
        .json({ message: "Start date must be before end date" });
    }

    // ── تحديث discountValue لو type = discount ──
    if (promotion.type === "discount" && discountValue !== undefined) {
      const val = Number(discountValue);
      if (isNaN(val) || val < 1 || val > 99) {
        return res
          .status(400)
          .json({ message: "Discount value must be between 1 and 99" });
      }
      promotion.discountValue = val;
    }

    if (startDate) promotion.startDate = startDate;
    if (endDate) promotion.endDate = endDate;
    if (country) promotion.country = country;
    if (isActive !== undefined) promotion.isActive = isActive;

    await promotion.save();
    await promotion.populate("foodId", "name image price restaurantId");

    res.status(200).json({
      success: true,
      message: "Promotion updated successfully",
      promotion,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE /admin/promotions — حذف عرض
exports.deletePromotion = async (req, res) => {
  try {
    const { promotionId } = req.body;

    if (!promotionId) {
      return res.status(400).json({ message: "Missing promotion ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(promotionId)) {
      return res.status(400).json({ message: "Invalid promotion ID" });
    }

    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      return res.status(404).json({ message: "Promotion not found" });
    }

    await promotion.deleteOne();

    res.status(200).json({
      success: true,
      message: "Promotion deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// GET /admin/restaurants/:id/foods — جلب أطعمة مطعم معين (لاختيار الطعام عند إنشاء العرض)
exports.getFoodsByRestaurant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const foods = await Food.find({ restaurantId: id })
      .select("name image price sizes status isFeatured")
      .sort({ name: 1 });

    res.status(200).json({ success: true, foods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Main Categories (أقسام عامة على مستوى النظام كله) ──────────
exports.createMainCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const exists = await MainCategory.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const mainCategory = new MainCategory({ name });

    // v3.8 — رفع الصورة (اختياري)
    if (req.file) {
      const result = await uploadBuffer(req.file.buffer, "maincategories");
      mainCategory.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    await mainCategory.save();

    res.status(201).json({
      message: "Main category created successfully",
      mainCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.getMainCategories = async (req, res) => {
  try {
    const mainCategories = await MainCategory.find().sort({ createdAt: 1 });
    res.status(200).json({ mainCategories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.updateMainCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const mainCategory = await MainCategory.findById(id);
    if (!mainCategory) {
      return res.status(404).json({ message: "Main category not found" });
    }

    if (name) mainCategory.name = name;

    // v3.8 — استبدال الصورة لو انبعتت وحدة جديدة
    if (req.file) {
      if (mainCategory.image?.public_id) {
        await cloudinary.uploader.destroy(mainCategory.image.public_id);
      }
      const result = await uploadBuffer(req.file.buffer, "maincategories");
      mainCategory.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    await mainCategory.save();

    res.status(200).json({
      message: "Main category updated successfully",
      mainCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
exports.deleteMainCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const mainCategory = await MainCategory.findById(id);
    if (!mainCategory) {
      return res.status(404).json({ message: "Main category not found" });
    }

    const foodCount = await Food.countDocuments({ mainCategoryId: id });
    if (foodCount > 0) {
      return res.status(400).json({
        message: "Cannot delete: this category is still used by some foods",
      });
    }

    // v3.8 — حذف الصورة من Cloudinary لو موجودة
    if (mainCategory.image?.public_id) {
      await cloudinary.uploader.destroy(mainCategory.image.public_id);
    }

    await mainCategory.deleteOne();

    res.status(200).json({ message: "Main category deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
