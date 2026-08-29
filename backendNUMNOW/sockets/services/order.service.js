const Order = require("../../models/Order");
const Driver = require("../../models/Driver");
const Restaurant = require("../../models/restaurant");
// v3.7 — استبدلنا استدعاء admin.messaging() المباشر بخدمة إشعار
// السائق الموحّدة، حتى يمر إشعار السائق من نفس المسار المعماري
// المستخدم لإشعار اليوزر (وجاهز لتفعيل التخزين بقاعدة البيانات لاحقاً
// من مكان واحد فقط — راجع utils/notificationDispatcher.js)
const { notifyDriverNewOrderRequest } = require("./driverNotification.service");

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

  // بث الحدث اللحظي (Socket) لكل سائق قريب متصل حالياً
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

  // v3.7 — Push notification لكل سائق قريب عبر الخدمة الموحّدة
  // (تجلب التوكن، ترسل، وتنظّف التوكنات الغير صالحة تلقائياً —
  // ونفس المسار جاهز لتفعيل التخزين بقاعدة البيانات لاحقاً)
  await Promise.all(
    nearbyDrivers.map((driver) =>
      notifyDriverNewOrderRequest(driver._id, order, restaurant),
    ),
  );

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
