const Restaurant = require("../models/restaurant");
const RestaurantUser = require("../models/restaurantUser");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Ads = require("../models/ads");
const uploadBuffer = require("../utils/cloudUpload");
const cloudinary = require("../config/cloudinary");
const Driver = require("../models/Driver");
const Food = require("../models/food");

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
    const restaurants = await Restaurant.find()
      .populate("owner") // إذا في صاحب مطعم
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      restaurants,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch restaurants",
    });
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
    const customer = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });

    // العدد الكلي
    const totalUsers = await User.countDocuments();

    // تاريخ قبل 7 أيام من الآن
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    // عدد المستخدمين المسجلين خلال آخر 7 أيام
    const usersLast7Days = await User.countDocuments({
      createdAt: { $gte: last7Days },
    });

    res.status(200).json({
      success: true,
      customer,
      totalUsers,
      usersThisWeek: usersLast7Days,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.message,
    });
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
// update
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
    const drivers = await Driver.find()
      .select("-password -emailOtp -phoneOtp -resetPasswordToken")
      .sort({ createdAt: -1 });

    const ratedDrivers = drivers.filter((d) => d.rating > 0);

    const totalRatings = ratedDrivers.reduce((sum, d) => sum + d.rating, 0);

    const averageDriversRating =
      ratedDrivers.length > 0
        ? Number((totalRatings / ratedDrivers.length).toFixed(1))
        : 0;

    res.status(200).json({
      success: true,
      averageDriversRating,
      total: drivers.length,
      drivers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
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
