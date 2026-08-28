const Order = require("../../models/Order");
const Driver = require("../../models/Driver");
const Restaurant = require("../../models/restaurant");
const admin = require("../../config/firebase");

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
    "country name",
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

  const fcmTokens = nearbyDrivers.map((d) => d.fcmToken).filter(Boolean);

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

  if (fcmTokens.length > 0) {
    try {
      const fcmResponse = await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title: "طلب توصيل جديد",
          body: `مطعم ${restaurant.name} — السعر: ${order.totalPrice}`,
        },
        data: {
          type: "order:driverRequest",
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          timeoutSeconds: "30",
        },
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default" } } },
      });

      const invalidTokenDriverIds = [];
      fcmResponse.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          const isInvalidToken =
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-argument";

          if (isInvalidToken) {
            // نربط كل token بصاحبه عبر نفس الترتيب
            const token = fcmTokens[idx];
            const driver = nearbyDrivers.find((d) => d.fcmToken === token);
            if (driver) invalidTokenDriverIds.push(driver._id);
          } else {
            console.error(`FCM error for token[${idx}]:`, resp.error);
          }
        }
      });

      if (invalidTokenDriverIds.length > 0) {
        await Driver.updateMany(
          { _id: { $in: invalidTokenDriverIds } },
          { fcmToken: null },
        );
      }
    } catch (err) {
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
