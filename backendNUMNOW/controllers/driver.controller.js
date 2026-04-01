const bcrypt = require("bcryptjs");
const uploadBuffer = require("../utils/cloudUpload");
const cloudinary = require("../config/cloudinary");
const Driver = require("../models/Driver");
const Restaurant = require("../models/restaurant");
const jwt = require("jsonwebtoken");
const sendResetEmail = require("../utils/sendResetEmail");
const crypto = require("crypto");
const Order = require("../models/Order");

//
exports.register = async (req, res) => {
  try {
    const { name, email, phone, vehicletype, vehicleplate, password, zone } =
      req.body;

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

    // تحديد الدولة تلقائياً من رقم الهاتف
    if (phone.startsWith("+49")) {
      const dePhoneRegex = /^\+49[1-9][0-9]{9,13}$/;
      if (!dePhoneRegex.test(phone)) {
        return res.status(400).json({
          message: "Invalid German phone number. Must start with +49",
        });
      }
    } else if (phone.startsWith("+963")) {
      const syPhoneRegex = /^\+963[9][0-9]{8}$/;
      if (!syPhoneRegex.test(phone)) {
        return res.status(400).json({
          message: "Invalid Syrian phone number. Must start with +963",
        });
      }
    } else {
      return res.status(400).json({
        message: "Phone must start with +49 (Germany) or +963 (Syria)",
      });
    }

    const country = phone.startsWith("+49") ? "DE" : "SY";

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
      country,
      documents: [],
    });

    // ✅ رفع الصور (اختياري لكن غالبًا مطلوبة)
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

// Login with --phone--  And verify for first time
exports.loginWithPhone = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ message: "Missing required fields" });

    const driver = await Driver.findOne({ phone });

    if (!driver)
      return res.status(404).json({ message: "Invalid phone or password" });

    const isMatch = await bcrypt.compare(password, driver.password);

    if (!isMatch)
      return res.status(400).json({ message: "Invalid phone or password" });
    // 📌 إذا الرقم غير مفعّل → OTP
    if (!driver.isVerifiedPhone) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      driver.phoneOtp = otp;
      driver.phoneOtpExpire = Date.now() + 60 * 60 * 1000;
      await driver.save();

      return res.status(200).json({
        message: "OTP sent",
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

    const driver = await Driver.findOne({ phone });
    if (!driver) throw new Error("Phone not found");
    console.log(driver.phoneOtp, otp);

    if (driver.phoneOtp !== otp) throw new Error("Invalid OTP");

    if (driver.phoneOtpExpire < Date.now()) throw new Error("OTP expired");

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
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const driver = await Driver.findOne({ email });
  if (!driver) return res.status(404).json({ message: "driver not found" });

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

  const resetUrl = `${process.env.FRONTEND_URL_RES}/reset-password/${resetToken}`;

  // إرسال إيميل
  await sendResetEmail({
    to: driver.email,
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

  const driver = await Driver.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!driver)
    return res.status(400).json({ message: "Invalid or expired token" });

  driver.password = await bcrypt.hash(req.body.password, 10);
  driver.resetPasswordToken = undefined;
  driver.resetPasswordExpire = undefined;

  await driver.save();

  res.json({ message: "Password reset successful" });
};

exports.getDriverInfo = async (req, res) => {
  try {
    const driver = await Driver.findById(
      req.driverId || req.driver?._id || req.user?.id,
    ).select(
      "-password -resetPasswordToken -resetPasswordExpire -emailOtp -emailOtpExpire -phoneOtp -phoneOtpExpire",
    );
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json({ driver });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateDriverInfo = async (req, res) => {
  try {
    const driverId = req.driverId || req.driver?._id || req.user?.id;

    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
      });
    }

    // =========================
    // 1️⃣ تحديث صورة السائق الشخصية
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
      if (!req.files?.[fileField]) return;

      const document = driver.documents.find((doc) => doc.type === type);

      if (!document) {
        return res.status(400).json({
          message: `${type} document not found`,
        });
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
    };

    await updateDocument("id", "idImage");
    await updateDocument("driving_license", "drivingLicenseImage");
    await updateDocument("vehicle_registration", "vehicleRegistrationImage");

    await driver.save();

    res.json({
      message: "Images updated successfully",
      driver,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
};

// restaurant
exports.findRestaurants = async (req, res) => {
  try {
    const driver = await Driver.findById(req.user?.id).select("country");
    const restaurants = await Restaurant.find({
      country: driver.country,
    });
    res.json({ restaurants });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// order
exports.getActiveOrder = async (req, res) => {
  try {
    const driverId = req.user?.id;

    const activeOrder = await Order.findOne({
      driverId,
      orderStatus: { $in: ["picked_up", "on_the_way", "delivered_by_driver"] },
    })
      .populate("userId", "name phone")
      .populate("restaurantId", "name location address");

    res.status(200).json({
      hasActiveOrder: !!activeOrder,
      order: activeOrder || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// money
exports.getWallet = async (req, res) => {
  try {
    const driverId = req.user?.id;

    const driver = await Driver.findById(driverId).select(
      "country cashCollected cashCreditLimit",
    );
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    // السائق الألماني لا يملك محفظة كاش
    if (driver.country !== "SY") {
      return res.status(200).json({
        success: true,
        wallet: {
          isCashDriver: false,
        },
      });
    }

    // ── حساب totalCollectedToday ──────────────────────────
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

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

    // cashCollected = كل الكاش عند السائق (To Be Deposited)
    const cashCollected = driver.cashCollected ?? 0;
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
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    if (driver.country !== "SY") {
      return res.status(200).json({
        success: true,
        summary: {
          totalCollected: 0,
          pendingSettlement: 0,
          cashHeldForSettlement: 0,
          pendingCount: 0,
          settledCount: 0,
        },
        orders: [],
      });
    }

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

    const totalCollected = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    const pendingSettlement = pendingOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );
    const cashHeldForSettlement =
      pendingOrders.reduce((sum, o) => sum + o.totalPrice, 0) -
      pendingSettlement;

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
// financial transactions
exports.getFinancialTransactions = async (req, res) => {
  try {
    const driverId = req.user?.id;
    const { period = "all" } = req.query;

    const driver = await Driver.findById(driverId).select("country");
    if (!driver) return res.status(404).json({ message: "Driver not found" });

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

    // ── Current Balance و Restaurant Held (كل الوقت دائماً) ──
    const allOrders = await Order.find({
      driverId,
      orderStatus: "delivered",
      driverPaymentStatus: { $in: ["pending", "settled"] },
    }).select("deliveryFee driverPaymentStatus");

    const currentBalance = allOrders
      .filter((o) => o.driverPaymentStatus === "settled")
      .reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    const restaurantHeldBalance = allOrders
      .filter((o) => o.driverPaymentStatus === "pending")
      .reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    // ── Total Earnings للـ period ─────────────────────────
    const totalEarnings = orders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );
    const ordersCount = orders.length;

    // ── Weekly Change ─────────────────────────────────────
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 6);
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 13);
    lastWeekStart.setHours(0, 0, 0, 0);

    const lastWeekEnd = new Date(now);
    lastWeekEnd.setDate(now.getDate() - 7);
    lastWeekEnd.setHours(23, 59, 59, 999);

    const [thisWeekOrders, lastWeekOrders] = await Promise.all([
      Order.find({
        driverId,
        orderStatus: "delivered",
        driverPaymentStatus: { $in: ["pending", "settled"] },
        createdAt: { $gte: thisWeekStart },
      }).select("deliveryFee"),
      Order.find({
        driverId,
        orderStatus: "delivered",
        driverPaymentStatus: { $in: ["pending", "settled"] },
        createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd },
      }).select("deliveryFee"),
    ]);

    const thisWeekEarnings = thisWeekOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );
    const lastWeekEarnings = lastWeekOrders.reduce(
      (sum, o) => sum + (o.deliveryFee || 0),
      0,
    );

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
          orderValue,
          deliveryFeeEarning: deliveryFee, // موجب — حصة السائق
          deductedFromBalance: -orderValue, // سالب — يُخصم من رصيد المطعم
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
