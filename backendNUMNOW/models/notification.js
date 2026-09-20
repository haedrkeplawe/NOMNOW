// v3.7 — موديل الإشعارات (جاهز للاستخدام المستقبلي)
// هذا الموديل معرّف بس التخزين الفعلي معطّل حالياً عبر
// PERSISTED_NOTIFICATION_KEYS بملف utils/notificationDispatcher.js —
// يعني هالكولكشن رح يضل فاضي لحد ما تفعّل التخزين لحدث معيّن، وقتها
// بيشتغل تلقائياً بدون أي تعديل هون أو بأي مكان تاني بالمشروع.
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // نوع المستقبل — يحدد أي موديل نربط فيه recipientId عبر refPath
    recipientType: {
      type: String,
      enum: ["user", "driver"],
      required: true,
    },
    recipientModel: {
      type: String,
      enum: ["User", "Driver"],
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "recipientModel",
    },

    // نوع الحدث — نفس القيمة المرسلة بحقل data.type بالـ push notification
    // (مثلاً: "order:statusUpdated", "order:driverRequest", "custom")
    type: {
      type: String,
      required: true,
    },

    title: { type: String, required: true },
    body: { type: String, required: true },

    // أي بيانات إضافية مرتبطة بالإشعار (orderId, orderNumber...)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// للاستعلام السريع: "كل إشعارات هذا المستخدم/السائق، الأحدث أولاً"
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
