const Order = require("../../models/Order");
const Driver = require("../../models/Driver");
const Restaurant = require("../../models/restaurant");
// v3.7 — استبدلنا استدعاء admin.messaging() المباشر بخدمة إشعار
// السائق الموحّدة، حتى يمر إشعار السائق من نفس المسار المعماري
// المستخدم لإشعار اليوزر (وجاهز لتفعيل التخزين بقاعدة البيانات لاحقاً
// من مكان واحد فقط — راجع utils/notificationDispatcher.js)
const { notifyDriverNewOrderRequest } = require("./drivernotification.service");

const DRIVER_RESPONSE_TIMEOUT = 30000;
const MAX_ATTEMPTS = 3;
// v4.1 — كل ما هوه أكبر من DRIVER_RESPONSE_TIMEOUT حتى ما يزاحم المؤقت
// العادي؛ هاد بس شبكة أمان لاستعادة البحث لو صار ريستارت للسيرفر
const RECOVERY_SWEEP_INTERVAL = 15000;

// v4.1 — لسا نحتفظ بمؤقتات بذاكرة السيرفر (للاستجابة الفورية باللحظة)،
// بس صار عندنا كمان نسخة موثوقة بالداتابيز (driverSearchAttempt,
// pendingDriverIds, driverSearchExpiresAt) تقدر تكمل البحث حتى لو
// فقدنا هالمؤقتات بسبب ريستارت — راجع startSearchRecoverySweep تحت
const activeSearchTimers = new Map();

const cancelActiveSearch = (orderId) => {
  const key = orderId.toString();
  if (activeSearchTimers.has(key)) {
    clearTimeout(activeSearchTimers.get(key));
    activeSearchTimers.delete(key);
  }
};

// v4.1 — نقطة الدخول الوحيدة لبدء/متابعة جولة بحث عن سائق. بتاخد orderId
// بس (مش order/location/attempt/excluded كباراميترات منفصلة زي قبل) —
// هيك ما في مجال إطلاقًا لتمرير باراميتر غلط بمكانه (كان هيك انصلح
// باگ "restaurant.country بمكان attempt" من جذوره، مو بس بمكان الاستدعاء).
// كل شي (رقم المحاولة، مين انبعتلهم، الموقع...) بينقرا طازة من الداتابيز
// بكل نداء، فهاي الدالة آمنة تُستدعى أكتر من مرة بالتوازي (من المؤقت
// ومن sweep الاستعادة سوا مثلاً) بفضل قفل تفاؤلي (optimistic concurrency)
// عبر شرط driverSearchAttempt بعملية findOneAndUpdate.
const startSearchRound = async (io, orderId) => {
  const current = await Order.findById(orderId).select(
    "driverId orderStatus restaurantId driverSearchAttempt notifiedDriverIds orderNumber totalPrice items deliveryAddress",
  );

  // الطلب اتلغى، أو حدا ثاني أخذه، أو حالته تغيّرت — ما في داعي نكمل
  if (!current || current.driverId || current.orderStatus !== "accepted") {
    return;
  }

  const attemptBefore = current.driverSearchAttempt || 0;
  const nextAttempt = attemptBefore + 1;

  const restaurant = await Restaurant.findById(current.restaurantId).select(
    "country name location",
  );
  if (!restaurant) return;

  if (nextAttempt > MAX_ATTEMPTS) {
    await Order.findOneAndUpdate(
      { _id: orderId, driverId: null },
      { $set: { driverSearchStatus: "failed", pendingDriverIds: [] } },
    );
    io.of("/restaurant")
      .to(current.restaurantId.toString())
      .emit("order:noDriverFound", {
        orderId: current._id,
        orderNumber: current.orderNumber,
        message: "No driver accepted the order after 3 attempts",
      });
    return;
  }

  const restaurantLocation = restaurant.location.coordinates;

  const nearbyDrivers = await Driver.find({
    availability: "online",
    country: restaurant.country,
    _id: { $nin: current.notifiedDriverIds || [] },
    currentLocation: {
      $near: { $geometry: { type: "Point", coordinates: restaurantLocation } },
    },
  }).limit(3);

  if (nearbyDrivers.length === 0) {
    await Order.findOneAndUpdate(
      { _id: orderId, driverId: null },
      { $set: { driverSearchStatus: "failed", pendingDriverIds: [] } },
    );
    io.of("/restaurant")
      .to(current.restaurantId.toString())
      .emit("order:noDriverFound", {
        orderId: current._id,
        orderNumber: current.orderNumber,
        message: "No available drivers",
      });
    return;
  }

  const notifiedIds = nearbyDrivers.map((d) => d._id);
  const expiresAt = new Date(Date.now() + DRIVER_RESPONSE_TIMEOUT);

  // v4.1 — الحجز الذري لهالجولة: الشرط driverSearchAttempt: attemptBefore
  // يضمن ما حدا ثاني (تايمر أو sweep الاستعادة) حجز نفس الجولة بالتوازي —
  // لو حدا سبقنا، findOneAndUpdate بترجع null ومنكتفي نطنّش بأمان
  const claimed = await Order.findOneAndUpdate(
    {
      _id: orderId,
      driverId: null,
      orderStatus: "accepted",
      driverSearchAttempt: attemptBefore,
    },
    {
      $set: {
        driverSearchStatus: "searching",
        driverSearchAttempt: nextAttempt,
        pendingDriverIds: notifiedIds,
        driverSearchExpiresAt: expiresAt,
      },
      $addToSet: { notifiedDriverIds: { $each: notifiedIds } },
    },
    { new: true },
  );

  if (!claimed) return; // حدا سبقنا بحجز هالجولة بالضبط — تجاهل بأمان

  // بث الحدث اللحظي (Socket) لكل سائق قريب متصل حالياً
  // v4.1 — إصلاح: restaurantName صارت restaurant.name الحقيقي بدل
  // order.restaurantName يلي كان دايمًا undefined (الحقل ما إله وجود
  // على موديل Order أصلاً)
  nearbyDrivers.forEach((driver) => {
    io.of("/driver")
      .to(driver._id.toString())
      .emit("order:driverRequest", {
        orderId: current._id,
        orderNumber: current.orderNumber,
        restaurantName: restaurant.name,
        restaurantLocation: { type: "Point", coordinates: restaurantLocation },
        deliveryAddress: current.deliveryAddress,
        totalPrice: current.totalPrice,
        items: current.items,
        timeoutSeconds: 30,
      });
  });

  // v3.7 — Push notification لكل سائق قريب عبر الخدمة الموحّدة
  await Promise.all(
    nearbyDrivers.map((driver) =>
      notifyDriverNewOrderRequest(driver._id, current, restaurant),
    ),
  );

  const timerId = setTimeout(() => {
    activeSearchTimers.delete(orderId.toString());
    startSearchRound(io, orderId).catch((error) => {
      console.error("startSearchRound timeout error:", error);
    });
  }, DRIVER_RESPONSE_TIMEOUT);

  activeSearchTimers.set(orderId.toString(), timerId);
};

// v4.1 — شبكة أمان: لو صار ريستارت للسيرفر أثناء وجود بحث نشط، مؤقت
// الذاكرة (setTimeout) بينفقد، بس driverSearchExpiresAt المخزّن
// بالداتابيز بيضل موجود. هالدالة بتفحص دوريًا أي طلب "منتهي الجولة"
// وما في مؤقت شغال إله بهالإنستنس، وبتكمل البحث تلقائيًا بدل ما يعلق
// الطلب "searching" للأبد. آمنة تُشغّل من أكتر من إنستنس بفضل القفل
// التفاؤلي جوا startSearchRound نفسها.
const startSearchRecoverySweep = (io) => {
  setInterval(async () => {
    try {
      const staleOrders = await Order.find({
        driverSearchStatus: "searching",
        driverId: null,
        driverSearchExpiresAt: { $lte: new Date() },
      }).select("_id");

      for (const o of staleOrders) {
        if (activeSearchTimers.has(o._id.toString())) continue;
        await startSearchRound(io, o._id);
      }
    } catch (error) {
      console.error("driver search recovery sweep error:", error);
    }
  }, RECOVERY_SWEEP_INTERVAL);
};

module.exports = {
  startSearchRound,
  cancelActiveSearch,
  startSearchRecoverySweep,
};
