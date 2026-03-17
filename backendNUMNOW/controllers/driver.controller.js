const bcrypt = require("bcryptjs");
const uploadBuffer = require("../utils/cloudUpload");
const cloudinary = require("../config/cloudinary");
const Driver = require("../models/Driver");
const Restaurant = require("../models/restaurant");
const jwt = require("jsonwebtoken");
const sendResetEmail = require("../utils/sendResetEmail");
const crypto = require("crypto");

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
    const restaurants = await Restaurant.find({});
    res.json({ restaurants });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
