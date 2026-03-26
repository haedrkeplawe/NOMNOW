const Order = require("../../models/Order");
const Driver = require("../../models/Driver");
const Restaurant = require("../../models/restaurant");

const DRIVER_RESPONSE_TIMEOUT = 30000; // 30 ثانية
const MAX_ATTEMPTS = 3;

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

  // تحقق إذا الطلب اتأخذ من سائق قبل ما نبدأ
  const freshOrder = await Order.findById(order._id);
  if (freshOrder.driverId) return;

  // جلب دولة المطعم
  const restaurant = await Restaurant.findById(order.restaurantId).select(
    "country",
  );

  const nearbyDrivers = await Driver.find({
    availability: "online",
    country: restaurant.country, // ← فقط سائقين من نفس الدولة
    _id: { $nin: excludedDriverIds },
    currentLocation: {
      $near: { $geometry: { type: "Point", coordinates: restaurantLocation } },
    },
  }).limit(3);

  if (nearbyDrivers.length === 0) {
    // ما في سائقين متاحين — استسلم فوراً
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

  // ✅ حدّث DB عند بدء البحث
  await Order.findByIdAndUpdate(order._id, { driverSearchStatus: "searching" });
  // ✅ أرسل لكل سائق
  const notifiedDriverIds = nearbyDrivers.map((d) => d._id);

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

  console.log(
    `🔔 Attempt ${attempt} — Notified ${nearbyDrivers.length} drivers`,
  );

  // ✅ انتظر 30 ثانية
  setTimeout(async () => {
    try {
      const updatedOrder = await Order.findById(order._id);

      // سائق قبل الطلب خلال الـ 30 ثانية
      if (updatedOrder.driverId) return;

      console.log(`⏰ Attempt ${attempt} timeout — trying again`);

      // ✅ استثني المرفوضين + المبلغين في هاد الجولة
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
};

module.exports = { findAndNotifyDrivers };
