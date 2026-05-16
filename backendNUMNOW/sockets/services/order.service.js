const Order = require("../../models/Order");
const Driver = require("../../models/Driver");
const Restaurant = require("../../models/restaurant");
const admin = require("../../config/firebase"); // ← جديد: Firebase Admin SDK

const DRIVER_RESPONSE_TIMEOUT = 30000;
const MAX_ATTEMPTS = 3;

const activeSearchTimers = new Map();

const cancelActiveSearch = (orderId) => {
  const key = orderId.toString();
  if (activeSearchTimers.has(key)) {
    clearTimeout(activeSearchTimers.get(key));
    activeSearchTimers.delete(key);
  }
};

const findAndNotifyDrivers = async (
  io,
  order,
  restaurantLocation,
  attempt = 1,
  excludedDriverIds = [],
) => {
  if (attempt > MAX_ATTEMPTS) {
    await Order.findByIdAndUpdate(order._id, { driverSearchStatus: "failed" });
    io.of("/restaurant")
      .to(order.restaurantId.toString())
      .emit("order:noDriverFound", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        message: "No driver accepted the order after 3 attempts",
      });
    return;
  }

  const freshOrder = await Order.findById(order._id);
  if (freshOrder.driverId) return;

  const restaurant = await Restaurant.findById(order.restaurantId).select(
    "country",
  );

  const nearbyDrivers = await Driver.find({
    availability: "online",
    country: restaurant.country,
    _id: { $nin: excludedDriverIds },
    currentLocation: {
      $near: { $geometry: { type: "Point", coordinates: restaurantLocation } },
    },
  }).limit(3);

  if (nearbyDrivers.length === 0) {
    await Order.findByIdAndUpdate(order._id, { driverSearchStatus: "failed" });
    io.of("/restaurant")
      .to(order.restaurantId.toString())
      .emit("order:noDriverFound", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        message: "No available drivers",
      });
    return;
  }

  await Order.findByIdAndUpdate(order._id, { driverSearchStatus: "searching" });
  const notifiedDriverIds = nearbyDrivers.map((d) => d._id);

  // ← جديد: نجمع fcmTokens من السائقين الذين لديهم token مخزن
  const fcmTokens = nearbyDrivers.map((d) => d.fcmToken).filter(Boolean);

  // 1. Socket emit — للسائق إذا التطبيق مفتوح ومتصل بالـ socket
  nearbyDrivers.forEach((driver) => {
    io.of("/driver")
      .to(driver._id.toString())
      .emit("order:driverRequest", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        restaurantName: order.restaurantName,
        restaurantLocation: { type: "Point", coordinates: restaurantLocation },
        deliveryAddress: order.deliveryAddress,
        totalPrice: order.totalPrice,
        items: order.items,
        timeoutSeconds: 30,
      });
  });

  // new
  // 2. FCM Push Notification — للسائق إذا التطبيق مغلق
  // ← جديد: يصل كإشعار على الشاشة، السائق يضغطه فيفتح التطبيق ويتصل بالـ socket
  if (fcmTokens.length > 0) {
    try {
      await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title: "طلب توصيل جديد",
          body: `مطعم ${order.restaurantName} — السعر: ${order.totalPrice}`,
        },
        data: {
          // بيانات إضافية يقرأها التطبيق عند فتح الإشعار
          type: "order:driverRequest",
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          timeoutSeconds: "30",
        },
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      });
    } catch (err) {
      // خطأ FCM لا يوقف البحث — نسجله فقط
      console.error("FCM send error:", err);
    }
  }

  const timerId = setTimeout(async () => {
    activeSearchTimers.delete(order._id.toString());
    try {
      const updatedOrder = await Order.findById(order._id);
      if (updatedOrder.driverId) return;
      const newExcluded = [...excludedDriverIds, ...notifiedDriverIds];
      await findAndNotifyDrivers(
        io,
        updatedOrder,
        restaurantLocation,
        attempt + 1,
        newExcluded,
      );
    } catch (error) {
      console.error("findAndNotifyDrivers timeout error:", error);
    }
  }, DRIVER_RESPONSE_TIMEOUT);

  activeSearchTimers.set(order._id.toString(), timerId);
};

module.exports = { findAndNotifyDrivers, cancelActiveSearch };
