const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const uploadBuffer = require("../utils/cloudUpload");
const smsProvider = require("../utils/smsProvider");
const Restaurant = require("../models/restaurant");
const Food = require("../models/food");
const Driver = require("../models/Driver");
const { default: mongoose } = require("mongoose");
const crypto = require("crypto");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const { getMessages } = require("../utils/messages");
const Promotion = require("../models/Promotion");
const Coupon = require("../models/Coupon");
const Category = require("../models/category");
const MainCategory = require("../models/mainCategory");
// v3.9 — ربط أداة إصدار الكوبونات الفورية (بُنيت جاهزة سابقاً)
// بحدث فعلي لأول مرة: كوبون ترحيبي تلقائي عند فتح حساب جديد
const { issueCouponForUsers } = require("../utils/couponIssuer");
const {
  sendCustomUserNotification,
} = require("../sockets/services/notification.service");

const Stripe = require("stripe");
const { HttpsProxyAgent } = require("https-proxy-agent");
const stripeAgent = process.env.HTTP_PROXY
  ? new HttpsProxyAgent(process.env.HTTP_PROXY)
  : undefined;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  httpAgent: stripeAgent,
});

// v3.9 — إعدادات الكوبون الترحيبي التلقائي (عدّل القيم هون بس عند
// الحاجة، ما في داعي تلمس منطق register نفسه)
// ملاحظة: يصدر للسوري بس — الكوبونات مقتصرة على SY حالياً (راجع
// calculateCouponDiscount)، فألمانيا ما بتستفيد منه أصلاً لو صدرناه
const WELCOME_COUPON = {
  type: "fixed", // أو "percentage" / "free_delivery"
  value: 5000, // ل.س
  minOrderValue: 10000, // ل.س — حد أدنى للطلب حتى ينطبق
  expiryDays: 30, // null = بدون تاريخ انتهاء
};

// utils
// التحقق من توفر عرض التوصيل المجاني
const calculateDeliveryFee = async (cart, restaurant, session = null) => {
  let deliveryFee = restaurant.country === "DE" ? 3 : 1000;
  const originalDeliveryFee = deliveryFee;
  let flagChanged = false;

  if (cart.hasFreeDelivery && cart.freeDeliveryPromotionId) {
    const now = new Date();
    let query = Promotion.findOne({
      _id: cart.freeDeliveryPromotionId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
    if (session) query = query.session(session);

    const freeDeliveryPromo = await query;

    if (freeDeliveryPromo) {
      deliveryFee = 0;
    } else {
      // v3.4 — العرض لم يعد نشطاً → ننظف الحقول على مستوى السلة
      cart.hasFreeDelivery = false;
      cart.freeDeliveryPromotionId = null;
      flagChanged = true;
    }
  }

  return { deliveryFee, originalDeliveryFee, flagChanged };
};

// التحقق من توفر عرض الحسم على الوجبه
const syncCartItemPromotions = async (cart, session = null) => {
  let changed = false;
  const now = new Date();

  for (const item of cart.items) {
    if (!item.promotionId) continue;

    let query = Promotion.findOne({
      _id: item.promotionId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
    if (session) query = query.session(session);

    const promo = await query;

    if (!promo) {
      // العرض لم يعد نشطاً → نعيد السعر الأصلي كاملاً
      const extrasTotal = item.extras.reduce((sum, e) => sum + e.price, 0);
      item.basePrice = item.originalPrice;
      item.totalItemPrice = (item.originalPrice + extrasTotal) * item.quantity;
      item.originalPrice = null;
      item.promotionId = null;
      changed = true;
    }
  }

  if (changed) {
    cart.totalCartPrice = cart.items.reduce(
      (sum, item) => sum + item.totalItemPrice,
      0,
    );
  }

  return changed;
};

// v3.9 — التحقق من الكوبون المطبّق على السلة وحساب قيمة الخصم.
// دالة موحّدة مستخدمة بـ getCart (عرض) وapplyCoupon (تطبيق) وcreateOrder
// (إعادة تحقق نهائية وقت الطلب) — بنفس فلسفة calculateDeliveryFee.
//
// ⚠️ ملاحظة مهمة: هذه الدالة لا تُستدعى أبداً من createPaymentIntent —
// الكوبونات مقتصرة على الطلبات السورية (كاش) فقط بهذه المرحلة، حسب
// القرار المتفق عليه، لتفادي أي تعديل على كود الدفع الألماني الممنوع.
//
// بترجع: { discount, coupon, freeDelivery, removed?, notEligible?, reason? }
// - removed: الكوبون انشال من السلة (غير موجود/منتهي/غير مؤهل) — cart.couponCode
//   بينحط null مباشرة جوا الدالة، الكولر لازم يعمل cart.save() بعدها
// - notEligible: الكوبون موجود وصالح بس السلة لسا ما وصلت أقل قيمة مطلوبة —
//   ما بينشال من السلة (المستخدم ممكن يضيف أكتر)
const calculateCouponDiscount = async (
  cart,
  itemsPrice,
  userCountry,
  session = null,
) => {
  if (!cart.couponCode) {
    return { discount: 0, coupon: null, freeDelivery: false };
  }

  let query = Coupon.findOne({ code: cart.couponCode, isActive: true });
  if (session) query = query.session(session);
  const coupon = await query;

  const invalidate = (reason) => {
    cart.couponCode = null;
    return {
      discount: 0,
      coupon: null,
      freeDelivery: false,
      removed: true,
      reason,
    };
  };

  if (!coupon) return invalidate("not_found");

  // v3.9 — قيد صريح: الكوبون السوري بس مقبول حالياً بغض النظر عن
  // قيمة country المخزّنة بالكوبون نفسه (حتى لو ALL أو DE)
  if (userCountry === "DE") return invalidate("country_not_supported");
  if (coupon.country !== "ALL" && coupon.country !== userCountry) {
    return invalidate("country_not_supported");
  }

  if (coupon.hasExpiry) {
    const now = new Date();
    if (
      (coupon.startDate && coupon.startDate > now) ||
      (coupon.endDate && coupon.endDate < now)
    ) {
      return invalidate("expired");
    }
  }

  if (coupon.audience === "specific_users") {
    const allowed = coupon.allowedUserIds.some(
      (id) => id.toString() === cart.userId.toString(),
    );
    if (!allowed) return invalidate("not_eligible");
  }

  if (coupon.maxTotalUses && coupon.usedCount >= coupon.maxTotalUses) {
    return invalidate("limit_reached");
  }

  if (coupon.maxUsesPerUser) {
    let usageQuery = Order.countDocuments({
      userId: cart.userId,
      couponCode: coupon.code,
      orderStatus: { $ne: "not_confirmed" },
    });
    if (session) usageQuery = usageQuery.session(session);
    const userUsageCount = await usageQuery;
    if (userUsageCount >= coupon.maxUsesPerUser) {
      return invalidate("user_limit_reached");
    }
  }

  if (itemsPrice < coupon.minOrderValue) {
    return {
      discount: 0,
      coupon,
      freeDelivery: false,
      notEligible: true,
      reason: "min_order",
    };
  }

  let discount = 0;
  let freeDelivery = false;

  if (coupon.type === "percentage") {
    discount = (itemsPrice * coupon.value) / 100;
    if (coupon.maxDiscountAmount) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else if (coupon.type === "fixed") {
    discount = Math.min(coupon.value, itemsPrice);
  } else if (coupon.type === "free_delivery") {
    freeDelivery = true;
  }

  return { discount: Number(discount.toFixed(2)), coupon, freeDelivery };
};

// AUTH
exports.forgotPassword = async (req, res) => {
  return res.status(503).json({
    message:
      "Password reset is temporarily unavailable. Please contact support.",
  });
};
exports.resetPassword = async (req, res) => {
  return res.status(503).json({
    message:
      "Password reset is temporarily unavailable. Please contact support.",
  });
};
exports.register = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const { name, phone, dateOfBirth, gender, password } = req.body;
    if (!name || !phone || !dateOfBirth || !gender || !password)
      return res.status(400).json({ message: m.auth.missingFields });
    // تحديد البلد بناءً على رقم الهاتف update
    // التحقق من رقم الهاتف
    if (phone.startsWith("+49")) {
      const dePhoneRegex = /^\+49[1-9][0-9]{9,13}$/;
      if (!dePhoneRegex.test(phone)) {
        return res.status(400).json({
          message: m.auth.invalidDePhone,
        });
      }
    } else if (phone.startsWith("+963")) {
      const syPhoneRegex = /^\+963[9][0-9]{8}$/;
      if (!syPhoneRegex.test(phone)) {
        return res.status(400).json({
          message: m.auth.invalidSyPhone,
        });
      }
    } else {
      return res.status(400).json({
        message: m.auth.invalidPhone,
      });
    }
    const country = phone?.startsWith("+49") ? "DE" : "SY";

    // v3.6 — التحقق من تكرار رقم الهاتف فقط (الإيميل أُلغي)
    const existPhone = await User.findOne({ phone });
    if (existPhone) return res.status(400).json({ message: m.auth.phoneUsed });

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      phone,
      dateOfBirth,
      gender,
      password: hashedPassword,
      country,
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

    // v3.9 — إصدار كوبون ترحيبي تلقائي + إشعار المستخدم فيه.
    // مقتصر على السوري (راجع WELCOME_COUPON بأعلى الملف)، وما بيوقف
    // عملية التسجيل أبداً حتى لو فشل — تسجيل الحساب أهم من الكوبون
    if (country === "SY") {
      try {
        let endDate = null;
        if (WELCOME_COUPON.expiryDays) {
          endDate = new Date();
          endDate.setDate(endDate.getDate() + WELCOME_COUPON.expiryDays);
        }

        const coupon = await issueCouponForUsers({
          userIds: [user._id],
          type: WELCOME_COUPON.type,
          value: WELCOME_COUPON.value,
          codePrefix: "WELCOME",
          overrides: {
            minOrderValue: WELCOME_COUPON.minOrderValue,
            hasExpiry: Boolean(endDate),
            startDate: endDate ? new Date() : null,
            endDate,
            note: "Auto-issued welcome coupon on registration",
          },
        });

        // إشعار فوري — غالباً بينحفظ للاحقاً بدون توصيل لأن المستخدم
        // لسا ما سجّل fcmToken وقت التسجيل مباشرة (dispatchNotification
        // بيتعامل مع هالحالة بأمان أصلاً، ما في أي error هون)
        await sendCustomUserNotification(user._id, {
          title: "أهلاً فيك 🎉",
          body: `كوبون ترحيبي بانتظارك: ${coupon.code}`,
          type: "coupon:welcomeIssued",
          data: { couponCode: coupon.code },
        });
      } catch (err) {
        console.error("Failed to issue welcome coupon:", err);
      }
    }

    res.status(201).json({
      message: m.auth.userCreated,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        img: user.img || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.loginWithPhone = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ message: m.auth.missingFields });

    const user = await User.findOne({ phone });
    if (!user)
      return res.status(404).json({ message: m.auth.invalidPhoneOrPass });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: m.auth.invalidPhoneOrPass });

    if (user.status === "blocked")
      return res.status(403).json({ message: m.auth.accountBlocked });

    // 📌 إذا الرقم غير مفعّل → OTP
    if (!user.isVerifiedPhone) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      user.phoneOtp = otp;
      user.phoneOtpExpire = Date.now() + 60 * 60 * 1000;
      await user.save();

      return res.status(200).json({
        message: m.auth.otpSent,
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
        phone: user.phone,
        img: user.img || null,
        country: user.country,
      },
      requiresVerification: false,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.verifyPhone = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone });
    if (!user) throw new Error(m.auth.phoneNotFound);

    if (user.status === "blocked")
      return res.status(403).json({ message: m.auth.accountBlocked });

    if (user.phoneOtp !== otp) throw new Error(m.auth.invalidOtp);

    if (user.phoneOtpExpire < Date.now()) throw new Error(m.auth.otpExpired);

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
        phone: user.phone,
        img: user.img || null,
        country: user.country,
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
exports.updateProfile = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const userId = req.user._id ?? req.user.id;
    const { name, gender, dateOfBirth } = req.body;

    const updateData = {};

    if (name) updateData.name = name;
    if (gender) updateData.gender = gender;
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;

    // إذا رفع صورة جديدة
    if (req.file) {
      // حذف الصورة القديمة من Cloudinary
      const currentUser = await User.findById(userId).select("img");
      if (currentUser?.img?.public_id) {
        await cloudinary.uploader.destroy(currentUser.img.public_id);
      }
      const result = await uploadBuffer(req.file.buffer, "usersimg");
      updateData.img = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    if (gender && !["male", "female"].includes(gender)) {
      return res.status(400).json({ message: m.auth.invalidGender });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true },
    ).select("name phone img country gender dateOfBirth");

    if (!updatedUser) {
      return res.status(404).json({ message: m.auth.userNotFound });
    }

    res.status(200).json({
      success: true,
      message: m.auth.profileUpdated,
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: m.general.serverError });
  }
};
exports.getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id ?? req.user.id).select(
      "name phone img country gender dateOfBirth addresses createdAt",
    );
    if (!user) {
      return res
        .status(404)
        .json({ message: getMessages(req).user.auth.userNotFound });
    }

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

//Address
exports.GetAddresses = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const user = await User.findById(req.user._id ?? req.user.id).select(
      "addresses",
    );
    if (!user) {
      return res.status(404).json({ message: m.address.userNotFound });
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
    const m = getMessages(req).user;
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
    if (!fullAddress || !city || !lng || !lat) {
      return res.status(400).json({
        message: m.address.missingFields,
      });
    }

    const user = await User.findById(req.user._id ?? req.user.id);
    if (!user) {
      return res.status(404).json({ message: m.address.userNotFound });
    }

    // حد أقصى 5 عناوين
    if (user.addresses.length >= 5) {
      return res.status(400).json({ message: m.address.maxAddresses });
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
        coordinates: [parseFloat(lng), parseFloat(lat)],
      },
    };

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      message: m.address.added,
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.updateAddress = async (req, res) => {
  try {
    const m = getMessages(req).user;
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
      return res.status(400).json({ message: m.address.idRequired });
    }

    const user = await User.findById(req.user._id ?? req.user.id);
    if (!user) {
      return res.status(404).json({ message: m.address.userNotFound });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: m.address.notFound });
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
        coordinates: [parseFloat(lng), parseFloat(lat)],
      };
    }

    await user.save();

    res.status(200).json({
      message: m.address.updated,
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.setDefaultAddress = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const addressId = req.params.id;

    if (!addressId) {
      return res.status(400).json({ message: m.address.idRequired });
    }

    const user = await User.findById(req.user._id ?? req.user.id);
    if (!user) {
      return res.status(404).json({ message: m.address.userNotFound });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: m.address.notFound });
    }

    // إلغاء الافتراضي عن جميع العناوين
    user.addresses.forEach((addr) => {
      addr.isDefault = false;
    });

    // تعيين العنوان الجديد كافتراضي
    address.isDefault = true;

    await user.save();

    res.status(200).json({
      message: m.address.defaultUpdated,
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.deleteAddress = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const { addressId } = req.body;

    if (!addressId) {
      return res.status(400).json({ message: m.address.idRequired });
    }

    const user = await User.findById(req.user._id ?? req.user.id);
    if (!user) {
      return res.status(404).json({ message: m.address.userNotFound });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: m.address.notFound });
    }

    // حماية العنوان الوحيد من الحذف
    if (user.addresses.length === 1) {
      return res.status(400).json({ message: m.address.cannotDeleteOnly });
    }

    const wasDefault = address.isDefault;

    // حذف العنوان
    user.addresses.pull(addressId);

    // إذا العنوان المحذوف كان افتراضي → نعين الأول افتراضياً
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      message: m.address.deleted,
      addresses: user.addresses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Restaurant & food
exports.search = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.status(400).json({ message: "Query is required" });

    const userId = req.user._id ?? req.user.id;
    const user = await User.findById(userId).select("country");

    const regex = new RegExp(q, "i");

    // جيب IDs المطاعم في بلد المستخدم أولاً
    const validRestaurants = await Restaurant.find({
      country: user.country,
      status: { $ne: "blocked" },
    }).select("_id");

    const validRestaurantIds = validRestaurants.map((r) => r._id);

    // ابحث في المطاعم والأكل بالتوازي
    const [restaurants, foods] = await Promise.all([
      Restaurant.find({
        _id: { $in: validRestaurantIds },
        name: regex,
      }).select("-owner -commission -reasonForBlock"),

      Food.find({
        restaurantId: { $in: validRestaurantIds },
        name: regex,
      })
        .populate("restaurantId", "-owner -commission -reasonForBlock")
        .populate("categoryId", "name")
        .lean(),
    ]);

    res.status(200).json({ restaurants, foods });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getAllRestaurant = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;
    const { sort } = req.query;
    const user = await User.findById(userId).select("country addresses");

    const baseFilter = { country: user.country, status: { $ne: "blocked" } };

    // حدد الموقع
    const defaultAddress = user.addresses?.find((a) => a.isDefault);
    const qLat = parseFloat(req.query.lat);
    const qLng = parseFloat(req.query.lng);

    let userCoords = null;
    if (defaultAddress?.location?.coordinates?.length === 2) {
      userCoords = defaultAddress.location.coordinates;
    } else if (!isNaN(qLat) && !isNaN(qLng)) {
      userCoords = [qLng, qLat];
    }

    let restaurants;
    const distanceMap = {};

    if (userCoords) {
      restaurants = await Restaurant.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: userCoords },
            distanceField: "distance",
            spherical: true,
            query: baseFilter,
          },
        },
        { $project: { owner: 0 } },
      ]);
      restaurants = restaurants.map((r) => {
        const distanceKm = parseFloat((r.distance / 1000).toFixed(1));
        distanceMap[r._id.toString()] = distanceKm;
        return { ...r, distance: distanceKm };
      });
    } else {
      restaurants = await Restaurant.find(baseFilter).select("-owner").lean();
      restaurants = restaurants.map((r) => ({ ...r, distance: null }));
    }

    // جلب إحصائيات الطلبات إذا احتجناها
    let statsMap = {};
    if (sort === "popular") {
      const restaurantIds = restaurants.map((r) => r._id);
      const orderStats = await Order.aggregate([
        { $match: { restaurantId: { $in: restaurantIds } } },
        {
          $group: {
            _id: "$restaurantId",
            totalOrders: { $sum: 1 },
          },
        },
      ]);
      const maxOrders = Math.max(...orderStats.map((s) => s.totalOrders), 1);
      orderStats.forEach((s) => {
        statsMap[s._id.toString()] = s.totalOrders / maxOrders;
      });
    }

    // حساب الـ score لكل مطعم
    const scored = restaurants.map((r) => {
      const hasLocation = r.distance !== null;
      const proximityScore = hasLocation ? 1 / (1 + r.distance) : 0;
      const ratingScore = (r.rating || 0) / 5;
      const popularScore = statsMap[r._id.toString()] || 0;

      let score;
      if (sort === "popular") {
        score = hasLocation
          ? proximityScore * 0.3 + popularScore * 0.7
          : popularScore;
      } else if (sort === "rating") {
        score = hasLocation
          ? proximityScore * 0.3 + ratingScore * 0.7
          : ratingScore;
      } else {
        score = hasLocation
          ? proximityScore * 0.7 + ratingScore * 0.3
          : ratingScore;
      }

      return { ...r, _score: score };
    });

    // ترتيب حسب الـ score
    const result = scored
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...r }) => r);

    res
      .status(200)
      .json({ restaurant: result, locationUsed: userCoords !== null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.getAllFood = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;
    const { sort, mainCategory } = req.query; // v3.8 — إضافة mainCategory
    const user = await User.findById(userId).select("country addresses");

    console.log(mainCategory);

    const baseFilter = { country: user.country, status: { $ne: "blocked" } };

    // حدد الموقع
    const defaultAddress = user.addresses?.find((a) => a.isDefault);
    const qLat = parseFloat(req.query.lat);
    const qLng = parseFloat(req.query.lng);

    let userCoords = null;
    if (defaultAddress?.location?.coordinates?.length === 2) {
      userCoords = defaultAddress.location.coordinates;
    } else if (!isNaN(qLat) && !isNaN(qLng)) {
      userCoords = [qLng, qLat];
    }

    // جيب المطاعم مع المسافة إذا في موقع
    let restaurantIds;
    const distanceMap = {};

    if (userCoords) {
      const nearbyRestaurants = await Restaurant.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: userCoords },
            distanceField: "distance",
            spherical: true,
            query: baseFilter,
          },
        },
        { $project: { _id: 1, distance: 1 } },
      ]);
      restaurantIds = nearbyRestaurants.map((r) => r._id);
      nearbyRestaurants.forEach((r) => {
        distanceMap[r._id.toString()] = r.distance / 1000;
      });
    } else {
      const sortedRestaurants = await Restaurant.find(baseFilter)
        .select("_id")
        .sort({ rating: -1 })
        .lean();
      restaurantIds = sortedRestaurants.map((r) => r._id);
    }

    // v3.8 — بناء فلتر الأكل مع دعم القسم العام (اختياري)
    const foodFilter = { restaurantId: { $in: restaurantIds } };
    if (mainCategory) foodFilter.mainCategoryId = mainCategory;

    // جلب الأكل
    const allFoods = await Food.find(foodFilter)
      .populate("categoryId", "name")
      .populate("mainCategoryId", "name image") // v3.8
      .populate("restaurantId", "-owner -commission -reasonForBlock")
      .lean();

    // جلب إحصائيات الطلبات إذا احتجناها
    let statsMap = {};
    if (sort === "popular") {
      const orderStats = await Order.aggregate([
        { $match: { restaurantId: { $in: restaurantIds } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.foodId",
            totalOrders: { $sum: "$items.quantity" },
          },
        },
      ]);
      const maxOrders = Math.max(...orderStats.map((s) => s.totalOrders), 1);
      orderStats.forEach((s) => {
        statsMap[s._id.toString()] = s.totalOrders / maxOrders;
      });
    }

    const scored = allFoods.map((f) => {
      const restaurantKey = f.restaurantId._id.toString();
      const distanceKm = distanceMap[restaurantKey];
      const hasLocation = distanceKm !== undefined;

      const proximityScore = hasLocation ? 1 / (1 + distanceKm) : 0;
      const ratingScore = f.rating / 5;
      const popularScore = statsMap[f._id.toString()] || 0;

      let score;
      if (sort === "popular") {
        score = hasLocation
          ? proximityScore * 0.3 + popularScore * 0.7
          : popularScore;
      } else if (sort === "rating") {
        score = hasLocation
          ? proximityScore * 0.3 + ratingScore * 0.7
          : ratingScore;
      } else {
        score = hasLocation
          ? proximityScore * 0.7 + ratingScore * 0.3
          : ratingScore;
      }

      return { ...f, _score: score };
    });

    const foods = scored
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...f }) => f);

    res.status(200).json({ foods, locationUsed: userCoords !== null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.getRestaurantCategories = async (req, res) => {
  try {
    const restaurantId = req.params.id;

    const categories = await Category.find({
      restaurantId,
    }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.getFood = async (req, res) => {
  try {
    const foodId = req.params.id;
    const food = await Food.findById(foodId)
      .populate("categoryId", "name")
      .populate("restaurantId", "-owner -commission -reasonForBlock")
      .lean();

    // إرفاق العروض النشطة مع الطعام
    const now = new Date();
    const promotions = await Promotion.find({
      foodId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).select("type discountValue endDate");

    res.status(200).json({ food: { ...food, promotions } });
  } catch (err) {
    console.log(err);
  }
};
exports.getAllFoodInRestaurant = async (req, res) => {
  try {
    const { sort, category } = req.query;
    const restaurantId = req.params.id;

    const filter = { restaurantId };
    if (category) filter.categoryId = category;

    const foods = await Food.find(filter)
      .populate("categoryId", "name")
      .populate("restaurantId", "-owner -commission -reasonForBlock")
      .lean();

    const featuredFoods = foods.filter((f) => f.isFeatured);

    if (sort === "popular") {
      const orderStats = await Order.aggregate([
        { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.foodId",
            totalOrders: { $sum: "$items.quantity" },
          },
        },
      ]);

      const statsMap = {};
      orderStats.forEach((s) => {
        statsMap[s._id.toString()] = s.totalOrders;
      });

      foods.sort((a, b) => {
        const aCount = statsMap[a._id.toString()] || 0;
        const bCount = statsMap[b._id.toString()] || 0;
        return bCount - aCount;
      });
    }

    // ── إرفاق العروض النشطة مع كل طعام ──────────────────────
    const now = new Date();
    const foodIds = foods.map((f) => f._id);
    const allPromotions = await Promotion.find({
      foodId: { $in: foodIds },
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).select("type discountValue endDate foodId");

    // تجميع العروض حسب foodId
    const promotionsMap = {};
    allPromotions.forEach((p) => {
      const key = p.foodId.toString();
      if (!promotionsMap[key]) promotionsMap[key] = [];
      promotionsMap[key].push(p);
    });

    const foodsWithPromotions = foods.map((f) => ({
      ...f,
      promotions: promotionsMap[f._id.toString()] || [],
    }));

    res.status(200).json({ foods: foodsWithPromotions, featuredFoods });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};
exports.toggleFavoriteFood = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const userId = req.user._id ?? req.user.id;
    const { foodId } = req.body;

    if (!foodId) {
      return res.status(400).json({ message: m.favorite.foodIdRequired });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: m.favorite.userNotFound });
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
      message: isFav ? m.favorite.foodRemoved : m.favorite.foodAdded,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: m.general.serverError });
  }
};
exports.toggleFavoriteRestaurant = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const userId = req.user._id ?? req.user.id;
    const { restaurantId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ message: m.favorite.restaurantIdRequired });
    }

    const user = await User.findById(userId);

    const isFav = user.favoritesres.some(
      (id) => id.toString() === restaurantId,
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
        ? m.favorite.restaurantRemoved
        : m.favorite.restaurantAdded,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: m.general.serverError });
  }
};
exports.getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id ?? req.user.id)
      .populate("favoritesfood")
      .populate("favoritesres");

    res.status(200).json({
      favoritesfood: user.favoritesfood,
      favoritesres: user.favoritesres,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: getMessages(req).user.general.serverError });
  }
};

// rate
async function updateRestaurantRating(restaurantId) {
  const foods = await Food.find({ restaurantId });

  if (!foods.length) return;

  // نجمع كل التقييمات من كل الأكلات
  // لكل مستخدم نأخذ آخر تقييم فقط (الأحدث)
  const latestRatingsMap = {};

  for (const food of foods) {
    for (const r of food.userRatings) {
      const uid = r.userId.toString();
      if (
        !latestRatingsMap[uid] ||
        new Date(r.createdAt) > new Date(latestRatingsMap[uid].createdAt)
      ) {
        latestRatingsMap[uid] = r;
      }
    }
  }

  const latestRatings = Object.values(latestRatingsMap);
  if (!latestRatings.length) return;

  const avg =
    latestRatings.reduce((sum, r) => sum + r.rating, 0) / latestRatings.length;

  await Restaurant.findByIdAndUpdate(restaurantId, {
    rating: Number(avg.toFixed(1)),
  });
}
exports.rateFood = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const { foodId, comment, orderId } = req.body;
    const rating = Number(req.body.rating);
    const userId = req.user._id ?? req.user.id;

    if (!mongoose.Types.ObjectId.isValid(foodId)) {
      return res.status(400).json({ message: m.rating.invalidFoodId });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: m.rating.invalidRating });
    }

    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({ message: m.rating.foodNotFound });
    }

    // البحث عن تقييم موجود — بـ orderId لو موجود، وإلا بـ userId فقط بدون orderId
    const existingRating = orderId
      ? food.userRatings.find(
          (r) =>
            r.userId.toString() === userId.toString() &&
            r.orderId?.toString() === orderId.toString(),
        )
      : food.userRatings.find(
          (r) => r.userId.toString() === userId.toString() && !r.orderId,
        );

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.comment = comment;
    } else {
      food.userRatings.push({
        userId,
        orderId: orderId || null,
        rating,
        comment,
      });
    }

    // متوسط الأكلة — آخر تقييم لكل مستخدم فقط
    const latestPerUser = {};
    for (const r of food.userRatings) {
      const uid = r.userId.toString();
      if (
        !latestPerUser[uid] ||
        new Date(r.createdAt) > new Date(latestPerUser[uid].createdAt)
      ) {
        latestPerUser[uid] = r;
      }
    }
    const latestRatings = Object.values(latestPerUser);
    const avgRating =
      latestRatings.reduce((sum, r) => sum + r.rating, 0) /
      latestRatings.length;

    food.rating = Number(avgRating.toFixed(1));
    await food.save();

    await updateRestaurantRating(food.restaurantId);

    const myRating =
      existingRating || food.userRatings[food.userRatings.length - 1];

    res.status(200).json({
      success: true,
      message: m.rating.rated,
      rating: food.rating,
      totalRatings: latestRatings.length,
      myRating: {
        rating: myRating.rating,
        comment: myRating.comment || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: m.general.serverError });
  }
};
exports.rateDriver = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const { orderId, comment } = req.body;
    const rating = Number(req.body.rating);
    const userId = req.user._id ?? req.user.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: m.rating.invalidOrderId });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: m.rating.invalidRating });
    }

    // التحقق إن الأوردر موصّل وتبع هاد المستخدم
    const order = await Order.findOne({
      _id: orderId,
      userId,
      orderStatus: "delivered",
    });

    if (!order) {
      return res.status(404).json({ message: m.rating.orderNotFound });
    }

    if (!order.driverId) {
      return res.status(400).json({ message: m.rating.noDriver });
    }

    const driver = await Driver.findById(order.driverId);
    if (!driver) {
      return res.status(404).json({ message: m.rating.driverNotFound });
    }

    const existingRating = driver.userRatings.find(
      (r) => r.userId.toString() === userId.toString(),
    );

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.comment = comment;
    } else {
      driver.userRatings.push({ userId, rating, comment });
    }

    const avgRating =
      driver.userRatings.reduce((sum, r) => sum + r.rating, 0) /
      driver.userRatings.length;

    driver.rating = Number(avgRating.toFixed(1));

    await driver.save();

    const myRating = driver.userRatings.find(
      (r) => r.userId.toString() === userId.toString(),
    );

    res.status(200).json({
      success: true,
      message: m.rating.rated,
      rating: driver.rating,
      totalRatings: driver.userRatings.length,
      myRating: {
        rating: myRating.rating,
        comment: myRating.comment || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: m.general.serverError });
  }
};
exports.rateOrder = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const { orderId, comment } = req.body;
    const rating = Number(req.body.rating);
    const userId = req.user._id ?? req.user.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: m.rating.invalidOrderId });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: m.rating.invalidRating });
    }

    // التحقق إن الأوردر تبع المستخدم وموصّل
    const order = await Order.findOne({
      _id: orderId,
      userId,
      orderStatus: "delivered",
    });

    if (!order) {
      return res.status(404).json({ message: m.rating.orderNotFound });
    }

    // نجلب كل foodId فريد من الأوردر
    const foodIds = [
      ...new Set(order.items.map((item) => item.foodId.toString())),
    ];

    // نقيّم كل أكلة بنفس التقييم والتعليق مع حفظ orderId
    for (const foodId of foodIds) {
      const food = await Food.findById(foodId);
      if (!food) continue;

      const existingRating = food.userRatings.find(
        (r) =>
          r.userId.toString() === userId.toString() &&
          r.orderId?.toString() === order._id.toString(),
      );

      if (existingRating) {
        existingRating.rating = rating;
        existingRating.comment = comment;
      } else {
        food.userRatings.push({ userId, orderId: order._id, rating, comment });
      }

      // متوسط الأكلة — آخر تقييم لكل مستخدم فقط
      const latestPerUser = {};
      for (const r of food.userRatings) {
        const uid = r.userId.toString();
        if (
          !latestPerUser[uid] ||
          new Date(r.createdAt) > new Date(latestPerUser[uid].createdAt)
        ) {
          latestPerUser[uid] = r;
        }
      }
      const latestRatings = Object.values(latestPerUser);
      const avgRating =
        latestRatings.reduce((sum, r) => sum + r.rating, 0) /
        latestRatings.length;

      food.rating = Number(avgRating.toFixed(1));
      await food.save();
    }

    // نحدث تقييم المطعم تلقائياً
    await updateRestaurantRating(order.restaurantId);

    res.status(200).json({
      success: true,
      message: m.rating.rated,
      ratedFoods: foodIds.length,
      myRating: {
        rating,
        comment: comment || null,
      },
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: getMessages(req).user.general.serverError });
  }
};

// Cart
exports.getCart = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const userId = req.user._id ?? req.user.id;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(200).json({
        success: true,
        cart: { items: [], itemsPrice: 0, deliveryFee: 0, totalCartPrice: 0 },
      });
    }

    let needsSave = false;

    // v3.3 — إعادة التحقق من خصومات العناصر
    const itemsChanged = await syncCartItemPromotions(cart);
    if (itemsChanged) needsSave = true;

    const restaurant = await Restaurant.findById(cart.restaurantId).select(
      "country",
    );

    let deliveryFee = 0;
    let originalDeliveryFee = 0;

    if (restaurant) {
      const feeResult = await calculateDeliveryFee(cart, restaurant);
      deliveryFee = feeResult.deliveryFee;
      originalDeliveryFee = feeResult.originalDeliveryFee;
      // v3.4 — لو انتهى عرض التوصيل المجاني
      if (feeResult.flagChanged) needsSave = true;
    }

    // v3.9 — التحقق من الكوبون وحساب الخصم (لو مطبّق)
    const couponResult = await calculateCouponDiscount(
      cart,
      cart.totalCartPrice,
      req.user.country,
    );
    if (couponResult.removed) needsSave = true;
    // كوبون free_delivery بيلغي رسوم التوصيل بغض النظر عن مصدرها
    if (couponResult.freeDelivery) deliveryFee = 0;

    if (needsSave) {
      await cart.save();
    }

    const cartObj = cart.toObject();
    const itemsPrice = cartObj.totalCartPrice;

    cartObj.itemsPrice = itemsPrice;
    cartObj.deliveryFee = deliveryFee;
    cartObj.originalDeliveryFee = originalDeliveryFee;
    cartObj.couponDiscount = couponResult.discount;
    cartObj.couponType = couponResult.coupon?.type || null;
    cartObj.totalCartPrice = Number(
      (itemsPrice - couponResult.discount + deliveryFee).toFixed(2),
    );

    res.status(200).json({ success: true, cart: cartObj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: m.cart.fetchFailed });
  }
};

// v3.9 — تطبيق كوبون على السلة الحالية
exports.applyCoupon = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const userId = req.user._id ?? req.user.id;
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ message: m.cart.couponRequired });
    }

    // مقتصر على السوري حالياً — راجع الملاحظة بأعلى calculateCouponDiscount
    if (req.user.country === "DE") {
      return res
        .status(400)
        .json({ message: m.cart.couponCountryNotSupported });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: m.cart.cartEmpty });
    }

    const coupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      isActive: true,
    });
    if (!coupon) {
      return res.status(404).json({ message: m.cart.couponInvalid });
    }

    // نطبّق الكود مؤقتاً بالذاكرة ونستخدم دالة التحقق الموحّدة
    cart.couponCode = coupon.code;
    const result = await calculateCouponDiscount(
      cart,
      cart.totalCartPrice,
      req.user.country,
    );

    if (result.removed) {
      await cart.save(); // couponCode رجع null تلقائياً جوا الدالة
      const reasonMessages = {
        expired: m.cart.couponExpired,
        country_not_supported: m.cart.couponCountryNotSupported,
        not_eligible: m.cart.couponNotEligible,
        limit_reached: m.cart.couponLimitReached,
        user_limit_reached: m.cart.couponUserLimitReached,
        not_found: m.cart.couponInvalid,
      };
      return res.status(400).json({
        message: reasonMessages[result.reason] || m.cart.couponInvalid,
      });
    }

    if (result.notEligible) {
      // ما بنطبّقه وما بنخزّنه بالسلة — المستخدم لسا ما وصل الحد الأدنى
      return res.status(400).json({
        message: m.cart.couponMinOrderNotMet.replace(
          "{{amount}}",
          coupon.minOrderValue,
        ),
      });
    }

    await cart.save();

    res.status(200).json({
      success: true,
      message: m.cart.couponApplied,
      couponCode: coupon.code,
      couponType: coupon.type,
      discount: result.discount,
      freeDelivery: result.freeDelivery,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// v3.9 — إزالة الكوبون المطبّق حالياً عن السلة
exports.removeCoupon = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const userId = req.user._id ?? req.user.id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: m.cart.cartNotFound });
    }

    cart.couponCode = null;
    await cart.save();

    res.status(200).json({ success: true, message: m.cart.couponRemoved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// v3.9 — الكوبونات المتاحة للمستخدم الحالي (بدون الحاجة يعرف الكود مسبقاً)
// بترجع: الكوبونات العامة (audience: "all") + الكوبونات الموجّهة إله
// بالاسم تحديداً (audience: "specific_users" وهو ضمن allowedUserIds)،
// مع توضيح لكل كوبون هل لسا قابل يستخدمه أو خلّص حده المسموح
exports.getMyCoupons = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;

    // مقتصر على السوري — نفس قيد باقي نظام الكوبونات
    if (req.user.country === "DE") {
      return res.status(200).json({ success: true, coupons: [] });
    }

    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      country: { $in: ["SY", "ALL"] },
      $or: [
        { audience: "all" },
        { audience: "specific_users", allowedUserIds: userId },
      ],
    }).sort({ createdAt: -1 });

    // كم مرة استخدم هالمستخدم تحديداً كل كوبون — دفعة وحدة بدل استعلام لكل كوبون
    const usageAgg = await Order.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          couponCode: { $ne: null },
          orderStatus: { $ne: "not_confirmed" },
        },
      },
      { $group: { _id: "$couponCode", count: { $sum: 1 } } },
    ]);
    const usageMap = {};
    usageAgg.forEach((u) => {
      usageMap[u._id] = u.count;
    });

    const result = coupons
      // نستبعد المنتهية الصلاحية فعلياً (مش بس isActive)
      .filter((c) => {
        if (!c.hasExpiry) return true;
        if (c.startDate && c.startDate > now) return false;
        if (c.endDate && c.endDate < now) return false;
        return true;
      })
      .map((c) => {
        const usedByMe = usageMap[c.code] || 0;
        const isUsable =
          (!c.maxUsesPerUser || usedByMe < c.maxUsesPerUser) &&
          (!c.maxTotalUses || c.usedCount < c.maxTotalUses);

        return {
          code: c.code,
          type: c.type,
          value: c.value,
          maxDiscountAmount: c.maxDiscountAmount,
          minOrderValue: c.minOrderValue,
          hasExpiry: c.hasExpiry,
          endDate: c.endDate,
          usedByMe,
          maxUsesPerUser: c.maxUsesPerUser,
          isUsable,
        };
      });

    res.status(200).json({ success: true, coupons: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
function areExtrasEqual(a = [], b = []) {
  if (a.length !== b.length) return false;

  // حوّل لـ plain objects وقارن name و price فقط
  const normalize = (arr) =>
    arr
      .map((e) => ({ name: e.name, price: Number(e.price) }))
      .sort((x, y) => x.name.localeCompare(y.name));

  const normA = normalize(a);
  const normB = normalize(b);

  return normA.every(
    (e, i) => e.name === normB[i].name && e.price === normB[i].price,
  );
}
async function getActivePromotionsForFood(foodId) {
  const now = new Date();
  return Promotion.find({
    foodId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  });
}
exports.addToCart = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const userId = req.user._id ?? req.user.id;
    const { foodId, quantity = 1, extras = [], size = null } = req.body;

    if (!quantity || quantity < 1 || !Number.isInteger(Number(quantity))) {
      return res.status(400).json({ message: m.cart.invalidQuantity });
    }

    const food = await Food.findById(foodId);
    if (!food || food.status !== "available") {
      return res.status(400).json({ message: m.cart.foodNotAvailable });
    }

    let selectedSize = null;
    if (food.sizes && food.sizes.length > 0) {
      if (!size || !size.name) {
        return res.status(400).json({ message: m.cart.sizeRequired });
      }
      const foundSize = food.sizes.find((s) => s.name === size.name);
      if (!foundSize) {
        return res.status(400).json({ message: m.cart.invalidSize });
      }
      selectedSize = { name: foundSize.name, price: foundSize.price };
    } else {
      // الطعام ما عنده أحجام → يرفض إذا أرسل size
      if (size && size.name) {
        return res.status(400).json({ message: m.cart.noSizes });
      }
    }

    // 3️⃣ السعر الأساسي — حجم أو سعر افتراضي
    const basePrice = selectedSize ? selectedSize.price : food.price;

    // 4️⃣ جلب أو إنشاء السلة
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({
        userId,
        restaurantId: food.restaurantId,
        items: [],
        totalCartPrice: 0,
      });
    }

    // 5️⃣ التحقق من المطعم
    if (cart.restaurantId.toString() !== food.restaurantId.toString()) {
      return res.status(400).json({
        message: m.cart.differentRestaurant,
      });
    }

    // 6️⃣ فحص العروض النشطة على هذا الطعام
    const activePromotions = await getActivePromotionsForFood(foodId);
    const discountPromo = activePromotions.find((p) => p.type === "discount");
    const freeDeliveryPromo = activePromotions.find(
      (p) => p.type === "free_delivery",
    );

    // تطبيق الخصم على السعر الأساسي لو في عرض discount
    const effectiveBasePrice = discountPromo
      ? parseFloat(
          (basePrice * (1 - discountPromo.discountValue / 100)).toFixed(2),
        )
      : basePrice;

    // 7️⃣ حساب سعر الإضافات
    const extrasTotal = extras.reduce((sum, e) => sum + e.price, 0);
    const totalItemPrice = (effectiveBasePrice + extrasTotal) * quantity;

    // 8️⃣ البحث عن عنصر موجود (نفس الوجبة + نفس الحجم + نفس الإضافات)
    const existingItem = cart.items.find(
      (item) =>
        item.foodId.toString() === foodId &&
        (item.size?.name ?? null) === (selectedSize?.name ?? null) &&
        areExtrasEqual(item.extras, extras),
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.totalItemPrice += totalItemPrice;
      // لو في عرض خصم نشط وما كان محفوظ على العنصر → نحدّثه
      if (discountPromo && !existingItem.promotionId) {
        existingItem.basePrice = effectiveBasePrice;
        existingItem.originalPrice = basePrice;
        existingItem.promotionId = discountPromo._id;
      }
    } else {
      cart.items.push({
        foodId,
        name: food.name,
        image: food.image?.url,
        basePrice: effectiveBasePrice,
        originalPrice: discountPromo ? basePrice : null,
        promotionId: discountPromo ? discountPromo._id : null,
        size: selectedSize,
        quantity,
        extras,
        totalItemPrice,
      });
    }

    // تحديث free_delivery على السلة لو في عرض
    if (freeDeliveryPromo) {
      cart.hasFreeDelivery = true;
      cart.freeDeliveryPromotionId = freeDeliveryPromo._id;
    }

    // 8️⃣ إعادة حساب السعر
    cart.totalCartPrice = cart.items.reduce(
      (sum, item) => sum + item.totalItemPrice,
      0,
    );

    await cart.save();

    res.status(200).json({
      message: m.cart.added,
      cart,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: m.general.serverError });
  }
};
exports.removeFoodFromCart = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const userId = req.user._id ?? req.user.id;
    const { itemId } = req.body;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({ message: m.cart.cartNotFound });
    }

    const item = cart.items.id(itemId);

    if (!item) {
      return res.status(404).json({ message: m.cart.itemNotFound });
    }

    // طرح سعر العنصر من مجموع السلة بدقة
    cart.totalCartPrice = Math.max(
      0,
      Math.round((cart.totalCartPrice - item.totalItemPrice) * 100) / 100,
    );

    // update v2.2 — لو العنصر المحذوف هو صاحب عرض free_delivery
    // نتحقق هل في عنصر آخر في السلة عليه نفس العرض
    // لو لا → نمسح hasFreeDelivery من السلة
    const removedItemFoodId = item.foodId.toString();

    // حذف العنصر
    item.deleteOne();

    // إذا أصبحت السلة فارغة نحذفها
    if (cart.items.length === 0) {
      await Cart.findByIdAndDelete(cart._id);

      return res.status(200).json({
        success: true,
        message: m.cart.cleared,
        cart: null,
      });
    }

    // تحقق من free_delivery بعد الحذف
    if (cart.hasFreeDelivery && cart.freeDeliveryPromotionId) {
      const stillHasFreeDeliveryItem = cart.items.some(
        (i) => i.foodId.toString() === removedItemFoodId,
      );

      // لو ما في عنصر آخر من نفس الطعام بنفس العرض → نمسح free delivery
      if (!stillHasFreeDeliveryItem) {
        // نتحقق هل في أي عنصر آخر في السلة عليه free_delivery نشط
        const now = new Date();
        const remainingFoodIds = [
          ...new Set(cart.items.map((i) => i.foodId.toString())),
        ];
        const activePromo = await Promotion.findOne({
          foodId: { $in: remainingFoodIds },
          type: "free_delivery",
          isActive: true,
          startDate: { $lte: now },
          endDate: { $gte: now },
        });

        if (activePromo) {
          // في عرض free_delivery على طعام آخر في السلة → نحدّث
          cart.freeDeliveryPromotionId = activePromo._id;
        } else {
          // ما في أي عرض free_delivery في السلة → نمسح
          cart.hasFreeDelivery = false;
          cart.freeDeliveryPromotionId = null;
        }
      }
    }

    await cart.save();

    res.status(200).json({
      success: true,
      message: m.cart.itemRemoved,
      cart,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: m.cart.removeFailed });
  }
};

// payment
exports.createPaymentIntent = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const userId = req.user._id ?? req.user.id;

    if (req.user.country !== "DE") {
      return res.status(400).json({ message: m.payment.germanOnly });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: m.payment.cartEmpty });
    }

    const restaurant = await Restaurant.findById(cart.restaurantId).select(
      "taxRate country",
    );
    if (!restaurant) {
      return res.status(404).json({ message: m.payment.restaurantNotFound });
    }

    const itemsPrice = cart.totalCartPrice;
    const taxRate = restaurant.taxRate || 7;

    const { deliveryFee, originalDeliveryFee } = await calculateDeliveryFee(
      cart,
      restaurant,
    );

    // DE: taxPrice = ضريبة الطعام (7%) + ضريبة التوصيل (19% — خدمة لوجستية)
    const foodTax = parseFloat(((itemsPrice * taxRate) / 100).toFixed(2));
    const deliveryTax = parseFloat(((deliveryFee * 19) / 100).toFixed(2));
    const taxPrice = parseFloat((foodTax + deliveryTax).toFixed(2));
    const totalPrice = Number((itemsPrice + deliveryFee + taxPrice).toFixed(2));

    // Stripe يعمل بالسنت كعملة صغيرة (cents)
    const amountInCents = Math.round(totalPrice * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      metadata: {
        userId: userId.toString(),
        restaurantId: cart.restaurantId.toString(),
      },
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalPrice,
      currency: "EUR",
      // DE — تفصيل الضريبة للعرض في الفاتورة
      taxBreakdown: {
        foodTax,
        foodTaxRate: taxRate,
        deliveryTax,
        deliveryTaxRate: 19,
        totalTax: taxPrice,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// orders
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;

    const orders = await Order.find({ userId })
      .populate("restaurantId", "name image address")
      .populate("driverId", "name phone vehicletype vehicleplate rating")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // نضيف تقييم المستخدم الشخصي للأوردرات المكتملة فقط
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        if (order.orderStatus !== "delivered") return order;

        // تقييم الأكل — نتحقق من كل أكلات الأوردر حتى نجد تقييم
        let myFoodRating = null;
        if (order.items?.length) {
          for (const item of order.items) {
            const food = await Food.findById(item.foodId)
              .select("userRatings")
              .lean();
            if (!food) continue;
            const found = food.userRatings?.find(
              (r) =>
                r.userId?.toString() === userId.toString() &&
                r.orderId?.toString() === order._id.toString(),
            );
            if (found) {
              myFoodRating = {
                rating: found.rating,
                comment: found.comment || null,
              };
              break;
            }
          }
        }

        // تقييم الدرايفر
        let myDriverRating = null;
        if (order.driverId) {
          const driverId = order.driverId?._id ?? order.driverId;
          const driver = await Driver.findById(driverId)
            .select("userRatings")
            .lean();
          if (driver) {
            const found = driver.userRatings?.find(
              (r) => r.userId?.toString() === userId.toString(),
            );
            if (found) {
              myDriverRating = {
                rating: found.rating,
                comment: found.comment || null,
              };
            }
          }
        }

        return { ...order, myFoodRating, myDriverRating };
      }),
    );

    res.status(200).json({
      success: true,
      total: enrichedOrders.length,
      orders: enrichedOrders,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
exports.createOrder = async (req, res) => {
  const m = getMessages(req).user;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id ?? req.user.id;

    if (req.user.status === "blocked") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: m.order.accountBlocked });
    }
    const { deliveryAddress, notes } = req.body;
    // السوري يرسل paymentMethod صراحة، الألماني يأخذ "card" تلقائياً

    await Order.deleteMany({
      userId,
      orderStatus: "not_confirmed",
    }).session(session);

    const cart = await Cart.findOne({ userId }).session(session);

    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: m.order.cartEmpty });
    }

    await syncCartItemPromotions(cart, session);

    const items = cart.items.map((item) => ({
      foodId: item.foodId,
      name: item.name,
      image: item.image,
      price: item.basePrice,
      size: item.size?.name
        ? { name: item.size.name, price: item.size.price }
        : undefined,
      quantity: item.quantity,
      extras: item.extras,
      totalPrice: item.totalItemPrice,
    }));

    const itemsPrice = cart.totalCartPrice;

    // جلب taxRate من المطعم تلقائًا
    const restaurant = await Restaurant.findById(cart.restaurantId).select(
      "taxRate paymentMethods country status",
    );
    if (!restaurant) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: m.order.restaurantNotFound });
    }
    if (restaurant.status !== "open") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: m.order.restaurantClosed });
    }
    if (restaurant.country !== (req.user.country || "SY")) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: m.order.differentCountry,
      });
    }

    // v3.4 — دالة موحّدة (نفس المستخدمة بـ getCart) + تنظف الحقول العالقة تلقائياً
    const { deliveryFee: baseDeliveryFee, originalDeliveryFee } =
      await calculateDeliveryFee(cart, restaurant, session);

    // v3.9 — إعادة تحقق نهائية من الكوبون وقت الطلب (مو بس وقت التطبيق)
    // — ممكن يكون تغيّر شي بينهن (انتهت صلاحيته، وصل حد الاستخدام،
    // الأدمن عطّله...). لو صار أي من هيك، الكوبون بينشال بصمت من
    // السلة والطلب بيكمل عادي بدون خصم (نفس فلسفة syncCartItemPromotions)
    const couponResult = await calculateCouponDiscount(
      cart,
      itemsPrice,
      req.user.country,
      session,
    );
    const couponDiscount = couponResult.notEligible ? 0 : couponResult.discount;
    const deliveryFee = couponResult.freeDelivery ? 0 : baseDeliveryFee;

    const taxRate = restaurant?.taxRate || 0;

    // تحديد طريقة الدفع
    const paymentMethod =
      restaurant.country === "DE"
        ? "card" // سيتحدذ عند الدفع الفعلي
        : req.body.paymentMethod || "cash";

    if (
      restaurant.country === "SY" &&
      !restaurant.paymentMethods.includes(paymentMethod)
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: m.order.paymentNotAccepted.replace(
          "{{method}}",
          paymentMethod,
        ),
      });
    }

    // DE: taxPrice = ضريبة الطعام (7%) + ضريبة التوصيل (19% — خدمة لوجستية)
    // SY: لا ضرائب
    const foodTax = parseFloat(((itemsPrice * taxRate) / 100).toFixed(2));
    const deliveryTax =
      restaurant.country === "DE"
        ? parseFloat(((deliveryFee * 19) / 100).toFixed(2))
        : 0;
    const taxPrice = parseFloat((foodTax + deliveryTax).toFixed(2));
    const totalPrice = Number(
      (itemsPrice - couponDiscount + deliveryFee + taxPrice).toFixed(2),
    );

    const orderNumber =
      "ORD-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");

    const order = await Order.create(
      [
        {
          userId,
          restaurantId: cart.restaurantId,
          orderNumber,
          items,
          itemsPrice,
          deliveryFee,
          originalDeliveryFee,
          taxPrice,
          totalPrice,
          couponCode:
            couponResult.coupon &&
            (couponDiscount > 0 || couponResult.freeDelivery)
              ? couponResult.coupon.code
              : null,
          couponDiscount,
          deliveryAddress,
          paymentMethod,
          paymentStatus: "pending",
          notes,
        },
      ],
      { session },
    );

    // v3.9 — زيادة عداد استخدام الكوبون (بس لو فعلياً انطبّق عالطلب)
    if (
      couponResult.coupon &&
      (couponDiscount > 0 || couponResult.freeDelivery)
    ) {
      await Coupon.findByIdAndUpdate(
        couponResult.coupon._id,
        { $inc: { usedCount: 1 } },
        { session },
      );
    }

    // الكوبون كان متغيّر بالذاكرة فقط لو صار invalidate (مثلاً وصل حد
    // الاستخدام) — لازم نحفظ السلة بس بهاي الحالة تحديداً
    if (couponResult.removed) {
      await cart.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // DE — نُرفق taxBreakdown في الـ response للعرض في الفاتورة
    const isGerman = restaurant.country === "DE";
    const responseOrder = order[0].toObject();
    if (isGerman) {
      responseOrder.taxBreakdown = {
        foodTax,
        foodTaxRate: taxRate,
        deliveryTax,
        deliveryTaxRate: 19,
        totalTax: taxPrice,
      };
    }

    res.status(201).json({
      message: m.order.created,
      order: responseOrder,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res
      .status(500)
      .json({ message: m.general.serverError, error: error.message });
  }
};
exports.cancelOrderFromUser = async (req, res) => {
  const m = getMessages(req).user;
  try {
    const userId = req.user._id ?? req.user.id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: m.order.orderIdRequired });
    }

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) {
      return res.status(404).json({ message: m.order.notFound });
    }

    if (!["not_confirmed", "pending"].includes(order.orderStatus)) {
      return res.status(400).json({
        message: m.order.cannotCancel.replace("{{status}}", order.orderStatus),
      });
    }

    if (order.orderStatus === "not_confirmed") {
      await Order.findByIdAndDelete(orderId);
      return res.status(200).json({
        success: true,
        message: m.order.deleted,
      });
    }

    order.orderStatus = "cancelled";

    // إذا كان أوردر ألماني مدفوع → Refund تلقائي
    if (
      order.paymentDetails?.paymentIntentId &&
      order.paymentStatus === "paid"
    ) {
      try {
        await stripe.refunds.create({
          payment_intent: order.paymentDetails.paymentIntentId,
        });
        order.paymentStatus = "refunded";
      } catch (refundErr) {
        console.error("Refund failed:", refundErr.message);
      }
    }

    await order.save();

    // إشعار المطعم بالإلغاء — لا يجب أن يُفشل الاستجابة
    try {
      req.io
        ?.of("/restaurant")
        .to(order.restaurantId.toString())
        .emit("order:cancelled", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          order,
          message: "Order cancelled by user",
        });
    } catch (emitErr) {
      console.error("Socket emit failed (order:cancelled):", emitErr.message);
    }

    res.status(200).json({
      success: true,
      message: m.order.cancelled,
      order,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: m.general.serverError, error: error.message });
  }
};

// ads
exports.clickAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const userId = req.userId;

    const m = getMessages(req).user;
    if (!adId) {
      return res.status(400).json({ message: m.ad.adIdRequired });
    }

    const ad = await Ads.findById(adId);
    if (!ad) {
      return res.status(404).json({ message: m.ad.notFound });
    }

    // ✅ upsert — يسجل النقرة مرة واحدة فقط لكل مستخدم
    await AdClick.findOneAndUpdate(
      { adId, userId },
      { clickedAt: new Date() },
      { upsert: true, new: true },
    );

    const clicksCount = await AdClick.countDocuments({ adId });

    res.status(200).json({ success: true, clicksCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// promotions
exports.getPromotions = async (req, res) => {
  try {
    const userId = req.user._id ?? req.user.id;
    const user = await User.findById(userId).select("country");
    const now = new Date();

    const promotions = await Promotion.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      country: { $in: [user.country, "ALL"] },
    })
      .populate({
        path: "foodId",
        select: "name image price sizes rating restaurantId",
        populate: {
          path: "restaurantId",
          select: "name image address",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, promotions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// MainCategories
exports.getMainCategories = async (req, res) => {
  try {
    const mainCategories = await MainCategory.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, mainCategories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Fcm
// v3.5
exports.updateFcmToken = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const userId = req.user._id ?? req.user.id;
    const { fcmToken } = req.body;

    if (!fcmToken || !fcmToken.trim()) {
      return res.status(400).json({ message: m.order.fcmRequired });
    }

    await User.findByIdAndUpdate(userId, { fcmToken });

    res.status(200).json({ success: true, message: m.order.fcmUpdated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// v3.5
exports.logout = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const userId = req.user._id ?? req.user.id;

    await User.findByIdAndUpdate(userId, { fcmToken: null });

    res.status(200).json({ success: true, message: m.order.loggedOut });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
