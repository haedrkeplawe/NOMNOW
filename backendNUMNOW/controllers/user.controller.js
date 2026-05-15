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
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const { getMessages } = require("../utils/messages");

const Stripe = require("stripe");
const { HttpsProxyAgent } = require("https-proxy-agent");
const stripeAgent = process.env.HTTP_PROXY
  ? new HttpsProxyAgent(process.env.HTTP_PROXY)
  : undefined;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  httpAgent: stripeAgent,
});

exports.forgotPassword = async (req, res) => {
  let user;
  try {
    const m = getMessages(req).user;
    const { email } = req.body;

    user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: m.auth.userNotFound });

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

    res.json({ message: m.auth.resetLinkSent });
  } catch (err) {
    // لو فشل الإيميل بعد حفظ الـ token → نمسحه من DB
    if (user?.resetPasswordToken) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
    }
    res
      .status(500)
      .json({ message: getMessages(req).user.auth.resetEmailFailed });
  }
};
exports.resetPassword = async (req, res) => {
  const m = getMessages(req).user;
  const resetToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user)
    return res.status(400).json({ message: m.auth.invalidOrExpiredToken });

  user.password = await bcrypt.hash(req.body.password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  res.json({ message: m.auth.passwordResetSuccess });
};
exports.register = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const { name, email, phone, dateOfBirth, gender, password } = req.body;
    if (!name || !email || !phone || !dateOfBirth || !gender || !password)
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

    const [existEmail, existPhone] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ phone }),
    ]);
    if (existEmail) return res.status(400).json({ message: m.auth.emailUsed });
    if (existPhone) return res.status(400).json({ message: m.auth.phoneUsed });

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
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

    res.status(201).json({
      message: m.auth.userCreated,
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
        email: user.email,
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
        email: user.email,
        phone: user.phone,
        img: user.img || null,
        country: user.country,
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
exports.loginWithEmail = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: m.auth.missingFields });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: m.auth.invalidEmailOrPass });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: m.auth.invalidEmailOrPass });

    if (user.status === "blocked")
      return res.status(403).json({ message: m.auth.accountBlocked });

    if (!user.isVerifiedEmail) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.emailOtp = otp;
      user.emailOtpExpire = Date.now() + 60 * 60 * 1000;
      await user.save();

      emailProvider.send(user.email, `Your OTP: ${otp}`).catch(console.error);

      res.status(200).json({
        message: m.auth.otpSentEmail,
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
          email: user.email,
          phone: user.phone,
          img: user.img || null,
          country: user.country,
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
    const m = getMessages(req).user;
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) throw new Error(m.auth.emailNotFound);

    if (user.status === "blocked")
      return res.status(403).json({ message: m.auth.accountBlocked });

    if (String(user.emailOtp) !== String(otp))
      throw new Error(m.auth.invalidOtp);
    if (user.emailOtpExpire < Date.now()) throw new Error(m.auth.otpExpired);

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
        email: user.email,
        phone: user.phone,
        img: user.img || null,
        country: user.country,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.updateProfile = async (req, res) => {
  try {
    const m = getMessages(req).user;
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
    ).select("name email phone img country gender dateOfBirth");

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
// update
exports.getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id ?? req.user.id).select(
      "name email phone img country gender dateOfBirth addresses",
    );
    if (!user) {
      return res
        .status(404)
        .json({ message: getMessages(req).user.auth.userNotFound });
    }
    // update
    // أثر على الموبايل:
    // getUserInfo — تغيّر شكل الـ response:
    // // قبل
    // res.json(user)  // كل البيانات مباشرة
    // // بعد
    // res.json({ success: true, user: {...} })  // ملفوفة في object
    // فريق الموبايل يحتاج يغير طريقة قراءة البيانات من response.data إلى response.data.user.

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
// update
// عند إضافة أكثر من 5 عناوين — يعرضون رسالة "Maximum 5 addresses allowed"
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
// update
// عند حذف العنوان الأخير — يعرضون رسالة "Cannot delete your only address" بدل السماح بالحذف
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
// new1.1
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

    // جيب المطاعم مع المسافة إذا في موقع
    let restaurantIds;
    const distanceMap = {}; // restaurantId → distanceKm

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
        distanceMap[r._id.toString()] = r.distance / 1000; // تحويل لكيلومتر
      });
    } else {
      const sortedRestaurants = await Restaurant.find(baseFilter)
        .select("_id")
        .sort({ rating: -1 })
        .lean();
      restaurantIds = sortedRestaurants.map((r) => r._id);
    }

    // جلب الأكل
    const allFoods = await Food.find({
      restaurantId: { $in: restaurantIds },
    })
      .populate("categoryId", "name")
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
        statsMap[s._id.toString()] = s.totalOrders / maxOrders; // normalize
      });
    }

    // حساب الـ score لكل وجبة
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
        // افتراضي
        score = hasLocation
          ? proximityScore * 0.7 + ratingScore * 0.3
          : ratingScore;
      }

      return { ...f, _score: score };
    });

    // ترتيب حسب الـ score
    const foods = scored
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...f }) => f); // نحذف الـ _score من الرد

    res.status(200).json({ foods, locationUsed: userCoords !== null });
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
    res.status(200).json({ food });
  } catch (err) {
    console.log(err);
  }
};
// update1.1 اضفنا  featuredFoods
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

    res.status(200).json({ foods, featuredFoods });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
};
exports.toggleFavoriteFood = async (req, res) => {
  try {
    const m = getMessages(req).user;
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
  try {
    const m = getMessages(req).user;
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

  // متوسط مرجَّح — كل أكلة تُوزَّن بعدد تقييماتها
  const totalWeight = foods.reduce(
    (sum, food) => sum + food.userRatings.length,
    0,
  );
  if (!totalWeight) return; // لا أحد قيّم بعد

  const weightedSum = foods.reduce(
    (sum, food) => sum + food.rating * food.userRatings.length,
    0,
  );
  const avg = weightedSum / totalWeight;

  await Restaurant.findByIdAndUpdate(restaurantId, {
    rating: Number(avg.toFixed(1)),
  });
}
exports.rateFood = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const { foodId, rating, comment } = req.body;

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

    const existingRating = food.userRatings.find(
      (r) => r.userId.toString() === userId.toString(),
    );

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.comment = comment;
    } else {
      food.userRatings.push({ userId, rating, comment });
    }

    const avgRating =
      food.userRatings.reduce((sum, r) => sum + r.rating, 0) /
      food.userRatings.length;

    food.rating = Number(avgRating.toFixed(1));

    await food.save();

    await updateRestaurantRating(food.restaurantId);

    // نرجع بس تقييم المستخدم الحالي + المتوسط — لا نكشف تقييمات بقية المستخدمين
    const myRating = food.userRatings.find(
      (r) => r.userId.toString() === userId.toString(),
    );

    res.status(200).json({
      success: true,
      message: m.rating.rated,
      rating: food.rating,
      totalRatings: food.userRatings.length,
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
  try {
    const m = getMessages(req).user;
    const { orderId, rating, comment } = req.body;
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

// Cart
exports.getCart = async (req, res) => {
  try {
    const m = getMessages(req).user;
    const userId = req.user._id ?? req.user.id;

    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(200).json({
        success: true,
        cart: {
          items: [],
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
    res.status(500).json({ message: m.cart.fetchFailed });
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
exports.addToCart = async (req, res) => {
  try {
    const m = getMessages(req).user;
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

    // 6️⃣ حساب سعر الإضافات
    const extrasTotal = extras.reduce((sum, e) => sum + e.price, 0);
    const totalItemPrice = (basePrice + extrasTotal) * quantity;

    // 7️⃣ البحث عن عنصر موجود (نفس الوجبة + نفس الحجم + نفس الإضافات)
    const existingItem = cart.items.find(
      (item) =>
        item.foodId.toString() === foodId &&
        (item.size?.name ?? null) === (selectedSize?.name ?? null) &&
        areExtrasEqual(item.extras, extras),
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.totalItemPrice += totalItemPrice;
    } else {
      cart.items.push({
        foodId,
        name: food.name,
        image: food.image?.url,
        basePrice,
        size: selectedSize,
        quantity,
        extras,
        totalItemPrice,
      });
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
  try {
    const m = getMessages(req).user;
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

// new DE — عند إنشاء الطلب، نحسب الضريبة بدقة ونُرفق تفصيلها في الـ response للعرض في الفاتورة
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
    const deliveryFee = restaurant.country === "DE" ? 3 : 1000;
    const taxRate = restaurant.taxRate || 7;

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
      .limit(500);

    res.status(200).json({
      success: true,
      total: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// update DE — عند إنشاء الطلب، نحسب الضريبة بدقة ونُرفق تفصيلها في الـ response للعرض في الفاتورة
exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const m = getMessages(req).user;
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

    // رسوم التوصيل حسب الدولة (مؤقتة — ستصبح ديناميكية حسب المسافة)
    const deliveryFee = restaurant.country === "DE" ? 3 : 1000;

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
    const totalPrice = Number((itemsPrice + deliveryFee + taxPrice).toFixed(2));

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
          taxPrice,
          totalPrice,
          deliveryAddress,
          paymentMethod,
          paymentStatus: "pending",
          notes,
        },
      ],
      { session },
    );

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
  try {
    const m = getMessages(req).user;
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
