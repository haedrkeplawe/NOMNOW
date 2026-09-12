const driverService = require("./services/driver.service");
const Order = require("../models/Order");
const Driver = require("../models/Driver");
const Restaurant = require("../models/restaurant");
const _ = require("lodash");
const { getSocketMessages } = require("../utils/messages");
// v4.2 — سياسة "أجر السائق الحقيقي" موحّدة، راجع utils/driverEarningOf.js
const { driverEarningOf } = require("../utils/driverEarningOf");
// v4.1
const {
  startSearchRound,
  cancelActiveSearch,
} = require("./services/order.service");
// v3.5
const { notifyUserOrderStatus } = require("./services/notification.service");

module.exports = (io, driverNS) => {
  driverNS.on("connection", async (socket) => {
    const driverId = socket.userId;
    const m = getSocketMessages(socket).socket.driver;

    console.log("Driver connected:", driverId);

    socket.join(driverId.toString());

    const driver = await Driver.findById(driverId).select("availability");
    socket.emit("driver:currentStatus", { availability: driver.availability });

    // v2.0 — B9 (مُعاد تصميمها بعد ردّكم على الرفض، لا علاقة لها بـ
    // availability إطلاقاً): سائق انقطع سوكيته أثناء جولة بحث نشطة
    // (لسا ضمن pendingDriverIds ومهلتها لسا سارية) يستلم نفس العرض فور
    // عودته، بنفس حمولة startSearchRound تماماً، بس بالوقت الفعلي
    // المتبقي بدل ٣٠ ثانية من جديد. هذا يجعل جرس إيقاظ FCM مفيداً فعلاً
    // بدل ما يوقظ التطبيق على لا شيء. نتحقق من availability=="online"
    // الحالية أيضاً حتى ما نرسل عرضاً لسائق قال صراحة إنه أوقف استقباله
    // بين الانقطاع وإعادة الاتصال.
    if (driver.availability === "online") {
      try {
        const pendingOrders = await Order.find({
          pendingDriverIds: driverId,
          driverId: null,
          driverSearchStatus: "searching",
          driverSearchExpiresAt: { $gt: new Date() },
        })
          .select(
            "orderNumber restaurantId deliveryAddress totalPrice items deliveryFee originalDeliveryFee driverSearchExpiresAt",
          )
          .populate("restaurantId", "name location");

        for (const order of pendingOrders) {
          const secondsLeft = Math.max(
            0,
            Math.round((order.driverSearchExpiresAt - Date.now()) / 1000),
          );
          if (secondsLeft <= 0) continue;

          socket.emit("order:driverRequest", {
            orderId: order._id,
            orderNumber: order.orderNumber,
            restaurantName: order.restaurantId?.name,
            restaurantLocation: order.restaurantId?.location,
            deliveryAddress: order.deliveryAddress,
            totalPrice: order.totalPrice,
            items: order.items,
            // نفس مفتاح startSearchRound (timeoutSeconds) — الوقت الفعلي
            // المتبقي، لا ٣٠ من جديد، فيعمل عدّاد التطبيق الموجود أصلاً
            // بلا أي تعديل عندكم
            timeoutSeconds: secondsLeft,
            driverEarning: driverEarningOf(order),
          });
        }
      } catch (err) {
        console.error("resend pending orders on reconnect failed:", err);
      }
    }

    socket.on("driver:goOnline", async () => {
      try {
        const activeOrder = await Order.findOne({
          driverId,
          orderStatus: { $in: ["picked_up", "on_the_way"] },
        });
        if (activeOrder) {
          return socket.emit("driver:goOnline:error", {
            message: m.hasActiveOrder,
          });
        }

        const updatedDriver = await driverService.goOnline(driverId);
        // v4.1 — تأكيد نجاح صريح عبر حدث موجود أصلاً (driver:currentStatus)
        // بدل ما يضل الفرونت بدون أي تأكيد نجاح — صفر خطر لأنو نفس الحدث
        // يلي أصلاً بينبعت عند أول اتصال
        socket.emit("driver:currentStatus", {
          availability: updatedDriver.availability,
        });
      } catch (error) {
        socket.emit("driver:goOnline:error", { message: error.message });
      }
    });

    socket.on("driver:goOffline", async () => {
      try {
        const activeOrder = await Order.findOne({
          driverId,
          orderStatus: { $in: ["picked_up", "on_the_way"] },
        });
        if (activeOrder) {
          return socket.emit("driver:goOffline:error", {
            message: m.hasActiveOrder,
          });
        }

        const updatedDriver = await driverService.goOffline(driverId);
        // v4.1 — نفس مبدأ goOnline: تأكيد صريح عبر driver:currentStatus
        socket.emit("driver:currentStatus", {
          availability: updatedDriver.availability,
        });
      } catch (error) {
        socket.emit("driver:goOffline:error", { message: error.message });
      }
    });

    socket.on(
      "driver:updateLocation",
      _.throttle(async (data) => {
        try {
          const driver = await driverService.updateLocation(driverId, data);
        } catch (error) {
          socket.emit("driver:updateLocation:error", {
            message: error.message,
          });
        }
      }, 5000),
    );

    socket.on("order:driverResponse", async (data) => {
      try {
        const { orderId, response } = data;

        if (!orderId || !response) {
          return socket.emit("order:error", {
            message: m.orderIdAndResponse,
          });
        }

        if (response === "rejected") {
          socket.emit("order:driverRequest:rejected", {
            message: m.rejected,
          });

          // v4.1 — إصلاح 5: نشيل هالسائق من قائمة "بانتظار رد" لهالجولة.
          // لو صار فاضية (يعني كل يلي انبعتلهم هالجولة رفضوا صراحة) —
          // منقطع الانتظار (30 ثانية) ومنبلش الجولة الجاية فورًا، بدل
          // ما نستنى التايم آوت كامل رغم إنو عنا جواب "لأ" من الجميع
          try {
            const updated = await Order.findOneAndUpdate(
              { _id: orderId, driverId: null, orderStatus: "accepted" },
              { $pull: { pendingDriverIds: driverId } },
              { new: true },
            ).select("pendingDriverIds");

            if (updated && updated.pendingDriverIds.length === 0) {
              cancelActiveSearch(orderId);
              await startSearchRound(io, orderId);
            }
          } catch (err) {
            console.error(
              "order:driverResponse rejection-tracking error:",
              err,
            );
          }

          return;
        }

        const [order, driver] = await Promise.all([
          Order.findById(orderId).select(
            "driverId restaurantId totalPrice orderNumber orderStatus",
          ),
          Driver.findById(driverId).select(
            "country cashCreditLimit cashCollected availability",
          ),
        ]);

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        if (driver.availability !== "online") {
          return socket.emit("order:error", { message: m.notOnline });
        }

        const activeOrder = await Order.findOne({
          driverId,
          orderStatus: { $in: ["picked_up", "on_the_way"] },
        });
        if (activeOrder) {
          return socket.emit("order:error", { message: m.alreadyHasOrder });
        }

        if (order.orderStatus !== "accepted") {
          return socket.emit("order:driverRequest:expired", {
            message: m.orderExpired,
          });
        }

        if (order.driverId) {
          return socket.emit("order:driverRequest:expired", {
            message: m.orderTaken,
          });
        }

        const restaurant = await Restaurant.findById(order.restaurantId).select(
          "country",
        );

        if (restaurant.country !== driver.country) {
          return socket.emit("order:error", { message: m.differentCountry });
        }

        if (driver.country === "SY") {
          const wouldCollect = driver.cashCollected + order.totalPrice;
          if (wouldCollect > driver.cashCreditLimit) {
            return socket.emit("order:cashLimit:exceeded", {
              message: m.cashLimitReached,
              cashCollected: driver.cashCollected,
              cashCreditLimit: driver.cashCreditLimit,
              orderTotal: order.totalPrice,
            });
          }
        }

        // v4.1 — إصلاح 3: بدل قراءة-ثم-حفظ العادية (يلي فيها احتمال
        // يصير سائقين ياخدوا نفس الطلب لو ضغطوا قبول بنفس اللحظة تقريبًا)،
        // منستخدم عملية ذرية وحدة: الشرط driverId:null بيضمن إنو لو حدا
        // ثاني سبقنا (حتى لو بجزء من الثانية)، العملية بترجع null ومنعرف
        // فورًا إنو الطلب أخذه غيرنا، بدل ما نفترض النجاح غلط
        const claimedOrder = await Order.findOneAndUpdate(
          { _id: orderId, driverId: null, orderStatus: "accepted" },
          {
            $set: {
              driverId,
              orderStatus: "picked_up",
              driverSearchStatus: "assigned",
              pendingDriverIds: [],
            },
          },
          { new: true },
        );

        if (!claimedOrder) {
          // حدا ثاني أخذ الطلب بنفس اللحظة تقريبًا — منرجعله نفس رسالة
          // "الطلب أخذه غيرك" الموجودة أصلاً، صفر تغيير على الفرونت
          return socket.emit("order:driverRequest:expired", {
            message: m.orderTaken,
          });
        }

        cancelActiveSearch(orderId); // ألغي مؤقت الجولة — ما في داعي له بعد النجاح

        const [populatedOrder] = await Promise.all([
          Order.findById(claimedOrder._id)
            // v4.0/v4.1 — حقول داخلية (مالية + تفاصيل بحث السائق) —
            // نستثنيها هون لأن هالكائن بيتبعث مباشرة لسوكيت السائق
            // (وللمستخدم/المطعم كمان بنفس الحدث)
            .select(
              "-originalItemsPrice -promotionDiscount -notifiedDriverIds -pendingDriverIds -driverSearchExpiresAt -driverSearchAttempt",
            )
            .populate("userId", "name phone")
            .populate("restaurantId", "name location")
            .populate("driverId", "name phone vehicletype vehicleplate rating"),
          Driver.findByIdAndUpdate(driverId, { availability: "busy" }),
        ]);

        socket.emit("order:driverRequest:accepted", {
          success: true,
          order: populatedOrder,
        });

        io.of("/user")
          .to(populatedOrder.userId._id.toString())
          .emit("order:statusUpdated", {
            orderId: populatedOrder._id,
            orderNumber: populatedOrder.orderNumber,
            status: populatedOrder.orderStatus,
            driver: { id: driverId },
          });

        // v3.5
        notifyUserOrderStatus(
          populatedOrder.userId._id,
          "picked_up",
          populatedOrder,
        );

        io.of("/restaurant")
          .to(populatedOrder.restaurantId._id.toString())
          .emit("order:driverAssigned", {
            orderId: populatedOrder._id,
            orderNumber: populatedOrder.orderNumber,
            order: populatedOrder,
          });

        console.log(`Driver ${driverId} accepted order ${order.orderNumber}`);
      } catch (error) {
        console.error("order:driverResponse error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("order:startDelivery", async (data) => {
      try {
        const { orderId } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: m.orderIdRequired });
        }

        const order = await Order.findOne({ _id: orderId, driverId }).select(
          "orderStatus userId restaurantId orderNumber",
        );

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        if (order.orderStatus !== "picked_up") {
          return socket.emit("order:error", { message: m.mustBePickedUp });
        }

        order.orderStatus = "on_the_way";
        await order.save();

        const populatedOrder = await Order.findById(order._id)
          // v4.0 — حماية احترازية: استثناء الحقلين الداخليين حتى لو
          // تغيّر مين بيستقبل هالحدث بالمستقبل
          .select(
            "-originalItemsPrice -promotionDiscount -notifiedDriverIds -pendingDriverIds -driverSearchExpiresAt -driverSearchAttempt",
          )
          .populate("userId", "name phone")
          .populate("driverId", "name phone vehicletype vehicleplate rating")
          .populate("restaurantId", "name");

        socket.emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "on_the_way",
        });

        io.of("/user").to(order.userId.toString()).emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "on_the_way",
        });

        // v3.5
        notifyUserOrderStatus(order.userId, "on_the_way", order);

        io.of("/restaurant")
          .to(order.restaurantId.toString())
          .emit("order:updated", { order: populatedOrder });

        console.log(
          `Driver ${driverId} → order ${order.orderNumber} : on_the_way`,
        );
      } catch (error) {
        console.error("order:startDelivery error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("order:delivered", async (data) => {
      try {
        const { orderId } = data;

        if (!orderId) {
          return socket.emit("order:error", { message: m.orderIdRequired });
        }

        const order = await Order.findOne({ _id: orderId, driverId }).select(
          "orderStatus userId restaurantId orderNumber itemsPrice deliveryFee originalDeliveryFee",
        );

        if (!order) {
          return socket.emit("order:error", { message: m.orderNotFound });
        }

        if (order.orderStatus !== "on_the_way") {
          return socket.emit("order:error", { message: m.mustBeOnTheWay });
        }

        order.orderStatus = "delivered";
        order.deliveredByDriverAt = new Date();
        order.paymentStatus = "paid";
        order.settlementStatus = "pending_settlement";
        order.driverPaymentStatus = "pending";
        await order.save();

        const freshDriver = await Driver.findById(driverId).select("country");

        if (freshDriver?.country === "SY") {
          // v4.2 — استبدلنا الصيغة اليدوية بالدالة الموحّدة driverEarningOf
          const driverCash = order.itemsPrice + driverEarningOf(order);
          await Driver.findByIdAndUpdate(driverId, {
            $inc: { cashCollected: driverCash },
            availability: "online",
          });
        } else {
          await Driver.findByIdAndUpdate(driverId, {
            availability: "online",
          });
        }

        const populatedOrder = await Order.findById(order._id)
          // v4.0 — حماية احترازية: استثناء الحقلين الداخليين
          .select(
            "-originalItemsPrice -promotionDiscount -notifiedDriverIds -pendingDriverIds -driverSearchExpiresAt -driverSearchAttempt",
          )
          .populate("userId", "name phone")
          .populate("driverId", "name phone vehicletype vehicleplate rating");

        socket.emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "delivered",
        });

        socket.emit("driver:currentStatus", { availability: "online" });

        io.of("/user").to(order.userId.toString()).emit("order:statusUpdated", {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: "delivered",
        });

        // v3.5
        notifyUserOrderStatus(order.userId, "delivered", order);

        io.of("/restaurant")
          .to(order.restaurantId.toString())
          .emit("order:updated", { order: populatedOrder });

        console.log(
          `Driver ${driverId} → order ${order.orderNumber} : delivered`,
        );
      } catch (error) {
        console.error("order:delivered error:", error);
        socket.emit("order:error", { message: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("Driver disconnected:", driverId);
    });
  });
};
