const bcrypt = require("bcryptjs");
const uploadBuffer = require("../utils/cloudUpload");
const cloudinary = require("../config/cloudinary");
const Driver = require("../models/Driver");
const Restaurant = require("../models/restaurant");
const jwt = require("jsonwebtoken");
const sendResetEmail = require("../utils/sendResetEmail");
const crypto = require("crypto");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const { getMessages } = require("../utils/messages");

// AUTH and info

exports.register = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const { name, email, phone, vehicletype, vehicleplate, password, zone } =
      req.body;

    if (
      !name ||
      !email ||
      !phone ||
      !vehicletype ||
      !vehicleplate ||
      !password ||
      !zone
    ) {
      return res.status(400).json({ message: m.auth.missingFields });
    }

    if (phone.startsWith("+49")) {
      const dePhoneRegex = /^\+49[1-9][0-9]{9,13}$/;
      if (!dePhoneRegex.test(phone)) {
        return res.status(400).json({ message: m.auth.invalidDePhone });
      }
    } else if (phone.startsWith("+963")) {
      const syPhoneRegex = /^\+963[9][0-9]{8}$/;
      if (!syPhoneRegex.test(phone)) {
        return res.status(400).json({ message: m.auth.invalidSyPhone });
      }
    } else {
      return res.status(400).json({ message: m.auth.invalidPhone });
    }

    const country = phone.startsWith("+49") ? "DE" : "SY";

    if (
      !["bicycle", "motorcycle", "car"].includes(vehicletype?.toLowerCase())
    ) {
      return res.status(400).json({ message: m.auth.invalidVehicleType });
    }

    // ✅ تحقق هل الإيميل أو الهاتف مستخدم
    const exists = await Driver.findOne({
      $or: [{ email }, { phone }],
    });

    if (exists) {
      return res.status(400).json({ message: m.auth.emailOrPhoneExists });
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
      country,
      documents: [],
    });

    // رفع الصور بالتوازي
    const uploadTasks = [];

    if (req.files?.driverImage)
      uploadTasks.push(
        uploadBuffer(req.files.driverImage[0].buffer, "drivers").then((r) => {
          driver.driverImage = { url: r.secure_url, public_id: r.public_id };
        }),
      );

    if (req.files?.idImage)
      uploadTasks.push(
        uploadBuffer(req.files.idImage[0].buffer, "drivers").then((r) => {
          driver.documents.push({
            type: "id",
            image: { url: r.secure_url, public_id: r.public_id },
          });
        }),
      );

    if (req.files?.drivingLicenseImage)
      uploadTasks.push(
        uploadBuffer(req.files.drivingLicenseImage[0].buffer, "drivers").then(
          (r) => {
            driver.documents.push({
              type: "driving_license",
              image: { url: r.secure_url, public_id: r.public_id },
            });
          },
        ),
      );

    if (req.files?.vehicleRegistrationImage)
      uploadTasks.push(
        uploadBuffer(
          req.files.vehicleRegistrationImage[0].buffer,
          "drivers",
        ).then((r) => {
          driver.documents.push({
            type: "vehicle_registration",
            image: { url: r.secure_url, public_id: r.public_id },
          });
        }),
      );

    await Promise.all(uploadTasks);

    await driver.save();
    res.status(201).json({
      message: m.auth.driverCreated,
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        country: driver.country,
        vehicletype: driver.vehicletype,
        vehicleplate: driver.vehicleplate,
        zone: driver.zone,
        status: driver.status,
        driverImage: driver.driverImage || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.loginWithPhone = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ message: m.auth.missingFields });

    const driver = await Driver.findOne({ phone });
    if (!driver)
      return res.status(404).json({ message: m.auth.invalidPhoneOrPass });

    if (driver.status === "blocked")
      return res.status(403).json({ message: m.auth.accountBlocked });

    if (driver.status === "rejected")
      return res.status(403).json({ message: m.auth.accountRejected });

    const isMatch = await bcrypt.compare(password, driver.password);

    console.log(isMatch);

    if (!isMatch)
      return res.status(400).json({ message: m.auth.invalidPhoneOrPass });

    if (!driver.isVerifiedPhone) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      driver.phoneOtp = otp;
      driver.phoneOtpExpire = Date.now() + 60 * 60 * 1000;
      await driver.save();

      return res.status(200).json({
        message: m.auth.otpSent,
        requiresVerification: true,
        otp, // بس للتجربة
      });
    }

    // ✅ تسجيل دخول مباشر
    const token = jwt.sign({ id: driver._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(200).json({
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        country: driver.country,
        vehicletype: driver.vehicletype,
        vehicleplate: driver.vehicleplate,
        zone: driver.zone,
        status: driver.status,
        driverImage: driver.driverImage || null,
        rating: driver.rating,
      },
      requiresVerification: false,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.verifyPhone = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const { phone, otp } = req.body;

    const driver = await Driver.findOne({ phone });
    if (!driver) return res.status(404).json({ message: m.auth.phoneNotFound });

    if (driver.status === "blocked")
      return res.status(403).json({ message: m.auth.accountBlocked });

    if (driver.status === "rejected")
      return res.status(403).json({ message: m.auth.accountRejected });

    if (!driver.phoneOtp || !driver.phoneOtpExpire)
      return res.status(400).json({ message: m.auth.noOtpRequested });

    if (driver.phoneOtpExpire < Date.now())
      return res.status(400).json({ message: m.auth.otpExpired });

    if (driver.phoneOtp !== otp)
      return res.status(400).json({ message: m.auth.invalidOtp });

    driver.isVerifiedPhone = true;
    driver.phoneOtp = undefined;
    driver.phoneOtpExpire = undefined;

    await driver.save();

    // ✅ توكن واحد فقط
    const token = jwt.sign({ id: driver._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      token,
      driver: {
        id: driver._id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        country: driver.country,
        vehicletype: driver.vehicletype,
        vehicleplate: driver.vehicleplate,
        zone: driver.zone,
        status: driver.status,
        driverImage: driver.driverImage || null,
        rating: driver.rating,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.forgotPassword = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const { email } = req.body;

    const driver = await Driver.findOne({ email });

    if (!driver) return res.json({ message: m.auth.emailNotFound });

    if (driver.status === "blocked")
      return res.status(403).json({ message: m.auth.accountBlocked });

    if (driver.status === "rejected")
      return res.status(403).json({ message: m.auth.accountRejected });

    // إنشاء token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // تشفيره قبل التخزين
    driver.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // صلاحية 15 دقيقة
    driver.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    await driver.save();

    const resetUrl = `${process.env.FRONTEND_URL_DRIVER}/reset-password/${resetToken}`;

    // إرسال إيميل
    await sendResetEmail({
      to: driver.email,
      subject: "Reset your NOMNOW password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="background: #f54900; color: white; font-size: 22px; font-weight: bold; padding: 8px 16px; border-radius: 8px;">N</span>
            <h2 style="margin: 12px 0 0; color: #1a1a1a;">NOMNOW</h2>
            <p style="color: #888; font-size: 13px; margin: 4px 0 0;">Driver App</p>
          </div>
          <div style="background: white; border-radius: 10px; padding: 28px;">
            <h3 style="color: #1a1a1a; margin: 0 0 8px;">Reset Your Password</h3>
            <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              Hi <strong>${driver.name}</strong>,<br/><br/>
              We received a request to reset your password. Click the button below to set a new password.
              This link will expire in <strong>15 minutes</strong>.
            </p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="${resetUrl}" style="display: inline-block; background: #f54900; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 0;">
              If you did not request a password reset, you can safely ignore this email.
              Your password will not be changed.
            </p>
          </div>
          <p style="text-align: center; color: #bbb; font-size: 11px; margin-top: 20px;">
            &copy; 2024 NOMNOW. All rights reserved.
          </p>
        </div>
      `,
    });

    res.json({
      message: m.auth.resetLinkSent,
    });
  } catch (err) {
    // لو فشل الإيميل بعد حفظ الـ token → نمسحه من DB
    if (driver?.resetPasswordToken) {
      driver.resetPasswordToken = undefined;
      driver.resetPasswordExpire = undefined;
      await driver.save();
    }
    res
      .status(500)
      .json({ message: getMessages(req).driver.auth.resetEmailFailed });
  }
};
exports.resetPassword = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const resetToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const driver = await Driver.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!driver)
      return res.status(400).json({ message: m.auth.invalidOrExpiredToken });

    driver.password = await bcrypt.hash(req.body.password, 10);
    driver.resetPasswordToken = undefined;
    driver.resetPasswordExpire = undefined;

    await driver.save();

    res.json({ message: m.auth.passwordResetSuccess });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getDriverInfo = async (req, res) => {
  try {
    const driverId = req.user._id ?? req.user.id;
    const driver = await Driver.findById(driverId).select(
      "name email phone country vehicletype vehicleplate zone status rating driverImage documents availability cashCollected cashCreditLimit",
    );
    if (!driver)
      return res
        .status(404)
        .json({ message: getMessages(req).driver.info.notFound });
    res.status(200).json({ success: true, driver });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.updateDriverInfo = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const driverId = req.user._id ?? req.user.id;

    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({ message: m.info.notFound });
    }

    // =========================
    // 1️⃣ تحديث بيانات المركبة
    // =========================
    const { vehicletype, vehicleplate, name } = req.body;
    let vehicleUpdated = false;

    // تحديث الاسم — لا يُعيد الحالة إلى pending
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: m.info.nameEmpty });
      }
      driver.name = name;
    }

    if (vehicletype !== undefined) {
      if (
        !["bicycle", "motorcycle", "car"].includes(vehicletype?.toLowerCase())
      ) {
        return res.status(400).json({ message: m.info.invalidVehicleType });
      }
      driver.vehicletype = vehicletype.toLowerCase();
      vehicleUpdated = true;
    }

    if (vehicleplate !== undefined) {
      if (!vehicleplate.trim()) {
        return res.status(400).json({ message: m.info.plateEmpty });
      }
      driver.vehicleplate = vehicleplate.trim();
      vehicleUpdated = true;
    }

    // تعديل بيانات المركبة يُعيد الحالة إلى pending — الأدمن يراجع التناسق مع الوثائق
    if (vehicleUpdated) {
      driver.status = "pending";
      driver.isDocumentsVerified = false;
    }

    // =========================
    // 2️⃣ تحديث صورة السائق الشخصية
    // =========================
    if (req.files?.driverImage) {
      // حذف القديمة إذا موجودة
      if (driver.driverImage?.public_id) {
        await cloudinary.uploader.destroy(driver.driverImage.public_id);
      }

      const result = await uploadBuffer(
        req.files.driverImage[0].buffer,
        "drivers",
      );

      driver.driverImage = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    // =========================
    // 2️⃣ تحديث مستند معين
    // =========================
    const updateDocument = async (type, fileField) => {
      if (!req.files?.[fileField]) return true;

      const document = driver.documents.find((doc) => doc.type === type);

      if (!document) {
        res.status(400).json({
          message: m.info.documentNotFound.replace("{{type}}", type),
        });
        return false;
      }

      // حذف القديمة
      if (document.image?.public_id) {
        await cloudinary.uploader.destroy(document.image.public_id);
      }

      const result = await uploadBuffer(
        req.files[fileField][0].buffer,
        "drivers",
      );

      document.image = {
        url: result.secure_url,
        public_id: result.public_id,
      };

      // 🔥 إعادة ضبط حالة المستند
      document.status = "pending";
      document.rejectionReason = undefined;
      document.verifiedAt = undefined;
      document.verifiedBy = undefined;

      // 🔥 إعادة ضبط التحقق العام
      driver.isDocumentsVerified = false;
      driver.status = "pending";

      return true;
    };

    const results = await Promise.all([
      updateDocument("id", "idImage"),
      updateDocument("driving_license", "drivingLicenseImage"),
      updateDocument("vehicle_registration", "vehicleRegistrationImage"),
    ]);
    if (results.includes(false)) return;

    await driver.save();

    res.status(200).json({
      message: m.info.updated,
      driver: {
        id: driver._id,
        name: driver.name,
        status: driver.status,
        isDocumentsVerified: driver.isDocumentsVerified,
        driverImage: driver.driverImage || null,
        documents: driver.documents,
        vehicletype: driver.vehicletype,
        vehicleplate: driver.vehicleplate,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};
exports.changePassword = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const driverId = req.user._id ?? req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: m.info.passwordRequired });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: m.info.passwordTooShort });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: m.info.passwordSame });
    }

    const driver = await Driver.findById(driverId).select("password");
    if (!driver) {
      return res.status(404).json({ message: m.info.notFound });
    }

    const isMatch = await bcrypt.compare(currentPassword, driver.password);
    if (!isMatch) {
      return res.status(400).json({ message: m.info.incorrectPassword });
    }

    driver.password = await bcrypt.hash(newPassword, 12);
    await driver.save();

    res.status(200).json({ success: true, message: m.info.passwordUpdated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
// Logout — مسح FCM token لمنع وصول إشعارات بعد تسجيل الخروج
exports.logout = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const driverId = req.user._id ?? req.user.id;

    await Driver.findByIdAndUpdate(driverId, { fcmToken: null });

    res.status(200).json({ success: true, message: m.order.loggedOut });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// restaurant
exports.findRestaurants = async (req, res) => {
  try {
    const country = req.user.country;

    const restaurants = await Restaurant.find({
      country,
      status: { $ne: "blocked" },
    });

    res.status(200).json({ restaurants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// money
exports.getWallet = async (req, res) => {
  try {
    const driverId = req.user?.id;

    const driver = await Driver.findById(driverId).select(
      "country cashCreditLimit",
    );
    if (!driver)
      return res
        .status(404)
        .json({ message: getMessages(req).driver.info.notFound });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // DE
    // السائق الألماني لا يملك محفظة كاش — يرى أجرة التوصيل فقط
    // كل القيم تُحسب من الأوردرات مباشرة، لا يوجد حقل مخزّن على الـ Driver model
    // الفرونت (تطبيق السائق):
    //   isCashDriver === false → اعرض شاشة "أجرتي" بدل شاشة "محفظة الكاش"
    //   todayEarnings:    مجموع deliveryFee لأوردرات اليوم (pending + settled)
    //   pendingEarnings:  مجموع deliveryFee للأوردرات التي لم تُسوَّى بعد
    //   pendingOrdersCount: عدد الأوردرات المعلقة
    if (driver.country === "DE") {
      const todayOrders = await Order.find({
        driverId,
        orderStatus: "delivered",
        driverPaymentStatus: { $in: ["pending", "settled"] },
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }).select("deliveryFee");

      const todayEarnings = todayOrders.reduce(
        (sum, o) => sum + (o.deliveryFee || 0),
        0,
      );
      const todayOrdersCount = todayOrders.length;

      const pendingOrders = await Order.find({
        driverId,
        orderStatus: "delivered",
        driverPaymentStatus: "pending",
      }).select("deliveryFee");

      const pendingEarnings = pendingOrders.reduce(
        (sum, o) => sum + (o.deliveryFee || 0),
        0,
      );
      const pendingOrdersCount = pendingOrders.length;

      return res.status(200).json({
        success: true,
        wallet: {
          isCashDriver: false,
          todayEarnings,
          todayOrdersCount,
          pendingEarnings,
          pendingOrdersCount,
        },
      });
    }

    // ── السائق السوري — منطقه كما هو بدون أي تغيير ────────

    const todayOrders = await Order.find({
      driverId,
      orderStatus: "delivered",
      driverPaymentStatus: { $in: ["pending", "settled"] },
      createdAt: { $gte: todayStart, $lte: todayEnd },
    }).select("totalPrice deliveryFee");

    const totalCollectedToday = todayOrders.reduce(
      (sum, o) => sum + o.totalPrice,
      0,
    );
    const todayOrdersCount = todayOrders.length;

    // ── حساب pending orders ───────────────────────────────
    const pendingOrders = await Order.find({
      driverId,
      orderStatus: "delivered",
      driverPaymentStatus: "pending",
    }).select("totalPrice deliveryFee");

    const pendingOrdersCount = pendingOrders.length;

    const pendingDeliveryFee = pendingOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );

    // cashCollected محسوب من الأوردرات مباشرة — لا نعتمد على driver.cashCollected المُخزَّن
    const cashCollected = pendingOrders.reduce(
      (sum, o) => sum + o.totalPrice,
      0,
    );
    const cashCreditLimit = driver.cashCreditLimit ?? 0;

    // المبلغ الصافي الذي يجب إيداعه (بدون حصة السائق)
    const cashHeldForSettlement = cashCollected - pendingDeliveryFee;

    // هل تجاوز الحد؟
    const isLimitExceeded =
      cashCreditLimit > 0 && cashCollected >= cashCreditLimit;

    // نسبة الامتلاء للشريط الدائري
    const limitUsagePercent =
      cashCreditLimit > 0
        ? Math.min(100, Math.round((cashCollected / cashCreditLimit) * 100))
        : 0;

    res.status(200).json({
      success: true,
      wallet: {
        isCashDriver: true,
        totalCollectedToday,
        todayOrdersCount,
        cashCollected,
        cashCreditLimit,
        limitUsagePercent,
        isLimitExceeded,
        pendingDeliveryFee,
        cashHeldForSettlement,
        pendingOrdersCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.getDriverCashOrders = async (req, res) => {
  try {
    const driverId = req.user?.id;

    const driver = await Driver.findById(driverId).select("country");
    if (!driver)
      return res
        .status(404)
        .json({ message: getMessages(req).driver.info.notFound });

    const isSyrian = driver.country === "SY";

    // DE
    // هذا الـ endpoint يعمل لكلا البلدين بنفس الشكل لكن بمنطق حساب مختلف:
    // السوري:  totalCollected = مجموع totalPrice — cashHeldForSettlement = ما يجب إيداعه
    // الألماني: totalCollected = مجموع deliveryFee — cashHeldForSettlement = 0 دائماً
    // الفرونت (تطبيق السائق):
    //   isSyrian (استنتجه من paymentMethod === "cash" أو من بيانات الـ driver):
    //     اعرض "إجمالي الكاش المحصّل" و"مستحق الإيداع"
    //   الألماني:
    //     اعرض "إجمالي الأجرة" فقط، أخفِ أي ذكر للكاش أو الإيداع

    const orders = await Order.find({
      driverId,
      orderStatus: "delivered",
      driverPaymentStatus: { $in: ["pending", "settled"] },
    })
      .select(
        "orderNumber totalPrice itemsPrice deliveryFee taxPrice driverPaymentStatus createdAt settledAt restaurantId userId items paymentMethod notes deliveryAddress",
      )
      .populate("restaurantId", "name address")
      .populate("userId", "name phone")
      .sort({ createdAt: -1 });

    // ── Summary ───────────────────────────────────────────
    const pendingOrders = orders.filter(
      (o) => o.driverPaymentStatus === "pending",
    );
    const settledOrders = orders.filter(
      (o) => o.driverPaymentStatus === "settled",
    );

    // السوري: المبلغ = totalPrice / الألماني: المبلغ = deliveryFee فقط
    const pendingSettlement = isSyrian
      ? pendingOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0)
      : pendingOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    const totalCollected = isSyrian
      ? orders.reduce((sum, o) => sum + o.totalPrice, 0)
      : orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    const cashHeldForSettlement = isSyrian
      ? pendingOrders.reduce((sum, o) => sum + o.totalPrice, 0) -
        pendingSettlement
      : 0; // الألماني: لا يحمل كاش

    // ── Format orders ─────────────────────────────────────
    const formattedOrders = orders.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      settledAt: o.settledAt || null,
      driverPaymentStatus: o.driverPaymentStatus,

      // المبالغ
      totalPrice: o.totalPrice,
      itemsPrice: o.itemsPrice,
      deliveryFee: o.deliveryFee || 0,
      taxPrice: o.taxPrice || 0,

      // الزبون
      customer: {
        name: o.userId?.name || "—",
        phone: o.userId?.phone || "—",
      },

      // المطعم
      restaurant: {
        name: o.restaurantId?.name || "—",
        address: o.restaurantId?.address?.fullAddress || "—",
      },

      // عنوان التوصيل
      deliveryAddress: o.deliveryAddress?.fullAddress || "—",

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

      paymentMethod: o.paymentMethod,
      notes: o.notes || null,
    }));

    res.status(200).json({
      success: true,
      summary: {
        totalCollected,
        pendingSettlement,
        cashHeldForSettlement,
        pendingCount: pendingOrders.length,
        settledCount: settledOrders.length,
      },
      orders: formattedOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.getFinancialTransactions = async (req, res) => {
  try {
    const driverId = req.user?.id;
    const { period = "all" } = req.query;

    const driver = await Driver.findById(driverId).select("country");
    if (!driver)
      return res
        .status(404)
        .json({ message: getMessages(req).driver.info.notFound });

    // ── بناء فلتر التاريخ حسب الـ period ─────────────────
    const now = new Date();
    let dateFilter = {};

    if (period === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    } else if (period === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: start } };
    } else if (period === "month") {
      const start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: start } };
    }

    // ── جلب طلبات الـ period ──────────────────────────────
    const orders = await Order.find({
      driverId,
      orderStatus: "delivered",
      driverPaymentStatus: { $in: ["pending", "settled"] },
      ...dateFilter,
    })
      .select(
        "orderNumber totalPrice itemsPrice deliveryFee taxPrice driverPaymentStatus createdAt settledAt restaurantId userId paymentMethod notes deliveryAddress items",
      )
      .populate("restaurantId", "name")
      .populate("userId", "name phone")
      .sort({ createdAt: -1 });

    // ── Total Earnings للـ period ─────────────────────────
    const totalEarnings = orders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );
    const ordersCount = orders.length;

    // ── Weekly Change dates ───────────────────────────────
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 6);
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 13);
    lastWeekStart.setHours(0, 0, 0, 0);

    const lastWeekEnd = new Date(now);
    lastWeekEnd.setDate(now.getDate() - 7);
    lastWeekEnd.setHours(23, 59, 59, 999);

    // ── Aggregate — balance + weekly في query واحد ────────
    const [statsResult] = await Order.aggregate([
      {
        $match: {
          driverId: new mongoose.Types.ObjectId(driverId),
          orderStatus: "delivered",
          driverPaymentStatus: { $in: ["pending", "settled"] },
        },
      },
      {
        $group: {
          _id: null,
          currentBalance: {
            $sum: {
              $cond: [
                { $eq: ["$driverPaymentStatus", "pending"] },
                "$deliveryFee",
                0,
              ],
            },
          },
          restaurantHeldBalance: {
            $sum: {
              $cond: [
                { $eq: ["$driverPaymentStatus", "pending"] },
                "$deliveryFee",
                0,
              ],
            },
          },
          thisWeekEarnings: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", thisWeekStart] },
                "$deliveryFee",
                0,
              ],
            },
          },
          lastWeekEarnings: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$createdAt", lastWeekStart] },
                    { $lte: ["$createdAt", lastWeekEnd] },
                  ],
                },
                "$deliveryFee",
                0,
              ],
            },
          },
        },
      },
    ]);

    const currentBalance = statsResult?.currentBalance || 0;
    const restaurantHeldBalance = statsResult?.restaurantHeldBalance || 0;
    const thisWeekEarnings = statsResult?.thisWeekEarnings || 0;
    const lastWeekEarnings = statsResult?.lastWeekEarnings || 0;

    let weeklyChange = null;
    if (lastWeekEarnings > 0) {
      weeklyChange = Math.round(
        ((thisWeekEarnings - lastWeekEarnings) / lastWeekEarnings) * 100,
      );
    } else if (thisWeekEarnings > 0) {
      weeklyChange = 100;
    }

    // ── Format orders ─────────────────────────────────────
    const formattedOrders = orders.map((o) => {
      const deliveryFee = o.deliveryFee || 0;
      const orderValue = o.itemsPrice || 0;

      return {
        _id: o._id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        settledAt: o.settledAt || null,
        driverPaymentStatus: o.driverPaymentStatus,
        paymentMethod: o.paymentMethod,
        notes: o.notes || null,

        // المبالغ
        totalPrice: o.totalPrice,
        itemsPrice: orderValue,
        deliveryFee,
        taxPrice: o.taxPrice || 0,

        // Breakdown
        breakdown: {
          deliveryFeeEarning: deliveryFee, // موجب — حصة السائق
          netEffect: deliveryFee, // صافي تأثير الطلب على رصيد السائق
        },

        // الزبون
        customer: {
          name: o.userId?.name || "—",
          phone: o.userId?.phone || "—",
        },

        // المطعم
        restaurant: {
          name: o.restaurantId?.name || "—",
        },

        // عنوان التوصيل
        deliveryAddress: o.deliveryAddress?.fullAddress || "—",

        // الأصناف
        items: (o.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          size: item.size?.name || null,
          extras: (item.extras || []).map((e) => ({
            name: e.name,
            price: e.price,
          })),
        })),
      };
    });

    res.status(200).json({
      success: true,
      period,
      balances: {
        currentBalance,
        restaurantHeldBalance,
      },
      earnings: {
        totalEarnings,
        ordersCount,
        weeklyChange,
        thisWeekEarnings,
        lastWeekEarnings,
      },
      orders: formattedOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// order
exports.getActiveOrder = async (req, res) => {
  try {
    const driverId = req.user._id ?? req.user.id;

    // v3.0 — حذفنا "delivered_by_driver" من هنا لأن الحالة اتلغت
    const activeOrder = await Order.findOne({
      driverId,
      orderStatus: { $in: ["picked_up", "on_the_way"] },
    })
      .populate("userId", "name phone")
      .populate("restaurantId", "name location address");

    res.status(200).json({
      hasActiveOrder: !!activeOrder,
      order: activeOrder || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
exports.getOrdersHistory = async (req, res) => {
  try {
    const driverId = req.user._id ?? req.user.id;
    const { status, date } = req.query;

    let statusFilter = { $in: ["delivered", "cancelled"] };
    if (status === "completed") statusFilter = "delivered";
    if (status === "cancelled") statusFilter = "cancelled";

    let dateFilter = {};
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [totalOrdersCount, todayOrders, orders] = await Promise.all([
      Order.countDocuments({
        driverId,
        orderStatus: { $in: ["delivered", "cancelled"] },
      }),
      Order.find({
        driverId,
        orderStatus: "delivered",
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }).select("deliveryFee"),
      Order.find({
        driverId,
        orderStatus: statusFilter,
        ...dateFilter,
      })
        .select(
          "orderNumber orderStatus totalPrice itemsPrice deliveryFee taxPrice createdAt restaurantId userId paymentMethod deliveryAddress driverPaymentStatus",
        )
        .populate("restaurantId", "name")
        .populate("userId", "name")
        .sort({ createdAt: -1 }),
    ]);

    const todayOrdersCount = todayOrders.length;
    const todayEarnings = todayOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );

    const formattedOrders = orders.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      orderStatus: o.orderStatus,
      driverPaymentStatus: o.driverPaymentStatus,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
      totalPrice: o.totalPrice,
      deliveryFee: o.deliveryFee || 0,
      restaurant: {
        name: o.restaurantId?.name || "—",
      },
      customer: {
        name: o.userId?.name || "—",
      },
      deliveryAddress: o.deliveryAddress?.fullAddress || "—",
    }));

    res.status(200).json({
      success: true,
      totalOrdersCount,
      today: {
        ordersCount: todayOrdersCount,
        earnings: todayEarnings,
      },
      orders: formattedOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
// update DE — إعادة حساب تفصيل الضريبة في تفاصيل الطلب بناءً على القيم المخزّنة وليس على افتراض نسبة ثابتة
exports.getOrderDetails = async (req, res) => {
  try {
    const driverId = req.user._id ?? req.user.id;
    const { orderId } = req.params;

    const order = await Order.findOne({ _id: orderId, driverId })
      .populate("restaurantId", "name phone address location taxRate country")
      .populate("userId", "name phone");

    if (!order) {
      return res
        .status(404)
        .json({ message: getMessages(req).driver.order.notFound });
    }

    const restaurant = order.restaurantId;
    const customer = order.userId;
    const isCashOrder = order.paymentMethod === "cash";
    const deliveryFee = order.deliveryFee || 0;
    const taxPrice = order.taxPrice || 0;
    const mealPriceWithTax = (order.itemsPrice || 0) + taxPrice;

    // DE — إعادة حساب تفصيل الضريبة من القيم المخزّنة
    // deliveryTax = deliveryFee × 19% ، foodTax = taxPrice - deliveryTax
    const isGermanOrder = order.paymentMethod !== "cash";
    const foodTaxRate = restaurant?.taxRate || 7; // من DB — قابل للتغيير من الأدمن
    const deliveryTax = isGermanOrder
      ? parseFloat(((deliveryFee * 19) / 100).toFixed(2))
      : 0;
    const foodTax = isGermanOrder
      ? parseFloat((taxPrice - deliveryTax).toFixed(2))
      : 0;

    res.status(200).json({
      success: true,
      order: {
        // ── معلومات أساسية ─────────────────────────────
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        driverPaymentStatus: order.driverPaymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        settledAt: order.settledAt || null,
        notes: order.notes || null,

        // ── المطعم ─────────────────────────────────────
        restaurant: {
          name: restaurant?.name || "—",
          phone: restaurant?.phone || null,
          address: restaurant?.address?.fullAddress || "—",
          location: restaurant?.location?.coordinates || null,
        },

        // ── الزبون ─────────────────────────────────────
        customer: {
          name: customer?.name || "—",
          phone: customer?.phone || null,
        },

        // ── عنوان التوصيل ───────────────────────────────
        deliveryAddress: {
          fullAddress: order.deliveryAddress?.fullAddress || "—",
          location: order.deliveryAddress?.location?.coordinates || null,
        },

        // ── الأصناف ─────────────────────────────────────
        items: (order.items || []).map((item) => ({
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

        // ── تفصيل الأسعار ──────────────────────────────
        pricing: {
          itemsPrice: order.itemsPrice || 0,
          deliveryFee,
          taxPrice,
          totalPrice: order.totalPrice,
          // DE — تفصيل الضريبة للفاتورة
          ...(isGermanOrder && {
            taxBreakdown: {
              foodTax,
              foodTaxRate, // من DB — ليس ثابتاً
              deliveryTax,
              deliveryTaxRate: 19, // ثابت قانونياً في ألمانيا
              totalTax: taxPrice,
            },
          }),
        },

        // ── Financial Breakdown (Cash فقط) ─────────────
        financialBreakdown: isCashOrder
          ? {
              isCashOrder: true,
              amountCollectedFromCustomer: order.totalPrice,
              deliveryFeeEarning: deliveryFee,
              mealPriceWithTax,
              deductedFromRestaurantDeposit: -mealPriceWithTax,
              netEffectOnBalance: deliveryFee,
            }
          : { isCashOrder: false },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Fcm
exports.updateFcmToken = async (req, res) => {
  try {
    const m = getMessages(req).driver;
    const driverId = req.user._id ?? req.user.id;
    const { fcmToken } = req.body;

    if (!fcmToken || !fcmToken.trim()) {
      return res.status(400).json({ message: m.order.fcmRequired });
    }

    await Driver.findByIdAndUpdate(driverId, { fcmToken });

    res.status(200).json({ success: true, message: m.order.fcmUpdated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
